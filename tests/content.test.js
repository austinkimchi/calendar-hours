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
