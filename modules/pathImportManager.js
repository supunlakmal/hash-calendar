function isPathDateSegment(yearText, monthText, dayText) {
  if (!/^\d{4}$/.test(yearText) || !/^\d{1,2}$/.test(monthText) || !/^\d{1,2}$/.test(dayText)) {
    return false;
  }

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function getAppBasePath(pathname) {
  const segments = String(pathname || "").split("/").filter(Boolean);
  let startIndex = -1;

  for (let i = 0; i <= segments.length - 3; i += 1) {
    if (isPathDateSegment(segments[i], segments[i + 1], segments[i + 2])) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === -1) {
    return pathname || "/";
  }

  const baseSegments = segments.slice(0, startIndex);
  return `/${baseSegments.join("/")}${baseSegments.length ? "/" : ""}`;
}

function cleanUrlAfterImport(creationSource, locationObj = window.location, historyObj = window.history) {
  const search = locationObj.search || "";
  if (creationSource === "hash") {
    historyObj.replaceState({}, "", `${locationObj.pathname}${search}`);
  } else if (creationSource === "pathname") {
    const hash = locationObj.hash || "";
    const basePath = getAppBasePath(locationObj.pathname);
    historyObj.pushState({}, "", `${basePath}${search}${hash}`);
  }
}

export function getCreationHashPath(locationObj = window.location) {
  const rawHash = locationObj.hash.startsWith("#") ? locationObj.hash.slice(1) : locationObj.hash;
  if (!rawHash || rawHash === "/") return "";
  return rawHash.startsWith("/") ? rawHash : "";
}

export async function importEventsFromPath({
  locationObj = window.location,
  historyObj = window.history,
  parsePathToEventEntries,
  isCalendarLocked,
  isReadOnlyMode,
  onEntriesImported,
  onFirstEntryImported,
  clearPendingSave,
  persistStateToHash,
} = {}) {
  if (typeof isCalendarLocked === "function" && isCalendarLocked()) return 0;
  if (typeof isReadOnlyMode === "function" && isReadOnlyMode()) return 0;
  if (typeof parsePathToEventEntries !== "function") return 0;

  let entries = parsePathToEventEntries(locationObj.pathname);
  let creationSource = entries.length ? "pathname" : null;

  if (!entries.length) {
    const hashPath = getCreationHashPath(locationObj);
    if (hashPath) {
      entries = parsePathToEventEntries(hashPath);
      creationSource = entries.length ? "hash" : null;
    }
  }

  if (!entries.length) return 0;

  if (typeof onEntriesImported === "function") {
    onEntriesImported(entries);
  }

  const firstStartMin = Number(entries[0][0]);
  if (Number.isFinite(firstStartMin) && typeof onFirstEntryImported === "function") {
    onFirstEntryImported(firstStartMin);
  }

  cleanUrlAfterImport(creationSource, locationObj, historyObj);

  if (typeof clearPendingSave === "function") clearPendingSave();
  if (typeof persistStateToHash === "function") await persistStateToHash();
  return entries.length;
}
