const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const extension = path.join(__dirname, "..", "extension");
const coreScript = fs.readFileSync(path.join(extension, "core.js"), "utf8");
const zonesScript = fs.readFileSync(path.join(extension, "calendar-zones.js"), "utf8");
const contentScript = fs.readFileSync(path.join(extension, "content.js"), "utf8");
const settle = () => new Promise(resolve => setTimeout(resolve, 220));

function run(html, saved = {}, options = {}) {
  const dom = new JSDOM(html, {
    url: options.url || "https://calendar.google.com/calendar/u/0/r/week/2026/10/18",
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.HTMLElement.prototype.getClientRects = function () { return [{ left: 10, top: 10, bottom: 50, right: 610, width: 600, height: 40 }]; };
  window.HTMLElement.prototype.getBoundingClientRect = function () { return { left: 10, top: 10, bottom: 50, right: 610, width: 600, height: 40 }; };
  const initialTitle = window.document.querySelector('input[aria-label="Title"],input[aria-label="Add title"]');
  if (initialTitle) { initialTitle.focus(); initialTitle.setSelectionRange(initialTitle.value.length, initialTitle.value.length); }
  let listener;
  const hintStorage = options.hintStorage || {};
  window.chrome = {
    storage: {
      sync: {
        get: async () => ({ ...saved, ...hintStorage }),
        set: async values => { Object.assign(hintStorage, values); }
      },
      onChanged: { addListener() {} }
    },
    runtime: { onMessage: { addListener(fn) { listener = fn; } }, sendMessage: options.sendMessage || (async () => ({ ok: false })) }
  };
  window.eval(coreScript);
  window.eval(zonesScript);
  window.eval(contentScript);
  return { dom, window, send: message => new Promise(resolve => listener(message, {}, resolve)) };
}

test("keyword replaces itself in the full editor without saving the event", async t => {
  const app = run(`<input aria-label="Title" value="SCU Block /hours">
    <input aria-label="Start date" data-date="20261021" value="Oct 21, 2026">
    <input aria-label="Start time" value="10:15am">
    <input aria-label="End date" data-date="20261021" value="Oct 21, 2026">
    <input aria-label="End time" value="1:25pm">
    <input type="checkbox" aria-label="All day">`);
  t.after(() => app.dom.window.close());
  const title = app.window.document.querySelector('[aria-label="Title"]');
  // CI load can delay initialization past a fixed sleep; wait for the visible result.
  const deadline = Date.now() + 2000;
  while (title.value !== "SCU Block (3.17 hours)" && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(title.value, "SCU Block (3.17 hours)");
  assert.equal(app.window.document.querySelector(".calendar-hours-suggestion"), null);
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
  assert.equal(title.value, "SCU Block", "ghost text does not change the input");
  assert.equal(app.window.document.querySelector(".calendar-hours-suggestion-suffix").textContent, " (3.17 hours)");
  assert.equal(app.window.document.querySelector(".calendar-hours-suggestion").getAttribute("aria-hidden"), "true");
  title.focus();
  title.dispatchEvent(new app.window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  assert.equal(title.value, "SCU Block (3.17 hours)");
  app.dom.window.close();
});

test("Escape outside the title hides the suggestion before Calendar finishes closing the editor", async () => {
  const app = run(`<div role="dialog"><button aria-label="Close">Close</button>
    <input aria-label="Title" value="Work session">
    <input aria-label="Start date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="Start time" value="5pm">
    <input aria-label="End date" data-date="20261026" value="Oct 26, 2026">
    <input aria-label="End time" value="5:15pm"></div>`, { automatic: false });
  await settle();
  const document = app.window.document;
  assert.ok(document.querySelector(".calendar-hours-suggestion"));
  document.querySelector('[aria-label="End time"]').dispatchEvent(new app.window.KeyboardEvent("keydown", {
    key: "Escape", bubbles: true
  }));
  assert.equal(document.querySelector(".calendar-hours-suggestion"), null);
  document.querySelector('[aria-label="End time"]').dispatchEvent(new app.window.Event("change", { bubbles: true }));
  await settle();
  assert.equal(document.querySelector(".calendar-hours-suggestion"), null);
  document.querySelector('[role="dialog"]').remove();
  await settle();
  app.dom.window.close();
});

const suggestionHtml = `<div role="dialog"><input aria-label="Title" aria-describedby="calendar-help" value="Work session">
  <input aria-label="Start date" data-date="20261026" value="Oct 26, 2026">
  <input aria-label="Start time" value="5pm">
  <input aria-label="End date" data-date="20261026" value="Oct 26, 2026">
  <input aria-label="End time" value="6pm"></div>`;

test("Enter accepts inline text without saving; the next Enter reaches Calendar normally", async () => {
  const app = run(suggestionHtml, {automatic:false});
  await settle();
  const {document, KeyboardEvent} = app.window;
  const title = document.querySelector('[aria-label="Title"]');
  let calendarKeyEvents = 0;
  document.addEventListener("keydown", () => calendarKeyEvents++);
  document.addEventListener("keyup", () => calendarKeyEvents++);
  assert.equal(title.value, "Work session");
  assert.match(title.getAttribute("aria-describedby"), /calendar-help calendar-hours-inline-description/);
  const press = new KeyboardEvent("keydown", {key:"Enter", bubbles:true, cancelable:true});
  title.dispatchEvent(press);
  assert.equal(press.defaultPrevented, true);
  assert.equal(title.value, "Work session (1 hour)");
  title.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", repeat:true, bubbles:true, cancelable:true}));
  title.dispatchEvent(new KeyboardEvent("keyup", {key:"Enter", bubbles:true, cancelable:true}));
  assert.equal(calendarKeyEvents, 0, "acceptance, repeat, and keyup must not reach Calendar's save handler");
  assert.equal(title.getAttribute("aria-describedby"), "calendar-help");
  assert.equal(document.querySelector(".calendar-hours-suggestion"), null);
  title.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", bubbles:true, cancelable:true}));
  assert.equal(calendarKeyEvents, 1);
  app.dom.window.close();
});

test("inline suggestions respect focus, caret edits, composition and the saved off preference", async () => {
  for (const scenario of ["off", "blur", "selection", "middle", "composition", "shift", "control"]) {
    const app = run(suggestionHtml, {automatic:false, showSuggestion:scenario!=="off"});
    await settle();
    const {document} = app.window;
    const title = document.querySelector('[aria-label="Title"]');
    if (scenario === "blur") document.querySelector('[aria-label="End time"]').focus();
    if (scenario === "selection") title.setSelectionRange(0, title.value.length);
    if (scenario === "middle") title.setSelectionRange(4, 4);
    if (scenario === "composition") title.dispatchEvent(new app.window.CompositionEvent("compositionstart", {bubbles:true}));
    await settle();
    if (!["shift", "control"].includes(scenario)) assert.equal(document.querySelector(".calendar-hours-suggestion"), null, scenario);
    const key = new app.window.KeyboardEvent("keydown", {key:"Enter", bubbles:true, cancelable:true,
      shiftKey:scenario==="shift", ctrlKey:scenario==="control", isComposing:scenario==="composition"});
    (scenario === "blur" ? document.activeElement : title).dispatchEvent(key);
    assert.equal(key.defaultPrevented, false, scenario);
    assert.equal(title.value, "Work session", scenario);
    app.dom.window.close();
  }
});

test("a hint clipped outside a long title does not consume Enter or Tab", async () => {
  const app = run(suggestionHtml, {automatic:false});
  app.window.HTMLElement.prototype.getBoundingClientRect = function () {
    return this.classList.contains("calendar-hours-suggestion-suffix")
      ? {left:650,right:730,top:10,bottom:50,width:80,height:40}
      : {left:10,right:610,top:10,bottom:50,width:600,height:40};
  };
  await settle();
  const doc = app.window.document, title = doc.querySelector('[aria-label="Title"]');
  assert.equal(doc.querySelector(".calendar-hours-suggestion").style.visibility, "hidden");
  assert.equal(doc.querySelector("#calendar-hours-inline-description").textContent, "");
  for (const key of ["Enter","Tab"]) {
    const event = new app.window.KeyboardEvent("keydown", {key,bubbles:true,cancelable:true});
    title.dispatchEvent(event);
    assert.equal(event.defaultPrevented,false);
  }
  assert.equal(title.value,"Work session");
  app.dom.window.close();
});

test("typing invalidates stale ghost text and time edits refresh its exact duration", async () => {
  const app = run(suggestionHtml, {automatic:false});
  await settle();
  const {document} = app.window;
  const title = document.querySelector('[aria-label="Title"]');
  title.value = "Other session";
  title.dispatchEvent(new app.window.Event("input", {bubbles:true}));
  assert.equal(document.querySelector(".calendar-hours-suggestion"), null);
  const fastEnter = new app.window.KeyboardEvent("keydown", {key:"Enter", bubbles:true, cancelable:true});
  title.dispatchEvent(fastEnter);
  assert.equal(fastEnter.defaultPrevented, false);
  assert.equal(title.value, "Other session");
  const end = document.querySelector('[aria-label="End time"]');
  end.focus(); end.value = "6:30pm";
  end.dispatchEvent(new app.window.Event("change", {bubbles:true}));
  title.focus(); title.setSelectionRange(title.value.length,title.value.length);
  await settle();
  assert.equal(document.querySelector(".calendar-hours-suggestion-suffix").textContent, " (1.5 hours)");
  title.dispatchEvent(new app.window.KeyboardEvent("keydown", {key:"Tab", bubbles:true, cancelable:true}));
  assert.equal(title.value, "Other session (1.5 hours)");
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
  matching.window.document.querySelector('[aria-label="End time"]').focus();
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

test("a new Option-drag copy can be resized immediately without waiting on its source", async () => {
  const requests = [];
  const app = run(`<div data-eventchip data-eventid="original" role="button">
    <div>1pm to 2pm, SCU Block Test (1 hour), Calendar: Work, October 27, 2026</div>
    <div aria-hidden="true"><span class="I0UMhf">SCU Block Test (1 hour)</span></div>
  </div>`, { matchingPhrases: [{ phrase: "SCU Block", dynamic: true }] }, {
    sendMessage: async message => {
      requests.push(message);
      return { ok: true, nextTitle: "SCU Block Test (1.5 hours)" };
    }
  });
  const { window } = app;
  await settle();
  const original = window.document.querySelector('[data-eventid="original"]');
  original.dispatchEvent(new window.MouseEvent("pointerdown", {
    bubbles: true, altKey: true, clientX: 10, clientY: 10
  }));
  const copy = original.cloneNode(true);
  copy.setAttribute("data-eventid", "copy");
  copy.firstElementChild.textContent = "1pm to 2pm, SCU Block Test (1 hour), Calendar: Work, October 28, 2026";
  window.document.body.append(copy);
  original.dispatchEvent(new window.MouseEvent("pointerup", {
    bubbles: true, altKey: true, clientX: 30, clientY: 10
  }));
  await Promise.resolve();
  copy.dispatchEvent(new window.MouseEvent("pointerdown", {
    bubbles: true, clientX: 10, clientY: 10
  }));
  copy.firstElementChild.textContent = "1pm to 2:30pm, SCU Block Test (1 hour), Calendar: Work, October 28, 2026";
  copy.dispatchEvent(new window.MouseEvent("pointerup", {
    bubbles: true, clientX: 10, clientY: 30
  }));
  await settle();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].id, "copy");
  assert.equal(requests[0].endTime, "2:30pm");
  assert.equal(original.querySelector(".I0UMhf").textContent, "SCU Block Test (1 hour)");
  assert.equal(copy.querySelector(".I0UMhf").textContent, "SCU Block Test (1.5 hours)");
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

test("editor suggestions follow separate Calendar zones and skip an unknown explicit zone", async () => {
  const app = run(`<script id="initialdata" type="application/json">[["timezone","UTC"]]</script>
    <script id="timezonedata" type="application/json">[[["Asia/Tokyo","(GMT+09:00) Japan Standard Time"],["America/Los_Angeles","(GMT-07:00) Pacific Time - Los Angeles"]]]</script>
    <input aria-label="Title" value="Travel">
    <input aria-label="Start date" value="2026-10-27"><input aria-label="Start time" value="11am">
    <div jsname="PH80Af" data-text="(GMT+09:00) Japan Standard Time">(GMT+09:00)</div>
    <input aria-label="End date" value="2026-10-27"><input aria-label="End time" value="5am">
    <div id="xTmZn" data-text="(GMT-07:00) Pacific Time - Los Angeles">(GMT-07:00)</div>`);
  await settle();
  assert.equal(app.window.document.querySelector('.calendar-hours-suggestion-suffix').textContent,' (10 hours)');
  app.window.document.getElementById('xTmZn').setAttribute('data-text','(GMT+04:00) Unknown zone');
  assert.equal((await app.send({type:'CALENDAR_HOURS_APPLY'})).ok,false);
  assert.equal(app.window.document.querySelector('[aria-label="Title"]').value,'Travel');
  app.dom.window.close();
});

test("grid sync uses Calendar-zone instants and a display-zone change never saves events", async () => {
  const requests=[];
  const app=run(`<script id="initialdata" type="application/json">[["timezone","Asia/Kathmandu"]]</script>
    <div data-eventchip data-eventid="grid-zone" role="button">
    <div>9am to 10am, Planning (1 hour), Calendar: Work, October 27, 2026</div>
    <div aria-hidden="true"><span class="I0UMhf">Planning (1 hour)</span></div></div>`,{},
    {sendMessage:async message=>{requests.push(message);return {ok:true,nextTitle:'Planning (1.5 hours)'}}});
  await settle();
  const chip=app.window.document.querySelector('[data-eventchip]');
  chip.firstElementChild.textContent='9am to 10:30am, Planning (1 hour), Calendar: Work, October 27, 2026';
  await new Promise(resolve=>setTimeout(resolve,350));
  assert.equal(requests.length,1);
  assert.equal(requests[0].startIso,'2026-10-27T03:15:00.000Z');
  assert.equal(requests[0].endIso,'2026-10-27T04:45:00.000Z');
  app.window.document.getElementById('initialdata').textContent='[["timezone","Asia/Tokyo"]]';
  chip.firstElementChild.textContent='12:15pm to 1:45pm, Planning (1.5 hours), Calendar: Work, October 27, 2026';
  await new Promise(resolve=>setTimeout(resolve,350));
  assert.equal(requests.length,1);
  app.dom.window.close();
});

test("background verification compares absolute dates and instants instead of grid wall clocks", async () => {
  const app=run(`<script id="initialdata" type="application/json">[["timezone","Asia/Tokyo"]]</script>
    <input aria-label="Title" value="Planning (1 hour)">
    <input aria-label="Start date" value="2026-10-28"><input aria-label="Start time" value="1am">
    <input aria-label="End date" value="2026-10-28"><input aria-label="End time" value="3am">
    <div role="combobox" aria-label="Recurrence">Every week</div>`,{},
    {url:'https://calendar.google.com/calendar/u/0/r/eventedit/zone-event'});
  await settle();
  const message={type:'CALENDAR_HOURS_BACKGROUND_SYNC',id:'zone-event',title:'Planning (1 hour)',
    startTime:'9am',endTime:'11am',startIso:'2026-10-27T16:00:00Z',endIso:'2026-10-27T18:00:00Z'};
  // Matching instants pass time verification despite different dates and clocks,
  // then the independent recurring-event gate stops this synthetic save.
  assert.equal((await app.send(message)).reason,'recurring event');
  assert.equal((await app.send({...message,startIso:'2026-10-26T16:00:00Z'})).retry,true);
  app.dom.window.close();
});

test("confirming separate quick-composer zones updates an existing duration without changing the clocks", async () => {
  const app=run(`<script id="initialdata" type="application/json">[["timezone","America/Los_Angeles"]]</script>
    <script id="timezonedata" type="application/json">[[["Asia/Tokyo","(GMT+09:00) Japan Standard Time"],["America/Los_Angeles","(GMT-07:00) Pacific Time - Los Angeles"]]]</script>
    <div role="dialog"><input aria-label="Add title" value="Planning (1 hour)">
      <input aria-label="Start date" value="2026-10-27"><input aria-label="Start time" value="2pm">
      <input aria-label="End date" value="2026-10-27"><input aria-label="End time" value="3pm">
      <div jsname="KhmQBe">(GMT+09:00)</div><div jsname="SWIt6d">(GMT-07:00)</div>
    </div><div role="dialog" id="zone-picker">
      <input aria-label="Event start time zone" value="(GMT+09:00) Japan Standard Time">
      <input aria-label="Event end time zone" value="(GMT-07:00) Pacific Time - Los Angeles"><button>OK</button></div>`);
  await settle();
  const title=app.window.document.querySelector('[aria-label="Add title"]');
  assert.equal(title.value,'Planning (1 hour)');
  app.window.document.querySelector('button').click();
  app.window.document.getElementById('zone-picker').remove();
  await settle();
  assert.equal(title.value,'Planning (17 hours)');
  app.dom.window.close();
});
