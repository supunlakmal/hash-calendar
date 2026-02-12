import { formatDateKey } from "./calendarRender.js";

const DAY_MS = 86400000;
const MIN_EVENT_MS = 45 * 60000;
const MIN_EVENT_WIDTH = 28;
const RULER_HEIGHT = 72;
const LANE_HEIGHT = 74;
const CARD_HEIGHT = 56;
const BOTTOM_PADDING = 48;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function startOfDayMs(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfDayMs(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

function toX(dateMs, rangeStartMs, dayWidth) {
  return ((dateMs - rangeStartMs) / DAY_MS) * dayWidth;
}

function formatMonthLabel(date, locale) {
  return date.toLocaleDateString(locale, { month: "short", year: "numeric" });
}

function formatWeekLabel(date, locale) {
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function formatDayLabel(date, locale, compact = false) {
  if (compact) {
    return date.toLocaleDateString(locale, { day: "numeric", month: "short" });
  }
  return date.toLocaleDateString(locale, { weekday: "short", day: "numeric" });
}

function formatHourMarker(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatEventTimeRange(event, locale, allDayLabel) {
  if (event.isAllDay) return allDayLabel;
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const sameDay = formatDateKey(startDate) === formatDateKey(endDate);
  const timeOptions = { hour: "2-digit", minute: "2-digit" };

  const startTime = startDate.toLocaleTimeString(locale, timeOptions);
  const endTime = endDate.toLocaleTimeString(locale, timeOptions);

  if (sameDay) {
    return `${startTime} - ${endTime}`;
  }

  const dateOptions = { month: "short", day: "numeric" };
  const startDay = startDate.toLocaleDateString(locale, dateOptions);
  const endDay = endDate.toLocaleDateString(locale, dateOptions);
  return `${startDay} ${startTime} -> ${endDay} ${endTime}`;
}

function getVisualDensity(dayWidth) {
  if (dayWidth >= 1440) {
    return { minVisualDurationMs: 1 * 60000, minEventWidth: 1 };
  }
  if (dayWidth >= 720) {
    return { minVisualDurationMs: 2 * 60000, minEventWidth: 2 };
  }
  if (dayWidth >= 480) {
    return { minVisualDurationMs: 5 * 60000, minEventWidth: 3 };
  }
  if (dayWidth >= 220) {
    return { minVisualDurationMs: 12 * 60000, minEventWidth: 8 };
  }
  if (dayWidth >= 120) {
    return { minVisualDurationMs: 25 * 60000, minEventWidth: 14 };
  }
  return { minVisualDurationMs: MIN_EVENT_MS, minEventWidth: MIN_EVENT_WIDTH };
}

function layoutIntoLanes(occurrences, rangeStartMs, rangeEndMs, minVisualDurationMs) {
  const items = [];
  const visibleRangeEnd = rangeEndMs + DAY_MS;

  (occurrences || []).forEach((occ) => {
    const start = Number(occ && occ.start);
    const rawEnd = Number(occ && occ.end);
    if (!Number.isFinite(start)) return;
    const end = Number.isFinite(rawEnd) ? rawEnd : start;
    const visualEnd = Math.max(end, start + minVisualDurationMs);
    if (visualEnd < rangeStartMs || start > visibleRangeEnd) return;
    items.push({
      ...occ,
      _layoutStart: start,
      _layoutEnd: visualEnd,
      _lane: 0,
    });
  });

  items.sort((a, b) => a._layoutStart - b._layoutStart || a._layoutEnd - b._layoutEnd);

  const laneEndTimes = [];
  items.forEach((item) => {
    let laneIndex = laneEndTimes.findIndex((laneEnd) => laneEnd <= item._layoutStart);
    if (laneIndex === -1) laneIndex = laneEndTimes.length;
    laneEndTimes[laneIndex] = item._layoutEnd;
    item._lane = laneIndex;
  });

  return { items, laneCount: Math.max(1, laneEndTimes.length) };
}

export function renderTimelineView({
  container,
  occurrences = [],
  rangeStart,
  rangeEnd,
  selectedDate,
  dayWidth = 64,
  locale = "en-US",
  allDayLabel = "All day",
  emptyLabel = "No upcoming events",
  onSelectDay,
  onEventClick,
  onZoomRequest,
} = {}) {
  if (!container) {
    return {
      scrollHost: null,
      range: null,
      centerOnDate: () => {},
      setSelectedDate: () => {},
    };
  }

  const safeDayWidth = clamp(Number(dayWidth) || 64, 8, 1600);
  const density = getVisualDensity(safeDayWidth);
  const now = new Date();
  const safeStartDate = isValidDate(rangeStart) ? rangeStart : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const safeEndDate = isValidDate(rangeEnd) ? rangeEnd : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);

  const rangeStartMs = startOfDayMs(safeStartDate);
  const rangeEndMs = Math.max(endOfDayMs(safeEndDate), rangeStartMs + DAY_MS);
  const totalDays = Math.max(1, Math.ceil((rangeEndMs - rangeStartMs) / DAY_MS) + 1);
  const timelineWidth = Math.max(720, totalDays * safeDayWidth);

  container.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "timeline-shell";

  const scrollHost = document.createElement("div");
  scrollHost.className = "timeline-scroll";
  scrollHost.tabIndex = 0;
  scrollHost.setAttribute("aria-label", "Timeline");

  const canvas = document.createElement("div");
  canvas.className = "timeline-canvas";
  canvas.style.width = `${timelineWidth}px`;

  const gridLayer = document.createElement("div");
  gridLayer.className = "timeline-grid";
  gridLayer.style.width = `${timelineWidth}px`;
  gridLayer.style.setProperty("--timeline-day-width", `${safeDayWidth}px`);

  const ruler = document.createElement("div");
  ruler.className = "timeline-ruler";
  ruler.style.width = `${timelineWidth}px`;

  const eventLayer = document.createElement("div");
  eventLayer.className = "timeline-events";
  eventLayer.style.width = `${timelineWidth}px`;

  canvas.appendChild(gridLayer);
  canvas.appendChild(ruler);
  canvas.appendChild(eventLayer);
  scrollHost.appendChild(canvas);
  shell.appendChild(scrollHost);
  container.appendChild(shell);

  const showHourGrid = safeDayWidth >= 480 && totalDays <= 220;
  const showMinuteGrid = safeDayWidth >= 1200 && totalDays <= 90;
  const showDayLabels = safeDayWidth >= 26;
  const dayLabelStep = safeDayWidth >= 80 ? 1 : safeDayWidth >= 44 ? 2 : 4;
  let hourLabelStep = safeDayWidth >= 1200 ? 1 : safeDayWidth >= 800 ? 2 : safeDayWidth >= 480 ? 3 : 6;
  if (totalDays > 30) hourLabelStep = Math.max(hourLabelStep, 6);
  if (totalDays > 90) hourLabelStep = Math.max(hourLabelStep, 12);

  for (let day = 0; day <= totalDays; day += 1) {
    const tickDate = new Date(rangeStartMs + day * DAY_MS);
    const x = day * safeDayWidth;
    const line = document.createElement("div");
    line.className = "timeline-day-line";
    if (tickDate.getDate() === 1 || day === 0) line.classList.add("is-major");
    line.style.left = `${x}px`;
    gridLayer.appendChild(line);

    if (tickDate.getDate() === 1 || day === 0) {
      const monthChip = document.createElement("div");
      monthChip.className = "timeline-month-chip";
      monthChip.style.left = `${x + 8}px`;
      monthChip.textContent = formatMonthLabel(tickDate, locale);
      ruler.appendChild(monthChip);
    } else if (safeDayWidth >= 96 && safeDayWidth < 320 && tickDate.getDay() === 1) {
      const weekChip = document.createElement("div");
      weekChip.className = "timeline-week-chip";
      weekChip.style.left = `${x + 6}px`;
      weekChip.textContent = formatWeekLabel(tickDate, locale);
      ruler.appendChild(weekChip);
    }

    if (showDayLabels && (day === 0 || day % dayLabelStep === 0 || tickDate.getDate() === 1)) {
      const dayChip = document.createElement("div");
      dayChip.className = "timeline-day-chip";
      dayChip.style.left = `${x + 4}px`;
      dayChip.textContent = formatDayLabel(tickDate, locale, safeDayWidth < 64);
      ruler.appendChild(dayChip);
    }

    if (showHourGrid || showMinuteGrid) {
      const hourLineStep = showHourGrid ? 1 : 6;
      for (let hour = hourLineStep; hour < 24; hour += hourLineStep) {
        const hourLine = document.createElement("div");
        hourLine.className = "timeline-hour-line";
        if (hour % 6 === 0) hourLine.classList.add("is-major");
        hourLine.style.left = `${x + (hour / 24) * safeDayWidth}px`;
        gridLayer.appendChild(hourLine);
      }

      if (safeDayWidth >= 96) {
        for (let hour = 0; hour < 24; hour += hourLabelStep) {
          const hourChip = document.createElement("div");
          hourChip.className = "timeline-hour-chip";
          hourChip.style.left = `${x + (hour / 24) * safeDayWidth + 2}px`;
          hourChip.textContent = formatHourMarker(hour);
          ruler.appendChild(hourChip);
        }
      }
    }

    if (showMinuteGrid) {
      for (let halfHour = 1; halfHour < 48; halfHour += 1) {
        if (halfHour % 2 === 0) continue;
        const minuteLine = document.createElement("div");
        minuteLine.className = "timeline-minute-line";
        minuteLine.style.left = `${x + (halfHour / 48) * safeDayWidth}px`;
        gridLayer.appendChild(minuteLine);
      }

      for (let halfHour = 1; halfHour < 48; halfHour += 2) {
        const minuteChip = document.createElement("div");
        minuteChip.className = "timeline-minute-chip";
        minuteChip.style.left = `${x + (halfHour / 48) * safeDayWidth + 2}px`;
        minuteChip.textContent = ":30";
        ruler.appendChild(minuteChip);
      }
    }
  }

  const todayLine = document.createElement("div");
  todayLine.className = "timeline-focus-line is-today";
  const todayX = toX(startOfDayMs(new Date()), rangeStartMs, safeDayWidth);
  todayLine.style.left = `${todayX}px`;
  gridLayer.appendChild(todayLine);

  const selectedLine = document.createElement("div");
  selectedLine.className = "timeline-focus-line is-selected";
  gridLayer.appendChild(selectedLine);

  const updateSelectedLine = (date) => {
    if (!isValidDate(date)) return;
    const x = toX(startOfDayMs(date), rangeStartMs, safeDayWidth);
    selectedLine.style.left = `${x}px`;
  };
  updateSelectedLine(isValidDate(selectedDate) ? selectedDate : new Date());

  const laidOut = layoutIntoLanes(occurrences, rangeStartMs, rangeEndMs, density.minVisualDurationMs);
  const contentHeight = RULER_HEIGHT + laidOut.laneCount * LANE_HEIGHT + CARD_HEIGHT + BOTTOM_PADDING;
  canvas.style.height = `${Math.max(320, contentHeight)}px`;

  laidOut.items.forEach((event) => {
    const clippedStart = Math.max(event._layoutStart, rangeStartMs);
    const clippedEnd = Math.min(event._layoutEnd, rangeEndMs + DAY_MS);
    const left = toX(clippedStart, rangeStartMs, safeDayWidth);
    const width = Math.max(density.minEventWidth, ((clippedEnd - clippedStart) / DAY_MS) * safeDayWidth);

    const card = document.createElement("button");
    card.type = "button";
    card.className = "timeline-event";
    card.style.left = `${left}px`;
    card.style.top = `${RULER_HEIGHT + event._lane * LANE_HEIGHT}px`;
    card.style.width = `${width}px`;
    card.style.setProperty("--bg-color", event.color || "#1a73e8");
    if (width < 88) card.classList.add("is-compact");
    if (width < 46) card.classList.add("is-micro");

    const timeLabel = document.createElement("span");
    timeLabel.className = "timeline-event-time";
    timeLabel.textContent = formatEventTimeRange(event, locale, allDayLabel);

    const title = document.createElement("span");
    title.className = "timeline-event-title";
    title.textContent = event.title || "Untitled";

    card.appendChild(timeLabel);
    card.appendChild(title);
    card.title = `${title.textContent} - ${timeLabel.textContent}`;
    card.setAttribute("aria-label", `${title.textContent}. ${timeLabel.textContent}`);

    card.addEventListener("click", (evt) => {
      evt.stopPropagation();
      if (typeof onEventClick === "function") {
        onEventClick(event);
      }
    });

    eventLayer.appendChild(card);
  });

  if (!laidOut.items.length) {
    const empty = document.createElement("div");
    empty.className = "timeline-empty";
    empty.textContent = emptyLabel;
    empty.style.top = `${RULER_HEIGHT + 18}px`;
    eventLayer.appendChild(empty);
  }

  if (typeof onSelectDay === "function") {
    canvas.addEventListener("click", (event) => {
      if (event.target.closest(".timeline-event")) return;
      const rect = canvas.getBoundingClientRect();
      const x = clamp(event.clientX - rect.left, 0, timelineWidth - 1);
      const dayIndex = Math.floor(x / safeDayWidth);
      const date = new Date(rangeStartMs + dayIndex * DAY_MS);
      onSelectDay(date);
    });
  }

  scrollHost.addEventListener(
    "wheel",
    (event) => {
      const isZoomGesture = event.ctrlKey || event.metaKey;
      if (isZoomGesture && typeof onZoomRequest === "function") {
        event.preventDefault();
        const rect = scrollHost.getBoundingClientRect();
        const ratio = rect.width > 0 ? clamp((event.clientX - rect.left) / rect.width, 0, 1) : 0.5;
        onZoomRequest(event.deltaY < 0 ? 1 : -1, ratio);
        return;
      }

      const canScrollVertically = scrollHost.scrollHeight > scrollHost.clientHeight + 1;
      if (!canScrollVertically && Math.abs(event.deltaY) > Math.abs(event.deltaX) && scrollHost.scrollWidth > scrollHost.clientWidth) {
        event.preventDefault();
        scrollHost.scrollLeft += event.deltaY;
      }
    },
    { passive: false },
  );

  const centerOnDate = (date, { behavior = "auto", anchor = 0.5 } = {}) => {
    if (!isValidDate(date)) return;
    const dayOffset = (startOfDayMs(date) - rangeStartMs) / DAY_MS;
    const target = dayOffset * safeDayWidth - scrollHost.clientWidth * anchor;
    const maxLeft = Math.max(0, scrollHost.scrollWidth - scrollHost.clientWidth);
    scrollHost.scrollTo({
      left: clamp(target, 0, maxLeft),
      behavior,
    });
  };

  return {
    scrollHost,
    range: {
      start: new Date(rangeStartMs),
      end: new Date(rangeEndMs),
    },
    centerOnDate,
    setSelectedDate: updateSelectedLine,
  };
}
