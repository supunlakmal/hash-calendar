import { t } from "./i18n.js";

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
        showToast(t("toast.qrLibraryFailed"), "error");
      } else {
        window.alert(t("toast.qrLibraryFailed"));
      }
      return;
    }

    if (url.length > maxLength) {
      showWarning(t("qr.warning", { length: url.length }));
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
        showToast(t("toast.qrError"), "error");
      } else {
        window.alert(t("toast.qrError"));
      }
    }
  }

  if (closeBtn) closeBtn.addEventListener("click", hide);
  if (backdrop) backdrop.addEventListener("click", hide);
  if (copyBtn && typeof onCopyLink === "function") copyBtn.addEventListener("click", onCopyLink);

  return { show, hide };
}
