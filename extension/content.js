(function () {
  "use strict";
  const core = globalThis.CalendarHoursCore;
  let settings = core.settingsFrom();
  let chip = null;
  let preview = null;
  let dismissedFor = null;
  let timer = null;
  let changingTitle = false;

  const visible = element => !!element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
  const firstVisible = (root, selector) => [...root.querySelectorAll(selector)].find(visible) || null;

  function findEditor() {
    const title = firstVisible(document, 'input[aria-label="Title"], input[aria-label="Add title"]');
    if (!title) return null;
    const root = title.closest('[role="dialog"]') || document;
    return { title, root };
  }

  function referenceYear() {
    const match = /\/calendar\/(?:u\/\d+\/)?r\/[^/]+\/(\d{4})\//.exec(location.pathname);
    return match ? Number(match[1]) : new Date().getFullYear();
  }

  function readFields(editor) {
    const { root } = editor;
    const input = name => firstVisible(root, `input[aria-label="${name}"]`);
    const startDate = input("Start date");
    const endDate = input("End date");
    const startTime = input("Start time");
    const endTime = input("End time");
    const summary = key => firstVisible(root, `[data-key="${key}"]`)?.textContent?.trim() || "";
    const allDay = input("All day")?.checked || false;
    return {
      startDate: startDate?.value || summary("startDate"),
      startDataDate: startDate?.getAttribute("data-date") || "",
      startTime: startTime?.value || summary("startTime"),
      endDate: endDate?.value || summary("endDate") || startDate?.value || summary("startDate"),
      endDataDate: endDate?.getAttribute("data-date") || "",
      endTime: endTime?.value || summary("endTime"),
      allDay,
      referenceYear: referenceYear()
    };
  }

  function calculate(editor) {
    const minutes = core.durationMinutes(readFields(editor));
    const formatted = minutes == null ? null : core.formattedDuration(minutes, settings);
    const nextTitle = formatted ? core.titleWithDuration(editor.title.value, formatted, settings) : null;
    return formatted && nextTitle && nextTitle !== editor.title.value ? { formatted, nextTitle, minutes } : null;
  }

  function setNativeInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: value }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function apply(reason) {
    const editor = findEditor();
    if (!editor) return { ok: false, message: "Open a Google Calendar event first." };
    const result = calculate(editor);
    if (!result) return { ok: false, message: "Enter a title and valid start and end times first, or the hours are already current." };
    changingTitle = true;
    setNativeInputValue(editor.title, result.nextTitle);
    changingTitle = false;
    dismissedFor = null;
    hideChip();
    queueUpdate();
    return { ok: true, message: `Added ${result.formatted.text} to the title. Save the event in Calendar.`, reason };
  }

  function hideChip() {
    if (chip) chip.remove();
    chip = null;
    preview = null;
  }

  function showChip(editor, result) {
    if (!chip) {
      chip = document.createElement("button");
      chip.type = "button";
      chip.className = "calendar-hours-suggestion";
      chip.setAttribute("aria-label", "Add calculated duration to event title");
      chip.addEventListener("mousedown", event => event.preventDefault());
      chip.addEventListener("click", () => apply("suggestion"));
      document.body.append(chip);
    }
    const label = `${result.formatted.text}  ·  Click or press Tab to add`;
    if (chip.textContent !== label) chip.textContent = label;
    chip.title = "Calendar Hours suggestion";
    const rect = editor.title.getBoundingClientRect();
    chip.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - chip.offsetWidth - 8))}px`;
    chip.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - chip.offsetHeight - 8)}px`;
    preview = result;
  }

  function update() {
    const editor = findEditor();
    const result = editor && calculate(editor);
    if (!editor || !result) { hideChip(); return; }
    const key = `${editor.title.value}|${result.minutes}`;
    const hasKeyword = editor.title.value.toLowerCase().includes(settings.keyword.toLowerCase());
    if (hasKeyword) { apply("keyword"); return; }
    if (settings.automatic && core.matchesAutoWords(editor.title.value, settings) && document.activeElement !== editor.title) {
      apply("automatic"); return;
    }
    if (settings.showSuggestion && key !== dismissedFor) showChip(editor, result);
    else hideChip();
  }

  function queueUpdate() {
    clearTimeout(timer);
    timer = setTimeout(update, 120);
  }

  document.addEventListener("input", event => {
    if (!changingTitle && event.target instanceof HTMLInputElement) { dismissedFor = null; queueUpdate(); }
  }, true);
  document.addEventListener("change", event => {
    if (!changingTitle && event.target instanceof HTMLInputElement) { dismissedFor = null; queueUpdate(); }
  }, true);
  document.addEventListener("focusout", event => {
    if (event.target instanceof HTMLInputElement) queueUpdate();
  }, true);
  document.addEventListener("keydown", event => {
    const editor = findEditor();
    if (!editor || event.target !== editor.title) return;
    if (event.key === "Tab" && !event.shiftKey && preview && chip) {
      event.preventDefault();
      apply("suggestion");
    } else if (event.key === "Escape" && preview) {
      dismissedFor = `${editor.title.value}|${preview.minutes}`;
      hideChip();
    }
  }, true);
  window.addEventListener("resize", queueUpdate);
  window.addEventListener("scroll", queueUpdate, true);
  new MutationObserver(queueUpdate).observe(document.documentElement, { childList: true, subtree: true });

  chrome.storage.sync.get(null).then(saved => { settings = core.settingsFrom(saved); queueUpdate(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    const patch = Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.newValue]));
    settings = core.settingsFrom({ ...settings, ...patch });
    queueUpdate();
  });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type === "CALENDAR_HOURS_APPLY") respond(apply(message.reason || "manual"));
  });
  queueUpdate();
})();
