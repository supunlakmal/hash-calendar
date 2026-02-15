export function createEventCrudController({
  ui,
  t,
  cssClasses,
  defaultEventDuration,
  defaultColors,
  msPerMinute,
  formatDateKey,
  startOfDay,
  ensureEditable,
  getState,
  getSelectedDate,
  setSelectedDate,
  scheduleSave,
  render,
} = {}) {
  let editingIndex = null;

  function closeEventModal() {
    if (ui.eventModal) ui.eventModal.classList.add(cssClasses.HIDDEN);
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
      ui.eventDuration.value = String(defaultEventDuration);
    }
  }

  function renderColorPalette(activeColor) {
    if (!ui.colorPalette) return;
    const state = typeof getState === "function" ? getState() : null;
    if (!state || !Array.isArray(state.c)) return;

    ui.colorPalette.innerHTML = "";
    state.c.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "color-swatch";
      if (String(color).toLowerCase() === String(activeColor || "").toLowerCase()) {
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

  function openEventModal({ index = null, date = null } = {}) {
    if (typeof ensureEditable === "function" && !ensureEditable()) return;
    if (!ui.eventModal) return;

    const state = typeof getState === "function" ? getState() : null;
    if (!state || !Array.isArray(state.e) || !Array.isArray(state.c)) return;

    editingIndex = index;
    const isEditing = typeof index === "number";
    ui.eventModalTitle.textContent = t(isEditing ? "modal.editEvent" : "modal.addEvent");
    ui.eventDelete.classList.toggle(cssClasses.HIDDEN, !isEditing);

    const selectedDate = typeof getSelectedDate === "function" ? getSelectedDate() : new Date();
    const baseDate = date || selectedDate;
    const now = new Date();
    let startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), now.getHours(), now.getMinutes());
    let duration = defaultEventDuration;
    let title = "";
    let color = state.c[0] || defaultColors[0];
    let rule = "";
    let isAllDay = false;

    if (isEditing) {
      const entry = state.e[index];
      if (entry) {
        const [startMin, storedDuration, storedTitle, colorIndex, storedRule] = entry;
        startDate = new Date(startMin * msPerMinute);
        duration = storedDuration || 0;
        title = storedTitle || "";
        color = state.c[colorIndex] || color;
        rule = storedRule || "";
        isAllDay = duration === 0;
      }
    }

    const endDate = new Date(startDate.getTime() + (duration || defaultEventDuration) * msPerMinute);

    ui.eventTitle.value = title;
    ui.eventDate.value = formatDateKey(startDate);
    ui.eventTime.value = startDate.toTimeString().slice(0, 5);
    ui.eventEndDate.value = formatDateKey(endDate);
    ui.eventEndTime.value = endDate.toTimeString().slice(0, 5);
    ui.eventDuration.value = String(isAllDay ? 0 : duration || defaultEventDuration);
    ui.eventRecurrence.value = rule;
    ui.eventColor.value = color;
    ui.eventAllDay.checked = isAllDay;
    toggleAllDay(isAllDay);
    renderColorPalette(color);

    ui.eventModal.classList.remove(cssClasses.HIDDEN);
  }

  function saveEvent(event) {
    if (typeof ensureEditable === "function" && !ensureEditable()) return;
    event.preventDefault();
    if (!ui.eventTitle || !ui.eventDate) return;

    const state = typeof getState === "function" ? getState() : null;
    if (!state || !Array.isArray(state.e) || !Array.isArray(state.c)) return;

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

    const startMin = Math.floor(startDate.getTime() / msPerMinute);

    let duration = 0;
    if (!allDay) {
      const endDateValue = ui.eventEndDate.value;
      const [endYear, endMonth, endDay] = endDateValue.split("-").map(Number);
      const [endHours, endMinutes] = ui.eventEndTime.value.split(":").map(Number);
      const endDate = new Date(endYear, endMonth - 1, endDay, endHours, endMinutes);
      duration = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / msPerMinute));
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

    if (typeof setSelectedDate === "function") {
      setSelectedDate(startOfDay(startDate));
    }
    closeEventModal();
    if (typeof scheduleSave === "function") scheduleSave();
    if (typeof render === "function") render();
  }

  function deleteEvent() {
    if (typeof ensureEditable === "function" && !ensureEditable()) return;
    if (typeof editingIndex !== "number") return;

    const confirmed = window.confirm(t("confirm.deleteEvent"));
    if (!confirmed) return;

    const state = typeof getState === "function" ? getState() : null;
    if (!state || !Array.isArray(state.e)) return;

    state.e.splice(editingIndex, 1);
    editingIndex = null;
    closeEventModal();
    if (typeof scheduleSave === "function") scheduleSave();
    if (typeof render === "function") render();
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
    const end = new Date(start.getTime() + duration * msPerMinute);
    ui.eventEndDate.value = formatDateKey(end);
    ui.eventEndTime.value = end.toTimeString().slice(0, 5);
  }

  function updateDurationFromEnd() {
    const start = getEventStartDateTime();
    const end = getEventEndDateTime();
    const duration = Math.max(0, Math.floor((end.getTime() - start.getTime()) / msPerMinute));
    ui.eventDuration.value = String(duration);
  }

  function updateEndFromDuration() {
    const start = getEventStartDateTime();
    const duration = Number(ui.eventDuration.value) || 0;
    const end = new Date(start.getTime() + duration * msPerMinute);
    ui.eventEndDate.value = formatDateKey(end);
    ui.eventEndTime.value = end.toTimeString().slice(0, 5);
  }

  function bindEvents() {
    if (ui.eventClose) ui.eventClose.addEventListener("click", closeEventModal);
    if (ui.eventCancel) ui.eventCancel.addEventListener("click", closeEventModal);
    if (ui.eventDelete) ui.eventDelete.addEventListener("click", deleteEvent);
    if (ui.eventForm) ui.eventForm.addEventListener("submit", saveEvent);
    if (ui.eventAllDay) {
      ui.eventAllDay.addEventListener("change", (event) => {
        toggleAllDay(event.target.checked);
      });
    }

    // Keep start/end/duration fields in sync as the user edits.
    if (ui.eventDate) ui.eventDate.addEventListener("change", updateEndFromStart);
    if (ui.eventTime) ui.eventTime.addEventListener("change", updateEndFromStart);
    if (ui.eventEndDate) ui.eventEndDate.addEventListener("change", updateDurationFromEnd);
    if (ui.eventEndTime) ui.eventEndTime.addEventListener("change", updateDurationFromEnd);
    if (ui.eventDuration) ui.eventDuration.addEventListener("input", updateEndFromDuration);
  }

  return {
    openEventModal,
    closeEventModal,
    saveEvent,
    deleteEvent,
    toggleAllDay,
    updateEndFromStart,
    updateDurationFromEnd,
    updateEndFromDuration,
    bindEvents,
  };
}
