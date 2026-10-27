# Time-zone handling

## Sources checked October 27, 2026

- [MDN: Intl.DateTimeFormat.resolvedOptions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/resolvedOptions): the runtime's default IANA zone is available without geolocation. Read it afresh rather than saving it as a permanent preference.
- [Google Calendar time zones](https://support.google.com/calendar/answer/37064?hl=en): Calendar has a primary display zone, a travel prompt, per-calendar zones, and separate event start/end zones. A computer-zone change does not justify interpreting fixed Calendar wall times in a new zone.
- [Calendar API events and calendars](https://developers.google.com/workspace/calendar/api/concepts/events-calendars): timed events represent instants using RFC3339 timestamps and IANA zones. All-day dates have different semantics.

## Detection

1. Read the named `timezone` preference from Calendar's JSON `initialdata` element, without executing it or exporting unrelated fields. A visible primary-zone picker update or Calendar's `ctz` display override takes precedence.
2. For the editor, map its start/end zone labels through Calendar's JSON `timezonedata`. Use the IANA identifier for the event date, not the label's possibly seasonal GMT offset. One common label applies to both endpoints; separate labels are resolved independently.
3. When no Calendar zone is available, call `Intl.DateTimeFormat().resolvedOptions().timeZone` for the current device zone. No location service, new OAuth scope, or persisted zone preference is needed.
4. A present but unrecognized explicit event zone prevents a calculation. Do not substitute the computer zone for it.

The quick composer exposes a full name for a common zone, but only GMT offsets for separate zones. When the user confirms its Time zone dialog, retain that named pair for the current unsaved editor. For an existing separate-zone event whose names are unavailable in the quick composer, leave the title unchanged until the zones are confirmed or More options is opened. Never infer an IANA zone from an offset alone.

Calendar's JSON layout and editor labels are private UI details, observed in the live English Google Calendar editor. The adapter uses a named preference rather than numeric JSON positions, but changes to Google's UI can still require maintenance. Existing English date/time parsing limitations remain. The extension follows Calendar; it does not enable Google's travel prompt or alter account time zones.

## Calculation and persistence

- Resolve wall-clock endpoints with IANA rules. Reject invalid dates, skipped local times, and repeated local times rather than selecting an arbitrary occurrence. Compute elapsed minutes between unique instants.
- Grid API verification and background editor verification compare the same absolute instants, even when the editor shows different zones/dates from the grid.
- A change to the detected display zone resets grid observations so shifted labels do not cause title writes.
- All-day and durations outside the existing seven-day limit remain excluded.

## Automated checks

`npm test` covers a traveling machine, Calendar/device mismatch, primary-zone changes, URL overrides, separate start/end zones crossing dates, Pacific spring/fall DST, Lord Howe half-hour DST, Kathmandu's quarter-hour offset, Samoa's skipped date, invalid zones, unknown labels, grid absolute-time checks, and background editor date/zone mismatch. Synthetic tests use no account data or live Calendar writes.
