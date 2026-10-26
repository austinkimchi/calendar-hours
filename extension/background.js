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

async function syncGridEvent(message, sender) {
  if (!sender.tab?.id || !sender.url || !/^https:\/\/calendar\.google\.com\/calendar\//.test(sender.url)
      || !/^[A-Za-z0-9_-]+=*$/.test(message.id || "")) {
    return { ok: false, reason: "invalid request" };
  }
  const account = /^\/calendar\/u\/(\d+)\//.exec(new URL(sender.url).pathname)?.[1] || "0";
  const editorUrl = `https://calendar.google.com/calendar/u/${account}/r/eventedit/${encodeURIComponent(message.id)}`;
  const tab = await chrome.tabs.create({ url: editorUrl, active: false, windowId: sender.tab.windowId });
  try {
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt) { await pause(400); await chrome.tabs.reload(tab.id); }
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
      if (attempt) { await pause(400); await chrome.tabs.reload(tab.id); }
      const verified = await sendWhenReady(tab.id, {
        type: "CALENDAR_HOURS_BACKGROUND_VERIFY", title: result.nextTitle
      });
      if (verified.ok) return { ok: true, nextTitle: result.nextTitle };
    }
    return { ok: false, reason: "Calendar did not confirm the new title" };
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "CALENDAR_HOURS_GRID_SYNC") return;
  syncGridEvent(message, sender).then(respond, error => {
    console.warn("Calendar Hours background update failed:", error);
    respond({ ok: false, reason: error.message });
  });
  return true;
});
