(function () {
  "use strict";
  const core = globalThis.CalendarHoursCore;
  const form = document.querySelector("#settings");
  const status = document.querySelector("#status");
  const names = Object.keys(core.defaults);

  function values() {
    return core.settingsFrom(Object.fromEntries(names.map(name => {
      const field = form.elements.namedItem(name);
      return [name, field.type === "checkbox" ? field.checked : field.value];
    })));
  }

  function preview() {
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
    preview();
  });
  form.addEventListener("input", preview);
  form.elements.namedItem("keepUpdated").addEventListener("change", event => {
    if (event.target.checked) form.elements.namedItem("replaceExisting").checked = true;
  });
  form.elements.namedItem("replaceExisting").addEventListener("change", event => {
    if (form.elements.namedItem("keepUpdated").checked) event.target.checked = true;
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      await chrome.storage.sync.set(values());
      status.textContent = "Saved";
    } catch (error) {
      status.textContent = `Could not save: ${error.message}`;
    }
  });
})();
