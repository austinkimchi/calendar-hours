/* Workday settings are independent of title-formatting preferences. */
(function () {
  "use strict";
  const core = globalThis.CalendarHoursWorkday;
  const syncCore = globalThis.CalendarHoursSettingsSync;
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
  let ready = false;
  let initialized = false;
  let loadRevision = 0;
  let visible = {};
  let saving = false;
  form.inert = true;
  const sync = syncCore.create({ storage: chrome.storage, read: core.settingsFromStorage,
    encode: core.settingsPatch, onUpdate: render });

  function rawValues() {
    return {
      ...Object.fromEntries([...form.elements].filter(e => e.name && e.name !== "calendarIds")
        .map(e => [e.name, e.type === "checkbox" ? e.checked : e.value])),
      calendarIds: renderedCalendars ? chosenIds() : sync.values().calendarIds
    };
  }

  function captureChanges() {
    const next = rawValues();
    sync.edit(Object.fromEntries(Object.entries(next).filter(([key, value]) => !syncCore.equal(value, visible[key]))));
    if (sync.dirtyKeys().has("calendarIds")) {
      sync.edit({ calendarName: calendars.filter(c => next.calendarIds.includes(c.id)).map(c => c.name).join(", ").slice(0, 200) });
    } else if (sync.dirtyKeys().has("calendarName")) {
      sync.edit({ calendarName: core.settingsFromStorage(sync.raw()).calendarName });
    }
    visible = next;
  }

  function renderCalendars(chosen) {
    calendarList.replaceChildren();
    const items = [...calendars, ...chosen.filter(id => !calendars.some(c => c.id === id))
      .map(id => ({ id, name: "Saved calendar (unavailable)", unavailable: true }))];
    for (const c of items) {
      const label = document.createElement("label"); label.className = "check" + (c.unavailable ? " unavailable" : "");
      const input = document.createElement("input"); input.type = "checkbox"; input.name = "calendarIds"; input.value = c.id; input.checked = chosen.includes(c.id);
      label.append(input, document.createTextNode(c.name + (c.primary ? " (primary)" : "")));
      calendarList.append(label);
    }
    renderedCalendars = true;
    if (items.some(c => c.unavailable)) status.textContent = "A saved calendar is unavailable. Restore access or deselect it before saving.";
  }

  function render(cfg, { reason, dirty }) {
    for (const [name, value] of Object.entries(cfg)) {
      if (dirty.has(name) || ["calendarIds", "calendarId", "timeZone"].includes(name)) continue;
      const input = field(name);
      if (!input) continue;
      if (input.type === "checkbox") input.checked = value;
      else if (input.value !== String(value)) input.value = value;
    }
    if (!dirty.has("timeZone")) {
      const zone = cfg.timeZone || (reason === "loaded" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "");
      if (zone) selectTimeZone(zone);
      else field("timeZone").value = "";
    }
    if (renderedCalendars && !dirty.has("calendarIds") && !syncCore.equal(chosenIds(), cfg.calendarIds)) renderCalendars(cfg.calendarIds);
    visible = rawValues();
    if (reason === "incoming") status.textContent = dirty.size
      ? "Settings updated in another window or device. Your unsaved changes are kept."
      : "Settings updated in this browser.";
  }

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
      renderCalendars(sync.values().calendarIds);
      visible = rawValues();
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
    captureChanges();
    status.textContent = "Unsaved changes";
  });
  const changed = () => { if (initialized) { captureChanges(); status.textContent = "Unsaved changes"; } };
  form.addEventListener("input", changed);
  form.addEventListener("change", changed);
  refresh.addEventListener("click", () => { void loadCalendars(); });
  document.addEventListener("calendar-hours-connection-changed", () => { if (initialized) void loadCalendars(); });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!initialized || saving) return;
    captureChanges();
    const raw = rawValues();
    const ids = raw.calendarIds;
    if (field("enabled").checked && (!ready || !ids.length || ids.some(id => !calendars.some(c => c.id === id)))) { status.textContent = "Connect Google Calendar in General, then select available calendars here."; return; }
    const value = core.settingsFrom({ ...sync.values(), ...raw });
    if (value.enabled && !core.configured(value)) { status.textContent = "Enter a phrase to match event titles and choose a time zone."; return; }
    try {
      if (value.enabled && !core.settingsFromStorage(sync.raw()).timeZone) sync.edit({ timeZone: value.timeZone });
      saving = true;
      status.textContent = "Saving…";
      await sync.save(value);
      status.textContent = sync.dirtyKeys().size ? "Unsaved changes" : sync.values().enabled
        ? "Saved in this browser. Return to Workday → Actions → Auto-fill from Calendar."
        : "Saved in this browser. Calendar import is disabled.";
    } catch (error) { status.textContent = `Could not save: ${error.message}. Your changes are kept here; try Save import settings again.`; }
    finally { saving = false; }
  });
  sync.load().then(async () => {
    initialized = true;
    form.inert = false;
    await loadCalendars();
    if (location.hash === "#workday") document.querySelector("#workday").scrollIntoView({ block: "start" });
  }).catch(error => { status.textContent = `Could not load settings: ${error.message}. Reload this page to try again.`; });
  window.addEventListener("pagehide", event => { if (!event.persisted) sync.dispose(); });
})();
