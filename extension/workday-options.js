/* Workday settings are independent of title-formatting preferences. */
(function () {
  "use strict";
  const core = globalThis.CalendarHoursWorkday;
  const form = document.querySelector("#workday-settings");
  const connection = document.querySelector("#workday-connection");
  const status = document.querySelector("#workday-status");
  const connect = document.querySelector("#workday-connect");
  const refresh = document.querySelector("#workday-refresh");
  const field = name => form.elements.namedItem(name);
  let calendars = [];
  let saved = core.settingsFrom();
  let ready = false;

  async function loadCalendars(interactive = false) {
    connect.disabled = refresh.disabled = true;
    connection.textContent = interactive ? "Connecting to Google Calendar…" : "Loading calendars…";
    try {
      const result = await chrome.runtime.sendMessage({ type: interactive ? "CALENDAR_HOURS_WORKDAY_CONNECT" : "CALENDAR_HOURS_WORKDAY_CALENDARS" });
      if (!result?.ok) throw new Error(result?.reason || "Google Calendar is unavailable");
      calendars = result.calendars;
      const chosen = field("calendarId").value || saved.calendarId;
      field("calendarId").replaceChildren(new Option("Choose a calendar", ""));
      for (const c of calendars) field("calendarId").append(new Option(c.name + (c.primary ? " (primary)" : ""), c.id));
      if (calendars.some(c => c.id === chosen)) field("calendarId").value = chosen;
      else if (chosen) status.textContent = "Your saved calendar is unavailable. Choose another and save.";
      connection.textContent = "Connected. Choose a calendar, then save your import settings.";
      connect.textContent = "Reconnect Google Calendar";
      ready = true;
    } catch (error) {
      ready = false;
      connection.textContent = error.message;
    } finally { connect.disabled = refresh.disabled = false; }
  }

  field("calendarId").addEventListener("change", () => {
    const c = calendars.find(c => c.id === field("calendarId").value);
    if (core.validZone(c?.timeZone)) field("timeZone").value = c.timeZone;
    status.textContent = "Unsaved changes";
  });
  form.addEventListener("input", () => { status.textContent = "Unsaved changes"; });
  connect.addEventListener("click", () => { void loadCalendars(true); });
  refresh.addEventListener("click", () => { void loadCalendars(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const selected = calendars.find(c => c.id === field("calendarId").value);
    if (field("enabled").checked && (!ready || !selected)) { status.textContent = "Connect and choose an available calendar first."; return; }
    const value = core.settingsFrom(Object.fromEntries([...form.elements].filter(e => e.name).map(e => [e.name, e.type === "checkbox" ? e.checked : e.value])));
    value.calendarName = selected?.name || saved.calendarName;
    if (value.enabled && !core.configured(value)) { status.textContent = "Enter a matching phrase and a valid time zone, such as America/Los_Angeles."; return; }
    try {
      await chrome.storage.sync.set({ [core.settingsKey]: value });
      saved = value;
      status.textContent = value.enabled ? "Saved. Return to Workday → Actions → Auto-fill from Calendar." : "Saved. Calendar import is disabled.";
    } catch (error) { status.textContent = `Could not save: ${error.message}`; }
  });
  chrome.storage.sync.get(core.settingsKey).then(async data => {
    saved = core.settingsFrom(data[core.settingsKey]);
    for (const [name, value] of Object.entries(saved)) {
      const input = field(name);
      if (!input || name === "calendarId") continue;
      if (input.type === "checkbox") input.checked = value;
      else input.value = value;
    }
    if (!saved.timeZone) field("timeZone").value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await loadCalendars();
    if (location.hash === "#workday") document.querySelector("#workday").scrollIntoView({ block: "start" });
  }).catch(error => { status.textContent = `Could not load settings: ${error.message}`; });
})();
