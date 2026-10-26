const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const extension = path.join(__dirname, "..", "extension");
const html = fs.readFileSync(path.join(extension, "options.html"), "utf8");
const core = fs.readFileSync(path.join(extension, "core.js"), "utf8");
const options = fs.readFileSync(path.join(extension, "options.js"), "utf8");
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test("settings migrate phrases into rows and save each Dynamic choice", async () => {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://example.test/options.html" });
  const { window } = dom;
  let saved;
  let removed;
  window.chrome = {
    storage: { sync: {
      get: async () => ({ autoWords: "SCU Block, Study session", keepUpdated: true, automatic: true }),
      set: async value => { saved = value; },
      remove: async keys => { removed = keys; }
    } }
  };
  window.eval(core);
  window.eval(options);
  await settle();

  assert.deepEqual([...window.document.querySelectorAll("section h2")].map(node => node.textContent), ["General", "Hours", "Other"]);
  const rows = window.document.querySelectorAll(".rule-row");
  assert.deepEqual([...rows].map(row => row.querySelector(".rule-phrase").value), ["SCU Block", "Study session"]);
  assert.equal(rows[0].querySelector(".rule-dynamic input").checked, true);
  assert.equal(rows[1].querySelector(".rule-dynamic input").checked, true);
  assert.equal(window.document.querySelector('#settings [name="replaceExisting"]').disabled, true);

  const helpButton = window.document.querySelector("#dynamic-help-button");
  helpButton.click();
  assert.equal(helpButton.getAttribute("aria-expanded"), "true");
  assert.equal(window.document.querySelector("#dynamic-help").hidden, false);

  rows[1].querySelector(".rule-dynamic input").click();
  window.document.querySelector("#add-rule").click();
  const added = window.document.querySelectorAll(".rule-row")[2];
  added.querySelector(".rule-phrase").value = "Work block";
  added.querySelector(".rule-phrase").dispatchEvent(new window.Event("input", { bubbles: true }));
  window.document.querySelector("#settings").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();

  assert.deepEqual(JSON.parse(JSON.stringify(saved.matchingPhrases)), [
    { phrase: "SCU Block", dynamic: true },
    { phrase: "Study session", dynamic: false },
    { phrase: "Work block", dynamic: false }
  ]);
  assert.equal(saved.automatic, true);
  assert.deepEqual(Array.from(removed), ["autoWords", "keepUpdated"]);
  assert.equal(window.document.querySelector("#status").textContent, "Saved");
  dom.window.close();
});
