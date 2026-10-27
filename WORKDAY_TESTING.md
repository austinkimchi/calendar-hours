# Workday developer preview verification

## Automated checks

`npm test`: 80 tests pass, including Workday/OAuth, settings accessibility, and existing title-formatting regressions. `npm run package` produces a verified `calendar-hours-0.2.11-workday-dev.zip`.

The new tests cover:

- Configuring a readable Google calendar and an independent import phrase in settings.
- Time zone dropdown persistence, aliases, and settings help on hover or keyboard focus.
- Actions defaults to Calendar on every opening. Arrow keys, Home/End, typeahead, and pointer hover keep the highlight and active descendant aligned; Enter activates only that option, including after Workday's delayed focus update.
- First-use setup routing, revoked permissions, removed calendars, and invalid settings.
- Trusted message senders; Google access tokens stay in the service worker.
- Incremental calendar-list permission and preserving it on silent token renewal.
- Paginated Google Calendar reads with recurrence expansion and the displayed range's time-zone boundaries.
- Day/week date extraction, previous dates, cross-year weeks, and DST query boundaries.
- Exact minute times, lunch gaps, cancelled/all-day/future exclusions, duplicate reruns, source overlaps, and existing-entry conflicts.
- Individual entry form saves; wrong-date/existing-entry dialogs and navigation changes stop before saving.
- Workday zero-padded times, asynchronous duration calculation, and Discard Changes cleanup for unsaved drafts.
- Explicitly no Review, Submit, Next or Delete action in the import adapter.

## Live browser verification

Verified on the English Workday Enter Time calendar using the approved developer extension and the user's saved Google Calendar setup:

- **Auto-fill from Calendar** appears first and is highlighted when Actions opens. Clicking Actions followed by Enter ran Calendar import. Arrow Down/Up navigated to Prior Week and back, Escape closed the menu, and reopening selected Calendar again.
- First use shows setup guidance and opens the Workday section in extension settings. Google consent and settings were completed by the user because the browser-control policy excludes extension-settings URLs.
- The configured current-week import saved the missing blocks through the normal individual form. Existing exact entries were skipped. All new entries visibly remained **Not Submitted**.
- A second current-week run added zero duplicates. The saved blocks and their exact intervals survived a page reload. An opened saved entry confirmed its calendar-title comment and configured Out Reason.
- Day view requested just its displayed day and recognized that day's existing blocks. A separate empty Day-view grid probe opened a form for the correct displayed date and was canceled without saving.
- Previous-week import used the previous displayed week, recognized its matching existing entries, and added no duplicates.
- The observed grid requires a pointer/mouse down-up sequence on its hit target. Click-only activation does not open the form. The adapter scrolls the selected quarter-hour row into view before selecting it.
- The live form pads morning hours with a leading zero, calculates duration asynchronously, and prompts to discard edited unsaved drafts. The adapter now handles all three behaviors, with regression tests.
- Completed-import status is cleared when the displayed dates change so it cannot describe the wrong day or week.

No Review or Submit action was taken. Empty and edited inspection drafts were canceled/discarded. Authorized imported entries were retained for user inspection. Personal calendar details, organization identifiers, screenshots and network payloads are kept outside this public repository.
