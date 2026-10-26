document.querySelector("#apply").addEventListener("click", async () => {
  const status = document.querySelector("#status");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Open a Google Calendar event first.");
    const result = await chrome.tabs.sendMessage(tab.id, { type: "CALENDAR_HOURS_APPLY", reason: "popup" });
    status.textContent = result.message;
  } catch {
    status.textContent = "Open a Google Calendar event first.";
  }
});
document.querySelector("#options").addEventListener("click", () => chrome.runtime.openOptionsPage());
chrome.storage.sync.get("keyword").then(({ keyword }) => {
  if (keyword) document.querySelector("kbd").textContent = keyword;
});
