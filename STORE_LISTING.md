# Chrome Web Store submission notes

**Name:** Calendar Hours

**Short description:** Add calculated hours or minutes to Google Calendar event titles.

**Detailed description:**

Calendar Hours turns event start and end times into a title suffix such as `Work session (3.17 hours)` or `Quick task (45 minutes)`. In Google Calendar's event editor, accept a duration suggestion with Tab, type `/hours`, use the keyboard shortcut, or enable automatic insertion for titles matching your chosen phrases. Each phrase can use Dynamic mode to keep its duration current when you move or resize a one-time event. You can also update titles that already have a duration suffix after time changes. Choose hours or minutes, show minutes only below one hour, and customize rounding, increments, singular and plural units, and title templates. On first install, an optional Google Calendar connection enables faster saves without opening an editor tab. That connection is currently available only to approved OAuth test users while Google verification is pending. Without it, the extension can use Calendar's editor to save qualifying grid changes. Manual editor changes still use Calendar's Save button. Event calculations happen in your browser; Calendar data is not sent to the developer.

**Single purpose:** Calculate elapsed time from Google Calendar event start and end times, then suggest, insert, and keep a formatted hours or minutes duration in the event title.

**Permission justification:** `storage` stores formatting and trigger preferences and, if the user connects Google Calendar, a short-lived OAuth token in local extension storage. `identity` opens Google's optional OAuth sign-in flow. The `calendar.google.com/calendar/*` content-script match reads visible event title and time fields and inserts calculated title text. `www.googleapis.com` reads a specific event and updates only its title after a qualifying grid change when the optional direct-save mode is connected. `oauth2.googleapis.com` revokes access when the user disconnects.

**Data disclosure:** The extension processes event title and time fields locally in the browser. With optional direct saving, it sends the selected event's identifier, title, and time check to Google's Calendar API under the user's own account and changes only the event title. It does not send event data to the developer, use analytics, or run a developer server. If direct saving is unavailable, qualifying one-time grid changes can use Google Calendar's editor and Save button. Preferences and small counts of how often the Tab hint is shown or accepted use browser sync storage, if enabled by the browser; optional OAuth tokens use local extension storage. The Google connection can be removed in Settings. See the public privacy policy for details.

**Privacy policy:** [Public policy](https://gist.github.com/austinkimchi/6069defb02ecb9c38b5b2c7d4feb65c7), matching `PRIVACY.md`. Only the public policy is visible outside the private source repository.

**Listing assets:** `store-assets/settings-screenshot.png`, `store-assets/settings-format-screenshot.png`, and `store-assets/settings-other-screenshot.png` show the current settings page at 1280 × 800. They use generic example phrases. All three were uploaded to the listing, with `settings-screenshot.png` first. The original 0.1.0 screenshot remains; the user approved its removal, but the dashboard locks listing edits while 0.2.11 is pending review. Remove it when listing edits become available, then verify the resulting review and publication status. The package includes the icon and short description.

**Distribution:** Free, Unlisted, all regions, English (US). After approval, the listing can be installed in Edge through its Chrome Web Store link.

**Dashboard:** [Calendar Hours item](https://chrome.google.com/webstore/devconsole/29ef0f4a-68bb-4294-b32d-e38c5258ce17/gkhggalcelmdidfdnllmdpaaapjiegig/edit), item ID `gkhggalcelmdidfdnllmdpaaapjiegig`. Distribution is Free, Unlisted, and All regions. On October 27, 2026, the [public listing](https://chromewebstore.google.com/detail/calendar-hours/gkhggalcelmdidfdnllmdpaaapjiegig) and dashboard showed version 0.1.0 published.

**0.2.11 submission:** On October 27, 2026, `dist/calendar-hours-0.2.11.zip` (SHA-256 `6aa2bc30491da71ff2163d571c476f6effd98783eeb6e1a042a45cc867d525b1`) was uploaded with the updated listing, screenshots, privacy practices, and reviewer instructions. The dashboard confirmed **Draft 0.2.11 pending review** and **Published 0.1.0**. Automatic publication after approval was selected. Google OAuth verification is still required before distributing direct API mode beyond the project's listed test users. Check the dashboard for the actual approval or publication outcome.
