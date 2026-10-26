/* Pure calculation and title formatting shared by the extension and tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CalendarHoursCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const defaults = Object.freeze({
    decimals: 2,
    rounding: "nearest",
    incrementMinutes: 1,
    trimZeros: true,
    unit: "hours",
    template: "({value} {unit})",
    keyword: "/hours",
    showSuggestion: true,
    automatic: false,
    autoWords: "block",
    keepUpdated: false,
    replaceExisting: true
  });

  function settingsFrom(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      ...defaults,
      decimals: Math.max(0, Math.min(4, Number.parseInt(source.decimals ?? defaults.decimals, 10) || 0)),
      rounding: ["nearest", "down", "up", "truncate"].includes(source.rounding) ? source.rounding : defaults.rounding,
      incrementMinutes: [1, 5, 10, 15, 30, 60].includes(Number(source.incrementMinutes)) ? Number(source.incrementMinutes) : defaults.incrementMinutes,
      trimZeros: typeof source.trimZeros === "boolean" ? source.trimZeros : defaults.trimZeros,
      unit: typeof source.unit === "string" && source.unit.trim() ? source.unit.trim().slice(0, 24) : defaults.unit,
      template: typeof source.template === "string" && source.template.includes("{value}") ? source.template.slice(0, 100) : defaults.template,
      keyword: typeof source.keyword === "string" && source.keyword.trim() ? source.keyword.trim().slice(0, 40) : defaults.keyword,
      showSuggestion: typeof source.showSuggestion === "boolean" ? source.showSuggestion : defaults.showSuggestion,
      automatic: typeof source.automatic === "boolean" ? source.automatic : defaults.automatic,
      autoWords: typeof source.autoWords === "string" ? source.autoWords.slice(0, 200) : defaults.autoWords,
      keepUpdated: typeof source.keepUpdated === "boolean" ? source.keepUpdated : defaults.keepUpdated,
      replaceExisting: source.keepUpdated === true ? true : (typeof source.replaceExisting === "boolean" ? source.replaceExisting : defaults.replaceExisting)
    };
  }

  function parseClock(text) {
    if (typeof text !== "string") return null;
    const normalized = text.trim().replace(/\s+/g, "").toLowerCase();
    const match = /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/.exec(normalized);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    if (minute > 59 || hour > (match[3] ? 12 : 23) || hour < (match[3] ? 1 : 0)) return null;
    if (match[3]) hour = (hour % 12) + (match[3] === "pm" ? 12 : 0);
    return { hour, minute };
  }

  function parseCalendarDate(text, dataDate, referenceYear) {
    if (typeof dataDate === "string" && /^\d{8}$/.test(dataDate)) {
      return { year: Number(dataDate.slice(0, 4)), month: Number(dataDate.slice(4, 6)), day: Number(dataDate.slice(6, 8)) };
    }
    if (typeof text !== "string" || !text.trim()) return null;
    const value = text.trim();
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
    if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
    const hasYear = /\b\d{4}\b/.test(value);
    const parsed = new Date(hasYear ? value : `${value}, ${referenceYear || new Date().getFullYear()}`);
    if (Number.isNaN(parsed.getTime())) return null;
    return { year: parsed.getFullYear(), month: parsed.getMonth() + 1, day: parsed.getDate() };
  }

  function durationMinutes(fields) {
    const startDate = parseCalendarDate(fields.startDate, fields.startDataDate, fields.referenceYear);
    const endDate = parseCalendarDate(fields.endDate || fields.startDate, fields.endDataDate, fields.referenceYear);
    const startClock = parseClock(fields.startTime);
    const endClock = parseClock(fields.endTime);
    if (!startDate || !endDate || !startClock || !endClock || fields.allDay) return null;
    const start = new Date(startDate.year, startDate.month - 1, startDate.day, startClock.hour, startClock.minute);
    const end = new Date(endDate.year, endDate.month - 1, endDate.day, endClock.hour, endClock.minute);
    if (start.getFullYear() !== startDate.year || start.getMonth() + 1 !== startDate.month || start.getDate() !== startDate.day) return null;
    if (end.getFullYear() !== endDate.year || end.getMonth() + 1 !== endDate.month || end.getDate() !== endDate.day) return null;
    const minutes = (end.getTime() - start.getTime()) / 60000;
    return Number.isFinite(minutes) && minutes > 0 && minutes <= 10080 ? minutes : null;
  }

  function roundNumber(value, precision, mode) {
    const factor = 10 ** precision;
    const scaled = value * factor;
    if (mode === "down") return Math.floor(scaled + 1e-9) / factor;
    if (mode === "up") return Math.ceil(scaled - 1e-9) / factor;
    if (mode === "truncate") return Math.trunc(scaled + 1e-9) / factor;
    return Math.round(scaled + 1e-9) / factor;
  }

  function formattedDuration(minutes, settings) {
    const cfg = settingsFrom(settings);
    if (!Number.isFinite(minutes) || minutes <= 0) return null;
    const increments = minutes / cfg.incrementMinutes;
    const roundedIncrements = cfg.rounding === "down" || cfg.rounding === "truncate"
      ? Math.floor(increments + 1e-9)
      : cfg.rounding === "up" ? Math.ceil(increments - 1e-9) : Math.round(increments + 1e-9);
    const hours = roundNumber((roundedIncrements * cfg.incrementMinutes) / 60, cfg.decimals, cfg.rounding);
    let value = hours.toFixed(cfg.decimals);
    if (cfg.trimZeros && cfg.decimals > 0) value = value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
    return { value, unit: cfg.unit, text: cfg.template.replaceAll("{value}", value).replaceAll("{unit}", cfg.unit) };
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function titleWithDuration(title, formatted, settings) {
    if (!formatted || typeof title !== "string") return null;
    const cfg = settingsFrom(settings);
    const trimmed = title.trim();
    if (!trimmed) return null;
    const keyword = new RegExp(escapeRegExp(cfg.keyword), "gi");
    if (keyword.test(trimmed)) return trimmed.replace(keyword, formatted.text).replace(/\s{2,}/g, " ").trim();
    const existing = /\s*\(\s*\d+(?:\.\d+)?\s*(?:hours?|hrs?)\s*\)\s*$/i;
    if (existing.test(trimmed)) {
      return cfg.replaceExisting ? trimmed.replace(existing, ` ${formatted.text}`).trim() : trimmed;
    }
    return `${trimmed} ${formatted.text}`;
  }

  function matchesAutoWords(title, settings) {
    const cfg = settingsFrom(settings);
    const words = cfg.autoWords.split(/[,\n]/).map(item => item.trim().toLowerCase()).filter(Boolean);
    return words.length > 0 && words.some(word => {
      const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(word)}(?=$|[^\\p{L}\\p{N}])`, "iu");
      return pattern.test(title);
    });
  }

  return { defaults, settingsFrom, parseClock, parseCalendarDate, durationMinutes, formattedDuration, titleWithDuration, matchesAutoWords };
});
