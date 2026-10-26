(function () {
  "use strict";
  const core = globalThis.CalendarHoursCore;
  const form = document.querySelector("#settings");
  const rules = document.querySelector("#rules");
  const status = document.querySelector("#status");
  const names = Object.keys(core.defaults).filter(name => name !== "matchingPhrases");

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
    const needed = form.elements.namedItem("updateExistingHours").checked || matchingPhrases().some(item => item.dynamic && item.phrase.trim());
    if (needed) field.checked = true;
    field.disabled = needed;
    field.title = needed ? "Automatic updates need existing hours to be replaced." : "";
  }

  function preview() {
    updateReplaceExisting();
    const cfg = values();
    const formatted = core.formattedDuration(190, cfg);
    document.querySelector("#preview").textContent = core.titleWithDuration("Work session", formatted, cfg);
  }

  chrome.storage.sync.get(null).then(saved => {
    const cfg = core.settingsFrom(saved);
    for (const name of names) {
      const field = form.elements.namedItem(name);
      if (field.type === "checkbox") field.checked = cfg[name];
      else field.value = String(cfg[name]);
    }
    rules.replaceChildren();
    for (const rule of cfg.matchingPhrases) addRule(rule.phrase, rule.dynamic);
    preview();
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

  form.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const cfg = values();
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
