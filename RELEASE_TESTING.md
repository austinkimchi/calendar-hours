# v0.3.3 release verification

## Connection renewal audit

The prior flow used Chromium's default first-page-load abort for non-interactive authorization. A Google JavaScript redirect could therefore end silent renewal before a token was returned. A separate HTTP 401 path never renewed a server-rejected token, and Workday classified every HTTP 403 as a reconnection problem.

- Silent renewal now allows up to 15 seconds for redirects, with no interactive window. Chrome/Edge 113 or later is required for these identity API options.
- Calendar saves, calendar discovery, and Workday event reads retry once with a renewed token after HTTP 401. Concurrent requests share renewal; stale responses cannot replace newer credentials.
- The authenticated primary calendar ID is saved locally with its grant as an account hint. An explicit account change clears the old hint. No additional OAuth scopes or browser permissions are requested.
- Temporary connection/quota failures preserve the grant and request a retry, while real login/consent failures require explicit reconnection.

## Automated verification

- `npm test`: 173 passing tests. New integration tests execute the real background, OAuth, Calendar-save, and Workday-read modules together with controlled Google/browser responses.
- Coverage includes expiry after inactivity, a fresh service-worker context, delayed JavaScript redirects, cached-token HTTP 401 recovery, bounded retries, concurrent renewal, quota failures, account-hint ownership, and malformed OAuth responses.
- Tests use a simulated clock for expiry; no live Google credentials are altered to force expiry.
- Release packaging retains the registered Web Store ID and the existing OAuth scopes and host permissions.

## Live Edge verification — November 19, 2026

- Installed a temporary unpacked v0.3.3 copy using the already-registered development extension ID. The published v0.3.2 installation remains separate.
- Connected through the actual Google account chooser and verified a successful Calendar API read in settings.
- Check connection exercised real non-interactive token renewal and then a successful Calendar API read. Settings displayed “Connection renewed. Google Calendar is ready.” without a sign-in window.
- Reloaded the unpacked extension to restart its service worker, reopened settings, and repeated Check connection successfully with the saved grant. No interactive sign-in was needed after the restart.
- Disabled the temporary unpacked copy after testing. The published v0.3.2 copy remains enabled while this patch goes through release review.
- Calendar events and Workday entries were not changed by this connection test. Actual overnight browser inactivity and a signed-out Google web session are separate conditions; Google can still require sign-in if its own session expires or access is revoked.

---

# v0.3.2 release verification (historical)

## Reliability audit

Reviewed the Calendar editor/grid update paths, API version/time checks, OAuth lifecycle, settings conflict handling, and Workday date/planning/form boundaries. This is a targeted regression audit, not a guarantee against every UI or organization-specific change.

| Confirmed defect | Regression evidence | Fix |
| --- | --- | --- |
| Workday rejected a correct single-digit date because the dialog pads zeros | Live `11/2` grid versus `11/02/2026` dialog; test failed before the fix | Accept optional leading zeros while retaining exact month/day/year checks |
| Saving immediately after changing a time could preserve an outdated duration | Enter, Save-click, and submit integration tests all failed before the fix | Flush eligible pending time edits before Calendar's save handlers; preserve Auto-update-off behavior |
| An OAuth response could restore a connection after Disconnect or supersede a newer connection | Delayed silent-renewal regression failed before the fix | Invalidate old authorization attempts, serialize token writes/removal, and finish revocation before reconnecting |

## Automated gates

- `npm test`: 159 passing tests, including the real content-script handlers in simulated Calendar/Workday DOMs.
- New coverage includes month/day padding, wrong-date rejection, API-to-form travel across payroll dates, immediate saves with minutes formatting, explicit Auto-update off, interrupted authorization, delayed token storage, and reconnect/renewal races.
- CI runs the complete suite and packaging under `UTC`, `America/Los_Angeles`, and `Europe/Madrid`.
- Release ZIP must preserve the registered extension ID and unchanged permissions/scopes, pass archive verification, and match the uploaded GitHub asset byte for byte.

## Live Edge checks

- Fixed Workday import added five matching blocks with the source dates and exact times. All stayed Not Submitted. A page refresh preserved all five record IDs, dates, times, and statuses. Rerun: `0 added, 0 updated, 5 already entered`.
- After reloading the complete v0.3.2 candidate, changed a one-time Calendar event from 60 to 30 minutes and immediately clicked Save. The stored title changed to the configured minutes format and survived a reload. Restored the original 60-minute interval and singular `1 hour` title; reloaded and verified restoration.
- Final-candidate Workday rerun again returned `0 added, 0 updated, 5 already entered`. No payroll Review/Submit actions were used.
- Private screenshots and event identifiers are kept outside the repository.

## Limits

OAuth race ordering is tested with controlled deferred browser/storage responses; no live account disconnection or forced credential race was performed. The existing connected-account path was exercised by the live Workday API reads. Fresh sign-in on a second computer and browser-managed sync delivery remain separate acceptance checks. Google OAuth approval and Chrome Web Store approval are separate external review states.

## Release destinations

- GitHub v0.3.2 is published. The downloaded release ZIP matched the tested local package byte for byte: SHA-256 `6b9e21479d5a708603001c3217aa06a30a410aad8a8839510a16253aacd7529d`.
- On November 4, 2026, that same ZIP was uploaded to the Chrome Web Store. The dashboard confirmed the v0.3.2 draft was submitted and pending review, with automatic publication after approval selected; v0.3.1 remained published.
- Saved listing changes include the release fixes, current connection instructions, the dedicated homepage and domain privacy-policy links. No permissions or data-use categories changed. Private dashboard evidence remains outside the repository.
