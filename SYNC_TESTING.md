# Browser settings sync

## Design

Use `chrome.storage.sync` for preferences in Chrome and Edge. The browser owns authentication, transport, offline delivery, and conflict resolution. No new permissions, Firebase service, account system, or Google scopes are added. The extension cannot determine whether browser sync is enabled or acknowledge delivery to another device.

- General preferences retain their existing top-level keys. Save only edited fields; keep correlated changes such as plural/singular unit edits together in the same write.
- Workday edits use `workdayIntegration.<field>` keys. Read the existing `workdayIntegration` object as a fallback for fields that have not been edited in the new format. Do not write defaults or run a destructive migration on startup. Explicit false values and empty calendar selections override older values. Retired meal flags remain disabled by the runtime normalizer.
- Old versions read/write the legacy Workday object and cannot see newer per-field overrides. Update all participating installations. Downgrading can show older Workday settings; no dual-writing is attempted because a whole-object write would reintroduce lost updates.
- Settings pages listen to `storage.onChanged`, apply incoming clean fields, and retain dirty local fields. Save only changed fields, including related fields that the UI updates together. Same-field edits and whole phrase/calendar lists use browser conflict resolution; this is not collaborative list editing.
- A new edit during a pending write remains dirty and can be saved afterward. Failed writes retain the draft for retry. The title settings auto-save debounce limits write frequency; Workday saves remain explicit.
- Stored settings are never initialized by overwriting the defaults. A delayed initial read cannot erase a newer storage change. Calendar content scripts retain raw settings so inherited templates follow remote changes correctly.
- Tokens stay in `storage.local`; OAuth must be connected separately per device. No events, session cookies, or detected device zones are added to synced data. A fixed payroll time zone is a synced preference.
- Existing sync quotas still apply, including the per-item size limit for lists. A rejected save reports the browser error and keeps the draft. There is no silent fallback to local-only storage that would appear to be a successful sync.

## Automated checks

`npm test` includes storage and settings-page integration tests for:

- Preserved legacy preferences and no writes on open/reopen.
- Independent edits from two simulated offline devices, delivered in both directions.
- Incoming edits during typing, invalid input, and pending writes.
- Same-field conflicts, explicit false/empty values, and deleted preferences.
- Incoming calendars, unavailable calendars, local calendar edits, and reconnect/refresh behavior.
- Quota rejection and retry, local-token isolation, and fixed payroll-zone preservation.
- Background import reads of the new per-field overrides and continued disabling of meal automation.

These simulate browser storage events; they do not establish delivery through Chrome's or Microsoft's live sync service.

## Two-computer acceptance check (pending)

1. Use the same browser, signed into the same browser account, with extension/settings sync enabled. Both installations must have the same extension ID and this build. Source builds with path-derived IDs may differ; inspect the IDs before testing.
2. Change a harmless title-format preference on computer A. Wait for the browser to sync, then confirm the value and preview on B without reopening settings. Reverse the direction with a different preference.
3. Keep an unsaved Workday phrase on B while changing the comments preference on A. Confirm the comments choice arrives, the phrase remains, and saving B preserves both. Do not run an import to test preference transport.
4. Disconnect one computer from the network, edit different preferences on both, then reconnect. Confirm both edits arrive. Same-field edits intentionally follow browser conflict resolution.
5. Reload each extension and confirm the preferences remain. Connect Google Calendar separately on the second machine if those features are needed; no token should have been copied.
6. Restore any preferences changed for the test. Do not claim cloud synchronization based only on a local Saved message.
