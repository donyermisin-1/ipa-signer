const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const https = require("https");

const VERSION = "v1.0.4";
const ROOT = path.join(__dirname, "..");
const BIN_DIR = path.join(ROOT, "bin");

const ASSETS = {
  win32: {
    url: `https://github.com/zhlynn/zsign/releases/download/${VERSION}/zsign-windows-x64.zip`,
    archive: "zsign-windows-x64.zip",
    binary: "zsign.exe",
  },
  darwin: {
    url: `https://github.com/zhlynn/zsign/releases/download/${VERSION}/zsign-macos-arm64.tar.gz`,
    archive: "zsign-macos-arm64.tar.gz",
    binary: "zsign",
  },
  linux: {
    url: `https://github.com/zhlynn/zsign/releases/download/${VERSION}/zsign-linux-x86_64.tar.gz`,
    archive: "zsign-linux-x86_64.tar.gz",
    binary: "zsign",
  },
};

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);

    const request = (currentUrl) => {
      https
        .get(currentUrl, (response) => {
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            request(response.headers.location);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed (${response.statusCode}) for ${currentUrl}`));
            return;
          }

          response.pipe(file);
          file.on("finish", () => {
            file.close(resolve);
          });
        })
        .on("error", reject);
    };

    request(url);
  });
}

async function main() {
  const asset = ASSETS[process.platform];
  if (!asset) {
    console.error(`Unsupported platform: ${process.platform}`);
    process.exit(1);
  }

  fs.mkdirSync(BIN_DIR, { recursive: true });

  const targetBinary = path.join(BIN_DIR, asset.binary);
  if (fs.existsSync(targetBinary)) {
    console.log(`zsign already installed at ${targetBinary}`);
    return;
  }

  const archivePath = path.join(BIN_DIR, asset.archive);
  console.log(`Downloading zsign ${VERSION} for ${process.platform}...`);
  await download(asset.url, archivePath);

  if (process.platform === "win32") {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Path '${archivePath}' -DestinationPath '${BIN_DIR}' -Force`,
      ],
      { stdio: "inherit" }
    );
  } else {
    execFileSync("tar", ["-xzf", archivePath, "-C", BIN_DIR], { stdio: "inherit" });
    fs.chmodSync(targetBinary, 0o755);
  }

  fs.unlinkSync(archivePath);

  if (!fs.existsSync(targetBinary)) {
    throw new Error(`Expected binary missing after extract: ${targetBinary}`);
  }

  console.log(`Installed zsign to ${targetBinary}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
