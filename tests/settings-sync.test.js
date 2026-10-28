const test = require("node:test");
const assert = require("node:assert/strict");
const { create } = require("../extension/settings-sync");
const general = require("../extension/core");
const workday = require("../extension/workday-core");
const storageHarness = require("./helpers/settings-storage");

function editor(store, kind = general, updates = []) {
  return create({ storage: store.storage, read: kind.settingsFromStorage || kind.settingsFrom,
    encode: kind.settingsPatch, onUpdate: (value, meta) => updates.push({ value, meta }) });
}

test("loading and reopening preserve saved choices without publishing defaults or private local state", async () => {
  const initial = { automatic: false, apiSync: true, autoWords: "Study", keepUpdated: true,
    workdayIntegration: { calendarId: "work", keyword: "Work", includeFuture: true } };
  const store = storageHarness(initial), e = editor(store);
  await e.load();
  assert.equal(e.values().automatic, false);
  assert.deepEqual(e.values().matchingPhrases, [{ phrase: "Study", dynamic: true }]);
  store.receive({ calendarHoursOAuth: { accessToken: "local-test-token" } }, "local");
  e.edit({ showSuggestion: false }); await e.save(e.values());
  assert.deepEqual(store.writes, [{ showSuggestion: false }]);
  assert.equal(store.data.calendarHoursOAuth, undefined);
  const reopened = editor(store); await reopened.load();
  assert.equal(reopened.values().showSuggestion, false);
  assert.equal(reopened.values().apiSync, true);
  assert.deepEqual(store.data.workdayIntegration, initial.workdayIntegration);
});

test("two devices editing different general preferences offline merge without rewriting either form", async () => {
  const a = storageHarness({}), b = storageHarness({}), ea = editor(a), eb = editor(b);
  await Promise.all([ea.load(), eb.load()]);
  ea.edit({ unit: "hrs", singularUnit: "hr" });
  eb.edit({ decimals: 1 });
  await Promise.all([ea.save(ea.values()), eb.save(eb.values())]);
  a.receive(b.writes[0]); b.receive(a.writes[0]);
  assert.equal(ea.values().unit, "hrs"); assert.equal(eb.values().unit, "hrs");
  assert.equal(ea.values().decimals, 1); assert.equal(eb.values().decimals, 1);
  assert.equal(a.writes.length, 1); assert.equal(b.writes.length, 1, "receiving settings does not echo a write");
});

test("Workday reads legacy settings and merges independent per-field edits, with false and empty values preserved", async () => {
  const legacy = { workdayIntegration: { enabled: true, calendarId: "old-work", keyword: "Work", timeZone: "UTC",
    includeFuture: true, updateOverlaps: true, calendarMeals: true, autoMeal: true } };
  const a = storageHarness(legacy), b = storageHarness(legacy), ea = editor(a, workday), eb = editor(b, workday);
  await Promise.all([ea.load(), eb.load()]);
  ea.edit({ includeFuture: false }); eb.edit({ updateOverlaps: false });
  await Promise.all([ea.save(ea.values()), eb.save(eb.values())]);
  a.receive(b.writes[0]); b.receive(a.writes[0]);
  for (const e of [ea, eb]) {
    assert.equal(e.values().includeFuture, false); assert.equal(e.values().updateOverlaps, false);
    assert.equal(e.values().timeZone, "UTC"); assert.equal(e.values().calendarMeals, false);
    assert.deepEqual(e.values().calendarIds, ["old-work"]);
  }
  ea.edit({ calendarIds: [], enabled: false }); await ea.save(ea.values());
  b.receive(a.writes[1]);
  assert.deepEqual(eb.values().calendarIds, []); assert.equal(eb.values().enabled, false);
  assert.deepEqual(a.data.workdayIntegration, legacy.workdayIntegration, "legacy storage stays intact for older builds");
  assert.ok(a.writes.every(patch => !Object.hasOwn(patch, "workdayIntegration")));
});

test("same-field incoming changes keep unsaved edits; saving explicitly replaces that field only", async () => {
  const store = storageHarness({ unit: "hours" }), updates = [], e = editor(store, general, updates);
  await e.load(); e.edit({ unit: "hrs" });
  store.receive({ unit: "h", decimals: 1 });
  assert.equal(e.values().unit, "hrs"); assert.equal(e.values().decimals, 1);
  assert.equal(updates.at(-1).meta.dirty.has("unit"), true);
  await e.save(e.values());
  assert.deepEqual(store.writes, [{ unit: "hrs" }]);
  store.receive({ unit: "hour(s)" });
  assert.equal(e.values().unit, "hour(s)", "after save the browser-delivered value wins");
});

test("incoming changes during initial read win over its older snapshot", async () => {
  const store = storageHarness({ decimals: 2 }); let resolveRead;
  store.storage.sync.get = () => new Promise(resolve => { resolveRead = resolve; });
  const e = editor(store), loading = e.load();
  store.receive({ decimals: 4, automatic: false });
  resolveRead({ decimals: 2 }); await loading;
  assert.equal(e.values().decimals, 4); assert.equal(e.values().automatic, false);
  assert.equal(store.writes.length, 0);
});

test("reverting a preference while its previous write is in flight is saved afterward", async () => {
  const store = storageHarness({ automatic: true }); const original = store.storage.sync.set;
  let releaseWrite;
  store.storage.sync.set = patch => new Promise(resolve => { releaseWrite = async () => { await original(patch); resolve(); }; });
  const e = editor(store); await e.load();
  e.edit({ automatic: false }); const first = e.save(e.values());
  await new Promise(resolve => setImmediate(resolve));
  e.edit({ automatic: true }); const second = e.save(e.values());
  store.storage.sync.set = original;
  await releaseWrite(); await Promise.all([first, second]);
  assert.equal(store.data.automatic, true); assert.equal(e.dirtyKeys().size, 0);
  assert.deepEqual(store.writes, [{ automatic: false }, { automatic: true }]);
});

test("a newer incoming value during write completion is not replaced by a stale local cache", async () => {
  const store = storageHarness({});
  store.storage.sync.set = async () => { store.receive({ decimals: 3 }); store.receive({ decimals: 4 }); };
  const e = editor(store); await e.load(); e.edit({ decimals: 3 }); await e.save(e.values());
  assert.equal(e.values().decimals, 4);
});

test("quota errors retain dirty preferences and a retry can save them", async () => {
  const store = storageHarness({}), e = editor(store); await e.load();
  e.edit({ keyword: "/duration" }); store.fail(new Error("QUOTA_BYTES_PER_ITEM exceeded"));
  await assert.rejects(e.save(e.values()), /QUOTA/);
  store.receive({ decimals: 1 }); assert.equal(e.values().keyword, "/duration");
  store.fail(null); await e.save(e.values());
  assert.deepEqual(store.writes, [{ keyword: "/duration" }]);
  assert.equal(e.dirtyKeys().size, 0);
});

test("deleted synced preferences return to defaults without leaving derived values stuck", async () => {
  const store = storageHarness({ template: "[{value} {unit}]", automatic: false }), e = editor(store);
  await e.load(); assert.equal(e.values().minutesTemplate, "[{value} {unit}]");
  store.receive({ template: undefined, automatic: undefined });
  assert.equal(e.values().minutesTemplate, "({value} {unit})"); assert.equal(e.values().automatic, true);
});
