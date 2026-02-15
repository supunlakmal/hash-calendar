import { expandEvents } from "./recurrenceEngine.js";
import { formatDateKey } from "./calendarRender.js";
import { t, getCurrentLocale } from "./i18n.js";

const DEFAULT_COLORS = ["#ff6b6b", "#ffd43b", "#4dabf7", "#63e6be", "#9775fa"];

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addMonths(date, months) {
  const next = new Date(date.getTime());
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() < day) {
    next.setDate(0);
  }
  return next;
}

function formatAgendaHeader(date) {
  return date.toLocaleDateString(getCurrentLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatAgendaTime(date) {
  return date.toLocaleTimeString(getCurrentLocale(), { hour: "2-digit", minute: "2-digit" });
}

function decorateOccurrences(occurrences, colors) {
  const palette = Array.isArray(colors) && colors.length ? colors : DEFAULT_COLORS;
  return occurrences.map((occ) => {
    const color = palette[occ.colorIndex] || palette[0] || "#4dabf7";
    const timeLabel = occ.isAllDay ? t("calendar.allDay") : formatAgendaTime(new Date(occ.start));
    return { ...occ, color, timeLabel };
  });
}

function buildAgendaData({ events, colors, rangeMonths, occurrences }) {
  const rangeStart = startOfDay(new Date());
  const rangeEnd = endOfDay(addMonths(rangeStart, rangeMonths));
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();

  const expanded = Array.isArray(occurrences)
    ? occurrences
        .filter((occ) => occ && Number.isFinite(occ.start))
        .map((occ) => {
          const end = Number.isFinite(occ.end) ? occ.end : occ.start;
          return { ...occ, end };
        })
    : expandEvents(events || [], rangeStart, rangeEnd);

  const filteredByRange = expanded.filter((occ) => {
    const start = Number(occ.start);
    const end = Number.isFinite(occ.end) ? Number(occ.end) : start;
    return start <= rangeEndMs && end >= rangeStartMs;
  });
  const decoratedOccurrences = decorateOccurrences(filteredByRange, colors);
  decoratedOccurrences.sort((a, b) => a.start - b.start);

  const occurrencesByDay = new Map();
  decoratedOccurrences.forEach((occ) => {
    const start = new Date(occ.start);
    const end = new Date(occ.end);
    const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const dayEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    while (current <= dayEnd) {
      if (current >= rangeStart && current <= rangeEnd) {
        const key = formatDateKey(current);
        if (!occurrencesByDay.has(key)) occurrencesByDay.set(key, []);
        occurrencesByDay.get(key).push(occ);
      }
      current.setDate(current.getDate() + 1);
    }
  });

  return { occurrences: decoratedOccurrences, occurrencesByDay, range: { start: rangeStart, end: rangeEnd } };
}

export function renderAgendaView({ events, colors, container, rangeMonths = 6, onEventClick, occurrences } = {}) {
  const data = buildAgendaData({ events, colors, rangeMonths, occurrences });
  if (!container) return data;

  container.innerHTML = "";

  if (!data.occurrencesByDay.size) {
    const empty = document.createElement("div");
    empty.className = "agenda-empty";
    empty.textContent = t("calendar.noUpcoming");
    container.appendChild(empty);
    return data;
  }

  const list = document.createElement("div");
  list.className = "agenda-list";

  const sortedDays = Array.from(data.occurrencesByDay.keys()).sort();

  sortedDays.forEach((key) => {
    const dayEvents = data.occurrencesByDay.get(key);
    const date = new Date(key + "T00:00:00"); // Use key directly for date header

    const header = document.createElement("h3");
    header.className = "agenda-date-header";
    header.textContent = formatAgendaHeader(date);
    list.appendChild(header);

    dayEvents.forEach((event) => {
      const isStart = formatDateKey(new Date(event.start)) === key;
      const item = document.createElement("div");
      item.className = "agenda-event-item";
      if (!isStart) item.classList.add("is-continuation");
      item.style.setProperty("--bg-color", event.color);
      item.style.borderLeftColor = event.color;

      const time = document.createElement("div");
      time.className = "agenda-time";
      time.textContent = isStart ? event.timeLabel : "→";

      const details = document.createElement("div");
      details.className = "agenda-details";

      const title = document.createElement("div");
      title.className = "agenda-title";
      title.textContent = event.title;

      details.appendChild(title);
      item.appendChild(time);
      item.appendChild(details);

      if (typeof onEventClick === "function") {
        item.addEventListener("click", () => onEventClick(event));
      }

      list.appendChild(item);
    });
  });

  container.appendChild(list);
  return data;
}
