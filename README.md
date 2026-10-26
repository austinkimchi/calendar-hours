# Calendar Hours

Calendar Hours is a Manifest V3 extension for Google Calendar in Chrome and Microsoft Edge. It calculates the elapsed hours between an event's start and end time and inserts the result into the event title. It runs in the Calendar page, without a server or Google Calendar API access.

Source is kept in the [private GitHub repository](https://github.com/austinkimchi/calendar-hours). The [v0.2.2 release](https://github.com/austinkimchi/calendar-hours/releases/tag/v0.2.2) is the latest published release. This v0.2.3 build adds hours-suffix updates. The [Chrome Web Store submission notes](STORE_LISTING.md) record the unlisted listing.

**Store status (last verified October 26, 2026):** v0.1.0 was pending Chrome Web Store review. v0.2.2 was packaged for submission but dashboard access was blocked in this session. v0.2.3 is a development build. The unlisted store link will become installable in Edge after Google approves and publishes an accepted version. Developer mode is not needed for the store version.

## Use

1. Open a timed event in Google Calendar's quick composer or full editor.
2. Enter a title and start/end times.
3. Click the duration suggestion beside the title, or press **Tab** while the title field is focused. The default format is `Work session (3.17 hours)` for a 10:15am–1:25pm event.
4. Save the event using Google Calendar's **Save** button.

Other ways to insert or update hours:

- Type `/hours` anywhere in the title. It is replaced when the times are valid.
- Press **Ctrl+Shift+H** on Windows/Linux or **Command+Shift+H** on macOS while an event editor is open. Browser shortcut conflicts can be resolved at `chrome://extensions/shortcuts` or `edge://extensions/shortcuts`.
- Click the extension icon, then **Add hours to open event**.
- In Settings → General, add one row for each matching phrase. Enable **Automatically add hours to matching titles** to insert the duration when a matching event is composed. The default phrase is `block`.
- Turn on **Dynamic** for any phrase whose matching events should stay current. After you drag or resize a matching timed event on the Calendar grid, the extension shows the new hours immediately and saves the title from an inactive Calendar tab. Dynamic also updates the title when you change start or end fields in the editor; use Calendar's Save button for those manual edits. Matching ignores case and respects word boundaries. Existing phrase lists and the prior global keep-updated setting migrate to these rows automatically.
- In Settings → Other, turn on **Automatically keep titles with an hours suffix updated after time changes** to cover events where you inserted hours with `/hours` or a suggestion but did not configure a matching phrase. It detects the current Hours template plus older `hours`, `hrs`, and `hr` endings. Grid moves and resizes of one-time events update and save automatically; editor time changes update the title for you to save. If an event matches a configured phrase, that phrase's Dynamic switch takes precedence. This broader option is off by default.

## Formatting

Settings → Hours allows 0–4 decimal places; nearest, down, up, or truncation rounding; 1/5/10/15/30/60 minute increments; fixed or trimmed trailing zeros; custom unit text (`hours`, `hrs`, `hr`); and a title template using `{value}` and `{unit}`. An existing trailing `(… hours)`, `(… hrs)`, or `(… hr)` is updated when the event time changes.

The initial settings use nearest rounding to two decimal places, a one minute increment, `hours`, and `({value} {unit})`.

## Privacy and scope

The extension has access only to `calendar.google.com/calendar/*` and asks for the `storage` permission to save settings. It reads visible event title and time fields and calculates locally. When Dynamic or the hours-suffix update setting applies, it opens an inactive Calendar tab and uses Calendar's own Save button after a matching grid move or resize. It does not make its own network requests or collect event data. The public [store privacy policy](https://gist.github.com/austinkimchi/6069defb02ecb9c38b5b2c7d4feb65c7) describes the submitted version; [PRIVACY.md](PRIVACY.md) describes this development build.

The current implementation supports Google Calendar's English quick composer and full event editor. Calendar changes to those page controls may require an extension update. All-day events, invalid times, events longer than seven days, and recurring events are skipped by grid auto-save. If Calendar asks for further confirmation, the extension leaves that decision to you. Elapsed time uses the browser's local time zone, so use the same time zone in Google Calendar for correct cross-day and daylight-saving calculations.

## Development and packaging

```sh
npm install
npm test
npm run package
```

The generated `dist/calendar-hours-0.2.3.zip` has `manifest.json` at its root. Chrome Web Store extensions can also be installed in Microsoft Edge; Edge may ask you to allow extensions from other stores.

For a local development check only, load the `extension` folder from the browser's Extensions page. The store package does not need Developer mode after publication.

## Release process

1. Update `extension/manifest.json`, `package.json`, and `CHANGELOG.md` to a new version.
2. Run `npm test` and `npm run package`.
3. Commit and push to the private repository.
4. Create a GitHub release for the matching tag and attach the ZIP.
5. When the user decides to update the Chrome Web Store listing, update its public disclosures and upload the new ZIP. Store versions must increase on each upload.
