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
