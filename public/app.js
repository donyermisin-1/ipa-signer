const form = document.getElementById("sign-form");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit-btn");
const toolStatusEl = document.getElementById("tool-status");
const networkStatusEl = document.getElementById("network-status");
const installPanel = document.getElementById("install-panel");
const installIntro = document.getElementById("install-intro");
const installQr = document.getElementById("install-qr");
const installLink = document.getElementById("install-link");
const installSteps = document.getElementById("install-steps");

function setStatus(message, type = "info") {
  statusEl.hidden = false;
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
}

function clearStatus() {
  statusEl.hidden = true;
  statusEl.textContent = "";
}

function hideInstallPanel() {
  installPanel.hidden = true;
  installIntro.textContent = "";
  installQr.removeAttribute("src");
  installLink.textContent = "";
  installLink.href = "#";
  installSteps.replaceChildren();
}

function showInstallPanel(payload) {
  installPanel.hidden = false;
  installIntro.textContent = `${payload.appName} is ready. Use your iPhone on the same Wi-Fi network to start the install.`;
  installQr.src = payload.qrDataUrl;
  installLink.href = payload.installPageUrl;
  installLink.textContent = payload.installPageUrl;

  installSteps.replaceChildren();
  for (const step of payload.instructions) {
    const item = document.createElement("li");
    item.textContent = step;
    installSteps.appendChild(item);
  }
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();

    if (data.zsignAvailable) {
      toolStatusEl.textContent = "Signing engine ready (zsign).";
    } else {
      toolStatusEl.textContent =
        "zsign is not installed. Run npm run setup in the project folder before signing.";
      setStatus(
        "The signing engine is missing. Run npm run setup, then restart the server.",
        "error"
      );
    }

    const addresses = data.installServer?.localAddresses ?? [];
    if (addresses.length > 0) {
      networkStatusEl.textContent = `Install server reachable on this network at http://${addresses[0]}:${data.installServer.httpPort}`;
    } else {
      networkStatusEl.textContent =
        "No Wi-Fi address detected. iPhone install requires your PC and phone on the same network.";
    }
  } catch {
    toolStatusEl.textContent = "Could not reach the signing server.";
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus();
  hideInstallPanel();

  const formData = new FormData(form);
  const mode = formData.get("mode");
  formData.delete("mode");

  if (mode === "install") {
    formData.set("install", "true");
  }

  submitBtn.disabled = true;
  setStatus(
    mode === "install"
      ? "Signing and preparing the install server..."
      : "Signing in progress. Large IPAs can take a minute...",
    "info"
  );

  try {
    const response = await fetch("/api/sign", {
      method: "POST",
      body: formData,
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      const payload = contentType.includes("application/json")
        ? await response.json()
        : { error: "Signing failed." };
      throw new Error(payload.error || "Signing failed.");
    }

    if (contentType.includes("application/json")) {
      const payload = await response.json();
      showInstallPanel(payload);
      setStatus(`${payload.appName} signed. Open the install link on your iPhone in Safari.`, "success");
      return;
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/i);
    const filename = match?.[1] || "signed.ipa";

    downloadBlob(blob, filename);
    setStatus(`Done. Downloaded ${filename}.`, "success");
  } catch (error) {
    setStatus(error.message || "Signing failed.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

checkHealth();
