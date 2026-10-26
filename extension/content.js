(function () {
  "use strict";
  const core = globalThis.CalendarHoursCore;
  let settings = core.settingsFrom();
  let chip = null;
  let preview = null;
  let dismissedFor = null;
  let timer = null;
  let changingTitle = false;
  let timeEditedFor = null;
  let gridGesture = null;
  let gridBusy = false;
  let notice = null;

  const visible = element => !!element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
  const firstVisible = (root, selector) => [...root.querySelectorAll(selector)].find(visible) || null;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function waitFor(getValue, timeout = 5000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const value = getValue();
      if (value) return value;
      await pause(100);
    }
    return null;
  }

  function labelledButton(root, label) {
    return [...root.querySelectorAll('button,[role="button"]')].find(element =>
      visible(element) && (element.getAttribute("aria-label") === label || element.textContent.trim() === label)
    ) || null;
  }

  function showNotice(message) {
    if (notice) notice.remove();
    notice = document.createElement("div");
    notice.className = "calendar-hours-notice";
    notice.setAttribute("role", "status");
    notice.textContent = message;
    document.body.append(notice);
    const current = notice;
    setTimeout(() => { if (notice === current) { notice.remove(); notice = null; } }, 7000);
  }

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
    if (gridBusy) { hideChip(); return; }
    const key = `${editor.title.value}|${result.minutes}`;
    const hasKeyword = editor.title.value.toLowerCase().includes(settings.keyword.toLowerCase());
    if (hasKeyword) { apply("keyword"); return; }
    if (settings.keepUpdated && timeEditedFor === editor.title && core.matchesAutoWords(editor.title.value, settings)) {
      timeEditedFor = null;
      apply("time edit");
      return;
    }
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

  function eventChip(id) {
    return [...document.querySelectorAll('[data-eventchip][data-eventid]')].find(chip => chip.getAttribute("data-eventid") === id) || null;
  }

  function chipTitle(chip) {
    return chip?.querySelector("span.I0UMhf")?.textContent?.trim()
      || chip?.querySelector('[aria-hidden="true"] span')?.textContent?.trim()
      || "";
  }

  function chipSummary(chip) {
    return chip?.firstElementChild?.textContent?.trim() || chip?.getAttribute("aria-label") || "";
  }

  async function syncResizedEvent(gesture) {
    if (gridBusy || !settings.keepUpdated) return;
    gridBusy = true;
    let changedEditor = false;
    try {
      const changedChip = await waitFor(() => {
        const chip = eventChip(gesture.id);
        return chip && chipSummary(chip) !== gesture.summary ? chip : null;
      }, 7000);
      if (!changedChip) return;
      await pause(650); // Allow Calendar to finish its own drag save and redraw.
      const chip = eventChip(gesture.id);
      if (!chip || chipTitle(chip) !== gesture.title || !core.matchesAutoWords(gesture.title, settings) || findEditor()
          || [...document.querySelectorAll('[role="dialog"]')].some(visible)) return;

      chip.click();
      const popup = await waitFor(() => [...document.querySelectorAll('[role="dialog"]')].find(dialog =>
        dialog.querySelector("h1")?.textContent?.trim() === gesture.title && labelledButton(dialog, "Edit event")
      ), 2500);
      if (popup) labelledButton(popup, "Edit event").click();
      else chip.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, detail: 2 }));
      const editor = await waitFor(() => {
        const current = findEditor();
        return current?.title.matches('input[aria-label="Title"]') && readFields(current).endTime ? current : null;
      });
      if (!editor || editor.title.value !== gesture.title) throw new Error("Event editor did not open for the changed event");

      const oneTimeEvent = [...document.querySelectorAll('main [role="combobox"], main [aria-label="Recurrence"]')].some(element =>
        visible(element) && (element.textContent || element.getAttribute("aria-label") || "").includes("Does not repeat")
      ) || [...document.querySelectorAll("main")].some(element => visible(element) && element.textContent.includes("Does not repeat"));
      if (!oneTimeEvent) {
        labelledButton(document, "Cancel event changes")?.click();
        showNotice("Calendar Hours: recurring event needs a manual title update.");
        return;
      }

      const result = calculate(editor);
      if (!result) {
        labelledButton(document, "Cancel event changes")?.click();
        return;
      }
      changingTitle = true;
      setNativeInputValue(editor.title, result.nextTitle);
      changingTitle = false;
      changedEditor = true;
      const save = labelledButton(document, "Save");
      if (!save) throw new Error("Calendar Save button was unavailable");
      save.click();
      const saved = await waitFor(() => chipTitle(eventChip(gesture.id)) === result.nextTitle, 7000);
      if (!saved) throw new Error("Calendar did not confirm the updated title");
    } catch (error) {
      showNotice(`Calendar Hours could not save the updated title. Open the event and use ${settings.keyword} or the shortcut.`);
      if (!changedEditor) labelledButton(document, "Cancel event changes")?.click();
    } finally {
      changingTitle = false;
      gridBusy = false;
      queueUpdate();
    }
  }

  function startGridGesture(event) {
    if (!settings.keepUpdated || gridBusy || !(event.target instanceof Element)) return;
    const chip = event.target.closest('[data-eventchip][data-eventid]');
    const title = chipTitle(chip);
    if (!chip || !title || !core.matchesAutoWords(title, settings)) return;
    gridGesture = { id: chip.getAttribute("data-eventid"), title, summary: chipSummary(chip), x: event.clientX, y: event.clientY };
  }

  function finishGridGesture(event) {
    const gesture = gridGesture;
    gridGesture = null;
    if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 5) syncResizedEvent(gesture);
  }

  document.addEventListener("pointerdown", startGridGesture, true);
  document.addEventListener("mousedown", event => { if (!gridGesture) startGridGesture(event); }, true);
  document.addEventListener("pointerup", finishGridGesture, true);
  document.addEventListener("mouseup", finishGridGesture, true);
  document.addEventListener("pointercancel", () => { gridGesture = null; }, true);

  document.addEventListener("input", event => {
    if (event.target instanceof HTMLInputElement && /^(Start|End) (date|time)$/i.test(event.target.getAttribute("aria-label") || "")) {
      timeEditedFor = findEditor()?.title || null;
    }
    if (!changingTitle && event.target instanceof HTMLInputElement) { dismissedFor = null; queueUpdate(); }
  }, true);
  document.addEventListener("change", event => {
    if (event.target instanceof HTMLInputElement && /^(Start|End) (date|time)$/i.test(event.target.getAttribute("aria-label") || "")) {
      timeEditedFor = findEditor()?.title || null;
    }
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
