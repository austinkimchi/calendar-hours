const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync(path.join(__dirname, "..", "extension", "welcome.html"), "utf8");
const script = fs.readFileSync(path.join(__dirname, "..", "extension", "welcome.js"), "utf8");
const settle = () => new Promise(resolve => setImmediate(resolve));

test("welcome page connects on request and keeps Calendar available if connection fails", async () => {
  for (const succeeds of [true, false]) {
    const dom = new JSDOM(html, { runScripts: "outside-only", url: "chrome-extension://example/welcome.html" });
    const { window } = dom;
    const messages = [];
    window.chrome = { runtime: {
      sendMessage: async message => {
        messages.push(message.type);
        if (message.type === "CALENDAR_HOURS_API_STATUS") return { configured: true, connected: false };
        return succeeds ? { connected: true } : { connected: false, reason: "Sign-in cancelled" };
      },
      openOptionsPage() {}
    } };
    window.eval(script);
    await settle();
    const connect = window.document.querySelector("#connect");
    assert.equal(connect.hidden, false);
    connect.click();
    await settle();
    assert.deepEqual(messages, ["CALENDAR_HOURS_API_STATUS", "CALENDAR_HOURS_API_CONNECT"]);
    assert.equal(connect.hidden, succeeds);
    assert.equal(connect.disabled, false);
    assert.match(window.document.querySelector("#status").textContent,
      succeeds ? /Connected.*ready/ : /Could not connect.*Sign-in cancelled/);
    assert.match(window.document.querySelector("#open-calendar").href, /^https:\/\/calendar\.google\.com\//);
    dom.window.close();
  }
});
