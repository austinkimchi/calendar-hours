# Workday request workflow experiment

## Decision

**Opening and saving a draft without displaying a dialog is feasible for the observed form. It was not faster in this experiment. Keep the current importer.**

This branch contains an opt-in developer probe, a DOM comparison harness, synthetic regression tests, and measurements. Neither harness is loaded by the extension manifest or included in its packaged ZIP. There are no new permissions, settings, or background requests.

## Live results — 2026-10-27

Five paired trials in the same signed-in Edge tab, alternating the order of the DOM and request paths. Each trial opened the same existing draft, validated an unsaved one-minute increase to its end time, validated restoration of the original end time, saved those original values, and verified the resulting calendar. No new entries were created. Four entries retained their original times and remained Not Submitted after a final page reload.

| Trial | Visible form | Request workflow | Visible dialogs: form / request |
| --- | ---: | ---: | ---: |
| 1 | 1,850.0 ms | 2,668.6 ms | 1 / 0 |
| 2 | 1,842.5 ms | 2,441.3 ms | 1 / 0 |
| 3 | 1,684.4 ms | 2,514.4 ms | 1 / 0 |
| 4 | 1,665.4 ms | 2,495.5 ms | 1 / 0 |
| 5 | 1,914.5 ms | 2,525.5 ms | 1 / 0 |
| **Median** | **1,842.5 ms** | **2,514.4 ms** | |

The request path took **671.9 ms longer (36.5%)** at the median. These are observations from one tenant/session and five pairs, not a general performance guarantee.

| Phase | Visible form median | Request median |
| --- | ---: | ---: |
| Read fresh calendar model | Uses displayed calendar | 598.7 ms |
| Open entry | 664.5 ms | 434.0 ms |
| Validate temporary end time | 316.1 ms | 291.3 ms |
| Validate restored end time | 307.6 ms | 231.6 ms |
| Save and render replacement calendar | 525.6 ms | — |
| Save | — | 411.6 ms |
| Read calendar to verify result | — | 541.6 ms |

Individual phase medians do not necessarily sum to the median total. The request path's total **excludes repainting the live Workday UI**. It verifies the returned calendar model. A production implementation would still need to refresh the page or safely update Workday's client state, so the comparison already favors the request approach.

The visible harness follows the current adapter's selectors, setters and 100 ms polling cadence. It adds the same two-step validation probe as the request harness. This is a controlled form-workflow comparison, not a measurement of an entire Calendar import. Because the saved values are unchanged, it explicitly waits for the old calendar element to be replaced; checking only the old displayed times would undercount the refresh cost.

Preliminary discovery runs are excluded. One later DOM probe exceeded the debugging command's three-second wait; its outcome was inspected, the original values were verified, and the unrecorded timing was excluded. The five complete pairs used a longer command timeout. This small sample does not characterize tail latency.

## Observed protocol

1. Read the current Enter Time calendar JSON with a same-origin GET. It supplies a fresh session token and per-entry Edit URI.
2. POST that entry's supplied Edit URI. The response includes the current form fields, date, draft status, form identifier, flow key, validation identifiers and OK control.
3. POST time components and `_eventId_validate` to the form's supplied `flowController` route. Require the returned time, recalculated hours and next flow key. Repeat to restore the original time.
4. POST `_eventId_submit` and an XML change summary containing **only the discovered `wd:OK` control**. This internal event name saves the individual draft; it is not the time-card Submit action. Require the expected saved confirmation.
5. GET fresh calendar data and compare all timed entries to the pre-probe snapshot. The normal UI separately reloads calendar data and the totals sidebar.

No captured session token, flow key, employee identifier, request body, or live response is in this repository. The code uses identifiers from each fresh response. It does not copy a previously captured save request. Request parameters and credentials stay in the page session and are not logged by either harness.

## Guardrails and limits

- Same-origin, observed tenant routes only; redirects are rejected.
- One existing matching draft, exact original date/times and Time Type, Not Submitted status, and no neighboring overlap during the probe.
- Both server validations must confirm exact time and duration before OK.
- Only original values are saved. Comments, Out Reason and other fields are retained.
- Unexpected form/validation responses stop before save and attempt to cancel that unsaved flow.
- A failed or ambiguous save is never retried and never falls back to clicking OK again. Inspect Workday before another attempt.
- Concurrency is rejected within one probe instance. Keep the tab idle during a probe; this is not a production cross-tab locking solution.
- No Review, time-card Submit, Delete, new-entry creation, or permanent time change is exercised.
- Not established: creation without dialogs, arbitrary updates persisted with new values, optional comments, other tenants/locales, expired sessions, submitted/locked records on the live service, or batch performance. Synthetic tests cover rejection/recovery cases but do not establish live compatibility.

The small per-step savings do not offset the extra state reads. Reusing an observed calendar model or reducing refreshes across a batch might help, but would require freshness/locking and verification work. No improvement from those ideas has been measured. Merely hiding the DOM dialog would still perform its rendering and would not demonstrate a speed improvement.

## Reproducing deliberately

This is a developer experiment, not a new Auto-fill mode. Use a controlled account or an approved existing draft. Inspect the fresh Network responses first: Workday's private protocol can change.

1. Load the request harness as a developer snippet in the intended Workday tab. It only defines `CalendarHoursRequestExperiment`; it does not run automatically.
2. Supply the **current observed** calendar JSON URL (without `clientRequestID`) and `X-Workday-Client` version. Do not paste credentials or old flow identifiers into code.
3. Call `create({calendarUrl, clientVersion, origin: location.origin}).run({date, start, end, type})`. `start`/`end` are minutes after midnight and must match the displayed draft. The probe temporarily validates `end + 1`, restores `end`, then saves. Capture the returned timing object only.
4. For the DOM comparison, load `workday-dom-performance.js` and supply `doc`, the current `workday-content.js` module exports, `workday-core.js` module exports, and the same target. CommonJS wrappers can expose these modules for a debugging session without installing another extension or calling their installer.
5. Alternate paths; stop on any exception. Never automatically retry an uncertain save. Compare complete trials and record any exclusions.
6. Reload Workday, verify all original entries and status, and discard the temporary debugging globals by that reload. No extension reload or permission expansion is needed.

`npm test` runs the synthetic tests. `npm run package` packages only `extension/`, leaving this experiment out of the installed product.
