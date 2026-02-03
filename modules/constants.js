// Calendar Constants

// Default Color Palette
export const DEFAULT_COLORS = ["#ff6b6b", "#ffd43b", "#4dabf7", "#63e6be", "#9775fa"];

// View Types
export const DEFAULT_VIEW = "month";
export const VALID_VIEWS = new Set(["day", "week", "month", "year", "agenda"]);

// Default Application State
export const DEFAULT_STATE = {
  t: "hash-calendar",
  c: DEFAULT_COLORS,
  e: [],
  s: {
    d: 0,
    m: 0,
    v: DEFAULT_VIEW,
    l: "en",
    r: 0,
  },
  timezones: [],
  mp: { h: null, z: [], s: null, d: null },
};

// Timing Constants
export const DEBOUNCE_MS = 500;
export const TOAST_TIMEOUT_MS = 3200;
export const TIMEZONE_UPDATE_INTERVAL_MS = 60000;

// Length Limits
export const MAX_TITLE_LENGTH = 60;
export const MAX_EVENT_TITLE_LENGTH = 80;
export const MAX_TZ_RESULTS = 12;

// URL Constants
export const URL_LENGTH_WARNING_THRESHOLD = 2000;

// Messages
export const TZ_EMPTY_MESSAGE = "No matches yet. Try a city, region, or UTC+5:30.";

// Search/Filter Constants
export const MIN_SEARCH_LENGTH = 2;

// World Planner Constants
export const PLANNER_HOURS_PER_DAY = 24;
export const PLANNER_BUSINESS_HOUR_START = 8;
export const PLANNER_BUSINESS_HOUR_END = 17;
export const PLANNER_ACTIVE_HOUR_START = 18;
export const PLANNER_ACTIVE_HOUR_END = 22;
export const PLANNER_DEFAULT_ZONES = ["UTC", "America/New_York", "Asia/Tokyo", "Europe/London"];
export const PLANNER_MAX_ZONES = 3;

// Time Constants
export const MINUTES_PER_HOUR = 60;
export const MS_PER_MINUTE = 60000;
export const MS_PER_HOUR = 3600000;
export const MINUTES_PER_DAY = 1440;

// Default Event Values
export const DEFAULT_EVENT_DURATION = 60;

// CSS Class Names
export const CSS_CLASSES = {
  HIDDEN: "hidden",
  ACTIVE: "active",
  IS_ACTIVE: "is-active",
  IS_SELECTED: "is-selected",
  IS_ACTIVE_TOGGLE: "is-active-toggle",
  RIPPLE: "ripple",
  VIEW_ANIMATE_OUT: "view-animate-out",
  VIEW_ANIMATE_IN: "view-animate-in",
};

// Regex Patterns
export const COLOR_REGEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Offset Parsing
export const OFFSET_MAX_HOURS = 14;
export const OFFSET_MAX_MINUTES = 59;
