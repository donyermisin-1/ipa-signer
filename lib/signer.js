const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function getZsignPath() {
  const candidates = [
    path.join(__dirname, "..", "bin", process.platform === "win32" ? "zsign.exe" : "zsign"),
    process.platform === "win32" ? "zsign.exe" : "zsign",
  ];

  for (const candidate of candidates) {
    if (candidate.includes(path.sep) && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
}

function isZsignAvailable() {
  const bundled = path.join(
    __dirname,
    "..",
    "bin",
    process.platform === "win32" ? "zsign.exe" : "zsign"
  );
  return fs.existsSync(bundled);
}

function signIpa({ ipaPath, p12Path, password, provPath, outputPath }) {
  return new Promise((resolve, reject) => {
    const zsign = getZsignPath();
    const args = [
      "-k",
      p12Path,
      "-p",
      password,
      "-m",
      provPath,
      "-o",
      outputPath,
      "-f",
      ipaPath,
    ];

    const proc = spawn(zsign, args, {
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "zsign not found. Run npm run setup to download it, or place zsign in the bin/ folder."
          )
        );
        return;
      }
      reject(err);
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const detail = (stderr || stdout || "").trim();
      reject(new Error(detail || `zsign failed with exit code ${code}`));
    });
  });
}

module.exports = {
  getZsignPath,
  isZsignAvailable,
  signIpa,
};
