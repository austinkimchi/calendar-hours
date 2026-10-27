(function () {
  "use strict";
  const connect = document.querySelector("#connect");
  const status = document.querySelector("#status");

  function show(message, state = "") {
    status.textContent = message;
    status.dataset.state = state;
  }

  async function refresh() {
    try {
      const result = await chrome.runtime.sendMessage({ type: "CALENDAR_HOURS_API_STATUS" });
      if (result?.connected && result.calendarListAccess) {
        connect.hidden = true;
        show("Connected. Google Calendar is ready for title updates and Workday import. Choose your features in settings.", "success");
      } else if (result?.configured) {
        show(result.connected ? "Reconnect once to share your connection with Workday import." : "Connect once for Google Calendar features, or open Calendar to start using title suggestions.");
        connect.textContent = result.connected ? "Reconnect Google Calendar" : "Connect Google Calendar";
      } else {
        connect.hidden = true;
        show("Google connection is unavailable in this build. You can still use Calendar Hours without it.", "error");
      }
    } catch (error) {
      show(`Could not check the connection: ${error.message}`, "error");
    }
  }

  connect.addEventListener("click", async () => {
    connect.disabled = true;
    show("Opening Google sign-in…");
    try {
      const result = await chrome.runtime.sendMessage({ type: "CALENDAR_HOURS_API_CONNECT" });
      if (!result?.connected) throw new Error(result?.reason || "Google Calendar did not connect");
      connect.hidden = true;
      show("Connected. Google Calendar is ready for title updates and Workday import. Choose your features in settings.", "success");
    } catch (error) {
      show(`Could not connect: ${error.message}`, "error");
    } finally {
      connect.disabled = false;
    }
  });

  document.querySelector("#settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
  void refresh();
})();
