# Calendar Hours

Calendar Hours is a Manifest V3 extension for Google Calendar in Chrome and Microsoft Edge. It calculates the elapsed hours between an event's start and end time and inserts the result into the event title. It runs in the Calendar page, without a server or Google Calendar API access.

Source and releases are kept in the [private GitHub repository](https://github.com/austinkimchi/calendar-hours). The [v0.1.0 release](https://github.com/austinkimchi/calendar-hours/releases/tag/v0.1.0) includes the packaged ZIP. The [Chrome Web Store submission notes](STORE_LISTING.md) record the current unlisted listing.

**Store status (October 26, 2026):** v0.1.0 is pending Chrome Web Store review. The unlisted store link will become installable in Edge after approval and automatic publication. Developer mode is not needed for the store version.

## Use

1. Open a timed event in Google Calendar's quick composer or full editor.
2. Enter a title and start/end times.
3. Click the duration suggestion beside the title, or press **Tab** while the title field is focused. The default format is `SCU Block (3.17 hours)` for a 10:15am–1:25pm event.
4. Save the event using Google Calendar's **Save** button.

Other ways to insert or update hours:

- Type `/hours` anywhere in the title. It is replaced when the times are valid.
- Press **Ctrl+Shift+H** on Windows/Linux or **Command+Shift+H** on macOS while an event editor is open. Browser shortcut conflicts can be resolved at `chrome://extensions/shortcuts` or `edge://extensions/shortcuts`.
- Click the extension icon, then **Add hours to open event**.
- In Settings, enable **Automatically insert for matching titles**. The default match word is `block`; add comma separated words or phrases as needed.

## Formatting

Settings allow 0–4 decimal places; nearest, down, up, or truncation rounding; 1/5/10/15/30/60 minute increments; fixed or trimmed trailing zeros; custom unit text (`hours`, `hrs`, `hr`); and a title template using `{value}` and `{unit}`. An existing trailing `(… hours)`, `(… hrs)`, or `(… hr)` is updated when the event time changes.

The initial settings use nearest rounding to two decimal places, a one minute increment, `hours`, and `({value} {unit})`.

## Privacy and scope

The extension has access only to `calendar.google.com/calendar/*` and asks for the `storage` permission to save settings. It reads visible event title and time fields, calculates locally, and changes the draft title only when a trigger is used or optional automatic mode is enabled. It never clicks Calendar's Save button. It does not make network requests or collect event data. See [PRIVACY.md](PRIVACY.md).

The current implementation supports Google Calendar's English quick composer and full event editor. Calendar changes to those page controls may require an extension update. All-day events, invalid times, and events longer than seven days are skipped. Elapsed time uses the browser's local time zone, so use the same time zone in Google Calendar for correct cross-day and daylight-saving calculations.

## Development and packaging

```sh
npm install
npm test
npm run package
```

The generated `dist/calendar-hours-0.1.0.zip` has `manifest.json` at its root and is ready to upload to the Chrome Web Store developer dashboard. Chrome Web Store extensions can also be installed in Microsoft Edge; Edge may ask you to allow extensions from other stores.

For a local development check only, load the `extension` folder from the browser's Extensions page. The store package does not need Developer mode after publication.

## Release process

1. Update `extension/manifest.json`, `package.json`, and `CHANGELOG.md` to a new version.
2. Run `npm test` and `npm run package`.
3. Commit and push to the private repository.
4. Create a GitHub release for the matching tag and attach the ZIP.
5. Upload the new ZIP to the Chrome Web Store. Store versions must increase on each upload.
