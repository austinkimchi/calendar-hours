if (typeof importScripts === "function") importScripts("core.js", "api-sync.js", "oauth.js");

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason !== "install") return;
  chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") }).catch(error => {
    console.warn("Calendar Hours could not open its welcome page:", error);
  });
});

chrome.commands.onCommand.addListener(async command => {
  if (command !== "insert-hours") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "CALENDAR_HOURS_APPLY", reason: "shortcut" });
  } catch {
    // The content script runs only on Google Calendar.
  }
});

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function sendWhenReady(tabId, message, timeout = 12000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, message);
      if (response) return response;
    } catch {
      // Calendar has not injected the content script into the new tab yet.
    }
    await pause(150);
  }
  throw new Error("The background Calendar tab did not become ready");
}

function validGridRequest(message, sender) {
  return !!sender.tab?.id && !!sender.url && /^https:\/\/calendar\.google\.com\/calendar\//.test(sender.url)
    && typeof message.id === "string" && message.id.length <= 500
    && /^[A-Za-z0-9+/_-]+=*$/.test(message.id)
    && typeof message.title === "string" && message.title.length <= 1000;
}

async function syncGridEventViaEditor(message, sender) {
  const account = /^\/calendar\/u\/(\d+)\//.exec(new URL(sender.url).pathname)?.[1] || "0";
  const editorUrl = `https://calendar.google.com/calendar/u/${account}/r/eventedit/${encodeURIComponent(message.id)}`;
  const tab = await chrome.tabs.create({ url: editorUrl, active: false, windowId: sender.tab.windowId });
  try {
    let result;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt) { await chrome.tabs.reload(tab.id); await pause(400); }
      result = await sendWhenReady(tab.id, {
        type: "CALENDAR_HOURS_BACKGROUND_SYNC",
        id: message.id,
        title: message.title,
        startTime: message.startTime,
        endTime: message.endTime
      });
      if (!result.retry) break;
    }
    if (!result.ok) return result;
    await chrome.tabs.update(tab.id, { url: editorUrl });
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) { await chrome.tabs.reload(tab.id); await pause(400); }
      const verified = await sendWhenReady(tab.id, {
        type: "CALENDAR_HOURS_BACKGROUND_VERIFY", id: message.id, title: result.nextTitle
      });
      if (verified.ok) return { ok: true, nextTitle: result.nextTitle };
    }
    return { ok: false, reason: "Calendar did not confirm the new title" };
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function syncGridEvent(message, sender) {
  if (!validGridRequest(message, sender)) return { ok: false, reason: "invalid request" };
  const settings = globalThis.CalendarHoursCore?.settingsFrom(await chrome.storage.sync.get(null));
  if (settings && !globalThis.CalendarHoursCore.shouldUpdateDuration(message.title, settings)) {
    return { ok: false, reason: "Automatic updates are off for this title" };
  }
  if (settings?.apiSync && message.startIso && message.endIso) {
    try {
      const accessToken = await globalThis.CalendarHoursOAuth.getAccessToken();
      if (accessToken) {
        const result = await globalThis.CalendarHoursApiSync.syncTitle({
          gridId: message.id, title: message.title, startIso: message.startIso,
          endIso: message.endIso, settings, accessToken,
          core: globalThis.CalendarHoursCore
        });
        if (result.ok) return result;
        console.warn("Calendar Hours API save unavailable; trying the Calendar editor:", result.reason);
      }
    } catch (error) {
      console.warn("Calendar Hours API save unavailable; trying the Calendar editor:", error);
    }
  }
  return syncGridEventViaEditor(message, sender);
}

async function connectCalendar() {
  const result = await globalThis.CalendarHoursOAuth.connect();
  if (result.connected) await chrome.storage.sync.set({ apiSync: true });
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const handlers = {
    CALENDAR_HOURS_GRID_SYNC: () => syncGridEvent(message, sender),
    CALENDAR_HOURS_API_STATUS: () => globalThis.CalendarHoursOAuth.status(),
    CALENDAR_HOURS_API_CONNECT: connectCalendar,
    CALENDAR_HOURS_API_DISCONNECT: () => globalThis.CalendarHoursOAuth.disconnect()
  };
  const handle = handlers[message?.type];
  if (!handle) return;
  const trustedPages = ["options.html", "welcome.html"].map(page => chrome.runtime.getURL(page));
  if (message.type !== "CALENDAR_HOURS_GRID_SYNC" &&
      !trustedPages.includes(sender.url)) {
    respond({ ok: false, reason: "Open Calendar Hours settings or its welcome page to manage this connection" });
    return;
  }
  Promise.resolve().then(handle).then(respond, error => {
    console.warn("Calendar Hours background update failed:", error);
    respond({ ok: false, reason: error.message });
  });
  return true;
});
