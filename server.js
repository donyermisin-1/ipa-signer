const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { randomUUID } = require("crypto");
const QRCode = require("qrcode");

const { signIpa, isZsignAvailable, getZsignPath } = require("./lib/signer");
const { removePath } = require("./lib/cleanup");
const { runSignJob, cleanupSignJob } = require("./lib/sign-job");
const { InstallSessionStore } = require("./lib/install-sessions");
const { createInstallRouter } = require("./lib/install-routes");
const { createHttpsInstallServer } = require("./lib/https-install");
const { getLocalIPv4Addresses, getPrimaryLocalIPv4 } = require("./lib/network");
const { readInfoPlistFromIpa } = require("./lib/ipa-metadata");
const { buildItmsServicesUrl } = require("./lib/manifest");

const app = express();
const installApp = express();
const PORT = Number(process.env.PORT || 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const HOST = process.env.HOST || "0.0.0.0";
const TMP_DIR = path.join(__dirname, "tmp");
const sessions = new InstallSessionStore();

fs.mkdirSync(TMP_DIR, { recursive: true });

function resolveHost(req) {
  return process.env.PUBLIC_HOST || getPrimaryLocalIPv4();
}

function getHttpBaseUrl(req) {
  const host = resolveHost(req);
  return process.env.PUBLIC_HOST ? `https://${host}` : `http://${host}:${PORT}`;
}

function getHttpsBaseUrl(req) {
  const host = resolveHost(req);
  return process.env.PUBLIC_HOST ? `https://${host}` : `https://${host}:${HTTPS_PORT}`;
}

const installRouter = createInstallRouter({
  sessions,
  getHttpBaseUrl,
  getHttpsBaseUrl,
});

app.use("/install", installRouter);
installApp.use("/install", installRouter);

const upload = multer({
  storage: multer.diskStorage({
    destination: TMP_DIR,
    filename: (_req, file, cb) => {
      cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
    },
  }),
  limits: {
    fileSize: 1024 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = {
      ipa: [".ipa"],
      p12: [".p12", ".pfx"],
      mobileprovision: [".mobileprovision"],
    };

    const ext = path.extname(file.originalname).toLowerCase();
    const field = file.fieldname;

    if (field === "ipa" && allowed.ipa.includes(ext)) {
      cb(null, true);
      return;
    }

    if (field === "p12" && allowed.p12.includes(ext)) {
      cb(null, true);
      return;
    }

    if (field === "mobileprovision" && allowed.mobileprovision.includes(ext)) {
      cb(null, true);
      return;
    }

    cb(new Error(`Invalid file type for ${field}: ${file.originalname}`));
  },
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    zsignAvailable: isZsignAvailable(),
    zsignPath: getZsignPath(),
    installServer: {
      httpPort: PORT,
      httpsPort: HTTPS_PORT,
      localAddresses: getLocalIPv4Addresses(),
    },
  });
});

app.post(
  "/api/sign",
  upload.fields([
    { name: "ipa", maxCount: 1 },
    { name: "p12", maxCount: 1 },
    { name: "mobileprovision", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const ipaFile = req.files?.ipa?.[0];
      const p12File = req.files?.p12?.[0];
      const provFile = req.files?.mobileprovision?.[0];
      const password = req.body?.password ?? "";
      const installToDevice = req.body?.install === "true" || req.body?.install === "1";

      if (!ipaFile || !p12File || !provFile) {
        res.status(400).json({
          error: "Missing required files. Upload an .ipa, .p12, and .mobileprovision file.",
        });
        return;
      }

      if (!password) {
        res.status(400).json({ error: "P12 password is required." });
        return;
      }

      const result = await runSignJob({
        ipaFile,
        p12File,
        provFile,
        password,
        tmpDir: TMP_DIR,
      });

      if (installToDevice) {
        const metadata = readInfoPlistFromIpa(result.outputPath);
        const session = sessions.create({
          ipaPath: result.outputPath,
          fileName: result.outputName,
          workDir: result.workDir,
          title: metadata.title,
          bundleIdentifier: metadata.bundleIdentifier,
          bundleVersion: metadata.bundleVersion,
        });

        const installPageUrl = `${getHttpBaseUrl(req)}/install/${session.id}?auto=1`;
        const manifestUrl = `${getHttpsBaseUrl(req)}/install/${session.id}/manifest.plist`;
        const itmsUrl = buildItmsServicesUrl(manifestUrl);
        const qrDataUrl = await QRCode.toDataURL(installPageUrl, {
          margin: 1,
          width: 280,
        });

        res.json({
          mode: "install",
          installId: session.id,
          appName: session.title,
          installPageUrl,
          manifestUrl,
          itmsUrl,
          qrDataUrl,
          expiresAt: session.expiresAt,
          instructions: [
            "Connect your iPhone to the same Wi-Fi network as this PC.",
            "Scan the QR code or open the install link in Safari on your iPhone.",
            "Tap Install when iOS prompts you.",
            "If needed, trust the developer under Settings → General → VPN & Device Management.",
            "Keep this PC awake until the download finishes.",
          ],
        });

        // Run cleanup safely after the response is completed
        setTimeout(async () => {
          try {
            await cleanupSignJob({
              workDir: result.workDir,
              uploadedPaths: result.uploadedPaths,
              keepOutput: true,
              outputPath: result.outputPath,
            });
          } catch (e) {
            console.error("Delayed cleanup error:", e.message);
          }
        }, 5000);

        return;
      }

      res.download(result.outputPath, result.outputName, async () => {
        await cleanupSignJob({
          workDir: result.workDir,
          uploadedPaths: result.uploadedPaths,
        });
      });
    } catch (err) {
      res.status(500).json({
        error: err.message || "Signing failed.",
      });
    }
  }
);

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "File too large. Maximum size is 1 GB per file." });
      return;
    }

    res.status(400).json({ error: err.message });
    return;
  }

  res.status(400).json({ error: err.message || "Bad request." });
});

setInterval(() => {
  sessions.cleanupExpired();
}, 5 * 60 * 1000);

async function start() {
  await createHttpsInstallServer(installApp, HTTPS_PORT);

  app.listen(PORT, HOST, () => {
    const addresses = getLocalIPv4Addresses();
    console.log(`IPA Signer running at http://localhost:${PORT}`);

    if (addresses.length > 0) {
      console.log(`Install server (iPhone): http://${addresses[0]}:${PORT}`);
      console.log(`Manifest HTTPS: https://${addresses[0]}:${HTTPS_PORT}`);
    }

    if (!isZsignAvailable()) {
      console.warn("zsign is not installed yet. Run: npm run setup");
    }
  });
}

start().catch((err) => {
  console.error(err.message);
  process.exit(1);
});