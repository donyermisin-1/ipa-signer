const fs = require("fs/promises");

async function removePath(targetPath) {
  if (!targetPath) {
    return;
  }

  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup for temp signing artifacts.
  }
}

async function removePaths(paths) {
  await Promise.all(paths.map((entry) => removePath(entry)));
}

module.exports = {
  removePath,
  removePaths,
};
