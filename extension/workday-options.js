/* Workday settings are independent of title-formatting preferences. */
(function () {
  "use strict";
  const core = globalThis.CalendarHoursWorkday;
  const form = document.querySelector("#workday-settings");
  const connection = document.querySelector("#workday-connection");
  const status = document.querySelector("#workday-status");
  const manageConnection = document.querySelector("#workday-manage-connection");
  const refresh = document.querySelector("#workday-refresh");
  const field = name => form.elements.namedItem(name);
  let calendars = [];
  let saved = core.settingsFrom();
  let ready = false;
  let initialized = false;
  let loadRevision = 0;

  function populateTimeZones() {
    const select = field("timeZone");
    const common = [
      ["America/Los_Angeles", "Pacific Time — Los Angeles"],
      ["America/Denver", "Mountain Time — Denver"],
      ["America/Phoenix", "Arizona — Phoenix"],
      ["America/Chicago", "Central Time — Chicago"],
      ["America/New_York", "Eastern Time — New York"],
      ["America/Anchorage", "Alaska — Anchorage"],
      ["Pacific/Honolulu", "Hawaii — Honolulu"],
      ["UTC", "UTC"]
    ];
    const commonGroup = document.createElement("optgroup");
    commonGroup.label = "Common time zones";
    for (const [value, label] of common) commonGroup.append(new Option(label, value));
    select.append(commonGroup);
    const included = new Set(common.map(([value]) => value));
    const groups = new Map();
    for (const zone of (Intl.supportedValuesOf?.("timeZone") || []).sort()) {
      if (included.has(zone)) continue;
      const [region, ...city] = zone.split("/");
      if (!groups.has(region)) {
        const group = document.createElement("optgroup");
        group.label = region;
        select.append(group);
        groups.set(region, group);
      }
      groups.get(region).append(new Option((city.join(" / ") || region).replaceAll("_", " "), zone));
    }
  }

  function selectTimeZone(zone) {
    if (!core.validZone(zone)) return;
    const select = field("timeZone");
    // Calendar metadata and older saved settings can use valid IANA aliases
    // that Intl.supportedValuesOf does not list. Preserve their exact values.
    if (![...select.options].some(option => option.value === zone)) select.append(new Option(zone.replaceAll("_", " "), zone));
    select.value = zone;
  }

  populateTimeZones();

  async function loadCalendars() {
    const revision = ++loadRevision;
    ready = false;
    refresh.disabled = true;
    connection.hidden = false;
    manageConnection.hidden = true;
    connection.textContent = "Loading calendars…";
    try {
      const result = await chrome.runtime.sendMessage({ type: "CALENDAR_HOURS_WORKDAY_CALENDARS" });
      if (revision !== loadRevision) return;
      if (!result?.ok) throw Object.assign(new Error(result?.reason || "Google Calendar is unavailable"), { needsSetup: !!result?.needsSetup });
      calendars = result.calendars;
      const chosen = field("calendarId").value || saved.calendarId;
      field("calendarId").replaceChildren(new Option("Choose a calendar", ""));
      for (const c of calendars) field("calendarId").append(new Option(c.name + (c.primary ? " (primary)" : ""), c.id));
      if (calendars.some(c => c.id === chosen)) field("calendarId").value = chosen;
      else if (chosen) status.textContent = "Your saved calendar is unavailable. Choose another and save.";
      connection.textContent = "";
      connection.hidden = true;
      ready = true;
    } catch (error) {
      if (revision !== loadRevision) return;
      ready = false;
      connection.textContent = error.message;
      manageConnection.hidden = !error.needsSetup;
      if (error.needsSetup) document.dispatchEvent(new CustomEvent("calendar-hours-connection-required"));
    } finally { if (revision === loadRevision) refresh.disabled = false; }
  }

  field("calendarId").addEventListener("change", () => {
    const c = calendars.find(c => c.id === field("calendarId").value);
    selectTimeZone(c?.timeZone);
    status.textContent = "Unsaved changes";
  });
  form.addEventListener("input", () => { status.textContent = "Unsaved changes"; });
  refresh.addEventListener("click", () => { void loadCalendars(); });
  document.addEventListener("calendar-hours-connection-changed", () => { if (initialized) void loadCalendars(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const selected = calendars.find(c => c.id === field("calendarId").value);
    if (field("enabled").checked && (!ready || !selected)) { status.textContent = "Connect Google Calendar in General, then choose an available calendar here."; return; }
    const value = core.settingsFrom(Object.fromEntries([...form.elements].filter(e => e.name).map(e => [e.name, e.type === "checkbox" ? e.checked : e.value])));
    value.calendarName = selected?.name || saved.calendarName;
    if (value.enabled && !core.configured(value)) { status.textContent = "Enter a phrase to match event titles and choose a time zone."; return; }
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
      if (!input || name === "calendarId" || name === "timeZone") continue;
      if (input.type === "checkbox") input.checked = value;
      else input.value = value;
    }
    selectTimeZone(saved.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    initialized = true;
    await loadCalendars();
    if (location.hash === "#workday") document.querySelector("#workday").scrollIntoView({ block: "start" });
  }).catch(error => { status.textContent = `Could not load settings: ${error.message}`; });
})();
