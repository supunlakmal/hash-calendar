import { expandEvents } from "./recurrenceEngine.js";
import { t, getCurrentLocale } from "./i18n.js";

const MAX_UP_NEXT = 2;

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

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(date) {
  return date.toLocaleTimeString(getCurrentLocale(), { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(date) {
  return date.toLocaleDateString(getCurrentLocale(), { weekday: "short", month: "short", day: "numeric" });
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hoursLabel = String(hours).padStart(2, "0");
  const minutesLabel = String(minutes).padStart(2, "0");
  const secondsLabel = String(seconds).padStart(2, "0");
  return `${hoursLabel}:${minutesLabel}:${secondsLabel}`;
}

function formatEventTime(event, now) {
  if (!event) return "";
  const dateLabel = isSameDay(event.startDate, now) ? "" : `${formatDateLabel(event.startDate)} | `;
  if (event.isAllDay) {
    return `${dateLabel}${t("calendar.allDay")}`.trim();
  }
  return `${dateLabel}${formatTime(event.startDate)} - ${formatTime(event.endDate)}`.trim();
}

function formatUpNextLabel(event, now) {
  const dateLabel = isSameDay(event.startDate, now) ? "" : `${formatDateLabel(event.startDate)} `;
  const timeLabel = event.isAllDay ? t("calendar.allDay") : formatTime(event.startDate);
  return `${dateLabel}${timeLabel}`.trim();
}

function getToneForDiff(diffMs) {
  const minutes = diffMs / 60000;
  if (minutes < 2) return "urgent";
  if (minutes < 10) return "warn";
  if (minutes > 30) return "good";
  return "neutral";
}

export class FocusMode {
  constructor({ getState, fallbackColors = [], onToggle = null } = {}) {
    this.getState = getState;
    this.fallbackColors = fallbackColors;
    this.onToggle = onToggle;
    this.active = false;
    this.intervalId = null;

    this.container = document.getElementById("focus-overlay");
    this.exitButton = document.getElementById("focus-exit");
    this.clockEl = document.getElementById("focus-clock");
    this.statusEl = document.getElementById("focus-status");
    this.timerEl = document.getElementById("focus-timer");
    this.titleEl = document.getElementById("focus-title");
    this.timeEl = document.getElementById("focus-time");
    this.upNextSection = document.getElementById("focus-upnext");
    this.upNextList = document.getElementById("focus-upnext-list");

    this.handleKeydown = this.handleKeydown.bind(this);

    if (this.exitButton) {
      this.exitButton.addEventListener("click", () => this.stop());
    }
  }

  isActive() {
    return this.active;
  }

  start() {
    if (this.active || !this.container) return;
    this.active = true;
    this.container.classList.add("is-active");
    this.container.setAttribute("aria-hidden", "false");
    this.tick();
    this.intervalId = window.setInterval(() => this.tick(), 1000);
    document.addEventListener("keydown", this.handleKeydown);
    if (typeof this.onToggle === "function") this.onToggle(true);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.container) {
      this.container.classList.remove("is-active");
      this.container.setAttribute("aria-hidden", "true");
      this.container.dataset.tone = "neutral";
    }
    document.removeEventListener("keydown", this.handleKeydown);
    if (typeof this.onToggle === "function") this.onToggle(false);
  }

  handleKeydown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    this.stop();
  }

  tick() {
    if (!this.container) return;
    const now = new Date();
    if (this.clockEl) this.clockEl.textContent = formatTime(now);

    const { mode, primary, upcoming } = this.getDisplayState(now);
    if (mode === "empty" || !primary) {
      this.setTone("neutral");
      if (this.statusEl) this.statusEl.textContent = t("focus.allClear");
      if (this.timerEl) this.timerEl.textContent = "--:--:--";
      if (this.titleEl) this.titleEl.textContent = t("focus.noUpcoming");
      if (this.timeEl) {
        this.timeEl.textContent = "";
        this.timeEl.classList.add("hidden");
      }
      this.renderUpNext([], now);
      return;
    }

    if (this.timeEl) {
      this.timeEl.textContent = formatEventTime(primary, now);
      this.timeEl.classList.toggle("hidden", !this.timeEl.textContent);
    }
    if (this.titleEl) this.titleEl.textContent = primary.title;

    if (mode === "active") {
      const diff = Math.max(primary.endDate - now, 0);
      if (this.statusEl) {
        this.statusEl.textContent = primary.isAllDay ? t("calendar.allDay").toUpperCase() : t("focus.inProgress");
      }
      if (this.timerEl) this.timerEl.textContent = formatCountdown(diff);
      this.setTone("urgent");
    } else {
      const diff = Math.max(primary.startDate - now, 0);
      if (this.statusEl) this.statusEl.textContent = t("focus.nextUpIn");
      if (this.timerEl) this.timerEl.textContent = formatCountdown(diff);
      this.setTone(getToneForDiff(diff));
    }

    this.renderUpNext(upcoming, now);
  }

  setTone(tone) {
    if (!this.container) return;
    this.container.dataset.tone = tone;
  }

  getDisplayState(now) {
    const state = typeof this.getState === "function" ? this.getState() : null;
    const events = state && Array.isArray(state.e) ? state.e : [];
    const colors = state && Array.isArray(state.c) && state.c.length ? state.c : this.fallbackColors;

    const rangeStart = startOfDay(now);
    const rangeEnd = endOfDay(addDays(rangeStart, 1));
    const expanded = expandEvents(events, rangeStart, rangeEnd);
    const decorated = expanded
      .map((occ) => {
        const startDate = new Date(occ.start);
        const endDate = occ.isAllDay ? endOfDay(startDate) : new Date(occ.end);
        return {
          ...occ,
          startDate,
          endDate,
          color: colors[occ.colorIndex] || colors[0] || "#1a73e8",
        };
      })
      .sort((a, b) => a.startDate - b.startDate);

    if (!decorated.length) {
      return { mode: "empty", primary: null, upcoming: [] };
    }

    const timed = decorated.filter((event) => !event.isAllDay);
    const allDay = decorated.filter((event) => event.isAllDay);
    const activeTimed = timed
      .filter((event) => event.startDate <= now && event.endDate > now)
      .sort((a, b) => a.startDate - b.startDate)[0];

    const futureTimed = timed
      .filter((event) => event.startDate > now)
      .sort((a, b) => a.startDate - b.startDate);

    const shouldUseAllDay = !activeTimed && futureTimed.length === 0;
    const activeAllDay = shouldUseAllDay
      ? allDay.find((event) => event.startDate <= now && event.endDate >= now)
      : null;
    const futureAllDay = shouldUseAllDay
      ? allDay
          .filter((event) => event.startDate > now)
          .sort((a, b) => a.startDate - b.startDate)
      : [];

    const active = activeTimed || activeAllDay || null;
    const next = futureTimed[0] || futureAllDay[0] || null;

    if (active) {
      const upcoming = (futureTimed.length ? futureTimed : futureAllDay).slice(0, MAX_UP_NEXT);
      return { mode: "active", primary: active, upcoming };
    }

    if (next) {
      const source = futureTimed.length ? futureTimed : futureAllDay;
      const upcoming = source.filter((event) => event !== next).slice(0, MAX_UP_NEXT);
      return { mode: "upcoming", primary: next, upcoming };
    }

    return { mode: "empty", primary: null, upcoming: [] };
  }

  renderUpNext(list, now) {
    if (!this.upNextList || !this.upNextSection) return;
    this.upNextList.innerHTML = "";
    if (!list || !list.length) {
      this.upNextSection.classList.add("hidden");
      return;
    }
    this.upNextSection.classList.remove("hidden");
    list.forEach((event) => {
      const item = document.createElement("li");
      item.className = "focus-upnext-item";

      const time = document.createElement("span");
      time.className = "focus-upnext-time";
      time.textContent = formatUpNextLabel(event, now);

      const title = document.createElement("span");
      title.className = "focus-upnext-title";
      title.textContent = event.title;

      item.appendChild(time);
      item.appendChild(title);
      this.upNextList.appendChild(item);
    });
  }
}
