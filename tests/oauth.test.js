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
  assert.equal(authorization.searchParams.get("scope"), "https://www.googleapis.com/auth/calendar.events");
  assert.equal(accessLevel, "TRUSTED_CONTEXTS");
  assert.equal(stored.accessToken, "test-access");
  assert.equal(stored.refreshToken, undefined);
  assert.equal(stored.extensionId, chrome.runtime.id);
  assert.equal(await oauth.getAccessToken(chrome, webcrypto), "test-access");
});
