export function createEventFiltersController({
  ui,
  cssClasses,
  t,
  formatDateKey,
  isValidZone,
  getLocalZone,
  getState,
  onFiltersChanged,
  onSyncSearchInput = null,
} = {}) {
  const filters = {
    query: "",
    startDate: "",
    endDate: "",
    recurrence: "",
    colorIndex: "",
    timezone: "",
  };
  const zoneDateFormatters = new Map();

  function normalizeDateInput(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
  }

  function normalizeSearchText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getDateFormatterForZone(zone) {
    const cacheKey = String(zone || "");
    if (zoneDateFormatters.has(cacheKey)) {
      return zoneDateFormatters.get(cacheKey);
    }
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    zoneDateFormatters.set(cacheKey, formatter);
    return formatter;
  }

  function getDateKeyInZone(timestamp, zone) {
    const date = new Date(timestamp);
    if (!zone) return formatDateKey(date);
    try {
      const formatter = getDateFormatterForZone(zone);
      const parts = formatter.formatToParts(date);
      const year = parts.find((part) => part.type === "year")?.value;
      const month = parts.find((part) => part.type === "month")?.value;
      const day = parts.find((part) => part.type === "day")?.value;
      if (year && month && day) {
        return `${year}-${month}-${day}`;
      }
    } catch (_error) {
      // Ignore invalid timezone values and fall back to local date key.
    }
    return formatDateKey(date);
  }

  function getActiveFilters() {
    const query = normalizeSearchText(filters.query);
    const recurrence = ["", "none", "d", "w", "m", "y"].includes(filters.recurrence) ? filters.recurrence : "";
    const startDateRaw = normalizeDateInput(filters.startDate);
    const endDateRaw = normalizeDateInput(filters.endDate);
    let startDate = startDateRaw;
    let endDate = endDateRaw;
    if (startDate && endDate && endDate < startDate) {
      startDate = endDateRaw;
      endDate = startDateRaw;
    }
    const colorValue = String(filters.colorIndex ?? "").trim();
    const parsedColor = colorValue === "" ? Number.NaN : Number(colorValue);
    const colorIndex = Number.isInteger(parsedColor) && parsedColor >= 0 ? parsedColor : null;
    const timezone = filters.timezone && isValidZone(filters.timezone) ? filters.timezone : "";
    return { query, recurrence, startDate, endDate, colorIndex, timezone };
  }

  function hasActiveFilters(activeFilters = getActiveFilters()) {
    return !!(
      activeFilters.query ||
      activeFilters.startDate ||
      activeFilters.endDate ||
      activeFilters.recurrence ||
      Number.isInteger(activeFilters.colorIndex) ||
      activeFilters.timezone
    );
  }

  function hasAdvancedFilters(activeFilters = getActiveFilters()) {
    return !!(
      activeFilters.startDate ||
      activeFilters.endDate ||
      activeFilters.recurrence ||
      Number.isInteger(activeFilters.colorIndex) ||
      activeFilters.timezone
    );
  }

  function matchesOccurrenceFilters(occurrence, activeFilters) {
    if (!occurrence || !Number.isFinite(occurrence.start)) return false;

    if (activeFilters.query && !String(occurrence.title || "").toLowerCase().includes(activeFilters.query)) {
      return false;
    }

    if (activeFilters.recurrence === "none" && occurrence.rule) {
      return false;
    }
    if (activeFilters.recurrence && activeFilters.recurrence !== "none" && occurrence.rule !== activeFilters.recurrence) {
      return false;
    }

    if (Number.isInteger(activeFilters.colorIndex) && Number(occurrence.colorIndex) !== activeFilters.colorIndex) {
      return false;
    }

    if (activeFilters.startDate || activeFilters.endDate) {
      const dateKey = getDateKeyInZone(occurrence.start, activeFilters.timezone);
      if (activeFilters.startDate && dateKey < activeFilters.startDate) return false;
      if (activeFilters.endDate && dateKey > activeFilters.endDate) return false;
    }

    return true;
  }

  function filterOccurrences(occurrences) {
    const activeFilters = getActiveFilters();
    if (!hasActiveFilters(activeFilters)) {
      return Array.isArray(occurrences) ? occurrences.slice() : [];
    }
    return (Array.isArray(occurrences) ? occurrences : []).filter((occurrence) => matchesOccurrenceFilters(occurrence, activeFilters));
  }

  function formatFilterColorOption(index, color) {
    return t("filter.colorOption", {
      index: String(index + 1),
      color,
    });
  }

  function syncFilterColorOptions() {
    if (!ui.filterColor) return;
    const state = typeof getState === "function" ? getState() : null;
    if (!state || !Array.isArray(state.c)) return;

    const previous = String(filters.colorIndex || "");
    ui.filterColor.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = t("filter.anyColor");
    ui.filterColor.appendChild(allOption);

    state.c.forEach((color, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = formatFilterColorOption(index, color);
      ui.filterColor.appendChild(option);
    });

    const canRestore = previous && state.c[Number(previous)];
    ui.filterColor.value = canRestore ? previous : "";
    if (!canRestore) filters.colorIndex = "";
  }

  function buildFilterTimezoneOptions() {
    const options = [];
    const seen = new Set();
    const include = (zone) => {
      if (typeof zone !== "string") return;
      const trimmed = zone.trim();
      if (!trimmed || seen.has(trimmed) || !isValidZone(trimmed)) return;
      seen.add(trimmed);
      options.push(trimmed);
    };

    include(getLocalZone());
    include("UTC");
    const state = typeof getState === "function" ? getState() : null;
    if (state && state.mp && Array.isArray(state.mp.z)) {
      state.mp.z.forEach(include);
    }
    include(filters.timezone);
    return options;
  }

  function syncFilterTimezoneOptions() {
    if (!ui.filterTimezone) return;
    const previous = filters.timezone || "";
    const options = buildFilterTimezoneOptions();
    ui.filterTimezone.innerHTML = "";

    const localOption = document.createElement("option");
    localOption.value = "";
    localOption.textContent = t("filter.localTimezone");
    ui.filterTimezone.appendChild(localOption);

    options.forEach((zone) => {
      const option = document.createElement("option");
      option.value = zone;
      option.textContent = zone;
      ui.filterTimezone.appendChild(option);
    });

    const canRestore = previous && options.includes(previous);
    ui.filterTimezone.value = canRestore ? previous : "";
    if (!canRestore) filters.timezone = "";
  }

  function syncControls() {
    syncFilterColorOptions();
    syncFilterTimezoneOptions();

    if (typeof onSyncSearchInput === "function") {
      onSyncSearchInput();
    }
    if (ui.filterStartDate) ui.filterStartDate.value = normalizeDateInput(filters.startDate);
    if (ui.filterEndDate) ui.filterEndDate.value = normalizeDateInput(filters.endDate);
    if (ui.filterRecurrence) ui.filterRecurrence.value = filters.recurrence || "";

    const hasActiveAdvancedFilters = hasAdvancedFilters();
    if (ui.filterBar) {
      ui.filterBar.classList.toggle(cssClasses.ACTIVE, hasActiveAdvancedFilters);
    }
    if (ui.eventSearchAdvancedToggle) {
      ui.eventSearchAdvancedToggle.classList.toggle(cssClasses.ACTIVE, hasActiveAdvancedFilters);
    }
  }

  function readFromControls() {
    if (ui.filterStartDate) {
      filters.startDate = normalizeDateInput(ui.filterStartDate.value);
    }
    if (ui.filterEndDate) {
      filters.endDate = normalizeDateInput(ui.filterEndDate.value);
    }
    if (ui.filterRecurrence) {
      filters.recurrence = ui.filterRecurrence.value || "";
    }
    if (ui.filterColor) {
      filters.colorIndex = ui.filterColor.value || "";
    }
    if (ui.filterTimezone) {
      filters.timezone = ui.filterTimezone.value || "";
    }

    if (filters.startDate && filters.endDate && filters.endDate < filters.startDate) {
      const nextStart = filters.endDate;
      filters.endDate = filters.startDate;
      filters.startDate = nextStart;
      if (ui.filterStartDate) ui.filterStartDate.value = filters.startDate;
      if (ui.filterEndDate) ui.filterEndDate.value = filters.endDate;
    }
  }

  function handleInput() {
    readFromControls();
    if (typeof onFiltersChanged === "function") {
      onFiltersChanged();
    }
  }

  function clearFilters() {
    filters.query = "";
    filters.startDate = "";
    filters.endDate = "";
    filters.recurrence = "";
    filters.colorIndex = "";
    filters.timezone = "";

    if (ui.eventSearchInput) ui.eventSearchInput.value = "";
    if (ui.filterStartDate) ui.filterStartDate.value = "";
    if (ui.filterEndDate) ui.filterEndDate.value = "";
    if (ui.filterRecurrence) ui.filterRecurrence.value = "";
    if (ui.filterColor) ui.filterColor.value = "";
    if (ui.filterTimezone) ui.filterTimezone.value = "";

    if (typeof onFiltersChanged === "function") {
      onFiltersChanged();
    }
  }

  function getQuery() {
    return filters.query;
  }

  function setQuery(value) {
    filters.query = String(value || "");
  }

  function setOnSyncSearchInput(callback) {
    onSyncSearchInput = typeof callback === "function" ? callback : null;
  }

  function bindEvents() {
    if (ui.filterStartDate) ui.filterStartDate.addEventListener("change", handleInput);
    if (ui.filterEndDate) ui.filterEndDate.addEventListener("change", handleInput);
    if (ui.filterRecurrence) ui.filterRecurrence.addEventListener("change", handleInput);
    if (ui.filterColor) ui.filterColor.addEventListener("change", handleInput);
    if (ui.filterTimezone) ui.filterTimezone.addEventListener("change", handleInput);
    if (ui.filterClear) ui.filterClear.addEventListener("click", clearFilters);
  }

  return {
    filterOccurrences,
    hasAdvancedFilters,
    syncControls,
    handleInput,
    clearFilters,
    getQuery,
    setQuery,
    setOnSyncSearchInput,
    bindEvents,
  };
}
