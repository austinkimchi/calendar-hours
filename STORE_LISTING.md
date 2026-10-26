# Chrome Web Store submission notes

**Name:** Calendar Hours

**Short description:** Add calculated duration hours to Google Calendar event titles.

**Detailed description:**

Calendar Hours turns event start and end times into a title suffix such as `SCU Block (3.17 hours)`. It works in Google Calendar's quick composer and full event editor. Accept a suggested duration with a click or Tab, type `/hours`, use the keyboard shortcut, or enable automatic insertion for titles matching your chosen words. Set decimal places, rounding mode, minute increment, unit text, and title template in Settings. Existing trailing hours can be updated after you change event times. Calculations happen in your browser, and the extension leaves saving the event to you.

**Single purpose:** Calculate and insert elapsed hours into Google Calendar event titles.

**Permission justification:** `storage` stores the user's formatting and trigger preferences. The `calendar.google.com/calendar/*` content-script match is necessary to read the event editor's visible title and time fields and insert the resulting title text. No other site is accessed.

**Data disclosure:** The extension processes event title and time fields locally in the browser. It does not collect or transmit user data. Preferences use browser extension storage and may be synced by the browser if the user enabled browser sync.

**Privacy policy:** Publish `PRIVACY.md` at a publicly accessible URL, then enter that URL in the developer dashboard if requested.

**Assets still needed for dashboard:** A genuine screenshot of the extension working in Google Calendar, and any account or listing fields required by the dashboard. The package already includes icons and a short description.

**Distribution:** Select the visibility chosen by the owner in the dashboard. An unlisted listing is installable in Edge through its Chrome Web Store link.
