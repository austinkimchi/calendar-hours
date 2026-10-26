# Changelog

## 0.2.1 — development build, October 26, 2026

- Show the recalculated hours on the Calendar grid as soon as a matching drag or resize finishes.
- Save and verify the corrected title in an inactive Calendar tab so the main Calendar view stays open.
- Queue a second grid edit if it happens before the first background save finishes.
- Correct the grid update path using the live Calendar editor and recurrence controls observed in Edge. This build has not been submitted to the Chrome Web Store.
- Keep updating when Calendar opens event details during a grid resize, and paint the new hours in that popup while the title saves. Live Edge resize and restore both persisted after reloading Calendar.

## 0.2.0 — October 26, 2026

- Added an opt-in toggle to keep matching event titles current after moving or resizing timed events on the Calendar grid. It opens the changed event and saves the corrected hours suffix automatically for one-time events.
- Matching title words and phrases now use word boundaries, so `Block` does not match `Unblocked`.
- Matching event titles also update while start or end time fields are edited. Recurring events and Calendar confirmation dialogs remain for manual review.

## 0.1.0 — October 26, 2026

- First release with duration suggestions, keyword replacement, keyboard shortcut, popup action, and optional word-matched automatic insertion.
- Added rounding, minute increments, decimal precision, unit text, title templates, and existing-suffix updates.
- Added Chrome and Edge compatible Manifest V3 package.
