/* Developer Workday adapter: saves individual unsubmitted blocks through the visible form. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else api.install(root.document, root.chrome, root.CalendarHoursWorkday, root.CalendarHoursCore);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const aid = value => `[data-automation-id="${value}"]`;
  const visible = e => !!e && !e.hidden && e.getAttribute("aria-hidden") !== "true" && e.getClientRects().length > 0;
  function label(e) {
    const ids = (e.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
    return (e.getAttribute("aria-label") || ids.map(id => { const node = e.ownerDocument.getElementById(id); return node?.getAttribute("aria-label") || node?.textContent || ""; }).join(" ") || [...(e.labels || [])].map(l => l.textContent).join(" ") || e.textContent || "").replace(/\*/g, "").trim().replace(/\s+/g, " ");
  }
  function button(doc, name) {
    const matches = [...doc.querySelectorAll('button,[role="button"]')].filter(e => visible(e) && label(e) === name && !e.disabled && e.getAttribute("aria-disabled") !== "true");
    if (matches.length !== 1) throw new Error(`Workday's ${name} button could not be identified safely`);
    return matches[0];
  }
  function readView(doc, core) {
    if (![...doc.querySelectorAll('h1,[role="heading"][aria-level="1"]')].some(e => e.textContent.trim() === "Enter Time")) throw new Error("Open Workday's Enter Time calendar");
    const title = doc.querySelector(aid("dateRangeTitle"))?.textContent.trim();
    const body = doc.querySelector(aid("weeklyBody"));
    const cells = body ? [...body.querySelectorAll('[data-automation-id^="dayCell-"]')] : [];
    const mode = doc.querySelector(aid("calendarViewSelection"))?.textContent.trim();
    if (!["Day", "Week"].includes(mode) || cells.length !== (mode === "Day" ? 1 : 7)) throw new Error("Choose Day or Week in Workday's Enter Time calendar");
    const dates = core.datesFromLabels(title, cells.map(e => e.textContent));
    return { title, mode, dates, signature: `${mode}:${dates.join(",")}` };
  }
  function readExisting(doc, dates) {
    const byMonthDay = new Map(dates.map(d => [d.slice(5).split("-").map(Number).join("-"), d]));
    return [...doc.querySelectorAll(`${aid("calendarevent")}[role="link"]`)].flatMap(e => {
      const start = /^(\d+)-(\d+)-(\d+)-(\d+)$/.exec(e.getAttribute("data-automation-startdate") || "");
      const end = /^(\d+)-(\d+)-(\d+)-(\d+)$/.exec(e.getAttribute("data-automation-enddate") || "");
      if (!start || !end) {
        if (e.textContent.trim() === "Enter Time") return []; // transient unsaved selection
        throw new Error("An existing Workday block has unreadable times. Nothing was imported.");
      }
      const date = byMonthDay.get(`${+start[1]}-${+start[2]}`);
      if (!date) return [];
      const sameDay = +start[1] === +end[1] && +start[2] === +end[2];
      return [{ date, start: +start[3] * 60 + +start[4], end: sameDay ? +end[3] * 60 + +end[4] : 1440,
        type: e.querySelector(aid("calendarAppointmentTitle"))?.textContent.trim() || "",
        status: e.querySelector('[data-automation-icontype]')?.getAttribute("data-automation-icontype") || "",
        eventId: e.getAttribute("data-automation-eventid") || "", element: e }];
    });
  }
  function settingsError(message) {
    return Object.assign(new Error(message), { needsSettings: true });
  }
  async function waitFor(test, message, timeout = 15000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const result = test(); if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw message instanceof Error ? message : new Error(message);
  }
  function field(dialog, name) {
    const matches = [...dialog.querySelectorAll("input,textarea")].filter(e => label(e) === name && !e.disabled);
    if (matches.length !== 1) throw new Error(`Workday's ${name} field is unavailable`);
    return matches[0];
  }
  function setInput(input, value) {
    const win = input.ownerDocument.defaultView;
    const proto = input.tagName === "TEXTAREA" ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    input.focus(); Object.getOwnPropertyDescriptor(proto, "value").set.call(input, value);
    input.dispatchEvent(new win.Event("input", { bubbles: true }));
    input.dispatchEvent(new win.Event("change", { bubbles: true }));
    input.blur();
  }
  function normalizedClock(value) {
    return value.toUpperCase().replace(/\s/g, "").replace(/^0(?=\d:)/, "");
  }
  function commentText(doc, descriptions = []) {
    const notes = descriptions.map(description => {
      // Calendar descriptions can contain rich text. A detached template keeps
      // markup inert; only readable text is ever inserted into Workday.
      const template = doc.createElement("template");
      template.innerHTML = description;
      template.content.querySelectorAll("script,style,iframe,object").forEach(e => e.remove());
      template.content.querySelectorAll("br").forEach(e => e.replaceWith(doc.createTextNode("\n")));
      template.content.querySelectorAll("p,div,li,blockquote,pre,h1,h2,h3,h4,h5,h6").forEach(e => e.append(doc.createTextNode("\n")));
      return template.content.textContent.replace(/\u00a0/g, " ").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    }).filter(Boolean);
    return [...new Set(notes)].join("\n\n").slice(0, 1000);
  }
  function assertView(doc, core, expected) {
    if (readView(doc, core).signature !== expected.signature) throw new Error("The displayed dates changed. Import stopped; already saved entries remain unsubmitted.");
  }
  async function cancelDraft(doc, dialog) {
    button(dialog, "Cancel").click();
    const result = await waitFor(() => !dialog.isConnected ||
      [...doc.querySelectorAll('[role="dialog"]')].find(e => visible(e) && label(e) === "Discard Changes?"),
      "Workday did not close the draft. Cancel the open form before retrying.");
    if (result !== true) {
      button(result, "Discard").click();
      await waitFor(() => !dialog.isConnected && !result.isConnected, "Workday did not discard the unsaved draft");
    }
  }
  function updateTarget(doc, base, block, settings) {
    const previous = block.previous;
    const entries = readExisting(doc, base.dates);
    const matches = entries.filter(e => e.eventId === previous.eventId);
    const entry = matches[0];
    if (matches.length !== 1 || entry.date !== previous.date || entry.start !== previous.start || entry.end !== previous.end ||
        entry.type !== previous.type || entry.type !== settings.timeType || entry.status !== "Not Submitted") {
      throw new Error("The existing Workday entry changed or is no longer a draft. Nothing was overwritten.");
    }
    const overlaps = entries.filter(e => e.date === block.date && e.start < block.end && e.end > block.start);
    if (overlaps.length !== 1 || overlaps[0].eventId !== entry.eventId) throw new Error("The overlapping Workday entries changed. Correct this block manually.");
    return entry;
  }
  async function updateBlock(doc, core, base, block, settings) {
    if (!settings.updateOverlaps) throw settingsError("Enable ‘Overwrite existing times to match calendar’ before updating a Workday draft.");
    if (!block.previous?.eventId) throw new Error("The existing Workday entry could not be identified. Correct this block manually.");
    assertView(doc, core, base);
    if (doc.querySelector('[role="dialog"][aria-modal="true"]')) throw new Error("Close the open Workday dialog before importing");
    const entry = updateTarget(doc, base, block, settings);
    entry.element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    entry.element.click();
    const dialog = await waitFor(() => [...doc.querySelectorAll('[role="dialog"]')].find(e => visible(e) && label(e) === "Enter Time"), "Workday did not open the existing time-entry form");
    return saveBlockDialog(doc, core, base, block, settings, dialog, true);
  }
  async function createBlock(doc, core, base, block, settings) {
    assertView(doc, core, base);
    if (doc.querySelector('[role="dialog"][aria-modal="true"]')) throw new Error("Close the open Workday dialog before importing");
    const overlaps = readExisting(doc, base.dates).filter(e => e.date === block.date && e.start < block.end && e.end > block.start);
    if (overlaps.some(e => e.start === block.start && e.end === block.end && e.type === settings.timeType)) return "already-entered";
    if (overlaps.length) throw new Error("A Workday entry changed while importing. Import stopped to avoid overlapping hours.");
    const panel = doc.querySelector(aid("timedDaySeparator_0"))?.parentElement;
    if (!panel?.classList.contains("gwt-appointment-panel")) throw new Error("This Workday calendar layout is not supported");
    const intervals = [...panel.children].filter(e => e.matches(".major-time-interval,.minor-time-interval"));
    if (intervals.length !== 96) throw new Error("Workday's quarter-hour grid could not be identified safely");
    intervals[Math.floor(block.start / 15)].scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    const rect = panel.getBoundingClientRect();
    const x = rect.left + rect.width * (base.dates.indexOf(block.date) + 0.5) / base.dates.length;
    const y = rect.top + rect.height * (block.start + 0.5) / 1440;
    const target = doc.elementFromPoint(x, y);
    if (!target || !panel.contains(target)) throw new Error("The selected Workday time cell is obscured. Scroll it into view and try again.");
    // Workday selects a blank cell from its pointer/mouse down-up sequence, not click alone.
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      const EventType = type.startsWith("pointer") ? doc.defaultView.PointerEvent : doc.defaultView.MouseEvent;
      target.dispatchEvent(new EventType(type, { bubbles: true, cancelable: true, view: doc.defaultView,
        clientX: x, clientY: y, button: 0, buttons: type.endsWith("down") ? 1 : 0,
        pointerId: 1, pointerType: "mouse", isPrimary: true }));
    }
    const dialog = await waitFor(() => [...doc.querySelectorAll('[role="dialog"]')].find(e => visible(e) && label(e) === "Enter Time"), "Workday did not open the time-entry form");
    return saveBlockDialog(doc, core, base, block, settings, dialog);
  }
  async function saveBlockDialog(doc, core, base, block, settings, dialog, updating = false) {
    let saved = false;
    try {
      await waitFor(() => {
        try {
          const start = field(dialog, "In"), end = field(dialog, "Out");
          field(dialog, "Comment"); button(dialog, "Cancel"); button(dialog, "OK");
          return !updating || (!!start.value && !!end.value && [...dialog.querySelectorAll(aid("promptOption"))].some(visible));
        } catch { return false; }
      }, "Workday's time-entry form did not finish loading. Nothing was saved.");
      const [year, month, day] = block.date.split("-").map(Number);
      if (!new RegExp(`(?<!\\d)${month}/${day}/${year}(?!\\d)`).test(dialog.textContent)) throw new Error("Workday opened a different date. Nothing was saved.");
      const existingDialog = [...dialog.querySelectorAll("button")].some(e => visible(e) && label(e) === "Delete");
      const draftDialog = () => [...dialog.querySelectorAll(aid("promptOption"))].some(e => visible(e) && label(e) === "Not Submitted");
      if (!updating && existingDialog) throw new Error("Workday opened an existing entry. Nothing was changed.");
      if (updating) {
        if (!existingDialog || !draftDialog()) throw new Error("Workday did not open an editable, unsubmitted entry. Nothing was changed.");
        updateTarget(doc, base, block, settings);
        if (normalizedClock(field(dialog, "In").value) !== normalizedClock(core.clock(block.previous.start)) ||
            normalizedClock(field(dialog, "Out").value) !== normalizedClock(core.clock(block.previous.end))) {
          throw new Error("Workday opened different entry times. Nothing was changed.");
        }
      }
      const typeList = [...dialog.querySelectorAll('[role="listbox"]')].find(e => label(e) === "items selected for Time Type");
      const selected = typeList?.querySelector('[role="option"]')?.textContent.trim();
      if (selected !== settings.timeType) throw settingsError(`Workday selected ${selected || "no time type"}. Choose the matching Time Type in import settings.`);
      const reason = block.outReason || settings.outReason;
      const outReasonField = () => [...dialog.querySelectorAll('[role="combobox"]')].find(e => label(e).startsWith("Out Reason"));
      const reasonValue = () => {
        const el = outReasonField();
        return (el?.querySelector(aid("selectSelectedOption"))?.textContent ?? el?.textContent ?? "").replace(/\s+selected\s*$/, "").trim().replace(/^Out Reason\s*/, "").trim();
      };
      if (updating && block.previous.start === block.start && block.previous.end === block.end && reasonValue() === reason &&
          (!settings.importComments || field(dialog, "Comment").value === commentText(doc, block.descriptions))) {
        await cancelDraft(doc, dialog);
        return "already-entered";
      }
      setInput(field(dialog, "In"), core.clock(block.start));
      setInput(field(dialog, "Out"), core.clock(block.end));
      const outReason = [...dialog.querySelectorAll('[role="combobox"]')].find(e => label(e).startsWith("Out Reason"));
      if (!outReason) throw new Error("Workday's Out Reason field is unavailable");
      if (reasonValue() !== reason) {
        outReason.click();
        const option = await waitFor(() => [...doc.querySelectorAll('[role="option"]')].find(e => visible(e) && e.textContent.trim() === reason), settingsError(reason === "Meal" ? "Workday does not offer Meal as an Out Reason. Check the meal options in import settings." : "The configured Out Reason was not found. Check Out Reason in import settings."));
        option.click();
      }
      await waitFor(() => reasonValue() === reason, "Workday did not accept the requested Out Reason. Nothing was saved.");
      if (settings.importComments || !updating) {
        const comment = settings.importComments ? commentText(doc, block.descriptions) : "";
        setInput(field(dialog, "Comment"), comment);
        if (field(dialog, "Comment").value !== comment) throw new Error("Workday did not accept the calendar description. Nothing was saved.");
      }
      if (normalizedClock(field(dialog, "In").value) !== normalizedClock(core.clock(block.start)) ||
          normalizedClock(field(dialog, "Out").value) !== normalizedClock(core.clock(block.end))) throw new Error("Workday did not accept the exact calendar times");
      const amounts = [...dialog.querySelectorAll(aid("numericText"))].filter(visible);
      if (amounts.length !== 1) throw new Error("Workday's calculated Hours field could not be identified safely");
      await waitFor(() => {
        const amount = [...dialog.querySelectorAll(aid("numericText"))].filter(visible);
        return amount.length === 1 && amount[0].textContent.trim() !== "" &&
          Math.abs(Number(amount[0].textContent.trim()) * 60 - (block.end - block.start)) < 0.001;
      }, "Workday did not confirm the calendar duration. Nothing was saved.");
      assertView(doc, core, base);
      if (updating) {
        updateTarget(doc, base, block, settings);
        if (!draftDialog()) throw new Error("This entry is no longer an unsubmitted draft. Nothing was overwritten.");
      }
      // Explicit allowlist: this adapter never clicks Review, Next, Submit or Delete.
      button(dialog, "OK").click(); saved = true;
      await waitFor(() => !dialog.isConnected, "Workday did not confirm this entry. Check the open form before retrying.");
      await waitFor(() => readExisting(doc, base.dates).some(e => e.date === block.date && e.start === block.start && e.end === block.end && e.type === settings.timeType &&
        (!updating || (e.eventId === block.previous.eventId && e.status === "Not Submitted"))), "Workday closed the form but did not show the saved entry. Check the calendar before retrying.");
      return updating ? "updated" : "added";
    } catch (error) {
      if (!saved && dialog.isConnected) {
        try { await cancelDraft(doc, dialog); } catch { /* Keep an unfamiliar dialog for inspection. */ }
      }
      throw error;
    }
  }
  function install(doc, chromeApi, core, titleCore) {
    if (!core || !titleCore || doc.documentElement.dataset.calendarHoursWorkdayInstalled) return;
    doc.documentElement.dataset.calendarHoursWorkdayInstalled = "true";
    let busy = false;
    let statusBox;
    let statusSignature;
    const menus = new WeakMap();
    let openMenu = null;
    let menuSequence = 0;
    function showStatus(message, settingsAction = null) {
      const toolbar = doc.querySelector(aid("calendarToolbar"));
      if (!toolbar) return;
      if (!statusBox?.isConnected) {
        statusBox = doc.createElement("div"); statusBox.className = "calendar-hours-workday-status";
        statusBox.setAttribute("role", "status"); toolbar.after(statusBox);
      }
      try { statusSignature = readView(doc, core).signature; } catch { statusSignature = undefined; }
      statusBox.replaceChildren(doc.createTextNode(message));
      if (!settingsAction) return;
      const settings = doc.createElement("button"); settings.type = "button"; settings.textContent = settingsAction === "setup" ? "Set up calendar import" : "Import settings";
      settings.addEventListener("click", () => { void chromeApi.runtime.sendMessage({ type: "CALENDAR_HOURS_WORKDAY_SETUP" }); });
      statusBox.append(doc.createTextNode(" "), settings);
    }
    async function run() {
      if (busy) return; busy = true;
      let added = 0, updated = 0;
      try {
        const view = readView(doc, core);
        doc.querySelector(`${aid("calendarToolbar")} button[aria-label="Actions"][aria-expanded="true"]`)?.click();
        if (doc.querySelector('[role="dialog"][aria-modal="true"]')) throw new Error("Close the open Workday form before importing");
        showStatus(`Reading calendar for ${view.title}…`);
        const response = await chromeApi.runtime.sendMessage({ type: "CALENDAR_HOURS_WORKDAY_EVENTS", dates: view.dates });
        if (!response?.ok) {
          showStatus(response?.reason || "Calendar could not be read. Try again.", response?.needsSetup ? "setup" : null);
          if (response?.needsSetup) await chromeApi.runtime.sendMessage({ type: "CALENDAR_HOURS_WORKDAY_SETUP" });
          return;
        }
        assertView(doc, core, view);
        const plan = core.plan({ events: response.events, dates: view.dates, settings: response.settings, existing: readExisting(doc, view.dates), core: titleCore });
        let already = plan.skipped.filter(e => e.reason === "already-entered").length;
        for (const block of plan.update) {
          showStatus(`Updating ${view.title}: ${updated + 1} of ${plan.update.length}…`);
          const result = await updateBlock(doc, core, view, block, response.settings);
          if (result === "updated") updated++; else already++;
        }
        for (const block of plan.add) {
          showStatus(`Importing ${view.title}: ${added + 1} of ${plan.add.length}…`);
          const result = await createBlock(doc, core, view, block, response.settings);
          if (result === "added") added++; else already++;
        }
        const future = plan.skipped.filter(e => e.reason === "future").length;
        showStatus(`Calendar import: ${added} added, ${updated} updated, ${already} already entered${future ? `, ${future} future blocks skipped` : ""}.` +
          (plan.conflicts.length ? ` ${plan.conflicts.length} overlapping ${plan.conflicts.length === 1 ? "block needs" : "blocks need"} manual correction; conflicting entries were kept.` : "") +
          (plan.warnings.length ? ` ${plan.warnings.join(" ")}` : "") + " Entries remain unsubmitted.");
      } catch (error) {
        showStatus(`${added || updated ? `${added} added, ${updated} updated before stopping. ` : ""}${error.message}`,
          error.needsSetup ? "setup" : error.needsSettings ? "settings" : null);
      } finally { busy = false; }
    }
    function enhanceMenu(menu) {
      const prefix = `calendar-hours-workday-menu-${++menuSequence}`;
      const nativeOption = menu.querySelector('[role="option"]');
      const item = doc.createElement("div"); item.setAttribute("role", "option"); item.tabIndex = -1;
      item.id = `${prefix}-import`;
      item.dataset.calendarHours = "workday-import";
      item.className = (nativeOption?.className || "") + " calendar-hours-workday-menuitem";
      // Workday also styles native options through attributes we do not copy.
      if (nativeOption) item.style.padding = doc.defaultView.getComputedStyle(nativeOption).padding;
      item.textContent = "Auto-fill from Calendar";
      item.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); void run(); });
      menu.prepend(item);
      menu.classList.add("calendar-hours-workday-menu");
      const options = () => [...menu.querySelectorAll('[role="option"]')].filter(e => visible(e) && e.getAttribute("aria-disabled") !== "true");
      let active = item;
      let search = "", searchAt = 0;
      function select(option) {
        active = option;
        const all = [...menu.querySelectorAll('[role="option"]')];
        all.forEach((e, index) => {
          if (!e.id) e.id = `${prefix}-${index}`;
          e.setAttribute("aria-selected", String(e === option));
          e.setAttribute("aria-posinset", String(index + 1));
          e.setAttribute("aria-setsize", String(all.length));
          e.toggleAttribute("data-calendar-hours-active", e === option);
        });
        menu.setAttribute("aria-activedescendant", option.id);
      }
      // Workday's private selection index excludes the injected item. Handle
      // this list's keyboard navigation before its native bubbling handler so
      // Enter always activates the option that is visibly highlighted.
      menu.addEventListener("keydown", event => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const choices = options();
        if (!choices.length) return;
        const index = Math.max(0, choices.indexOf(active));
        let next;
        if (event.key === "ArrowDown") next = choices[(index + 1) % choices.length];
        else if (event.key === "ArrowUp") next = choices[(index + choices.length - 1) % choices.length];
        else if (event.key === "Home") next = choices[0];
        else if (event.key === "End") next = choices.at(-1);
        else if (event.key.length === 1 && event.key !== " ") {
          const now = Date.now();
          search = now - searchAt < 700 ? search + event.key.toLowerCase() : event.key.toLowerCase();
          searchAt = now;
          const phrase = [...search].every(char => char === search[0]) ? search[0] : search;
          next = [...choices.slice(index + 1), ...choices.slice(0, index + 1)].find(e => e.textContent.trim().toLowerCase().startsWith(phrase)) || active;
        }
        else if (!["Enter", " "].includes(event.key)) return; // Keep native Escape and Tab behavior.
        event.preventDefault(); event.stopImmediatePropagation();
        if (next) { select(next); next.scrollIntoView({ block: "nearest" }); }
        else if (!event.repeat) active.click();
      }, true);
      menu.addEventListener("mouseover", event => {
        const option = event.target.closest('[role="option"]');
        if (!option || !options().includes(option)) return;
        event.stopImmediatePropagation();
        select(option);
      }, true);
      // Workday can restore its original active descendant after its opening
      // animation. Keep screen-reader focus aligned with our visible selection.
      new doc.defaultView.MutationObserver(() => {
        if (visible(menu) && menu.getAttribute("aria-activedescendant") !== active.id) menu.setAttribute("aria-activedescendant", active.id);
      }).observe(menu, { attributes: true, attributeFilter: ["aria-activedescendant"] });
      return {
        open() {
          search = ""; searchAt = 0;
          menu.focus({ preventScroll: true });
          select(item);
        }
      };
    }
    function inject() {
      if (statusBox?.isConnected && !busy) {
        let current;
        try { current = readView(doc, core).signature; } catch { /* Not an Enter Time view. */ }
        if (current !== statusSignature) statusBox.remove();
      }
      if (![...doc.querySelectorAll("h1")].some(e => e.textContent.trim() === "Enter Time") ||
          doc.querySelector(`${aid("calendarToolbar")} button[aria-label="Actions"]`)?.getAttribute("aria-expanded") === "false") { openMenu = null; return; }
      const menu = [...doc.querySelectorAll('[role="listbox"]')].find(e => visible(e) && label(e) === "Actions");
      if (!menu) { openMenu = null; return; }
      if (!menus.has(menu)) menus.set(menu, enhanceMenu(menu));
      if (openMenu !== menu) {
        openMenu = menu;
        menus.get(menu).open();
      }
    }
    new doc.defaultView.MutationObserver(inject).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "aria-labelledby", "aria-expanded", "aria-hidden", "role"] });
    inject();
  }
  return { label, readView, readExisting, setInput, commentText, createBlock, updateBlock, install };
});
