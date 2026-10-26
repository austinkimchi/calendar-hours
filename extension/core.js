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
    singularUnit: "hour",
    template: "({value} {unit})",
    displayUnit: "hours",
    minutesBelowHour: false,
    minutesUnit: "minutes",
    minutesSingularUnit: "minute",
    minutesTemplate: "({value} {unit})",
    keyword: "/hours",
    showSuggestion: true,
    automatic: true,
    matchingPhrases: [{ phrase: "block", dynamic: false }],
    updateExistingHours: true,
    apiSync: false,
    replaceExisting: true
  });

  function normalizedPhrases(source) {
    const legacy = typeof source.autoWords === "string" ? source.autoWords : "block";
    const entries = Array.isArray(source.matchingPhrases)
      ? source.matchingPhrases
      : legacy.split(/[,\n]/).map(phrase => ({ phrase, dynamic: source.keepUpdated === true }));
    const seen = new Set();
    return entries.slice(0, 30).flatMap(entry => {
      const raw = typeof entry === "string" ? entry : entry?.phrase;
      const phrase = (typeof raw === "string" ? raw : "").trim().slice(0, 80);
      const key = phrase.toLowerCase();
      if (!phrase || seen.has(key)) return [];
      seen.add(key);
      return [{ phrase, dynamic: entry?.dynamic === true }];
    });
  }

  function settingsFrom(value) {
    const source = value && typeof value === "object" ? value : {};
    const matchingPhrases = normalizedPhrases(source);
    const updateExistingHours = typeof source.updateExistingHours === "boolean" ? source.updateExistingHours : defaults.updateExistingHours;
    const unit = typeof source.unit === "string" && source.unit.trim() ? source.unit.trim().slice(0, 24) : defaults.unit;
    const minutesUnit = typeof source.minutesUnit === "string" && source.minutesUnit.trim() ? source.minutesUnit.trim().slice(0, 24) : defaults.minutesUnit;
    const template = typeof source.template === "string" && source.template.includes("{value}") ? source.template.slice(0, 100) : defaults.template;
    return {
      ...defaults,
      decimals: Math.max(0, Math.min(4, Number.parseInt(source.decimals ?? defaults.decimals, 10) || 0)),
      rounding: ["nearest", "down", "up", "truncate"].includes(source.rounding) ? source.rounding : defaults.rounding,
      incrementMinutes: [1, 5, 10, 15, 30, 60].includes(Number(source.incrementMinutes)) ? Number(source.incrementMinutes) : defaults.incrementMinutes,
      trimZeros: typeof source.trimZeros === "boolean" ? source.trimZeros : defaults.trimZeros,
      unit,
      singularUnit: typeof source.singularUnit === "string" && source.singularUnit.trim() ? source.singularUnit.trim().slice(0, 24) : singularUnitFor(unit),
      template,
      displayUnit: source.displayUnit === "minutes" ? "minutes" : "hours",
      minutesBelowHour: source.minutesBelowHour === true,
      minutesUnit,
      minutesSingularUnit: typeof source.minutesSingularUnit === "string" && source.minutesSingularUnit.trim() ? source.minutesSingularUnit.trim().slice(0, 24) : singularUnitFor(minutesUnit),
      minutesTemplate: typeof source.minutesTemplate === "string" && source.minutesTemplate.includes("{value}") ? source.minutesTemplate.slice(0, 100) : template,
      keyword: typeof source.keyword === "string" && source.keyword.trim() ? source.keyword.trim().slice(0, 40) : defaults.keyword,
      showSuggestion: typeof source.showSuggestion === "boolean" ? source.showSuggestion : defaults.showSuggestion,
      automatic: typeof source.automatic === "boolean" ? source.automatic : defaults.automatic,
      matchingPhrases,
      updateExistingHours,
      apiSync: source.apiSync === true,
      replaceExisting: updateExistingHours || matchingPhrases.some(item => item.dynamic) ? true
        : (typeof source.replaceExisting === "boolean" ? source.replaceExisting : defaults.replaceExisting)
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

  function singularUnitFor(unit) {
    if (/^(hours|hrs|minutes|mins)$/i.test(unit)) return unit.slice(0, -1);
    return unit.endsWith("s") && unit.length > 1 ? unit.slice(0, -1) : unit;
  }

  function formattedDuration(minutes, settings) {
    const cfg = settingsFrom(settings);
    if (!Number.isFinite(minutes) || minutes <= 0) return null;
    const increments = minutes / cfg.incrementMinutes;
    const roundedIncrements = cfg.rounding === "down" || cfg.rounding === "truncate"
      ? Math.floor(increments + 1e-9)
      : cfg.rounding === "up" ? Math.ceil(increments - 1e-9) : Math.round(increments + 1e-9);
    const roundedMinutes = roundedIncrements * cfg.incrementMinutes;
    const useMinutes = cfg.displayUnit === "minutes" || (cfg.minutesBelowHour && minutes < 60);
    if (useMinutes) {
      const value = String(roundedMinutes);
      const unit = roundedMinutes === 1 ? cfg.minutesSingularUnit : cfg.minutesUnit;
      return { value, unit, kind: "minutes", text: cfg.minutesTemplate.replaceAll("{value}", value).replaceAll("{unit}", unit) };
    }
    const hours = roundNumber(roundedMinutes / 60, cfg.decimals, cfg.rounding);
    let value = hours.toFixed(cfg.decimals);
    if (cfg.trimZeros && cfg.decimals > 0) value = value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
    const unit = hours === 1 ? cfg.singularUnit : cfg.unit;
    return { value, unit, kind: "hours", text: cfg.template.replaceAll("{value}", value).replaceAll("{unit}", unit) };
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function durationSuffixPattern(template, units) {
    const distinctTemplate = template.replaceAll("{value}", "").trim().length > 0;
    if (!distinctTemplate) return null;
    const pattern = template.split(/(\{value\}|\{unit\})/g).map(part => {
      if (part === "{value}") return "\\d+(?:\\.\\d+)?";
      if (part === "{unit}") return `(?:${[...new Set(units)].map(escapeRegExp).join("|")})`;
      return escapeRegExp(part).replace(/\s+/g, "\\s+");
    }).join("");
    return new RegExp(`\\s*${pattern}\\s*$`, "i");
  }

  function existingDurationPattern(settings) {
    const cfg = settingsFrom(settings);
    const configured = [
      durationSuffixPattern(cfg.template, [cfg.unit, cfg.singularUnit]),
      durationSuffixPattern(cfg.minutesTemplate, [cfg.minutesUnit, cfg.minutesSingularUnit])
    ].filter(Boolean);
    const legacy = /\s*(?:\(\s*\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?)\s*\)|\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?))\s*$/i;
    return { configured, legacy };
  }

  function hasDurationSuffix(title, settings) {
    if (typeof title !== "string") return false;
    const { configured, legacy } = existingDurationPattern(settings);
    return configured.some(pattern => pattern.test(title)) || legacy.test(title);
  }

  function titleWithDuration(title, formatted, settings) {
    if (!formatted || typeof title !== "string") return null;
    const cfg = settingsFrom(settings);
    const trimmed = title.trim();
    if (!trimmed) return null;
    const keyword = new RegExp(escapeRegExp(cfg.keyword), "gi");
    if (keyword.test(trimmed)) return trimmed.replace(keyword, formatted.text).replace(/\s{2,}/g, " ").trim();
    const { configured, legacy } = existingDurationPattern(cfg);
    const existing = configured.find(pattern => pattern.test(trimmed)) || (legacy.test(trimmed) ? legacy : null);
    if (existing) {
      return cfg.replaceExisting ? trimmed.replace(existing, ` ${formatted.text}`).trim() : trimmed;
    }
    return `${trimmed} ${formatted.text}`;
  }

  function matchesPhrase(title, settings, dynamicOnly = false) {
    const cfg = settingsFrom(settings);
    if (typeof title !== "string") return false;
    return cfg.matchingPhrases.some(({ phrase, dynamic }) => {
      if (dynamicOnly && !dynamic) return false;
      const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(phrase)}(?=$|[^\\p{L}\\p{N}])`, "iu");
      return pattern.test(title);
    });
  }

  function matchesAutoWords(title, settings) { return matchesPhrase(title, settings); }
  function matchesDynamic(title, settings) { return matchesPhrase(title, settings, true); }

  function shouldUpdateDuration(title, settings) {
    const cfg = settingsFrom(settings);
    if (matchesAutoWords(title, cfg)) return matchesDynamic(title, cfg);
    return cfg.updateExistingHours && hasDurationSuffix(title, cfg);
  }

  return { defaults, settingsFrom, parseClock, parseCalendarDate, durationMinutes, formattedDuration, titleWithDuration, matchesAutoWords, matchesDynamic, hasDurationSuffix, shouldUpdateDuration, singularUnitFor };
});
