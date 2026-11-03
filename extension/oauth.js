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
  const calendarListScope = "https://www.googleapis.com/auth/calendar.calendarlist.readonly";
  const sharedScopes = [scope, calendarListScope];
  const storageKey = "calendarHoursOAuth";
  let accessLevelReady;
  let renewalInFlight;
  let connectionInFlight;
  let disconnectInFlight;
  let connectionRevision = 0;
  let credentialWrites = Promise.resolve();

  function changeCredentials(change) {
    const pending = credentialWrites.catch(() => {}).then(change);
    credentialWrites = pending;
    return pending;
  }

  function clientIdFor(extensionId) { return extensionIds.has(extensionId) ? webClientId : null; }

  function randomState(cryptoApi = crypto) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(24));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function authorizationUrl({ clientId, redirectUri, state, interactive, scopes = sharedScopes }) {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: clientId, redirect_uri: redirectUri, response_type: "token", scope: scopes.join(" "),
      state, prompt: interactive ? "select_account" : "none"
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

  async function authorize(chromeApi = chrome, cryptoApi = crypto, interactive = true, scopes = sharedScopes, revision = connectionRevision) {
    if (disconnectInFlight) await disconnectInFlight;
    if (revision !== connectionRevision) throw new Error("Google connection changed before sign-in started. Try connecting again.");
    const clientId = clientIdFor(chromeApi.runtime.id);
    if (!clientId) throw new Error("This extension ID has no Calendar Hours OAuth client");
    const redirectUri = chromeApi.identity.getRedirectURL();
    const state = randomState(cryptoApi);
    const url = authorizationUrl({ clientId, redirectUri, state, interactive, scopes });
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
    const grantedScopes = (values.get("scope") || scopes.join(" ")).split(/\s+/);
    if (scopes.some(s => !grantedScopes.includes(s))) throw new Error("Google did not grant all requested Calendar permissions");
    await trustedStorage(chromeApi);
    await changeCredentials(async () => {
      if (revision !== connectionRevision) throw new Error("Google connection changed before sign-in finished. Try connecting again.");
      await chromeApi.storage.local.set({ [storageKey]: {
        accessToken, expiresAt: Date.now() + Math.max(0, expiresIn - 60) * 1000,
        extensionId: chromeApi.runtime.id, scopes: grantedScopes
      } });
    });
    if (revision !== connectionRevision) throw new Error("Google connection changed before sign-in finished. Try connecting again.");
    return { connected: true, calendarListAccess: grantedScopes.includes(calendarListScope) };
  }

  async function connect(chromeApi = chrome, cryptoApi = crypto) {
    if (!connectionInFlight) {
      const revision = ++connectionRevision;
      const pending = authorize(chromeApi, cryptoApi, true, sharedScopes, revision)
        .finally(() => { if (connectionInFlight === pending) connectionInFlight = null; });
      connectionInFlight = pending;
    }
    return connectionInFlight;
  }

  async function getAccessToken(chromeApi = chrome, cryptoApi = crypto) {
    if (disconnectInFlight) return null;
    const revision = connectionRevision;
    const value = await stored(chromeApi);
    if (revision !== connectionRevision) return null;
    if (!value || value.extensionId !== chromeApi.runtime.id) return null;
    if (value.accessToken && value.expiresAt > Date.now()) return value.accessToken;
    if (!renewalInFlight) {
      const pending = authorize(chromeApi, cryptoApi, false, value.scopes || [scope], revision)
        .then(() => stored(chromeApi).then(next => revision === connectionRevision ? next?.accessToken || null : null))
        .catch(() => null)
        .finally(() => { if (renewalInFlight === pending) renewalInFlight = null; });
      renewalInFlight = pending;
    }
    return renewalInFlight;
  }

  async function status(chromeApi = chrome) {
    const value = await stored(chromeApi);
    return { configured: !!clientIdFor(chromeApi.runtime.id),
      connected: !!value?.accessToken && value.extensionId === chromeApi.runtime.id,
      calendarListAccess: !!value?.accessToken && value.extensionId === chromeApi.runtime.id && !!value.scopes?.includes(calendarListScope) };
  }

  async function disconnect(chromeApi = chrome, fetcher = fetch) {
    // Invalidate in-flight grants immediately. Serialize removal after any
    // already-started storage write so a late renewal cannot reconnect us.
    connectionRevision++;
    connectionInFlight = renewalInFlight = null;
    const pending = changeCredentials(async () => {
      const value = await stored(chromeApi);
      await chromeApi.storage.local.remove(storageKey);
      if (value?.accessToken) {
        await fetcher("https://oauth2.googleapis.com/revoke", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: value.accessToken }).toString()
        }).catch(() => {});
      }
      return { connected: false };
    }).finally(() => { if (disconnectInFlight === pending) disconnectInFlight = null; });
    disconnectInFlight = pending;
    return pending;
  }

  return { clientIdFor, authorizationUrl, connect, getAccessToken, status, disconnect };
});
