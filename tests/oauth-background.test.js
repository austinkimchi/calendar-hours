const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const extensionId = 'gkhggalcelmdidfdnllmdpaaapjiegig';
const scopes = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.calendarlist.readonly'];
const settingsSender = { url: `chrome-extension://${extensionId}/options.html` };
const workdaySender = { url: 'https://www.myworkday.com/example/enter-time', tab: { id: 1 } };
const now = Date.parse('2026-11-19T12:00:00Z');
const grant = expiresAt => ({ accessToken: 'test-old', extensionId, scopes, expiresAt });

function worker({ saved = grant(0), rejectOld = false, rejectAll = false, quota = false, loginRequired = false } = {}) {
  const state = { saved, now, flows: [], requests: [], created: [], writes: [], generation: 0 };
  let listener;
  const chrome = {
    runtime: { id: extensionId, getURL: p => `chrome-extension://${extensionId}/${p}`,
      onInstalled: { addListener() {} }, onMessage: { addListener(fn) { listener = fn; } } },
    commands: { onCommand: { addListener() {} } },
    tabs: { create: async options => { state.created.push(options); throw new Error('Unexpected editor tab'); } },
    storage: {
      local: { setAccessLevel: async () => {}, get: async () => ({ calendarHoursOAuth: structuredClone(state.saved) }),
        set: async value => { state.saved = structuredClone(value.calendarHoursOAuth); }, remove: async () => { state.saved = null; } },
      sync: { get: async () => ({ apiSync: true, matchingPhrases: [{ phrase: 'Work', dynamic: true }],
        workdayIntegration: { enabled: true, calendarId: 'work@example.test', keyword: 'Work', timeZone: 'UTC' } }) }
    },
    identity: {
      getRedirectURL: () => `https://${extensionId}.chromiumapp.org/`,
      launchWebAuthFlow: async details => {
        state.flows.push(details);
        assert.equal(details.interactive, false, 'API use never opens interactive authorization');
        if (details.abortOnLoadForNonInteractive !== false) throw new Error('User interaction required.');
        assert.ok(details.timeoutMsForNonInteractive >= 10000);
        await new Promise(resolve => setImmediate(resolve));
        const requested = new URL(details.url);
        const result = new URL(`https://${extensionId}.chromiumapp.org/`);
        result.hash = new URLSearchParams({ state: requested.searchParams.get('state'), ...(loginRequired
          ? { error: 'login_required' }
          : { access_token: `test-new-${++state.generation}`, token_type: 'Bearer', expires_in: '3600', scope: scopes.join(' ') }) });
        return result.href;
      }
    }
  };
  const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
  const fetch = async (url, options = {}) => {
    const parsed = new URL(url), token = options.headers?.Authorization;
    state.requests.push({ path: parsed.pathname, method: options.method || 'GET', token });
    if (rejectAll || (rejectOld && token === 'Bearer test-old')) return response(401, {});
    if (quota) return response(403, { error: { errors: [{ reason: 'rateLimitExceeded' }] } });
    if (parsed.pathname.endsWith('/calendarList')) return response(200, { items: [{ id: 'owner@example.test', summary: 'Primary', primary: true }] });
    if (parsed.pathname.endsWith('/events')) return response(200, { items: [{ summary: 'Work', start: { dateTime: '2026-11-19T09:00:00Z' }, end: { dateTime: '2026-11-19T10:00:00Z' } }] });
    if (parsed.pathname.endsWith('/events/event1')) {
      if (options.method === 'PATCH') {
        assert.equal(options.headers['If-Match'], 'version1');
        const body = JSON.parse(options.body); state.writes.push(body);
        return response(200, body);
      }
      return response(200, { summary: 'Work (1 hour)', etag: 'version1', start: { dateTime: '2026-11-19T09:00:00Z' }, end: { dateTime: '2026-11-19T11:00:00Z' } });
    }
    throw new Error(`Unexpected path ${parsed.pathname}`);
  };
  function restart() {
    const context = vm.createContext({ chrome, URL, URLSearchParams, crypto: webcrypto, Uint8Array, btoa, atob, setTimeout, clearTimeout, fetch,
      Date: class extends Date { static now() { return state.now; } }, console: { warn() {} } });
    context.importScripts = (...files) => files.forEach(file => vm.runInContext(fs.readFileSync(path.join(__dirname, '../extension', file), 'utf8'), context));
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../extension/background.js'), 'utf8'), context);
  }
  restart();
  return { state, restart, send: (type, sender = settingsSender, extra = {}) => new Promise(resolve => listener({ type, ...extra }, sender, resolve)) };
}

test('real background/OAuth/API flow renews after inactivity and a worker restart without reconnection', async () => {
  const h = worker();
  const first = await h.send('CALENDAR_HOURS_WORKDAY_CALENDARS');
  assert.equal(first.ok, true);
  assert.equal(h.state.flows.length, 1);
  assert.equal(h.state.saved.loginHint, 'owner@example.test');
  h.state.now += 2 * 3600000;
  h.restart();
  const events = await h.send('CALENDAR_HOURS_WORKDAY_EVENTS', workdaySender, { dates: ['2026-11-19'] });
  assert.equal(events.ok, true);
  assert.equal(h.state.flows.length, 2);
  assert.equal(new URL(h.state.flows[1].url).searchParams.get('login_hint'), 'owner@example.test');
  assert.equal(JSON.stringify(events).includes('test-new-'), false, 'tokens never reach the content script');
  assert.equal(h.state.writes.length, 0);
});

test('a server-rejected cached token silently renews and completes a grid save with no editor tab', async () => {
  const h = worker({ saved: grant(now + 3600000), rejectOld: true });
  const result = await h.send('CALENDAR_HOURS_GRID_SYNC', { url: 'https://calendar.google.com/calendar/u/0/r/week', tab: { id: 2 } },
    { id: btoa('event1 work@example.test'), title: 'Work (1 hour)', startIso: '2026-11-19T09:00:00Z', endIso: '2026-11-19T11:00:00Z' });
  assert.equal(result.ok, true);
  assert.equal(result.nextTitle, 'Work (2 hours)');
  assert.equal(h.state.flows.length, 1);
  assert.deepEqual(h.state.writes, [{ summary: 'Work (2 hours)' }]);
  assert.equal(h.state.created.length, 0);
});

test('concurrent Calendar reads share renewal and never return partially fetched events', async () => {
  const h = worker({ saved: grant(now + 3600000), rejectOld: true });
  const results = await Promise.all([h.send('CALENDAR_HOURS_WORKDAY_CALENDARS'),
    h.send('CALENDAR_HOURS_WORKDAY_EVENTS', workdaySender, { dates: ['2026-11-19'] })]);
  assert.equal(results.every(result => result.ok), true);
  assert.equal(h.state.flows.length, 1);
  assert.equal(h.state.requests.filter(request => request.token === 'Bearer test-old').length, 2);
});

test('persistent 401 retries once, while quota errors do not ask for reconnect', async () => {
  const h = worker({ saved: grant(now + 3600000), rejectAll: true });
  const denied = await h.send('CALENDAR_HOURS_WORKDAY_CALENDARS');
  assert.equal(denied.needsReconnect, true);
  assert.equal(h.state.flows.length, 1);
  assert.equal(h.state.requests.length, 2);
  const limited = worker({ saved: grant(now + 3600000), quota: true });
  const result = await limited.send('CALENDAR_HOURS_WORKDAY_CALENDARS');
  assert.equal(result.ok, false);
  assert.equal(result.needsSetup, false);
  assert.equal(result.needsReconnect, false);
  assert.equal(limited.state.flows.length, 0);
});

test('Check connection exercises silent renewal and a live-style API read without event changes', async () => {
  const h = worker({ saved: grant(now + 3600000) });
  const result = await h.send('CALENDAR_HOURS_API_CHECK');
  assert.equal(result.ok, true);
  assert.equal(result.connected, true);
  assert.equal(h.state.flows.length, 1);
  assert.equal(h.state.requests.length, 1);
  assert.equal(h.state.writes.length, 0);
  assert.equal(h.state.created.length, 0);
  assert.equal((await h.send('CALENDAR_HOURS_API_CHECK', workdaySender)).ok, false, 'only trusted settings can run the check');
});

test('an expired Google login requires explicit reconnection but never opens a popup automatically', async () => {
  const h = worker({ loginRequired: true });
  const result = await h.send('CALENDAR_HOURS_WORKDAY_CALENDARS');
  assert.equal(result.ok, false);
  assert.equal(result.needsReconnect, true);
  assert.equal(h.state.flows.length, 1);
  assert.equal(h.state.flows[0].interactive, false);
  assert.equal(h.state.saved.accessToken, 'test-old');
});
