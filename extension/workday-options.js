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
  const calendarList = document.querySelector("#workday-calendars");
  const chosenIds = () => [...calendarList.querySelectorAll("input:checked")].map(input => input.value);
  let renderedCalendars = false;
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
      const chosen = renderedCalendars ? chosenIds() : saved.calendarIds;
      calendarList.replaceChildren();
      const items = [...calendars, ...chosen.filter(id => !calendars.some(c => c.id === id)).map(id => ({ id, name: "Saved calendar (unavailable)", unavailable: true }))];
      for (const c of items) {
        const label = document.createElement("label"); label.className = "check" + (c.unavailable ? " unavailable" : "");
        const input = document.createElement("input"); input.type = "checkbox"; input.name = "calendarIds"; input.value = c.id; input.checked = chosen.includes(c.id);
        label.append(input, document.createTextNode(c.name + (c.primary ? " (primary)" : "")));
        calendarList.append(label);
      }
      renderedCalendars = true;
      if (items.some(c => c.unavailable)) status.textContent = "A saved calendar is unavailable. Restore access or deselect it before saving.";
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

  calendarList.addEventListener("change", event => {
    const chosen = chosenIds();
    if (chosen.length > 10) { event.target.checked = false; status.textContent = "Select at most 10 calendars."; return; }
    if (event.target.checked && chosen.length === 1) selectTimeZone(calendars.find(c => c.id === chosen[0])?.timeZone);
    status.textContent = "Unsaved changes";
  });
  form.addEventListener("input", () => { status.textContent = "Unsaved changes"; });
  refresh.addEventListener("click", () => { void loadCalendars(); });
  document.addEventListener("calendar-hours-connection-changed", () => { if (initialized) void loadCalendars(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const ids = chosenIds();
    if (field("enabled").checked && (!ready || !ids.length || ids.some(id => !calendars.some(c => c.id === id)))) { status.textContent = "Connect Google Calendar in General, then select available calendars here."; return; }
    const raw = Object.fromEntries([...form.elements].filter(e => e.name && e.name !== "calendarIds").map(e => [e.name, e.type === "checkbox" ? e.checked : e.value]));
    const value = core.settingsFrom({ ...raw, calendarIds: ids });
    value.calendarName = calendars.filter(c => ids.includes(c.id)).map(c => c.name).join(", ").slice(0, 200);
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
      if (!input || name === "calendarId" || name === "calendarIds" || name === "timeZone") continue;
      if (input.type === "checkbox") input.checked = value;
      else input.value = value;
    }
    selectTimeZone(saved.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    initialized = true;
    await loadCalendars();
    if (location.hash === "#workday") document.querySelector("#workday").scrollIntoView({ block: "start" });
  }).catch(error => { status.textContent = `Could not load settings: ${error.message}`; });
})();
