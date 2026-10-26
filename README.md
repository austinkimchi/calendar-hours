# Calendar Hours

Calendar Hours is a Manifest V3 extension for Google Calendar in Chrome and Microsoft Edge. It calculates the elapsed duration between an event's start and end time and inserts hours or minutes into the event title. An optional direct Google Calendar API connection can save grid changes without opening an editor tab.

Source is kept in the [private GitHub repository](https://github.com/austinkimchi/calendar-hours). Version 0.2.10 adds a first-install welcome page for the optional Google Calendar API connection. The [Chrome Web Store submission notes](STORE_LISTING.md) record the unlisted listing.

**Store status (verified October 26, 2026 in the publisher dashboard):** v0.1.0 is pending review; no version is published, and package upload is disabled during review. v0.2.10 is a local development build and has not been submitted. The unlisted store link will become installable in Edge after Google approves and publishes an accepted version. Developer mode is not needed for the store version.

## Use

On first install, Calendar Hours opens a welcome page. Choose **Connect Google Calendar** to authorize fast grid saves; the extension then enables that setting automatically. You can open Calendar without connecting and connect later in Settings → Other. Updates to an installed extension do not reopen the welcome page.

1. Open a timed event in Google Calendar's quick composer or full editor.
2. Enter a title and start/end times.
3. Click the duration suggestion beside the title, or press **Tab** while the title field is focused. The default format is `Work session (3.17 hours)` for a 10:15am–1:25pm event.
4. Save the event using Google Calendar's **Save** button.

Other ways to insert or update the duration:

- Type `/hours` anywhere in the title. It is replaced when the times are valid.
- Press **Ctrl+Shift+H** on Windows/Linux or **Command+Shift+H** on macOS while an event editor is open. Browser shortcut conflicts can be resolved at `chrome://extensions/shortcuts` or `edge://extensions/shortcuts`.
- Click the extension icon, then **Add duration to open event**.
- In Settings → General, add one row for each matching phrase. **Automatically add duration to matching titles** starts on for a new installation and inserts the duration when a matching event is composed. The default phrase is `block`.
- Turn on **Dynamic** for any phrase whose matching events should stay current. After you drag or resize a matching timed event on the Calendar grid, the extension shows the new duration immediately and saves the title. Dynamic also updates the title when you change start or end fields in the editor; use Calendar's Save button for those manual edits. Matching ignores case and respects word boundaries. Existing phrase lists and the prior global keep-updated setting migrate to these rows automatically.
- In Settings → Other, **Update hours or minutes when times change** starts on for a new installation. It covers events where you inserted a duration with `/hours` or a suggestion but did not configure a matching phrase. It detects the current Hours and Minutes templates plus older `hours`, `hrs`, `hr`, `minutes`, `mins`, and `min` endings. Grid moves and resizes of one-time events update and save automatically; editor time changes update the title for you to save. If an event matches a configured phrase, that phrase's Dynamic switch takes precedence. Saved off choices remain off.
- **Replace a previous duration when I add it again** stays on while Dynamic or automatic time-change updates need it. The information button beside the locked checkbox explains why.

## Formatting

Settings → Hours lets you display every duration in hours or minutes, or display minutes only when the actual duration is under one hour. The first time you enable minutes, its title template starts with your current Hours template; you can then change the Minutes template separately. Each unit has customizable plural and singular text, so the defaults produce `1 hour`, `2 hours`, `1 minute`, and `2 minutes`. The same section controls nearest, down, up, or truncation rounding and 1/5/10/15/30/60 minute increments. Hours also support 0–4 decimal places and fixed or trimmed trailing zeros. Templates use `{value}` and `{unit}`.

Settings changes save automatically. The Save settings button remains available for an explicit save; wait for the Saved status before using the new format in Calendar.

## Faster grid saves (optional test mode)

Settings → Other → **Use faster saves without opening an editor tab** connects Calendar Hours directly to the Google Calendar API. Click **Connect Google Calendar** and grant the requested event access. For a qualifying one-time grid move or resize, the extension reads that one event by its Calendar ID, waits until Calendar has saved the new times, and patches only its title. It checks the event version to avoid overwriting a simultaneous edit. If the API path is unavailable, it uses the existing inactive editor tab method. Disconnect revokes the token and turns off this mode.

This mode currently uses the separate **Calendar Hours** Google Cloud project (`calendar-hours-512821`) in OAuth testing. The signed-in test account is allowed; broader use requires Google's OAuth review. The extension requests permission to view and edit calendar events because the Calendar API does not offer a title-only permission. A short-lived OAuth access token is stored in local extension storage. When it expires, the extension tries a silent browser sign-in; if that requires interaction, grid saves use the editor method until you reconnect. No Calendar Hours server receives tokens.

The initial settings use hours, nearest rounding to two decimal places, a one minute increment, and `({value} {unit})`. Minutes display is off by default.

## Privacy and scope

The extension reads visible event title and time fields and calculates locally. Grid saves use an inactive Calendar tab by default. The optional API mode requests `identity`, local storage, and Google API host access. It sends the selected event ID to Google Calendar to read its current title/times and sends only the corrected title in the save request. It does not collect event data or send it to a Calendar Hours server. The public [store privacy policy](https://gist.github.com/austinkimchi/6069defb02ecb9c38b5b2c7d4feb65c7) describes the earlier submitted version; [PRIVACY.md](PRIVACY.md) describes this development build. The store listing and public policy must be updated before publishing API mode.

The current implementation supports Google Calendar's English quick composer and full event editor. Calendar changes to those page controls may require an extension update. All-day events, invalid times, events longer than seven days, and recurring events are skipped by grid auto-save. If Calendar asks for further confirmation, the extension leaves that decision to you. Elapsed time uses the browser's local time zone, so use the same time zone in Google Calendar for correct cross-day and daylight-saving calculations.

## Development and packaging

```sh
npm install
npm test
npm run package
```

The generated `dist/calendar-hours-0.2.10.zip` has `manifest.json` at its root. Chrome Web Store extensions can also be installed in Microsoft Edge; Edge may ask you to allow extensions from other stores.

For a local development check only, load the `extension` folder from the browser's Extensions page. After reloading the unpacked extension, refresh any open Google Calendar tabs once so their content script uses the new version. The store package does not need Developer mode after publication.

## Release process

1. Update `extension/manifest.json`, `package.json`, and `CHANGELOG.md` to a new version.
2. Run `npm test` and `npm run package`.
3. Commit and push to the private repository.
4. Create a GitHub release for the matching tag and attach the ZIP.
5. When the user decides to update the Chrome Web Store listing, update its public disclosures and upload the new ZIP. Store versions must increase on each upload.
