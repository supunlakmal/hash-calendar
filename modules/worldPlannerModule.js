import {
  CSS_CLASSES,
  MAX_TZ_RESULTS,
  MIN_SEARCH_LENGTH,
  MS_PER_HOUR,
  PLANNER_ACTIVE_HOUR_END,
  PLANNER_ACTIVE_HOUR_START,
  PLANNER_BUSINESS_HOUR_END,
  PLANNER_BUSINESS_HOUR_START,
  PLANNER_DEFAULT_ZONES,
  PLANNER_HOURS_PER_DAY,
  PLANNER_MAX_ZONES,
} from "./constants.js";
import { AVAILABLE_ZONES, getLocalZone, getZoneInfo, parseOffsetSearchTerm } from "./timezoneManager.js";

export class WorldPlanner {
  constructor({ getState, updateState, ensureEditable, scheduleSave, showToast, closeMobileDrawer, openEventModal } = {}) {
    // Store dependencies
    this.getState = getState;
    this.updateState = updateState;
    this.ensureEditable = ensureEditable;
    this.scheduleSave = scheduleSave;
    this.showToast = showToast;
    this.closeMobileDrawer = closeMobileDrawer;
    this.openEventModal = openEventModal;

    // Cache DOM elements
    this.modal = document.getElementById("world-planner-modal");
    this.closeBtn = document.getElementById("wp-close");
    this.grid = document.getElementById("wp-grid");
    this.addZoneInput = document.getElementById("wp-add-zone");
    this.datePicker = document.getElementById("wp-date-picker");
    this.formatToggle = document.getElementById("wp-format-toggle");
    this.tzResultsList = document.getElementById("wp-tz-results");

    // Bind methods
    this.handleTzInput = this.handleTzInput.bind(this);
    this.handleGridClick = this.handleGridClick.bind(this);
    this.handleGridDblClick = this.handleGridDblClick.bind(this);
    this.handleScrubberMove = this.handleScrubberMove.bind(this);
    this.handleScrubberClick = this.handleScrubberClick.bind(this);
    this.handleDateChange = this.handleDateChange.bind(this);
    this.toggleFormat = this.toggleFormat.bind(this);

    // Setup event listeners
    this.bindEvents();
  }

  bindEvents() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener("click", () => this.close());
    }
    if (this.addZoneInput) {
      this.addZoneInput.addEventListener("input", this.handleTzInput);
    }
    if (this.datePicker) {
      this.datePicker.addEventListener("change", this.handleDateChange);
    }
    if (this.formatToggle) {
      this.formatToggle.addEventListener("click", this.toggleFormat);
    }
    if (this.grid) {
      this.grid.addEventListener("mousemove", this.handleScrubberMove);
      this.grid.addEventListener("click", (e) => {
        this.handleScrubberClick(e);
        this.handleGridClick(e);
      });
      this.grid.addEventListener("dblclick", this.handleGridDblClick);
    }
  }

  isOpen() {
    return this.modal && !this.modal.classList.contains(CSS_CLASSES.HIDDEN);
  }

  open() {
    if (!this.modal) return;

    const canEdit = typeof this.ensureEditable === "function" ? this.ensureEditable({ silent: true }) : true;

    const state = this.getState();

    // Initialize state if empty or missing home zone
    if (!state.mp || !state.mp.h) {
      const local = getLocalZone();
      const currentZones = state.mp && state.mp.z ? state.mp.z : ["UTC"];
      
      // Ensure UTC is in the list if it's a fresh init
      if (!state.mp && !currentZones.includes("UTC")) {
        currentZones.push("UTC");
      }

      const newMp = {
        h: local,
        z: currentZones,
        s: state.mp ? state.mp.s : null,
        d: (state.mp && state.mp.d) || new Date().toISOString().split("T")[0],
        f24: state.mp ? !!state.mp.f24 : false,
      };
      this.updateState("mp", newMp);
    }

    // Ensure f24 exists for legacy states
    if (state.mp && state.mp.f24 === undefined && canEdit) {
      this.updateState("mp", { ...state.mp, f24: false });
    }

    // Set date picker
    if (this.datePicker && state.mp) {
      this.datePicker.value = state.mp.d || new Date().toISOString().split("T")[0];
    }

    this.updateFormatBtn();
    this.modal.classList.remove(CSS_CLASSES.HIDDEN);
    this.render();
  }

  close() {
    if (!this.modal) return;
    this.modal.classList.add(CSS_CLASSES.HIDDEN);

    if (typeof this.ensureEditable === "function" && this.ensureEditable({ silent: true }) && typeof this.scheduleSave === "function") {
      this.scheduleSave();
    }
  }

  handleDateChange(e) {
    if (!this.ensureEditable || !this.ensureEditable()) {
      const state = this.getState();
      e.target.value = (state.mp && state.mp.d) || new Date().toISOString().split("T")[0];
      return;
    }
    const state = this.getState();
    if (!state.mp) {
      this.updateState("mp", { h: null, z: [], s: null, d: null, f24: false });
    }
    this.updateState("mp", { ...state.mp, d: e.target.value });
    this.scheduleSave();
    this.render();
  }

  handleTzInput(e) {
    const term = e.target.value.trim().toLowerCase();
    if (!this.tzResultsList) return;

    if (term.length < MIN_SEARCH_LENGTH) {
      this.tzResultsList.innerHTML = "";
      this.tzResultsList.classList.add(CSS_CLASSES.HIDDEN);
      return;
    }

    const state = this.getState();
    const offsetQuery = parseOffsetSearchTerm(term);
    const existing = new Set([state.mp.h, ...state.mp.z]);

    const matches = AVAILABLE_ZONES.filter((zone) => {
      if (existing.has(zone)) return false;
      const zoneLower = zone.toLowerCase();
      if (zoneLower.includes(term)) return true;

      // Offset match
      if (offsetQuery) {
        const zoneOffset = getZoneInfo(zone).offset;
        const normalized = `${offsetQuery.hours}:${String(offsetQuery.minutes).padStart(2, "0")}`;
        if (offsetQuery.hasMinutes) {
          if (offsetQuery.sign) return zoneOffset === `${offsetQuery.sign}${normalized}`;
          return zoneOffset === `+${normalized}` || zoneOffset === `-${normalized}`;
        }
        if (offsetQuery.sign) return zoneOffset.startsWith(`${offsetQuery.sign}${offsetQuery.hours}`);
        return zoneOffset.startsWith(`+${offsetQuery.hours}`) || zoneOffset.startsWith(`-${offsetQuery.hours}`);
      }
      return false;
    }).slice(0, MAX_TZ_RESULTS);

    this.renderTzResults(matches);
  }

  renderTzResults(results) {
    if (!this.tzResultsList) return;
    this.tzResultsList.innerHTML = "";

    if (!results.length) {
      this.tzResultsList.classList.add(CSS_CLASSES.HIDDEN);
      return;
    }

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

      button.addEventListener("click", () => {
        this.addZone(zone);
        this.tzResultsList.classList.add(CSS_CLASSES.HIDDEN);
        if (this.addZoneInput) this.addZoneInput.value = "";
      });

      li.appendChild(button);
      this.tzResultsList.appendChild(li);
    });

    this.tzResultsList.classList.remove(CSS_CLASSES.HIDDEN);
  }

  addZone(zone) {
    if (!this.ensureEditable || !this.ensureEditable()) return;
    const state = this.getState();
    if (state.mp.h !== zone && !state.mp.z.includes(zone)) {
      const newZ = [...state.mp.z, zone];
      this.updateState("mp", { ...state.mp, z: newZ });
      this.scheduleSave();
      this.render();
    }
  }

  handleGridClick(e) {
    if (!this.ensureEditable || !this.ensureEditable()) return;
    const btn = e.target.closest(".wp-control-btn");
    if (!btn) return;

    const action = btn.dataset.action;
    const zone = btn.dataset.zone;
    const state = this.getState();

    if (action === "remove") {
      const newZ = state.mp.z.filter((z) => z !== zone);
      this.updateState("mp", { ...state.mp, z: newZ });
      this.scheduleSave();
      this.render();
    } else if (action === "promote") {
      const oldHome = state.mp.h;
      const newZ = state.mp.z.filter((z) => z !== zone);
      if (oldHome) newZ.unshift(oldHome);
      this.updateState("mp", { ...state.mp, h: zone, z: newZ });
      this.scheduleSave();
      this.render();
    }
  }

  handleGridDblClick(e) {
    if (!this.ensureEditable || !this.ensureEditable()) return;
    const cell = e.target.closest(".wp-cell");
    if (!cell) return;

    const hIndex = Number(cell.dataset.h);
    const baseDate = this.getPlannerDate();
    const ts = baseDate.getTime() + hIndex * MS_PER_HOUR;

    if (this.openEventModal) {
      this.close(); // Close planner so event modal is visible
      this.openEventModal({ date: new Date(ts) });
    }
  }

  getPlannerDate() {
    const state = this.getState();
    return state.mp.d ? new Date(state.mp.d) : new Date();
  }

  render() {
    if (!this.grid) return;

    this.grid.innerHTML = "";
    const state = this.getState();

    // 1. Build City Column
    const cityCol = document.createElement("div");
    cityCol.className = "city-col";

    // Home Row
    if (state.mp.h) {
      cityCol.appendChild(this.createCityHeader(state.mp.h, true));
    }

    // Zones
    state.mp.z.forEach((zone) => {
      cityCol.appendChild(this.createCityHeader(zone, false));
    });

    this.grid.appendChild(cityCol);

    // 2. Build Timeline Column
    const timelineCol = document.createElement("div");
    timelineCol.className = "timeline-col";

    const track = document.createElement("div");
    track.className = "timeline-track";

    // Scrubber Overlay
    const scrubber = document.createElement("div");
    scrubber.className = "scrubber-overlay hidden";
    scrubber.id = "wp-scrubber";
    track.appendChild(scrubber);

    const ghost = document.createElement("div");
    ghost.className = "ghost-scrubber hidden";
    ghost.id = "wp-ghost";
    track.appendChild(ghost);

    // Render Rows
    const baseDate = this.getPlannerDate();

    if (state.mp.h) {
      track.appendChild(this.createRow(state.mp.h, baseDate, true));
    }
    state.mp.z.forEach((zone) => {
      track.appendChild(this.createRow(zone, baseDate, false));
    });

    timelineCol.appendChild(track);
    this.grid.appendChild(timelineCol);

    // Restore selection if any
    if (state.mp.s) {
      this.updateScrubberPosition();
    }
  }

  createCityHeader(zone, isHome) {
    const div = document.createElement("div");
    div.className = `wp-row-header${isHome ? " home-row" : ""}`;

    const info = getZoneInfo(zone);

    // Controls
    if (!isHome) {
      const controls = document.createElement("div");
      controls.className = "wp-row-controls";
      controls.innerHTML = `
        <button class="wp-control-btn" data-action="promote" data-zone="${zone}" title="Make Home"><i class="fa-solid fa-arrow-up"></i></button>
        <button class="wp-control-btn" data-action="remove" data-zone="${zone}" title="Remove"><i class="fa-solid fa-xmark"></i></button>
      `;
      div.appendChild(controls);
    } else {
      // Home icon
      const icon = document.createElement("div");
      icon.style.position = "absolute";
      icon.style.top = "6px";
      icon.style.right = "6px";
      icon.innerHTML = `<i class="fa-solid fa-house wp-home-icon"></i>`;
      div.appendChild(icon);
    }

    const nameRow = document.createElement("div");
    nameRow.className = "wp-city-name";
    nameRow.textContent = info.name;

    const timeRow = document.createElement("div");
    timeRow.className = "wp-city-time";
    timeRow.textContent = info.time;

    const badge = document.createElement("div");
    badge.className = "wp-offset-badge";
    badge.textContent = `UTC${info.offset}`;

    div.append(badge, nameRow, timeRow);
    return div;
  }

  createRow(zone, baseDate, isHome) {
    const row = document.createElement("div");
    row.className = "wp-row-cells";

    const state = this.getState();
    const homeZone = state.mp.h;
    if (!homeZone) return row;

    const homeInfo = getZoneInfo(homeZone);
    const targetInfo = getZoneInfo(zone);

    const parseOff = (s) => {
      const sign = s[0] === "-" ? -1 : 1;
      const [hh, mm] = s.slice(1).split(":").map(Number);
      return sign * (hh * 60 + mm);
    };

    const hOff = parseOff(homeInfo.offset);
    const tOff = parseOff(targetInfo.offset);
    const diffMins = tOff - hOff;

    const is24h = !!state.mp.f24;

    for (let h = 0; h < PLANNER_HOURS_PER_DAY; h++) {
      const cell = document.createElement("div");

      let targetMins = h * 60 + diffMins;
      let dayShift = 0;
      if (targetMins < 0) {
        targetMins += 24 * 60;
        dayShift = -1;
      } else if (targetMins >= 24 * 60) {
        targetMins -= 24 * 60;
        dayShift = 1;
      }

      const tHour = Math.floor(targetMins / 60);
      const tMin = targetMins % 60;

      let cls = "wp-cell";
      if (tHour >= PLANNER_BUSINESS_HOUR_START && tHour <= PLANNER_BUSINESS_HOUR_END) cls += " business";
      else if (tHour >= PLANNER_ACTIVE_HOUR_START && tHour <= PLANNER_ACTIVE_HOUR_END) cls += " active";
      else cls += " sleep";

      if (tHour === 0 && tMin === 0) {
        cls += " date-boundary";
      }

      // Highlight current time slot
      const now = new Date();
      const currentZoneTime = new Date(now.toLocaleString("en-US", { timeZone: zone }));
      const currentHour = currentZoneTime.getHours();
      const currentMin = currentZoneTime.getMinutes();
      
      if (tHour === currentHour && Math.abs(tMin - currentMin) < 30) {
        cls += " current";
      }

      cell.className = cls;
      cell.dataset.h = h;

      if (tHour === 0 && tMin === 0) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + dayShift);
        cell.textContent = d.toLocaleDateString("en-US", { day: "numeric", month: "short" }).toUpperCase();
      } else {
        if (is24h) {
          cell.textContent = tMin > 0 ? `${tHour}:${String(tMin).padStart(2, "0")}` : `${tHour}`;
        } else {
          const ampm = tHour >= 12 ? "pm" : "am";
          const h12 = tHour % 12 || 12;
          if (tMin > 0) {
            cell.textContent = `${h12}:${String(tMin).padStart(2, "0")}`;
          } else {
            // Only show am/pm for home zone
            cell.textContent = isHome ? `${h12} ${ampm}` : `${h12}`;
          }
        }
      }
      row.appendChild(cell);
    }
    return row;
  }

  handleScrubberMove(e) {
    const track = this.grid ? this.grid.querySelector(".timeline-track") : null;
    const ghost = document.getElementById("wp-ghost");
    if (!track || !ghost) return;

    const cell = e.target.closest(".wp-cell");
    if (!cell) {
      ghost.classList.add(CSS_CLASSES.HIDDEN);
      return;
    }

    ghost.style.left = `${cell.offsetLeft}px`;
    ghost.classList.remove(CSS_CLASSES.HIDDEN);
  }

  handleScrubberClick(e) {
    if (!this.ensureEditable || !this.ensureEditable()) return;
    const cell = e.target.closest(".wp-cell");
    if (!cell) return;

    const hIndex = Number(cell.dataset.h);
    const baseDate = this.getPlannerDate();
    const ts = baseDate.getTime() + hIndex * MS_PER_HOUR;

    const state = this.getState();
    this.updateState("mp", { ...state.mp, s: ts });
    this.scheduleSave();
    this.updateScrubberPosition();
  }

  updateScrubberPosition() {
    const scrubber = document.getElementById("wp-scrubber");
    const state = this.getState();
    if (!scrubber || !state.mp || !state.mp.s) {
      if (scrubber) scrubber.classList.add(CSS_CLASSES.HIDDEN);
      return;
    }

    const baseDate = this.getPlannerDate();
    const diff = state.mp.s - baseDate.getTime();
    const hIndex = Math.floor(diff / MS_PER_HOUR);

    if (hIndex >= 0 && hIndex < PLANNER_HOURS_PER_DAY) {
      const cell = this.grid ? this.grid.querySelector(`.wp-cell[data-h="${hIndex}"]`) : null;
      if (cell) {
        scrubber.style.left = `${cell.offsetLeft}px`;
        scrubber.classList.remove(CSS_CLASSES.HIDDEN);
      }
    } else {
      scrubber.classList.add(CSS_CLASSES.HIDDEN);
    }
  }

  toggleFormat() {
    if (!this.ensureEditable || !this.ensureEditable()) return;
    const state = this.getState();
    if (!state.mp) return;
    this.updateState("mp", { ...state.mp, f24: !state.mp.f24 });
    this.updateFormatBtn();
    this.scheduleSave();
    this.render();
  }

  updateFormatBtn() {
    const btn = document.getElementById("wp-format-toggle");
    const state = this.getState();
    if (btn) {
      btn.textContent = state.mp && state.mp.f24 ? "24h" : "12h";
    }
  }
}
