export class StateSaveManager {
  constructor({
    getLockState,
    hasStoredData,
    clearHash,
    writeStateToHash,
    getState,
    getPassword,
    updateUrlLength,
    onAfterPersist = null,
    debounceMs = 500,
  } = {}) {
    this.getLockState = getLockState;
    this.hasStoredData = hasStoredData;
    this.clearHash = clearHash;
    this.writeStateToHash = writeStateToHash;
    this.getState = getState;
    this.getPassword = getPassword;
    this.updateUrlLength = updateUrlLength;
    this.onAfterPersist = onAfterPersist;
    this.debounceMs = debounceMs;
    this.saveTimer = null;
  }

  isLocked() {
    const lockState = typeof this.getLockState === "function" ? this.getLockState() : null;
    return !!(lockState && lockState.encrypted && !lockState.unlocked);
  }

  async persistStateToHash() {
    if (this.isLocked()) return;

    const hasData = typeof this.hasStoredData === "function" ? this.hasStoredData() : false;
    if (!hasData) {
      if (window.location.hash && typeof this.clearHash === "function") {
        this.clearHash();
      }
      if (typeof this.updateUrlLength === "function") this.updateUrlLength();
      if (typeof this.onAfterPersist === "function") this.onAfterPersist();
      return;
    }

    if (typeof this.writeStateToHash === "function" && typeof this.getState === "function") {
      const state = this.getState();
      const password = typeof this.getPassword === "function" ? this.getPassword() : null;
      await this.writeStateToHash(state, password);
    }

    if (typeof this.updateUrlLength === "function") this.updateUrlLength();
    if (typeof this.onAfterPersist === "function") this.onAfterPersist();
  }

  clearPendingSave() {
    if (!this.saveTimer) return;
    window.clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }

  scheduleSave() {
    if (this.isLocked()) return;

    const hasData = typeof this.hasStoredData === "function" ? this.hasStoredData() : false;
    if (!hasData) {
      this.clearPendingSave();
      this.persistStateToHash();
      return;
    }

    this.clearPendingSave();
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      this.persistStateToHash();
    }, this.debounceMs);
  }
}
