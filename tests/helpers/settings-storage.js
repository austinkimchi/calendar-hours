// Simulated browser storage boundary, including remote delivery and rejected writes.
module.exports = function settingsStorage(initial = {}) {
  const data = structuredClone(initial), writes = [], listeners = new Set();
  let failure = null;
  function receive(patch, area = "sync") {
    const changes = {};
    for (const [key, value] of Object.entries(patch)) {
      changes[key] = { oldValue: data[key] };
      if (value !== undefined) changes[key].newValue = structuredClone(value);
      if (area === "sync") {
        if (value === undefined) delete data[key];
        else data[key] = structuredClone(value);
      }
    }
    for (const listener of listeners) listener(changes, area);
  }
  const storage = {
    onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) },
    sync: {
      get: async () => structuredClone(data),
      set: async patch => {
        if (failure) throw failure;
        writes.push(structuredClone(patch));
        receive(patch);
      },
      remove: async keys => receive(Object.fromEntries(keys.map(key => [key, undefined])))
    }
  };
  return { storage, data, writes, receive, fail: error => { failure = error; } };
};
