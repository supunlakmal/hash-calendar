import { renderAgendaView } from "./modules/agendaRender.js";
import { AppLauncher } from "./modules/app_launcher.js";
import {
  formatDateKey,
  getMonthGridRange,
  getWeekRange,
  renderCalendar,
  renderTimeGrid,
  renderWeekdayHeaders,
  renderYearView,
} from "./modules/calendarRender.js";
import {
  COLOR_REGEX,
  CSS_CLASSES,
  DEBOUNCE_MS,
  DEFAULT_COLORS,
  DEFAULT_EVENT_DURATION,
  DEFAULT_STATE,
  DEFAULT_VIEW,
  MAX_EVENT_TITLE_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_TZ_RESULTS,
  MIN_SEARCH_LENGTH,
  MS_PER_MINUTE,
  TIMEZONE_UPDATE_INTERVAL_MS,
  TOAST_TIMEOUT_MS,
  TZ_EMPTY_MESSAGE,
  URL_LENGTH_WARNING_THRESHOLD,
  VALID_VIEWS,
} from "./modules/constants.js";
import { initCountdownWidget } from "./modules/countdownManager.js";
import { FocusMode } from "./modules/focusMode.js";
import { clearHash, isEncryptedHash, readStateFromHash, writeStateToHash } from "./modules/hashcalUrlManager.js";
import { getCurrentLanguage, getCurrentLocale, getTranslatedMonthName, getTranslatedWeekday, setLanguage, SUPPORTED_LANGUAGES, t } from "./modules/i18n.js";
import { parseIcs } from "./modules/icsImporter.js";
import { initQRCodeManager } from "./modules/qrCodeManager.js";
import { expandEvents } from "./modules/recurrenceEngine.js";
import { AVAILABLE_ZONES, getLocalZone, getZoneInfo, isValidZone, parseOffsetSearchTerm } from "./modules/timezoneManager.js";
import { WorldPlanner } from "./modules/worldPlannerModule.js";

let state = cloneState(DEFAULT_STATE);
let viewDate = startOfDay(new Date());
let selectedDate = startOfDay(new Date());
let currentView = DEFAULT_VIEW;
let password = null;
let lockState = { encrypted: false, unlocked: true };
let saveTimer = null;
let occurrencesByDay = new Map();
let editingIndex = null;
let passwordResolver = null;
let passwordMode = "unlock";
let focusMode = null;
let worldPlanner = null;
let qrManager = null;
let timezoneTimer = null;

const ui = {};

function isCalendarLocked() {
  return lockState.encrypted && !lockState.unlocked;
}

function isReadOnlyMode() {
  return !!(state && state.s && state.s.r);
}

function ensureEditable({ silent = false } = {}) {
  if (isCalendarLocked()) return false;
  if (isReadOnlyMode()) {
    if (!silent) {
      showToast(t("toast.readOnlyActive"), "info");
    }
    return false;
  }
  return true;
}

function cloneState(source) {
  return JSON.parse(JSON.stringify(source));
}

function createRipple(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const circle = document.createElement("span");
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;

  const rect = button.getBoundingClientRect();

  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - rect.left - radius}px`;
  circle.style.top = `${event.clientY - rect.top - radius}px`;
  circle.classList.add(CSS_CLASSES.RIPPLE);

  const ripple = button.getElementsByClassName(CSS_CLASSES.RIPPLE)[0];
  if (ripple) {
    ripple.remove();
  }

  button.appendChild(circle);

  circle.addEventListener("animationend", () => {
    circle.remove();
  });
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function formatMonthLabel(date) {
  return `${getTranslatedMonthName(date)} ${date.getFullYear()}`;
}

function formatDateLabel(date) {
  return `${getTranslatedWeekday(date)}, ${getTranslatedMonthName(date)} ${date.getDate()}`;
}

function formatRangeLabel(start, end) {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${getTranslatedMonthName(start)} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }
  if (sameYear) {
    return `${getTranslatedMonthName(start, true)} ${start.getDate()} – ${getTranslatedMonthName(end, true)} ${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${getTranslatedMonthName(start, true)} ${start.getDate()}, ${start.getFullYear()} – ${getTranslatedMonthName(end, true)} ${end.getDate()}, ${end.getFullYear()}`;
}

function formatTime(date) {
  // Use Intl for time as it is usually reliable (numbers/colons) or we can just stick to it.
  // Actually, let's stick to locale sensitive time, it usually works fine (HH:mm).
  return date.toLocaleTimeString(getCurrentLocale(), { hour: "2-digit", minute: "2-digit" });
}

function getStoredView(view) {
  return VALID_VIEWS.has(view) ? view : DEFAULT_VIEW;
}

function applyStoredView() {
  const stored = state && state.s ? state.s.v : null;
  currentView = getStoredView(stored);
  if (state && state.s) state.s.v = currentView;
  updateViewButtons();
}

function normalizeTimezones(rawZones) {
  if (!Array.isArray(rawZones)) return [];
  const zones = [];
  const seen = new Set();
  rawZones.forEach((zone) => {
    if (typeof zone !== "string") return;
    const trimmed = zone.trim();
    if (!trimmed || seen.has(trimmed)) return;
    if (!isValidZone(trimmed)) return;
    seen.add(trimmed);
    zones.push(trimmed);
  });
  return zones;
}

function normalizeState(raw) {
  const next = cloneState(DEFAULT_STATE);
  if (!raw || typeof raw !== "object") return next;

  if (typeof raw.t === "string") {
    next.t = raw.t.slice(0, MAX_TITLE_LENGTH);
  }

  if (raw.c && typeof raw.c === "object" && !Array.isArray(raw.c)) {
    next.c = DEFAULT_COLORS.slice();
    for (const [i, color] of Object.entries(raw.c)) {
      const idx = Number(i);
      if (idx >= 0 && idx < next.c.length && typeof color === "string" && COLOR_REGEX.test(color)) {
        next.c[idx] = color.startsWith("#") ? color : `#${color}`;
      }
    }
  } else if (Array.isArray(raw.c) && raw.c.length) {
    next.c = raw.c.filter((color) => typeof color === "string" && COLOR_REGEX.test(color)).map((color) => (color.startsWith("#") ? color : `#${color}`));
    if (!next.c.length) next.c = DEFAULT_COLORS.slice();
  }

  if (Array.isArray(raw.e)) {
    next.e = raw.e
      .filter((entry) => Array.isArray(entry) && entry.length >= 3)
      .map((entry) => {
        const startMin = Number(entry[0]);
        const duration = Math.max(0, Number(entry[1]) || 0);
        const title = String(entry[2] || "Untitled").slice(0, MAX_EVENT_TITLE_LENGTH);
        const colorIndex = Math.max(0, Math.min(next.c.length - 1, Number(entry[3]) || 0));
        const rule = ["d", "w", "m", "y"].includes(entry[4]) ? entry[4] : "";
        const event = [startMin, duration, title, colorIndex];
        if (rule) event.push(rule);
        return event;
      })
      .filter((entry) => Number.isFinite(entry[0]));
  }

  if (raw.s && typeof raw.s === "object") {
    next.s.d = raw.s.d ? 1 : 0;
    next.s.m = raw.s.m ? 1 : 0;
    next.s.r = raw.s.r ? 1 : 0;
    next.s.v = getStoredView(raw.s.v);
    if (raw.s.l && typeof raw.s.l === "string") {
      const allowed = SUPPORTED_LANGUAGES.map((lang) => lang.code);
      next.s.l = allowed.includes(raw.s.l) ? raw.s.l : "en";
    }
  }

  // Initialize mp object
  if (raw.mp && typeof raw.mp === "object") {
    next.mp = {
      h: typeof raw.mp.h === "string" ? raw.mp.h : null,
      z: Array.isArray(raw.mp.z) ? normalizeTimezones(raw.mp.z) : [],
      s: Number(raw.mp.s) || null,
      d: typeof raw.mp.d === "string" ? raw.mp.d : null,
      f24: !!raw.mp.f24,
    };
  } else {
    next.mp = cloneState(DEFAULT_STATE.mp);
  }

  // Migration: Merge old 'z' or 'timezones' into mp.z
  if (Array.isArray(raw.timezones) || Array.isArray(raw.z) || Array.isArray(raw.tz)) {
    const oldZones = Array.isArray(raw.timezones) ? raw.timezones : Array.isArray(raw.z) ? raw.z : raw.tz;
    const normalized = normalizeTimezones(oldZones);

    // Merge into mp.z, avoiding duplicates
    const combined = [...next.mp.z];
    normalized.forEach(zone => {
      if (!combined.includes(zone)) {
        combined.push(zone);
      }
    });
    next.mp.z = combined;
  }

  // Ensure mp.z has at least UTC if not empty
  if (next.mp.z.length === 0) {
    next.mp.z = ["UTC"];
  } else if (!next.mp.z.includes("UTC")) {
    next.mp.z.unshift("UTC");
  }

  return next;
}

function cacheElements() {
  ui.topbar = document.querySelector(".topbar");
  ui.titleInput = document.getElementById("calendar-title");
  ui.prevMonth = document.getElementById("prev-month");
  ui.nextMonth = document.getElementById("next-month");
  ui.todayBtn = document.getElementById("today-btn");
  ui.addEventBtn = document.getElementById("add-event");
  ui.copyLinkBtn = document.getElementById("copy-link");
  ui.shareQrBtn = document.getElementById("share-qr");
  ui.lockBtn = document.getElementById("lock-btn");
  ui.readOnlyBtn = document.getElementById("readonly-btn");
  ui.focusBtn = document.getElementById("focus-btn");
  ui.viewButtons = Array.from(document.querySelectorAll(".view-toggle button"));
  ui.weekstartToggle = document.getElementById("weekstart-toggle");
  ui.themeToggle = document.getElementById("theme-toggle");
  ui.langBtn = document.getElementById("language-btn");
  ui.langList = document.getElementById("language-list");
  ui.currentLang = document.getElementById("current-lang");
  ui.langDropdown = document.getElementById("language-dropdown");
  ui.monthLabel = document.getElementById("month-label");
  ui.weekdayRow = document.getElementById("weekday-row");
  ui.calendarGrid = document.getElementById("calendar-grid");
  ui.selectedDateLabel = document.getElementById("selected-date-label");
  ui.eventList = document.getElementById("event-list");
  ui.addEventInline = document.getElementById("add-event-inline");
  ui.urlLength = document.getElementById("url-length");
  ui.urlWarning = document.getElementById("url-warning");
  ui.viewJson = document.getElementById("view-json");
  ui.exportJson = document.getElementById("export-json");
  ui.importIcs = document.getElementById("import-ics");
  ui.icsInput = document.getElementById("ics-input");
  ui.clearAll = document.getElementById("clear-all");
  ui.lockedOverlay = document.getElementById("locked-overlay");
  ui.unlockBtn = document.getElementById("unlock-btn");

  ui.eventModal = document.getElementById("event-modal");
  ui.eventForm = document.getElementById("event-form");
  ui.eventModalTitle = document.getElementById("event-modal-title");
  ui.eventClose = document.getElementById("event-close");
  ui.eventCancel = document.getElementById("event-cancel");
  ui.eventDelete = document.getElementById("event-delete");
  ui.eventTitle = document.getElementById("event-title");
  ui.eventDate = document.getElementById("event-date");
  ui.eventTime = document.getElementById("event-time");
  ui.eventDuration = document.getElementById("event-duration");
  ui.eventAllDay = document.getElementById("event-all-day");
  ui.eventRecurrence = document.getElementById("event-recurrence");
  ui.eventColor = document.getElementById("event-color");
  ui.colorPalette = document.getElementById("color-palette");

  ui.passwordModal = document.getElementById("password-modal");
  ui.passwordTitle = document.getElementById("password-title");
  ui.passwordDesc = document.getElementById("password-desc");
  ui.passwordInput = document.getElementById("password-input");
  ui.passwordConfirmField = document.getElementById("password-confirm-field");
  ui.passwordConfirm = document.getElementById("password-confirm");
  ui.passwordError = document.getElementById("password-error");
  ui.passwordClose = document.getElementById("password-close");
  ui.passwordCancel = document.getElementById("password-cancel");
  ui.passwordSubmit = document.getElementById("password-submit");

  ui.jsonModal = document.getElementById("json-modal");
  ui.jsonClose = document.getElementById("json-close");
  ui.jsonHash = document.getElementById("json-hash");
  ui.jsonOutput = document.getElementById("json-output");
  ui.jsonCopy = document.getElementById("json-copy");
  ui.jsonCopyHash = document.getElementById("json-copy-hash");
  ui.jsonDownload = document.getElementById("json-download");

  ui.toastContainer = document.getElementById("toast-container");

  ui.tzSidebar = document.getElementById("timezone-ruler");
  ui.tzList = document.getElementById("tz-list");
  ui.tzAddBtn = document.getElementById("add-tz-btn");
  ui.tzModal = document.getElementById("tz-modal");
  ui.tzSearch = document.getElementById("tz-search");
  ui.tzResults = document.getElementById("tz-results");
  ui.tzClose = document.getElementById("close-tz-modal");
  ui.tzEmpty = document.getElementById("tz-empty");

  ui.hamburgerBtn = document.getElementById("hamburger-btn");
  ui.secondaryActions = document.getElementById("secondary-actions");
  ui.mobileSidebarToggle = document.getElementById("mobile-sidebar-toggle");
  ui.sidePanel = document.querySelector(".side-panel");
  ui.tzSidebar = document.getElementById("timezone-ruler");
  ui.sidePanelClose = document.getElementById("side-panel-close");
  ui.tzSidebarClose = document.getElementById("tz-sidebar-close");

  // Mobile drawer & quick-action bar
  ui.mobileDrawer = document.getElementById("mobile-drawer");
  ui.mobileDrawerBackdrop = document.getElementById("mobile-drawer-backdrop");
  ui.mobileDrawerClose = document.getElementById("mobile-drawer-close");
  ui.mobileQuickActions = document.getElementById("mobile-quick-actions");
  ui.mobileAddEvent = document.getElementById("mobile-add-event");
  ui.mobileCopyLink = document.getElementById("mobile-copy-link");
  ui.mobileShareQr = document.getElementById("mobile-share-qr");
  ui.mobileLockBtn = document.getElementById("mobile-lock-btn");
  ui.mobileUnlockBtn = document.getElementById("mobile-unlock-btn");
  ui.mobileFocusBtn = document.getElementById("mobile-focus-btn");
  ui.mobileWorldPlannerBtn = document.getElementById("mobile-world-planner-btn");
  ui.mobileEventList = document.getElementById("mobile-event-list");
  ui.mobileSelectedDateLabel = document.getElementById("mobile-selected-date-label");
  ui.mobileAddEventInline = document.getElementById("mobile-add-event-inline");
  ui.mobileUrlLength = document.getElementById("mobile-url-length");
  ui.mobileUrlWarning = document.getElementById("mobile-url-warning");
  ui.mobileViewJson = document.getElementById("mobile-view-json");
  ui.mobileExportJson = document.getElementById("mobile-export-json");
  ui.mobileImportIcs = document.getElementById("mobile-import-ics");
  ui.mobileClearAll = document.getElementById("mobile-clear-all");
  ui.mobileTzList = document.getElementById("mobile-tz-list");
  ui.mobileAddTzBtn = document.getElementById("mobile-add-tz-btn");
  ui.shareExportSection = document.getElementById("share-export-section");
  ui.dangerZoneSection = document.getElementById("danger-zone-section");
  ui.mobileShareExportSection = document.getElementById("mobile-share-export-section");
  ui.mobileDangerZoneSection = document.getElementById("mobile-danger-zone-section");
  ui.mobileDrawerViewButtons = Array.from(document.querySelectorAll(".mobile-drawer-view-toggle [data-view]"));
  ui.mobileWeekstartToggle = document.getElementById("mobile-weekstart-toggle");
  ui.mobileThemeToggle = document.getElementById("mobile-theme-toggle");
  ui.mobileReadOnlyBtn = document.getElementById("mobile-readonly-btn");
  ui.mobileLangBtn = document.getElementById("mobile-language-btn");
  ui.mobileLangList = document.getElementById("mobile-language-list");
  ui.mobileCurrentLang = document.getElementById("mobile-current-lang");
  ui.mobileLangDropdown = document.getElementById("mobile-language-dropdown");

  // World Planner
  ui.worldPlannerBtn = document.getElementById("world-planner-btn");
}

function showToast(message, type = "info") {
  if (!ui.toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`.trim();
  toast.textContent = message;
  ui.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, TOAST_TIMEOUT_MS);
}

function hasStoredData() {
  return !!((state.e && state.e.length) || (state.mp && state.mp.z && state.mp.z.length > 1) || isReadOnlyMode());
}

function createTzCard(zoneId, isLocal, isUTC = false) {
  const data = getZoneInfo(zoneId);
  const div = document.createElement("div");
  div.className = `tz-card${isLocal ? " is-local" : ""}${isUTC ? " is-utc" : ""}`;

  div.innerHTML = `
    <div class="tz-name">
      <span class="tz-label">${data.name}</span>
      <span class="tz-offset">UTC${data.offset}</span>
    </div>
    <div class="tz-time">${data.time}</div>
    ${data.dayDiff ? `<div class="tz-diff">${data.dayDiff}</div>` : ""}
    ${!isLocal && !isUTC ? `<button class="tz-remove" type="button" data-zone="${data.fullZone}" aria-label="Remove timezone">x</button>` : ""}
  `;

  return div;
}

function renderTimezones() {
  const targets = [ui.tzList, ui.mobileTzList].filter(Boolean);
  if (!targets.length) return;

  const localZone = getLocalZone();
  const zones = Array.isArray(state.mp.z) ? state.mp.z : [];
  const savedZones = [];
  const seen = new Set();

  zones.forEach((zone) => {
    if (zone === localZone) return;
    if (zone === "UTC") return; // Still filter from savedZones (handled separately)
    if (seen.has(zone)) return;
    if (!isValidZone(zone)) return;
    seen.add(zone);
    savedZones.push(zone);
  });

  targets.forEach((target) => {
    target.innerHTML = "";

    // 1. Always show local timezone
    target.appendChild(createTzCard(localZone, true, false));

    // 2. Always show UTC (unless it's the same as local timezone)
    if (localZone !== "UTC") {
      target.appendChild(createTzCard("UTC", false, true));
    }

    // 3. Show additional custom timezones or empty message
    if (!savedZones.length) {
      const empty = document.createElement("p");
      empty.className = "tz-empty";
      empty.textContent = t("tz.addToCompare");
      target.appendChild(empty);
      return;
    }

    savedZones.forEach((zone) => {
      target.appendChild(createTzCard(zone, false, false));
    });
  });
}

function addTimezone(zoneStr) {
  if (!ensureEditable()) return;
  if (!zoneStr || !isValidZone(zoneStr)) return;
  const localZone = getLocalZone();
  if (zoneStr === localZone) return;
  if (!Array.isArray(state.mp.z)) state.mp.z = [];
  if (state.mp.z.includes(zoneStr)) return;
  state.mp.z.push(zoneStr);
  scheduleSave();
  renderTimezones();
}

function removeTimezone(zoneStr) {
  if (!ensureEditable()) return;
  if (!Array.isArray(state.mp.z) || !zoneStr) return;
  state.mp.z = state.mp.z.filter((zone) => zone !== zoneStr);
  scheduleSave();
  renderTimezones();
}

function renderTzResults(results) {
  if (!ui.tzResults) return;
  ui.tzResults.innerHTML = "";
  results.forEach((zone) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tz-result-btn";
    const info = getZoneInfo(zone);
    const name = document.createElement("span");
    name.className = "tz-result-name";
    name.textContent = zone;
    const offset = document.createElement("span");
    offset.className = "tz-result-offset";
    offset.textContent = `UTC${info.offset}`;
    button.append(name, offset);
    button.dataset.zone = zone;
    li.appendChild(button);
    ui.tzResults.appendChild(li);
  });
}

function handleTzSearch() {
  if (!ui.tzSearch) return;
  const term = ui.tzSearch.value.trim().toLowerCase();
  const offsetQuery = parseOffsetSearchTerm(term);
  if (!AVAILABLE_ZONES.length) {
    if (ui.tzEmpty) {
      ui.tzEmpty.textContent = t("tz.notSupported");
      ui.tzEmpty.classList.remove(CSS_CLASSES.HIDDEN);
    }
    renderTzResults([]);
    return;
  }
  if (term.length < MIN_SEARCH_LENGTH && !offsetQuery) {
    renderTzResults([]);
    if (ui.tzEmpty) ui.tzEmpty.classList.add(CSS_CLASSES.HIDDEN);
    return;
  }
  const localZone = getLocalZone();
  const existing = new Set([localZone, ...(state.mp.z || [])]);
  const matches = AVAILABLE_ZONES.filter((zone) => {
    if (existing.has(zone)) return false;
    const zoneLower = zone.toLowerCase();
    if (zoneLower.includes(term)) return true;
    if (offsetQuery) {
      const zoneOffset = getZoneInfo(zone).offset;
      const normalized = `${offsetQuery.hours}:${String(offsetQuery.minutes).padStart(2, "0")}`;
      if (offsetQuery.hasMinutes) {
        if (offsetQuery.sign) {
          return zoneOffset === `${offsetQuery.sign}${normalized}`;
        }
        return zoneOffset === `+${normalized}` || zoneOffset === `-${normalized}`;
      }
      if (offsetQuery.sign) {
        return zoneOffset.startsWith(`${offsetQuery.sign}${offsetQuery.hours}`);
      }
      return zoneOffset.startsWith(`+${offsetQuery.hours}`) || zoneOffset.startsWith(`-${offsetQuery.hours}`);
    }
    return false;
  }).slice(0, MAX_TZ_RESULTS);
  renderTzResults(matches);
  if (ui.tzEmpty) {
    ui.tzEmpty.textContent = TZ_EMPTY_MESSAGE;
    ui.tzEmpty.classList.toggle(CSS_CLASSES.HIDDEN, matches.length > 0);
  }
}

function openTzModal() {
  if (!ensureEditable()) return;
  if (!ui.tzModal) return;
  if (ui.tzSearch) ui.tzSearch.value = "";
  if (ui.tzEmpty) {
    ui.tzEmpty.textContent = TZ_EMPTY_MESSAGE;
    ui.tzEmpty.classList.add(CSS_CLASSES.HIDDEN);
  }
  renderTzResults([]);
  handleTzSearch();
  if (typeof ui.tzModal.showModal === "function") {
    ui.tzModal.showModal();
  } else {
    ui.tzModal.setAttribute("open", "");
  }
  if (ui.tzSearch) ui.tzSearch.focus();
}

function closeTzModal() {
  if (!ui.tzModal) return;
  if (typeof ui.tzModal.close === "function") {
    ui.tzModal.close();
  } else {
    ui.tzModal.removeAttribute("open");
  }
}

function handleTzResultsClick(event) {
  const button = event.target.closest("button[data-zone]");
  if (!button) return;
  const zone = button.dataset.zone;
  addTimezone(zone);
  closeTzModal();
}

function handleTzListClick(event) {
  const button = event.target.closest("button[data-zone]");
  if (!button) return;
  removeTimezone(button.dataset.zone);
}

function initTimezones() {
  if (!ui.tzList) return;
  renderTimezones();
  if (timezoneTimer) {
    window.clearInterval(timezoneTimer);
    timezoneTimer = null;
  }
  const now = new Date();
  const delay = (60 - now.getSeconds()) * 1000;
  window.setTimeout(() => {
    renderTimezones();
    render(); // Update time indicator
    timezoneTimer = window.setInterval(() => {
      renderTimezones();
      render(); // Update time indicator
    }, TIMEZONE_UPDATE_INTERVAL_MS);
  }, delay);
}

async function persistStateToHash() {
  if (lockState.encrypted && !lockState.unlocked) return;
  if (!hasStoredData()) {
    if (window.location.hash) clearHash();
    updateUrlLength();
    if (ui.jsonModal && !ui.jsonModal.classList.contains(CSS_CLASSES.HIDDEN)) {
      updateJsonModal();
    }
    return;
  }
  await writeStateToHash(state, password);
  updateUrlLength();
  if (ui.jsonModal && !ui.jsonModal.classList.contains(CSS_CLASSES.HIDDEN)) {
    updateJsonModal();
  }
}

function scheduleSave() {
  if (lockState.encrypted && !lockState.unlocked) return;
  if (!hasStoredData()) {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    persistStateToHash();
    return;
  }
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    persistStateToHash();
  }, DEBOUNCE_MS);
}

function updateUrlLength() {
  const length = window.location.hash.length;
  if (ui.urlLength) ui.urlLength.textContent = String(length);
  if (ui.mobileUrlLength) ui.mobileUrlLength.textContent = String(length);
  const warning = length > URL_LENGTH_WARNING_THRESHOLD ? t("panel.urlWarning") : "";
  if (ui.urlWarning) ui.urlWarning.textContent = warning;
  if (ui.mobileUrlWarning) ui.mobileUrlWarning.textContent = warning;
}

function updateTheme() {
  document.body.dataset.theme = state.s.d ? "dark" : "light";
  const label = t(state.s.d ? "settings.themeDark" : "settings.themeLight");
  if (ui.themeToggle) {
    ui.themeToggle.textContent = label;
  }
  if (ui.mobileThemeToggle) {
    const span = ui.mobileThemeToggle.querySelector("span");
    if (span) span.textContent = label;
  }
}

function syncTopbarHeight() {
  if (!ui.topbar) return;
  const topbarH = ui.topbar.offsetHeight;
  document.documentElement.style.setProperty("--topbar-height", `${topbarH}px`);
  const quickBar = ui.mobileQuickActions;
  const quickH = quickBar && window.getComputedStyle(quickBar).display !== "none" ? quickBar.offsetHeight : 0;
  document.documentElement.style.setProperty("--topbar-plus-quick", `${topbarH + quickH}px`);
}

function updateWeekStartLabel() {
  const label = t(state.s.m ? "settings.weekStartsMonday" : "settings.weekStartsSunday");
  if (ui.weekstartToggle) ui.weekstartToggle.textContent = label;
  if (ui.mobileWeekstartToggle) {
    const span = ui.mobileWeekstartToggle.querySelector("span");
    if (span) span.textContent = label;
  }
}

function updateFocusButton(isActive) {
  if (!ui.focusBtn) return;
  const active = typeof isActive === "boolean" ? isActive : focusMode && focusMode.isActive();
  ui.focusBtn.textContent = t(active ? "btn.exitFocus" : "btn.focus");
  ui.focusBtn.setAttribute("aria-pressed", active ? "true" : "false");
}

function updateViewButtons() {
  if (!ui.viewButtons || !ui.viewButtons.length) return;
  ui.viewButtons.forEach((button) => {
    const isActive = button.dataset.view === currentView;
    button.classList.toggle(CSS_CLASSES.ACTIVE, isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  if (ui.mobileDrawerViewButtons && ui.mobileDrawerViewButtons.length) {
    ui.mobileDrawerViewButtons.forEach((button) => {
      const isActive = button.dataset.view === currentView;
      button.classList.toggle(CSS_CLASSES.ACTIVE, isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }
}

function setView(view) {
  if (!VALID_VIEWS.has(view)) return;
  if (currentView === view) return;

  const grid = ui.calendarGrid;
  if (grid) {
    grid.classList.add(CSS_CLASSES.VIEW_ANIMATE_OUT);
    grid.addEventListener(
      "animationend",
      function handleExit() {
        grid.classList.remove(CSS_CLASSES.VIEW_ANIMATE_OUT);
        grid.removeEventListener("animationend", handleExit);

        currentView = view;
        if (state && state.s) state.s.v = view;
        updateViewButtons();
        render();

        grid.classList.add(CSS_CLASSES.VIEW_ANIMATE_IN);
        grid.addEventListener(
          "animationend",
          function handleEnter() {
            grid.classList.remove(CSS_CLASSES.VIEW_ANIMATE_IN);
            grid.removeEventListener("animationend", handleEnter);
          },
          { once: true },
        );

        persistStateToHash();
      },
      { once: true },
    );
  } else {
    currentView = view;
    if (state && state.s) state.s.v = view;
    updateViewButtons();
    render();
    persistStateToHash();
  }
}

function updateLockUI() {
  const isLocked = isCalendarLocked();
  const isReadOnly = isReadOnlyMode();
  const editDisabled = isLocked || isReadOnly;

  if (ui.lockBtn) {
    if (lockState.encrypted) {
      ui.lockBtn.textContent = t(isLocked ? "btn.unlock" : "btn.removeLock");
    } else {
      ui.lockBtn.textContent = t("btn.lock");
    }
  }

  if (ui.readOnlyBtn) {
    ui.readOnlyBtn.textContent = t(isReadOnly ? "btn.editMode" : "btn.readOnly");
    ui.readOnlyBtn.setAttribute("aria-pressed", isReadOnly ? "true" : "false");
    ui.readOnlyBtn.classList.toggle(CSS_CLASSES.IS_ACTIVE_TOGGLE, isReadOnly);
    ui.readOnlyBtn.disabled = isLocked;
  }

  if (ui.mobileReadOnlyBtn) {
    const span = ui.mobileReadOnlyBtn.querySelector("span");
    if (span) {
      span.textContent = t(isReadOnly ? "btn.editMode" : "btn.readOnly");
    }
    ui.mobileReadOnlyBtn.setAttribute("aria-pressed", isReadOnly ? "true" : "false");
    ui.mobileReadOnlyBtn.classList.toggle(CSS_CLASSES.IS_ACTIVE_TOGGLE, isReadOnly);
    ui.mobileReadOnlyBtn.disabled = isLocked;
  }

  if (ui.lockedOverlay) {
    ui.lockedOverlay.classList.toggle(CSS_CLASSES.HIDDEN, !isLocked);
  }

  if (ui.titleInput) {
    ui.titleInput.readOnly = editDisabled;
  }

  [
    ui.addEventBtn,
    ui.addEventInline,
    ui.mobileAddEventInline,
    ui.mobileAddEvent,
    ui.importIcs,
    ui.mobileImportIcs,
    ui.clearAll,
    ui.mobileClearAll,
    ui.tzAddBtn,
    ui.mobileAddTzBtn,
  ].forEach((btn) => {
    if (btn) btn.disabled = editDisabled;
  });

  [
    ui.addEventBtn,
    ui.addEventInline,
    ui.mobileAddEventInline,
    ui.mobileAddEvent,
    ui.tzAddBtn,
    ui.mobileAddTzBtn,
    ui.shareExportSection,
    ui.dangerZoneSection,
    ui.mobileShareExportSection,
    ui.mobileDangerZoneSection,
  ].forEach((item) => {
    if (item) item.classList.toggle(CSS_CLASSES.HIDDEN, isReadOnly);
  });

  [ui.copyLinkBtn, ui.shareQrBtn, ui.mobileCopyLink, ui.mobileShareQr].forEach((btn) => {
    if (btn) btn.disabled = isLocked;
  });

  // Mobile lock/unlock button visibility
  if (ui.mobileLockBtn && ui.mobileUnlockBtn) {
    if (lockState.encrypted && lockState.unlocked) {
      // Show unlock (remove-lock) button, hide lock
      ui.mobileLockBtn.classList.add(CSS_CLASSES.HIDDEN);
      ui.mobileUnlockBtn.classList.remove(CSS_CLASSES.HIDDEN);
    } else {
      // Show lock button, hide unlock
      ui.mobileLockBtn.classList.remove(CSS_CLASSES.HIDDEN);
      ui.mobileUnlockBtn.classList.add(CSS_CLASSES.HIDDEN);
    }
  }
}

function handleReadOnlyToggle() {
  if (!state || !state.s || isCalendarLocked()) return;
  state.s.r = state.s.r ? 0 : 1;
  updateLockUI();
  scheduleSave();
  showToast(t(state.s.r ? "toast.readOnlyEnabled" : "toast.editModeEnabled"), "success");
}

function applyLanguageSelection(langCode) {
  if (!SUPPORTED_LANGUAGES.some((lang) => lang.code === langCode)) return;
  setLanguage(langCode);
  state.s.l = langCode;
  scheduleSave();
  updateLanguageUI();
}

function initLanguageDropdown() {
  if (!ui.langBtn || !ui.langList) return;

  ui.langList.innerHTML = "";
  if (ui.mobileLangList) ui.mobileLangList.innerHTML = "";

  SUPPORTED_LANGUAGES.forEach((lang) => {
    // Desktop list item
    const li = document.createElement("li");
    li.className = "dropdown-item";
    li.dataset.lang = lang.code;
    li.innerHTML = `
      <span>${t(lang.nameKey)}</span>
      <i class="fa-solid fa-check check-icon"></i>
    `;
    li.addEventListener("click", () => {
      applyLanguageSelection(lang.code);
      closeLanguageDropdown(ui.langDropdown, ui.langBtn);
    });
    ui.langList.appendChild(li);

    // Mobile list item
    if (ui.mobileLangList) {
      const mobileLi = document.createElement("li");
      mobileLi.className = "dropdown-item";
      mobileLi.dataset.lang = lang.code;
      mobileLi.innerHTML = `
        <span>${t(lang.nameKey)}</span>
        <i class="fa-solid fa-check check-icon"></i>
      `;
      mobileLi.addEventListener("click", () => {
        applyLanguageSelection(lang.code);
        closeLanguageDropdown(ui.mobileLangDropdown, ui.mobileLangBtn);
      });
      ui.mobileLangList.appendChild(mobileLi);
    }
  });

  updateLanguageUI();

  if (ui.langBtn) {
    ui.langBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLanguageDropdown(ui.langDropdown, ui.langBtn);
    });
  }

  if (ui.mobileLangBtn) {
    ui.mobileLangBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLanguageDropdown(ui.mobileLangDropdown, ui.mobileLangBtn);
    });
  }

  document.addEventListener("click", (e) => {
    if (ui.langDropdown && !ui.langDropdown.classList.contains(CSS_CLASSES.HIDDEN) && !ui.langDropdown.contains(e.target)) {
      closeLanguageDropdown(ui.langDropdown, ui.langBtn);
    }
    if (ui.mobileLangDropdown && !ui.mobileLangDropdown.classList.contains(CSS_CLASSES.HIDDEN) && !ui.mobileLangDropdown.contains(e.target)) {
      closeLanguageDropdown(ui.mobileLangDropdown, ui.mobileLangBtn);
    }
  });
}

function toggleLanguageDropdown(dropdown, trigger) {
  if (!dropdown || !trigger) return;
  const isHidden = dropdown.classList.contains(CSS_CLASSES.HIDDEN);
  if (isHidden) {
    // Close other dropdowns first
    closeLanguageDropdown(ui.langDropdown, ui.langBtn);
    closeLanguageDropdown(ui.mobileLangDropdown, ui.mobileLangBtn);

    dropdown.classList.remove(CSS_CLASSES.HIDDEN);
    trigger.setAttribute("aria-expanded", "true");
  } else {
    closeLanguageDropdown(dropdown, trigger);
  }
}

function closeLanguageDropdown(dropdown, trigger) {
  const d = dropdown || ui.langDropdown;
  const t = trigger || ui.langBtn;
  if (d) d.classList.add(CSS_CLASSES.HIDDEN);
  if (t) t.setAttribute("aria-expanded", "false");
}

function updateLanguageUI() {
  if (!ui.currentLang || !ui.langList) return;
  const langCode = getCurrentLanguage();

  if (ui.currentLang) {
    ui.currentLang.textContent = t(`lang.${langCode}`);
  }

  if (ui.mobileCurrentLang) {
    ui.mobileCurrentLang.textContent = t(`lang.${langCode}`);
  }

  if (ui.langList) {
    ui.langList.querySelectorAll(".dropdown-item").forEach((item) => {
      item.classList.toggle(CSS_CLASSES.ACTIVE, item.dataset.lang === langCode);
    });
  }

  if (ui.mobileLangList) {
    ui.mobileLangList.querySelectorAll(".dropdown-item").forEach((item) => {
      item.classList.toggle(CSS_CLASSES.ACTIVE, item.dataset.lang === langCode);
    });
  }

  ui.langList.querySelectorAll(".dropdown-item").forEach((item) => {
    item.classList.toggle(CSS_CLASSES.ACTIVE, item.dataset.lang === langCode);
  });

  // Re-translate components
  updateTheme();
  updateWeekStartLabel();
  updateLockUI();
  updateFocusButton();
  render();
  if (focusMode && focusMode.isActive()) {
    focusMode.tick();
  }
}

function groupOccurrences(occurrences) {
  const map = new Map();
  occurrences.forEach((occ) => {
    const start = new Date(occ.start);
    const end = new Date(occ.end);
    
    // Normalize start/end to day boundaries for iteration
    const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const dayEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    
    while (current <= dayEnd) {
      const key = formatDateKey(current);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(occ);
      current.setDate(current.getDate() + 1);
    }
  });

  map.forEach((list) => {
    list.sort((a, b) => a.start - b.start);
  });
  return map;
}

function decorateOccurrences(occurrences) {
  return occurrences.map((occ) => {
    const color = state.c[occ.colorIndex] || DEFAULT_COLORS[0];
    const timeLabel = occ.isAllDay ? t("calendar.allDay") : formatTime(new Date(occ.start));
    return { ...occ, color, timeLabel };
  });
}

function render() {
  updateTheme();
  updateWeekStartLabel();
  // Dropdown UI is updated via updateLanguageUI which is called separately
  if (ui.titleInput && document.activeElement !== ui.titleInput) {
    ui.titleInput.value = state.t;
  }

  const weekStartsOnMonday = state.s.m === 1;
  if (ui.calendarGrid) {
    ui.calendarGrid.className = `calendar-grid ${currentView}-view`;
    ui.calendarGrid.style.gridTemplateColumns = "";
    ui.calendarGrid.style.gridTemplateRows = "";
  }
  if (ui.weekdayRow) {
    ui.weekdayRow.classList.toggle(CSS_CLASSES.HIDDEN, currentView === "year" || currentView === "agenda");
  }

  if (currentView === "month") {
    const range = getMonthGridRange(viewDate, weekStartsOnMonday);
    const expanded = expandEvents(state.e, range.start, range.end);
    const decorated = decorateOccurrences(expanded);
    occurrencesByDay = groupOccurrences(decorated);

    if (ui.monthLabel) ui.monthLabel.textContent = formatMonthLabel(viewDate);
    if (ui.weekdayRow) renderWeekdayHeaders(ui.weekdayRow, weekStartsOnMonday, "month");

    if (ui.calendarGrid) {
      renderCalendar({
        container: ui.calendarGrid,
        dates: range.dates,
        currentMonth: viewDate.getMonth(),
        selectedDate,
        eventsByDay: occurrencesByDay,
        onSelectDay: handleSelectDay,
        onEventClick: (event) => openEventModal({ index: event.sourceIndex }),
      });
    }
  } else if (currentView === "week") {
    const range = getWeekRange(selectedDate, weekStartsOnMonday);
    const expanded = expandEvents(state.e, range.start, range.end);
    const decorated = decorateOccurrences(expanded);
    occurrencesByDay = groupOccurrences(decorated);

    if (ui.monthLabel) ui.monthLabel.textContent = formatRangeLabel(range.start, range.end);
    if (ui.weekdayRow) renderWeekdayHeaders(ui.weekdayRow, weekStartsOnMonday, "week", range.dates);
    if (ui.calendarGrid) {
      renderTimeGrid({
        container: ui.calendarGrid,
        dates: range.dates,
        occurrences: decorated,
        onSelectDay: handleSelectDay,
        onEventClick: (event) => openEventModal({ index: event.sourceIndex }),
      });
    }
  } else if (currentView === "day") {
    const start = startOfDay(selectedDate);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59);
    const expanded = expandEvents(state.e, start, end);
    const decorated = decorateOccurrences(expanded);
    occurrencesByDay = groupOccurrences(decorated);

    if (ui.monthLabel) ui.monthLabel.textContent = formatDateLabel(selectedDate);
    if (ui.weekdayRow) renderWeekdayHeaders(ui.weekdayRow, weekStartsOnMonday, "day", [start]);
    if (ui.calendarGrid) {
      renderTimeGrid({
        container: ui.calendarGrid,
        dates: [start],
        occurrences: decorated,
        onSelectDay: handleSelectDay,
        onEventClick: (event) => openEventModal({ index: event.sourceIndex }),
      });
    }
  } else if (currentView === "agenda") {
    const agendaData = renderAgendaView({
      events: state.e,
      colors: state.c,
      container: ui.calendarGrid,
      rangeMonths: 6,
      onEventClick: (event) => openEventModal({ index: event.sourceIndex }),
    });
    occurrencesByDay = agendaData && agendaData.occurrencesByDay ? agendaData.occurrencesByDay : new Map();
    if (ui.monthLabel && agendaData && agendaData.range) {
      ui.monthLabel.textContent = `Agenda · ${formatRangeLabel(agendaData.range.start, agendaData.range.end)}`;
    }
  } else if (currentView === "year") {
    const year = viewDate.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);
    const expanded = expandEvents(state.e, start, end);
    const decorated = decorateOccurrences(expanded);
    occurrencesByDay = groupOccurrences(decorated);

    if (ui.monthLabel) ui.monthLabel.textContent = String(year);
    if (ui.calendarGrid) {
      renderYearView({
        container: ui.calendarGrid,
        year,
        eventsByDay: occurrencesByDay,
        selectedDate,
        weekStartsOnMonday,
        onSelectDay: handleSelectDay,
      });
    }
  }

  // Assign stagger indices to calendar cells
  if (ui.calendarGrid) {
    const cells = ui.calendarGrid.querySelectorAll(".day-cell, .time-cell, .mini-month, .agenda-event-item");
    cells.forEach((cell, index) => {
      cell.style.setProperty("--cell-index", index);
    });
  }

  renderEventList();
  renderTimezones();
  updateUrlLength();
  if (ui.jsonModal && !ui.jsonModal.classList.contains(CSS_CLASSES.HIDDEN)) {
    updateJsonModal();
  }
  updateLockUI();
  initCountdownWidget(state.e);
}

function renderEventList() {
  const key = formatDateKey(selectedDate);
  const list = occurrencesByDay.get(key) || [];
  const label = formatDateLabel(selectedDate);
  const targets = [
    [ui.selectedDateLabel, ui.eventList],
    [ui.mobileSelectedDateLabel, ui.mobileEventList],
  ];

  const createEventItem = (event) => {
    const item = document.createElement("div");
    item.className = "event-item";
    item.dataset.index = String(event.sourceIndex);

    const left = document.createElement("div");
    left.className = "event-info";
    const title = document.createElement("div");
    title.className = "event-title";
    title.textContent = event.title;
    const time = document.createElement("div");
    time.className = "event-time";
    time.textContent = event.timeLabel;
    left.appendChild(title);
    left.appendChild(time);

    const dot = document.createElement("div");
    dot.className = "event-dot";
    dot.style.background = event.color;

    item.appendChild(left);
    item.appendChild(dot);
    item.addEventListener("click", () => openEventModal({ index: event.sourceIndex }));
    return item;
  };

  targets.forEach(([labelEl, listEl]) => {
    if (!labelEl || !listEl) return;
    labelEl.textContent = label;
    listEl.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "event-item";
      empty.textContent = t("calendar.noEvents");
      listEl.appendChild(empty);
      return;
    }

    list.forEach((event) => {
      listEl.appendChild(createEventItem(event));
    });
  });
}

function handleSelectDay(date) {
  selectedDate = startOfDay(date);
  if (currentView === "month") {
    if (ui.calendarGrid) {
      const previous = ui.calendarGrid.querySelector(".day-cell.is-selected");
      if (previous) previous.classList.remove(CSS_CLASSES.IS_SELECTED);
      const key = formatDateKey(selectedDate);
      const next = ui.calendarGrid.querySelector(`.day-cell[data-date="${key}"]`);
      if (next) next.classList.add(CSS_CLASSES.IS_SELECTED);
    }
    renderEventList();
    return;
  }

  viewDate = startOfDay(date);
  render();
}

function openEventModal({ index = null, date = null } = {}) {
  if (!ensureEditable()) return;
  if (!ui.eventModal) return;
  editingIndex = index;
  const isEditing = typeof index === "number";
  ui.eventModalTitle.textContent = t(isEditing ? "modal.editEvent" : "modal.addEvent");
  ui.eventDelete.classList.toggle(CSS_CLASSES.HIDDEN, !isEditing);

  const baseDate = date || selectedDate;
  const now = new Date();
  let startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), now.getHours(), now.getMinutes());
  let duration = DEFAULT_EVENT_DURATION;
  let title = "";
  let color = state.c[0] || DEFAULT_COLORS[0];
  let rule = "";
  let isAllDay = false;

  if (isEditing) {
    const entry = state.e[index];
    if (entry) {
      const [startMin, storedDuration, storedTitle, colorIndex, storedRule] = entry;
      startDate = new Date(startMin * MS_PER_MINUTE);
      duration = storedDuration || 0;
      title = storedTitle || "";
      color = state.c[colorIndex] || color;
      rule = storedRule || "";
      isAllDay = duration === 0;
    }
  }

  ui.eventTitle.value = title;
  ui.eventDate.value = formatDateKey(startDate);
  ui.eventTime.value = startDate.toTimeString().slice(0, 5);
  ui.eventDuration.value = String(isAllDay ? 0 : duration || DEFAULT_EVENT_DURATION);
  ui.eventRecurrence.value = rule;
  ui.eventColor.value = color;
  ui.eventAllDay.checked = isAllDay;
  toggleAllDay(isAllDay);
  renderColorPalette(color);

  ui.eventModal.classList.remove(CSS_CLASSES.HIDDEN);
}

function closeEventModal() {
  if (ui.eventModal) ui.eventModal.classList.add(CSS_CLASSES.HIDDEN);
}

function toggleAllDay(allDay) {
  if (!ui.eventTime || !ui.eventDuration) return;
  ui.eventTime.disabled = allDay;
  ui.eventDuration.disabled = allDay;
  if (allDay) {
    ui.eventDuration.value = "0";
  } else if (Number(ui.eventDuration.value) === 0) {
    ui.eventDuration.value = String(DEFAULT_EVENT_DURATION);
  }
}

function renderColorPalette(activeColor) {
  if (!ui.colorPalette) return;
  ui.colorPalette.innerHTML = "";
  state.c.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch";
    if (color.toLowerCase() === activeColor.toLowerCase()) {
      swatch.classList.add("active");
    }
    swatch.style.background = color;
    swatch.addEventListener("click", () => {
      ui.eventColor.value = color;
      renderColorPalette(color);
    });
    ui.colorPalette.appendChild(swatch);
  });
}

function saveEvent(event) {
  if (!ensureEditable()) return;
  event.preventDefault();
  if (!ui.eventTitle || !ui.eventDate) return;
  const title = ui.eventTitle.value.trim() || "Untitled";
  const dateValue = ui.eventDate.value;
  if (!dateValue) return;

  const [year, month, day] = dateValue.split("-").map(Number);
  const allDay = ui.eventAllDay.checked;

  let startDate;
  if (allDay) {
    startDate = new Date(year, month - 1, day);
  } else {
    const [rawHours, rawMinutes] = ui.eventTime.value.split(":").map(Number);
    const hours = Number.isFinite(rawHours) ? rawHours : 9;
    const minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0;
    startDate = new Date(year, month - 1, day, hours, minutes);
  }

  const startMin = Math.floor(startDate.getTime() / MS_PER_MINUTE);
  const duration = allDay ? 0 : Math.max(0, Number(ui.eventDuration.value) || DEFAULT_EVENT_DURATION);
  const colorValue = ui.eventColor.value.toLowerCase();
  let colorIndex = state.c.findIndex((color) => color.toLowerCase() === colorValue);
  if (colorIndex === -1) {
    state.c.push(colorValue);
    colorIndex = state.c.length - 1;
  }
  const rule = ui.eventRecurrence.value;
  const entry = [startMin, duration, title, colorIndex];
  if (rule) entry.push(rule);

  if (typeof editingIndex === "number") {
    state.e[editingIndex] = entry;
  } else {
    state.e.push(entry);
  }

  selectedDate = startOfDay(startDate);
  closeEventModal();
  scheduleSave();
  render();
}

function deleteEvent() {
  if (!ensureEditable()) return;
  if (typeof editingIndex !== "number") return;
  const confirmed = window.confirm(t("confirm.deleteEvent"));
  if (!confirmed) return;
  state.e.splice(editingIndex, 1);
  editingIndex = null;
  closeEventModal();
  scheduleSave();
  render();
}

function openPasswordModal({ mode, title, description, submitLabel }) {
  if (!ui.passwordModal) return Promise.resolve(null);
  passwordMode = mode;
  ui.passwordTitle.textContent = title;
  ui.passwordDesc.textContent = description;
  ui.passwordInput.value = "";
  ui.passwordConfirm.value = "";
  ui.passwordError.classList.add(CSS_CLASSES.HIDDEN);

  if (mode === "set") {
    ui.passwordConfirmField.classList.remove(CSS_CLASSES.HIDDEN);
  } else {
    ui.passwordConfirmField.classList.add(CSS_CLASSES.HIDDEN);
  }

  ui.passwordSubmit.textContent = submitLabel;
  ui.passwordModal.classList.remove(CSS_CLASSES.HIDDEN);

  return new Promise((resolve) => {
    passwordResolver = resolve;
  });
}

function closePasswordModal() {
  if (ui.passwordModal) ui.passwordModal.classList.add(CSS_CLASSES.HIDDEN);
  if (passwordResolver) {
    passwordResolver(null);
    passwordResolver = null;
  }
}

function submitPassword() {
  if (!passwordResolver) return;
  const value = ui.passwordInput.value.trim();
  if (!value) {
    ui.passwordError.textContent = t("password.required");
    ui.passwordError.classList.remove(CSS_CLASSES.HIDDEN);
    return;
  }

  if (passwordMode === "set") {
    if (value !== ui.passwordConfirm.value.trim()) {
      ui.passwordError.textContent = t("password.mismatch");
      ui.passwordError.classList.remove(CSS_CLASSES.HIDDEN);
      return;
    }
  }

  ui.passwordModal.classList.add(CSS_CLASSES.HIDDEN);
  passwordResolver(value);
  passwordResolver = null;
}

async function handleLockAction() {
  if (lockState.encrypted && !lockState.unlocked) {
    await attemptUnlock();
    return;
  }

  if (lockState.encrypted && lockState.unlocked) {
    const confirmed = window.confirm(t("confirm.removeLock"));
    if (!confirmed) return;
    password = null;
    lockState = { encrypted: false, unlocked: true };
    await writeStateToHash(state, null);
    updateLockUI();
    showToast(t("toast.lockRemoved"), "success");
    return;
  }

  const value = await openPasswordModal({
    mode: "set",
    title: t("modal.setPassword"),
    description: t("password.setDesc"),
    submitLabel: t("modal.setPassword"),
  });
  if (!value) return;
  password = value;
  lockState = { encrypted: true, unlocked: true };
  await writeStateToHash(state, password);
  updateLockUI();
  showToast(t("toast.calendarLocked"), "success");
}

async function attemptUnlock() {
  const value = await openPasswordModal({
    mode: "unlock",
    title: t("modal.unlockCalendar"),
    description: t("password.unlockDesc"),
    submitLabel: t("btn.unlock"),
  });
  if (!value) return;
  try {
    const loaded = await readStateFromHash(value);
    password = value;
    lockState = { encrypted: true, unlocked: true };
    state = normalizeState(loaded);
    if (state.s.l) setLanguage(state.s.l);
    applyStoredView();
    render();
    showToast(t("toast.calendarUnlocked"), "success");
  } catch (error) {
    showToast(t("toast.incorrectPassword"), "error");
    lockState = { encrypted: true, unlocked: false };
    updateLockUI();
  }
}

async function loadStateFromHash() {
  if (!window.location.hash) {
    state = cloneState(DEFAULT_STATE);
    // Initialize language from local storage if no hash
    state.s.l = getCurrentLanguage();
    applyStoredView();
    return;
  }

  if (isEncryptedHash()) {
    lockState = { encrypted: true, unlocked: false };
    state = cloneState(DEFAULT_STATE);
    updateLockUI();
    return;
  }

  try {
    const loaded = await readStateFromHash();
    state = normalizeState(loaded);
    if (state.s.l) setLanguage(state.s.l);
  } catch (error) {
    state = cloneState(DEFAULT_STATE);
  }
  applyStoredView();
}

function handleHashChange() {
  loadStateFromHash().then(render);
}

function handleTitleInput() {
  if (!ui.titleInput) return;
  if (!ensureEditable({ silent: true })) {
    ui.titleInput.value = state.t;
    return;
  }
  state.t = ui.titleInput.value.slice(0, MAX_TITLE_LENGTH);
  scheduleSave();
}

function handleThemeToggle() {
  state.s.d = state.s.d ? 0 : 1;
  updateTheme();
  scheduleSave();
}

function handleWeekStartToggle() {
  state.s.m = state.s.m ? 0 : 1;
  render();
  scheduleSave();
}

function shiftView(direction) {
  if (currentView === "month") {
    viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + direction, 1);
  } else if (currentView === "year") {
    viewDate = new Date(viewDate.getFullYear() + direction, 0, 1);
  } else if (currentView === "week") {
    selectedDate = addDays(selectedDate, direction * 7);
    viewDate = startOfDay(selectedDate);
  } else if (currentView === "day") {
    selectedDate = addDays(selectedDate, direction);
    viewDate = startOfDay(selectedDate);
  }
  render();
}

function handlePrevMonth() {
  shiftView(-1);
}

function handleNextMonth() {
  shiftView(1);
}

function handleToday() {
  const today = startOfDay(new Date());
  viewDate = today;
  selectedDate = today;
  render();
}

function fallbackCopyText(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "absolute";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  let success = false;
  try {
    success = document.execCommand("copy");
  } catch (error) {
    success = false;
  }
  document.body.removeChild(textArea);
  return success;
}

async function handleCopyLink() {
  await persistStateToHash();
  const url = window.location.href;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      showToast(t("toast.linkCopied"), "success");
      return;
    } catch (error) {
      // Fallback below
    }
  }
  if (fallbackCopyText(url)) {
    showToast(t("toast.linkCopied"), "success");
  } else {
    showToast(t("toast.unableToCopyLink"), "error");
  }
}

function handleShareQr() {
  if (qrManager) {
    qrManager.show();
  }
}

function handleFocusToggle() {
  if (!focusMode) return;
  if (focusMode.isActive()) {
    focusMode.stop();
  } else {
    focusMode.start();
  }
}

function updateJsonModal() {
  if (ui.jsonOutput) {
    ui.jsonOutput.value = JSON.stringify(state, null, 2);
  }
  if (ui.jsonHash) {
    ui.jsonHash.value = window.location.hash || "";
  }
}

function openJsonModal() {
  if (!ui.jsonModal) return;
  updateJsonModal();
  ui.jsonModal.classList.remove(CSS_CLASSES.HIDDEN);
}

function closeJsonModal() {
  if (!ui.jsonModal) return;
  ui.jsonModal.classList.add(CSS_CLASSES.HIDDEN);
}

async function handleCopyJson() {
  if (!ui.jsonOutput) return;
  try {
    await navigator.clipboard.writeText(ui.jsonOutput.value);
    showToast(t("toast.jsonCopied"), "success");
  } catch (error) {
    showToast(t("toast.unableToCopyJson"), "error");
  }
}

async function handleCopyHash() {
  if (!ui.jsonHash) return;
  try {
    await navigator.clipboard.writeText(ui.jsonHash.value);
    showToast(t("toast.hashCopied"), "success");
  } catch (error) {
    showToast(t("toast.unableToCopyHash"), "error");
  }
}

function handleExportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "hashcal.json";
  link.click();
  URL.revokeObjectURL(url);
}

function handleImportIcsClick() {
  if (!ensureEditable()) return;
  if (ui.icsInput) ui.icsInput.click();
}

function handleIcsFile(event) {
  if (!ensureEditable()) return;
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "");
    const imported = parseIcs(text);
    if (!imported.length) {
      showToast(t("toast.noEventsFound"), "error");
      return;
    }
    const colorCount = state.c.length || 1;
    imported.forEach((entry, idx) => {
      const start = entry.start;
      if (!start) return;
      const startMin = Math.floor(start.getTime() / MS_PER_MINUTE);
      let duration = 0;
      if (entry.end) {
        duration = Math.max(0, Math.round((entry.end.getTime() - start.getTime()) / MS_PER_MINUTE));
      }
      if (entry.isAllDay) duration = 0;
      const colorIndex = idx % colorCount;
      const event = [startMin, duration, entry.title || "Imported", colorIndex];
      if (entry.rule) event.push(entry.rule);
      state.e.push(event);
    });
    scheduleSave();
    render();
    showToast(t("toast.eventsImported"), "success");
  };
  reader.readAsText(file);
  event.target.value = "";
}

function handleClearAll() {
  if (!ensureEditable()) return;
  const confirmed = window.confirm(t("confirm.clearAll"));
  if (!confirmed) return;
  state.e = [];
  scheduleSave();
  render();
}

function bindEvents() {
  if (ui.titleInput) ui.titleInput.addEventListener("input", handleTitleInput);
  if (ui.prevMonth) ui.prevMonth.addEventListener("click", handlePrevMonth);
  if (ui.nextMonth) ui.nextMonth.addEventListener("click", handleNextMonth);
  if (ui.todayBtn) ui.todayBtn.addEventListener("click", handleToday);
  if (ui.viewButtons && ui.viewButtons.length) {
    ui.viewButtons.forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.view));
    });
  }
  if (ui.addEventBtn) ui.addEventBtn.addEventListener("click", () => openEventModal({ date: selectedDate }));
  if (ui.addEventInline) ui.addEventInline.addEventListener("click", () => openEventModal({ date: selectedDate }));
  if (ui.copyLinkBtn) ui.copyLinkBtn.addEventListener("click", handleCopyLink);
  if (ui.shareQrBtn) ui.shareQrBtn.addEventListener("click", handleShareQr);
  if (ui.lockBtn) ui.lockBtn.addEventListener("click", handleLockAction);
  if (ui.readOnlyBtn) ui.readOnlyBtn.addEventListener("click", handleReadOnlyToggle);
  if (ui.focusBtn) ui.focusBtn.addEventListener("click", handleFocusToggle);
  if (ui.weekstartToggle) ui.weekstartToggle.addEventListener("click", handleWeekStartToggle);
  if (ui.themeToggle) ui.themeToggle.addEventListener("click", handleThemeToggle);
  initLanguageDropdown();
  if (ui.unlockBtn) ui.unlockBtn.addEventListener("click", attemptUnlock);
  if (ui.viewJson) ui.viewJson.addEventListener("click", openJsonModal);
  if (ui.exportJson) ui.exportJson.addEventListener("click", handleExportJson);
  if (ui.importIcs) ui.importIcs.addEventListener("click", handleImportIcsClick);
  if (ui.icsInput) ui.icsInput.addEventListener("change", handleIcsFile);
  if (ui.clearAll) ui.clearAll.addEventListener("click", handleClearAll);

  if (ui.eventClose) ui.eventClose.addEventListener("click", closeEventModal);
  if (ui.eventCancel) ui.eventCancel.addEventListener("click", closeEventModal);
  if (ui.eventDelete) ui.eventDelete.addEventListener("click", deleteEvent);
  if (ui.eventForm) ui.eventForm.addEventListener("submit", saveEvent);
  if (ui.eventAllDay) ui.eventAllDay.addEventListener("change", (e) => toggleAllDay(e.target.checked));

  if (ui.passwordClose) ui.passwordClose.addEventListener("click", closePasswordModal);
  if (ui.passwordCancel) ui.passwordCancel.addEventListener("click", closePasswordModal);
  if (ui.passwordSubmit) ui.passwordSubmit.addEventListener("click", submitPassword);
  if (ui.jsonClose) ui.jsonClose.addEventListener("click", closeJsonModal);
  if (ui.jsonCopy) ui.jsonCopy.addEventListener("click", handleCopyJson);
  if (ui.jsonCopyHash) ui.jsonCopyHash.addEventListener("click", handleCopyHash);
  if (ui.jsonDownload) ui.jsonDownload.addEventListener("click", handleExportJson);
  if (ui.tzAddBtn) ui.tzAddBtn.addEventListener("click", openTzModal);
  if (ui.tzClose) ui.tzClose.addEventListener("click", closeTzModal);
  if (ui.tzSearch) ui.tzSearch.addEventListener("input", handleTzSearch);
  if (ui.tzResults) ui.tzResults.addEventListener("click", handleTzResultsClick);
  if (ui.tzList) ui.tzList.addEventListener("click", handleTzListClick);
  if (ui.mobileTzList) ui.mobileTzList.addEventListener("click", handleTzListClick);
  if (ui.tzModal) {
    ui.tzModal.addEventListener("click", (event) => {
      if (event.target === ui.tzModal) closeTzModal();
    });
  }

  window.addEventListener("hashchange", handleHashChange);
  window.addEventListener("resize", syncTopbarHeight);
}

function openMobileDrawer() {
  if (ui.mobileDrawer) ui.mobileDrawer.classList.add(CSS_CLASSES.IS_ACTIVE);
  if (ui.mobileDrawerBackdrop) ui.mobileDrawerBackdrop.classList.add(CSS_CLASSES.IS_ACTIVE);
  document.body.style.overflow = "hidden";
  const icon = ui.hamburgerBtn && ui.hamburgerBtn.querySelector("i");
  if (icon) {
    icon.classList.remove("fa-bars");
    icon.classList.add("fa-xmark");
  }
}

function closeMobileDrawer() {
  if (ui.mobileDrawer) ui.mobileDrawer.classList.remove(CSS_CLASSES.IS_ACTIVE);
  if (ui.mobileDrawerBackdrop) ui.mobileDrawerBackdrop.classList.remove(CSS_CLASSES.IS_ACTIVE);
  document.body.style.overflow = "";
  const icon = ui.hamburgerBtn && ui.hamburgerBtn.querySelector("i");
  if (icon) {
    icon.classList.add("fa-bars");
    icon.classList.remove("fa-xmark");
  }
}

function initResponsiveFeatures() {
  // Hamburger opens/closes the drawer
  if (ui.hamburgerBtn) {
    ui.hamburgerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (ui.mobileDrawer && ui.mobileDrawer.classList.contains(CSS_CLASSES.IS_ACTIVE)) {
        closeMobileDrawer();
      } else {
        openMobileDrawer();
      }
    });
  }

  // Close button & backdrop close the drawer
  if (ui.mobileDrawerClose) ui.mobileDrawerClose.addEventListener("click", closeMobileDrawer);
  if (ui.mobileDrawerBackdrop) ui.mobileDrawerBackdrop.addEventListener("click", closeMobileDrawer);

  // Quick-action buttons delegate to existing handlers
  if (ui.mobileAddEvent) ui.mobileAddEvent.addEventListener("click", () => openEventModal({ date: selectedDate }));
  if (ui.mobileCopyLink) ui.mobileCopyLink.addEventListener("click", handleCopyLink);
  if (ui.mobileShareQr) ui.mobileShareQr.addEventListener("click", handleShareQr);
  if (ui.mobileLockBtn) ui.mobileLockBtn.addEventListener("click", handleLockAction);
  if (ui.mobileUnlockBtn) ui.mobileUnlockBtn.addEventListener("click", handleLockAction);
  if (ui.mobileFocusBtn) ui.mobileFocusBtn.addEventListener("click", handleFocusToggle);
  if (ui.mobileAddEventInline) {
    ui.mobileAddEventInline.addEventListener("click", () => {
      closeMobileDrawer();
      openEventModal({ date: selectedDate });
    });
  }
  if (ui.mobileViewJson) {
    ui.mobileViewJson.addEventListener("click", () => {
      closeMobileDrawer();
      openJsonModal();
    });
  }
  if (ui.mobileExportJson) {
    ui.mobileExportJson.addEventListener("click", () => {
      closeMobileDrawer();
      handleExportJson();
    });
  }
  if (ui.mobileImportIcs) {
    ui.mobileImportIcs.addEventListener("click", () => {
      closeMobileDrawer();
      handleImportIcsClick();
    });
  }
  if (ui.mobileClearAll) {
    ui.mobileClearAll.addEventListener("click", () => {
      closeMobileDrawer();
      handleClearAll();
    });
  }
  if (ui.mobileAddTzBtn) {
    ui.mobileAddTzBtn.addEventListener("click", () => {
      closeMobileDrawer();
      openTzModal();
    });
  }

  // Drawer view buttons
  if (ui.mobileDrawerViewButtons && ui.mobileDrawerViewButtons.length) {
    ui.mobileDrawerViewButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setView(button.dataset.view);
        closeMobileDrawer();
      });
    });
  }

  // Drawer settings buttons
  if (ui.mobileWeekstartToggle) {
    ui.mobileWeekstartToggle.addEventListener("click", handleWeekStartToggle);
  }
  if (ui.mobileThemeToggle) {
    ui.mobileThemeToggle.addEventListener("click", handleThemeToggle);
  }
  if (ui.mobileReadOnlyBtn) {
    ui.mobileReadOnlyBtn.addEventListener("click", () => {
      handleReadOnlyToggle();
      closeMobileDrawer();
    });
  }

  // Drawer world planner button
  if (ui.mobileWorldPlannerBtn) {
    ui.mobileWorldPlannerBtn.addEventListener("click", () => {
      closeMobileDrawer();
      worldPlanner.open();
    });
  }

  // Existing mobile sidebar toggle logic (unchanged)
  if (ui.mobileSidebarToggle) {
    ui.mobileSidebarToggle.addEventListener("click", () => {
      if (ui.sidePanel.classList.contains(CSS_CLASSES.IS_ACTIVE)) {
        ui.sidePanel.classList.remove(CSS_CLASSES.IS_ACTIVE);
        ui.tzSidebar.classList.add(CSS_CLASSES.IS_ACTIVE);
        ui.mobileSidebarToggle.querySelector("span").textContent = t("label.clock");
      } else if (ui.tzSidebar.classList.contains(CSS_CLASSES.IS_ACTIVE)) {
        ui.tzSidebar.classList.remove(CSS_CLASSES.IS_ACTIVE);
        ui.mobileSidebarToggle.querySelector("span").textContent = t("label.details");
      } else {
        ui.sidePanel.classList.add(CSS_CLASSES.IS_ACTIVE);
        ui.mobileSidebarToggle.querySelector("span").textContent = t("label.events");
      }
    });
  }

  if (ui.sidePanelClose) {
    ui.sidePanelClose.addEventListener("click", () => {
      ui.sidePanel.classList.remove(CSS_CLASSES.IS_ACTIVE);
      if (ui.mobileSidebarToggle) ui.mobileSidebarToggle.querySelector("span").textContent = t("label.details");
    });
  }

  if (ui.tzSidebarClose) {
    ui.tzSidebarClose.addEventListener("click", () => {
      ui.tzSidebar.classList.remove(CSS_CLASSES.IS_ACTIVE);
      if (ui.mobileSidebarToggle) ui.mobileSidebarToggle.querySelector("span").textContent = t("label.details");
    });
  }
}

async function init() {
  cacheElements();
  syncTopbarHeight();
  qrManager = initQRCodeManager({
    onBeforeOpen: persistStateToHash,
    onCopyLink: handleCopyLink,
    showToast,
  });
  focusMode = new FocusMode({
    getState: () => state,
    fallbackColors: DEFAULT_COLORS,
    onToggle: updateFocusButton,
  });
  worldPlanner = new WorldPlanner({
    getState: () => state,
    updateState: (key, value) => {
      state[key] = value;
    },
    ensureEditable,
    scheduleSave,
    showToast,
    closeMobileDrawer,
  });
  bindEvents();
  initResponsiveFeatures();
  await loadStateFromHash();
  if (!isEncryptedHash() && !hasStoredData() && window.location.hash) {
    clearHash();
  }

  updateViewButtons();
  updateFocusButton(false);
  render();
  initTimezones();
  if (ui.worldPlannerBtn) {
    ui.worldPlannerBtn.addEventListener("click", () => worldPlanner.open());
  }
  new AppLauncher();

  if (isEncryptedHash() && !lockState.unlocked) {
    attemptUnlock();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

document.addEventListener("click", (e) => {
  if (e.target.closest("button")) {
    createRipple(e);
  }
});

/* --- PWA Service Worker Registration --- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        console.log("ServiceWorker registration successful with scope: ", registration.scope);
      })
      .catch((err) => {
        console.log("ServiceWorker registration failed: ", err);
      });
  });
}
