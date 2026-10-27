# Workday developer preview verification

## Automated checks

`npm test`: 71 tests pass, including 21 Workday/OAuth tests and existing title-formatting regressions. `npm run package` produces a verified `calendar-hours-0.2.11-workday-dev.zip`.

The new tests cover:

- Configuring a readable Google calendar and an independent import phrase in settings.
- First-use setup routing, revoked permissions, removed calendars, and invalid settings.
- Trusted message senders; Google access tokens stay in the service worker.
- Incremental calendar-list permission and preserving it on silent token renewal.
- Paginated Google Calendar reads with recurrence expansion and the displayed range's time-zone boundaries.
- Day/week date extraction, previous dates, cross-year weeks, and DST query boundaries.
- Exact minute times, lunch gaps, cancelled/all-day/future exclusions, duplicate reruns, source overlaps, and existing-entry conflicts.
- Individual entry form saves; wrong-date/existing-entry dialogs and navigation changes stop before saving.
- Explicitly no Review, Submit, Next or Delete action in the import adapter.

## Live verification still required

The initial live inspection identified the English Enter Time Day/Week calendar, existing-entry metadata, and the individual Enter Time form with an OK action. No draft entries were added during inspection.

After granting the developer build Workday access and Google calendar-list permission, verify:

1. Actions contains Auto-fill from Calendar and first use opens setup.
2. Choose the intended calendar, independent phrase, correct Workday zone, and enable import.
3. Import the displayed week; compare each added interval/comment and confirm Not Submitted.
4. Rerun and confirm zero duplicate additions.
5. Navigate to the previous week and import only that week.
6. Switch to Day, import only the displayed day, and check rerun behavior.
7. Confirm the feature remains functional after reload.

Do not click Review or submit a time card. Keep personal calendar details, organization identifiers, screenshots and network payloads out of this public repository.
