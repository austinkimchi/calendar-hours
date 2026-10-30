# Calendar Hours

[![CI](https://github.com/austinkimchi/calendar-hours/actions/workflows/ci.yml/badge.svg)](https://github.com/austinkimchi/calendar-hours/actions/workflows/ci.yml)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![Chrome + Edge](https://img.shields.io/badge/Chrome%20%2B%20Edge-compatible-2d6cdf)

Calendar Hours adds the elapsed time to Google Calendar event titles. A 10:15am–1:25pm event can become **Work session (3.17 hours)**. It works in Chrome and Microsoft Edge.

## Features

- Add a duration with a title suggestion, `/hours`, a keyboard shortcut, or the extension popup.
- Display hours or minutes, with custom rounding, increments, units, and title templates. Short events can switch to minutes automatically.
- Match phrases such as `Work block` and enable **Auto-update** separately for each phrase. Titles with an existing duration can also update after time changes.
- Connect Google Calendar for fast title saves when moving or resizing a one-time event. The first-install welcome page offers this connection; the regular Calendar editor method remains available without it.
- Optionally import matching calendar blocks into Workday as unsubmitted time entries, with duplicate detection and updates to overlapping drafts.
- Keep preferences across computers using your browser's built-in sync.

## Preview

![Calendar Hours settings with matching phrases and duration formatting](store-assets/settings-screenshot.png)

## Getting Started

1. Download `calendar-hours-<version>.zip` from [GitHub Releases](https://github.com/austinkimchi/calendar-hours/releases/latest) and extract it into a permanent folder. Use the named release asset, rather than GitHub's Source code ZIP.
2. Open Chrome or Edge's Extensions page, enable **Developer mode**, and choose **Load unpacked**. Select the extracted folder.
3. Refresh your open Google Calendar tabs.

Open a timed event, enter its start and end times, then type `/hours` in the title or press **Enter** or **Tab** to accept the faint inline duration suggestion. Accepting the suggestion only updates the title; save the event in Calendar afterward. Turn off **Show inline duration suggestions** in More options to hide the hint. Settings let you customize the format and matching phrases.

The optional connection in **Settings → General → Google Calendar** is shared by fast title saves and Workday import. Enable **Use faster saves** or **Enable Workday import** separately. Google Calendar API sign-in is currently limited to approved OAuth test users; broader access requires Google's OAuth review. [Store publication details](STORE_LISTING.md) are tracked separately.

<details>
<summary>Updating an unpacked installation or using the source build</summary>

Release ZIPs include the public store key, giving them the same registered OAuth ID on every computer: `gkhggalcelmdidfdnllmdpaaapjiegig`. To update, replace the files in the same folder, reload the extension, and refresh Calendar and Workday tabs.

An older unpacked copy with a different ID has separate settings. Record its settings and disable it before configuring the new copy. Test store and unpacked copies with the same ID in separate browser profiles.

Developers can load [`extension/`](extension/) directly, but its path-derived ID may need its own OAuth registration. Packaging preserves the source installation's identity and preferences.

</details>

## Settings across computers

Calendar Hours uses browser sync automatically; it needs no Firebase account or extra Google Calendar permission.

1. Install the same extension build/ID on each computer.
2. Sign into the same **browser account** and enable extension/settings sync in that browser's profile settings.
3. Change a preference. Open Calendar Hours settings on the other computer to check that it arrived. Workday preferences still require **Save import settings**.

**Chrome syncs with Chrome; Edge syncs with Edge.** These services do not share settings with each other. Signing into Google Calendar alone does not enable browser sync. Development and release builds with different extension IDs have separate preferences.

Formatting, matching phrases, feature switches, and Workday import preferences sync. Google sign-in tokens stay on each device, so connect Google Calendar separately where needed. Workday's saved payroll time zone syncs; automatic detection of the device/Calendar time zone remains local.

Open settings pages receive incoming changes without discarding unsaved edits. Saves write only edited preferences, so changes to different preferences can merge. Changes to the same preference, phrase list, or calendar selection follow the browser's conflict resolution. An unsaved local edit is kept until you save it.

**Saved in this browser** confirms local storage, not delivery to another computer. While offline or with browser sync disabled, settings remain local; the browser handles delivery when sync is available. Update all devices to this build: older versions do not understand the new per-preference Workday storage. [Sync behavior and verification](SYNC_TESTING.md).

## Time zones

Time zone detection is automatic. Calendar Hours follows Google Calendar’s primary display zone and an event’s own start/end zones when available; otherwise it reads the device’s current zone. It recalculates from IANA zone rules for the event date, including daylight saving time. It does not change Calendar or system settings or request location access. If Calendar is kept in your home zone while traveling, the extension follows that choice.

Repeated or nonexistent clocks during a daylight-saving transition cannot be resolved from the editor alone, so the title is left unchanged. [Implementation and verification notes](TIME_ZONE_TESTING.md) describe detection and its limits.

## Workday import (optional preview)

Copy matching Google Calendar work blocks into Workday from **Actions → Auto-fill from Calendar**. The preview supports the English **Enter Time** Day/Week calendar and In/Out entry form; Workday layouts vary by organization.

1. Connect Google Calendar in **Settings → General**.
2. In **Workday import**, select your calendar(s), enter an event-title phrase such as `Work block`, choose your payroll time zone, and enable/save the settings. Allow Workday site access and refresh its tab if needed.
3. Open the day or week you want in Workday and choose **Actions → Auto-fill from Calendar**.

The importer uses exact calendar times and skips entries already present. **Overwrite existing times to match calendar** is on by default and can update one overlapping, unsubmitted draft. Submitted entries and ambiguous overlaps require manual correction. Your saved payroll time zone stays fixed when you travel.

New entries have blank comments, and only completed blocks are included by default. Settings let you include unfinished blocks or copy event descriptions into comments. With comments off, updates preserve existing comments; with them on, the description replaces the comment.

Record unpaid breaks as gaps between work events—for example, 10 AM–noon and 12:30–6 PM. Meal automation is unavailable in this release. Deleted events and events moved entirely outside their old times do not remove existing Workday entries. Overnight entries and ambiguous daylight-saving times require manual handling.

**Imported entries remain drafts for you to check and submit.** The extension never clicks Review or Submit. See [Workday verification and limitations](WORKDAY_TESTING.md) for supported cases and test coverage.

## Development

```bash
npm ci
npm test
npm run package
```

CI runs the tests and checks the package on pushes and pull requests. The package script writes a versioned ZIP under `dist/` with `manifest.json` at its root. It includes the public store key and checks that the resulting ID matches the registered OAuth identity. No private signing key is needed.

## Website

The [Calendar Hours site](https://calendarhours.austin.kim/) and its [privacy policy](https://calendarhours.austin.kim/privacy/) live in [`site/`](site/). Cloudflare Pages deploys that directory from `main` with no build command, so updating the page is a normal repository change. Keep the web policy in step with [`PRIVACY.md`](PRIVACY.md) when extension data use changes.

## Project Notes

- [Changelog](CHANGELOG.md)
- [Privacy and data use](PRIVACY.md)
- [Store listing and release status](STORE_LISTING.md)
