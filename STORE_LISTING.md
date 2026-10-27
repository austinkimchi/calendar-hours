# Chrome Web Store submission notes

**Name:** Calendar Hours

**Short description:** Add calculated durations to Google Calendar event titles.

**Detailed description:**

Calendar Hours turns event start and end times into a title suffix such as `Work session (3.17 hours)` or `Quick task (45 minutes)`. It works in Google Calendar's quick composer and full event editor. Accept a suggested duration with a click or Tab, type `/hours`, use the keyboard shortcut, or enable automatic insertion for titles matching your chosen phrases. Give each phrase its own Dynamic setting to keep those one-time event titles current after moving or resizing them on the Calendar grid. Show all durations in minutes or use minutes only below one hour. Customize hour and minute templates, singular and plural unit text, decimal places for hours, rounding mode, and minute increment in Settings. On first install, a welcome page offers an optional Google Calendar connection for faster, tab-free saves of qualifying one-time grid changes. Without that connection, the extension can save those changes through an inactive Calendar editor tab. Manual editor changes still use Calendar's Save button.

**Single purpose:** Calculate and insert elapsed duration into Google Calendar event titles.

**Permission justification:** `storage` stores formatting and trigger preferences and, if the user connects Google Calendar, a short-lived OAuth token in local extension storage. `identity` opens Google's optional OAuth sign-in flow. The `calendar.google.com/calendar/*` content-script match reads visible event title and time fields and inserts calculated title text. `www.googleapis.com` reads a specific event and updates only its title after a qualifying grid change when the optional direct-save mode is connected. `oauth2.googleapis.com` revokes access when the user disconnects.

**Data disclosure:** The extension processes event title and time fields locally in the browser. With optional direct saving, it sends the selected event's identifier, title, and time check to Google's Calendar API under the user's own account and changes only the event title. It does not send event data to the developer, use analytics, or run a developer server. If direct saving is unavailable, qualifying one-time grid changes can use Google Calendar's editor and Save button. Preferences and small counts of how often the Tab hint is shown or accepted use browser sync storage, if enabled by the browser; optional OAuth tokens use local extension storage. The Google connection can be removed in Settings. See the public privacy policy for details.

**Privacy policy:** [Public policy](https://gist.github.com/austinkimchi/6069defb02ecb9c38b5b2c7d4feb65c7), matching `PRIVACY.md`. Only the public policy is visible outside the private source repository.

**Listing assets:** `store-assets/settings-screenshot.png`, `store-assets/settings-format-screenshot.png`, and `store-assets/settings-other-screenshot.png` show the current settings page at 1280 × 800. They use generic example phrases. The package includes the icon and short description.

**Distribution:** Free, Unlisted, all regions, English (US). After approval, the listing can be installed in Edge through its Chrome Web Store link.

**Dashboard:** [Calendar Hours item](https://chrome.google.com/webstore/devconsole/29ef0f4a-68bb-4294-b32d-e38c5258ce17/gkhggalcelmdidfdnllmdpaaapjiegig/edit), item ID `gkhggalcelmdidfdnllmdpaaapjiegig`. Distribution was set to Free, Unlisted, and All regions. Verify the current published version and submission controls in the dashboard before uploading 0.2.11.

**0.2.11 submission:** Upload `dist/calendar-hours-0.2.11.zip` when the dashboard permits a new package. Update the Store listing and Privacy practices with the optional Google Calendar API and OAuth access above; the public privacy policy must match `PRIVACY.md`. Confirm Google's OAuth review requirements before distributing direct API mode beyond the project's listed test users. Verify the dashboard shows the submitted version and review or publication state.
