const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const extension = path.join(__dirname, "..", "extension");
const coreScript = fs.readFileSync(path.join(extension, "core.js"), "utf8");
const contentScript = fs.readFileSync(path.join(extension, "content.js"), "utf8");
const settle = () => new Promise(resolve => setTimeout(resolve, 220));

function run(html, saved = {}) {
  const dom = new JSDOM(html, {
    url: "https://calendar.google.com/calendar/u/0/r/week/2026/10/18",
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  const { window } = dom;
  window.HTMLElement.prototype.getClientRects = function () { return [{ left: 10, top: 10, bottom: 30 }]; };
  window.HTMLElement.prototype.getBoundingClientRect = function () { return { left: 10, top: 10, bottom: 30 }; };
  let listener;
  window.chrome = {
    storage: { sync: { get: async () => saved }, onChanged: { addListener() {} } },
    runtime: { onMessage: { addListener(fn) { listener = fn; } } }
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

test("quick composer summary offers suggestion and accepts Tab", async () => {
  const app = run(`<div role="dialog"><input aria-label="Add title" value="SCU Block">
    <span data-key="startDate">Sunday, October 18</span>
    <span data-key="startTime">10:15am</span>
    <span data-key="endTime">1:25pm</span></div>`);
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

test("keep-updated mode saves a matching resized grid event", async () => {
  const app = run(`<div data-eventchip data-eventid="event-1" role="button">
    <div class="screen-reader">10:15am to 1:25pm, SCU Block (3.17 hours), Calendar: Work, October 26, 2026</div>
    <div aria-hidden="true"><span class="I0UMhf">SCU Block (3.17 hours)</span></div>
  </div>`, { keepUpdated: true, autoWords: "SCU Block" });
  const { window } = app;
  const chip = window.document.querySelector("[data-eventchip]");
  await settle();
  let saves = 0;
  chip.addEventListener("click", () => {
    const popup = window.document.createElement("div");
    popup.setAttribute("role", "dialog");
    popup.innerHTML = '<h1>SCU Block (3.17 hours)</h1><button aria-label="Edit event"></button>';
    window.document.body.append(popup);
    popup.querySelector("button").addEventListener("click", () => {
      popup.remove();
      const page = window.document.createElement("main");
      page.innerHTML = `<input aria-label="Title" value="SCU Block (3.17 hours)">
        <input aria-label="Start date" data-date="20261026" value="Oct 26, 2026">
        <input aria-label="Start time" value="10:15am">
        <input aria-label="End date" data-date="20261026" value="Oct 26, 2026">
        <input aria-label="End time" value="2:25pm">
        <div role="combobox">Does not repeat</div>
        <button>Save</button>`;
      window.document.body.append(page);
      page.querySelector("button").addEventListener("click", () => {
        saves++;
        const title = page.querySelector('[aria-label="Title"]').value;
        chip.querySelector(".I0UMhf").textContent = title;
        chip.querySelector(".screen-reader").textContent = `10:15am to 2:25pm, ${title}, Calendar: Work, October 26, 2026`;
        page.remove();
      });
    });
  });

  chip.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
  chip.querySelector(".screen-reader").textContent = "10:15am to 2:25pm, SCU Block (3.17 hours), Calendar: Work, October 26, 2026";
  chip.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true, clientX: 10, clientY: 30 }));
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal(saves, 1);
  assert.equal(chip.querySelector(".I0UMhf").textContent, "SCU Block (4.17 hours)");
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

test("keep-updated mode leaves recurring events for manual review", async () => {
  const app = run(`<div data-eventchip data-eventid="recurring-1" role="button">
    <div class="screen-reader">10:15am to 1:25pm, SCU Block (3.17 hours), October 26, 2026</div>
    <div aria-hidden="true"><span class="I0UMhf">SCU Block (3.17 hours)</span></div>
  </div>`, { keepUpdated: true, autoWords: "SCU Block" });
  await settle();
  const chip = app.window.document.querySelector("[data-eventchip]");
  let saves = 0;
  chip.addEventListener("click", () => {
    const popup = app.window.document.createElement("div");
    popup.setAttribute("role", "dialog");
    popup.innerHTML = '<h1>SCU Block (3.17 hours)</h1><button aria-label="Edit event"></button>';
    app.window.document.body.append(popup);
    popup.querySelector("button").addEventListener("click", () => {
      popup.remove();
      const page = app.window.document.createElement("main");
      page.innerHTML = `<input aria-label="Title" value="SCU Block (3.17 hours)">
        <input aria-label="Start date" data-date="20261026" value="Oct 26, 2026">
        <input aria-label="Start time" value="10:15am">
        <input aria-label="End date" data-date="20261026" value="Oct 26, 2026">
        <input aria-label="End time" value="2:25pm">
        <div role="combobox">Every week</div>
        <button aria-label="Cancel event changes"></button><button>Save</button>`;
      app.window.document.body.append(page);
      page.querySelector("button[aria-label]").addEventListener("click", () => page.remove());
      page.querySelector("button:last-child").addEventListener("click", () => saves++);
    });
  });
  chip.dispatchEvent(new app.window.MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
  chip.querySelector(".screen-reader").textContent = "10:15am to 2:25pm, SCU Block (3.17 hours), October 26, 2026";
  chip.dispatchEvent(new app.window.MouseEvent("pointerup", { bubbles: true, clientX: 10, clientY: 30 }));
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal(saves, 0);
  assert.match(app.window.document.querySelector(".calendar-hours-notice").textContent, /recurring event/i);
  app.dom.window.close();
});
