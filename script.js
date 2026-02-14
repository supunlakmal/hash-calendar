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
  NOTIFICATION_CHECK_INTERVAL_MS,
  NOTIFICATION_LEAD_MINUTES,
  MS_PER_MINUTE,
  TIMEZONE_UPDATE_INTERVAL_MS,
  TOAST_TIMEOUT_MS,
  TZ_EMPTY_MESSAGE,
  URL_LENGTH_WARNING_THRESHOLD,
  VALID_VIEWS,
} from "./modules/constants.js";
import { cacheElements } from "./modules/cacheElements.js";
import { initCountdownWidget } from "./modules/countdownManager.js";
import { FocusMode } from "./modules/focusMode.js";
import { clearHash, isEncryptedHash, readStateFromHash, writeStateToHash } from "./modules/hashcalUrlManager.js";
import { getCurrentLanguage, getCurrentLocale, getTranslatedMonthName, getTranslatedWeekday, setLanguage, SUPPORTED_LANGUAGES, t } from "./modules/i18n.js";
import { parseIcs } from "./modules/icsImporter.js";
import { createJsonModalController, createPasswordModalController } from "./modules/modalManager.js";
import { getCreationHashPath, importEventsFromPath as importEventsFromPathFromLocation } from "./modules/pathImportManager.js";
import { initQRCodeManager } from "./modules/qrCodeManager.js";
import { expandEvents } from "./modules/recurrenceEngine.js";
import { createResponsiveFeaturesController } from "./modules/responsiveFeatures.js";
import { StateSaveManager } from "./modules/stateSaveManager.js";
import { createTemplateGalleryController } from "./modules/templateGallery.js";
import { renderTimelineView } from "./modules/timelineRender.js";
import { AVAILABLE_ZONES, getLocalZone, getZoneInfo, isValidZone, parseOffsetSearchTerm } from "./modules/timezoneManager.js";
import { parsePathToEventEntries } from "./modules/urlPathEventParser.js";
import { WorldPlanner } from "./modules/worldPlannerModule.js";

let state = cloneState(DEFAULT_STATE);
let viewDate = startOfDay(new Date());
let selectedDate = startOfDay(new Date());
let currentView = DEFAULT_VIEW;
let password = null;
let lockState = { encrypted: false, unlocked: true };
let occurrencesByDay = new Map();
let editingIndex = null;
let focusMode = null;
let worldPlanner = null;
let qrManager = null;
let timezoneTimer = null;
let saveManager = null;
let passwordModalController = null;
let jsonModalController = null;
let notificationTimer = null;
let responsiveFeaturesController = null;
let templateGalleryController = null;
let timelineViewData = null;
let timelineNeedsCenter = false;
let timelinePendingAnchorDate = null;
let timelineMinimapSession = null;
const notifiedOccurrences = new Map();

const ui = {};
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;
const TIMELINE_ZOOM_LEVELS = [
  { key: "month", dayWidth: 10 },
  { key: "week", dayWidth: 28 },
  { key: "day", dayWidth: 96 },
  { key: "hour", dayWidth: 480 },
  { key: "minute", dayWidth: 1440 },
];
const DEFAULT_TIMELINE_ZOOM_LEVEL = 2;
const TIMELINE_RECURRING_WINDOW_DAYS = 365;
const TIMELINE_PADDING_DAYS = 14;
let timelineZoomLevel = DEFAULT_TIMELINE_ZOOM_LEVEL;
const APP_READY_ATTRIBUTE = "data-app-ready";

function setAppReady(isReady) {
  document.documentElement.setAttribute(APP_READY_ATTRIBUTE, isReady ? "1" : "0");
}

function isCalendarLocked() {
  return lockState.encrypted && !lockState.unlocked;
}

function isReadOnlyMode() {
  return !!(state && state.s && state.s.r);
}

function isNotificationEnabled() {
  return !!(state && state.s && state.s.n);
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

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
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

function setCalendarHeaderLabel(text) {
  const label = typeof text === "string" ? text : "";
  if (ui.monthLabel) ui.monthLabel.textContent = label;
  if (ui.topbarDateLabel) ui.topbarDateLabel.textContent = label;
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
  timelineNeedsCenter = currentView === "timeline";
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
    next.s.n = raw.s.n ? 1 : 0;
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
  return !!((state.e && state.e.length) || (state.mp && state.mp.z && state.mp.z.length > 1) || isReadOnlyMode() || isNotificationEnabled());
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
  if (!saveManager) return;
  await saveManager.persistStateToHash();
}

function scheduleSave() {
  if (!saveManager) return;
  saveManager.scheduleSave();
}

function clearPendingSave() {
  if (!saveManager) return;
  saveManager.clearPendingSave();
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
    const icon = ui.themeToggle.querySelector("i");
    const labelSpan = ui.themeToggle.querySelector(".theme-toggle-text");
    if (icon) {
      icon.className = `fa-solid ${state.s.d ? "fa-moon" : "fa-sun"}`;
      icon.setAttribute("aria-hidden", "true");
    }
    if (labelSpan) {
      labelSpan.textContent = label;
    } else {
      ui.themeToggle.textContent = label;
    }
    ui.themeToggle.setAttribute("aria-label", label);
    ui.themeToggle.title = label;
  }
  if (ui.mobileThemeToggle) {
    const span = ui.mobileThemeToggle.querySelector("span");
    if (span) span.textContent = label;
  }
}

function syncTopbarHeight() {
  if (!responsiveFeaturesController) return;
  responsiveFeaturesController.syncTopbarHeight();
}

function updateWeekStartLabel() {
  const label = t(state.s.m ? "settings.weekStartsMonday" : "settings.weekStartsSunday");
  if (ui.weekstartToggle) {
    const span = ui.weekstartToggle.querySelector(".menu-item-label");
    if (span) {
      span.textContent = label;
    } else {
      ui.weekstartToggle.textContent = label;
    }
  }
  if (ui.mobileWeekstartToggle) {
    const span = ui.mobileWeekstartToggle.querySelector("span");
    if (span) span.textContent = label;
  }
}

function supportsBrowserNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

function updateNotificationToggleLabel() {
  let key = "settings.notificationsOff";
  if (!supportsBrowserNotifications()) {
    key = "settings.notificationsUnsupported";
  } else if (Notification.permission === "denied") {
    key = "settings.notificationsBlocked";
  } else if (isNotificationEnabled() && Notification.permission === "granted") {
    key = "settings.notificationsOn";
  }

  const label = t(key);
  if (ui.notifyToggle) {
    const span = ui.notifyToggle.querySelector(".menu-item-label");
    if (span) {
      span.textContent = label;
    } else {
      ui.notifyToggle.textContent = label;
    }
  }
  if (ui.mobileNotifyToggle) {
    const span = ui.mobileNotifyToggle.querySelector("span");
    if (span) span.textContent = label;
  }
}

function stopNotificationWatcher() {
  if (notificationTimer) {
    window.clearInterval(notificationTimer);
    notificationTimer = null;
  }
}

function pruneNotifiedOccurrences(nowMs) {
  const expiryMs = nowMs - NOTIFICATION_LEAD_MINUTES * MS_PER_MINUTE;
  for (const [key, startMs] of notifiedOccurrences.entries()) {
    if (startMs < expiryMs) {
      notifiedOccurrences.delete(key);
    }
  }
}

function showUpcomingEventNotification(occurrence) {
  if (!supportsBrowserNotifications() || Notification.permission !== "granted") return;
  const title = t("notify.upcomingTitle", { title: occurrence.title || "Untitled" });
  const timeLabel = formatTime(new Date(occurrence.start));
  const body = t("notify.upcomingBody", { time: timeLabel });
  const notification = new Notification(title, {
    body,
    tag: `hashcal-${occurrence.sourceIndex}-${occurrence.start}`,
  });

  notification.onclick = () => {
    window.focus();
    const eventDate = startOfDay(new Date(occurrence.start));
    selectedDate = eventDate;
    viewDate = eventDate;
    render();
    notification.close();
  };
}

function runNotificationCheck() {
  if (!supportsBrowserNotifications()) return;
  if (!isNotificationEnabled()) return;
  if (Notification.permission !== "granted") return;

  const nowMs = Date.now();
  const leadMs = NOTIFICATION_LEAD_MINUTES * MS_PER_MINUTE;
  const rangeStartMs = nowMs + leadMs - NOTIFICATION_CHECK_INTERVAL_MS;
  const rangeEndMs = nowMs + leadMs + NOTIFICATION_CHECK_INTERVAL_MS;

  pruneNotifiedOccurrences(nowMs);

  const occurrences = expandEvents(state.e || [], new Date(rangeStartMs), new Date(rangeEndMs));
  occurrences
    .filter((occ) => !occ.isAllDay && occ.start >= rangeStartMs && occ.start <= rangeEndMs)
    .forEach((occ) => {
      const key = `${occ.sourceIndex}:${occ.start}`;
      if (notifiedOccurrences.has(key)) return;
      notifiedOccurrences.set(key, occ.start);
      showUpcomingEventNotification(occ);
    });
}

function syncNotificationWatcher() {
  stopNotificationWatcher();
  if (!supportsBrowserNotifications()) return;
  if (!isNotificationEnabled()) return;
  if (Notification.permission !== "granted") return;

  runNotificationCheck();
  notificationTimer = window.setInterval(runNotificationCheck, NOTIFICATION_CHECK_INTERVAL_MS);
}

async function handleNotificationToggle() {
  if (!ensureEditable()) return;
  if (!supportsBrowserNotifications()) {
    showToast(t("settings.notificationsUnsupported"), "error");
    updateNotificationToggleLabel();
    return;
  }

  if (isNotificationEnabled()) {
    state.s.n = 0;
    stopNotificationWatcher();
    scheduleSave();
    updateNotificationToggleLabel();
    showToast(t("toast.notificationsDisabled"), "info");
    return;
  }

  if (Notification.permission === "denied") {
    showToast(t("toast.notificationsBlocked"), "error");
    updateNotificationToggleLabel();
    return;
  }

  let permission = Notification.permission;
  if (permission !== "granted") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    if (permission === "denied") showToast(t("toast.notificationsBlocked"), "error");
    updateNotificationToggleLabel();
    return;
  }

  state.s.n = 1;
  scheduleSave();
  updateNotificationToggleLabel();
  syncNotificationWatcher();
  showToast(t("toast.notificationsEnabled"), "success");
}

function updateFocusButton(isActive) {
  if (!ui.focusBtn) return;
  const active = typeof isActive === "boolean" ? isActive : focusMode && focusMode.isActive();
  const label = t(active ? "btn.exitFocus" : "btn.focus");
  const span = ui.focusBtn.querySelector(".menu-item-label");
  if (span) {
    span.textContent = label;
  } else {
    ui.focusBtn.textContent = label;
  }
  ui.focusBtn.setAttribute("aria-pressed", active ? "true" : "false");
}

function updateViewButtons() {
  if (ui.viewButtons && ui.viewButtons.length) {
    ui.viewButtons.forEach((button) => {
      const isActive = button.dataset.view === currentView;
      button.classList.toggle(CSS_CLASSES.ACTIVE, isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }
  let selectedViewLabel = "";
  if (ui.viewMenuOptions && ui.viewMenuOptions.length) {
    ui.viewMenuOptions.forEach((button) => {
      const isActive = button.dataset.view === currentView;
      button.classList.toggle(CSS_CLASSES.ACTIVE, isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      if (isActive) {
        selectedViewLabel = button.textContent.trim();
      }
    });
  }
  if (ui.viewSelect) {
    ui.viewSelect.value = currentView;
    const selected = ui.viewSelect.options[ui.viewSelect.selectedIndex];
    if (selected) {
      selectedViewLabel = selected.textContent.trim();
      ui.viewSelect.title = selected.textContent;
    }
  }
  if (!selectedViewLabel) {
    selectedViewLabel = t(`view.${currentView}`);
  }
  if (ui.viewMenuCurrent) {
    ui.viewMenuCurrent.textContent = selectedViewLabel;
  }
  if (ui.mobileDrawerViewButtons && ui.mobileDrawerViewButtons.length) {
    ui.mobileDrawerViewButtons.forEach((button) => {
      const isActive = button.dataset.view === currentView;
      button.classList.toggle(CSS_CLASSES.ACTIVE, isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }
}

function destroyTimelineMinimapSession() {
  if (!timelineMinimapSession) return;

  const {
    frameId,
    scrollHost,
    onScroll,
    onResize,
    minimapEl,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onKeyDown,
  } = timelineMinimapSession;

  if (frameId) window.cancelAnimationFrame(frameId);
  if (scrollHost && onScroll) scrollHost.removeEventListener("scroll", onScroll);
  if (onResize) window.removeEventListener("resize", onResize);

  if (minimapEl) {
    if (onPointerDown) minimapEl.removeEventListener("pointerdown", onPointerDown);
    if (onPointerMove) minimapEl.removeEventListener("pointermove", onPointerMove);
    if (onPointerUp) minimapEl.removeEventListener("pointerup", onPointerUp);
    if (onPointerCancel) minimapEl.removeEventListener("pointercancel", onPointerCancel);
    if (onKeyDown) minimapEl.removeEventListener("keydown", onKeyDown);
  }

  timelineMinimapSession = null;
}

function buildTimelineMinimapIntervals(occurrences, rangeStartMs, rangeEndMs) {
  const intervals = [];
  const minDurationMs = 20 * MS_PER_MINUTE;

  (occurrences || []).forEach((occ) => {
    const rawStart = Number(occ && occ.start);
    const rawEnd = Number(occ && occ.end);
    if (!Number.isFinite(rawStart)) return;

    const startMs = rawStart;
    const endMs = Number.isFinite(rawEnd) && rawEnd > startMs ? rawEnd : startMs + minDurationMs;
    const clippedStart = Math.max(startMs, rangeStartMs);
    const clippedEnd = Math.min(endMs, rangeEndMs);
    if (clippedEnd <= clippedStart) return;
    intervals.push([clippedStart, clippedEnd]);
  });

  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const merged = [];
  const mergeGapMs = 8 * MS_PER_MINUTE;

  intervals.forEach((interval) => {
    const previous = merged[merged.length - 1];
    if (!previous || interval[0] > previous[1] + mergeGapMs) {
      merged.push(interval);
      return;
    }
    previous[1] = Math.max(previous[1], interval[1]);
  });

  return merged;
}

function paintTimelineMinimapEvents(occurrences, rangeStartMs, rangeEndMs) {
  if (!ui.timelineMinimapEvents) return;

  ui.timelineMinimapEvents.innerHTML = "";
  const spanMs = Math.max(MS_PER_DAY, rangeEndMs - rangeStartMs);
  const intervals = buildTimelineMinimapIntervals(occurrences, rangeStartMs, rangeEndMs);
  const maxSegments = 600;
  const stride = intervals.length > maxSegments ? Math.ceil(intervals.length / maxSegments) : 1;

  for (let i = 0; i < intervals.length; i += stride) {
    const [startMs, endMs] = intervals[i];
    const leftPct = ((startMs - rangeStartMs) / spanMs) * 100;
    const widthPct = Math.max(((endMs - startMs) / spanMs) * 100, 0.1);

    const segment = document.createElement("span");
    segment.className = "timeline-minimap-segment";
    segment.style.left = `${leftPct}%`;
    segment.style.width = `${widthPct}%`;
    ui.timelineMinimapEvents.appendChild(segment);
  }
}

function syncTimelineMinimapUI() {
  if (!timelineMinimapSession) return;
  const session = timelineMinimapSession;
  const { scrollHost, minimapEl, rangeStartMs, rangeEndMs } = session;
  if (!scrollHost || !minimapEl) return;
  if (!ui.timelineMinimapViewport || !ui.timelineMinimapToday || !ui.timelineMinimapSelected) return;

  const spanMs = Math.max(MS_PER_DAY, rangeEndMs - rangeStartMs);
  const todayRatio = clamp((startOfDay(new Date()).getTime() - rangeStartMs) / spanMs, 0, 1);
  const selectedRatio = clamp((startOfDay(selectedDate).getTime() - rangeStartMs) / spanMs, 0, 1);

  ui.timelineMinimapToday.style.left = `${todayRatio * 100}%`;
  ui.timelineMinimapSelected.style.left = `${selectedRatio * 100}%`;

  const widthRatio = scrollHost.scrollWidth > 0 ? scrollHost.clientWidth / scrollHost.scrollWidth : 1;
  const widthPct = clamp(widthRatio * 100, 6, 100);
  const leftPct = scrollHost.scrollWidth > 0 ? (scrollHost.scrollLeft / scrollHost.scrollWidth) * 100 : 0;

  ui.timelineMinimapViewport.style.width = `${widthPct}%`;
  ui.timelineMinimapViewport.style.left = `${clamp(leftPct, 0, 100 - widthPct)}%`;

  const centerRatio = clamp((scrollHost.scrollLeft + scrollHost.clientWidth * 0.5) / Math.max(1, scrollHost.scrollWidth), 0, 1);
  minimapEl.setAttribute("aria-valuemin", "0");
  minimapEl.setAttribute("aria-valuemax", "100");
  minimapEl.setAttribute("aria-valuenow", String(Math.round(centerRatio * 100)));
  minimapEl.setAttribute("aria-valuetext", `${Math.round(centerRatio * 100)}% through timeline`);
}

function initTimelineMinimap({ occurrences = [], range, scrollHost } = {}) {
  if (
    !ui.timelineMinimap ||
    !ui.timelineMinimapEvents ||
    !ui.timelineMinimapToday ||
    !ui.timelineMinimapSelected ||
    !ui.timelineMinimapViewport ||
    !scrollHost ||
    !range ||
    !isValidDate(range.start) ||
    !isValidDate(range.end)
  ) {
    destroyTimelineMinimapSession();
    return;
  }

  destroyTimelineMinimapSession();

  const rangeStartMs = startOfDay(range.start).getTime();
  const rangeEndMs = endOfDay(range.end).getTime() + MS_PER_DAY;
  const minimapEl = ui.timelineMinimap;

  paintTimelineMinimapEvents(occurrences, rangeStartMs, rangeEndMs);

  const moveTimelineFromClientX = (clientX, { syncSelected = false } = {}) => {
    const rect = minimapEl.getBoundingClientRect();
    if (!rect.width) return;

    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const targetLeft = scrollHost.scrollWidth * ratio - scrollHost.clientWidth * 0.5;
    const maxLeft = Math.max(0, scrollHost.scrollWidth - scrollHost.clientWidth);
    scrollHost.scrollLeft = clamp(targetLeft, 0, maxLeft);

    if (syncSelected) {
      const selectedMs = rangeStartMs + ratio * Math.max(MS_PER_DAY, rangeEndMs - rangeStartMs);
      handleSelectDay(new Date(selectedMs));
    }
  };

  const session = {
    minimapEl,
    scrollHost,
    rangeStartMs,
    rangeEndMs,
    frameId: 0,
    pointerId: null,
    isDragging: false,
  };

  const scheduleSync = () => {
    if (!timelineMinimapSession) return;
    if (timelineMinimapSession.frameId) return;

    timelineMinimapSession.frameId = window.requestAnimationFrame(() => {
      if (!timelineMinimapSession) return;
      timelineMinimapSession.frameId = 0;
      syncTimelineMinimapUI();
    });
  };

  session.onScroll = () => scheduleSync();
  session.onResize = () => scheduleSync();

  session.onPointerDown = (event) => {
    if (event.button !== 0 && event.pointerType !== "touch" && event.pointerType !== "pen") return;
    event.preventDefault();

    session.isDragging = true;
    session.pointerId = event.pointerId;
    if (typeof minimapEl.setPointerCapture === "function") {
      minimapEl.setPointerCapture(event.pointerId);
    }

    moveTimelineFromClientX(event.clientX, { syncSelected: true });
    scheduleSync();
  };

  session.onPointerMove = (event) => {
    if (!session.isDragging || event.pointerId !== session.pointerId) return;
    moveTimelineFromClientX(event.clientX);
    scheduleSync();
  };

  const stopDragging = (event, syncSelected) => {
    if (!session.isDragging || event.pointerId !== session.pointerId) return;
    if (syncSelected) moveTimelineFromClientX(event.clientX, { syncSelected: true });

    session.isDragging = false;
    session.pointerId = null;

    if (typeof minimapEl.releasePointerCapture === "function") {
      try {
        minimapEl.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // Ignore if pointer was already released.
      }
    }

    scheduleSync();
  };

  session.onPointerUp = (event) => stopDragging(event, true);
  session.onPointerCancel = (event) => stopDragging(event, false);

  session.onKeyDown = (event) => {
    const step = Math.max(32, Math.round(scrollHost.clientWidth * 0.24));
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollHost.scrollLeft -= step;
      scheduleSync();
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollHost.scrollLeft += step;
      scheduleSync();
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      scrollHost.scrollLeft = 0;
      scheduleSync();
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      scrollHost.scrollLeft = scrollHost.scrollWidth;
      scheduleSync();
    }
  };

  scrollHost.addEventListener("scroll", session.onScroll, { passive: true });
  window.addEventListener("resize", session.onResize);
  minimapEl.addEventListener("pointerdown", session.onPointerDown);
  minimapEl.addEventListener("pointermove", session.onPointerMove);
  minimapEl.addEventListener("pointerup", session.onPointerUp);
  minimapEl.addEventListener("pointercancel", session.onPointerCancel);
  minimapEl.addEventListener("keydown", session.onKeyDown);

  timelineMinimapSession = session;
  syncTimelineMinimapUI();
}

function getTimelineRange() {
  const zoomKey = (TIMELINE_ZOOM_LEVELS[timelineZoomLevel] || TIMELINE_ZOOM_LEVELS[DEFAULT_TIMELINE_ZOOM_LEVEL]).key;
  const baseWindowDays = zoomKey === "minute" ? 3 : zoomKey === "hour" ? 14 : zoomKey === "day" ? 45 : zoomKey === "week" ? 90 : 180;
  const recurringWindowDays = zoomKey === "minute" ? 14 : zoomKey === "hour" ? 45 : zoomKey === "day" ? 120 : zoomKey === "week" ? 240 : TIMELINE_RECURRING_WINDOW_DAYS;
  const maxSpanDays = zoomKey === "minute" ? 10 : zoomKey === "hour" ? 30 : zoomKey === "day" ? 120 : zoomKey === "week" ? 365 : 900;

  const selectedMs = startOfDay(selectedDate).getTime();
  let minStart = selectedMs - baseWindowDays * MS_PER_DAY;
  let maxEnd = selectedMs + baseWindowDays * MS_PER_DAY;
  let hasRecurring = false;

  (state.e || []).forEach((entry) => {
    if (!Array.isArray(entry)) return;
    const startMin = Number(entry[0]);
    if (!Number.isFinite(startMin)) return;
    const startMs = startMin * MS_PER_MINUTE;
    const durationMin = Math.max(0, Number(entry[1]) || 0);
    const endMs = durationMin > 0 ? startMs + durationMin * MS_PER_MINUTE : startMs + 12 * 60 * MS_PER_MINUTE;
    minStart = Math.min(minStart, startMs);
    maxEnd = Math.max(maxEnd, endMs);
    if (["d", "w", "m", "y"].includes(entry[4])) hasRecurring = true;
  });

  if (hasRecurring) {
    minStart = Math.min(minStart, selectedMs - recurringWindowDays * MS_PER_DAY);
    maxEnd = Math.max(maxEnd, selectedMs + recurringWindowDays * MS_PER_DAY);
  }

  const spanDays = (maxEnd - minStart) / MS_PER_DAY;
  if (spanDays > maxSpanDays) {
    const halfSpan = (maxSpanDays * MS_PER_DAY) / 2;
    minStart = selectedMs - halfSpan;
    maxEnd = selectedMs + halfSpan;
  }

  const start = startOfDay(new Date(minStart - TIMELINE_PADDING_DAYS * MS_PER_DAY));
  const end = endOfDay(new Date(maxEnd + TIMELINE_PADDING_DAYS * MS_PER_DAY));
  return { start, end };
}

function getTimelineDayWidth() {
  const level = TIMELINE_ZOOM_LEVELS[timelineZoomLevel] || TIMELINE_ZOOM_LEVELS[DEFAULT_TIMELINE_ZOOM_LEVEL];
  return level.dayWidth;
}

function getTimelineZoomLabel(levelIndex = timelineZoomLevel) {
  const level = TIMELINE_ZOOM_LEVELS[levelIndex] || TIMELINE_ZOOM_LEVELS[DEFAULT_TIMELINE_ZOOM_LEVEL];
  if (level.key === "month") return t("view.month");
  if (level.key === "week") return t("view.week");
  if (level.key === "day") return t("view.day");
  if (level.key === "hour") return "Hour";
  return "Minute";
}

function updateTimelineControlsVisibility() {
  const show = currentView === "timeline";
  if (ui.timelineControls) {
    ui.timelineControls.classList.toggle(CSS_CLASSES.HIDDEN, !show);
  }
  if (ui.timelineZoomRange) {
    ui.timelineZoomRange.min = "0";
    ui.timelineZoomRange.max = String(TIMELINE_ZOOM_LEVELS.length - 1);
    ui.timelineZoomRange.step = "1";
    ui.timelineZoomRange.value = String(timelineZoomLevel);
  }
  if (ui.timelineZoomValue) {
    ui.timelineZoomValue.textContent = getTimelineZoomLabel();
  }
}

function getTimelineAnchorDate(anchorRatio = 0.5) {
  if (!timelineViewData || !timelineViewData.scrollHost || !timelineViewData.range) {
    return startOfDay(selectedDate);
  }

  const scrollHost = timelineViewData.scrollHost;
  if (!scrollHost.clientWidth) return startOfDay(selectedDate);
  const ratio = clamp(anchorRatio, 0, 1);
  const offsetDays = (scrollHost.scrollLeft + scrollHost.clientWidth * ratio) / getTimelineDayWidth();
  const anchorMs = timelineViewData.range.start.getTime() + offsetDays * MS_PER_DAY;
  return new Date(anchorMs);
}

function applyTimelineZoom(nextLevel, { anchorRatio = 0.5 } = {}) {
  const rawLevel = Number(nextLevel);
  if (!Number.isFinite(rawLevel)) return;
  const clampedLevel = clamp(Math.round(rawLevel), 0, TIMELINE_ZOOM_LEVELS.length - 1);
  if (clampedLevel === timelineZoomLevel) return;

  if (currentView === "timeline") {
    timelinePendingAnchorDate = getTimelineAnchorDate(anchorRatio);
  }

  timelineZoomLevel = clampedLevel;
  if (ui.timelineZoomRange) ui.timelineZoomRange.value = String(timelineZoomLevel);
  if (ui.timelineZoomValue) ui.timelineZoomValue.textContent = getTimelineZoomLabel();
  if (currentView === "timeline") render();
}

function handleTimelineZoomStep(direction, anchorRatio = 0.5) {
  const delta = direction > 0 ? 1 : -1;
  applyTimelineZoom(timelineZoomLevel + delta, { anchorRatio });
}

function handleTimelineZoomInput(event) {
  const value = Number(event && event.target ? event.target.value : NaN);
  if (!Number.isFinite(value)) return;
  applyTimelineZoom(Math.round(value), { anchorRatio: 0.5 });
}

function handleTimelineJumpToday() {
  const today = startOfDay(new Date());
  selectedDate = today;
  viewDate = today;
  renderEventList();
  if (timelineViewData && timelineViewData.setSelectedDate) {
    timelineViewData.setSelectedDate(today);
  }
  if (timelineViewData && timelineViewData.centerOnDate) {
    timelineViewData.centerOnDate(today, { behavior: "smooth" });
    timelineNeedsCenter = false;
  } else {
    timelineNeedsCenter = true;
  }
  syncTimelineMinimapUI();
}

function getTimelineShiftDays() {
  const level = TIMELINE_ZOOM_LEVELS[timelineZoomLevel] || TIMELINE_ZOOM_LEVELS[DEFAULT_TIMELINE_ZOOM_LEVEL];
  if (level.key === "minute") return 1;
  if (level.key === "hour") return 7;
  if (level.key === "day") return 14;
  if (level.key === "week") return 30;
  return 60;
}

function setView(view) {
  if (!VALID_VIEWS.has(view)) return;
  if (currentView === view) return;
  if (view === "timeline") {
    timelineNeedsCenter = true;
  } else {
    timelinePendingAnchorDate = null;
    timelineViewData = null;
    destroyTimelineMinimapSession();
  }

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
    const lockLabel = lockState.encrypted ? t(isLocked ? "btn.unlock" : "btn.removeLock") : t("btn.lock");
    const lockIconClass = lockState.encrypted && isLocked ? "fa-lock-open" : "fa-lock";
    if (ui.lockBtn.dataset.iconOnly === "true") {
      ui.lockBtn.innerHTML = `<i class="fa-solid ${lockIconClass}" aria-hidden="true"></i>`;
      ui.lockBtn.setAttribute("aria-label", lockLabel);
      ui.lockBtn.title = lockLabel;
    } else {
      ui.lockBtn.textContent = lockLabel;
    }
  }

  if (ui.readOnlyBtn) {
    const readOnlyLabel = t(isReadOnly ? "btn.editMode" : "btn.readOnly");
    const readOnlyIconClass = isReadOnly ? "fa-eye-slash" : "fa-eye";
    if (ui.readOnlyBtn.dataset.iconOnly === "true") {
      ui.readOnlyBtn.innerHTML = `<i class="fa-solid ${readOnlyIconClass}" aria-hidden="true"></i>`;
      ui.readOnlyBtn.setAttribute("aria-label", readOnlyLabel);
      ui.readOnlyBtn.title = readOnlyLabel;
    } else {
      ui.readOnlyBtn.textContent = readOnlyLabel;
    }
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
    ui.notifyToggle,
    ui.mobileNotifyToggle,
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
  updateViewButtons();
  renderTemplateGallery();
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
  updateNotificationToggleLabel();
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
  updateTimelineControlsVisibility();
  if (currentView !== "timeline") {
    timelineViewData = null;
    timelinePendingAnchorDate = null;
    destroyTimelineMinimapSession();
  }
  if (ui.weekdayRow) {
    ui.weekdayRow.classList.toggle(CSS_CLASSES.HIDDEN, currentView === "year" || currentView === "agenda" || currentView === "timeline");
  }

  if (currentView === "month") {
    const range = getMonthGridRange(viewDate, weekStartsOnMonday);
    const expanded = expandEvents(state.e, range.start, range.end);
    const decorated = decorateOccurrences(expanded);
    occurrencesByDay = groupOccurrences(decorated);

    setCalendarHeaderLabel(formatMonthLabel(viewDate));
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

    setCalendarHeaderLabel(formatRangeLabel(range.start, range.end));
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

    setCalendarHeaderLabel(formatDateLabel(selectedDate));
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
    if (agendaData && agendaData.range) {
      setCalendarHeaderLabel(t("agenda.title") + " - " + formatRangeLabel(agendaData.range.start, agendaData.range.end));
    }
  } else if (currentView === "timeline") {
    const range = getTimelineRange();
    const expanded = expandEvents(state.e, range.start, range.end);
    const decorated = decorateOccurrences(expanded);
    occurrencesByDay = groupOccurrences(decorated);

    setCalendarHeaderLabel(`${t("view.timeline")} - ${formatRangeLabel(range.start, range.end)}`);
    if (ui.calendarGrid) {
      timelineViewData = renderTimelineView({
        container: ui.calendarGrid,
        occurrences: decorated,
        rangeStart: range.start,
        rangeEnd: range.end,
        selectedDate,
        dayWidth: getTimelineDayWidth(),
        locale: getCurrentLocale(),
        allDayLabel: t("calendar.allDay"),
        emptyLabel: t("calendar.noUpcoming"),
        onSelectDay: handleSelectDay,
        onZoomRequest: (direction, anchorRatio) => handleTimelineZoomStep(direction, anchorRatio),
        onEventClick: (event) => {
          selectedDate = startOfDay(new Date(event.start));
          viewDate = selectedDate;
          renderEventList();
          openEventModal({ index: event.sourceIndex });
        },
      });

      initTimelineMinimap({
        occurrences: decorated,
        range: timelineViewData && timelineViewData.range ? timelineViewData.range : range,
        scrollHost: timelineViewData ? timelineViewData.scrollHost : null,
      });

      if (timelinePendingAnchorDate && timelineViewData.centerOnDate) {
        timelineViewData.centerOnDate(timelinePendingAnchorDate, { behavior: "auto" });
        timelinePendingAnchorDate = null;
        timelineNeedsCenter = false;
      } else if (timelineNeedsCenter && timelineViewData.centerOnDate) {
        timelineViewData.centerOnDate(selectedDate, { behavior: "auto" });
        timelineNeedsCenter = false;
      } else if (timelineViewData.setSelectedDate) {
        timelineViewData.setSelectedDate(selectedDate);
      }
    }
  } else if (currentView === "year") {
    const year = viewDate.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);
    const expanded = expandEvents(state.e, start, end);
    const decorated = decorateOccurrences(expanded);
    occurrencesByDay = groupOccurrences(decorated);

    setCalendarHeaderLabel(String(year));
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
    const cells = ui.calendarGrid.querySelectorAll(".day-cell, .time-cell, .mini-month, .agenda-event-item, .timeline-event");
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
  if (currentView === "timeline") {
    viewDate = startOfDay(date);
    if (timelineViewData && timelineViewData.setSelectedDate) {
      timelineViewData.setSelectedDate(selectedDate);
    }
    renderEventList();
    syncTimelineMinimapUI();
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

  const endDate = new Date(startDate.getTime() + (duration || DEFAULT_EVENT_DURATION) * MS_PER_MINUTE);

  ui.eventTitle.value = title;
  ui.eventDate.value = formatDateKey(startDate);
  ui.eventTime.value = startDate.toTimeString().slice(0, 5);
  ui.eventEndDate.value = formatDateKey(endDate);
  ui.eventEndTime.value = endDate.toTimeString().slice(0, 5);
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
  if (!ui.eventTime || !ui.eventDuration || !ui.eventEndDate || !ui.eventEndTime) return;
  ui.eventTime.disabled = allDay;
  ui.eventEndDate.disabled = allDay;
  ui.eventEndTime.disabled = allDay;
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
  
  let duration = 0;
  if (!allDay) {
    const endDateValue = ui.eventEndDate.value;
    const [endYear, endMonth, endDay] = endDateValue.split("-").map(Number);
    const [endHours, endMinutes] = ui.eventEndTime.value.split(":").map(Number);
    const endDate = new Date(endYear, endMonth - 1, endDay, endHours, endMinutes);
    duration = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_MINUTE));
  }
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
  if (!passwordModalController) return Promise.resolve(null);
  return passwordModalController.open({ mode, title, description, submitLabel });
}

function closePasswordModal() {
  if (!passwordModalController) return;
  passwordModalController.close();
}

function submitPassword() {
  if (!passwordModalController) return;
  passwordModalController.submit();
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
    syncNotificationWatcher();
    await importEventsFromPath();
    render();
    showToast(t("toast.calendarUnlocked"), "success");
  } catch (error) {
    showToast(t("toast.incorrectPassword"), "error");
    lockState = { encrypted: true, unlocked: false };
    updateLockUI();
    syncNotificationWatcher();
  }
}

async function loadStateFromHash() {
  if (!window.location.hash || getCreationHashPath()) {
    state = cloneState(DEFAULT_STATE);
    // Initialize language from local storage if no hash
    state.s.l = getCurrentLanguage();
    applyStoredView();
    syncNotificationWatcher();
    return;
  }

  if (isEncryptedHash()) {
    lockState = { encrypted: true, unlocked: false };
    state = cloneState(DEFAULT_STATE);
    updateLockUI();
    syncNotificationWatcher();
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
  syncNotificationWatcher();
}

async function importEventsFromPath() {
  return importEventsFromPathFromLocation({
    parsePathToEventEntries,
    isCalendarLocked,
    isReadOnlyMode,
    onEntriesImported: (entries) => {
      state.e.push(...entries);
    },
    onFirstEntryImported: (firstStartMin) => {
      const firstDate = startOfDay(new Date(firstStartMin * MS_PER_MINUTE));
      selectedDate = firstDate;
      viewDate = firstDate;
    },
    clearPendingSave,
    persistStateToHash,
  });
}

function handleHashChange() {
  loadStateFromHash().then(() => {
    importEventsFromPath().then(() => {
      render();
    });
  });
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
  } else if (currentView === "timeline") {
    selectedDate = addDays(selectedDate, direction * getTimelineShiftDays());
    viewDate = startOfDay(selectedDate);
    timelineNeedsCenter = true;
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
  if (currentView === "timeline") timelineNeedsCenter = true;
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
  if (!jsonModalController) return;
  jsonModalController.update();
}

function openJsonModal() {
  if (!jsonModalController) return;
  jsonModalController.open();
}

function closeJsonModal() {
  if (!jsonModalController) return;
  jsonModalController.close();
}

function renderTemplateGallery() {
  if (!templateGalleryController) return;
  templateGalleryController.render();
}

async function loadTemplateGalleryLinks() {
  if (!templateGalleryController) return;
  await templateGalleryController.loadLinks();
}

function openTemplateModal() {
  if (!templateGalleryController) return;
  templateGalleryController.openModal();
}

function closeTemplateModal() {
  if (!templateGalleryController) return;
  templateGalleryController.closeModal();
}

function isOpenModalElement(element) {
  return !!(element && !element.classList.contains(CSS_CLASSES.HIDDEN));
}

function isOpenDialogElement(element) {
  return !!(element && element.hasAttribute("open"));
}

function handleGlobalEscape(event) {
  if (event.key !== "Escape") return;

  // Focus overlay handles its own Escape behavior.
  if (focusMode && focusMode.isActive()) return;

  if (isOpenModalElement(ui.eventModal)) {
    event.preventDefault();
    closeEventModal();
    return;
  }

  if (isOpenModalElement(ui.passwordModal)) {
    event.preventDefault();
    closePasswordModal();
    return;
  }

  if (isOpenModalElement(ui.jsonModal)) {
    event.preventDefault();
    closeJsonModal();
    return;
  }

  if (isOpenModalElement(ui.templateModal)) {
    event.preventDefault();
    closeTemplateModal();
    return;
  }

  if (isOpenDialogElement(ui.tzModal)) {
    event.preventDefault();
    closeTzModal();
    return;
  }

  if (worldPlanner && typeof worldPlanner.isOpen === "function" && worldPlanner.isOpen()) {
    event.preventDefault();
    worldPlanner.close();
    return;
  }

  const qrModal = document.getElementById("qr-modal");
  if (isOpenModalElement(qrModal) && qrManager && typeof qrManager.hide === "function") {
    event.preventDefault();
    qrManager.hide();
  }
}

function handleTemplateLinkClick(event) {
  if (!templateGalleryController) return;
  templateGalleryController.handleLinkClick(event);
}

async function handleCopyJson() {
  if (!jsonModalController) return;
  await jsonModalController.copyJson();
}

async function handleCopyHash() {
  if (!jsonModalController) return;
  await jsonModalController.copyHash();
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

function getEventStartDateTime() {
  const [year, month, day] = ui.eventDate.value.split("-").map(Number);
  const [hours, minutes] = ui.eventTime.value.split(":").map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0);
}

function getEventEndDateTime() {
  const [year, month, day] = ui.eventEndDate.value.split("-").map(Number);
  const [hours, minutes] = ui.eventEndTime.value.split(":").map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0);
}

function updateEndFromStart() {
  const start = getEventStartDateTime();
  const duration = Number(ui.eventDuration.value) || 0;
  const end = new Date(start.getTime() + duration * MS_PER_MINUTE);
  ui.eventEndDate.value = formatDateKey(end);
  ui.eventEndTime.value = end.toTimeString().slice(0, 5);
}

function updateDurationFromEnd() {
  const start = getEventStartDateTime();
  const end = getEventEndDateTime();
  const duration = Math.max(0, Math.floor((end.getTime() - start.getTime()) / MS_PER_MINUTE));
  ui.eventDuration.value = String(duration);
}

function updateEndFromDuration() {
  const start = getEventStartDateTime();
  const duration = Number(ui.eventDuration.value) || 0;
  const end = new Date(start.getTime() + duration * MS_PER_MINUTE);
  ui.eventEndDate.value = formatDateKey(end);
  ui.eventEndTime.value = end.toTimeString().slice(0, 5);
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
  if (ui.viewMenuOptions && ui.viewMenuOptions.length) {
    ui.viewMenuOptions.forEach((button) => {
      button.addEventListener("click", () => {
        setView(button.dataset.view);
        if (ui.viewMenu) ui.viewMenu.open = false;
      });
    });
  }
  if (ui.viewSelect) {
    ui.viewSelect.addEventListener("change", (event) => {
      setView(event.target.value);
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
  if (ui.notifyToggle) ui.notifyToggle.addEventListener("click", handleNotificationToggle);
  if (ui.timelineZoomOut) ui.timelineZoomOut.addEventListener("click", () => handleTimelineZoomStep(-1));
  if (ui.timelineZoomIn) ui.timelineZoomIn.addEventListener("click", () => handleTimelineZoomStep(1));
  if (ui.timelineZoomRange) ui.timelineZoomRange.addEventListener("input", handleTimelineZoomInput);
  if (ui.timelineJumpToday) ui.timelineJumpToday.addEventListener("click", handleTimelineJumpToday);
  initLanguageDropdown();
  if (ui.unlockBtn) ui.unlockBtn.addEventListener("click", attemptUnlock);
  if (ui.viewJson) ui.viewJson.addEventListener("click", openJsonModal);
  if (ui.exportJson) ui.exportJson.addEventListener("click", handleExportJson);
  if (ui.importIcs) ui.importIcs.addEventListener("click", handleImportIcsClick);
  if (ui.templateGalleryBtn) ui.templateGalleryBtn.addEventListener("click", openTemplateModal);
  if (ui.icsInput) ui.icsInput.addEventListener("change", handleIcsFile);
  if (ui.clearAll) ui.clearAll.addEventListener("click", handleClearAll);

  if (ui.eventClose) ui.eventClose.addEventListener("click", closeEventModal);
  if (ui.eventCancel) ui.eventCancel.addEventListener("click", closeEventModal);
  if (ui.eventDelete) ui.eventDelete.addEventListener("click", deleteEvent);
  if (ui.eventForm) ui.eventForm.addEventListener("submit", saveEvent);
  if (ui.eventAllDay) ui.eventAllDay.addEventListener("change", (e) => toggleAllDay(e.target.checked));
  
  // Event Sync Listeners
  if (ui.eventDate) ui.eventDate.addEventListener("change", updateEndFromStart);
  if (ui.eventTime) ui.eventTime.addEventListener("change", updateEndFromStart);
  if (ui.eventEndDate) ui.eventEndDate.addEventListener("change", updateDurationFromEnd);
  if (ui.eventEndTime) ui.eventEndTime.addEventListener("change", updateDurationFromEnd);
  if (ui.eventDuration) ui.eventDuration.addEventListener("input", updateEndFromDuration);

  if (ui.passwordClose) ui.passwordClose.addEventListener("click", closePasswordModal);
  if (ui.passwordCancel) ui.passwordCancel.addEventListener("click", closePasswordModal);
  if (ui.passwordSubmit) ui.passwordSubmit.addEventListener("click", submitPassword);
  if (ui.jsonClose) ui.jsonClose.addEventListener("click", closeJsonModal);
  if (ui.jsonCopy) ui.jsonCopy.addEventListener("click", handleCopyJson);
  if (ui.jsonCopyHash) ui.jsonCopyHash.addEventListener("click", handleCopyHash);
  if (ui.jsonDownload) ui.jsonDownload.addEventListener("click", handleExportJson);
  if (ui.templateClose) ui.templateClose.addEventListener("click", closeTemplateModal);
  if (ui.templateCancel) ui.templateCancel.addEventListener("click", closeTemplateModal);
  if (ui.templateLinks) ui.templateLinks.addEventListener("click", handleTemplateLinkClick);
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
  if (ui.templateModal) {
    ui.templateModal.addEventListener("click", (event) => {
      if (event.target === ui.templateModal || event.target.classList.contains("modal-backdrop")) {
        closeTemplateModal();
      }
    });
  }

  window.addEventListener("hashchange", handleHashChange);
  window.addEventListener("resize", syncTopbarHeight);
  document.addEventListener("keydown", handleGlobalEscape);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    updateNotificationToggleLabel();
    runNotificationCheck();
  });
}

function openMobileDrawer() {
  if (!responsiveFeaturesController) return;
  responsiveFeaturesController.openMobileDrawer();
}

function closeMobileDrawer() {
  if (!responsiveFeaturesController) return;
  responsiveFeaturesController.closeMobileDrawer();
}

function initResponsiveFeatures() {
  if (!responsiveFeaturesController) return;
  responsiveFeaturesController.init({
    getSelectedDate: () => selectedDate,
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
    openWorldPlanner: () => {
      if (worldPlanner) worldPlanner.open();
    },
  });
}

async function init() {
  setAppReady(false);
  cacheElements(ui);
  responsiveFeaturesController = createResponsiveFeaturesController({
    ui,
    cssClasses: CSS_CLASSES,
    t,
  });
  syncTopbarHeight();
  templateGalleryController = createTemplateGalleryController({
    ui,
    hiddenClass: CSS_CLASSES.HIDDEN,
    t,
  });
  await loadTemplateGalleryLinks();
  passwordModalController = createPasswordModalController({
    ui,
    hiddenClass: CSS_CLASSES.HIDDEN,
    t,
  });
  jsonModalController = createJsonModalController({
    ui,
    hiddenClass: CSS_CLASSES.HIDDEN,
    t,
    showToast,
    getState: () => state,
    getHash: () => window.location.hash || "",
  });
  saveManager = new StateSaveManager({
    getLockState: () => lockState,
    hasStoredData,
    clearHash,
    writeStateToHash,
    getState: () => state,
    getPassword: () => password,
    updateUrlLength,
    onAfterPersist: () => {
      if (jsonModalController && jsonModalController.isOpen()) {
        jsonModalController.update();
      }
    },
    debounceMs: DEBOUNCE_MS,
  });
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
  if (!worldPlanner) {
    worldPlanner = new WorldPlanner({
      getState: () => state,
      updateState: (key, val) => {
        state[key] = val;
        scheduleSave();
        renderTimezones(); // Sync with Sidebar
        render(); // Sync with any main calendar updates
      },
      ensureEditable,
      scheduleSave,
      showToast,
      closeMobileDrawer: () => {
        if (ui.mobileDrawer) ui.mobileDrawer.classList.remove(CSS_CLASSES.IS_ACTIVE);
        if (ui.mobileDrawerBackdrop) ui.mobileDrawerBackdrop.classList.remove(CSS_CLASSES.IS_ACTIVE);
      },
      openEventModal,
    });
  }
  bindEvents();
  initResponsiveFeatures();
  await loadStateFromHash();
  await importEventsFromPath();
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

  setAppReady(true);
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

