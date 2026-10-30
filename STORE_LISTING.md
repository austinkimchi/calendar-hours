# Chrome Web Store submission notes

**Name:** Calendar Hours

**Short description:** Add durations to Google Calendar titles and import calendar work blocks into Workday.

**Detailed description:**

Calendar Hours turns event start and end times into a title suffix such as `Work session (3.17 hours)` or `Quick task (45 minutes)`. In Google Calendar's event editor, accept a faint inline duration suggestion with Enter or Tab, type `/hours`, use the keyboard shortcut, or enable automatic insertion for titles matching your chosen phrases. Each phrase can use Dynamic mode to keep its duration current when you move or resize a one-time event. You can also update titles that already have a duration suffix after time changes. Choose hours or minutes, show minutes only below one hour, and customize rounding, increments, singular and plural units, and title templates. An optional Google Calendar connection supports faster saves without opening an editor tab; enable Use faster saves separately in settings. That connection is currently available only to approved OAuth test users while Google verification is pending. Without it, the extension can use Calendar's editor to save qualifying grid changes. Manual editor changes still use Calendar's Save button. Event calculations happen in your browser; Calendar data is not sent to the developer.

**Single purpose:** Turn Google Calendar work blocks into accurate time records: display their duration in event titles and optionally transfer their recorded intervals into Workday drafts.

Optional Workday import adds Auto-fill from Calendar to the Actions menu in the English Enter Time day/week view at www.myworkday.com. Choose calendars, an event-title phrase, and the payroll time zone. Imports preserve existing gaps, skip exact entries, and can update one overlapping unsubmitted draft. Comments and unfinished blocks are optional. All entries remain drafts for the user to check and submit. Meal deductions are unavailable in this release.

**Permission justification:** `storage` stores formatting and trigger preferences and, if the user connects Google Calendar, a short-lived OAuth token in local extension storage. `identity` opens Google's optional OAuth sign-in flow. The `calendar.google.com/calendar/*` content-script match reads visible event title and time fields and inserts calculated title text. `www.googleapis.com` reads a specific event and updates only its title after a qualifying grid change when the optional direct-save mode is connected. `oauth2.googleapis.com` revokes access when the user disconnects. Read-only calendar-list access populates the calendar picker; Calendar event access also reads selected work blocks for the displayed Workday dates. The `www.myworkday.com/*` content-script match reads the displayed dates and existing entries, adds the import command, and fills the normal Workday entry forms only when the user requests an import.

**Data disclosure:** Requested Workday imports send selected calendar start/end times, and optionally event descriptions, to the user’s Workday organization. No time card is reviewed or submitted automatically.  The extension processes event title and time fields locally in the browser. With optional direct saving, it sends the selected event's identifier, title, and time check to Google's Calendar API under the user's own account and changes only the event title. It does not send event data to the developer, use analytics, or run a developer server. If direct saving is unavailable, qualifying one-time grid changes can use Google Calendar's editor and Save button. Preferences use browser sync storage, if enabled by the browser; optional OAuth tokens use local extension storage. The Google connection can be removed in Settings. See the public privacy policy for details.

**Privacy policy:** The [Calendar Hours domain policy](https://calendarhours.austin.kim/privacy/) is the canonical public policy and matches the OAuth consent-screen link. The existing Web Store listing still points to the [public Gist](https://gist.github.com/austinkimchi/6069defb02ecb9c38b5b2c7d4feb65c7), updated to match `PRIVACY.md` on October 29, 2026. Change that listing link to the domain policy when listing edits unlock after the pending review.

**Listing assets:** `store-assets/settings-screenshot.png`, `store-assets/settings-format-screenshot.png`, and `store-assets/settings-other-screenshot.png` show the core settings page at 1280 × 800. They use generic example phrases. All three remain on the listing, with `settings-screenshot.png` first. The original 0.1.0 screenshot with a personal example was removed from the v0.3.1 draft with the user's approval. The package includes the icon and short description. The current screenshots cover core duration settings; they do not show the optional Workday import.

**Distribution:** Free, Unlisted, all regions, English (US). After approval, the listing can be installed in Edge through its Chrome Web Store link.

**Dashboard:** [Calendar Hours item](https://chrome.google.com/webstore/devconsole/29ef0f4a-68bb-4294-b32d-e38c5258ce17/gkhggalcelmdidfdnllmdpaaapjiegig/edit), item ID `gkhggalcelmdidfdnllmdpaaapjiegig`. Distribution is Free, Unlisted, and All regions. On October 29, 2026, the dashboard showed **Published 0.2.11** and **Draft 0.3.1 pending review**. The [unlisted listing](https://chromewebstore.google.com/detail/calendar-hours/gkhggalcelmdidfdnllmdpaaapjiegig) still offers the published version until the new review passes.

**0.2.11 submission:** On October 27, 2026, `dist/calendar-hours-0.2.11.zip` (SHA-256 `6aa2bc30491da71ff2163d571c476f6effd98783eeb6e1a042a45cc867d525b1`) was submitted. It was published by October 29, 2026. Google OAuth verification is still required before distributing direct API mode beyond the project's listed test users.

**0.3.1 submission:** On October 29, 2026, the [v0.3.1 GitHub release asset](https://github.com/austinkimchi/calendar-hours/releases/tag/v0.3.1) `calendar-hours-0.3.1.zip` (SHA-256 `635d4d01730c47553ec2eadc26c4a5644657434550b805fb6b60354c84fe1247`) was uploaded. Its ZIP entry contents matched a fresh local rebuild, and `npm test` passed 151 tests. The public privacy policy, listing description, permission justifications, and reviewer instructions were updated for Workday import and browser settings sync. The dashboard confirmed **Draft 0.3.1 pending review** and **Published 0.2.11**. Automatic publication after approval was selected. This is a submission, not a publication confirmation.


## 0.3.0 release candidate

Prepared from `workday-integration` for a pull request into `main`. Package: `dist/calendar-hours-0.3.0.zip`. The name is Calendar Hours, with no developer version suffix. Meal automation is hidden and disabled even for prior enabled settings; backend request experiments are not included.

The release ZIP now includes the store's public key. Its derived ID is `gkhggalcelmdidfdnllmdpaaapjiegig`, matching the allowed OAuth ID and the existing `https://gkhggalcelmdidfdnllmdpaaapjiegig.chromiumapp.org/` redirect. This avoids path-dependent IDs on another computer. The source checkout keeps its development identity; existing development registrations remain supported. This changes build identity only, not OAuth audience: users must still be listed test accounts until Google production/verification is complete.

Before store submission:

- Verify the current dashboard state; the version/status statements above are historical observations.
- Publish the Workday additions to the linked public privacy policy and update the listing, permissions/data disclosures, screenshots, and reviewer instructions.
- Confirm Google OAuth publication/verification and registered redirect URLs for the store extension ID. The repository documents test-user restrictions; this release preparation does not change the Google consent app.
- Reload the candidate and smoke-test the release UI. Prior live import evidence and current automated regression coverage are documented in `WORKDAY_TESTING.md`.

No store upload, public policy publication, or automatic merge is performed by preparing this candidate.


## 0.3.1 browser settings sync release

Package: `dist/calendar-hours-0.3.1.zip`. Adds conflict-aware browser settings updates and per-preference Workday storage. Update all participating devices to this build; Chrome syncs with Chrome and Edge with Edge under the same browser account and extension ID. Live transport between two computers remains unverified.

The release retains extension ID `gkhggalcelmdidfdnllmdpaaapjiegig`, the existing browser-sign-in OAuth client and redirect, and the same two Calendar scopes. Google OAuth configuration is tied to the client, redirect and permissions, not the extension version number. No new consent scope is needed for browser settings sync. The raw development build keeps its existing ID.

A GitHub release does not publish a Chrome Web Store update or complete Google's OAuth verification. Keep the documented test-user restriction until the Google Auth Platform audience/verification status changes. The linked public privacy policy must include the current policy before the next store submission.
