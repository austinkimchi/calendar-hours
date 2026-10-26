# Chrome Web Store submission notes

**Name:** Calendar Hours

**Short description:** Add calculated durations to Google Calendar event titles.

**Detailed description:**

Calendar Hours turns event start and end times into a title suffix such as `Work session (3.17 hours)` or `Quick task (45 minutes)`. It works in Google Calendar's quick composer and full event editor. Accept a suggested duration with a click or Tab, type `/hours`, use the keyboard shortcut, or enable automatic insertion for titles matching your chosen phrases. Give each phrase its own Dynamic setting to keep those one-time event titles current after moving or resizing them on the Calendar grid: the new duration appears immediately, and the extension saves the corrected title through Calendar. Show all durations in minutes or use minutes only below one hour. Customize hour and minute templates, singular and plural unit text, decimal places for hours, rounding mode, and minute increment in Settings. Manual editor changes still use Calendar's Save button.

**Single purpose:** Calculate and insert elapsed duration into Google Calendar event titles.

**Permission justification:** `storage` stores the user's formatting and trigger preferences. The `calendar.google.com/calendar/*` content-script match is necessary to read the event editor's visible title and time fields and insert the resulting title text. No other site is accessed.

**Data disclosure:** The extension processes event title and time fields locally in the browser. It does not collect event data or send it to the developer or a separate service. With the existing-duration update setting, which starts on for new installations, it uses Google Calendar's Save button to save a corrected event under the user's Google account. Preferences use browser extension storage and may be synced by the browser if the user enabled browser sync.

**Privacy policy:** [Public policy](https://gist.github.com/austinkimchi/6069defb02ecb9c38b5b2c7d4feb65c7), matching `PRIVACY.md`. Only the public policy is visible outside the private source repository.

**Listing assets:** `store-assets/settings-screenshot.png`, `store-assets/settings-format-screenshot.png`, and `store-assets/settings-other-screenshot.png` show the current settings page at 1280 × 800. They use generic example phrases. The package includes the icon and short description.

**Distribution:** Free, Unlisted, all regions, English (US). After approval, the listing can be installed in Edge through its Chrome Web Store link.

**Dashboard:** [Calendar Hours item](https://chrome.google.com/webstore/devconsole/29ef0f4a-68bb-4294-b32d-e38c5258ce17/gkhggalcelmdidfdnllmdpaaapjiegig/edit), item ID `gkhggalcelmdidfdnllmdpaaapjiegig`. On October 26, 2026, the signed-in PKimchi dashboard showed v0.1.0 **Pending review**, no published version, and **Upload new package** disabled. Distribution remains Free, Unlisted, and All regions. The unlisted store link will become installable once Google approves and publishes it.

**Next submission:** Version 0.2.6 adds updates for titles with a recognized duration suffix, minute display options, separate minutes formatting, singular units, updated first-time defaults, and clearer setting help. The ZIP, three current screenshots, and private GitHub release are ready. After v0.1.0 review clears, update the dashboard copy and public privacy policy, upload v0.2.6, and verify its submission state there.
