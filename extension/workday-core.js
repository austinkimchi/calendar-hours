/* Pure Workday import planning. No credentials or writes. */
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
  function settingsFrom(value = {}) {
    const calendarIds = [...new Set((Array.isArray(value.calendarIds) ? value.calendarIds : [value.calendarId])
      .filter(id => typeof id === "string" && id.trim()).map(id => id.trim().slice(0, 1000)))].slice(0, 10);
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
      // Retire stored prototype flags as well as hiding their controls.
      // Meal automation is paused pending confirmation of payroll semantics.
      calendarMeals: false,
      autoMeal: false
    };
  }
  function configured(value) {
    const s = settingsFrom(value);
    return s.enabled && s.calendarIds.length > 0 && !!s.keyword && !!s.timeZone;
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
    if (md.some(x => !x)) throw new Error("Workday date labels are not supported by Calendar Hours");
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
  function plan({ events, dates, settings, existing = [], core, now = Date.now() }) {
    validateDates(dates);
    const s = settingsFrom(settings);
    if (!configured(s)) throw Object.assign(new Error("Finish Workday setup in Calendar Hours settings"), { needsSetup: true });
    const wanted = new Set(dates);
    const blocks = [], warnings = [], skipped = [];
    for (const event of events) {
      if (!core.matchesAutoWords(event.summary || "", { matchingPhrases: [{ phrase: s.keyword }] })) continue;
      if (event.status === "cancelled" || !event.start?.dateTime || !event.end?.dateTime) continue;
      const start = Date.parse(event.start.dateTime), end = Date.parse(event.end.dateTime);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) { warnings.push("A matching event has invalid times."); continue; }
      if (!s.includeFuture && end > now) { skipped.push({ reason: "future", title: event.summary }); continue; }
      const a = parts(start, s.timeZone), b = parts(end, s.timeZone);
      if (a.date > dates.at(-1) || b.date < dates[0]) continue;
      const uniqueInstant = p => core.wallTimeInstant(core.parseCalendarDate(p.date),
        { hour: Math.floor(p.minute / 60), minute: p.minute % 60 }, s.timeZone);
      // Workday's In/Out dialog has no date/offset fields. Fail closed on overnight or DST-ambiguous shifts.
      if (a.date !== b.date || a.second || b.second || (end - start) / 60000 !== b.minute - a.minute ||
          uniqueInstant(a) !== start || uniqueInstant(b) !== end) {
        warnings.push(`${event.summary}: overnight, sub-minute or daylight-saving time block needs manual entry.`); continue;
      }
      if (!wanted.has(a.date)) continue;
      blocks.push({ date: a.date, start: a.minute, end: b.minute, title: event.summary,
        descriptions: s.importComments && typeof event.description === "string" ? [event.description] : [],
        startIso: event.start.dateTime, endIso: event.end.dateTime });
    }
    blocks.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start || a.end - b.end);
    const merged = [];
    for (const block of blocks) {
      const prev = merged.at(-1);
      if (prev && prev.date === block.date && block.start < prev.end) {
        prev.end = Math.max(prev.end, block.end);
        if (prev.title !== block.title) prev.title = `${prev.title}; ${block.title}`.slice(0, 1000);
        prev.descriptions = [...new Set([...prev.descriptions, ...block.descriptions])];
      } else merged.push({ ...block });
    }
    const add = [], update = [], conflicts = [];
    const overlapsBlock = (a, b) => a.date === b.date && a.start < b.end && a.end > b.start;
    for (const block of merged) {
      const overlaps = existing.filter(e => overlapsBlock(e, block));
      const entry = overlaps[0];
      if (overlaps.length === 1 && entry.start === block.start && entry.end === block.end && entry.type === s.timeType) {
        skipped.push({ ...block, reason: "already-entered" });
      } else if (s.updateOverlaps && overlaps.length === 1 && entry.type === s.timeType &&
          entry.status === "Not Submitted" && entry.eventId && merged.filter(b => overlapsBlock(entry, b)).length === 1) {
        update.push({ ...block, previous: { date: entry.date, start: entry.start, end: entry.end, type: entry.type, eventId: entry.eventId } });
      } else if (overlaps.length) conflicts.push(block);
      else add.push(block);
    }
    return { add, update, skipped, conflicts, warnings, matched: merged.length };
  }
  return { settingsKey, settingsFrom, configured, validDate, validZone, addDays, parts, midnight, validateDates, datesFromLabels, clock, plan };
});
