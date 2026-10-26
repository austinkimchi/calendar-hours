const test = require("node:test");
const assert = require("node:assert/strict");
const { eventRefFromGridId, syncTitle } = require("../extension/api-sync.js");
const core = require("../extension/core.js");

const gridId = Buffer.from("1bbpi7u8naiabd2rs053dksjpm msj5rqni7dfc4s5vl0o73g3ako@g").toString("base64");
const startIso = "2026-10-26T17:55:00.000Z";
const endIso = "2026-10-26T20:15:00.000Z";
const event = (changes = {}) => ({
  summary: "SCU Block (1.83 hours)", etag: '"version-1"',
  start: { dateTime: startIso }, end: { dateTime: endIso }, ...changes
});
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("grid identifiers map the live Work calendar shorthand to Calendar API IDs", () => {
  assert.deepEqual(eventRefFromGridId(gridId), {
    eventId: "1bbpi7u8naiabd2rs053dksjpm",
    calendarId: "msj5rqni7dfc4s5vl0o73g3ako@group.calendar.google.com"
  });
  assert.equal(eventRefFromGridId("garbage"), null);
});

test("API sync waits for Calendar's resize save and patches only the title at the matching version", async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push({ url, options });
    if (options.method === "PATCH") return response(event({ summary: "SCU Block (2.33 hours)" }));
    return response(requests.length === 1 ? event({ end: { dateTime: "2026-10-26T19:45:00.000Z" } }) : event());
  };
  const result = await syncTitle({ gridId, title: "SCU Block (1.83 hours)", startIso, endIso,
    settings: core.settingsFrom({ matchingPhrases: [{ phrase: "SCU Block", dynamic: true }] }),
    accessToken: "test-token", fetcher, sleep: async () => {}, core });
  assert.deepEqual(result, { ok: true, nextTitle: "SCU Block (2.33 hours)" });
  assert.equal(requests.length, 3);
  assert.match(requests[0].url, /msj5rqni7dfc4s5vl0o73g3ako%40group\.calendar\.google\.com\/events\/1bbpi7u8naiabd2rs053dksjpm$/);
  assert.equal(requests[2].options.headers["If-Match"], '"version-1"');
  assert.deepEqual(JSON.parse(requests[2].options.body), { summary: "SCU Block (2.33 hours)" });
});

test("API sync avoids overwriting a changed title or recurring event", async () => {
  let writes = 0;
  const run = async data => syncTitle({ gridId, title: "SCU Block (1.83 hours)", startIso, endIso,
    settings: core.settingsFrom({ matchingPhrases: [{ phrase: "SCU Block", dynamic: true }] }),
    accessToken: "test-token", fetcher: async (_, options) => {
      if (options.method === "PATCH") writes++;
      return response(data);
    }, core });
  assert.match((await run(event({ summary: "SCU Block revised" }))).reason, /title changed/);
  assert.match((await run(event({ recurringEventId: "series" }))).reason, /recurring/);
  assert.equal(writes, 0);
});

test("API sync retries a version conflict using a fresh event version", async () => {
  let reads = 0;
  let patches = 0;
  const result = await syncTitle({ gridId, title: "SCU Block (1.83 hours)", startIso, endIso,
    settings: core.settingsFrom({ matchingPhrases: [{ phrase: "SCU Block", dynamic: true }] }),
    accessToken: "test-token", sleep: async () => {}, core,
    fetcher: async (_, options) => {
      if (!options.method) { reads++; return response(event({ etag: `"version-${reads}"` })); }
      patches++;
      assert.equal(options.headers["If-Match"], `"version-${patches}"`);
      return patches === 1 ? response({}, 412) : response(event({ summary: "SCU Block (2.33 hours)" }));
    } });
  assert.equal(result.ok, true);
  assert.equal(reads, 2);
  assert.equal(patches, 2);
});
