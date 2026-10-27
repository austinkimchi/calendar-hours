const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const core = require("../extension/core.js");

const fields = (date, startTime, endTime, timeZone) => ({startDate:date, endDate:date, startTime, endTime, timeZone});

test("Calendar zone is independent of the traveling computer's zone", () => {
  const old = process.env.TZ;
  try {
    for (const zone of ["America/Los_Angeles", "Asia/Tokyo", "America/New_York", "UTC"]) {
      process.env.TZ = zone;
      const result = core.eventInstants(fields("2026-03-08", "1:30am", "3:30am", "America/Los_Angeles"));
      assert.equal(result.minutes, 60);
      assert.equal(new Date(result.start).toISOString(), "2026-03-08T09:30:00.000Z");
      assert.equal(core.systemTimeZone(), zone);
    }
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
});

test("actual elapsed duration handles DST, fractional offsets, and separate flight zones", () => {
  assert.equal(core.durationMinutes(fields("2026-11-01", "12:30am", "2:30am", "America/Los_Angeles")), 180);
  assert.equal(core.durationMinutes(fields("2026-10-04", "1:30am", "3am", "Australia/Lord_Howe")), 60);
  assert.equal(new Date(core.eventInstants(fields("2026-10-27", "9am", "10am", "Asia/Kathmandu")).start).toISOString(), "2026-10-27T03:15:00.000Z");
  assert.equal(core.durationMinutes({startDate:"2026-10-27", startTime:"11am", startTimeZone:"Asia/Tokyo",
    endDate:"2026-10-27", endTime:"5am", endTimeZone:"America/Los_Angeles"}), 600);
});

test("invalid dates, nonexistent clocks, and repeated DST clocks are not guessed", () => {
  for (const f of [
    fields("2026-03-08", "2:30am", "4am", "America/Los_Angeles"),
    fields("2026-11-01", "1:15am", "1:45am", "America/Los_Angeles"),
    fields("2026-02-30", "9am", "10am", "UTC"),
    fields("2011-12-30", "9am", "10am", "Pacific/Apia"),
    fields("2026-10-27", "9am", "10am", "not/a-zone"),
    fields("2026-10-27", "9am", "10am", null)
  ]) assert.equal(core.durationMinutes(f), null, JSON.stringify(f));
});

function page(extra = "", url = "https://calendar.google.com/calendar/u/0/r/week") {
  const dom = new JSDOM(`<script id="initialdata" type="application/json">[[["timezone","America/Los_Angeles"]], ["event","Asia/Tokyo"]]</script>
    <script id="timezonedata" type="application/json">[[["America/Los_Angeles","(GMT-07:00) Pacific Time - Los Angeles"],["Asia/Tokyo","(GMT+09:00) Japan Standard Time"]]]</script>${extra}`,
    {url,runScripts:"outside-only"});
  dom.window.HTMLElement.prototype.getClientRects = function () { return this.hidden ? [] : [{}]; };
  dom.window.CalendarHoursCore = core;
  dom.window.eval(fs.readFileSync(require.resolve("../extension/calendar-zones.js"), "utf8"));
  return {dom, w:dom.window, zones:dom.window.CalendarHoursZones};
}

test("Calendar primary preference wins over event metadata and falls back to fresh device zone", () => {
  const {dom,w,zones} = page();
  assert.equal(zones.primary(), "America/Los_Angeles");
  w.document.getElementById("initialdata").textContent = '[["timezone","Asia/Tokyo"]]';
  assert.equal(zones.primary(), "Asia/Tokyo");
  w.document.getElementById("initialdata").remove();
  const old = process.env.TZ;
  try {
    for (const zone of ["America/New_York", "Asia/Tokyo"]) { process.env.TZ=zone; assert.equal(zones.primary(),zone); }
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ=old; }
  dom.window.close();
});

test("event labels override the primary zone, including separate zones and DST label offset changes", () => {
  const {dom,w,zones} = page('<div id="xTmZn" data-text="(GMT-08:00) Pacific Time - Los Angeles">(GMT-08:00)</div>');
  assert.equal(zones.forEditor(w.document).endTimeZone,"America/Los_Angeles");
  const start = w.document.createElement("div"); start.setAttribute("jsname","PH80Af");
  start.setAttribute("data-text","(GMT+09:00) Japan Standard Time"); w.document.body.append(start);
  assert.equal(zones.forEditor(w.document).startTimeZone,"Asia/Tokyo");
  start.hidden = true;
  assert.equal(zones.forEditor(w.document).startTimeZone,"America/Los_Angeles");
  w.document.getElementById("xTmZn").setAttribute("data-text","(GMT+09:00) Unknown place");
  assert.equal(zones.forEditor(w.document).startTimeZone,null);
  dom.window.close();
});

test("Calendar display-zone URL and changes in its primary-zone picker are followed", () => {
  const {dom,w,zones}=page('<input aria-label="Primary time zone" value="(GMT+09:00) Japan Standard Time">');
  assert.equal(zones.primary(),"Asia/Tokyo");
  w.document.querySelector("input").remove();
  assert.equal(zones.primary(),"Asia/Tokyo");
  w.history.replaceState({},"","?ctz=UTC");
  assert.equal(zones.primary(),"UTC");
  w.history.replaceState({},"","?ctz=invalid");
  assert.equal(zones.primary(),null);
  dom.window.close();
});
