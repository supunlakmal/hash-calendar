import { StateSaveManager } from "./stateSaveManager.js";

export function createPersistenceController({
  ui,
  t,
  urlLengthWarningThreshold,
  getLockState,
  hasStoredData,
  clearHash,
  writeStateToHash,
  getState,
  getPassword,
  onAfterPersist = null,
  debounceMs = 500,
} = {}) {
  function updateUrlLength() {
    const length = window.location.hash.length;
    if (ui.urlLength) ui.urlLength.textContent = String(length);
    if (ui.mobileUrlLength) ui.mobileUrlLength.textContent = String(length);
    const warning = length > urlLengthWarningThreshold ? t("panel.urlWarning") : "";
    if (ui.urlWarning) ui.urlWarning.textContent = warning;
    if (ui.mobileUrlWarning) ui.mobileUrlWarning.textContent = warning;
  }

  const saveManager = new StateSaveManager({
    getLockState,
    hasStoredData,
    clearHash,
    writeStateToHash,
    getState,
    getPassword,
    updateUrlLength,
    onAfterPersist,
    debounceMs,
  });

  async function persistStateToHash() {
    await saveManager.persistStateToHash();
  }

  function scheduleSave() {
    saveManager.scheduleSave();
  }

  function clearPendingSave() {
    saveManager.clearPendingSave();
  }

  return {
    persistStateToHash,
    scheduleSave,
    clearPendingSave,
    updateUrlLength,
  };
}
