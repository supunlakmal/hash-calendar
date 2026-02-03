import { OFFSET_MAX_HOURS, OFFSET_MAX_MINUTES } from "./constants.js";

const supportedZones =
  typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

export const AVAILABLE_ZONES = Array.isArray(supportedZones) ? supportedZones : [];

function formatDateKey(date, timeZone) {
  const options = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  if (timeZone) options.timeZone = timeZone;
  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(date);
  const lookup = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      lookup[part.type] = part.value;
    }
  });
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function getOffsetMinutes(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const lookup = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      lookup[part.type] = part.value;
    }
  });
  const hourValue = lookup.hour === "24" ? "00" : lookup.hour;
  const asUtc = Date.UTC(
    Number(lookup.year),
    Number(lookup.month) - 1,
    Number(lookup.day),
    Number(hourValue),
    Number(lookup.minute),
    Number(lookup.second),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

function formatUtcOffset(offsetMinutes) {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  return `${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}

export function getZoneInfo(zoneName) {
  const now = new Date();

  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone: zoneName,
    hour: "numeric",
    minute: "2-digit",
  });

  const localDateKey = formatDateKey(now);
  const targetDateKey = formatDateKey(now, zoneName);
  const offsetMinutes = getOffsetMinutes(now, zoneName);
  const offsetLabel = formatUtcOffset(offsetMinutes);

  let dayDiffLabel = "";
  if (targetDateKey > localDateKey) dayDiffLabel = "Tomorrow";
  else if (targetDateKey < localDateKey) dayDiffLabel = "Yesterday";

  return {
    name: zoneName.split("/").pop().replace(/_/g, " "),
    fullZone: zoneName,
    time: timeFormatter.format(now),
    dayDiff: dayDiffLabel,
    offset: offsetLabel,
  };
}

export function isValidZone(zoneName) {
  if (!zoneName || typeof zoneName !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: zoneName });
    return true;
  } catch (error) {
    return false;
  }
}

export function getLocalZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function parseOffsetSearchTerm(raw) {
  if (!raw) return null;
  let term = raw.toLowerCase().replace(/\s+/g, "");
  let hasPrefix = false;
  if (term.startsWith("utc")) {
    term = term.slice(3);
    hasPrefix = true;
  } else if (term.startsWith("gmt")) {
    term = term.slice(3);
    hasPrefix = true;
  }
  if (!term) return null;

  let sign = null;
  if (term.startsWith("+") || term.startsWith("-")) {
    sign = term[0];
    term = term.slice(1);
  }

  const hasSeparator = term.includes(":") || term.includes(".");

  let hours = null;
  let minutes = null;
  let hasMinutes = false;

  if (hasSeparator) {
    const parts = term.split(/[:.]/);
    if (parts.length !== 2) return null;
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
    hasMinutes = parts[1].length > 0;
  } else if (/^\d{1,2}$/.test(term)) {
    hours = Number(term);
    minutes = 0;
  } else if (/^\d{3,4}$/.test(term)) {
    const padded = term.padStart(4, "0");
    hours = Number(padded.slice(0, 2));
    minutes = Number(padded.slice(2));
    hasMinutes = true;
  } else {
    return null;
  }

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > OFFSET_MAX_HOURS || minutes > OFFSET_MAX_MINUTES) return null;

  const signChar = sign || "+";
  const value = `${signChar}${hours}:${String(minutes).padStart(2, "0")}`;
  return { value, sign, hours, minutes, hasMinutes };
}
