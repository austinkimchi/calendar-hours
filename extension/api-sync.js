/* Tab-free persistence for one-time grid moves and resizes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CalendarHoursApiSync = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const apiRoot = "https://www.googleapis.com/calendar/v3/calendars";
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

  function eventRefFromGridId(gridId) {
    if (typeof gridId !== "string" || !/^[A-Za-z0-9+/_-]+=*$/.test(gridId) || gridId.length > 1000) return null;
    try {
      const decoded = atob(gridId.replace(/-/g, "+").replace(/_/g, "/"));
      const split = decoded.indexOf(" ");
      if (split < 1 || split === decoded.length - 1 || decoded.indexOf(" ", split + 1) !== -1) return null;
      const eventId = decoded.slice(0, split);
      let calendarId = decoded.slice(split + 1);
      if (calendarId.endsWith("@g")) calendarId = `${calendarId.slice(0, -2)}@group.calendar.google.com`;
      else if (calendarId.endsWith("@m")) calendarId = `${calendarId.slice(0, -2)}@gmail.com`;
      if (!/^[A-Za-z0-9_@.%-]+$/.test(eventId) || !/^[A-Za-z0-9_@.%-]+$/.test(calendarId)) return null;
      return { eventId, calendarId };
    } catch {
      return null;
    }
  }

  function eventTimes(event) {
    if (!event?.start?.dateTime || !event?.end?.dateTime) return null;
    const start = Date.parse(event.start.dateTime);
    const end = Date.parse(event.end.dateTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return { start, end, minutes: (end - start) / 60000 };
  }

  function matchesExpectedTimes(event, startIso, endIso) {
    const times = eventTimes(event);
    return !!times && times.start === Date.parse(startIso) && times.end === Date.parse(endIso);
  }

  async function syncTitle({ gridId, title, startIso, endIso, settings, accessToken, fetcher = fetch, sleep = pause, core }) {
    const ref = eventRefFromGridId(gridId);
    const requestedMinutes = (Date.parse(endIso) - Date.parse(startIso)) / 60000;
    if (!ref || !Number.isFinite(requestedMinutes) || requestedMinutes <= 0) {
      return { ok: false, reason: "Calendar event reference or time was unavailable" };
    }
    if (requestedMinutes > core.maxDurationMinutes) {
      return { ok: false, reason: "Event duration exceeds seven days" };
    }
    const url = `${apiRoot}/${encodeURIComponent(ref.calendarId)}/events/${encodeURIComponent(ref.eventId)}`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const delays = [0, 120, 180, 270, 400, 600, 850, 1100];
    for (const delay of delays) {
      if (delay) await sleep(delay);
      const read = await fetcher(url, { headers, cache: "no-store" });
      if (read.status === 401) return { ok: false, authExpired: true, reason: "Google authorization expired" };
      if (!read.ok) return { ok: false, reason: `Calendar API read failed (${read.status})` };
      const event = await read.json();
      if (event.status === "cancelled" || event.recurringEventId || event.recurrence?.length ||
          (event.eventType && event.eventType !== "default")) {
        return { ok: false, reason: "recurring or unsupported event" };
      }
      if (!matchesExpectedTimes(event, startIso, endIso)) continue;
      if (event.summary !== title) return { ok: false, reason: "Event title changed during the resize" };
      if (!event.etag) return { ok: false, reason: "Calendar API did not return an event version" };
      if (!core.shouldUpdateDuration(event.summary, settings)) return { ok: false, reason: "Automatic updates are off for this title" };
      const minutes = eventTimes(event).minutes;
      const nextTitle = core.titleWithDuration(title, core.formattedDuration(minutes, settings), settings);
      if (!nextTitle) return { ok: false, reason: "Duration could not be calculated" };
      if (nextTitle === title) return { ok: true, nextTitle, unchanged: true };
      const saved = await fetcher(url, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", "If-Match": event.etag },
        body: JSON.stringify({ summary: nextTitle })
      });
      if (saved.status === 412) continue;
      if (saved.status === 401) return { ok: false, authExpired: true, reason: "Google authorization expired" };
      if (!saved.ok) return { ok: false, reason: `Calendar API save failed (${saved.status})` };
      const result = await saved.json();
      return result.summary === nextTitle
        ? { ok: true, nextTitle }
        : { ok: false, reason: "Calendar API did not confirm the title" };
    }
    return { ok: false, reason: "Waiting for Calendar's resize save timed out" };
  }

  return { eventRefFromGridId, eventTimes, matchesExpectedTimes, syncTitle };
});
