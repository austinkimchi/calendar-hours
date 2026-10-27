# Calendar Hours

[![CI](https://github.com/austinkimchi/calendar-hours/actions/workflows/ci.yml/badge.svg)](https://github.com/austinkimchi/calendar-hours/actions/workflows/ci.yml)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Chrome + Edge](https://img.shields.io/badge/Chrome%20%2B%20Edge-compatible-2d6cdf)

Calendar Hours adds the elapsed time to Google Calendar event titles. A 10:15am–1:25pm event can become **Work session (3.17 hours)**. It works in Chrome and Microsoft Edge.

## Workday developer preview

The `workday-integration` branch adds **Auto-fill from Calendar** as the first item in **Actions** to **Enter Time** on `www.myworkday.com`. This is an unpacked developer build, not a store release. Workday interfaces vary by organization; the adapter currently supports the English Day/Week calendar and In/Out time-entry form.

1. Load or reload `extension/` in Chrome or Edge, allow its Workday site access, and refresh the Workday tab.
2. Open extension settings → **Workday import** (or choose the new Actions item for guided setup).
3. Connect Google Calendar, choose a calendar, enter an independent matching phrase such as `Work block`, choose the Workday time zone from the dropdown, and enable/save the import settings. Calendar selection requests an additional read-only calendar-list permission. OAuth remains limited to the registered developer extension IDs and Google test accounts.
4. In Workday, display the desired week, previous week, or single day and choose **Actions → Auto-fill from Calendar**. The extension fetches that exact date range and saves matching blocks through Workday's normal **OK** action. The status banner reports results.

Matching ignores case and uses the same whole-word/phrase mechanism as title formatting. Calendar start/end times are used without duration rounding; lunch gaps remain gaps. Only completed blocks are included by default, with an opt-in for unfinished/future blocks. Repeating calendar events are expanded into their instances.

Exact existing entries are skipped on rerun. Other overlaps are reported and kept unchanged; this is an importer, not reconciliation of later edits or deleted calendar events. Overlapping source blocks are merged to avoid double-counting; adjacent blocks remain separate. Overnight, sub-minute and daylight-saving transition blocks require manual entry. A changed view or unexpected form stops the import. Successfully saved entries remain unsubmitted, including after a partial failure. **The extension never clicks Review or submits a time card.**

## Features

- Add a duration with a title suggestion, `/hours`, a keyboard shortcut, or the extension popup.
- Display hours or minutes, with custom rounding, increments, units, and title templates. Short events can switch to minutes automatically.
- Match phrases such as `Work block` and enable **Auto-update** separately for each phrase. Titles with an existing duration can also update after time changes.
- Connect Google Calendar for fast title saves when moving or resizing a one-time event. The first-install welcome page offers this connection; the regular Calendar editor method remains available without it.

## Preview

![Calendar Hours settings with matching phrases and duration formatting](store-assets/settings-screenshot.png)

## Getting Started

To try the current source build, load [`extension/`](extension/) as an unpacked extension in Chrome or Edge. Refresh any open Google Calendar tabs after reloading the extension. [Store publication details](STORE_LISTING.md) are tracked separately.

Open a timed event, enter its start and end times, then type `/hours` in the title or press **Tab** to accept the suggested duration. Save the event in Calendar. Settings let you customize the format and matching phrases. Hover over or focus an ⓘ button for a help tooltip without shifting the page. Tapping also works; press Escape or tap elsewhere to dismiss it.

Google Calendar API sign-in is currently limited to the project's OAuth test users. Broader distribution requires Google's OAuth review.

## Development

```bash
npm ci
npm test
npm run package
```

CI runs the tests and checks the package on pushes and pull requests. The package script writes a versioned ZIP under `dist/` with `manifest.json` at its root.

## Project Notes

- [Changelog](CHANGELOG.md)
- [Privacy and data use](PRIVACY.md)
- [Store listing and release status](STORE_LISTING.md)
