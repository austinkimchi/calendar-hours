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
        type: e.querySelector(aid("calendarAppointmentTitle"))?.textContent.trim() || "", element: e }];
    });
  }
  async function waitFor(test, message, timeout = 15000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const result = test(); if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(message);
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
  async function createBlock(doc, core, base, block, settings) {
    assertView(doc, core, base);
    if (doc.querySelector('[role="dialog"][aria-modal="true"]')) throw new Error("Close the open Workday dialog before importing");
    const overlaps = readExisting(doc, base.dates).filter(e => e.date === block.date && e.start < block.end && e.end > block.start);
    if (overlaps.some(e => e.start === block.start && e.end === block.end && e.type === settings.timeType)) return "already-entered";
    if (overlaps.length) throw new Error("A Workday entry changed while importing. Import stopped to avoid overlapping hours.");
    const panel = doc.querySelector(aid("timedDaySeparator_0"))?.parentElement;
    if (!panel?.classList.contains("gwt-appointment-panel")) throw new Error("This Workday calendar layout is not supported");
    const rect = panel.getBoundingClientRect();
    const x = rect.left + rect.width * (base.dates.indexOf(block.date) + 0.5) / base.dates.length;
    const y = rect.top + rect.height * (block.start + 0.5) / 1440;
    panel.dispatchEvent(new doc.defaultView.MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView, clientX: x, clientY: y, button: 0 }));
    const dialog = await waitFor(() => [...doc.querySelectorAll('[role="dialog"]')].find(e => visible(e) && label(e) === "Enter Time"), "Workday did not open the time-entry form");
    let saved = false;
    try {
      const [year, month, day] = block.date.split("-").map(Number);
      if (!new RegExp(`(?<!\\d)${month}/${day}/${year}(?!\\d)`).test(dialog.textContent)) throw new Error("Workday opened a different date. Nothing was saved.");
      if ([...dialog.querySelectorAll("button")].some(e => visible(e) && label(e) === "Delete")) throw new Error("Workday opened an existing entry. Nothing was changed.");
      const typeList = [...dialog.querySelectorAll('[role="listbox"]')].find(e => label(e) === "items selected for Time Type");
      const selected = typeList?.querySelector('[role="option"]')?.textContent.trim();
      if (selected !== settings.timeType) throw new Error(`Workday selected ${selected || "no time type"}. Choose the matching Time Type in extension settings.`);
      setInput(field(dialog, "In"), core.clock(block.start));
      setInput(field(dialog, "Out"), core.clock(block.end));
      const outReason = [...dialog.querySelectorAll('[role="combobox"]')].find(e => label(e).startsWith("Out Reason"));
      if (!outReason) throw new Error("Workday's Out Reason field is unavailable");
      if (!outReason.textContent.replace(/\s+selected\s*$/, "").trim().endsWith(settings.outReason)) {
        outReason.click();
        const option = await waitFor(() => [...doc.querySelectorAll('[role="option"]')].find(e => visible(e) && e.textContent.trim() === settings.outReason), "The configured Out Reason was not found");
        option.click();
      }
      setInput(field(dialog, "Comment"), block.title.slice(0, 1000));
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
      // Explicit allowlist: this adapter never clicks Review, Next, Submit or Delete.
      button(dialog, "OK").click(); saved = true;
      await waitFor(() => !dialog.isConnected, "Workday did not confirm this entry. Check the open form before retrying.");
      await waitFor(() => readExisting(doc, base.dates).some(e => e.date === block.date && e.start === block.start && e.end === block.end && e.type === settings.timeType), "Workday closed the form but did not show the saved entry. Check the calendar before retrying.");
      return "added";
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
    function showStatus(message, setup = false) {
      const toolbar = doc.querySelector(aid("calendarToolbar"));
      if (!toolbar) return;
      if (!statusBox?.isConnected) {
        statusBox = doc.createElement("div"); statusBox.className = "calendar-hours-workday-status";
        statusBox.setAttribute("role", "status"); toolbar.after(statusBox);
      }
      statusBox.replaceChildren(doc.createTextNode(message + " "));
      const settings = doc.createElement("button"); settings.type = "button"; settings.textContent = setup ? "Set up calendar import" : "Import settings";
      settings.addEventListener("click", () => { void chromeApi.runtime.sendMessage({ type: "CALENDAR_HOURS_WORKDAY_SETUP" }); });
      statusBox.append(settings);
    }
    async function run() {
      if (busy) return; busy = true;
      let added = 0;
      try {
        const view = readView(doc, core);
        doc.querySelector(`${aid("calendarToolbar")} button[aria-label="Actions"][aria-expanded="true"]`)?.click();
        if (doc.querySelector('[role="dialog"][aria-modal="true"]')) throw new Error("Close the open Workday form before importing");
        showStatus(`Reading calendar for ${view.title}…`);
        const response = await chromeApi.runtime.sendMessage({ type: "CALENDAR_HOURS_WORKDAY_EVENTS", dates: view.dates });
        if (!response?.ok) {
          showStatus(response?.reason || "Calendar could not be read. Try again.", !!response?.needsSetup);
          if (response?.needsSetup) await chromeApi.runtime.sendMessage({ type: "CALENDAR_HOURS_WORKDAY_SETUP" });
          return;
        }
        assertView(doc, core, view);
        const plan = core.plan({ events: response.events, dates: view.dates, settings: response.settings, existing: readExisting(doc, view.dates), core: titleCore });
        let already = plan.skipped.filter(e => e.reason === "already-entered").length;
        for (const block of plan.add) {
          showStatus(`Importing ${view.title}: ${added + 1} of ${plan.add.length}…`);
          const result = await createBlock(doc, core, view, block, response.settings);
          if (result === "added") added++; else already++;
        }
        const future = plan.skipped.filter(e => e.reason === "future").length;
        showStatus(`Calendar import: ${added} added, ${already} already entered${future ? `, ${future} future blocks skipped` : ""}.` +
          (plan.conflicts.length ? ` ${plan.conflicts.length} overlapping blocks need manual correction; existing entries were kept.` : "") +
          (plan.warnings.length ? ` ${plan.warnings.join(" ")}` : "") + " Entries remain unsubmitted.");
      } catch (error) {
        showStatus(`${added ? `${added} entries saved before stopping. ` : ""}${error.message}`);
      } finally { busy = false; }
    }
    function inject() {
      if (![...doc.querySelectorAll("h1")].some(e => e.textContent.trim() === "Enter Time")) return;
      const menu = [...doc.querySelectorAll('[role="listbox"]')].find(e => visible(e) && label(e) === "Actions");
      if (!menu || menu.querySelector('[data-calendar-hours="workday-import"]')) return;
      const item = doc.createElement("div"); item.setAttribute("role", "option"); item.tabIndex = 0;
      item.dataset.calendarHours = "workday-import"; item.className = (menu.querySelector('[role="option"]')?.className || "") + " calendar-hours-workday-menuitem";
      item.textContent = "Auto-fill from Calendar";
      item.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); void run(); });
      item.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); event.stopPropagation(); void run(); } });
      menu.append(item);
    }
    new doc.defaultView.MutationObserver(inject).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label", "aria-labelledby", "aria-expanded", "aria-hidden", "role"] });
    inject();
  }
  return { label, readView, readExisting, setInput, createBlock, install };
});
