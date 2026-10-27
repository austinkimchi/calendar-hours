const test = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const oauth = require("../extension/oauth.js");

test("Edge OAuth validates the registered redirect and keeps short-lived tokens local", async () => {
  let stored;
  let accessLevel;
  let authorization;
  const chrome = {
    runtime: { id: "oaainlebjpmnglnfajgnenicaeamaljo" },
    identity: {
      getRedirectURL: () => "https://oaainlebjpmnglnfajgnenicaeamaljo.chromiumapp.org/",
      launchWebAuthFlow: async ({ url, interactive }) => {
        authorization = new URL(url);
        assert.equal(interactive, true);
        return `https://oaainlebjpmnglnfajgnenicaeamaljo.chromiumapp.org/#access_token=test-access&token_type=Bearer&expires_in=3600&state=${authorization.searchParams.get("state")}`;
      }
    },
    storage: { local: {
      setAccessLevel: async value => { accessLevel = value.accessLevel; },
      get: async () => ({ calendarHoursOAuth: stored }),
      set: async value => { stored = value.calendarHoursOAuth; },
      remove: async () => { stored = undefined; }
    } }
  };
  const result = await oauth.connect(chrome, webcrypto);
  assert.equal(result.connected, true);
  assert.equal(authorization.searchParams.get("response_type"), "token");
  assert.equal(authorization.searchParams.get("client_id"), oauth.clientIdFor(chrome.runtime.id));
  assert.deepEqual(authorization.searchParams.get("scope").split(' '), ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.calendarlist.readonly"]);
  assert.equal(authorization.searchParams.get("prompt"), "select_account", "reconnection must not force repeat consent");
  assert.equal(accessLevel, "TRUSTED_CONTEXTS");
  assert.equal(stored.accessToken, "test-access");
  assert.equal(stored.refreshToken, undefined);
  assert.equal(stored.extensionId, chrome.runtime.id);
  assert.equal(await oauth.getAccessToken(chrome, webcrypto), "test-access");
});

test('shared connection retains both permissions during silent renewal', async () => {
  let saved, urls=[];
  const chrome={runtime:{id:'oaainlebjpmnglnfajgnenicaeamaljo'},storage:{local:{get:async()=>({calendarHoursOAuth:saved}),set:async v=>{saved=v.calendarHoursOAuth},setAccessLevel:async()=>{}}},identity:{getRedirectURL:()=> 'https://oaainlebjpmnglnfajgnenicaeamaljo.chromiumapp.org/',launchWebAuthFlow:async({url,interactive})=>{
    const u=new URL(url);urls.push({u,interactive});return `https://oaainlebjpmnglnfajgnenicaeamaljo.chromiumapp.org/#access_token=test&token_type=Bearer&expires_in=3600&state=${u.searchParams.get('state')}&scope=${encodeURIComponent(u.searchParams.get('scope'))}`;
  }}};
  await oauth.connect(chrome,webcrypto);
  assert.ok(urls[0].u.searchParams.get('scope').includes('calendar.calendarlist.readonly'));
  assert.equal((await oauth.status(chrome)).calendarListAccess,true);
  await oauth.getAccessToken(chrome,webcrypto);
  await oauth.getAccessToken(chrome,webcrypto);
  assert.equal(urls.length,1,'features reuse the shared token without another consent flow');
  saved.expiresAt=0;assert.equal(await oauth.getAccessToken(chrome,webcrypto),'test');
  assert.equal(urls[1].interactive,false);assert.equal(urls[1].u.searchParams.get('scope'),urls[0].u.searchParams.get('scope'));
});

function sharedHarness(initial) {
 let saved=initial, grant, release;
 const launches=[];
 const chrome={runtime:{id:'oaainlebjpmnglnfajgnenicaeamaljo'},storage:{local:{get:async()=>({calendarHoursOAuth:saved}),set:async v=>{saved=v.calendarHoursOAuth},setAccessLevel:async()=>{}}},identity:{
  getRedirectURL:()=> 'https://oaainlebjpmnglnfajgnenicaeamaljo.chromiumapp.org/',
  launchWebAuthFlow:async({url,interactive})=>{
   const u=new URL(url);launches.push({u,interactive});
   if(release) await release;
   return `https://oaainlebjpmnglnfajgnenicaeamaljo.chromiumapp.org/#access_token=shared&token_type=Bearer&expires_in=3600&state=${u.searchParams.get('state')}&scope=${encodeURIComponent(grant||u.searchParams.get('scope'))}`;
  }
 }};
 return {chrome,launches,get saved(){return saved},set grant(v){grant=v},set hold(v){release=v}};
}
test('simultaneous connection requests share a single authorization window',async()=>{
 const h=sharedHarness();let finish;h.hold=new Promise(resolve=>{finish=resolve});
 const first=oauth.connect(h.chrome,webcrypto),second=oauth.connect(h.chrome,webcrypto);
 assert.equal(h.launches.length,1);finish();
 assert.equal((await first).connected,true);assert.equal((await second).connected,true);
 assert.equal(h.launches.length,1);
});
test('partial consent does not replace a working shared connection and can be retried',async()=>{
 const previous={accessToken:'previous',extensionId:'oaainlebjpmnglnfajgnenicaeamaljo',expiresAt:Date.now()+60000,scopes:['https://www.googleapis.com/auth/calendar.events']};
 const h=sharedHarness(previous);h.grant='https://www.googleapis.com/auth/calendar.events';
 await assert.rejects(oauth.connect(h.chrome,webcrypto),/did not grant all requested/);
 assert.equal(h.saved,previous);
 h.grant=null;assert.equal((await oauth.connect(h.chrome,webcrypto)).connected,true);
 assert.equal((await oauth.status(h.chrome)).calendarListAccess,true);
});
test('legacy event-only connections upgrade only after an explicit shared connect',async()=>{
 const h=sharedHarness({accessToken:'legacy',extensionId:'oaainlebjpmnglnfajgnenicaeamaljo',expiresAt:Date.now()+60000,scopes:['https://www.googleapis.com/auth/calendar.events']});
 assert.equal((await oauth.status(h.chrome)).calendarListAccess,false);
 assert.equal(await oauth.getAccessToken(h.chrome,webcrypto),'legacy');assert.equal(h.launches.length,0);
 await oauth.connect(h.chrome,webcrypto);
 assert.equal(h.launches.length,1);assert.equal((await oauth.status(h.chrome)).calendarListAccess,true);
});
