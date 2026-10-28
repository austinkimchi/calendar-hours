const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const storageHarness = require("./helpers/settings-storage");
const workday = require("../extension/workday-core");
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

async function page(t, initial = {}, connected = true) {
  const store = storageHarness(initial);
  const dom = new JSDOM(fs.readFileSync("extension/options.html", "utf8"), { runScripts: "outside-only", url: "https://extension.test/options.html" });
  t.after(() => dom.window.close());
  dom.window.chrome = { storage: store.storage, runtime: { sendMessage: async () => connected
    ? { ok: true, calendars: [{ id: "work", name: "Work", timeZone: "America/Los_Angeles" }, { id: "other", name: "Other", timeZone: "UTC" }] }
    : { ok: false, needsSetup: true, reason: "Connect Google Calendar" } } };
  for (const name of ["settings-sync", "core", "options", "workday-core", "workday-options"]) dom.window.eval(fs.readFileSync(`extension/${name}.js`, "utf8"));
  await settle();
  const form = id => dom.window.document.querySelector(id);
  const field = (name, work = false) => form(work ? "#workday-settings" : "#settings").elements.namedItem(name);
  const change = (name, value, work = false) => {
    const el = field(name, work);
    if (el.type === "checkbox") el.checked = value; else el.value = value;
    el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  };
  const save = async (work = false) => {
    form(work ? "#workday-settings" : "#settings").dispatchEvent(new dom.window.Event("submit", { cancelable: true }));
    await settle();
  };
  return { store, dom, field, change, save, doc: dom.window.document };
}

test("open settings apply incoming values without replacing an in-progress title template or writing defaults", async t => {
  const p = await page(t, { template: "({value} {unit})", decimals: 2 });
  assert.equal(p.store.writes.length, 0);
  p.change("template", "[{value} {unit}]");
  p.store.receive({ template: "— {value} {unit}", decimals: 1, automatic: false });
  assert.equal(p.field("template").value, "[{value} {unit}]");
  assert.equal(p.field("decimals").value, "1");
  assert.equal(p.field("automatic").checked, false);
  assert.match(p.doc.querySelector("#status").textContent, /unsaved changes are kept/);
  await p.save();
  assert.deepEqual(p.store.writes, [{ template: "[{value} {unit}]" }]);
  assert.equal(p.store.data.decimals, 1);
  assert.equal(p.doc.querySelector("#status").textContent, "Saved in this browser");
});

test("invalid local input survives remote updates and cannot publish a normalized default", async t => {
  const p = await page(t, { template: "({value} {unit})" });
  p.change("template", "unfinished {");
  p.store.receive({ decimals: 3, template: "[{value}]" });
  assert.equal(p.field("template").value, "unfinished {");
  await p.save(); assert.equal(p.store.writes.length, 0);
  assert.match(p.doc.querySelector("#status").textContent, /Finish the title template/);
});

test("remote templates keep inherited minutes patterns and phrase rules current", async t => {
  const p = await page(t);
  p.store.receive({ template: "[{value} {unit}]", matchingPhrases: [{ phrase: "Study", dynamic: true }] });
  assert.equal(p.field("minutesTemplate").value, "[{value} {unit}]");
  assert.equal(p.doc.querySelector(".rule-phrase").value, "Study");
  p.field("minutesBelowHour").click(); await settle();
  assert.deepEqual(p.store.writes, [{ minutesBelowHour: true, minutesTemplate: "[{value} {unit}]" }]);
  p.store.receive({ template: "— {value} {unit}" });
  assert.equal(p.field("minutesTemplate").value, "[{value} {unit}]", "explicit minutes customization remains independent");
});

test("Workday keeps unsaved edits while incoming calendars and toggles update, then saves only its edited field", async t => {
  const initial = { enabled: true, calendarId: "work", keyword: "Work block", timeZone: "UTC" };
  const p = await page(t, { workdayIntegration: initial });
  p.change("keyword", "SCU Block", true);
  p.store.receive({ "workdayIntegration.includeFuture": true, "workdayIntegration.calendarIds": ["other"], "workdayIntegration.updateOverlaps": false });
  assert.equal(p.field("keyword", true).value, "SCU Block");
  assert.equal(p.field("includeFuture", true).checked, true);
  assert.equal(p.field("updateOverlaps", true).checked, false);
  assert.deepEqual([...p.doc.querySelectorAll("#workday-calendars input:checked")].map(el => el.value), ["other"]);
  await p.save(true);
  assert.deepEqual(p.store.writes, [{ "workdayIntegration.keyword": "SCU Block" }]);
  const value = workday.settingsFromStorage(p.store.data);
  assert.equal(value.includeFuture, true); assert.deepEqual(value.calendarIds, ["other"]);
  assert.equal(value.timeZone, "UTC");
});

test("a dirty Workday calendar selection survives remote settings and refreshes", async t => {
  const p = await page(t, { workdayIntegration: { enabled: true, calendarId: "work", keyword: "Work", timeZone: "UTC" } });
  p.doc.querySelector('#workday-calendars input[value="other"]').click();
  p.store.receive({ "workdayIntegration.calendarIds": [], "workdayIntegration.timeZone": "America/New_York" });
  p.doc.querySelector("#workday-refresh").click(); await settle();
  assert.deepEqual([...p.doc.querySelectorAll("#workday-calendars input:checked")].map(el => el.value), ["work", "other"]);
  assert.equal(p.field("timeZone", true).value, "America/New_York");
  await p.save(true);
  assert.deepEqual(p.store.data["workdayIntegration.calendarIds"], ["work", "other"]);
  assert.equal(p.store.writes[0]["workdayIntegration.timeZone"], undefined);
});

test("disabling Workday without a local OAuth connection keeps the synced calendars and fixed zone", async t => {
  const legacy = { enabled: true, calendarIds: ["work"], keyword: "Work", timeZone: "America/New_York", includeFuture: true };
  const p = await page(t, { workdayIntegration: legacy }, false);
  p.change("enabled", false, true); await p.save(true);
  assert.deepEqual(p.store.writes, [{ "workdayIntegration.enabled": false }]);
  const saved = workday.settingsFromStorage(p.store.data);
  assert.deepEqual(saved.calendarIds, ["work"]); assert.equal(saved.timeZone, "America/New_York");
});

test("a quota failure is visible and preserves unsaved Workday values for retry", async t => {
  const p = await page(t, { workdayIntegration: { enabled: true, calendarId: "work", keyword: "Work", timeZone: "UTC" } });
  p.store.fail(new Error("QUOTA_BYTES_PER_ITEM exceeded"));
  p.change("keyword", "SCU Block", true); await p.save(true);
  assert.match(p.doc.querySelector("#workday-status").textContent, /Could not save: QUOTA/);
  p.store.receive({ "workdayIntegration.importComments": true });
  assert.equal(p.field("keyword", true).value, "SCU Block");
  p.store.fail(null); await p.save(true);
  assert.deepEqual(p.store.writes, [{ "workdayIntegration.keyword": "SCU Block" }]);
});

test("reverting unsaved numeric and calendar choices does not publish unchanged settings", async t => {
  const p = await page(t, { workdayIntegration: { enabled: true, calendarId: "work", keyword: "Work", timeZone: "UTC" } });
  p.change("decimals", "1"); p.change("decimals", "2"); await p.save();
  const other = p.doc.querySelector('#workday-calendars input[value="other"]');
  other.click(); other.click(); await p.save(true);
  assert.deepEqual(p.store.writes, []);
});
