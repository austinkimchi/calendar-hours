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
  let queuedGridGesture = null;
  let gridBusy = false;
  const observedGridRanges = new Map();
  const gridFallbackTimers = new Map();
  let notice = null;
  const optimisticTitles = new Map();
  let settingsReady;

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
    if (timeEditedFor === editor.title.value && core.shouldUpdateDuration(editor.title.value, settings)) {
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

  function detailsHeading(id) {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find(element => visible(element) &&
      [...element.querySelectorAll("[data-eventid]")].some(child => child.getAttribute("data-eventid") === id));
    return dialog?.querySelector('[role="heading"][aria-level="1"]') || null;
  }

  function waitForGridChange(id, previousSummary) {
    return new Promise(resolve => {
      let observer;
      let timeout;
      const finish = chip => {
        observer?.disconnect();
        clearTimeout(timeout);
        resolve(chip);
      };
      const check = () => {
        const chip = eventChip(id);
        if (chip && chipSummary(chip) !== previousSummary) finish(chip);
      };
      observer = new MutationObserver(check);
      observer.observe(document.documentElement, {
        childList: true, characterData: true, attributes: true, attributeFilter: ["aria-label"], subtree: true
      });
      timeout = setTimeout(() => finish(null), 7000);
      check();
    });
  }

  function paintOptimisticTitles() {
    if (typeof document === "undefined") return;
    for (const [id, { original, next }] of optimisticTitles) {
      const chip = eventChip(id);
      if (!chip) continue;
      const heading = detailsHeading(id);
      if (heading?.textContent?.trim() === original) heading.textContent = next;
      if (chipSummary(chip).includes(next)) {
        if (!heading) optimisticTitles.delete(id);
        continue;
      }
      const label = chip.querySelector("span.I0UMhf");
      if (label && label.textContent.trim() !== next) label.textContent = next;
    }
  }

  function restoreChipTitle(id, original, expected) {
    optimisticTitles.delete(id);
    const chip = eventChip(id);
    const label = chip?.querySelector("span.I0UMhf");
    if (label?.textContent?.trim() === expected && !chipSummary(chip).includes(expected)) label.textContent = original;
    const heading = detailsHeading(id);
    if (heading?.textContent?.trim() === expected && !chipSummary(chip).includes(expected)) heading.textContent = original;
  }

  function gridRange(summary) {
    const times = /^([^,]+?) to ([^,]+?),/.exec(summary);
    const date = /,\s*([A-Za-z]+ \d{1,2}, \d{4})$/.exec(summary)?.[1];
    if (!times || !date || !core.parseClock(times[1]) || !core.parseClock(times[2])) return null;
    return { startTime: times[1], endTime: times[2], date };
  }

  function gridRangeKey(summary) {
    const range = gridRange(summary);
    return range ? `${range.date}|${range.startTime}|${range.endTime}` : null;
  }

  function scanGridChanges() {
    if (typeof document === "undefined") return;
    for (const chip of document.querySelectorAll('[data-eventchip][data-eventid]')) {
      const id = chip.getAttribute("data-eventid");
      const summary = chipSummary(chip);
      const rangeKey = gridRangeKey(summary);
      const title = chipTitle(chip);
      if (!id || !rangeKey || !title) continue;
      const previous = observedGridRanges.get(id);
      observedGridRanges.set(id, { summary, rangeKey, title });
      if (!previous || previous.rangeKey === rangeKey || !core.shouldUpdateDuration(title, settings)) continue;
      clearTimeout(gridFallbackTimers.get(id));
      gridFallbackTimers.set(id, setTimeout(() => {
        gridFallbackTimers.delete(id);
        const current = eventChip(id);
        if (!current || gridBusy || chipTitle(current) !== previous.title ||
            gridRangeKey(chipSummary(current)) !== rangeKey) return;
        syncResizedEvent({ id, title: previous.title, summary: previous.summary });
      }, 250));
    }
  }

  function sameClock(left, right) {
    const a = core.parseClock(left);
    const b = core.parseClock(right);
    return !!a && !!b && a.hour === b.hour && a.minute === b.minute;
  }

  function oneTimeEvent() {
    const recurrence = firstVisible(document, '[role="combobox"][aria-label="Recurrence"]');
    return recurrence?.textContent?.trim() === "Does not repeat";
  }

  async function saveInBackground(message) {
    await settingsReady;
    if (!core.shouldUpdateDuration(message.title, settings)) return { ok: false, reason: "Automatic updates are off for this title" };
    if (!decodeURIComponent(location.pathname).endsWith(`/eventedit/${message.id}`)) return { ok: false, reason: "Wrong event editor" };
    const editor = await waitFor(() => {
      const current = findEditor();
      return current?.title.matches('input[aria-label="Title"]') && readFields(current).endTime ? current : null;
    }, 10000);
    if (!editor) return { ok: false, reason: "Event editor did not load" };
    if (editor.title.value !== message.title) return { ok: false, reason: "Event title changed" };
    const fields = readFields(editor);
    if (message.startTime && message.endTime &&
        (!sameClock(fields.startTime, message.startTime) || !sameClock(fields.endTime, message.endTime))) {
      return { ok: false, retry: true, reason: "Waiting for Calendar's resize save" };
    }
    if (!oneTimeEvent()) return { ok: false, reason: "recurring event" };
    const result = calculate(editor);
    if (!result) return { ok: false, reason: "Duration was not available or already current" };
    changingTitle = true;
    setNativeInputValue(editor.title, result.nextTitle);
    changingTitle = false;
    const save = labelledButton(document, "Save");
    if (!save) return { ok: false, reason: "Calendar Save button was unavailable" };
    save.click();
    const saved = await waitFor(() => !location.pathname.includes("/eventedit/") &&
      [...document.querySelectorAll('[aria-live="polite"]')].some(element => element.textContent.trim() === "Event saved"), 10000);
    return saved ? { ok: true, nextTitle: result.nextTitle } : { ok: false, reason: "Calendar did not confirm the save" };
  }

  async function verifyBackgroundSave(message) {
    if (!decodeURIComponent(location.pathname).endsWith(`/eventedit/${message.id}`)) return null;
    const editor = await waitFor(() => {
      const current = findEditor();
      return current?.title.matches('input[aria-label="Title"]') ? current : null;
    }, 10000);
    return { ok: !!editor && editor.title.value === message.title };
  }

  async function syncResizedEvent(gesture) {
    if (gridBusy || !core.shouldUpdateDuration(gesture.title, settings)) return;
    gridBusy = true;
    let expectedTitle = null;
    try {
      const changedChip = await waitForGridChange(gesture.id, gesture.summary);
      if (!changedChip) return;
      const chip = eventChip(gesture.id);
      if (!chip || chipTitle(chip) !== gesture.title || !core.shouldUpdateDuration(gesture.title, settings) || findEditor()) return;
      const range = gridRange(chipSummary(chip));
      if (range) {
        const minutes = core.durationMinutes({
          startDate: range.date, endDate: range.date,
          startTime: range.startTime, endTime: range.endTime
        });
        const formatted = minutes == null ? null : core.formattedDuration(minutes, settings);
        expectedTitle = core.titleWithDuration(gesture.title, formatted, settings);
        if (expectedTitle && expectedTitle !== gesture.title) {
          optimisticTitles.set(gesture.id, { original: gesture.title, next: expectedTitle });
          paintOptimisticTitles();
        }
      }
      const response = await chrome.runtime.sendMessage({
        type: "CALENDAR_HOURS_GRID_SYNC", id: gesture.id, title: gesture.title,
        startTime: range?.startTime || "", endTime: range?.endTime || ""
      });
      if (!response?.ok) throw new Error(response?.reason || "Background save failed");
      if (response.nextTitle) {
        expectedTitle = response.nextTitle;
        optimisticTitles.set(gesture.id, { original: gesture.title, next: expectedTitle });
        paintOptimisticTitles();
      }
    } catch (error) {
      console.warn("Calendar Hours could not update a resized event:", error);
      if (expectedTitle) restoreChipTitle(gesture.id, gesture.title, expectedTitle);
      const recurring = error.message === "recurring event";
      showNotice(recurring ? "Calendar Hours: recurring event needs a manual title update."
        : `Calendar Hours could not save the updated title. Open the event and use ${settings.keyword} or the shortcut.`);
    } finally {
      changingTitle = false;
      gridBusy = false;
      queueUpdate();
      const queued = queuedGridGesture;
      queuedGridGesture = null;
      const current = queued && eventChip(queued.id);
      const currentTitle = chipTitle(current);
      if (queued && currentTitle && core.shouldUpdateDuration(currentTitle, settings)) {
        syncResizedEvent({ ...queued, title: currentTitle });
      }
    }
  }

  function startGridGesture(event) {
    if (!(event.target instanceof Element)) return;
    const chip = event.target.closest('[data-eventchip][data-eventid]');
    const title = chipTitle(chip);
    if (!chip || !title || !core.shouldUpdateDuration(title, settings)) return;
    gridGesture = { id: chip.getAttribute("data-eventid"), title, summary: chipSummary(chip), x: event.clientX, y: event.clientY };
  }

  function finishGridGesture(event) {
    const gesture = gridGesture;
    gridGesture = null;
    if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 5) {
      if (gridBusy) queuedGridGesture = gesture;
      else syncResizedEvent(gesture);
    }
  }

  document.addEventListener("pointerdown", startGridGesture, true);
  document.addEventListener("mousedown", event => { if (!gridGesture) startGridGesture(event); }, true);
  document.addEventListener("pointerup", finishGridGesture, true);
  document.addEventListener("mouseup", finishGridGesture, true);
  document.addEventListener("pointercancel", () => { gridGesture = null; }, true);

  document.addEventListener("input", event => {
    if (event.target instanceof HTMLInputElement && /^(Start|End) (date|time)$/i.test(event.target.getAttribute("aria-label") || "")) {
      timeEditedFor = findEditor()?.title.value || null;
    }
    if (!changingTitle && event.target instanceof HTMLInputElement) { dismissedFor = null; queueUpdate(); }
  }, true);
  document.addEventListener("change", event => {
    if (event.target instanceof HTMLInputElement && /^(Start|End) (date|time)$/i.test(event.target.getAttribute("aria-label") || "")) {
      timeEditedFor = findEditor()?.title.value || null;
    }
    if (!changingTitle && event.target instanceof HTMLInputElement) { dismissedFor = null; queueUpdate(); }
  }, true);
  document.addEventListener("focusout", event => {
    if (event.target instanceof HTMLInputElement) {
      if (/^(Start|End) (date|time)$/i.test(event.target.getAttribute("aria-label") || "")) {
        timeEditedFor = findEditor()?.title.value || null;
      }
      queueUpdate();
    }
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
  new MutationObserver(changes => {
    if (optimisticTitles.size) paintOptimisticTitles();
    scanGridChanges();
    if (changes.some(change => change.type === "childList")) queueUpdate();
  }).observe(document.documentElement, {
    childList: true, characterData: true, subtree: true
  });

  settingsReady = chrome.storage.sync.get(null).then(saved => { settings = core.settingsFrom(saved); scanGridChanges(); queueUpdate(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    const patch = Object.fromEntries(Object.entries(changes).map(([key, change]) => [key, change.newValue]));
    settings = core.settingsFrom({ ...settings, ...patch });
    queueUpdate();
  });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type === "CALENDAR_HOURS_APPLY") respond(apply(message.reason || "manual"));
    if (message?.type === "CALENDAR_HOURS_BACKGROUND_SYNC") {
      saveInBackground(message).then(respond, error => respond({ ok: false, reason: error.message }));
      return true;
    }
    if (message?.type === "CALENDAR_HOURS_BACKGROUND_VERIFY") {
      verifyBackgroundSave(message).then(respond, error => respond({ ok: false, reason: error.message }));
      return true;
    }
  });
  queueUpdate();
})();
