/* Opt-in development probe. Deliberately absent from the extension manifest.
 * Saves only original values of existing, unsubmitted drafts.
 * Never persists credentials, replays captured requests, or retries a save.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CalendarHoursRequestExperiment = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const fail = message => { throw new Error(message); };
  function nodes(value, predicate) {
    const found = [];
    function visit(value) {
      if (!value || typeof value !== "object") return;
      if (predicate(value)) found.push(value);
      Object.values(value).forEach(visit);
    }
    visit(value); return found;
  }
  function one(items, message) { return items.length === 1 ? items[0] : fail(message); }
  const field = (form, name) => one(nodes(form.body, n => n.label === name && n.id), `Unrecognized ${name} field`);
  const date = v => `${v.Y}-${String(v.M).padStart(2, "0")}-${String(v.D).padStart(2, "0")}`;
  const minutes = v => Number(v.H) * 60 + Number(v.m);
  function calendarEntries(model) {
    const calendar = one(nodes(model.body, n => n.widget === "calendar"), "Expected one calendar");
    return calendar.consolidatedList.children.filter(n => n.timedEvent).map(n => ({
      date: date(n.startMoment.value), endDate: date(n.endMoment.value),
      start: minutes(n.startMoment.value), end: minutes(n.endMoment.value),
      type: n.title.value, status: n.style.value, hours: n.quantity.value,
      edit: one(n.editButton.children.filter(b => b.label === "Edit" && b.httpMethod === "POST"), "Expected one edit action").uri
    }));
  }
  function snapshot(entries) {
    return JSON.stringify(entries.map(({edit, ...entry}) => entry).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  }
  function validateForm(form, target) {
    if (form.widget !== "root" || form.mode !== "EDIT" || form.title?.text !== "Enter Time" || !form.flowExecutionKey || !form.sessionSecureToken) fail("Expected a fresh Enter Time form");
    if (field(form, "Status").instances?.[0]?.text !== "Not Submitted") fail("Only unsubmitted drafts are supported");
    if (field(form, "Time Type").instances?.length !== 1 || field(form, "Time Type").instances[0].text !== target.type) fail("Time type changed");
    if (date(field(form, "Date").value) !== target.date || minutes(field(form, "In").value) !== target.start || minutes(field(form, "Out").value) !== target.end) fail("Draft times changed");
    if (field(form, "OK").propertyName !== "wd:OK" || !/^\d+\/wd:OK$/.test(field(form, "OK").id) || !/^\d+$/.test(form.body.id)) fail("Unsupported save action");
    field(form, "Delete"); // Existing entry, never a new-entry form.
    const out = field(form, "Out");
    if (out.widget !== "timeInput" || !out.remoteValidate || !/^\d+\/wd:Out_Time$/.test(out.id)) fail("Unsupported time validation");
    return form;
  }
  function validationResult(response, form, end, duration) {
    if (response.widget !== "changeSummary" || !Array.isArray(response.changes) || typeof response.flowKey !== "string" || !response.flowKey ||
        Object.keys(response).some(k => !["widget", "changes", "editUri", "flowKey"].includes(k)) ||
        response.changes.some(c => c.widget !== "update" || !c.node || Object.keys(c.node).some(k => /error|warning|validation/i.test(k)))) fail("Unexpected validation response; nothing saved");
    const out = one(response.changes.filter(c => c.nodeId === field(form, "Out").id && c.node.value), "Missing validated time");
    const hours = one(response.changes.filter(c => c.nodeId === field(form, "Hours").id && typeof c.node.value === "number"), "Missing calculated hours");
    if (minutes(out.node.value) !== end || Math.abs(hours.node.value * 60 - duration) > 0.001) fail("Server did not confirm exact time and duration");
    return response.flowKey;
  }
  function create({ calendarUrl, clientVersion, origin, fetcher = fetch, now = () => performance.now(), uuid = () => crypto.randomUUID() }) {
    const url = new URL(calendarUrl, origin);
    if (new URL(origin).hostname !== "www.myworkday.com" || url.origin !== origin || !/^\/[^/]+\/inst\/[^/]+\/rel-task\/[^/]+\.htmld$/.test(url.pathname) || url.search || url.hash) fail("Use the observed same-origin Enter Time calendar URL");
    const tenant = url.pathname.split("/")[1];
    if (!/^[a-zA-Z0-9_-]+$/.test(tenant)) fail("Unexpected tenant path");
    let busy = false;
    const flowPath = `/${tenant}/flowController.htmld`;
    function endpoint(path, kind) {
      const endpoint = new URL(path, origin);
      const allowed = kind === "calendar" ? endpoint.href === url.href : kind === "flow" ? endpoint.pathname === flowPath || endpoint.pathname === flowPath.replace(/\.htmld$/, "") : new RegExp(`^/${tenant}/button/c\\d+/\\d+/\\d+(?:\\.htmld)?$`).test(endpoint.pathname);
      if (endpoint.origin !== origin || endpoint.search || endpoint.hash || !allowed) fail("Unexpected Workday endpoint");
      if (!endpoint.pathname.endsWith(".htmld")) endpoint.pathname += ".htmld";
      return endpoint.href;
    }
    async function request(path, kind, params, token) {
      const headers = { "X-Workday-Client": clientVersion };
      const options = { credentials: "same-origin", cache: "no-store", redirect: "error", headers };
      if (params) {
        if (!token) fail("Missing session token");
        options.method = "POST";
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        headers["Session-Secure-Token"] = token;
        options.body = new URLSearchParams({ ...params, sessionSecureToken: token, clientRequestID: uuid().replaceAll("-", "") });
      }
      const response = await fetcher(endpoint(path, kind), options);
      if (!response.ok) fail(`Workday request failed (${response.status}); do not retry a save automatically`);
      return response.json();
    }
    function validateTarget(target) {
      if (!target || !/^\d{4}-\d{2}-\d{2}$/.test(target.date) || !Number.isInteger(target.start) || !Number.isInteger(target.end) || target.start < 0 || target.end <= target.start || target.end >= 1439 || !target.type) fail("Unsupported probe target");
    }
    async function execute(target, initialModel, verify = true) {
      let form, flowKey, saveAttempted = false;
      const totalStart = now(), phases = {};
      async function phase(name, action) { const start = now(); const result = await action(); phases[name] = now() - start; return result; }
      try {
        const model = initialModel || await phase("readCalendar", () => request(url.href, "calendar"));
        const before = calendarEntries(model);
        const entry = one(before.filter(e => e.date === target.date && e.endDate === target.date && e.start === target.start && e.end === target.end && e.type === target.type && e.status === "saved"), "Expected one unchanged draft");
        if (before.some(e => e !== entry && e.date === target.date && e.start < target.end + 1 && e.end > target.start)) fail("Probe would overlap another entry");
        form = await phase("open", () => request(entry.edit, "open", {}, model.sessionSecureToken));
        flowKey = form.flowExecutionKey;
        validateForm(form, target);
        const out = field(form, "Out");
        async function validate(end) {
          const [Y, M, D] = target.date.split("-");
          const values = {m: String(end % 60).padStart(2,"0"), H: String(Math.floor(end / 60)), D, M, Y};
          const params = { _flowExecutionKey: flowKey, _eventId_validate: out.id };
          for (const [suffix, value] of Object.entries(values)) params[`${out.id}_${suffix}`] = value;
          const response = await request(form.requestUri, "flow", params, form.sessionSecureToken);
          flowKey = validationResult(response, form, end, end - target.start);
        }
        await phase("validateProbe", () => validate(target.end + 1));
        await phase("validateRestore", () => validate(target.end));
        // Only OK is sent after the original value was independently confirmed.
        const xml = `<wml:Change_Summary xmlns:wml="http://www.workday.com/ns/model/1.0" xmlns:wd="urn:com.workday/bsvc" xmlns:nyw="urn:com.netyourwork/aod"><wd:OK Ref="${field(form,"OK").id}" Replaced=""><V>1</V></wd:OK></wml:Change_Summary>`;
        saveAttempted = true;
        const saved = await phase("save", () => request(form.requestUri, "flow", { _flowExecutionKey: flowKey, _eventId_submit: form.body.id, "change-summary": xml }, form.sessionSecureToken));
        if (saved.mode !== "CONFIRM" || saved.microConclusion !== true || saved.title?.text !== "Time Block In/Out Saved") fail("Save outcome uncertain; inspect Workday before retrying");
        const after = verify ? await phase("verifyCalendar", () => request(url.href, "calendar")) : null;
        if (after && snapshot(calendarEntries(after)) !== snapshot(before)) fail("Calendar changed; inspect Workday before retrying");
        return { model: after, result: { phases, total: now() - totalStart, entriesVerified: verify ? before.length : 0, savedOriginalValues: true } };
      } catch (error) {
        if (form?.flowExecutionKey && !saveAttempted) {
          try { await request(form.requestUri, "flow", { _flowExecutionKey: flowKey || form.flowExecutionKey, _eventId_cancel: "Cancel" }, form.sessionSecureToken); }
          catch { error.message += "; draft cancellation was not confirmed"; }
        }
        throw error;
      }
    }
    async function run(target) {
      if (busy) fail("A probe is already running");
      validateTarget(target);
      busy = true;
      try { return (await execute(target)).result; }
      finally { busy = false; }
    }
    async function runBatch(targets, { verification = "each" } = {}) {
      if (busy) fail("A probe is already running");
      if (!Array.isArray(targets) || !targets.length || targets.length > 20 || !["each", "end"].includes(verification)) fail("Unsupported batch");
      targets.forEach(validateTarget);
      if (new Set(targets.map(t => JSON.stringify([t.date,t.start,t.end,t.type]))).size !== targets.length) fail("Duplicate batch target");
      busy = true;
      const start = now(), entries = [], phases = {};
      let before, model;
      try {
        let at = now();
        model = await request(url.href, "calendar");
        phases.readCalendar = now() - at;
        before = snapshot(calendarEntries(model));
        for (const target of targets) {
          const next = await execute(target, model, verification === "each");
          entries.push(next.result);
          // The just-verified calendar is the next entry's fresh starting state.
          if (next.model) model = next.model;
        }
        if (verification === "end") {
          at = now();
          model = await request(url.href, "calendar");
          phases.verifyCalendar = now() - at;
        }
        if (snapshot(calendarEntries(model)) !== before) fail("Calendar changed; inspect Workday before retrying");
        return { verification, phases, entries, total: now() - start, entriesVerified: calendarEntries(model).length, savedOriginalValues: true };
      } catch (error) {
        // This is diagnostic metadata, not an instruction to retry the batch.
        error.completedEntries = entries.length;
        throw error;
      } finally { busy = false; }
    }
    return { run, runBatch };
  }
  return { create, nodes, field, calendarEntries, snapshot, validateForm, validationResult };
});
