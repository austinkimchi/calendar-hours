const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../extension/core.js");

test("rounds the pictured 10:15–1:25 event to 3.17 hours", () => {
  const minutes = core.durationMinutes({
    startDate: "Oct 21, 2026", startTime: "10:15am",
    endDate: "Oct 21, 2026", endTime: "1:25pm"
  });
  assert.equal(minutes, 190);
  assert.equal(core.formattedDuration(minutes, {}).text, "(3.17 hours)");
  assert.equal(core.formattedDuration(minutes, { rounding: "truncate" }).text, "(3.16 hours)");
});

test("supports decimal precision, increments, unit text and templates", () => {
  assert.equal(core.formattedDuration(190, { decimals: 1, unit: "hrs" }).text, "(3.2 hrs)");
  assert.equal(core.formattedDuration(60, { decimals: 2, unit: "hr" }).text, "(1 hr)");
  assert.equal(core.formattedDuration(190, { decimals: 2, incrementMinutes: 15, rounding: "up", template: "— {value} {unit}" }).text, "— 3.25 hours");
});

test("uses actual elapsed time across a date boundary and rejects all-day events", () => {
  assert.equal(core.durationMinutes({ startDate: "2026-10-21", startTime: "11:30pm", endDate: "2026-10-22", endTime: "1:00am" }), 90);
  assert.equal(core.durationMinutes({ startDate: "2026-10-21", startTime: "11:30pm", endDate: "2026-10-21", endTime: "1:00am" }), null);
  assert.equal(core.durationMinutes({ startDate: "2026-10-21", startTime: "9am", endDate: "2026-10-21", endTime: "10am", allDay: true }), null);
});

test("replaces keyword or a prior duration instead of duplicating it", () => {
  const formatted = core.formattedDuration(190, {});
  assert.equal(core.titleWithDuration("SCU Block /hours", formatted, {}), "SCU Block (3.17 hours)");
  assert.equal(core.titleWithDuration("SCU Block (3.16 hours)", formatted, {}), "SCU Block (3.17 hours)");
  assert.equal(core.titleWithDuration("SCU Block (3.17 hours)", formatted, {}), "SCU Block (3.17 hours)");
  assert.equal(core.titleWithDuration("", formatted, {}), null);
});

test("automatic insertion requires a configured title word", () => {
  assert.equal(core.matchesAutoWords("SCU Block", {}), true);
  assert.equal(core.matchesAutoWords("Doctor appointment", {}), false);
  assert.equal(core.matchesAutoWords("Focus session", { autoWords: "block, focus" }), true);
  assert.equal(core.matchesAutoWords("SCU Block (3.17 hours)", { autoWords: "scu block" }), true);
  assert.equal(core.matchesAutoWords("SCU Blocked", { autoWords: "SCU Block" }), false);
  assert.equal(core.matchesAutoWords("Unblocked time", { autoWords: "block" }), false);
  assert.equal(core.settingsFrom({ keepUpdated: true, replaceExisting: false }).replaceExisting, true);
});
