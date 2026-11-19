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
    if (response.status === 401) {
      throw Object.assign(new Error("Google Calendar authorization expired."), { authExpired: true });
    }
    if (response.status === 403) {
      const body = await response.json?.().catch(() => null);
      const reasons = body?.error?.errors?.map(error => error.reason) || [];
      if (reasons.some(reason => ["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded"].includes(reason))) {
        throw new Error("Google Calendar is temporarily limiting requests. Try again later.");
      }
      throw Object.assign(new Error("Google Calendar denied access. Check this calendar's permissions in settings."), { needsSetup: true });
    }
    if (response.status === 404) {
      throw Object.assign(new Error("The selected calendar is no longer available. Choose a calendar in settings."), { needsSetup: true });
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
    const ids = core.settingsFrom(settings).calendarIds;
    if (!ids.length) throw Object.assign(new Error("Choose at least one import calendar in settings."), { needsSetup: true });
    const results = new Array(ids.length); let next = 0, count = 0, failure;
    async function worker() {
      while (next < ids.length && !failure) {
        const index = next++, events = []; let pageToken;
        try {
          do {
            const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", showDeleted: "false", maxResults: "2500" });
            if (pageToken) params.set("pageToken", pageToken);
            const data = await read(`/calendars/${encodeURIComponent(ids[index])}/events?${params}`, accessToken, fetcher);
            count += (data.items || []).length;
            if (count > 10000) throw new Error("This range has too many events. Import one day at a time.");
            events.push(...(data.items || []).map(e => ({ summary: e.summary, status: e.status, start: e.start, end: e.end,
              ...(settings.importComments === true ? { description: typeof e.description === "string" ? e.description : "" } : {}) })));
            pageToken = data.nextPageToken;
          } while (pageToken && !failure);
          results[index] = events;
        } catch (error) { failure = error; }
      }
    }
    // At most three calendar requests in flight; do not import a partial set if
    // one calendar fails, since the import would contain an incomplete set of work blocks.
    await Promise.all(Array.from({ length: Math.min(3, ids.length) }, worker));
    if (failure) throw failure;
    const events = results.flat();
    return events;
  }
  return { listCalendars, listEvents };
});
