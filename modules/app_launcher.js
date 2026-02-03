/**
 * AppLauncher Module
 * Opens the ecosystem apps page inside a modal iframe.
 */
export class AppLauncher {
  constructor() {
    this.launcherUrl = "https://open-edit.netlify.app/apps.html";
    this.btn = document.getElementById("app-launcher-btn");
    this.modal = document.getElementById("app-launcher-modal");
    this.closeBtn = document.getElementById("app-launcher-close");
    this.backdrop = this.modal ? this.modal.querySelector(".modal-backdrop") : null;
    this.frame = document.getElementById("app-launcher-iframe");
    this.bodyOverflowBeforeOpen = "";

    if (!this.btn || !this.modal || !this.closeBtn || !this.frame) return;

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.btn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (this.modal.classList.contains("hidden")) {
        this.openModal();
      } else {
        this.closeModal();
      }
    });

    this.closeBtn.addEventListener("click", () => this.closeModal());

    if (this.backdrop) {
      this.backdrop.addEventListener("click", () => this.closeModal());
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !this.modal.classList.contains("hidden")) {
        this.closeModal();
      }
    });
  }

  openModal() {
    if (!this.frame.getAttribute("src")) {
      this.frame.setAttribute("src", this.frame.dataset.src || this.launcherUrl);
    }

    this.bodyOverflowBeforeOpen = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";

    this.modal.classList.remove("hidden");
    this.btn.setAttribute("aria-expanded", "true");
  }

  closeModal() {
    this.modal.classList.add("hidden");
    this.btn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = this.bodyOverflowBeforeOpen;
  }
}
