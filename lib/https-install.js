const https = require("https");
const selfsigned = require("selfsigned");
const { getLocalIPv4Addresses } = require("./network");

function buildCertificate() {
  const ips = getLocalIPv4Addresses();
  const altNames = [{ type: 2, value: "localhost" }];

  for (const ip of ips) {
    altNames.push({ type: 7, ip });
  }

  const pems = selfsigned.generate([{ name: "commonName", value: "ipa-signer.local" }], {
    days: 365,
    keySize: 2048,
    algorithm: "sha256",
    extensions: [
      {
        name: "subjectAltName",
        altNames,
      },
    ],
  });

  return {
    key: pems.private,
    cert: pems.cert,
  };
}

function createHttpsInstallServer(app, port) {
  const credentials = buildCertificate();
  const server = https.createServer(credentials, app);

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "0.0.0.0", () => {
      resolve(server);
    });
  });
}

module.exports = {
  createHttpsInstallServer,
};
