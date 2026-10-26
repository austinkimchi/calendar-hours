# Changelog

## 0.2.0 — October 26, 2026

- Added an opt-in toggle to keep matching event titles current after moving or resizing timed events on the Calendar grid. It opens the changed event and saves the corrected hours suffix automatically for one-time events.
- Matching title words and phrases now use word boundaries, so `Block` does not match `Unblocked`.
- Matching event titles also update while start or end time fields are edited. Recurring events and Calendar confirmation dialogs remain for manual review.

## 0.1.0 — October 26, 2026

- First release with duration suggestions, keyword replacement, keyboard shortcut, popup action, and optional word-matched automatic insertion.
- Added rounding, minute increments, decimal precision, unit text, title templates, and existing-suffix updates.
- Added Chrome and Edge compatible Manifest V3 package.
