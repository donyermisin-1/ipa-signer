function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildManifest({ ipaUrl, bundleIdentifier, bundleVersion, title }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>${escapeXml(ipaUrl)}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>${escapeXml(bundleIdentifier)}</string>
        <key>bundle-version</key>
        <string>${escapeXml(bundleVersion)}</string>
        <key>kind</key>
        <string>software</string>
        <key>title</key>
        <string>${escapeXml(title)}</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;
}

function buildItmsServicesUrl(manifestUrl) {
  return `itms-services://?action=download-manifest&url=${encodeURIComponent(manifestUrl)}`;
}

module.exports = {
  buildManifest,
  buildItmsServicesUrl,
};
