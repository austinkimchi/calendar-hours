# Workday release verification

## Automated checks

`npm test` covers Workday/OAuth, settings accessibility, and existing title-formatting regressions. `npm run package` produces a verified `calendar-hours-0.3.0.zip`.

The tests cover:

- Previously saved calendar-meal and automatic-meal settings cannot split work, deduct time, or change Out Reason. The controls are absent; normal settings and calendar migration are retained.
- Multi-calendar reads feed the planner and simulated forms, with exact work intervals, updates, and duplicate-free reruns.
- Message dismissal stays in effect through the current run, resets on the next run, returns keyboard focus to Actions, and keeps settings links conditional. The message width follows the Actions right edge.

- Configuring a readable Google calendar and an independent import phrase in settings.
- Time zone dropdown persistence, aliases, and settings help on label hover or keyboard focus. Help closes immediately when the pointer leaves the label or icon, including when moving over the help box or after focusing its control. Label clicks keep their normal checkbox behavior; Escape dismisses help without changing values or field focus.
- Actions defaults to Calendar on every opening. Arrow keys, Home/End, typeahead, and pointer hover keep the highlight and active descendant aligned; Enter activates only that option, including after Workday's delayed focus update.
- First-use setup routing, revoked permissions, removed calendars, and invalid settings.
- Trusted message senders; Google access tokens stay in the service worker.
- One shared authorization request for events and calendar-list permissions, with no forced repeat consent. Both permissions survive silent renewal, simultaneous connect requests share one window, and partial consent preserves the previous connection.
- Packaged public-key identity derives the registered store ID across install paths; packaging rejects unknown keys and leaves the raw development manifest untouched.
- General connection changes refresh the Workday picker without another authorization flow or preference changes. Legacy connections upgrade only on request; disconnect blocks imports while preserving their saved choices.
- Paginated Google Calendar reads with recurrence expansion and the displayed range's time-zone boundaries.
- Day/week date extraction, previous dates, cross-year weeks, and DST query boundaries.
- Saved Workday zones remain fixed across device travel and source-event zones. Both occurrences of a repeated DST clock require manual entry, even when a block lies wholly within one occurrence. Ordinary daytime blocks on transition days remain importable. A multi-day block spanning the entire requested day is reported rather than silently ignored.
- Exact minute times, lunch gaps, cancelled/all-day/future exclusions, duplicate reruns, source overlaps, and existing-entry conflicts.
- Existing overnight entries stop imports before planning or opening another form, including entries starting outside the displayed day, cross-year entries, and midnight endpoints. They are never truncated into editable same-day drafts.
- Individual entry form saves; wrong-date/existing-entry dialogs and navigation changes stop before saving.
- Overwrite existing times to match calendar defaults on and preserves explicitly saved off choices. One-to-one overlap updates edit unsubmitted drafts in place, recheck the target before saving, and skip the matching interval on rerun. Submitted/unknown statuses, different time types, split/merge ambiguity, and concurrent entry changes are rejected.
- Comments start blank on new entries. Optional Calendar descriptions are converted from inert rich text to plain text; titles are never used as comments. Existing comments are preserved with the option off and replaced with the option on.
- Workday zero-padded times, delayed edit-form fields/buttons, asynchronous duration calculation, and Discard Changes cleanup for unsaved drafts.
- Explicitly no Review, Submit, Next or Delete action in the import adapter.

## Live browser verification

Prior branch builds were verified on the English Workday Enter Time calendar using the approved developer extension and the user's saved Google Calendar setup:

- **Auto-fill from Calendar** appears first and is highlighted when Actions opens. Clicking Actions followed by Enter ran Calendar import. Arrow Down/Up navigated to Prior Week and back, Escape closed the menu, and reopening selected Calendar again.
- First use shows setup guidance and opens the Workday section in extension settings. Google consent and settings were completed by the user because the browser-control policy excludes extension-settings URLs.
- The configured current-week import saved the missing blocks through the normal individual form. Existing exact entries were skipped. All new entries visibly remained **Not Submitted**.
- A second current-week run added zero duplicates. The saved blocks and their exact intervals survived a page reload. An opened saved entry confirmed its configured Out Reason.
- With Update overlapping entries enabled by the user, a changed Calendar start time updated the same existing draft in place. The entry retained its identifier and Not Submitted status, with no additional entry. The updated interval survived a page reload, and a keyboard-triggered rerun reported 0 added, 0 updated, and all four blocks already entered.
- Description importing was left off for this live check. The new blank-comment default, preservation of existing comments, and optional description conversion/replacement are covered by automated form tests.
- Day view requested just its displayed day and recognized that day's existing blocks. A separate empty Day-view grid probe opened a form for the correct displayed date and was canceled without saving.
- Previous-week import used the previous displayed week, recognized its matching existing entries, and added no duplicates.
- The observed grid requires a pointer/mouse down-up sequence on its hit target. Click-only activation does not open the form. The adapter scrolls the selected quarter-hour row into view before selecting it.
- The live form pads morning hours with a leading zero, calculates duration asynchronously, and prompts to discard edited unsaved drafts. The adapter now handles all three behaviors, with regression tests.
- Completed-import status is cleared when the displayed dates change so it cannot describe the wrong day or week.

No Review or Submit action was taken. Empty and edited inspection drafts were canceled/discarded. Authorized imported entries were retained for user inspection. Personal calendar details, organization identifiers, screenshots and network payloads are kept outside this public repository.


## Release-specific scope

The 0.3.0 candidate removes meal automation from the runtime and settings. The existing live results above describe earlier builds; the complete release candidate has not been rerun against payroll data. The current release tests explicitly protect ordinary gap imports, ignore old enabled meal flags, and reject attempts to merge multiple old meal-generated drafts. Manual correction of existing payroll records is outside this release preparation.

No backend-request experiment is loaded or included in the package. The description-meal branch remains a paused draft pending HR clarification. Store publication and OAuth verification remain separate release gates in `STORE_LISTING.md`.

The release UI was also checked in Edge using a local preview with simulated Calendar responses: Actions + Enter starts import, the message and Actions right edges match exactly, × removes the message and returns focus to Actions, and settings show the four standard toggles with no meal controls despite saved prototype flags. This preview performs no payroll writes.
