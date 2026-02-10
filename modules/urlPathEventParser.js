import { DEFAULT_EVENT_DURATION, MS_PER_MINUTE } from "./constants.js";

const DEFAULT_URL_EVENT_TITLE = "New Event (URL)";

function safeDecodePath(path) {
  try {
    return decodeURIComponent(String(path || ""));
  } catch (error) {
    return String(path || "");
  }
}

function toInteger(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function normalizeTitle(parts) {
  const title = parts.join(" ").replace(/-/g, " ").trim();
  return title || DEFAULT_URL_EVENT_TITLE;
}

function parseTimeParts(hourText, minuteText) {
  const hour = toInteger(hourText);
  if (hour === null || hour > 23) return null;
  if (typeof minuteText !== "string" || minuteText.length === 0) return null;

  let minuteRaw = minuteText;
  let duration = DEFAULT_EVENT_DURATION;

  if (minuteText.includes("+")) {
    const pieces = minuteText.split("+");
    if (pieces.length !== 2) return null;
    minuteRaw = pieces[0];
    const parsedDuration = toInteger(pieces[1]);
    if (parsedDuration === null) return null;
    duration = Math.max(1, parsedDuration);
  }

  const minute = toInteger(minuteRaw);
  if (minute === null || minute > 59) return null;

  return { hour, minute, duration };
}

function findDateStart(parts) {
  for (let i = 0; i <= parts.length - 3; i += 1) {
    const year = toInteger(parts[i]);
    const month = toInteger(parts[i + 1]);
    const day = toInteger(parts[i + 2]);
    if (isValidDate(year, month, day)) {
      return i;
    }
  }
  return -1;
}

function parseEventBlock(block) {
  const rawParts = block.split("/").filter((part) => part.length > 0);
  if (rawParts.length < 3) return null;

  const dateStart = findDateStart(rawParts);
  if (dateStart === -1) return null;

  const parts = rawParts.slice(dateStart);
  const year = toInteger(parts[0]);
  const month = toInteger(parts[1]);
  const day = toInteger(parts[2]);
  if (!isValidDate(year, month, day)) return null;

  let startDate = new Date(year, month - 1, day);
  let duration = 0;
  let titleParts = parts.slice(3);

  if (parts.length >= 5) {
    const time = parseTimeParts(parts[3], parts[4]);
    if (time) {
      startDate = new Date(year, month - 1, day, time.hour, time.minute);
      duration = time.duration;
      titleParts = parts.slice(5);
    }
  }

  const title = normalizeTitle(titleParts);
  const startMin = Math.floor(startDate.getTime() / MS_PER_MINUTE);
  return [startMin, duration, title, 0];
}

export function parsePathToEventEntries(path) {
  const decodedPath = safeDecodePath(path);
  const cleanPath = decodedPath.replace(/^\/+|\/+$/g, "").trim();
  if (!cleanPath) return [];

  return cleanPath
    .split(",")
    .map((block) => block.trim())
    .filter(Boolean)
    .map(parseEventBlock)
    .filter((entry) => Array.isArray(entry));
}
