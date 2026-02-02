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

function buildAgendaData({ events, colors, rangeMonths }) {
  const rangeStart = startOfDay(new Date());
  const rangeEnd = endOfDay(addMonths(rangeStart, rangeMonths));

  const expanded = expandEvents(events || [], rangeStart, rangeEnd);
  const occurrences = decorateOccurrences(expanded, colors);
  occurrences.sort((a, b) => a.start - b.start);

  const occurrencesByDay = new Map();
  occurrences.forEach((occ) => {
    const key = formatDateKey(new Date(occ.start));
    if (!occurrencesByDay.has(key)) occurrencesByDay.set(key, []);
    occurrencesByDay.get(key).push(occ);
  });

  return { occurrences, occurrencesByDay, range: { start: rangeStart, end: rangeEnd } };
}

export function renderAgendaView({ events, colors, container, rangeMonths = 6, onEventClick } = {}) {
  const data = buildAgendaData({ events, colors, rangeMonths });
  if (!container) return data;

  container.innerHTML = "";

  if (!data.occurrences.length) {
    const empty = document.createElement("div");
    empty.className = "agenda-empty";
    empty.textContent = t("calendar.noUpcoming");
    container.appendChild(empty);
    return data;
  }

  const list = document.createElement("div");
  list.className = "agenda-list";

  let lastKey = "";
  data.occurrences.forEach((event) => {
    const date = new Date(event.start);
    const key = formatDateKey(date);

    if (key !== lastKey) {
      const header = document.createElement("h3");
      header.className = "agenda-date-header";
      header.textContent = formatAgendaHeader(date);
      list.appendChild(header);
      lastKey = key;
    }

    const item = document.createElement("div");
    item.className = "agenda-event-item";
    item.style.borderLeftColor = event.color;

    const time = document.createElement("div");
    time.className = "agenda-time";
    time.textContent = event.timeLabel;

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

  container.appendChild(list);
  return data;
}
