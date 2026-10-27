const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');

test('settings help is collapsed, accessible, and does not submit or change form fields', () => {
  const dom = new JSDOM(fs.readFileSync('extension/options.html', 'utf8'), {runScripts:'outside-only'});
  const { window } = dom;
  window.eval(fs.readFileSync('extension/settings-help.js', 'utf8'));
  const fields = () => [...window.document.querySelectorAll('input, select')].map(el => [el.name, el.value, el.checked]);
  const before = fields();
  let submits = 0;
  window.document.addEventListener('submit', event => { event.preventDefault(); submits++; });
  for (const button of window.document.querySelectorAll('.info-button[aria-controls]')) {
    const panel = window.document.getElementById(button.getAttribute('aria-controls'));
    assert.ok(button.getAttribute('aria-label'));
    assert.ok(panel);
    assert.equal(panel.hidden, true);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    button.click();
    assert.equal(panel.hidden, false);
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    button.click();
    assert.equal(panel.hidden, true);
    button.click();
    button.dispatchEvent(new window.KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
    assert.equal(panel.hidden, true);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
  }
  assert.equal(submits, 0);
  assert.deepEqual(fields(), before);
  dom.window.close();
});

test('hover and keyboard focus show one tooltip at a time, with Escape dismissal', async () => {
  const dom = new JSDOM(fs.readFileSync('extension/options.html', 'utf8'), {runScripts:'outside-only'});
  const { window } = dom;
  window.eval(fs.readFileSync('extension/settings-help.js', 'utf8'));
  const button = window.document.querySelector('[data-help="workday-zone-help"]');
  const control = window.document.querySelector('#workday-time-zone');
  const panel = window.document.querySelector('#workday-zone-help');
  assert.equal(button.getAttribute('aria-describedby'), panel.id);
  assert.equal(control.getAttribute('aria-describedby'), panel.id);
  assert.equal(panel.getAttribute('role'), 'tooltip');
  button.dispatchEvent(new window.MouseEvent('mouseenter'));
  assert.equal(panel.hidden, false, 'hover opens without clicking');
  button.dispatchEvent(new window.MouseEvent('mouseleave'));
  await new Promise(resolve => setTimeout(resolve, 175));
  assert.equal(panel.hidden, true);
  control.focus();
  assert.equal(panel.hidden, false, 'keyboard focus opens help');
  window.document.querySelector('#workday-phrase').focus();
  assert.equal(panel.hidden, true, 'moving focus closes previous tooltip');
  assert.equal(window.document.querySelector('#workday-phrase-help').hidden, false);
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', {key:'Escape'}));
  assert.equal(window.document.querySelector('#workday-phrase-help').hidden, true);
  dom.window.close();
});

test('label help preserves checkbox clicks, form values and keyboard navigation', () => {
  const dom = new JSDOM(fs.readFileSync('extension/options.html', 'utf8'), {runScripts:'outside-only'});
  const { window } = dom;
  window.eval(fs.readFileSync('extension/settings-help.js', 'utf8'));
  const label = window.document.querySelector('[data-help="workday-future-help"]');
  const input = label.control;
  const panel = window.document.querySelector('#workday-future-help');
  let changes = 0;
  input.addEventListener('change', () => changes++);
  label.dispatchEvent(new window.MouseEvent('mouseenter'));
  assert.equal(panel.hidden, false);
  assert.equal(input.checked, false, 'reading help does not change the setting');
  assert.equal(label.hasAttribute('tabindex'), false, 'the normal checkbox remains the focus target');
  label.click();
  assert.equal(input.checked, true);
  assert.equal(changes, 1, 'label click still toggles the checkbox exactly once');
  input.focus();
  assert.equal(panel.hidden, false);
  input.dispatchEvent(new window.KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
  assert.equal(panel.hidden, true);
  assert.equal(input.checked, true);
  assert.equal(window.document.activeElement, input, 'dismissing help keeps field focus');
  dom.window.close();
});
