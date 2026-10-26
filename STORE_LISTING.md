# Chrome Web Store submission notes

**Name:** Calendar Hours

**Short description:** Add calculated duration hours to Google Calendar event titles.

**Detailed description:**

Calendar Hours turns event start and end times into a title suffix such as `SCU Block (3.17 hours)`. It works in Google Calendar's quick composer and full event editor. Accept a suggested duration with a click or Tab, type `/hours`, use the keyboard shortcut, or enable automatic insertion for titles matching your chosen words. Set decimal places, rounding mode, minute increment, unit text, and title template in Settings. Existing trailing hours can be updated after you change event times. Calculations happen in your browser, and the extension leaves saving the event to you.

**Single purpose:** Calculate and insert elapsed hours into Google Calendar event titles.

**Permission justification:** `storage` stores the user's formatting and trigger preferences. The `calendar.google.com/calendar/*` content-script match is necessary to read the event editor's visible title and time fields and insert the resulting title text. No other site is accessed.

**Data disclosure:** The extension processes event title and time fields locally in the browser. It does not collect or transmit user data. Preferences use browser extension storage and may be synced by the browser if the user enabled browser sync.

**Privacy policy:** [Public policy for v0.1.0](https://gist.github.com/austinkimchi/6069defb02ecb9c38b5b2c7d4feb65c7). The local `PRIVACY.md` is a draft for the later keep-updated build. Only the public policy is visible outside the private source repository.

**Listing assets:** `store-assets/settings-screenshot.png` shows the extension's actual settings page at 1280 × 800. The package includes the icon and short description.

**Distribution:** Free, Unlisted, all regions, English (US). After approval, the listing can be installed in Edge through its Chrome Web Store link.

**Dashboard:** [Calendar Hours item](https://chrome.google.com/webstore/devconsole/29ef0f4a-68bb-4294-b32d-e38c5258ce17/gkhggalcelmdidfdnllmdpaaapjiegig/edit), item ID `gkhggalcelmdidfdnllmdpaaapjiegig`. Version 0.1.0 was submitted on October 26, 2026; the dashboard showed **Pending review** with automatic publication after approval enabled. The unlisted store link will become installable once Google approves and publishes it.

**Later builds:** Version 0.2.0 is a private GitHub release. Version 0.2.1 is a local development build that makes grid updates less visible. Neither has been submitted to the Chrome Web Store, per the user's request. Update the public privacy policy, listing copy, and screenshot when the user decides to submit a later build.
