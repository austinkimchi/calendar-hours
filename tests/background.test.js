const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "..", "extension", "background.js"), "utf8");

test("grid sync uses inactive Calendar tabs and confirms the saved title", async () => {
  const created = [];
  const removed = [];
  const updated = [];
  let handler;
  const chrome = {
    commands: { onCommand: { addListener() {} } },
    runtime: { onMessage: { addListener(fn) { handler = fn; } } },
    tabs: {
      create: async options => {
        const tab = { id: created.length + 1, ...options };
        created.push(tab);
        return tab;
      },
      remove: async id => { removed.push(id); },
      reload: async () => {},
      update: async (id, options) => { updated.push({ id, ...options }); },
      sendMessage: async (id, message) => message.type === "CALENDAR_HOURS_BACKGROUND_SYNC"
        ? { ok: true, nextTitle: "SCU Block (2.33 hours)" }
        : { ok: true }
    }
  };
  vm.runInNewContext(script, { chrome, URL, setTimeout, console });
  const response = await new Promise(resolve => handler({
    type: "CALENDAR_HOURS_GRID_SYNC", id: "event-1", title: "SCU Block (1.83 hours)",
    startTime: "10:55am", endTime: "1:15pm"
  }, { tab: { id: 10, windowId: 5 }, url: "https://calendar.google.com/calendar/u/0/r/customday" }, resolve));
  assert.equal(response.ok, true);
  assert.equal(response.nextTitle, "SCU Block (2.33 hours)");
  assert.deepEqual(created.map(tab => tab.active), [false]);
  assert.deepEqual(created.map(tab => tab.url), [
    "https://calendar.google.com/calendar/u/0/r/eventedit/event-1"
  ]);
  assert.deepEqual(updated, [{ id: 1, url: "https://calendar.google.com/calendar/u/0/r/eventedit/event-1" }]);
  assert.deepEqual(removed, [1]);
});
