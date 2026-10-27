# Workday developer preview verification

## Automated checks

`npm test`: 74 tests pass, including 24 Workday/OAuth tests and existing title-formatting regressions. `npm run package` produces a verified `calendar-hours-0.2.11-workday-dev.zip`.

The new tests cover:

- Configuring a readable Google calendar and an independent import phrase in settings.
- First-use setup routing, revoked permissions, removed calendars, and invalid settings.
- Trusted message senders; Google access tokens stay in the service worker.
- Incremental calendar-list permission and preserving it on silent token renewal.
- Paginated Google Calendar reads with recurrence expansion and the displayed range's time-zone boundaries.
- Day/week date extraction, previous dates, cross-year weeks, and DST query boundaries.
- Exact minute times, lunch gaps, cancelled/all-day/future exclusions, duplicate reruns, source overlaps, and existing-entry conflicts.
- Individual entry form saves; wrong-date/existing-entry dialogs and navigation changes stop before saving.
- Workday zero-padded times, asynchronous duration calculation, and Discard Changes cleanup for unsaved drafts.
- Explicitly no Review, Submit, Next or Delete action in the import adapter.

## Live verification still required

Live inspection confirmed the English Enter Time calendar's current-week, previous-week, and single-day date headers. The individual form accepts exact minute times, pads morning hours with a leading zero, calculates the duration asynchronously, and asks for Discard Changes confirmation after an edited draft is canceled. The inspection draft was discarded and the original saved entry remained unchanged.

After reloading the approved developer build, Actions visibly contained **Auto-fill from Calendar**. First use displayed the setup guidance and opened `options.html#workday`. The live Actions listbox labels itself through a button's `aria-label`, so the adapter and regression fixture now account for that accessible-name structure. These behaviors were verified through the actual browser UI. Configured imports and Google consent remain pending manual setup because the browser-control policy disallows extension-settings URLs.

After granting the developer build Workday access and Google calendar-list permission, verify:

1. Actions contains Auto-fill from Calendar and first use opens setup.
2. Choose the intended calendar, independent phrase, correct Workday zone, and enable import.
3. Import the displayed week; compare each added interval/comment and confirm Not Submitted.
4. Rerun and confirm zero duplicate additions.
5. Navigate to the previous week and import only that week.
6. Switch to Day, import only the displayed day, and check rerun behavior.
7. Confirm the feature remains functional after reload.

Do not click Review or submit a time card. Keep personal calendar details, organization identifiers, screenshots and network payloads out of this public repository.
