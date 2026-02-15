export function createPasswordModalController({ ui, hiddenClass, t }) {
  const safeHiddenClass = hiddenClass || "hidden";
  let passwordMode = "unlock";
  let passwordResolver = null;

  function open({ mode, title, description, submitLabel }) {
    if (!ui || !ui.passwordModal) return Promise.resolve(null);

    if (passwordResolver) {
      passwordResolver(null);
      passwordResolver = null;
    }

    passwordMode = mode;
    if (ui.passwordTitle) ui.passwordTitle.textContent = title;
    if (ui.passwordDesc) ui.passwordDesc.textContent = description;
    if (ui.passwordInput) ui.passwordInput.value = "";
    if (ui.passwordConfirm) ui.passwordConfirm.value = "";
    if (ui.passwordError) ui.passwordError.classList.add(safeHiddenClass);

    if (ui.passwordConfirmField) {
      if (mode === "set") {
        ui.passwordConfirmField.classList.remove(safeHiddenClass);
      } else {
        ui.passwordConfirmField.classList.add(safeHiddenClass);
      }
    }

    if (ui.passwordSubmit) ui.passwordSubmit.textContent = submitLabel;
    ui.passwordModal.classList.remove(safeHiddenClass);

    return new Promise((resolve) => {
      passwordResolver = resolve;
    });
  }

  function close() {
    if (!ui || !ui.passwordModal) return;
    ui.passwordModal.classList.add(safeHiddenClass);
    if (passwordResolver) {
      passwordResolver(null);
      passwordResolver = null;
    }
  }

  function submit() {
    if (!passwordResolver) return;

    const value = ui && ui.passwordInput ? ui.passwordInput.value.trim() : "";
    if (!value) {
      if (ui && ui.passwordError) {
        ui.passwordError.textContent = t("password.required");
        ui.passwordError.classList.remove(safeHiddenClass);
      }
      return;
    }

    if (passwordMode === "set") {
      const confirmValue = ui && ui.passwordConfirm ? ui.passwordConfirm.value.trim() : "";
      if (value !== confirmValue) {
        if (ui && ui.passwordError) {
          ui.passwordError.textContent = t("password.mismatch");
          ui.passwordError.classList.remove(safeHiddenClass);
        }
        return;
      }
    }

    if (ui && ui.passwordModal) {
      ui.passwordModal.classList.add(safeHiddenClass);
    }
    passwordResolver(value);
    passwordResolver = null;
  }

  return { open, close, submit };
}

export function createJsonModalController({ ui, hiddenClass, t, showToast, getState, getHash } = {}) {
  const safeHiddenClass = hiddenClass || "hidden";

  function isOpen() {
    return !!(ui && ui.jsonModal && !ui.jsonModal.classList.contains(safeHiddenClass));
  }

  function update() {
    if (!ui) return;
    if (ui.jsonOutput && typeof getState === "function") {
      ui.jsonOutput.value = JSON.stringify(getState(), null, 2);
    }
    if (ui.jsonHash && typeof getHash === "function") {
      ui.jsonHash.value = getHash();
    }
  }

  function open() {
    if (!ui || !ui.jsonModal) return;
    update();
    ui.jsonModal.classList.remove(safeHiddenClass);
  }

  function close() {
    if (!ui || !ui.jsonModal) return;
    ui.jsonModal.classList.add(safeHiddenClass);
  }

  async function copyJson() {
    if (!ui || !ui.jsonOutput) return;
    try {
      await navigator.clipboard.writeText(ui.jsonOutput.value);
      if (typeof showToast === "function") showToast(t("toast.jsonCopied"), "success");
    } catch (error) {
      if (typeof showToast === "function") showToast(t("toast.unableToCopyJson"), "error");
    }
  }

  async function copyHash() {
    if (!ui || !ui.jsonHash) return;
    try {
      await navigator.clipboard.writeText(ui.jsonHash.value);
      if (typeof showToast === "function") showToast(t("toast.hashCopied"), "success");
    } catch (error) {
      if (typeof showToast === "function") showToast(t("toast.unableToCopyHash"), "error");
    }
  }

  return { isOpen, update, open, close, copyJson, copyHash };
}
