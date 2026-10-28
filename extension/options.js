(function () {
  "use strict";
  const core = globalThis.CalendarHoursCore;
  const syncCore = globalThis.CalendarHoursSettingsSync;
  const form = document.querySelector("#settings");
  const rules = document.querySelector("#rules");
  const status = document.querySelector("#status");
  const replaceHelpButton = document.querySelector("#replace-help-button");
  const replaceHelp = document.querySelector("#replace-help");
  const names = Object.keys(core.defaults).filter(name => name !== "matchingPhrases");
  let minutesTemplateInitialized = false;
  let lastHoursUnit = core.defaults.unit;
  let lastMinutesUnit = core.defaults.minutesUnit;
  let saveTimer = null;
  let initialized = false;
  let visible = {};
  form.inert = true;
  const sync = syncCore.create({ storage: chrome.storage, read: core.settingsFrom, onUpdate: render });

  function addRule(phrase = "", dynamic = false) {
    const row = document.querySelector("#rule-template").content.firstElementChild.cloneNode(true);
    const phraseInput = row.querySelector(".rule-phrase");
    const dynamicInput = row.querySelector(".rule-dynamic input");
    const removeButton = row.querySelector(".remove-rule");
    phraseInput.value = phrase;
    const labelRow = () => {
      const name = phraseInput.value.trim() || "this phrase";
      dynamicInput.setAttribute("aria-label", `Auto-update for ${name}`);
      removeButton.setAttribute("aria-label", `Remove ${name}`);
    };
    phraseInput.addEventListener("input", labelRow);
    labelRow();
    row.querySelector(".rule-dynamic input").checked = dynamic;
    rules.append(row);
    return row;
  }

  function matchingPhrases() {
    return [...rules.querySelectorAll(".rule-row")].map(row => ({
      phrase: row.querySelector(".rule-phrase").value,
      dynamic: row.querySelector(".rule-dynamic input").checked
    }));
  }

  function rawValues() {
    const fields = Object.fromEntries(names.map(name => {
      const field = form.elements.namedItem(name);
      return [name, field.type === "checkbox" ? field.checked
        : ["decimals", "incrementMinutes"].includes(name) ? Number(field.value) : field.value];
    }));
    return { ...fields, matchingPhrases: matchingPhrases() };
  }
  const values = () => core.settingsFrom(rawValues());

  function captureChanges() {
    const next = rawValues();
    sync.edit(Object.fromEntries(Object.entries(next).filter(([key, value]) =>
      (key !== "minutesTemplate" || minutesTemplateInitialized) && !syncCore.equal(value, visible[key]))));
    if (minutesTemplateInitialized && !sync.raw().minutesTemplate) sync.edit({ minutesTemplate: next.minutesTemplate }, { force: true });
    visible = next;
  }

  function render(cfg, { reason, dirty }) {
    for (const name of names) {
      if (dirty.has(name)) continue;
      const field = form.elements.namedItem(name);
      if (field.type === "checkbox") field.checked = cfg[name];
      else if (field.value !== String(cfg[name])) field.value = String(cfg[name]);
    }
    if (!dirty.has("matchingPhrases") && !syncCore.equal(matchingPhrases(), cfg.matchingPhrases)) {
      rules.replaceChildren();
      for (const rule of cfg.matchingPhrases) addRule(rule.phrase, rule.dynamic);
    }
    if (!dirty.has("minutesTemplate")) {
      const template = sync.raw().minutesTemplate;
      minutesTemplateInitialized = typeof template === "string" && template.includes("{value}");
    }
    lastHoursUnit = form.elements.namedItem("unit").value;
    lastMinutesUnit = form.elements.namedItem("minutesUnit").value;
    preview();
    visible = rawValues();
    if (reason === "incoming") status.textContent = dirty.size
      ? "Settings updated in another window or device. Your unsaved changes are kept."
      : "Settings updated in this browser.";
    else if (reason === "saved") status.textContent = dirty.size ? "Unsaved changes" : "Saved in this browser";
  }

  function updateReplaceExisting() {
    const field = form.elements.namedItem("replaceExisting");
    const updateEnabled = form.elements.namedItem("updateExistingHours").checked;
    const dynamicEnabled = matchingPhrases().some(item => item.dynamic && item.phrase.trim());
    const needed = updateEnabled || dynamicEnabled;
    if (needed) field.checked = true;
    field.disabled = needed;
    replaceHelpButton.hidden = !needed;
    if (!needed) {
      replaceHelp.hidden = true;
      replaceHelpButton.setAttribute("aria-expanded", "false");
    }
    replaceHelp.textContent = dynamicEnabled && updateEnabled
      ? "Auto-update and updates to existing durations both need to replace the old duration. Turn both off to change this setting."
      : dynamicEnabled
        ? "Auto-update needs to replace the old duration when an event's time changes. Turn off Auto-update for all phrases to change this setting."
        : "Updates to existing durations need to replace the old duration. Turn off ‘Update existing durations when times change’ to change this setting.";
  }

  function showMinutesFormat() {
    const alwaysMinutes = form.elements.namedItem("displayUnit").value === "minutes";
    const showMinutes = alwaysMinutes || form.elements.namedItem("minutesBelowHour").checked;
    document.querySelector("#hours-format").hidden = alwaysMinutes;
    document.querySelector("#below-hour-option").hidden = alwaysMinutes;
    document.querySelector("#minutes-format").hidden = !showMinutes;
    form.elements.namedItem("template").required = !alwaysMinutes;
    form.elements.namedItem("minutesTemplate").required = showMinutes;
  }

  function initializeMinutesTemplate() {
    if (minutesTemplateInitialized) return;
    form.elements.namedItem("minutesTemplate").value = form.elements.namedItem("template").value;
    minutesTemplateInitialized = true;
  }

  function preview() {
    updateReplaceExisting();
    showMinutesFormat();
    const cfg = values();
    for (const [id, minutes] of [["preview", 190], ["short-preview", 45], ["singular-preview", 60]]) {
      const formatted = core.formattedDuration(minutes, cfg);
      document.querySelector(`#${id}`).textContent = core.titleWithDuration("Work session", formatted, cfg);
    }
  }

  function saveSettings() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!initialized) return Promise.resolve();
    captureChanges();
    if (!form.checkValidity() || !form.elements.namedItem("template").value.includes("{value}") ||
        !form.elements.namedItem("minutesTemplate").value.includes("{value}")) {
      status.textContent = "Finish the title template to save changes";
      return Promise.resolve();
    }
    const cfg = values();
    status.textContent = "Saving…";
    return sync.save(cfg).then(() => {
      status.textContent = sync.dirtyKeys().size ? "Unsaved changes" : "Saved in this browser";
    }).catch(error => {
      status.textContent = `Could not save: ${error.message}. Your changes are kept here; try Save settings again.`;
      throw error;
    });
  }

  function changed(immediate = false) {
    if (!initialized) return;
    captureChanges();
    status.textContent = "Unsaved changes";
    clearTimeout(saveTimer);
    if (immediate) void saveSettings().catch(() => {});
    else saveTimer = setTimeout(() => { void saveSettings().catch(() => {}); }, 350);
  }

  sync.load().then(() => { initialized = true; form.inert = false; }).catch(error => {
    status.textContent = `Could not load settings: ${error.message}. Reload this page to try again.`;
  });
  window.addEventListener("pagehide", event => { if (!event.persisted) sync.dispose(); });

  form.elements.namedItem("minutesBelowHour").addEventListener("change", event => {
    if (event.target.checked) initializeMinutesTemplate();
  });
  form.elements.namedItem("displayUnit").addEventListener("change", event => {
    if (event.target.value === "minutes") initializeMinutesTemplate();
  });
  form.elements.namedItem("minutesTemplate").addEventListener("input", () => { minutesTemplateInitialized = true; });
  form.elements.namedItem("unit").addEventListener("input", event => {
    const singular = form.elements.namedItem("singularUnit");
    if (singular.value === core.singularUnitFor(lastHoursUnit)) singular.value = core.singularUnitFor(event.target.value);
    lastHoursUnit = event.target.value;
  });
  form.elements.namedItem("minutesUnit").addEventListener("input", event => {
    const singular = form.elements.namedItem("minutesSingularUnit");
    if (singular.value === core.singularUnitFor(lastMinutesUnit)) singular.value = core.singularUnitFor(event.target.value);
    lastMinutesUnit = event.target.value;
  });

  document.querySelector("#add-rule").addEventListener("click", () => {
    const row = addRule();
    row.querySelector(".rule-phrase").focus();
  });
  rules.addEventListener("click", event => {
    if (!event.target.closest(".remove-rule")) return;
    event.target.closest(".rule-row").remove();
    preview();
    changed(true);
  });
  form.addEventListener("input", () => { preview(); changed(); });
  form.addEventListener("change", () => { preview(); changed(true); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && saveTimer) void saveSettings().catch(() => {});
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    await saveSettings().catch(() => {});
  });
})();
