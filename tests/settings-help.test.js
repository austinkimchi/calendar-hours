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
  const button = window.document.querySelector('[aria-controls="workday-zone-help"]');
  const panel = window.document.querySelector('#workday-zone-help');
  assert.equal(button.getAttribute('aria-describedby'), panel.id);
  assert.equal(panel.getAttribute('role'), 'tooltip');
  button.dispatchEvent(new window.MouseEvent('mouseenter'));
  assert.equal(panel.hidden, false, 'hover opens without clicking');
  button.dispatchEvent(new window.MouseEvent('mouseleave'));
  await new Promise(resolve => setTimeout(resolve, 175));
  assert.equal(panel.hidden, true);
  button.focus();
  assert.equal(panel.hidden, false, 'keyboard focus opens help');
  window.document.querySelector('[aria-controls="workday-phrase-help"]').focus();
  assert.equal(panel.hidden, true, 'moving focus closes previous tooltip');
  assert.equal(window.document.querySelector('#workday-phrase-help').hidden, false);
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', {key:'Escape'}));
  assert.equal(window.document.querySelector('#workday-phrase-help').hidden, true);
  dom.window.close();
});
