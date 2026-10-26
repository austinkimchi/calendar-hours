/* Google browser authorization for Edge and Chrome. The client ID is public. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CalendarHoursOAuth = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const webClientId = "691162168255-nuojmmf7ojqfkmlc2617qa9n03pudqi3.apps.googleusercontent.com";
  const extensionIds = new Set([
    "oaainlebjpmnglnfajgnenicaeamaljo", // Edge unpacked build
    "gkhggalcelmdidfdnllmdpaaapjiegig"  // Chrome Web Store item
  ]);
  const scope = "https://www.googleapis.com/auth/calendar.events";
  const storageKey = "calendarHoursOAuth";
  let accessLevelReady;
  let renewalInFlight;

  function clientIdFor(extensionId) { return extensionIds.has(extensionId) ? webClientId : null; }

  function randomState(cryptoApi = crypto) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(24));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function authorizationUrl({ clientId, redirectUri, state, interactive }) {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: clientId, redirect_uri: redirectUri, response_type: "token", scope,
      state, prompt: interactive ? "consent select_account" : "none"
    }).toString();
    return url.href;
  }

  async function trustedStorage(chromeApi = chrome) {
    if (!accessLevelReady) {
      accessLevelReady = typeof chromeApi.storage.local.setAccessLevel === "function"
        ? chromeApi.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
        : Promise.resolve();
    }
    await accessLevelReady;
  }

  async function stored(chromeApi = chrome) {
    await trustedStorage(chromeApi);
    return (await chromeApi.storage.local.get(storageKey))[storageKey] || null;
  }

  async function authorize(chromeApi = chrome, cryptoApi = crypto, interactive = true) {
    const clientId = clientIdFor(chromeApi.runtime.id);
    if (!clientId) throw new Error("This extension ID has no Calendar Hours OAuth client");
    const redirectUri = chromeApi.identity.getRedirectURL();
    const state = randomState(cryptoApi);
    const url = authorizationUrl({ clientId, redirectUri, state, interactive });
    const responseUrl = await chromeApi.identity.launchWebAuthFlow({ url, interactive });
    if (!responseUrl) throw new Error("Google sign-in was cancelled");
    const response = new URL(responseUrl);
    const values = new URLSearchParams(response.hash.slice(1));
    if (response.origin !== new URL(redirectUri).origin || response.pathname !== new URL(redirectUri).pathname ||
        values.get("state") !== state) throw new Error("Google sign-in response did not match this request");
    if (values.get("error")) throw new Error(`Google sign-in did not grant access (${values.get("error")})`);
    const accessToken = values.get("access_token");
    const expiresIn = Number(values.get("expires_in"));
    if (!accessToken || values.get("token_type")?.toLowerCase() !== "bearer" ||
        !Number.isFinite(expiresIn) || expiresIn <= 0) throw new Error("Google did not return a usable access token");
    await trustedStorage(chromeApi);
    await chromeApi.storage.local.set({ [storageKey]: {
      accessToken, expiresAt: Date.now() + Math.max(0, expiresIn - 60) * 1000,
      extensionId: chromeApi.runtime.id
    } });
    return { connected: true };
  }

  async function connect(chromeApi = chrome, cryptoApi = crypto) {
    return authorize(chromeApi, cryptoApi, true);
  }

  async function getAccessToken(chromeApi = chrome, cryptoApi = crypto) {
    const value = await stored(chromeApi);
    if (!value || value.extensionId !== chromeApi.runtime.id) return null;
    if (value.accessToken && value.expiresAt > Date.now()) return value.accessToken;
    if (!renewalInFlight) {
      renewalInFlight = authorize(chromeApi, cryptoApi, false)
        .then(() => stored(chromeApi).then(next => next.accessToken))
        .catch(() => null)
        .finally(() => { renewalInFlight = null; });
    }
    return renewalInFlight;
  }

  async function status(chromeApi = chrome) {
    const value = await stored(chromeApi);
    return { configured: !!clientIdFor(chromeApi.runtime.id),
      connected: !!value?.accessToken && value.extensionId === chromeApi.runtime.id };
  }

  async function disconnect(chromeApi = chrome, fetcher = fetch) {
    const value = await stored(chromeApi);
    if (value?.accessToken) {
      await fetcher("https://oauth2.googleapis.com/revoke", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: value.accessToken }).toString()
      }).catch(() => {});
    }
    await chromeApi.storage.local.remove(storageKey);
    return { connected: false };
  }

  return { clientIdFor, authorizationUrl, connect, getAccessToken, status, disconnect };
});
