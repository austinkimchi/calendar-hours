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

  assert.deepEqual([...window.document.querySelectorAll("section h2")].map(node => node.textContent), ["General", "Hours", "Other", "Workday calendar import Developer preview"]);
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
  assert.equal(saved.minutesTemplate, undefined, "minutes should inherit the latest hours template until first enabled");
  assert.deepEqual(Array.from(removed), ["autoWords", "keepUpdated"]);
  assert.equal(window.document.querySelector("#status").textContent, "Saved");

  window.document.querySelectorAll(".rule-dynamic input")[0].click();
  assert.equal(window.document.querySelector('[name="replaceExisting"]').disabled, true);
  window.document.querySelector("#settings").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  assert.equal(saved.updateExistingHours, true);
  assert.equal(saved.replaceExisting, true);
  dom.window.close();
});

test("first-time options enable both defaults while saved off choices stay off", async () => {
  for (const [saved, expected] of [[{}, true], [{ automatic: false, updateExistingHours: false }, false]]) {
    const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://example.test/options.html" });
    const { window } = dom;
    window.chrome = { storage: { sync: { get: async () => saved, set: async () => {}, remove: async () => {} } } };
    window.eval(core);
    window.eval(options);
    await settle();
    assert.equal(window.document.querySelector('[name="automatic"]').checked, expected);
    assert.equal(window.document.querySelector('[name="updateExistingHours"]').checked, expected);
    dom.window.close();
  }
});

test("turning on minutes below an hour saves the setting without an extra Save click", async () => {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://example.test/options.html" });
  const { window } = dom;
  let saved;
  window.chrome = { storage: { sync: {
    get: async () => ({}),
    set: async value => { saved = value; },
    remove: async () => {}
  } } };
  window.eval(core);
  window.eval(options);
  await settle();
  window.document.querySelector('[name="minutesBelowHour"]').click();
  await settle();
  assert.equal(saved.minutesBelowHour, true);
  assert.equal(saved.minutesTemplate, "({value} {unit})");
  assert.equal(window.document.querySelector("#status").textContent, "Saved");
  dom.window.close();
});

test("the locked replacement setting explains which update option requires it", async () => {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://example.test/options.html" });
  const { window } = dom;
  window.chrome = { storage: { sync: {
    get: async () => ({ matchingPhrases: [{ phrase: "Work block", dynamic: true }], updateExistingHours: false }),
    set: async () => {}, remove: async () => {}
  } } };
  window.eval(core);
  window.eval(options);
  await settle();

  const field = window.document.querySelector('[name="replaceExisting"]');
  const icon = window.document.querySelector("#replace-help-button");
  const help = window.document.querySelector("#replace-help");
  assert.equal(field.disabled, true);
  assert.equal(icon.hidden, false);
  icon.click();
  assert.equal(icon.getAttribute("aria-expanded"), "true");
  assert.match(help.textContent, /Dynamic needs to replace/);

  window.document.querySelector(".rule-dynamic input").click();
  assert.equal(field.disabled, false);
  assert.equal(icon.hidden, true);
  assert.equal(help.hidden, true);
  assert.equal(icon.getAttribute("aria-expanded"), "false");

  window.document.querySelector('[name="updateExistingHours"]').click();
  assert.equal(field.disabled, true);
  assert.equal(icon.hidden, false);
  icon.click();
  assert.match(help.textContent, /Automatic time-change updates need to replace/);
  dom.window.close();
});

test("enabling minutes starts with the current hours template and keeps later customization", async () => {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "https://example.test/options.html" });
  const { window } = dom;
  let saved;
  window.chrome = { storage: { sync: {
    get: async () => ({ template: "— {value} {unit}", unit: "hrs" }),
    set: async value => { saved = value; },
    remove: async () => {}
  } } };
  window.eval(core);
  window.eval(options);
  await settle();

  const field = name => window.document.querySelector(`[name="${name}"]`);
  assert.equal(field("singularUnit").value, "hr");
  assert.equal(window.document.querySelector("#minutes-format").hidden, true);
  field("template").value = "[{value} {unit}]";
  field("template").dispatchEvent(new window.Event("input", { bubbles: true }));
  field("minutesBelowHour").click();
  assert.equal(window.document.querySelector("#minutes-format").hidden, false);
  assert.equal(field("minutesTemplate").value, "[{value} {unit}]");
  assert.equal(window.document.querySelector("#short-preview").textContent, "Work session [45 minutes]");
  assert.equal(window.document.querySelector("#singular-preview").textContent, "Work session [1 hr]");

  field("minutesUnit").value = "mins";
  field("minutesUnit").dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(field("minutesSingularUnit").value, "min");
  field("minutesTemplate").value = "~ {value} {unit}";
  field("minutesTemplate").dispatchEvent(new window.Event("input", { bubbles: true }));
  field("minutesBelowHour").click();
  field("minutesBelowHour").click();
  assert.equal(field("minutesTemplate").value, "~ {value} {unit}");
  field("displayUnit").value = "minutes";
  field("displayUnit").dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(window.document.querySelector("#below-hour-option").hidden, true);
  assert.equal(window.document.querySelector("#hours-format").hidden, true);
  assert.equal(window.document.querySelector("#preview").textContent, "Work session ~ 190 mins");
  window.document.querySelector("#settings").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  assert.equal(saved.displayUnit, "minutes");
  assert.equal(saved.minutesTemplate, "~ {value} {unit}");
  assert.equal(saved.minutesSingularUnit, "min");
  dom.window.close();
});
