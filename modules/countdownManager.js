import { expandEvents } from "./recurrenceEngine.js";
import { t, getCurrentLocale } from "./i18n.js";

const LOOKAHEAD_DAYS = 30;
const URGENCY_MS = 5 * 60 * 1000;

let countdownInterval = null;
let latestEvents = [];
let cachedElements = null;
let lastEventKey = null;

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(date) {
  return date.toLocaleTimeString(getCurrentLocale(), { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(date) {
  return date.toLocaleDateString(getCurrentLocale(), { weekday: "short", month: "short", day: "numeric" });
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (value) => String(value).padStart(2, "0");

  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatMeta(event, now) {
  if (!event) return "";
  const startDate = event.startDate || new Date(event.start);
  if (event.isAllDay) {
    if (isSameDay(startDate, now)) return t("calendar.allDay");
    return `${t("calendar.allDay")} ${formatDateLabel(startDate)}`;
  }

  const timeLabel = formatTime(startDate);
  if (isSameDay(startDate, now)) {
    return t("countdown.startsAt", { time: timeLabel });
  }
  return t("countdown.starts", { date: formatDateLabel(startDate), time: timeLabel });
}

function getElements() {
  if (cachedElements && cachedElements.widget && document.body.contains(cachedElements.widget)) {
    return cachedElements;
  }
  const widget = document.getElementById("countdown-widget");
  if (!widget) return null;

  cachedElements = {
    widget,
    titleEl: document.getElementById("nextEventTitle"),
    timerEl: document.getElementById("countdownTimer"),
    metaEl: document.getElementById("nextEventTime"),
  };

  return cachedElements;
}

function findNextEvent(events) {
  const now = new Date();
  const lookAheadEnd = addDays(now, LOOKAHEAD_DAYS);
  const expanded = expandEvents(events, now, lookAheadEnd);

  const upcoming = expanded
    .filter((event) => event.start > now.getTime())
    .map((event) => ({
      ...event,
      title: String(event.title || "Untitled"),
      startDate: new Date(event.start),
      endDate: new Date(event.end),
    }))
    .sort((a, b) => {
      const diff = a.start - b.start;
      if (diff !== 0) return diff;
      return a.title.localeCompare(b.title);
    });

  return upcoming.length ? upcoming[0] : null;
}

function updateWidgetUI(event) {
  const elements = getElements();
  if (!elements) return;

  const { widget, titleEl, timerEl, metaEl } = elements;
  if (countdownInterval) {
    window.clearInterval(countdownInterval);
    countdownInterval = null;
  }

  widget.classList.remove("urgent");
  widget.classList.remove("inactive");
  widget.classList.remove("hidden");

  if (!event) {
    widget.classList.add("hidden");
    if (titleEl) titleEl.textContent = "--";
    if (timerEl) timerEl.textContent = "00:00:00";
    if (metaEl) metaEl.textContent = "--";
    return;
  }

  if (titleEl) titleEl.textContent = event.title || "Untitled";
  if (metaEl) metaEl.textContent = formatMeta(event, new Date());

  const tick = () => {
    const now = new Date();
    const diff = event.start - now.getTime();

    if (diff <= 0) {
      initCountdownWidget(latestEvents);
      return;
    }

    if (timerEl) timerEl.textContent = formatDuration(diff);
    if (metaEl) metaEl.textContent = formatMeta(event, now);

    if (diff < URGENCY_MS) {
      widget.classList.add("urgent");
    } else {
      widget.classList.remove("urgent");
    }
  };

  tick();
  countdownInterval = window.setInterval(tick, 1000);
}

export function initCountdownWidget(events = []) {
  latestEvents = Array.isArray(events) ? events : [];
  const nextEvent = findNextEvent(latestEvents);
  const eventKey = nextEvent ? `${nextEvent.start}|${nextEvent.title}|${nextEvent.isAllDay ? 1 : 0}` : "none";

  if (eventKey === lastEventKey) return;
  lastEventKey = eventKey;
  updateWidgetUI(nextEvent);
}
