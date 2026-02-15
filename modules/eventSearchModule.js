export function createEventSearchController({
  ui,
  hiddenClass = "hidden",
  activeClass = "active",
  maxResults = 30,
  buildEntries = () => [],
  formatMeta = () => "",
  onSelectEntry = null,
  getFilterQuery = () => "",
  hasAdvancedFilters = () => false,
  setFilterQuery = null,
  onQueryChange = null,
} = {}) {
  let results = [];
  let activeIndex = 0;
  let advancedOpen = false;

  function isOpen() {
    return !!(ui && ui.eventSearchModal && !ui.eventSearchModal.classList.contains(hiddenClass));
  }

  function updateActiveState() {
    if (!ui || !ui.eventSearchResults) return;
    const buttons = ui.eventSearchResults.querySelectorAll(".command-palette-item");
    buttons.forEach((button, index) => {
      const isActive = index === activeIndex;
      button.classList.toggle(activeClass, isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    const activeButton = buttons[activeIndex];
    if (activeButton) activeButton.scrollIntoView({ block: "nearest" });
  }

  function setActiveIndex(nextIndex) {
    if (!results.length) return;
    const max = results.length - 1;
    activeIndex = Math.max(0, Math.min(max, nextIndex));
    updateActiveState();
  }

  function runResult(index) {
    const result = results[index];
    if (!result) return;
    closeModal();
    if (typeof onSelectEntry === "function") onSelectEntry(result);
  }

  function renderResults() {
    if (!ui || !ui.eventSearchResults || !ui.eventSearchInput) return;
    results = buildEntries(ui.eventSearchInput.value || "").slice(0, maxResults);
    if (!results.length) {
      activeIndex = 0;
    } else {
      activeIndex = Math.max(0, Math.min(results.length - 1, activeIndex));
    }

    ui.eventSearchResults.innerHTML = "";
    results.forEach((result, index) => {
      const item = document.createElement("li");
      item.className = "command-palette-row";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "command-palette-item";
      button.dataset.index = String(index);
      button.setAttribute("role", "option");
      button.classList.toggle(activeClass, index === activeIndex);
      button.setAttribute("aria-selected", index === activeIndex ? "true" : "false");

      const title = document.createElement("span");
      title.className = "command-palette-item-title";
      title.textContent = result.title;

      const meta = document.createElement("span");
      meta.className = "command-palette-item-meta";
      meta.textContent = formatMeta(result);

      button.appendChild(title);
      button.appendChild(meta);
      item.appendChild(button);
      ui.eventSearchResults.appendChild(item);
    });

    if (ui.eventSearchEmpty) {
      ui.eventSearchEmpty.classList.toggle(hiddenClass, results.length > 0);
    }
  }

  function setAdvancedOpen(nextOpen) {
    const isOpen = !!nextOpen;
    advancedOpen = isOpen;

    if (ui && ui.eventSearchAdvancedPanel) {
      ui.eventSearchAdvancedPanel.classList.toggle(hiddenClass, !isOpen);
      ui.eventSearchAdvancedPanel.hidden = !isOpen;
    }
    if (ui && ui.eventSearchAdvancedToggle) {
      ui.eventSearchAdvancedToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }
  }

  function toggleAdvancedOpen() {
    setAdvancedOpen(!advancedOpen);
  }

  function openModal({ query = "" } = {}) {
    if (!ui || !ui.eventSearchModal || !ui.eventSearchInput) return;
    ui.eventSearchModal.classList.remove(hiddenClass);
    activeIndex = 0;

    const nextQuery = String(query || getFilterQuery() || "");
    ui.eventSearchInput.value = nextQuery;
    if (typeof setFilterQuery === "function") setFilterQuery(nextQuery);

    setAdvancedOpen(hasAdvancedFilters());
    renderResults();
    ui.eventSearchInput.focus();
    ui.eventSearchInput.select();
  }

  function closeModal() {
    if (!ui || !ui.eventSearchModal) return;
    ui.eventSearchModal.classList.add(hiddenClass);
    results = [];
    activeIndex = 0;
    setAdvancedOpen(false);
  }

  function syncInputFromQuery() {
    if (!ui || !ui.eventSearchInput || !isOpen()) return;
    if (document.activeElement === ui.eventSearchInput) return;
    ui.eventSearchInput.value = String(getFilterQuery() || "");
  }

  function handleInput() {
    if (!ui || !ui.eventSearchInput) return;
    if (typeof setFilterQuery === "function") setFilterQuery(ui.eventSearchInput.value);
    activeIndex = 0;
    if (typeof onQueryChange === "function") onQueryChange();
    renderResults();
  }

  function handleInputKeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!results.length) return;
      setActiveIndex(activeIndex + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      setActiveIndex(activeIndex - 1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (!results.length) return;
      runResult(activeIndex);
    }
  }

  function handleResultsClick(event) {
    const button = event.target.closest(".command-palette-item");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (!Number.isFinite(index)) return;
    activeIndex = index;
    runResult(index);
  }

  function handleResultsHover(event) {
    const button = event.target.closest(".command-palette-item");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (!Number.isFinite(index)) return;
    activeIndex = index;
    updateActiveState();
  }

  function handleBackdropClick(event) {
    if (!ui || !ui.eventSearchModal) return;
    if (event.target === ui.eventSearchModal || event.target.classList.contains("modal-backdrop")) {
      closeModal();
    }
  }

  function bindEvents() {
    if (!ui) return;
    if (ui.eventSearchBtn) ui.eventSearchBtn.addEventListener("click", () => openModal());
    if (ui.eventSearchClose) ui.eventSearchClose.addEventListener("click", closeModal);
    if (ui.eventSearchAdvancedToggle) ui.eventSearchAdvancedToggle.addEventListener("click", toggleAdvancedOpen);
    if (ui.eventSearchInput) {
      ui.eventSearchInput.addEventListener("input", handleInput);
      ui.eventSearchInput.addEventListener("keydown", handleInputKeydown);
    }
    if (ui.eventSearchResults) {
      ui.eventSearchResults.addEventListener("click", handleResultsClick);
      ui.eventSearchResults.addEventListener("mousemove", handleResultsHover);
    }
    if (ui.eventSearchModal) {
      ui.eventSearchModal.addEventListener("click", handleBackdropClick);
    }
  }

  function handleEscape() {
    if (!isOpen()) return false;
    closeModal();
    return true;
  }

  return {
    bindEvents,
    closeModal,
    handleEscape,
    isOpen,
    openModal,
    renderResults,
    syncInputFromQuery,
  };
}
