export function createResponsiveFeaturesController({ ui, cssClasses, t } = {}) {
  const activeClass = cssClasses && cssClasses.IS_ACTIVE ? cssClasses.IS_ACTIVE : "is-active";
  const translate = typeof t === "function" ? t : (key) => key;
  let initialized = false;

  function syncTopbarHeight() {
    if (!ui || !ui.topbar) return;
    const topbarH = ui.topbar.offsetHeight;
    document.documentElement.style.setProperty("--topbar-height", `${topbarH}px`);
    const quickBar = ui.mobileQuickActions;
    const quickH = quickBar && window.getComputedStyle(quickBar).display !== "none" ? quickBar.offsetHeight : 0;
    document.documentElement.style.setProperty("--topbar-plus-quick", `${topbarH + quickH}px`);
  }

  function openMobileDrawer() {
    if (!ui) return;
    if (ui.mobileDrawer) ui.mobileDrawer.classList.add(activeClass);
    if (ui.mobileDrawerBackdrop) ui.mobileDrawerBackdrop.classList.add(activeClass);
    document.body.style.overflow = "hidden";
    const icon = ui.hamburgerBtn && ui.hamburgerBtn.querySelector("i");
    if (icon) {
      icon.classList.remove("fa-bars");
      icon.classList.add("fa-xmark");
    }
  }

  function closeMobileDrawer() {
    if (!ui) return;
    if (ui.mobileDrawer) ui.mobileDrawer.classList.remove(activeClass);
    if (ui.mobileDrawerBackdrop) ui.mobileDrawerBackdrop.classList.remove(activeClass);
    document.body.style.overflow = "";
    const icon = ui.hamburgerBtn && ui.hamburgerBtn.querySelector("i");
    if (icon) {
      icon.classList.add("fa-bars");
      icon.classList.remove("fa-xmark");
    }
  }

  function setMobileSidebarLabel(key) {
    if (!ui || !ui.mobileSidebarToggle) return;
    const span = ui.mobileSidebarToggle.querySelector("span");
    if (span) span.textContent = translate(key);
  }

  function init({
    getSelectedDate,
    openEventModal,
    handleCopyLink,
    handleShareQr,
    handleLockAction,
    handleFocusToggle,
    openJsonModal,
    handleExportJson,
    handleImportIcsClick,
    openTemplateModal,
    handleClearAll,
    openTzModal,
    setView,
    handleWeekStartToggle,
    handleThemeToggle,
    handleNotificationToggle,
    handleReadOnlyToggle,
    openWorldPlanner,
  } = {}) {
    if (!ui || initialized) return;
    initialized = true;

    const readSelectedDate = typeof getSelectedDate === "function" ? getSelectedDate : () => new Date();

    if (ui.hamburgerBtn) {
      ui.hamburgerBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (ui.mobileDrawer && ui.mobileDrawer.classList.contains(activeClass)) {
          closeMobileDrawer();
        } else {
          openMobileDrawer();
        }
      });
    }

    if (ui.mobileDrawerClose) ui.mobileDrawerClose.addEventListener("click", closeMobileDrawer);
    if (ui.mobileDrawerBackdrop) ui.mobileDrawerBackdrop.addEventListener("click", closeMobileDrawer);

    if (ui.mobileAddEvent && typeof openEventModal === "function") {
      ui.mobileAddEvent.addEventListener("click", () => openEventModal({ date: readSelectedDate() }));
    }
    if (ui.mobileCopyLink && typeof handleCopyLink === "function") {
      ui.mobileCopyLink.addEventListener("click", handleCopyLink);
    }
    if (ui.mobileShareQr && typeof handleShareQr === "function") {
      ui.mobileShareQr.addEventListener("click", handleShareQr);
    }
    if (ui.mobileLockBtn && typeof handleLockAction === "function") {
      ui.mobileLockBtn.addEventListener("click", handleLockAction);
    }
    if (ui.mobileUnlockBtn && typeof handleLockAction === "function") {
      ui.mobileUnlockBtn.addEventListener("click", handleLockAction);
    }
    if (ui.mobileFocusBtn && typeof handleFocusToggle === "function") {
      ui.mobileFocusBtn.addEventListener("click", handleFocusToggle);
    }
    if (ui.mobileAddEventInline && typeof openEventModal === "function") {
      ui.mobileAddEventInline.addEventListener("click", () => {
        closeMobileDrawer();
        openEventModal({ date: readSelectedDate() });
      });
    }
    if (ui.mobileViewJson && typeof openJsonModal === "function") {
      ui.mobileViewJson.addEventListener("click", () => {
        closeMobileDrawer();
        openJsonModal();
      });
    }
    if (ui.mobileExportJson && typeof handleExportJson === "function") {
      ui.mobileExportJson.addEventListener("click", () => {
        closeMobileDrawer();
        handleExportJson();
      });
    }
    if (ui.mobileImportIcs && typeof handleImportIcsClick === "function") {
      ui.mobileImportIcs.addEventListener("click", () => {
        closeMobileDrawer();
        handleImportIcsClick();
      });
    }
    if (ui.mobileTemplateGalleryBtn && typeof openTemplateModal === "function") {
      ui.mobileTemplateGalleryBtn.addEventListener("click", () => {
        closeMobileDrawer();
        openTemplateModal();
      });
    }
    if (ui.mobileClearAll && typeof handleClearAll === "function") {
      ui.mobileClearAll.addEventListener("click", () => {
        closeMobileDrawer();
        handleClearAll();
      });
    }
    if (ui.mobileAddTzBtn && typeof openTzModal === "function") {
      ui.mobileAddTzBtn.addEventListener("click", () => {
        closeMobileDrawer();
        openTzModal();
      });
    }

    if (ui.mobileDrawerViewButtons && ui.mobileDrawerViewButtons.length && typeof setView === "function") {
      ui.mobileDrawerViewButtons.forEach((button) => {
        button.addEventListener("click", () => {
          setView(button.dataset.view);
          closeMobileDrawer();
        });
      });
    }

    if (ui.mobileWeekstartToggle && typeof handleWeekStartToggle === "function") {
      ui.mobileWeekstartToggle.addEventListener("click", handleWeekStartToggle);
    }
    if (ui.mobileThemeToggle && typeof handleThemeToggle === "function") {
      ui.mobileThemeToggle.addEventListener("click", handleThemeToggle);
    }
    if (ui.mobileNotifyToggle && typeof handleNotificationToggle === "function") {
      ui.mobileNotifyToggle.addEventListener("click", handleNotificationToggle);
    }
    if (ui.mobileReadOnlyBtn && typeof handleReadOnlyToggle === "function") {
      ui.mobileReadOnlyBtn.addEventListener("click", () => {
        handleReadOnlyToggle();
        closeMobileDrawer();
      });
    }

    if (ui.mobileWorldPlannerBtn && typeof openWorldPlanner === "function") {
      ui.mobileWorldPlannerBtn.addEventListener("click", () => {
        closeMobileDrawer();
        openWorldPlanner();
      });
    }

    if (ui.mobileSidebarToggle) {
      ui.mobileSidebarToggle.addEventListener("click", () => {
        if (!ui.sidePanel || !ui.tzSidebar) return;
        if (ui.sidePanel.classList.contains(activeClass)) {
          ui.sidePanel.classList.remove(activeClass);
          ui.tzSidebar.classList.add(activeClass);
          setMobileSidebarLabel("label.clock");
        } else if (ui.tzSidebar.classList.contains(activeClass)) {
          ui.tzSidebar.classList.remove(activeClass);
          setMobileSidebarLabel("label.details");
        } else {
          ui.sidePanel.classList.add(activeClass);
          setMobileSidebarLabel("label.events");
        }
      });
    }

    if (ui.sidePanelClose) {
      ui.sidePanelClose.addEventListener("click", () => {
        if (ui.sidePanel) ui.sidePanel.classList.remove(activeClass);
        setMobileSidebarLabel("label.details");
      });
    }

    if (ui.tzSidebarClose) {
      ui.tzSidebarClose.addEventListener("click", () => {
        if (ui.tzSidebar) ui.tzSidebar.classList.remove(activeClass);
        setMobileSidebarLabel("label.details");
      });
    }
  }

  return {
    syncTopbarHeight,
    openMobileDrawer,
    closeMobileDrawer,
    init,
  };
}
