/* Read Calendar's own zones without another connection or permission.
 * These DOM adapters are private Google UI details; unknown explicit labels
 * fail closed instead of being interpreted in the computer's zone. */
(function () {
  "use strict";
  const core = globalThis.CalendarHoursCore;
  const cached = new Map();
  let observedPrimary = null;
  let account = null;
  const chosenEventZones = new WeakMap();
  const visible = element => !!element && !element.hidden && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
  const labelKey = value => String(value || "").replace(/^\(GMT[^)]*\)\s*/, "").trim();

  function visitArrays(value, fn) {
    if (!Array.isArray(value)) return;
    fn(value);
    for (const child of value) if (Array.isArray(child)) visitArrays(child, fn);
  }

  function readData(id, extract) {
    const text = document.getElementById(id)?.textContent || "";
    const prior = cached.get(id);
    if (prior?.text === text) return prior.value;
    let value = null;
    try { if (text) value = extract(JSON.parse(text)); } catch { /* UI data changed or is not ready. */ }
    cached.set(id, { text, value });
    if (id === "initialdata") observedPrimary = null;
    return value;
  }

  function zoneFromLabel(label) {
    if (core.validTimeZone(label)) return label;
    const labels = readData("timezonedata", data => {
      const result = new Map();
      visitArrays(data, row => {
        if (typeof row[1] !== "string" || !row[1].startsWith("(GMT") || !core.validTimeZone(row[0])) return;
        const key = labelKey(row[1]);
        const zone = new Intl.DateTimeFormat("en", { timeZone: row[0] }).resolvedOptions().timeZone;
        if (!result.has(key)) result.set(key, zone);
        else if (result.get(key) !== zone) result.set(key, null);
      });
      return result;
    });
    return labels?.get(labelKey(label)) || null;
  }

  function primary() {
    const currentAccount = location.pathname.match(/\/calendar\/u\/\d+\//)?.[0] || "/calendar/";
    if (account !== currentAccount) { account = currentAccount; cached.clear(); observedPrimary = null; }
    const zone = readData("initialdata", data => {
      const found = new Set();
      visitArrays(data, row => {
        // Select the named preference, never an event's or another calendar's zone.
        if (row[0] === "timezone" && core.validTimeZone(row[1])) found.add(row[1]);
      });
      return found.size === 1 ? [...found][0] : null;
    });
    const picker = [...document.querySelectorAll('input[aria-label="Primary time zone"]')].find(visible);
    if (picker) observedPrimary = zoneFromLabel(picker.value);
    const urlZone = new URL(location.href).searchParams.get("ctz");
    if (urlZone) return core.validTimeZone(urlZone) ? urlZone : null;
    return observedPrimary || zone || core.systemTimeZone();
  }

  function forEditor(root) {
    const timeZone = primary();
    const label = selector => {
      const element = [...root.querySelectorAll(selector)].find(visible);
      return element ? zoneFromLabel(element.getAttribute("data-text") || element.textContent.trim()) : undefined;
    };
    // A common zone is beside End time. Separate zones also add a Start label.
    let start = label('[jsname="PH80Af"]');
    let end = label('#xTmZn, [jsname="yxQRke"]');
    const title = root.querySelector('input[aria-label="Add title"]');
    if (title) {
      // Quick composer keeps these controls mounted when the time row folds.
      // Its separate-zone buttons expose only seasonal offsets, not IANA IDs.
      const separate = root.querySelector('[jsname="KhmQBe"]')?.textContent.includes("(GMT");
      if (separate) {
        const chosen = chosenEventZones.get(title);
        start = chosen?.start ?? null;
        end = chosen?.end ?? null;
      } else {
        const text = root.querySelector('[jsname="hf42V"]')?.textContent.trim() ||
          [...(root.querySelector('[data-key="startTime"]')?.closest("button")?.querySelectorAll("li") || [])]
            .map(item => item.textContent.trim()).find(text => text.startsWith("(GMT"));
        if (text?.startsWith("(GMT")) start = end = zoneFromLabel(text);
      }
    }
    return {
      timeZone,
      startTimeZone: start === undefined ? (end === undefined ? timeZone : end) : start,
      endTimeZone: end === undefined ? timeZone : end
    };
  }

  document.addEventListener("click", event => {
    const button = event.target instanceof Element && event.target.closest('button,[role="button"]');
    const dialog = button?.closest('[role="dialog"]');
    if (button?.textContent.trim() !== "OK" || !dialog?.querySelector('input[aria-label="Event start time zone"]')) return;
    const title = document.querySelector('input[aria-label="Add title"]');
    if (!title) return;
    const start = zoneFromLabel(dialog.querySelector('input[aria-label="Event start time zone"]').value);
    const endInput = dialog.querySelector('input[aria-label="Event end time zone"]');
    chosenEventZones.set(title, { start, end: endInput?.disabled ? start : zoneFromLabel(endInput?.value) });
  }, true);

  globalThis.CalendarHoursZones = { primary, forEditor };
})();
