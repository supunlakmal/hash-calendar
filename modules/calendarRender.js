import { t, getCurrentLocale, getTranslatedMonthName, getTranslatedWeekday } from "./i18n.js";

function pad(num) {
  return String(num).padStart(2, "0");
}

export function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getMonthGridRange(viewDate, weekStartsOnMonday) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const dayOfWeek = firstOfMonth.getDay();
  const offset = weekStartsOnMonday ? (dayOfWeek + 6) % 7 : dayOfWeek;
  const gridStart = new Date(year, month, 1 - offset);

  const dates = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    dates.push(date);
  }
  const gridEnd = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 41, 23, 59, 59);
  return { start: gridStart, end: gridEnd, dates };
}

export function getWeekRange(viewDate, weekStartsOnMonday) {
  const anchor = new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate());
  const dayOfWeek = anchor.getDay();
  const offset = weekStartsOnMonday ? (dayOfWeek + 6) % 7 : dayOfWeek;
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - offset);
  const dates = [];
  for (let i = 0; i < 7; i += 1) {
    dates.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59);
  return { start, end, dates };
}

function formatWeekdayLabel(date) {
  return getTranslatedWeekday(date, 'short');
}

export function renderWeekdayHeaders(container, weekStartsOnMonday, mode = "month", dates = []) {
  const locale = getCurrentLocale();
  let labels = [];
  if (mode === "day" && dates[0]) {
    const date = dates[0];
    labels = [`${getTranslatedWeekday(date)}, ${getTranslatedMonthName(date, true)} ${date.getDate()}`];
  } else if (mode === "week" && dates.length) {
    labels = dates.map((date) => `${formatWeekdayLabel(date)} ${date.getDate()}`);
  } else {
    // Generate weekday labels dynamically based on locale
    const baseDate = new Date(2024, 0, 1); // Monday, January 1, 2024
    const offset = weekStartsOnMonday ? 0 : 6;
    labels = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(baseDate);
      date.setDate(1 + ((i + offset) % 7));
      return getTranslatedWeekday(date, 'short');
    });
  }

  container.innerHTML = "";
  container.style.gridTemplateColumns = `repeat(${labels.length}, minmax(0, 1fr))`;
  labels.forEach((label) => {
    const cell = document.createElement("div");
    cell.className = "weekday";
    cell.textContent = label;
    container.appendChild(cell);
  });
}

export function renderCalendar({
  container,
  dates,
  currentMonth,
  selectedDate,
  eventsByDay,
  onSelectDay,
  onEventClick,
}) {
  container.innerHTML = "";
  const today = new Date();
  const todayKey = formatDateKey(today);
  const selectedKey = selectedDate ? formatDateKey(selectedDate) : null;

  dates.forEach((date) => {
    const key = formatDateKey(date);
    const dayCell = document.createElement("div");
    dayCell.className = "day-cell";
    dayCell.setAttribute("role", "gridcell");
    if (date.getMonth() !== currentMonth) dayCell.classList.add("is-outside");
    if (key === todayKey) dayCell.classList.add("is-today");
    if (selectedKey && key === selectedKey) dayCell.classList.add("is-selected");
    dayCell.dataset.date = key;

    const dayNumber = document.createElement("div");
    dayNumber.className = "day-number";
    dayNumber.textContent = String(date.getDate());
    dayCell.appendChild(dayNumber);

    const events = eventsByDay.get(key) || [];
    const maxEvents = 3;
    events.slice(0, maxEvents).forEach((event) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "event-chip";
      
      const isStart = formatDateKey(new Date(event.start)) === key;
      if (!isStart) {
        chip.classList.add("is-continuation");
      }

      chip.style.setProperty("--bg-color", event.color);
      chip.style.borderColor = event.color;

      const time = document.createElement("span");
      time.className = "time";
      time.textContent = isStart ? event.timeLabel : "→";
      
      const title = document.createElement("span");
      title.textContent = event.title;

      chip.appendChild(time);
      chip.appendChild(title);
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        onEventClick(event);
      });
      dayCell.appendChild(chip);
    });

    if (events.length > maxEvents) {
      const more = document.createElement("div");
      more.className = "event-more";
      more.textContent = t("calendar.moreEvents", { count: events.length - maxEvents });
      dayCell.appendChild(more);
    }

    dayCell.addEventListener("click", () => onSelectDay(date));
    container.appendChild(dayCell);
  });
}

function formatHourLabel(hour) {
  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 || 12;
  return `${display} ${suffix}`;
}

export function renderTimeGrid({ container, dates, occurrences, onSelectDay, onEventClick }) {
  const dayKeys = dates.map((date) => formatDateKey(date));
  const buckets = new Map();
  dayKeys.forEach((key) => {
    buckets.set(key, { allDay: [], timed: [] });
  });

  occurrences.forEach((occ) => {
    const key = formatDateKey(new Date(occ.start));
    const bucket = buckets.get(key);
    if (!bucket) return;
    if (occ.isAllDay) {
      bucket.allDay.push(occ);
    } else {
      bucket.timed.push(occ);
    }
  });

  buckets.forEach((bucket) => {
    bucket.allDay.sort((a, b) => a.start - b.start);
    bucket.timed.sort((a, b) => a.start - b.start);
  });

  container.innerHTML = "";
  // Header row (32px) + 1440 rows (one for each minute)
  // We use 0.7333px per minute to get 44px per hour (44 / 60)
  container.style.gridTemplateColumns = `72px repeat(${dates.length}, minmax(0, 1fr))`;
  container.style.gridTemplateRows = `32px repeat(1440, minmax(0.7333px, 1fr))`;

  // 1. All-Day Section
  const allDayLabel = document.createElement("div");
  allDayLabel.className = "time-label all-day-label";
  allDayLabel.textContent = t("calendar.allDay");
  allDayLabel.style.gridRow = "1 / 2";
  allDayLabel.style.gridColumn = "1";
  container.appendChild(allDayLabel);

  dates.forEach((date, i) => {
    const key = formatDateKey(date);
    const cell = document.createElement("div");
    cell.className = "time-cell all-day";
    cell.dataset.date = key;
    cell.style.gridRow = "1 / 2";
    cell.style.gridColumn = `${i + 2}`;

    const bucket = buckets.get(key);
    const events = bucket ? bucket.allDay : [];
    events.slice(0, 2).forEach((event) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "time-event";
      chip.style.setProperty("--bg-color", event.color); // Changed from chip.style.background
      chip.textContent = event.title;
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        onEventClick(event);
      });
      cell.appendChild(chip);
    });
    if (events.length > 2) {
      const more = document.createElement("div");
      more.className = "event-more";
      more.textContent = t("calendar.moreEvents", { count: events.length - 2 });
      cell.appendChild(more);
    }
    cell.addEventListener("click", () => onSelectDay(date));
    container.appendChild(cell);
  });

  // 2. Hour Labels and Background Cells
  for (let hour = 0; hour < 24; hour += 1) {
    const label = document.createElement("div");
    label.className = "time-label";
    label.textContent = formatHourLabel(hour);
    // Each hour spans 60 minutes
    const startRow = 2 + hour * 60;
    label.style.gridRow = `${startRow} / span 60`;
    label.style.gridColumn = "1";
    container.appendChild(label);

    dates.forEach((date, i) => {
      const key = formatDateKey(date);
      const cell = document.createElement("div");
      cell.className = "time-cell";
      cell.dataset.date = key;
      cell.dataset.hour = String(hour);
      cell.style.gridRow = `${startRow} / span 60`;
      cell.style.gridColumn = `${i + 2}`;
      cell.addEventListener("click", () => onSelectDay(date));
      container.appendChild(cell);
    });
  }

  // 3. Timed Events
  const timedEvents = occurrences.filter(event => !event.isAllDay);
  
  dates.forEach((dayStart, dayIndex) => {
    const dayStartMs = dayStart.getTime();
    const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;
    const dayKey = dayKeys[dayIndex];

    // Filter events for this specific day
    const dayEvents = timedEvents.filter(event => event.start < dayEndMs && event.end > dayStartMs);
    
    // Sort by start time, then duration
    dayEvents.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    // Simple slotting algorithm
    const clusters = [];
    dayEvents.forEach(event => {
      let cluster = clusters.find(c => c.end > event.start);
      if (!cluster) {
        cluster = { end: event.end, events: [] };
        clusters.push(cluster);
      } else {
        cluster.end = Math.max(cluster.end, event.end);
      }
      cluster.events.push(event);
    });

    clusters.forEach(cluster => {
      const columns = [];
      cluster.events.forEach(event => {
        let colIndex = columns.findIndex(col => col <= event.start);
        if (colIndex === -1) {
          columns.push(event.end);
          colIndex = columns.length - 1;
        } else {
          columns[colIndex] = event.end;
        }
        event.colIndex = colIndex;
      });
      cluster.maxCols = columns.length;
    });

    dayEvents.forEach((event) => {
      const overlapStartMs = Math.max(event.start, dayStartMs);
      const overlapEndMs = Math.min(event.end, dayEndMs);

      const startLocal = new Date(overlapStartMs);
      const startMin = startLocal.getHours() * 60 + startLocal.getMinutes();
      const duration = Math.max(15, (overlapEndMs - overlapStartMs) / 60000); 

      // Create or get daily wrapper
      let dayWrapper = container.querySelector(`.day-events-wrapper[data-day="${dayIndex}"]`);
      if (!dayWrapper) {
        dayWrapper = document.createElement("div");
        dayWrapper.className = "day-events-wrapper";
        dayWrapper.dataset.day = String(dayIndex);
        dayWrapper.style.gridRow = "2 / 1442";
        dayWrapper.style.gridColumn = `${dayIndex + 2}`;
        dayWrapper.style.position = "relative";
        dayWrapper.style.pointerEvents = "none";
        container.appendChild(dayWrapper);
      }

      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "time-event";
      
      const cluster = clusters.find(c => c.events.includes(event));
      const width = 100 / (cluster ? cluster.maxCols : 1);
      const left = (event.colIndex || 0) * width;

      chip.style.setProperty("--bg-color", event.color);
      chip.style.zIndex = "5";
      chip.style.pointerEvents = "auto";
      chip.style.width = `calc(${width}% - 4px)`;
      chip.style.left = `calc(${left}% + 2px)`;
      chip.style.position = "absolute";

      // Relative positioning within the dayWrapper
      chip.style.top = `${startMin * 0.7333}px`;
      chip.style.height = `${duration * 0.7333}px`;

      const timeSpan = document.createElement("span");
      timeSpan.className = "time";
      
      if (overlapStartMs === event.start) {
          timeSpan.textContent = event.timeLabel;
      } else {
          timeSpan.textContent = "→";
      }

      const titleSpan = document.createElement("span");
      titleSpan.className = "title";
      titleSpan.textContent = event.title;

      chip.appendChild(timeSpan);
      chip.appendChild(titleSpan);

      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        onEventClick(event);
      });
      dayWrapper.appendChild(chip);
    });
  });
}

export function renderYearView({ container, year, eventsByDay, selectedDate, weekStartsOnMonday, onSelectDay }) {
  const locale = getCurrentLocale();
  container.innerHTML = "";
  container.style.gridTemplateColumns = "repeat(auto-fit, minmax(220px, 1fr))";
  container.style.gridTemplateRows = "auto";

  // Generate weekday abbreviations dynamically based on locale
  const baseDate = new Date(2024, 0, 1); // Monday, January 1, 2024
  const offset = weekStartsOnMonday ? 0 : 6;
  const labels = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(baseDate);
    date.setDate(1 + ((i + offset) % 7));
    return getTranslatedWeekday(date, 'narrow');
  });

  for (let month = 0; month < 12; month += 1) {
    const wrapper = document.createElement("div");
    wrapper.className = "mini-month";

    const header = document.createElement("div");
    header.className = "mini-title";
    header.textContent = getTranslatedMonthName(new Date(year, month, 1));
    wrapper.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "mini-grid";

    labels.forEach((label) => {
      const cell = document.createElement("div");
      cell.className = "mini-weekday";
      cell.textContent = label;
      grid.appendChild(cell);
    });

    const firstOfMonth = new Date(year, month, 1);
    const dayOfWeek = firstOfMonth.getDay();
    const offset = weekStartsOnMonday ? (dayOfWeek + 6) % 7 : dayOfWeek;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i += 1) {
      const dayIndex = i - offset + 1;
      if (i < offset || dayIndex > daysInMonth) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "mini-day is-empty";
        emptyCell.setAttribute("aria-hidden", "true");
        grid.appendChild(emptyCell);
        continue;
      }

      const date = new Date(year, month, dayIndex);
      const key = formatDateKey(date);
      const dayCell = document.createElement("button");
      dayCell.type = "button";
      dayCell.className = "mini-day";
      if (selectedDate && key === formatDateKey(selectedDate)) dayCell.classList.add("is-selected");
      dayCell.textContent = String(dayIndex);
      if (eventsByDay.has(key)) {
        const dot = document.createElement("span");
        dot.className = "mini-dot";
        dayCell.appendChild(dot);
      }
      dayCell.addEventListener("click", () => onSelectDay(date));
      grid.appendChild(dayCell);
    }

    wrapper.appendChild(grid);
    container.appendChild(wrapper);
  }
}
