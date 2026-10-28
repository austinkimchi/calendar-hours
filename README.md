# Calendar Hours

[![CI](https://github.com/austinkimchi/calendar-hours/actions/workflows/ci.yml/badge.svg)](https://github.com/austinkimchi/calendar-hours/actions/workflows/ci.yml)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Chrome + Edge](https://img.shields.io/badge/Chrome%20%2B%20Edge-compatible-2d6cdf)

Calendar Hours adds the elapsed time to Google Calendar event titles. A 10:15am–1:25pm event can become **Work session (3.17 hours)**. It works in Chrome and Microsoft Edge.

## Workday developer preview

The `workday-integration` branch adds **Auto-fill from Calendar** as the first item in **Actions** to **Enter Time** on `www.myworkday.com`. This is an unpacked developer build, not a store release. Workday interfaces vary by organization; the adapter currently supports the English Day/Week calendar and In/Out time-entry form.

1. Load or reload `extension/` in Chrome or Edge, allow its Workday site access, and refresh the Workday tab.
2. Open extension settings → **General → Google Calendar** and connect once. The same connection supports title updates and Workday import; event access and read-only calendar-list access are requested together. Existing connections with both permissions are reused. Older event-only connections need one explicit upgrade. OAuth remains limited to the registered developer extension IDs and Google test accounts.
3. In **Workday import**, choose one or more calendars, enter an independent matching phrase such as `Work block`, choose the Workday time zone from the dropdown, and enable/save the import settings. Refresh calendars reads the shared connection without opening another authorization flow.
4. In Workday, display the desired week, previous week, or single day and choose **Actions → Auto-fill from Calendar**. The extension fetches that exact date range and saves matching blocks through Workday's normal **OK** action. The status banner reports results.

Matching ignores case and uses the same whole-word/phrase mechanism as title formatting. Calendar start/end times are used without duration rounding; lunch gaps remain gaps. Only completed blocks are included by default, with an opt-in for unfinished/future blocks. Repeating calendar events are expanded into their instances.

Exact existing entries are skipped on rerun. **Overwrite existing times to match calendar** replaces an overlapping, unsubmitted Workday draft's times with the Calendar block's times. It is on by default; a previously saved off choice is preserved. Each update must match exactly one draft of the configured Time Type to one calendar block. Submitted entries, other time types, and overlaps involving multiple existing or calendar blocks remain for manual correction. Deleted calendar events and blocks moved entirely outside their previous times do not remove old Workday entries.

### Unpaid meals

Both meal triggers start **off** and can be enabled together. Their shared placement and length fields appear when either trigger is enabled:

- **Add a meal when the description matches** looks for configurable whole words or phrases in the description of a matching work event, ignoring case. Defaults are `Breakfast, Lunch, Dinner, Meal Break`; add `Meal` or your own phrase if needed. The description does not need a time range. Reading it for meal detection is independent of copying comments to Workday.
- **Add a meal based on hours worked** triggers a meal even without a keyword. Both triggers use the same configurable placement (**5 worked hours**) and length (**30 minutes**), excluding gaps from worked time. When both triggers match, only one meal is deducted for that day. Work must continue after the full meal; an unplaceable keyword meal produces a warning instead of guessing a different time.

For example, a 10 AM–5:30 PM work event with `Meal` in its description and the defaults above becomes 10 AM–3 PM with **Out Reason = Meal**, a 3–3:30 PM unpaid gap, and 3:30–5:30 PM with **Out Reason = Out**: **7 worked hours**. Workday requires clock-out/in times, so the configured placement determines those times even though no interval is needed in the description.

Existing separate events with meal titles remain supported by the keyword option for compatibility. Their actual intervals take priority over either generated trigger. A meal already in a work gap is not deducted twice, and meal-title matching takes priority when a title also matches the work phrase.

For example, a 10 AM–5 PM work event and a 12–12:30 PM meal event produce 10 AM–12 PM with Out Reason Meal, an unpaid gap, and 12:30–5 PM with Out Reason Out: **6.5 worked hours**. Separate work events before and after the same meal work too. Do not create a separate Hours meal row in Workday: the live SCU test counted that interval as work and generated a meal premium.

Select up to ten calendars to include work and meals from different calendars. Reads use at most three concurrent requests, and an unreadable selected calendar stops the import before any writes. Existing single-calendar settings migrate automatically; unavailable saved calendars remain visible for correction.

With overwrite enabled, a meal can split one unambiguous, unsubmitted source draft into paid pieces, including when the calendar start or end has changed. The draft must overlap exactly one original calendar span, and that span must overlap only that draft. The first piece updates it; remaining pieces are added afterward. Ambiguous overlaps, submitted entries, and other time types stay untouched. With meals enabled, exact drafts are opened to check their Out Reason and canceled without saving when already correct. Removing or moving meals in ways that require merging multiple old entries still needs manual correction. Invalid, overnight, sub-minute, or daylight-saving-ambiguous meal times stop the import before writes.

New entries have **blank comments by default**. **Import event descriptions as comments** optionally copies Google Calendar's Description field as plain text, up to 1,000 characters, when adding or updating an entry. With it off, updates preserve existing comments. With it on, the description replaces the comment, including clearing it when the description is empty. Event titles are used for matching, never as comments.

Overlapping source blocks are merged to avoid double-counting; adjacent blocks remain separate. Overnight, sub-minute and daylight-saving transition blocks require manual entry. A changed view or unexpected form stops the import. Successfully saved entries remain unsubmitted, including after a partial failure. **The extension never clicks Review or submits a time card.**

## Features

- Add a duration with a title suggestion, `/hours`, a keyboard shortcut, or the extension popup.
- Display hours or minutes, with custom rounding, increments, units, and title templates. Short events can switch to minutes automatically.
- Match phrases such as `Work block` and enable **Auto-update** separately for each phrase. Titles with an existing duration can also update after time changes.
- Connect Google Calendar once in General (or on the first-install welcome page) for title saves and Workday import. Connection changes preserve feature preferences: turn on **Use faster saves** or **Enable Workday import** separately. The regular Calendar editor method remains available without a connection.

## Preview

![Calendar Hours settings with matching phrases and duration formatting](store-assets/settings-screenshot.png)

## Getting Started

To try the current source build, load [`extension/`](extension/) as an unpacked extension in Chrome or Edge. Refresh any open Google Calendar tabs after reloading the extension. [Store publication details](STORE_LISTING.md) are tracked separately.

Open a timed event, enter its start and end times, then type `/hours` in the title or press **Enter** or **Tab** to accept the faint inline duration suggestion. Accepting the suggestion only updates the title; save the event in Calendar afterward. Turn off **Show inline duration suggestions** in More options to hide the hint. Settings let you customize the format and matching phrases. Hover over a setting label or focus its field for routine help; key actions keep an ⓘ button. Tooltips do not shift the page and close immediately when the pointer leaves their label or icon. Press Escape or tap elsewhere to dismiss them.

Google Calendar connection requests use one authorization flow for both permissions and do not force repeat consent. Google may still require account selection, a missing permission, or renewed authorization. Disconnecting removes the shared connection for all features without erasing their settings.

Google Calendar API sign-in is currently limited to the project's OAuth test users. Broader distribution requires Google's OAuth review.

## Time zones

Time zone detection is automatic. Calendar Hours follows Google Calendar’s primary display zone and an event’s own start/end zones when available; otherwise it reads the device’s current zone. It recalculates from IANA zone rules for the event date, including daylight saving time. It does not change Calendar or system settings or request location access. If Calendar is kept in your home zone while traveling, the extension follows that choice.

Repeated or nonexistent clocks during a daylight-saving transition cannot be resolved from the editor alone, so the title is left unchanged. [Implementation and verification notes](TIME_ZONE_TESTING.md) describe detection and its limits.

## Development

```bash
npm ci
npm test
npm run package
```

Meal coverage includes multi-calendar fetching, independent matching, cumulative automatic breaks, draft splitting, Out Reason selection, and duplicate-free reruns through simulated Workday forms.

CI runs the tests and checks the package on pushes and pull requests. The package script writes a versioned ZIP under `dist/` with `manifest.json` at its root.

## Project Notes

- [Changelog](CHANGELOG.md)
- [Privacy and data use](PRIVACY.md)
- [Store listing and release status](STORE_LISTING.md)
