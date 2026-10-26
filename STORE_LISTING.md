# Chrome Web Store submission notes

**Name:** Calendar Hours

**Short description:** Add calculated duration hours to Google Calendar event titles.

**Detailed description:**

Calendar Hours turns event start and end times into a title suffix such as `SCU Block (3.17 hours)`. It works in Google Calendar's quick composer and full event editor. Accept a suggested duration with a click or Tab, type `/hours`, use the keyboard shortcut, or enable automatic insertion for titles matching your chosen words. An optional setting keeps matching one-time event titles updated after you move or resize them on the calendar grid, then saves the correction in Calendar. Set decimal places, rounding mode, minute increment, unit text, and title template in Settings. Calculations happen in your browser.

**Single purpose:** Calculate and insert elapsed hours into Google Calendar event titles.

**Permission justification:** `storage` stores the user's formatting and trigger preferences. The `calendar.google.com/calendar/*` content-script match is necessary to read the event editor's visible title and time fields and insert the resulting title text. No other site is accessed.

**Data disclosure:** The extension processes event title and time fields locally in the browser. It does not collect event data or make its own network requests. With the optional keep-updated setting, it uses Calendar's Save control, which sends the edited event to Google through Calendar's normal flow. Preferences use browser extension storage and may be synced by the browser if the user enabled browser sync.

**Privacy policy:** [Public policy](https://gist.github.com/austinkimchi/6069defb02ecb9c38b5b2c7d4feb65c7), mirrored in `PRIVACY.md`. Only the policy is public; the source repository is private.

**Listing assets:** `store-assets/settings-screenshot.png` shows the extension's actual settings page at 1280 × 800. The package includes the icon and short description.

**Distribution:** Free, Unlisted, all regions, English (US). After approval, the listing can be installed in Edge through its Chrome Web Store link.

**Dashboard:** [Calendar Hours item](https://chrome.google.com/webstore/devconsole/29ef0f4a-68bb-4294-b32d-e38c5258ce17/gkhggalcelmdidfdnllmdpaaapjiegig/edit), item ID `gkhggalcelmdidfdnllmdpaaapjiegig`. Version 0.1.0 was submitted on October 26, 2026; the dashboard showed **Pending review**. Version 0.2.0 adds automatic grid edit updates and should replace the pending submission before publication. The unlisted store link will become installable once Google approves and publishes it.
