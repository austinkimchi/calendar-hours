# Changelog

## 0.2.15 — Workday developer preview, October 27, 2026

- Trigger a meal from configurable keywords in a work event’s description, independently of importing comments.
- Allow keyword and hours-worked triggers together, with one shared meal deduction and configurable placement and length.
- Preserve saved settings and support existing separate timed meal events.
- Update an unambiguous draft and split its meal in one import when the calendar start or end changes.

## 0.2.14 — Workday developer preview, October 27, 2026

- Select multiple calendars for Workday imports, with bounded concurrent reads and migration of saved single-calendar choices.
- Add optional unpaid meals from independent calendar phrases, with Breakfast, Lunch, Dinner, and Meal Break defaults.
- Add an optional configurable automatic meal after five worked hours, lasting thirty minutes by default. Both meal features start off; calendar meals take priority.
- Set the preceding entry’s Out Reason to Meal, safely split exact unsubmitted drafts, and avoid saving unchanged entries on rerun.
- Stop before writes when selected calendars cannot be read or meal times are unsafe to interpret.

## 0.2.13 — October 27, 2026

- Follow Google Calendar’s primary and event-specific time zones automatically, with the current device zone as fallback. No additional connection or permission is required.
- Calculate elapsed time across daylight-saving changes and separate start/end zones. Leave ambiguous or nonexistent clock times unchanged.
- Verify grid saves using absolute instants across different display/editor zones, and ignore display-zone changes as resize triggers.

## 0.2.12 — October 27, 2026

- Replace the floating duration button with faint inline autocomplete text at the end of the event title.
- Enter or Tab accepts the hint without saving the event; Escape dismisses it. The hint follows the title font and stays inside its field.
- Hide hints while selecting or editing earlier title text, using an input method, or working in another field. Keep the existing preference to turn suggestions off.
- Stop recording suggestion instruction counts.

## 0.2.11 — October 27, 2026

- Let Option-drag copies finish without waiting for the unchanged source event, so a copied block can update its duration immediately when resized.
- Dismiss the duration suggestion immediately when Escape starts closing an event editor or its Close button is pressed.
- Shorten the visible instruction to “Press Tab to add.” After three event suggestions or two accepted suggestions, show only the calculated duration while keeping Tab and click available.

## 0.2.10 — October 26, 2026

- Open a welcome page on first install that explains Google Calendar access and offers a one-click connection for fast grid saves.
- Enable the direct API save setting after a successful connection. Keep keyword, suggestion, and editor-based features available when the user skips or cannot connect.
- Prepare the first-install flow and optional Calendar API access for an unlisted Chrome Web Store update.

## 0.2.9 — development build, October 26, 2026

- Add an optional Google Calendar API connection for fast, tab-free title saves after a one-time event is moved or resized.
- Verify the event's new times and version before changing only its title, and retain the inactive editor fallback if direct saving is unavailable.
- Keep the OAuth access token in restricted local extension storage. Live-tested in Edge with a resize and restore of today's SCU Block; Calendar confirmed both title and time changes.
- This development build has not been submitted to the Chrome Web Store.

## 0.2.8 — development build, October 26, 2026

- Recognize an invalidated extension context after an unpacked extension reload. Stop the stale Calendar tab's grid updates and show a refresh prompt without recording a resize error.

## 0.2.7 — development build, October 26, 2026

- Apply `/hours` before Calendar handles Enter, Save, or form submission, closing the fast-save race.
- Save settings changes automatically, so enabling minutes below one hour takes effect without a second Save click. Keep the Save settings button available.
- Cover a rapid Allergy Shot edit that should save as `Allergy Shot (30 minutes)`.

## 0.2.6 — development build, October 26, 2026

- Show a small information button beside the replacement checkbox when Dynamic or automatic time-change updates keep it enabled. The explanation names the setting that locks it.

## 0.2.5 — development build, October 26, 2026

- Enable automatic insertion for matching titles and updates for existing duration suffixes by default on first setup. Explicitly saved off choices remain off.
- Shorten the existing-duration update setting's label and explanation.
- Keep automatic insertion from replacing an existing suffix, so a matching phrase with Dynamic off stays unchanged after time edits.

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
