# Calendar Hours

[![CI](https://github.com/austinkimchi/calendar-hours/actions/workflows/ci.yml/badge.svg)](https://github.com/austinkimchi/calendar-hours/actions/workflows/ci.yml)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Chrome + Edge](https://img.shields.io/badge/Chrome%20%2B%20Edge-compatible-2d6cdf)

Calendar Hours adds the elapsed time to Google Calendar event titles. A 10:15am–1:25pm event can become **Work session (3.17 hours)**. It works in Chrome and Microsoft Edge.

## Features

- Add a duration with a title suggestion, `/hours`, a keyboard shortcut, or the extension popup.
- Display hours or minutes, with custom rounding, increments, units, and title templates. Short events can switch to minutes automatically.
- Match phrases such as `Work block` and enable **Dynamic** separately for each phrase. Titles with an existing duration can also update after time changes.
- Connect Google Calendar for fast title saves when moving or resizing a one-time event. The first-install welcome page offers this connection; the regular Calendar editor method remains available without it.

## Preview

![Calendar Hours settings with matching phrases and duration formatting](store-assets/settings-screenshot.png)

## Getting Started

To try the current source build, load [`extension/`](extension/) as an unpacked extension in Chrome or Edge. Refresh any open Google Calendar tabs after reloading the extension. [Store publication details](STORE_LISTING.md) are tracked separately.

Open a timed event, enter its start and end times, then type `/hours` in the title or press **Enter** or **Tab** to accept the faint inline duration suggestion. Accepting the suggestion only updates the title; save the event in Calendar afterward. Turn off **Show inline duration suggestions** in More options to hide the hint. Settings let you customize the format and matching phrases.

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

CI runs the tests and checks the package on pushes and pull requests. The package script writes a versioned ZIP under `dist/` with `manifest.json` at its root.

## Project Notes

- [Changelog](CHANGELOG.md)
- [Privacy and data use](PRIVACY.md)
- [Store listing and release status](STORE_LISTING.md)
