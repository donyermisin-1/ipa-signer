const express = require("express");
const fs = require("fs");
const path = require("path");

const { buildManifest, buildItmsServicesUrl } = require("./manifest");
const { removePath } = require("./cleanup");

function createInstallRouter({ sessions, getHttpBaseUrl, getHttpsBaseUrl }) {
  const router = express.Router();

  router.get("/:id/manifest.plist", (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).send("Install session expired or not found.");
      return;
    }

    const ipaUrl = `${getHttpBaseUrl(req)}/install/${session.id}/app.ipa`;
    const manifest = buildManifest({
      ipaUrl,
      bundleIdentifier: session.bundleIdentifier,
      bundleVersion: session.bundleVersion,
      title: session.title,
    });

    res.setHeader("Content-Type", "application/xml");
    res.send(manifest);
  });

  router.get("/:id/app.ipa", (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session || !fs.existsSync(session.ipaPath)) {
      res.status(404).send("Install session expired or IPA missing.");
      return;
    }

    res.setHeader("Content-Type", "application/octet-stream");
    res.download(session.ipaPath, session.fileName);
  });

  router.get("/:id", (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).send("Install session expired or not found.");
      return;
    }

    const manifestUrl = `${getHttpsBaseUrl(req)}/install/${session.id}/manifest.plist`;
    const itmsUrl = buildItmsServicesUrl(manifestUrl);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <title>Install ${escapeHtml(session.title)}</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0b1020;
        color: #edf2ff;
        padding: 1.5rem;
      }
      .card {
        width: min(420px, 100%);
        background: #121933;
        border: 1px solid #243055;
        border-radius: 20px;
        padding: 1.5rem;
        text-align: center;
      }
      h1 {
        margin: 0 0 0.5rem;
        font-size: 1.5rem;
      }
      p {
        color: #9aa7c7;
        line-height: 1.5;
      }
      a.button {
        display: inline-block;
        margin-top: 1rem;
        background: linear-gradient(135deg, #6ea8ff, #4d88ff);
        color: white;
        text-decoration: none;
        font-weight: 700;
        padding: 0.95rem 1.2rem;
        border-radius: 12px;
      }
      .hint {
        margin-top: 1rem;
        font-size: 0.9rem;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${escapeHtml(session.title)}</h1>
      <p>Ready to install on your iPhone. Tap the button below and confirm when iOS asks.</p>
      <a class="button" id="install-btn" href="${escapeHtml(itmsUrl)}">Install App</a>
      <p class="hint">Use Safari on the same Wi-Fi network as your PC. After install, trust the developer in Settings → General → VPN &amp; Device Management.</p>
    </div>
    <script>
      const installUrl = ${JSON.stringify(itmsUrl)};
      const params = new URLSearchParams(window.location.search);
      if (params.get("auto") === "1") {
        window.location.href = installUrl;
      }
    </script>
  </body>
</html>`);
  });

  router.delete("/:id", async (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Install session not found." });
      return;
    }

    sessions.delete(session.id);
    await removePath(session.workDir);

    res.json({ ok: true });
  });

  return router;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = {
  createInstallRouter,
};
