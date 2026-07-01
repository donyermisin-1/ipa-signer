const os = require("os");

function isPreferredLanAddress(address) {
  return (
    address.startsWith("192.168.") ||
    address.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

function getLocalIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }

  return addresses.sort((left, right) => {
    const leftScore = isPreferredLanAddress(left) ? 0 : 1;
    const rightScore = isPreferredLanAddress(right) ? 0 : 1;
    return leftScore - rightScore;
  });
}

function getPrimaryLocalIPv4() {
  const addresses = getLocalIPv4Addresses();
  return addresses[0] ?? "127.0.0.1";
}

module.exports = {
  getLocalIPv4Addresses,
  getPrimaryLocalIPv4,
};
