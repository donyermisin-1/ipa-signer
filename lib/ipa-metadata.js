const AdmZip = require("adm-zip");
const bplist = require("bplist-parser");
const plist = require("plist");

function parsePlistBuffer(buffer) {
  if (buffer.slice(0, 6).toString("ascii") === "bplist") {
    const parsed = bplist.parseBuffer(buffer);
    return parsed[0] ?? {};
  }

  return plist.parse(buffer.toString("utf8"));
}

function readInfoPlistFromIpa(ipaPath) {
  const zip = new AdmZip(ipaPath);
  const entry = zip
    .getEntries()
    .find((item) => item.entryName.match(/^Payload\/[^/]+\.app\/Info\.plist$/));

  if (!entry) {
    throw new Error("Could not find Info.plist inside the IPA.");
  }

  const info = parsePlistBuffer(entry.getData());

  return {
    bundleIdentifier: info.CFBundleIdentifier || "com.ipasigner.app",
    bundleVersion: String(info.CFBundleVersion || info.CFBundleShortVersionString || "1.0"),
    title: info.CFBundleDisplayName || info.CFBundleName || "Signed App",
  };
}

module.exports = {
  readInfoPlistFromIpa,
};
