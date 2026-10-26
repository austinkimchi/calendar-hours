const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const extension = path.join(__dirname, "..", "extension");
const coreScript = fs.readFileSync(path.join(extension, "core.js"), "utf8");
const contentScript = fs.readFileSync(path.join(extension, "content.js"), "utf8");
const settle = () => new Promise(resolve => setTimeout(resolve, 220));

function run(html, saved = {}, options = {}) {
  const dom = new JSDOM(html, {
    url: options.url || "https://calendar.google.com/calendar/u/0/r/week/2026/10/18",
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.HTMLElement.prototype.getClientRects = function () { return [{ left: 10, top: 10, bottom: 30 }]; };
  window.HTMLElement.prototype.getBoundingClientRect = function () { return { left: 10, top: 10, bottom: 30 }; };
  let listener;
  window.chrome = {
    storage: { sync: { get: async () => saved }, onChanged: { addListener() {} } },
    runtime: { onMessage: { addListener(fn) { listener = fn; } }, sendMessage: options.sendMessage || (async () => ({ ok: false })) }
  };
  window.eval(coreScript);
  window.eval(contentScript);
  return { dom, window, send: message => new Promise(resolve => listener(message, {}, resolve)) };
}

test("keyword replaces itself in the full editor without saving the event", async () => {
  const app = run(`<input aria-label="Title" value="SCU Block /hours">
    <input aria-label="Start date" data-date="20261021" value="Oct 21, 2026">
    <input aria-label="Start time" value="10:15am">
    <input aria-label="End date" data-date="20261021" value="Oct 21, 2026">
    <input aria-label="End time" value="1:25pm">
    <input type="checkbox" aria-label="All day">`);
  await settle();
  assert.equal(app.window.document.querySelector('[aria-label="Title"]').value, "SCU Block (3.17 hours)");
  assert.equal(app.window.document.querySelector(".calendar-hours-suggestion"), null);
  app.dom.window.close();
});

test("rapid Enter after editing an event applies the saved under-hour minutes setting before Calendar saves", async () => {
  const app = run(`<div role="dialog"><input aria-label="Title" value="Allergy Shot">
    <input aria-label="Start date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="Start time" value="4pm">
    <input aria-label="End date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="End time" value="4:45pm"></div>`, {
    minutesBelowHour: true,
    matchingPhrases: [{ phrase: "SCU Block", dynamic: true }]
  });
  await Promise.resolve();
  const title = app.window.document.querySelector('[aria-label="Title"]');
  const end = app.window.document.querySelector('[aria-label="End time"]');
  end.value = "4:30pm";
  end.dispatchEvent(new app.window.Event("input", { bubbles: true }));
  title.value = "Allergy Shot /hours";
  title.dispatchEvent(new app.window.Event("input", { bubbles: true }));
  let titleAtSave;
  app.window.document.addEventListener("keydown", event => {
    if (event.key === "Enter") titleAtSave = title.value;
  });
  title.dispatchEvent(new app.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  assert.equal(titleAtSave, "Allergy Shot (30 minutes)");
  assert.equal(title.value, "Allergy Shot (30 minutes)");
  app.dom.window.close();
});

test("clicking Calendar Save immediately after a keyword applies the duration first", async () => {
  const app = run(`<div role="dialog"><input aria-label="Title" value="Allergy Shot /hours">
    <input aria-label="Start date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="Start time" value="4pm">
    <input aria-label="End date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="End time" value="4:30pm">
    <button type="button">Save</button></div>`, { minutesBelowHour: true });
  await Promise.resolve();
  let titleAtSave;
  const save = app.window.document.querySelector("button");
  save.addEventListener("click", () => { titleAtSave = app.window.document.querySelector('[aria-label="Title"]').value; });
  save.click();
  assert.equal(titleAtSave, "Allergy Shot (30 minutes)");
  app.dom.window.close();
});

test("quick composer summary offers suggestion and accepts Tab", async () => {
  const app = run(`<div role="dialog"><input aria-label="Add title" value="SCU Block">
    <span data-key="startDate">Sunday, October 18</span>
    <span data-key="startTime">10:15am</span>
    <span data-key="endTime">1:25pm</span></div>`, { automatic: false });
  await settle();
  const title = app.window.document.querySelector('[aria-label="Add title"]');
  assert.match(app.window.document.querySelector(".calendar-hours-suggestion").textContent, /3\.17 hours/);
  title.focus();
  title.dispatchEvent(new app.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  assert.equal(title.value, "SCU Block (3.17 hours)");
  app.dom.window.close();
});

test("manual message works in the full editor and automatic mode respects title words", async () => {
  const app = run(`<input aria-label="Title" value="SCU Block">
    <input aria-label="Start date" data-date="20261021" value="Oct 21, 2026">
    <input aria-label="Start time" value="10:15am">
    <input aria-label="End date" data-date="20261021" value="Oct 21, 2026">
    <input aria-label="End time" value="1:25pm">`, { automatic: false });
  const result = await app.send({ type: "CALENDAR_HOURS_APPLY", reason: "shortcut" });
  assert.equal(result.ok, true);
  assert.equal(app.window.document.querySelector('[aria-label="Title"]').value, "SCU Block (3.17 hours)");
  app.dom.window.close();

  const auto = run(`<input aria-label="Title" value="Doctor appointment">
    <input aria-label="Start date" data-date="20261021" value="Oct 21, 2026">
    <input aria-label="Start time" value="10:15am">
    <input aria-label="End date" data-date="20261021" value="Oct 21, 2026">
    <input aria-label="End time" value="1:25pm">`, { automatic: true, autoWords: "block" });
  await settle();
  assert.equal(auto.window.document.querySelector('[aria-label="Title"]').value, "Doctor appointment");
  auto.dom.window.close();

  const matching = run(`<input aria-label="Title" value="SCU Block">
    <input aria-label="Start date" data-date="20261021" value="Oct 21, 2026">
    <input aria-label="Start time" value="10:15am">
    <input aria-label="End date" data-date="20261021" value="Oct 21, 2026">
    <input aria-label="End time" value="1:25pm">`, { automatic: true, autoWords: "block" });
  await settle();
  assert.equal(matching.window.document.querySelector('[aria-label="Title"]').value, "SCU Block (3.17 hours)");
  matching.dom.window.close();
});

test("keep-updated mode paints the new title without opening the editor", async () => {
  const requests = [];
  let finishSave;
  const app = run(`<div data-eventchip data-eventid="event-1" role="button">
    <div class="screen-reader">10:15am to 1:25pm, SCU Block (3.17 hours), Calendar: Work, October 26, 2026</div>
    <div aria-hidden="true"><span class="I0UMhf">SCU Block (3.17 hours)</span></div>
  </div>`, { keepUpdated: true, autoWords: "SCU Block" }, {
    sendMessage: async message => {
      requests.push(message);
      return new Promise(resolve => { finishSave = resolve; });
    }
  });
  const { window } = app;
  const chip = window.document.querySelector("[data-eventchip]");
  await settle();
  let opened = 0;
  chip.addEventListener("click", () => opened++);
  chip.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
  chip.querySelector(".screen-reader").textContent = "10:15am to 2:25pm, SCU Block (3.17 hours), Calendar: Work, October 26, 2026";
  chip.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true, clientX: 10, clientY: 30 }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(opened, 0);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].endTime, "2:25pm");
  assert.equal(chip.querySelector(".I0UMhf").textContent, "SCU Block (4.17 hours)");
  chip.querySelector(".I0UMhf").firstChild.nodeValue = "SCU Block (3.17 hours)";
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(chip.querySelector(".I0UMhf").textContent, "SCU Block (4.17 hours)",
    "Calendar's in-place text repaint must not flash the old hours");
  finishSave({ ok: true, nextTitle: "SCU Block (4.17 hours)" });
  chip.querySelector(".screen-reader").textContent = "10:15am to 2:25pm, SCU Block (4.17 hours), Calendar: Work, October 26, 2026";
  await settle();
  app.dom.window.close();
});

test("grid resize still saves when Calendar opens its event details popup", async () => {
  const requests = [];
  let finishSave;
  const app = run(`<div data-eventchip data-eventid="event-1" role="button">
    <div>10:15am to 1:25pm, SCU Block (3.17 hours), Calendar: Work, October 26, 2026</div>
    <div aria-hidden="true"><span class="I0UMhf">SCU Block (3.17 hours)</span></div>
  </div>`, { keepUpdated: true, autoWords: "SCU Block" }, {
    sendMessage: message => {
      requests.push(message);
      return new Promise(resolve => { finishSave = resolve; });
    }
  });
  const { window } = app;
  await settle();
  const chip = window.document.querySelector("[data-eventchip]");
  chip.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
  chip.firstElementChild.textContent = "10:15am to 2:25pm, SCU Block (3.17 hours), Calendar: Work, October 26, 2026";
  chip.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true, clientX: 10, clientY: 30 }));
  const popup = window.document.createElement("div");
  popup.setAttribute("role", "dialog");
  popup.innerHTML = '<span role="heading" aria-level="1">SCU Block (3.17 hours)</span><div data-eventid="event-1"></div>';
  window.document.body.append(popup);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(requests.length, 1);
  assert.equal(chip.querySelector(".I0UMhf").textContent, "SCU Block (4.17 hours)");
  assert.equal(popup.querySelector('[role="heading"]').textContent, "SCU Block (4.17 hours)");
  finishSave({ ok: true, nextTitle: "SCU Block (4.17 hours)" });
  chip.firstElementChild.textContent = "10:15am to 2:25pm, SCU Block (4.17 hours), Calendar: Work, October 26, 2026";
  await settle();
  popup.querySelector('[role="heading"]').firstChild.nodeValue = "SCU Block (3.17 hours)";
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(popup.querySelector('[role="heading"]').textContent, "SCU Block (4.17 hours)");
  app.dom.window.close();
});

test("a second resize is queued while the first title is saving", async () => {
  let finishFirst;
  const requests = [];
  const app = run(`<div data-eventchip data-eventid="event-1" role="button">
    <div class="screen-reader">10:15am to 1:25pm, SCU Block (3.17 hours), Calendar: Work, October 26, 2026</div>
    <div aria-hidden="true"><span class="I0UMhf">SCU Block (3.17 hours)</span></div>
  </div>`, { keepUpdated: true, autoWords: "SCU Block" }, {
    sendMessage: message => {
      requests.push(message);
      return requests.length === 1
        ? new Promise(resolve => { finishFirst = resolve; })
        : Promise.resolve({ ok: true, nextTitle: "SCU Block (5.17 hours)" });
    }
  });
  const { window } = app;
  const chip = window.document.querySelector("[data-eventchip]");
  await settle();
  const drag = endTime => {
    chip.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
    chip.querySelector(".screen-reader").textContent = `10:15am to ${endTime}, SCU Block (3.17 hours), Calendar: Work, October 26, 2026`;
    chip.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true, clientX: 10, clientY: 30 }));
  };
  drag("2:25pm");
  await settle();
  drag("3:25pm");
  finishFirst({ ok: true, nextTitle: "SCU Block (4.17 hours)" });
  await settle();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].title, "SCU Block (4.17 hours)");
  assert.equal(requests[1].endTime, "3:25pm");
  assert.equal(chip.querySelector(".I0UMhf").textContent, "SCU Block (5.17 hours)");
  chip.querySelector(".screen-reader").textContent = "10:15am to 3:25pm, SCU Block (5.17 hours), Calendar: Work, October 26, 2026";
  await settle();
  app.dom.window.close();
});

test("keep-updated mode corrects a matching title when editor times change", async () => {
  const app = run(`<input aria-label="Title" value="SCU Block (3.17 hours)">
    <input aria-label="Start date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="Start time" value="10:15am">
    <input aria-label="End date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="End time" value="1:25pm">`, { keepUpdated: true, autoWords: "SCU Block" });
  await settle();
  const end = app.window.document.querySelector('[aria-label="End time"]');
  end.value = "2:25pm";
  end.dispatchEvent(new app.window.Event("change", { bubbles: true }));
  await settle();
  assert.equal(app.window.document.querySelector('[aria-label="Title"]').value, "SCU Block (4.17 hours)");
  app.dom.window.close();
});

test("a Dynamic phrase does not update a different non-Dynamic phrase", async () => {
  const app = run(`<input aria-label="Title" value="Study session (3.17 hours)">
    <input aria-label="Start date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="Start time" value="10:15am">
    <input aria-label="End date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="End time" value="1:25pm">`, {
    showSuggestion: false,
    matchingPhrases: [
      { phrase: "Work block", dynamic: true },
      { phrase: "Study session", dynamic: false }
    ]
  });
  await settle();
  const end = app.window.document.querySelector('[aria-label="End time"]');
  end.value = "2:25pm";
  end.dispatchEvent(new app.window.Event("change", { bubbles: true }));
  await settle();
  assert.equal(app.window.document.querySelector('[aria-label="Title"]').value, "Study session (3.17 hours)");
  app.dom.window.close();
});

test("an hours suffix updates a non-matching event after a grid resize", async () => {
  const requests = [];
  const app = run(`<div data-eventchip data-eventid="allergy-1" role="button">
    <div>4pm to 5pm, Allergy Shot (1 hours), Calendar: Events, October 26, 2026</div>
    <div aria-hidden="true"><span class="I0UMhf">Allergy Shot (1 hours)</span></div>
  </div>`, { updateExistingHours: true, matchingPhrases: [{ phrase: "block", dynamic: false }] }, {
    sendMessage: async message => {
      requests.push(message);
      return { ok: true, nextTitle: "Allergy Shot (0.75 hours)" };
    }
  });
  const { window } = app;
  await settle();
  const chip = window.document.querySelector("[data-eventchip]");
  chip.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
  chip.firstElementChild.textContent = "4pm to 4:45pm, Allergy Shot (1 hours), Calendar: Events, October 26, 2026";
  chip.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true, clientX: 10, clientY: 30 }));
  await settle();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].endTime, "4:45pm");
  assert.equal(chip.querySelector(".I0UMhf").textContent, "Allergy Shot (0.75 hours)");
  app.dom.window.close();
});

test("an hours suffix updates after editing time fields even without a matching phrase", async () => {
  const app = run(`<input aria-label="Title" value="Allergy Shot (1 hours)">
    <input aria-label="Start date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="Start time" value="4pm">
    <input aria-label="End date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="End time" value="5pm">`, {
    updateExistingHours: true,
    matchingPhrases: [{ phrase: "block", dynamic: false }]
  });
  await settle();
  const end = app.window.document.querySelector('[aria-label="End time"]');
  end.value = "4:45pm";
  end.dispatchEvent(new app.window.Event("change", { bubbles: true }));
  await settle();
  assert.equal(app.window.document.querySelector('[aria-label="Title"]').value, "Allergy Shot (0.75 hours)");
  app.dom.window.close();
});

test("an edited short event switches from an hours suffix to minutes", async () => {
  const app = run(`<input aria-label="Title" value="Allergy Shot (0.75 hours)">
    <input aria-label="Start date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="Start time" value="4pm">
    <input aria-label="End date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="End time" value="4:45pm">`, {
    updateExistingHours: true,
    minutesBelowHour: true,
    matchingPhrases: [{ phrase: "SCU Block", dynamic: true }]
  });
  await settle();
  const end = app.window.document.querySelector('[aria-label="End time"]');
  end.value = "4:30pm";
  end.dispatchEvent(new app.window.Event("change", { bubbles: true }));
  await settle();
  assert.equal(app.window.document.querySelector('[aria-label="Title"]').value, "Allergy Shot (30 minutes)");
  app.dom.window.close();
});

test("an hours suffix updates after Calendar replaces the title input during a time edit", async () => {
  const app = run(`<input aria-label="Title" value="Allergy Shot (1 hours)">
    <input aria-label="Start date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="Start time" value="4pm">
    <input aria-label="End date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="End time" value="5pm">`, {
    updateExistingHours: true,
    matchingPhrases: [{ phrase: "SCU Block", dynamic: true }]
  });
  await settle();
  const title = app.window.document.querySelector('[aria-label="Title"]');
  const end = app.window.document.querySelector('[aria-label="End time"]');
  end.value = "4:45pm";
  end.dispatchEvent(new app.window.Event("change", { bubbles: true }));
  title.replaceWith(title.cloneNode(true));
  await settle();
  assert.equal(app.window.document.querySelector('[aria-label="Title"]').value, "Allergy Shot (0.75 hours)");
  app.dom.window.close();
});

test("an hours suffix updates after a grid time change without a pointer gesture", async () => {
  const requests = [];
  const app = run(`<div data-eventchip data-eventid="allergy-1" role="button">
    <div>4pm to 5pm, Allergy Shot (1 hours), Calendar: Events, October 26, 2026</div>
    <div aria-hidden="true"><span class="I0UMhf">Allergy Shot (1 hours)</span></div>
  </div>`, { updateExistingHours: true, matchingPhrases: [{ phrase: "SCU Block", dynamic: true }] }, {
    sendMessage: async message => {
      requests.push(message);
      return { ok: true, nextTitle: "Allergy Shot (0.75 hours)" };
    }
  });
  await settle();
  const chip = app.window.document.querySelector("[data-eventchip]");
  chip.firstElementChild.textContent = "4pm to 4:45pm, Allergy Shot (1 hours), Calendar: Events, October 26, 2026";
  await new Promise(resolve => setTimeout(resolve, 330));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].endTime, "4:45pm");
  assert.equal(chip.querySelector(".I0UMhf").textContent, "Allergy Shot (0.75 hours)");
  app.dom.window.close();
});

test("an extension reload stops stale grid updates without recording a resize error", async () => {
  let requests = 0;
  const app = run(`<div data-eventchip data-eventid="allergy-1" role="button">
    <div>4pm to 5pm, Allergy Shot (1 hour), Calendar: Events, October 26, 2026</div>
    <div aria-hidden="true"><span class="I0UMhf">Allergy Shot (1 hour)</span></div>
  </div>`, { updateExistingHours: true }, {
    sendMessage: async () => { requests++; throw new Error("Extension context invalidated."); }
  });
  await settle();
  let warnings = 0;
  app.window.console.warn = () => { warnings++; };
  const chip = app.window.document.querySelector("[data-eventchip]");
  chip.dispatchEvent(new app.window.MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
  chip.firstElementChild.textContent = "4pm to 4:30pm, Allergy Shot (1 hour), Calendar: Events, October 26, 2026";
  chip.dispatchEvent(new app.window.MouseEvent("pointerup", { bubbles: true, clientX: 10, clientY: 30 }));
  await settle();
  assert.equal(requests, 1);
  assert.equal(warnings, 0);
  assert.match(app.window.document.querySelector(".calendar-hours-notice").textContent, /Refresh this Calendar tab/);
  assert.equal(chip.querySelector(".I0UMhf").textContent, "Allergy Shot (1 hour)");
  chip.dispatchEvent(new app.window.MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
  chip.firstElementChild.textContent = "4pm to 4:45pm, Allergy Shot (1 hour), Calendar: Events, October 26, 2026";
  chip.dispatchEvent(new app.window.MouseEvent("pointerup", { bubbles: true, clientX: 10, clientY: 30 }));
  await settle();
  assert.equal(requests, 1);
  app.dom.window.close();
});

test("grid changes do not auto-save while keep-updated mode is disabled", async () => {
  const app = run(`<div data-eventchip data-eventid="event-2" role="button">
    <div>10:15am to 1:25pm, SCU Block (3.17 hours), October 26, 2026</div>
    <div aria-hidden="true"><span class="I0UMhf">SCU Block (3.17 hours)</span></div>
  </div>`, { keepUpdated: false, autoWords: "SCU Block" });
  await settle();
  const chip = app.window.document.querySelector("[data-eventchip]");
  let opened = 0;
  chip.addEventListener("click", () => opened++);
  chip.dispatchEvent(new app.window.MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
  chip.firstElementChild.textContent = "10:15am to 2:25pm, SCU Block (3.17 hours), October 26, 2026";
  chip.dispatchEvent(new app.window.MouseEvent("pointerup", { bubbles: true, clientX: 10, clientY: 30 }));
  await settle();
  assert.equal(opened, 0);
  assert.equal(chip.querySelector(".I0UMhf").textContent, "SCU Block (3.17 hours)");
  app.dom.window.close();
});

test("background editor skips recurring events", async () => {
  const app = run(`<div><input aria-label="Title" value="SCU Block (3.17 hours)">
    <input aria-label="Start date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="Start time" value="10:15am">
    <input aria-label="End date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="End time" value="2:25pm">
    <div role="combobox" aria-label="Recurrence">Every week</div><button>Save</button></div>`,
  { keepUpdated: true, autoWords: "SCU Block" },
  { url: "https://calendar.google.com/calendar/u/0/r/eventedit/recurring-1" });
  await settle();
  let saves = 0;
  app.window.document.querySelector("button").addEventListener("click", () => saves++);
  const result = await app.send({ type: "CALENDAR_HOURS_BACKGROUND_SYNC", id: "recurring-1", title: "SCU Block (3.17 hours)", startTime: "10:15am", endTime: "2:25pm" });
  assert.equal(saves, 0);
  assert.equal(result.reason, "recurring event");
  app.dom.window.close();
});

test("background editor saves and verifies a resized one-time event", async () => {
  const url = "https://calendar.google.com/calendar/u/0/r/eventedit/event-1";
  const app = run(`<div><input aria-label="Title" value="SCU Block (3.17 hours)">
    <input aria-label="Start date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="Start time" value="10:15am">
    <input aria-label="End date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="End time" value="2:25pm">
    <div role="combobox" aria-label="Recurrence">Does not repeat</div><button>Save</button></div>`,
  { keepUpdated: true, autoWords: "SCU Block" }, { url });
  await settle();
  let savedTitle = "";
  let confirmed = false;
  app.window.document.querySelector("button").addEventListener("click", () => {
    savedTitle = app.window.document.querySelector('[aria-label="Title"]').value;
    app.window.history.pushState({}, "", "/calendar/u/0/r/week/2026/10/26");
  });
  const saving = app.send({ type: "CALENDAR_HOURS_BACKGROUND_SYNC", id: "event-1",
    title: "SCU Block (3.17 hours)", startTime: "10:15am", endTime: "2:25pm" });
  saving.then(() => { confirmed = true; });
  await settle();
  assert.equal(savedTitle, "SCU Block (4.17 hours)");
  assert.equal(confirmed, false, "leaving the editor must not count as a completed save");
  const announcement = app.window.document.createElement("div");
  announcement.setAttribute("aria-live", "polite");
  announcement.textContent = "Event saved";
  app.window.document.body.append(announcement);
  const result = await saving;
  assert.equal(result.ok, true);
  assert.equal(result.nextTitle, "SCU Block (4.17 hours)");
  app.window.history.pushState({}, "", url);
  const verified = await app.send({ type: "CALENDAR_HOURS_BACKGROUND_VERIFY", id: "event-1", title: savedTitle });
  assert.equal(verified.ok, true);
  app.dom.window.close();
});
