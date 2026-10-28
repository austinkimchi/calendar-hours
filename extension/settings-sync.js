/* Browser-managed settings sync. Only edited fields are written; credentials never enter this store. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CalendarHoursSettingsSync = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function create({ storage, read, encode = value => value, onUpdate = () => {} }) {
    let data = {}, initialized = false, revision = 0, eventRevision = 0;
    let queue = Promise.resolve();
    const dirty = new Map(), writing = new Set(), events = new Map();
    const dirtyKeys = () => new Set(dirty.keys());
    const values = () => ({ ...read(data), ...Object.fromEntries([...dirty].map(([key, edit]) => [key, edit.value])) });
    const notify = reason => onUpdate(values(), { reason, dirty: dirtyKeys() });

    function changed(changes, area) {
      if (area !== "sync") return;
      const before = read(data);
      for (const [key, change] of Object.entries(changes)) {
        events.set(key, { revision: ++eventRevision, change });
        if (Object.hasOwn(change, "newValue")) data[key] = change.newValue;
        else delete data[key];
      }
      if (initialized && !equal(before, read(data))) notify("incoming");
    }
    storage.onChanged.addListener(changed);

    async function load() {
      const start = eventRevision;
      const loaded = await storage.sync.get(null);
      // An incoming change can arrive while the initial read is in flight.
      for (const [key, event] of events) {
        if (event.revision <= start) continue;
        if (Object.hasOwn(event.change, "newValue")) loaded[key] = event.change.newValue;
        else delete loaded[key];
      }
      data = loaded;
      initialized = true;
      notify("loaded");
    }

    function edit(patch, { force = false } = {}) {
      if (!initialized) return;
      const saved = read(data);
      for (const [key, value] of Object.entries(patch)) {
        if (!force && equal(value, saved[key]) && !writing.has(key)) dirty.delete(key);
        else if (!dirty.has(key) || !equal(value, dirty.get(key).value)) dirty.set(key, { value, revision: ++revision });
      }
    }

    function save(normalized) {
      if (!initialized) return Promise.reject(new Error("Settings are still loading. Reload this page if loading failed."));
      const snapshot = new Map(dirty);
      queue = queue.catch(() => {}).then(async () => {
        const edits = [...snapshot].filter(([key, edit]) => dirty.get(key)?.revision === edit.revision);
        if (!edits.length) return;
        const patch = encode(Object.fromEntries(edits.map(([key]) => [key, normalized[key]])));
        const start = eventRevision;
        for (const [key] of edits) writing.add(key);
        try {
          await storage.sync.set(patch);
          // Some consumers emit onChanged before set resolves, others after it.
          // Never replace a more recent incoming value with the completed write.
          for (const [key, value] of Object.entries(patch)) {
            if ((events.get(key)?.revision || 0) <= start) data[key] = value;
          }
          for (const [key, edit] of edits) {
            if (dirty.get(key)?.revision === edit.revision) dirty.delete(key);
          }
          notify("saved");
        } finally {
          for (const [key] of edits) writing.delete(key);
        }
      });
      return queue;
    }

    return { load, edit, save, values, dirtyKeys, raw: () => ({ ...data }),
      dispose: () => storage.onChanged.removeListener(changed) };
  }
  return { create, equal };
});
