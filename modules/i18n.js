import en from "../locales/en.js";
import si from "../locales/si.js";
import ta from "../locales/ta.js";

const translations = { en, si, ta };
export const SUPPORTED_LANGUAGES = [
  { code: 'en', nameKey: 'lang.en' },
  { code: 'si', nameKey: 'lang.si' },
  { code: 'ta', nameKey: 'lang.ta' }
];
let currentLang = "en";
const updateCallbacks = [];

/**
 * Set the current language and update the DOM
 * @param {string} lang - Language code ('en' or 'si')
 */
export function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    document.documentElement.setAttribute('lang', lang === 'si' ? 'si' : 'en');
    localStorage.setItem("hashcal.language", lang);
    updateDOM();
    updateCallbacks.forEach(cb => cb(lang));
  }
}

/**
 * Register a callback to be called when the language changes
 * @param {Function} cb - Callback function
 */
export function onLanguageChange(cb) {
  updateCallbacks.push(cb);
}

/**
 * Get translation for a key with optional variable replacements
 * @param {string} key - Translation key
 * @param {Object} replacements - Variables to replace in the translation
 * @returns {string} Translated text
 */
export function t(key, replacements = {}) {
  let text = translations[currentLang][key] || key;
  Object.keys(replacements).forEach(varKey => {
    text = text.replace(new RegExp(`{{${varKey}}}`, 'g'), replacements[varKey]);
  });
  return text;
}

/**
 * Update all elements with data-i18n attributes
 */
export function updateDOM() {
  // Update text content
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });

  // Update placeholders
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
  });

  // Update aria-labels
  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label")));
  });
}

/**
 * Get current language code
 * @returns {string} Current language code ('en' or 'si')
 */
export function getCurrentLanguage() {
  return currentLang;
}

/**
 * Get current locale string for Intl API
 * @returns {string} Locale string ('en-US' or 'si-LK')
 */
export function getCurrentLocale() {
  if (currentLang === 'si') return 'si-LK';
  if (currentLang === 'ta') return 'ta-IN';
  return 'en-US';
}

// Date helpers using translations
const MONTH_KEYS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_KEYS_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_KEYS_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function getTranslatedMonthName(date, short = false) {
  const idx = date.getMonth();
  const key = short ? `month.short.${MONTH_KEYS_SHORT[idx]}` : `month.${MONTH_KEYS[idx]}`;
  return t(key);
}

export function getTranslatedWeekday(date, type = 'long') {
  const idx = date.getDay();
  if (type === 'narrow') {
    return t(`weekday.narrow.${DAY_KEYS_SHORT[idx]}`);
  }
  if (type === 'short') {
    return t(`weekday.short.${DAY_KEYS_SHORT[idx]}`);
  }
  return t(`weekday.${DAY_KEYS[idx]}`);
}

// Auto-initialize from localStorage or default to 'en'
const savedLang = localStorage.getItem("hashcal.language") || "en";
setLanguage(savedLang);
