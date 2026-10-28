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
  const reloaded = [];
  let staleReads = 0;
  let handler;
  const chrome = {
    commands: { onCommand: { addListener() {} } },
    runtime: { getURL: path => `chrome-extension://example/${path}`,
      onInstalled: { addListener() {} }, onMessage: { addListener(fn) { handler = fn; } } },
    tabs: {
      create: async options => {
        const tab = { id: created.length + 1, ...options };
        created.push(tab);
        return tab;
      },
      remove: async id => { removed.push(id); },
      reload: async id => { reloaded.push(id); },
      update: async (id, options) => { updated.push({ id, ...options }); },
      sendMessage: async (id, message) => {
        if (message.type !== "CALENDAR_HOURS_BACKGROUND_SYNC") return { ok: true };
        if (staleReads++ < 3) return { ok: false, retry: true, reason: "Waiting for Calendar's resize save" };
        return { ok: true, nextTitle: "SCU Block (2.33 hours)" };
      }
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
  assert.deepEqual(reloaded, [1, 1, 1]);
  assert.deepEqual(removed, [1]);
});

test("connected API mode saves a grid resize without creating an editor tab", async () => {
  let handler;
  let created = 0;
  const syncCalls = [];
  const chrome = {
    commands: { onCommand: { addListener() {} } },
    runtime: { getURL: path => `chrome-extension://example/${path}`,
      onInstalled: { addListener() {} }, onMessage: { addListener(fn) { handler = fn; } } },
    storage: { sync: { get: async () => ({ apiSync: true, matchingPhrases: [{ phrase: "SCU Block", dynamic: true }] }) } },
    tabs: { create: async () => { created++; throw new Error("Unexpected editor tab"); } }
  };
  const core = require("../extension/core.js");
  vm.runInNewContext(script, { chrome, URL, setTimeout, console,
    globalThis: {
      CalendarHoursCore: core,
      CalendarHoursOAuth: { getAccessToken: async () => "test-token" },
      CalendarHoursApiSync: { syncTitle: async input => {
        syncCalls.push(input);
        return { ok: true, nextTitle: "SCU Block (2.33 hours)" };
      } }
    } });
  const response = await new Promise(resolve => handler({
    type: "CALENDAR_HOURS_GRID_SYNC", id: "event-1", title: "SCU Block (1.83 hours)",
    startIso: "2026-10-26T17:55:00.000Z", endIso: "2026-10-26T20:15:00.000Z"
  }, { tab: { id: 10, windowId: 5 }, url: "https://calendar.google.com/calendar/u/0/r/customday" }, resolve));
  assert.equal(response.ok, true);
  assert.equal(created, 0);
  assert.equal(syncCalls.length, 1);
  assert.equal(syncCalls[0].accessToken, "test-token");
});

test("first installation opens welcome and shared connection preserves feature preferences", async () => {
  let installed;
  let handler;
  const opened = [];
  const saved = [];
  let connectCalls = 0;
  const chrome = {
    commands: { onCommand: { addListener() {} } },
    runtime: {
      getURL: path => `chrome-extension://example/${path}`,
      onInstalled: { addListener(fn) { installed = fn; } },
      onMessage: { addListener(fn) { handler = fn; } }
    },
    tabs: { create: async options => { opened.push(options); } },
    storage: { sync: { set: async value => { saved.push(value); } } }
  };
  vm.runInNewContext(script, { chrome, URL, setTimeout, console,
    globalThis: { CalendarHoursOAuth: { connect: async () => { connectCalls++; return { connected: true }; } } } });

  installed({ reason: "update" });
  assert.equal(opened.length, 0);
  installed({ reason: "install" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(opened[0].url, "chrome-extension://example/welcome.html");

  const send = (url, type) => new Promise(resolve => handler({ type }, { url }, resolve));
  assert.equal((await send("chrome-extension://example/other.html", "CALENDAR_HOURS_API_CONNECT")).ok, false);
  assert.equal(connectCalls, 0);
  assert.equal((await send("chrome-extension://example/welcome.html", "CALENDAR_HOURS_API_CONNECT")).connected, true);
  assert.equal(connectCalls, 1);
  assert.equal(saved.length, 0);
});
