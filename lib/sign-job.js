const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const { signIpa } = require("./signer");
const { removePath } = require("./cleanup");

async function runSignJob({ ipaFile, p12File, provFile, password, tmpDir }) {
  const workDir = path.join(tmpDir, randomUUID());
  const uploadedPaths = [ipaFile.path, p12File.path, provFile.path];

  fs.mkdirSync(workDir, { recursive: true });

  const outputName = path.basename(ipaFile.originalname, ".ipa") + "-signed.ipa";
  const outputPath = path.join(workDir, outputName);

  try {
    await signIpa({
      ipaPath: ipaFile.path,
      p12Path: p12File.path,
      password,
      provPath: provFile.path,
      outputPath,
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error("Signing finished but output file was not created.");
    }

    return {
      outputPath,
      outputName,
      workDir,
      uploadedPaths,
    };
  } catch (error) {
    await removePath(workDir);
    await Promise.all(uploadedPaths.map((entry) => removePath(entry)));
    throw error;
  }
}

async function cleanupSignJob({ workDir, uploadedPaths, keepOutput = false, outputPath }) {
  if (!keepOutput) {
    await removePath(outputPath);
    await removePath(workDir);
  }

  await Promise.all(uploadedPaths.map((entry) => removePath(entry)));
}

module.exports = {
  runSignJob,
  cleanupSignJob,
};
