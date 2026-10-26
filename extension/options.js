(function () {
  "use strict";
  const core = globalThis.CalendarHoursCore;
  const form = document.querySelector("#settings");
  const rules = document.querySelector("#rules");
  const status = document.querySelector("#status");
  const replaceHelpButton = document.querySelector("#replace-help-button");
  const replaceHelp = document.querySelector("#replace-help");
  const names = Object.keys(core.defaults).filter(name => name !== "matchingPhrases");
  let minutesTemplateInitialized = false;
  let lastHoursUnit = core.defaults.unit;
  let lastMinutesUnit = core.defaults.minutesUnit;

  function addRule(phrase = "", dynamic = false) {
    const row = document.querySelector("#rule-template").content.firstElementChild.cloneNode(true);
    const phraseInput = row.querySelector(".rule-phrase");
    const dynamicInput = row.querySelector(".rule-dynamic input");
    const removeButton = row.querySelector(".remove-rule");
    phraseInput.value = phrase;
    const labelRow = () => {
      const name = phraseInput.value.trim() || "this phrase";
      dynamicInput.setAttribute("aria-label", `Dynamic mode for ${name}`);
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

  function values() {
    const fields = Object.fromEntries(names.map(name => {
      const field = form.elements.namedItem(name);
      return [name, field.type === "checkbox" ? field.checked : field.value];
    }));
    return core.settingsFrom({ ...fields, matchingPhrases: matchingPhrases() });
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
      ? "Dynamic and automatic time-change updates both need to replace the old duration. Turn both off to change this setting."
      : dynamicEnabled
        ? "Dynamic needs to replace the old duration when an event's time changes. Turn off Dynamic for all phrases to change this setting."
        : "Automatic time-change updates need to replace the old duration. Turn off ‘Update hours or minutes when times change’ to change this setting.";
  }

  function showMinutesFormat() {
    const alwaysMinutes = form.elements.namedItem("displayUnit").value === "minutes";
    const showMinutes = alwaysMinutes || form.elements.namedItem("minutesBelowHour").checked;
    document.querySelector("#hours-format").hidden = alwaysMinutes;
    document.querySelector("#below-hour-option").hidden = alwaysMinutes;
    document.querySelector("#below-hour-hint").hidden = alwaysMinutes;
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

  chrome.storage.sync.get(null).then(saved => {
    const cfg = core.settingsFrom(saved);
    minutesTemplateInitialized = typeof saved.minutesTemplate === "string" && saved.minutesTemplate.includes("{value}");
    for (const name of names) {
      const field = form.elements.namedItem(name);
      if (field.type === "checkbox") field.checked = cfg[name];
      else field.value = String(cfg[name]);
    }
    rules.replaceChildren();
    for (const rule of cfg.matchingPhrases) addRule(rule.phrase, rule.dynamic);
    lastHoursUnit = cfg.unit;
    lastMinutesUnit = cfg.minutesUnit;
    preview();
  });

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
    status.textContent = "";
  });
  rules.addEventListener("click", event => {
    if (!event.target.closest(".remove-rule")) return;
    event.target.closest(".rule-row").remove();
    preview();
    status.textContent = "";
  });
  form.addEventListener("input", () => { preview(); status.textContent = ""; });
  form.addEventListener("change", () => { preview(); status.textContent = ""; });

  const helpButton = document.querySelector("#dynamic-help-button");
  const help = document.querySelector("#dynamic-help");
  helpButton.addEventListener("click", () => {
    help.hidden = !help.hidden;
    helpButton.setAttribute("aria-expanded", String(!help.hidden));
  });
  replaceHelpButton.addEventListener("click", () => {
    replaceHelp.hidden = !replaceHelp.hidden;
    replaceHelpButton.setAttribute("aria-expanded", String(!replaceHelp.hidden));
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const cfg = values();
      if (!minutesTemplateInitialized) delete cfg.minutesTemplate;
      await chrome.storage.sync.set(cfg);
      await chrome.storage.sync.remove(["autoWords", "keepUpdated"]);
      rules.replaceChildren();
      for (const rule of cfg.matchingPhrases) addRule(rule.phrase, rule.dynamic);
      updateReplaceExisting();
      status.textContent = "Saved";
    } catch (error) {
      status.textContent = `Could not save: ${error.message}`;
    }
  });
})();
