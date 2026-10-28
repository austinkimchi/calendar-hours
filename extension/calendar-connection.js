/* One Google connection shared by every Calendar feature. */
(function () {
  "use strict";
  const status = document.querySelector("#api-status");
  const connect = document.querySelector("#connect-api");
  const disconnect = document.querySelector("#disconnect-api");
  let needsReconnect = false;

  async function refresh() {
    const result = await chrome.runtime.sendMessage({ type: "CALENDAR_HOURS_API_STATUS" });
    if (result?.ok === false) throw new Error(result.reason || "Connection status unavailable");
    connect.hidden = !result.configured;
    disconnect.hidden = !result.connected;
    connect.textContent = result.connected ? "Reconnect Google Calendar" : "Connect Google Calendar";
    status.textContent = !result.configured ? "Google connection is unavailable in this build."
      : needsReconnect ? "Reconnect Google Calendar to restore access."
      : result.connected && result.calendarListAccess ? "Connected."
      : result.connected ? "Connected for title updates. Reconnect once to allow calendar selection for Workday."
      : "Not connected.";
  }

  async function change(type) {
    connect.disabled = disconnect.disabled = true;
    status.textContent = type === "CALENDAR_HOURS_API_CONNECT" ? "Connecting…" : "Disconnecting…";
    try {
      const result = await chrome.runtime.sendMessage({ type });
      if (result?.ok === false || (type === "CALENDAR_HOURS_API_CONNECT" && !result?.connected)) {
        throw new Error(result?.reason || "Google Calendar did not connect");
      }
      needsReconnect = false;
      await refresh();
      document.dispatchEvent(new CustomEvent("calendar-hours-connection-changed"));
    } catch (error) {
      status.textContent = `Could not ${type === "CALENDAR_HOURS_API_CONNECT" ? "connect" : "disconnect"}: ${error.message}`;
    } finally {
      connect.disabled = disconnect.disabled = false;
    }
  }

  connect.addEventListener("click", () => { void change("CALENDAR_HOURS_API_CONNECT"); });
  disconnect.addEventListener("click", () => { void change("CALENDAR_HOURS_API_DISCONNECT"); });
  document.addEventListener("calendar-hours-connection-required", () => {
    needsReconnect = true;
    status.textContent = "Connect or reconnect Google Calendar to allow calendar selection for Workday.";
  });
  void refresh().catch(error => { status.textContent = `Connection status unavailable: ${error.message}`; });
})();
