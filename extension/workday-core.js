/* Pure planning for the developer Workday integration. No Workday credentials or writes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CalendarHoursWorkday = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const settingsKey = "workdayIntegration";
  const pad = n => String(n).padStart(2, "0");
  const dateKey = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === value;
  }
  function addDays(value, count) {
    if (!validDate(value)) throw new Error("Calendar date is invalid");
    const d = new Date(`${value}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + count);
    return d.toISOString().slice(0, 10);
  }
  function validZone(zone) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(); return typeof zone === "string" && !!zone; }
    catch { return false; }
  }
  const defaultMealWords = ["Breakfast", "Lunch", "Dinner", "Meal Break"];
  function settingsFrom(value = {}) {
    const calendarIds = [...new Set((Array.isArray(value.calendarIds) ? value.calendarIds : [value.calendarId])
      .filter(id => typeof id === "string" && id.trim()).map(id => id.trim().slice(0, 1000)))].slice(0, 10);
    const mealWords = Array.isArray(value.mealWords) ? value.mealWords :
      typeof value.mealWords === "string" ? value.mealWords.split(/[,\n]/) : defaultMealWords;
    const bounded = (v, fallback, min, max) => Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max ? Number(v) : fallback;
    return {
      enabled: value.enabled === true,
      calendarIds,
      calendarId: calendarIds[0] || "", // compatibility with older saved settings
      calendarName: typeof value.calendarName === "string" ? value.calendarName.slice(0, 200) : "",
      keyword: typeof value.keyword === "string" ? value.keyword.trim().slice(0, 80) : "",
      timeZone: validZone(value.timeZone) ? value.timeZone : "",
      timeType: typeof value.timeType === "string" && value.timeType.trim() ? value.timeType.trim().slice(0, 80) : "Hours",
      outReason: typeof value.outReason === "string" && value.outReason.trim() ? value.outReason.trim().slice(0, 80) : "Out",
      includeFuture: value.includeFuture === true,
      updateOverlaps: value.updateOverlaps !== false,
      importComments: value.importComments === true,
      calendarMeals: value.calendarMeals === true,
      mealWords: [...new Map(mealWords.filter(word => typeof word === "string" && word.trim())
        .map(word => [word.trim().toLowerCase(), word.trim().slice(0, 80)])).values()].slice(0, 20),
      autoMeal: value.autoMeal === true,
      mealAfterHours: bounded(value.mealAfterHours, 5, 0.25, 16),
      mealDurationMinutes: Math.round(bounded(value.mealDurationMinutes, 30, 1, 180))
    };
  }
  function configured(value) {
    const s = settingsFrom(value);
    return s.enabled && s.calendarIds.length > 0 && !!s.keyword && !!s.timeZone && (!s.calendarMeals || s.mealWords.length > 0);
  }
  function parts(timestamp, timeZone) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date(timestamp)).map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute), second: Number(p.second) };
  }
  function midnight(date, timeZone) {
    if (!validDate(date) || !validZone(timeZone)) throw new Error("Choose a valid Workday time zone");
    const target = Date.parse(`${date}T00:00:00Z`);
    let value = target;
    for (let i = 0; i < 5; i++) {
      const p = parts(value, timeZone);
      const wall = Date.parse(`${p.date}T00:00:00Z`) + p.minute * 60000 + p.second * 1000;
      if (wall === target) return value;
      value += target - wall;
    }
    throw new Error("This date's midnight is not available in the selected time zone");
  }
  function validateDates(dates) {
    if (!Array.isArray(dates) || ![1, 7].includes(dates.length) || !dates.every(validDate) ||
        dates.some((d, i) => i && d !== addDays(dates[i - 1], 1))) {
      throw new Error("Open a single day or one week in Workday Enter Time");
    }
    return dates;
  }
  function datesFromLabels(title, labels) {
    const years = String(title).match(/\b20\d{2}\b/g);
    if (!years?.length || ![1, 7].includes(labels.length)) throw new Error("Could not identify the dates displayed in Workday");
    const endYear = Number(years.at(-1));
    const md = labels.map(label => /\b(\d{1,2})\/(\d{1,2})\b/.exec(label));
    if (md.some(x => !x)) throw new Error("Workday date labels are not supported by this developer build");
    const wraps = md.some((x, i) => i && Number(x[1]) < Number(md[i - 1][1]));
    let year = wraps ? endYear - 1 : endYear;
    return validateDates(md.map((x, i) => {
      if (i && Number(x[1]) < Number(md[i - 1][1])) year++;
      return dateKey(year, Number(x[1]), Number(x[2]));
    }));
  }
  function clock(minute) {
    const h = Math.floor(minute / 60) % 24;
    return `${h % 12 || 12}:${pad(minute % 60)} ${h >= 12 ? "PM" : "AM"}`;
  }
  function union(blocks, adjacent = false) {
    const result = [];
    for (const block of [...blocks].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start || a.end - b.end)) {
      const prev = result.at(-1);
      if (prev && prev.date === block.date && (adjacent ? block.start <= prev.end : block.start < prev.end)) {
        prev.end = Math.max(prev.end, block.end);
        if (prev.title !== block.title) prev.title = `${prev.title}; ${block.title}`.slice(0, 1000);
        prev.descriptions = [...new Set([...(prev.descriptions || []), ...(block.descriptions || [])])];
      } else result.push({ ...block });
    }
    return result;
  }
  function applyMeals(blocks, meals, settings, warnings, allWork = blocks) {
    // Ignore unrelated meals outside the day's work span. A meal in a gap
    // between work blocks still belongs to that day and suppresses a second meal.
    const breaks = union(meals, true).filter(meal => {
      const day = allWork.filter(b => b.date === meal.date);
      return day.length && meal.start <= Math.max(...day.map(b => b.end)) && meal.end >= Math.min(...day.map(b => b.start));
    });
    for (const date of new Set(blocks.map(b => b.date))) {
      const day = blocks.filter(b => b.date === date);
      if (!settings.autoMeal || breaks.some(m => m.date === date)) continue;
      let remaining = Math.round(settings.mealAfterHours * 60);
      for (const block of day) {
        const length = block.end - block.start;
        if (remaining > length) { remaining -= length; continue; }
        const start = block.start + remaining, end = start + settings.mealDurationMinutes;
        if (day.some(b => b.end > end)) breaks.push({ date, start, end, title: "Automatic meal" });
        else if (day.some(b => b.end > start)) warnings.push(`${date}: not enough remaining time for a full automatic meal; check this day manually.`);
        break; // at most one automatic meal per day
      }
    }
    const combined = union(breaks, true), result = [];
    for (const block of blocks) {
      let cursor = block.start;
      const pieces = [];
      for (const meal of combined.filter(m => m.date === block.date && m.start <= block.end && m.end > block.start)) {
        if (meal.start > cursor) pieces.push({ ...block, start: cursor, end: meal.start, outReason: "Meal", mealApplied: true });
        cursor = Math.max(cursor, meal.end);
        if (cursor >= block.end) break;
      }
      if (cursor < block.end) pieces.push({ ...block, start: cursor, outReason: settings.outReason });
      if (!pieces.length) warnings.push(`${block.date}: a meal covers the entire work block; no paid entry was planned. Any existing entry needs manual correction.`);
      // Only a single exact draft of this original source span can be split automatically.
      const changed = pieces.length !== 1 || pieces[0]?.start !== block.start || pieces[0]?.end !== block.end;
      for (const piece of pieces) result.push({ ...piece, ...(changed ? { mealSource: { start: block.start, end: block.end } } : {}) });
    }
    return result;
  }
  function plan({ events, dates, settings, existing = [], core, now = Date.now() }) {
    validateDates(dates);
    const s = settingsFrom(settings);
    if (!configured(s)) throw Object.assign(new Error("Finish Workday setup in Calendar Hours settings"), { needsSetup: true });
    const wanted = new Set(dates);
    const blocks = [], allWork = [], meals = [], warnings = [], skipped = [];
    for (const event of events) {
      const isMeal = s.calendarMeals && core.matchesAutoWords(event.summary || "", { matchingPhrases: s.mealWords.map(phrase => ({ phrase })) });
      const isWork = core.matchesAutoWords(event.summary || "", { matchingPhrases: [{ phrase: s.keyword }] });
      if (!isMeal && !isWork) continue;
      if (event.status === "cancelled" || !event.start?.dateTime || !event.end?.dateTime) continue;
      const start = Date.parse(event.start.dateTime), end = Date.parse(event.end.dateTime);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        if (isMeal) throw new Error("A matching meal event has invalid times. Correct it in Calendar before importing.");
        warnings.push("A matching event has invalid times."); continue;
      }
      const a = parts(start, s.timeZone), b = parts(end, s.timeZone);
      if (a.date > dates.at(-1) || b.date < dates[0]) continue;
      const uniqueInstant = p => core.wallTimeInstant(core.parseCalendarDate(p.date),
        { hour: Math.floor(p.minute / 60), minute: p.minute % 60 }, s.timeZone);
      // Workday's In/Out dialog has no date/offset fields. Fail closed on overnight or DST-ambiguous shifts.
      if (a.date !== b.date || a.second || b.second || (end - start) / 60000 !== b.minute - a.minute ||
          uniqueInstant(a) !== start || uniqueInstant(b) !== end) {
        if (isMeal) throw new Error(`${event.summary}: overnight, sub-minute or daylight-saving meal needs manual correction before importing.`);
        warnings.push(`${event.summary}: overnight, sub-minute or daylight-saving time block needs manual entry.`); continue;
      }
      if (!wanted.has(a.date)) continue;
      if (!isMeal) {
        // Associate completed meals with the full validated workday, even when
        // its afternoon shift is not yet eligible for import.
        allWork.push({ date: a.date, start: a.minute, end: b.minute });
        if (!s.includeFuture && end > now) { skipped.push({ reason: "future", title: event.summary }); continue; }
      }
      (isMeal ? meals : blocks).push({ date: a.date, start: a.minute, end: b.minute, title: event.summary,
        descriptions: s.importComments && typeof event.description === "string" ? [event.description] : [],
        startIso: event.start.dateTime, endIso: event.end.dateTime });
    }
    const merged = applyMeals(union(blocks), meals, s, warnings, allWork);
    const add = [], update = [], conflicts = [];
    const overlapsBlock = (a, b) => a.date === b.date && a.start < b.end && a.end > b.start;
    const resolved = new Set();
    if (s.updateOverlaps) for (const entry of existing) {
      if (entry.type !== s.timeType || entry.status !== "Not Submitted" || !entry.eventId) continue;
      const group = merged.filter(b => overlapsBlock(entry, b));
      if (group.length < 2 || !group.every(b => b.mealSource?.start === entry.start && b.mealSource?.end === entry.end &&
          existing.filter(e => overlapsBlock(e, b)).length === 1)) continue;
      update.push({ ...group[0], previous: { date: entry.date, start: entry.start, end: entry.end, type: entry.type, eventId: entry.eventId } });
      add.push(...group.slice(1));
      group.forEach(b => resolved.add(b));
    }
    for (const block of merged) {
      if (resolved.has(block)) continue;
      const overlaps = existing.filter(e => overlapsBlock(e, block));
      const entry = overlaps[0];
      const exact = overlaps.length === 1 && entry.start === block.start && entry.end === block.end && entry.type === s.timeType;
      // Calendar tiles do not expose Out Reason. With meals enabled, inspect an
      // editable exact entry's form, cancel if already correct, otherwise save it.
      const reasonCheck = (s.calendarMeals || s.autoMeal) && entry?.outReason !== block.outReason;
      if (exact && !reasonCheck) {
        skipped.push({ ...block, reason: "already-entered" });
      } else if (s.updateOverlaps && overlaps.length === 1 && entry.type === s.timeType &&
          entry.status === "Not Submitted" && entry.eventId && merged.filter(b => overlapsBlock(entry, b)).length === 1) {
        update.push({ ...block, previous: { date: entry.date, start: entry.start, end: entry.end, type: entry.type, eventId: entry.eventId } });
      } else if (overlaps.length) conflicts.push(block);
      else add.push(block);
    }
    return { add, update, skipped, conflicts, warnings, matched: merged.length };
  }
  return { defaultMealWords, settingsKey, settingsFrom, configured, validDate, validZone, addDays, parts, midnight, validateDates, datesFromLabels, clock, plan };
});
