# Changelog

## 0.2.4 — development build, October 26, 2026

- Add a choice to show every duration in minutes or use minutes only for events under one hour.
- Give minutes a separate title template and editable singular and plural unit labels; initialize that template from the current hours template when minutes are first enabled.
- Use singular units for exactly one hour or minute, including custom abbreviations such as `hr` and `min`.
- Recognize and replace existing hour or minute suffixes when formatting or event times change.

## 0.2.3 — development build, October 26, 2026

- Add an opt-in Other setting that keeps titles with a recognized hours suffix current after editing, moving, or resizing events, even when the title has no matching phrase.
- Detect both the current custom hours template and older hours/hrs/hr suffixes. Keep a phrase's explicit Dynamic-off choice in control when that phrase matches.
- Watch Calendar's displayed time range as a fallback when its drag or resize gestures do not reach the extension, and keep editor updates working when Calendar replaces the title field during an edit.
- Live tested an Allergy Shot event in Edge: resizing 4:00–5:00pm to 4:00–4:45pm saved `0.75 hours`, and resizing back restored `1 hours`.

## 0.2.2 — October 26, 2026

- Put matching phrases first and organize settings into General, Hours, and Other.
- Give each matching phrase its own Dynamic setting for automatic title updates after time changes, moves, and resizes.
- Move the longer Dynamic explanation into one information button and migrate existing comma-separated phrases and the former global keep-updated setting.

## 0.2.1 — October 26, 2026

- Show the recalculated hours on the Calendar grid as soon as a matching drag or resize finishes.
- Save and verify the corrected title in an inactive Calendar tab so the main Calendar view stays open.
- Queue a second grid edit if it happens before the first background save finishes.
- Correct the grid update path using the live Calendar editor and recurrence controls observed in Edge.
- Keep updating when Calendar opens event details during a grid resize, and paint the new hours in that popup while the title saves. Live Edge resize and restore both persisted after reloading Calendar.
- Use a generic Work session example throughout Settings.

## 0.2.0 — October 26, 2026

- Added an opt-in toggle to keep matching event titles current after moving or resizing timed events on the Calendar grid. It opens the changed event and saves the corrected hours suffix automatically for one-time events.
- Matching title words and phrases now use word boundaries, so `Block` does not match `Unblocked`.
- Matching event titles also update while start or end time fields are edited. Recurring events and Calendar confirmation dialogs remain for manual review.

## 0.1.0 — October 26, 2026

- First release with duration suggestions, keyword replacement, keyboard shortcut, popup action, and optional word-matched automatic insertion.
- Added rounding, minute increments, decimal precision, unit text, title templates, and existing-suffix updates.
- Added Chrome and Edge compatible Manifest V3 package.
