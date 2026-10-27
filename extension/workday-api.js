/* Calendar reads for Workday. All tokens remain in the extension service worker. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CalendarHoursWorkdayApi = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const root = "https://www.googleapis.com/calendar/v3";
  async function read(path, accessToken, fetcher) {
    const response = await fetcher(root + path, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    if ([401, 403, 404].includes(response.status)) {
      const error = new Error(response.status === 404 ? "The selected calendar is no longer available. Choose a calendar in settings." : "Reconnect Google Calendar in settings to allow calendar imports.");
      error.needsSetup = true; throw error;
    }
    if (!response.ok) throw new Error(`Google Calendar could not be read (${response.status}). Try again later.`);
    return response.json();
  }
  async function listCalendars({ accessToken, fetcher = fetch }) {
    const calendars = []; let pageToken;
    do {
      const params = new URLSearchParams({ minAccessRole: "reader", maxResults: "250" });
      if (pageToken) params.set("pageToken", pageToken);
      const data = await read(`/users/me/calendarList?${params}`, accessToken, fetcher);
      calendars.push(...(data.items || []).filter(c => !c.deleted).map(c => ({ id: c.id, name: c.summaryOverride || c.summary || c.id, timeZone: c.timeZone, primary: !!c.primary })));
      pageToken = data.nextPageToken;
    } while (pageToken);
    return calendars;
  }
  async function listEvents({ accessToken, settings, dates, core, fetcher = fetch }) {
    core.validateDates(dates);
    const timeMin = new Date(core.midnight(dates[0], settings.timeZone)).toISOString();
    const timeMax = new Date(core.midnight(core.addDays(dates.at(-1), 1), settings.timeZone)).toISOString();
    const events = []; let pageToken;
    do {
      const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", showDeleted: "false", maxResults: "2500" });
      if (pageToken) params.set("pageToken", pageToken);
      const data = await read(`/calendars/${encodeURIComponent(settings.calendarId)}/events?${params}`, accessToken, fetcher);
      events.push(...(data.items || []).map(e => ({ summary: e.summary, status: e.status, start: e.start, end: e.end,
        ...(settings.importComments === true ? { description: typeof e.description === "string" ? e.description : "" } : {}) })));
      if (events.length > 10000) throw new Error("This range has too many events. Import one day at a time.");
      pageToken = data.nextPageToken;
    } while (pageToken);
    return events;
  }
  return { listCalendars, listEvents };
});
