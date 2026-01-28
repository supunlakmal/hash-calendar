const MAX_QR_URL_LENGTH = 2000;
const DEFAULT_QR_SIZE = 256;

export function initQRCodeManager({
  onBeforeOpen = null,
  onCopyLink = null,
  showToast = null,
  maxLength = MAX_QR_URL_LENGTH,
  size = DEFAULT_QR_SIZE,
} = {}) {
  const modal = document.getElementById("qr-modal");
  const container = document.getElementById("qrcode-container");
  const warning = document.getElementById("qr-warning");
  const closeBtn = document.getElementById("qr-close");
  const copyBtn = document.getElementById("qr-copy-link");
  const backdrop = modal ? modal.querySelector(".modal-backdrop") : null;

  function hide() {
    if (modal) modal.classList.add("hidden");
  }

  function showWarning(message) {
    if (!warning) return;
    warning.textContent = message;
    warning.classList.remove("hidden");
  }

  function clearWarning() {
    if (!warning) return;
    warning.textContent = "";
    warning.classList.add("hidden");
  }

  async function show() {
    if (!modal || !container) return;

    if (typeof onBeforeOpen === "function") {
      await onBeforeOpen();
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    const url = window.location.href;
    container.innerHTML = "";
    clearWarning();

    if (typeof window.QRCode === "undefined") {
      if (typeof showToast === "function") {
        showToast("QR library failed to load", "error");
      } else {
        window.alert("QR library failed to load.");
      }
      return;
    }

    if (url.length > maxLength) {
      showWarning(`Calendar data too long for QR transfer (${url.length} chars). Try deleting old events.`);
      modal.classList.remove("hidden");
      return;
    }

    try {
      new window.QRCode(container, {
        text: url,
        width: size,
        height: size,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.L,
      });
      modal.classList.remove("hidden");
    } catch (error) {
      console.error("QR generation error", error);
      if (typeof showToast === "function") {
        showToast("Error creating QR code", "error");
      } else {
        window.alert("Error creating QR code.");
      }
    }
  }

  if (closeBtn) closeBtn.addEventListener("click", hide);
  if (backdrop) backdrop.addEventListener("click", hide);
  if (copyBtn && typeof onCopyLink === "function") copyBtn.addEventListener("click", onCopyLink);

  return { show, hide };
}
