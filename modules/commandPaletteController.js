export function createCommandPaletteController({
  ui,
  cssClasses,
  t,
  getCurrentLocale,
  formatTime,
  clamp,
  commandPaletteMaxResults = 18,
  getState,
  msPerMinute,
  getSelectedDate,
  setSelectedDate,
  setViewDate,
  getCurrentView,
  setTimelineNeedsCenter,
  startOfDay,
  render,
  ensureEditable,
  openEventModal,
  setView,
  openTzModal,
  handleFocusToggle,
  handleCopyLink,
  handleShareQr,
  openJsonModal,
  getWorldPlanner,
  getFocusMode,
  isModalOpen,
} = {}) {
  let commandPaletteResults = [];
  let commandPaletteActiveIndex = 0;

  function normalizeSearchText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function close() {
    if (!ui.commandPaletteModal) return;
    ui.commandPaletteModal.classList.add(cssClasses.HIDDEN);
    commandPaletteResults = [];
    commandPaletteActiveIndex = 0;
  }

  function formatRecurrenceLabel(rule) {
    if (rule === "d") return t("recurrence.daily");
    if (rule === "w") return t("recurrence.weekly");
    if (rule === "m") return t("recurrence.monthly");
    if (rule === "y") return t("recurrence.yearly");
    return t("recurrence.none");
  }

  function formatEventMeta(item) {
    const dateLabel = item.startDate.toLocaleDateString(getCurrentLocale(), {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const details = [dateLabel];
    if (item.isAllDay) {
      details.push(t("calendar.allDay"));
    } else {
      details.push(formatTime(item.startDate));
    }
    details.push(formatRecurrenceLabel(item.rule));
    return details.join(" - ");
  }

  function buildEventSearchEntries(query) {
    const nowMs = Date.now();
    const normalizedQuery = normalizeSearchText(query);
    const state = typeof getState === "function" ? getState() : null;
    const events = state && Array.isArray(state.e) ? state.e : [];

    return events
      .map((entry, index) => {
        if (!Array.isArray(entry)) return null;
        const startMin = Number(entry[0]);
        if (!Number.isFinite(startMin)) return null;
        const startMs = startMin * msPerMinute;
        const title = String(entry[2] || "Untitled");
        return {
          id: `event-${index}`,
          index,
          title,
          titleNormalized: title.toLowerCase(),
          startMs,
          startDate: new Date(startMs),
          isAllDay: Number(entry[1]) === 0,
          rule: entry[4] || "",
        };
      })
      .filter(Boolean)
      .filter((item) => !normalizedQuery || item.titleNormalized.includes(normalizedQuery))
      .sort((a, b) => {
        const aPast = a.startMs < nowMs;
        const bPast = b.startMs < nowMs;
        if (aPast !== bPast) return aPast ? 1 : -1;
        return a.startMs - b.startMs;
      });
  }

  function focusEventFromSearchEntry(entry) {
    if (!entry) return;
    const nextDate = startOfDay(entry.startDate);
    if (typeof setSelectedDate === "function") setSelectedDate(nextDate);
    if (typeof setViewDate === "function") setViewDate(nextDate);
    if (typeof getCurrentView === "function" && getCurrentView() === "timeline") {
      if (typeof setTimelineNeedsCenter === "function") setTimelineNeedsCenter(true);
    }
    if (typeof render === "function") render();
    if (typeof ensureEditable === "function" && ensureEditable({ silent: true })) {
      if (typeof openEventModal === "function") openEventModal({ index: entry.index });
    }
  }

  function buildCommandPaletteCommands() {
    const focusMode = typeof getFocusMode === "function" ? getFocusMode() : null;
    const focusActionLabel = focusMode && focusMode.isActive() ? t("command.actionExitFocus") : t("command.actionEnterFocus");
    const selectedDate = typeof getSelectedDate === "function" ? getSelectedDate() : new Date();

    return [
      {
        id: "add-event",
        type: "command",
        title: t("command.actionAddEvent"),
        meta: t("command.groupActions"),
        keywords: "new create add event",
        run: () => {
          close();
          if (typeof openEventModal === "function") openEventModal({ date: selectedDate });
        },
      },
      {
        id: "view-day",
        type: "command",
        title: t("command.actionViewDay"),
        meta: t("command.groupViews"),
        keywords: "view day",
        run: () => {
          close();
          if (typeof setView === "function") setView("day");
        },
      },
      {
        id: "view-week",
        type: "command",
        title: t("command.actionViewWeek"),
        meta: t("command.groupViews"),
        keywords: "view week",
        run: () => {
          close();
          if (typeof setView === "function") setView("week");
        },
      },
      {
        id: "view-month",
        type: "command",
        title: t("command.actionViewMonth"),
        meta: t("command.groupViews"),
        keywords: "view month",
        run: () => {
          close();
          if (typeof setView === "function") setView("month");
        },
      },
      {
        id: "view-year",
        type: "command",
        title: t("command.actionViewYear"),
        meta: t("command.groupViews"),
        keywords: "view year",
        run: () => {
          close();
          if (typeof setView === "function") setView("year");
        },
      },
      {
        id: "view-agenda",
        type: "command",
        title: t("command.actionViewAgenda"),
        meta: t("command.groupViews"),
        keywords: "view agenda",
        run: () => {
          close();
          if (typeof setView === "function") setView("agenda");
        },
      },
      {
        id: "view-timeline",
        type: "command",
        title: t("command.actionViewTimeline"),
        meta: t("command.groupViews"),
        keywords: "view timeline",
        run: () => {
          close();
          if (typeof setView === "function") setView("timeline");
        },
      },
      {
        id: "open-world-planner",
        type: "command",
        title: t("command.actionWorldPlanner"),
        meta: t("command.groupTools"),
        keywords: "world planner timezone compare",
        run: () => {
          close();
          const worldPlanner = typeof getWorldPlanner === "function" ? getWorldPlanner() : null;
          if (worldPlanner) worldPlanner.open();
        },
      },
      {
        id: "open-timezone",
        type: "command",
        title: t("command.actionTimezone"),
        meta: t("command.groupTools"),
        keywords: "timezone clock add",
        run: () => {
          close();
          if (typeof openTzModal === "function") openTzModal();
        },
      },
      {
        id: "focus-mode",
        type: "command",
        title: focusActionLabel,
        meta: t("command.groupTools"),
        keywords: "focus timer",
        run: () => {
          close();
          if (typeof handleFocusToggle === "function") handleFocusToggle();
        },
      },
      {
        id: "copy-link",
        type: "command",
        title: t("command.actionCopyLink"),
        meta: t("command.groupActions"),
        keywords: "copy link share",
        run: () => {
          close();
          if (typeof handleCopyLink === "function") {
            void handleCopyLink();
          }
        },
      },
      {
        id: "share-qr",
        type: "command",
        title: t("command.actionShareQr"),
        meta: t("command.groupActions"),
        keywords: "qr share mobile",
        run: () => {
          close();
          if (typeof handleShareQr === "function") handleShareQr();
        },
      },
      {
        id: "open-json",
        type: "command",
        title: t("command.actionOpenJson"),
        meta: t("command.groupTools"),
        keywords: "json hash export",
        run: () => {
          close();
          if (typeof openJsonModal === "function") openJsonModal();
        },
      },
    ];
  }

  function buildCommandPaletteEventResults(query) {
    const normalizedQuery = normalizeSearchText(query);
    const events = buildEventSearchEntries(normalizedQuery);
    const limit = normalizedQuery ? commandPaletteMaxResults : 7;
    return events.slice(0, limit).map((item) => ({
      id: `event-${item.index}`,
      type: "event",
      title: item.title,
      meta: formatEventMeta(item),
      run: () => {
        close();
        focusEventFromSearchEntry(item);
      },
    }));
  }

  function buildCommandPaletteResults(query) {
    const normalizedQuery = normalizeSearchText(query);
    const commands = buildCommandPaletteCommands().filter((command) => {
      if (!normalizedQuery) return true;
      const haystack = `${command.title} ${command.keywords || ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
    const events = buildCommandPaletteEventResults(normalizedQuery);
    const combined = [...commands, ...events];
    return combined.slice(0, commandPaletteMaxResults);
  }

  function updateCommandPaletteActiveState() {
    if (!ui.commandPaletteResults) return;
    const buttons = ui.commandPaletteResults.querySelectorAll(".command-palette-item");
    buttons.forEach((button, index) => {
      const isActive = index === commandPaletteActiveIndex;
      button.classList.toggle(cssClasses.ACTIVE, isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    const activeButton = buttons[commandPaletteActiveIndex];
    if (activeButton) activeButton.scrollIntoView({ block: "nearest" });
  }

  function setCommandPaletteActiveIndex(nextIndex) {
    if (!commandPaletteResults.length) return;
    const max = commandPaletteResults.length - 1;
    commandPaletteActiveIndex = clamp(nextIndex, 0, max);
    updateCommandPaletteActiveState();
  }

  function runCommandPaletteResult(index) {
    const result = commandPaletteResults[index];
    if (!result || typeof result.run !== "function") return;
    result.run();
  }

  function renderResults() {
    if (!ui.commandPaletteResults || !ui.commandPaletteInput) return;
    commandPaletteResults = buildCommandPaletteResults(ui.commandPaletteInput.value || "");
    if (!commandPaletteResults.length) {
      commandPaletteActiveIndex = 0;
    } else {
      commandPaletteActiveIndex = clamp(commandPaletteActiveIndex, 0, commandPaletteResults.length - 1);
    }

    ui.commandPaletteResults.innerHTML = "";
    commandPaletteResults.forEach((result, index) => {
      const item = document.createElement("li");
      item.className = "command-palette-row";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "command-palette-item";
      button.dataset.index = String(index);
      button.setAttribute("role", "option");
      button.classList.toggle(cssClasses.ACTIVE, index === commandPaletteActiveIndex);
      button.setAttribute("aria-selected", index === commandPaletteActiveIndex ? "true" : "false");

      const title = document.createElement("span");
      title.className = "command-palette-item-title";
      title.textContent = result.title;

      const meta = document.createElement("span");
      meta.className = "command-palette-item-meta";
      meta.textContent = result.meta;

      button.appendChild(title);
      button.appendChild(meta);
      item.appendChild(button);
      ui.commandPaletteResults.appendChild(item);
    });

    if (ui.commandPaletteEmpty) {
      ui.commandPaletteEmpty.classList.toggle(cssClasses.HIDDEN, commandPaletteResults.length > 0);
    }
  }

  function open({ query = "" } = {}) {
    if (!ui.commandPaletteModal || !ui.commandPaletteInput) return;
    ui.commandPaletteModal.classList.remove(cssClasses.HIDDEN);
    commandPaletteActiveIndex = 0;
    ui.commandPaletteInput.value = String(query || "");
    renderResults();
    ui.commandPaletteInput.focus();
    ui.commandPaletteInput.select();
  }

  function toggle() {
    if (isModalOpen(ui.commandPaletteModal)) {
      close();
    } else {
      open();
    }
  }

  function handleInput() {
    commandPaletteActiveIndex = 0;
    renderResults();
  }

  function handleInputKeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!commandPaletteResults.length) return;
      setCommandPaletteActiveIndex(commandPaletteActiveIndex + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!commandPaletteResults.length) return;
      setCommandPaletteActiveIndex(commandPaletteActiveIndex - 1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (!commandPaletteResults.length) return;
      runCommandPaletteResult(commandPaletteActiveIndex);
    }
  }

  function handleResultsClick(event) {
    const button = event.target.closest(".command-palette-item");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (!Number.isFinite(index)) return;
    commandPaletteActiveIndex = index;
    runCommandPaletteResult(index);
  }

  function handleResultsHover(event) {
    const button = event.target.closest(".command-palette-item");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (!Number.isFinite(index)) return;
    commandPaletteActiveIndex = index;
    updateCommandPaletteActiveState();
  }

  function bindEvents() {
    if (ui.commandPaletteBtn) ui.commandPaletteBtn.addEventListener("click", toggle);
    if (ui.commandPaletteClose) ui.commandPaletteClose.addEventListener("click", close);
    if (ui.commandPaletteInput) {
      ui.commandPaletteInput.addEventListener("input", handleInput);
      ui.commandPaletteInput.addEventListener("keydown", handleInputKeydown);
    }
    if (ui.commandPaletteResults) {
      ui.commandPaletteResults.addEventListener("click", handleResultsClick);
      ui.commandPaletteResults.addEventListener("mousemove", handleResultsHover);
    }
    if (ui.commandPaletteModal) {
      ui.commandPaletteModal.addEventListener("click", (event) => {
        if (event.target === ui.commandPaletteModal || event.target.classList.contains("modal-backdrop")) {
          close();
        }
      });
    }
  }

  function isOpen() {
    return isModalOpen(ui.commandPaletteModal);
  }

  return {
    formatEventMeta,
    buildEventSearchEntries,
    focusEventFromSearchEntry,
    renderResults,
    open,
    close,
    toggle,
    handleInput,
    handleInputKeydown,
    handleResultsClick,
    handleResultsHover,
    bindEvents,
    isOpen,
  };
}
