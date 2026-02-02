
/* --- World Planner Logic --- */

function initWorldPlanner() {
  if (ui.worldPlannerBtn) {
    ui.worldPlannerBtn.addEventListener("click", openWorldPlanner);
  }
  if (ui.wpClose) {
    ui.wpClose.addEventListener("click", closeWorldPlanner);
  }
  if (ui.wpAddZone) {
    ui.wpAddZone.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handlePlannerAddZone();
    });
  }
  if (ui.wpGrid) {
    ui.wpGrid.addEventListener("mousemove", handleScrubberMove);
    ui.wpGrid.addEventListener("click", handleScrubberClick);
    ui.wpGrid.addEventListener("click", handlePlannerGridClick);
  }
  if (ui.wpDatePicker) {
    ui.wpDatePicker.addEventListener("change", (e) => {
      if (!state.mp) state.mp = { h: null, z: [], s: null, d: null };
      state.mp.d = e.target.value;
      scheduleSave();
      renderWorldPlanner();
    });
  }
  if (ui.wpCopyLink) {
    ui.wpCopyLink.addEventListener("click", handleCopyLink);
  }
}

function openWorldPlanner() {
  if (!ui.worldPlannerModal) return;
  
  // Initialize state if empty
  if (!state.mp || (!state.mp.home && !state.mp.z.length)) {
    const local = getLocalZone();
    state.mp = {
      h: local,
      z: ["UTC", "America/New_York", "Asia/Tokyo", "Europe/London"].filter(z => z !== local).slice(0, 3),
      s: null,
      d: new Date().toISOString().split("T")[0]
    };
  }
  
  // Set date picker
  if (ui.wpDatePicker) {
    ui.wpDatePicker.value = state.mp.d || new Date().toISOString().split("T")[0];
  }

  ui.worldPlannerModal.classList.remove("hidden");
  renderWorldPlanner();
}

function closeWorldPlanner() {
  if (ui.worldPlannerModal) {
    ui.worldPlannerModal.classList.add("hidden");
  }
  scheduleSave();
}

function handlePlannerAddZone() {
  const val = ui.wpAddZone.value.trim();
  if (!val) return;
  // Simple search match for now
  const match = AVAILABLE_ZONES.find(z => z.toLowerCase().includes(val.toLowerCase()));
  
  if (match) {
    if (state.mp.h !== match && !state.mp.z.includes(match)) {
      state.mp.z.push(match);
      scheduleSave();
      renderWorldPlanner();
      ui.wpAddZone.value = "";
    }
  } else {
    showToast(t("planner.notFound"), "error");
  }
}

function handlePlannerGridClick(e) {
  // Handle remove/promote buttons
  const btn = e.target.closest(".wp-control-btn");
  if (!btn) return;
  
  const action = btn.dataset.action;
  const zone = btn.dataset.zone;
  
  if (action === "remove") {
    state.mp.z = state.mp.z.filter(z => z !== zone);
    scheduleSave();
    renderWorldPlanner();
  } else if (action === "promote") {
    const oldHome = state.mp.h;
    state.mp.h = zone;
    state.mp.z = state.mp.z.filter(z => z !== zone);
    if (oldHome) state.mp.z.unshift(oldHome);
    scheduleSave();
    renderWorldPlanner();
  }
}

function getPlannerDate() {
  return state.mp.d ? new Date(state.mp.d) : new Date();
}

function renderWorldPlanner() {
  if (!ui.wpGrid) return;
  
  ui.wpGrid.innerHTML = "";
  
  // 1. Build City Column
  const cityCol = document.createElement("div");
  cityCol.className = "city-col";
  
  // Home Row
  if (state.mp.h) {
    cityCol.appendChild(createPlannerCityHeader(state.mp.h, true));
  }
  
  // Zones
  state.mp.z.forEach(zone => {
    cityCol.appendChild(createPlannerCityHeader(zone, false));
  });
  
  ui.wpGrid.appendChild(cityCol);
  
  // 2. Build Timeline Column
  const timelineCol = document.createElement("div");
  timelineCol.className = "timeline-col";
  
  const track = document.createElement("div");
  track.className = "timeline-track";
  
  // Scrubber Overlay
  const scrubber = document.createElement("div");
  scrubber.className = "scrubber-overlay hidden"; // Hidden until hover/select
  scrubber.id = "wp-scrubber";
  track.appendChild(scrubber);
  
  const ghost = document.createElement("div");
  ghost.className = "ghost-scrubber hidden";
  ghost.id = "wp-ghost";
  track.appendChild(ghost);
  
  // Render Rows
  const baseDate = getPlannerDate(); // This is "Day 0" at 00:00 relative to Home Zone?
  // Actually WTB usually shows 24h starting from "now" or 00:00 of selected day.
  // Let's stick to 00:00 - 23:00 of the selected date in HOME zone.
  
  if (state.mp.h) {
    track.appendChild(createPlannerRow(state.mp.h, baseDate, true));
  }
  state.mp.z.forEach(zone => {
    track.appendChild(createPlannerRow(zone, baseDate, false));
  });
  
  timelineCol.appendChild(track);
  ui.wpGrid.appendChild(timelineCol);
  
  // Restore selection if any
  if (state.mp.s) {
    // If selected time exists, position scrubber
    // Calculate which slot index corresponds to state.mp.s (timestamp)
    // But wait, the grid is fixed 0-23h of the HOME DAY.
    // So 's' must be converted to an hour index relative to Home 00:00.
    
    // We update logic later. For now, let's just render.
    updateScrubberPositionFromState();
  }
}

function createPlannerCityHeader(zone, isHome) {
  const div = document.createElement("div");
  div.className = `wp-row-header${isHome ? " home-row" : ""}`;
  
  const info = getZoneInfo(zone); // existing helper
  
  // Controls
  if (!isHome) {
    const controls = document.createElement("div");
    controls.className = "wp-row-controls";
    controls.innerHTML = `
      <button class="wp-control-btn" data-action="promote" data-zone="${zone}" title="${t('planner.homeTitle')}"><i class="fa-solid fa-arrow-up"></i></button>
      <button class="wp-control-btn" data-action="remove" data-zone="${zone}" title="${t('planner.removeTitle')}"><i class="fa-solid fa-xmark"></i></button>
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
  timeRow.textContent = info.time; // Current time
  
  const badge = document.createElement("div");
  badge.className = "wp-offset-badge";
  badge.textContent = `UTC${info.offset}`;

  div.append(badge, nameRow, timeRow);
  return div;
}

function createPlannerRow(zone, baseDate, isHome) {
  const row = document.createElement("div");
  row.className = "wp-row-cells";
  
  // Calculate offset relative to Home
  // This is tricky. simpler to just iterate 0..23 hours of the Base Date in Home Zone,
  // and convert each to the target Zone.
  
  const homeZone = state.mp.h;
  if (!homeZone) return row;
  
  // Construct the 24 hours in Home Zone
  // Helper to format date in specific zone
  const fmt = (date, z) => new Intl.DateTimeFormat("en-US", {
    timeZone: z,
    hour: "numeric",
    hour12: true,
    weekday: "short",
    day: "numeric",
    month: "short"
  });
  
  const getParts = (date, z) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: z,
      hour: "numeric",
      hourCycle: "h23",
      weekday: "short",
      day: "numeric",
      month: "short"
    }).formatToParts(date);
    const p = {};
    parts.forEach(x => p[x.type] = x.value);
    return p;
  };

  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();

  for (let h = 0; h < 24; h++) {
    const cell = document.createElement("div");
    
    // Create a date object that corresponds to Year-Month-Day Hour:00:00 in HOME zone.
    // We can't just new Date() because that uses local.
    // We need to find the timestamp that corresponds to that wall time.
    // Hack: use a library or localized string parsing.
    // Since we don't have Moment/Luxon, we use the "date string hack".
    
    const isoString = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(h).padStart(2,'0')}:00:00`;
    // Create date as if it's UTC, then shift by offset? No.
    // Use formatToParts on a guessed timestamp until it matches? Expensive.
    
    // Easier approach:
    // 1. Get offset of Home Zone for that date.
    // 2. Get offset of Target Zone.
    // 3. Difference is the shift.
    
    // Actually, simply iterating standard UTC timestamps starting from the Home Zone's start of day is safest.
    // Let's find Home Zone's start of day timestamp.
    const homeStartStr = new Date(year, month, day).toLocaleString("en-US", { timeZone: homeZone });
    // This doesn't give me the timestamp.
    
    // Let's just mock it by iterating 24 hours from a base UTC time and adjusting display?
    // No, "Exact Match" requires correct hours.
    
    // Efficient Native way:
    // Create an arbitrary UTC date. Format it to Home Zone. See if it matches 00:00.
    // Better:
    // `new Date(string)` parses as local.
    // Use `toLocaleString` to get the wall time in a zone.
    
    // Optimization:
    // Just loop 0..23 integers.
    // For the Home Row, cells are just 0..23.
    // For Other Rows:
    //   Calculate offset diff.
    //   TargetHour = (HomeHour - HomeOffset + TargetOffset) % 24.
    
    // Getting offsets in JS native is `getTimezoneOffset` but that's only for local.
    // For arbitrary zones, we can use the formatted string 'GMT-5' etc from `getZoneInfo` helper.
    // Helper `getZoneInfo(zone)` returns `{ offset: "+05:30", ... }`.
    
    const homeInfo = getZoneInfo(homeZone);
    const targetInfo = getZoneInfo(zone);
    
    // Parse offsets to minutes
    const parseOff = (s) => {
        const sign = s[0] === '-' ? -1 : 1;
        const [hh, mm] = s.slice(1).split(':').map(Number);
        return sign * (hh * 60 + mm);
    };
    
    const hOff = parseOff(homeInfo.offset); // e.g. +330
    const tOff = parseOff(targetInfo.offset); // e.g. -300
    
    const diffMins = tOff - hOff; // Difference in minutes
    
    // Target time in minutes from start of day = (h * 60) + diffMins
    let targetMins = (h * 60) + diffMins;
    
    // Normalize to day boundaries
    let dayShift = 0;
    if (targetMins < 0) {
        targetMins += 24 * 60;
        dayShift = -1;
    } else if (targetMins >= 24 * 60) {
        targetMins -= 24 * 60;
        dayShift = 1;
    }
    
    const tHour = Math.floor(targetMins / 60);
    const tMin = targetMins % 60; // Usually 0 or 30 or 45
    
    // Class logic
    let cls = "wp-cell";
    // Business: 9-17 (Standard) or 8-18? Req says 8-17 business, 18-22 active.
    // Using Target Hour.
    if (tHour >= 8 && tHour <= 17) cls += " business";
    else if (tHour >= 18 && tHour <= 22) cls += " active";
    else cls += " sleep";
    
    if (dayShift !== 0 && h === 0) {
       // Start of row shows date if different? 
    }
    
    // Crossing midnight logic for cell style
    if (tHour === 0 && tMin === 0) {
        cls += " date-boundary";
        // Show date
        // Calculate date string
        // If dayShift is 1, it's Next Day.
    }
    
    cell.className = cls;
    cell.dataset.h = h; // Home Hour index
    
    // Content
    if (tHour === 0 && tMin === 0) {
        // Show date abbrev
        const d = new Date(baseDate);
        d.setDate(d.getDate() + dayShift);
        const translatedMonth = getTranslatedMonthName(d, true);
        cell.textContent = `${translatedMonth} ${d.getDate()}`.toUpperCase();
    } else {
        // Format: "9 am" or "14:30"
        let label = "";
        const ampm = tHour >= 12 ? "pm" : "am";
        const h12 = tHour % 12 || 12;
        if (tMin > 0) {
            label = `${h12}:${String(tMin).padStart(2,'0')}`; // Space tight
        } else {
            label = `${h12} ${ampm}`;
        }
        // Compact for cells
        if (isHome) {
             cell.textContent = tMin > 0 ? `${h12}:${tMin}` : `${h12} ${ampm}`;
        } else {
             cell.textContent = tMin > 0 ? `${h12}:${tMin}` : `${h12}`; // Just number for comparison rows to save space?
        }
    }
    
    row.appendChild(cell);
  }
  
  return row;
}

function handleScrubberMove(e) {
  const track = ui.wpGrid.querySelector(".timeline-track");
  const ghost = document.getElementById("wp-ghost");
  if (!track || !ghost) return;
  
  // Calculate index
  const rect = track.getBoundingClientRect();
  const x = e.clientX - rect.left - track.scrollLeft; // Adjust for scroll? 
  // Wait, track scrolls. `e.clientX` is viewport. `rect.left` is viewport. 
  // Inside `timeline-col`, `timeline-track` might be wide.
  // Actually the hover is relative to the `timeline-truck` element? 
  
  // The event listener is on `wpGrid`.
  // We need to find the `.wp-cell` under mouse.
  const cell = e.target.closest(".wp-cell");
  if (!cell) {
    ghost.classList.add("hidden");
    return;
  }
  
  const widthStr = window.getComputedStyle(cell).width; // e.g. "40px"
  // Actually simpler: cell.offsetLeft
  ghost.style.left = `${cell.offsetLeft}px`;
  ghost.classList.remove("hidden");
}

function handleScrubberClick(e) {
  const cell = e.target.closest(".wp-cell");
  if (!cell) return;
  
  const hIndex = cell.dataset.h;
  // Set selection state
  // Convert hIndex (0..23) of Home Zone to Timestamp
  // We need a timestamp for persistence.
  // timestamp = startOfBaseDate(HomeZone) + hIndex * 3600 * 1000
  
  // For now simple numeric logic? The schema calls for 'sel' as timestamp.
  const baseDate = getPlannerDate();
  // Assume HomeZone start of day + hIndex hours.
  // Approximation for prototype:
  const ts = baseDate.getTime() + (hIndex * 3600 * 1000); 
  
  state.mp.s = ts;
  scheduleSave();
  
  updateScrubberPositionFromState();
}

function updateScrubberPositionFromState() {
  const scrubber = document.getElementById("wp-scrubber");
  if (!scrubber || !state.mp.s) {
      if (scrubber) scrubber.classList.add("hidden");
      return;
  }
  
  // Convert state.mp.s to hour index
  const baseDate = getPlannerDate();
  const diff = state.mp.s - baseDate.getTime();
  const hIndex = Math.floor(diff / (3600 * 1000));
  
  if (hIndex >= 0 && hIndex < 24) {
      // Find a cell with this index
      // Since all rows are aligned, any row's cell works.
      const cell = ui.wpGrid.querySelector(`.wp-cell[data-h="${hIndex}"]`);
      if (cell) {
          scrubber.style.left = `${cell.offsetLeft}px`;
          scrubber.classList.remove("hidden");
      }
  }
}
