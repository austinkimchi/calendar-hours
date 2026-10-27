# Workday request workflow experiment

## Decision

**A four-entry request batch is feasible without dialogs. Reusing calendar state and verifying once at the end reduced the median from 9.88 to 6.57 seconds (33.5%). This is a gain over repeating the original request probe, not an established gain over the installed importer. Keep the current importer while the remaining validation work is completed.**

This branch contains an opt-in developer probe, a DOM comparison harness, synthetic regression tests, and measurements. Neither harness is loaded by the extension manifest or included in its packaged ZIP. There are no new permissions, settings, or background requests.

## Four-entry batches — 2026-10-27

Three trials per request strategy, in counterbalanced order, in the same signed-in Edge session. Every trial used the same four existing drafts across two days. Each entry had its end time validated at +1 minute and restored before saving its original values. All nine measured request batches completed, displayed zero dialogs, and verified the full calendar snapshot. A preliminary final-verification batch took 6,881.7 ms and is excluded from the table.

| Strategy | Trial 1 | Trial 2 | Trial 3 | Median | Requests / four entries |
| --- | ---: | ---: | ---: | ---: | ---: |
| Repeat original single-entry probe | 11,724.9 ms | 9,884.3 ms | 9,457.2 ms | **9,884.3 ms** | 24 |
| Reuse each verified calendar as the next starting state | 8,597.2 ms | 8,506.5 ms | 8,419.2 ms | **8,506.5 ms** | 21 |
| Read once; verify the full batch once at the end | 6,574.8 ms | 6,357.0 ms | 6,643.4 ms | **6,574.8 ms** | 18 |

The second strategy saves three redundant reads (13.9% faster at the median); the third saves six (33.5% faster, 25% fewer requests). For N entries the request counts are 6N, 1+5N, and 2+4N. Writes remain sequential. Every entry still opens a fresh form and checks its original date, times, type and draft status; every save requires the expected confirmation. Final verification compares all timed entries, including entries outside the batch.

`runBatch` defaults to verification after **each** entry. The `end` option is an experiment: it detects a changed calendar later, after some drafts may already have been saved, and it has no rollback. A failure stops the batch, reports how many entry probes finished, and never retries an uncertain save. The final-only strategy successfully reused the initial model's Edit URIs in these trials; that does not establish their lifetime in other sessions or after arbitrary changes.

### Native batch comparison did not complete

Three native-dialog batch attempts timed out opening or initializing a form, including between entries after some original-value saves completed. The first attempt exposed the fractional-hours equality check; it now allows the server's six-decimal rounding. Later attempts still failed to open a subsequent form. Waiting for the main pane to leave its hidden accessibility state did not resolve that failure and was not retained. The calendar was inspected and reloaded between troubleshooting attempts; no failed run is included as a successful timing sample. The precise native UI race remains unresolved.

Consequently there is **no valid four-entry native median**, and the earlier single-entry results below must not be multiplied by four and presented as a measured batch result. These request measurements also exclude repainting Workday's live page, Google Calendar fetching/planning, new-entry creation, and permanently changed values. They are a controlled existing-draft workflow experiment, not end-to-end import throughput.

### Request profile: response waiting dominates

The new opt-in profiler records durations, byte counts, protocol and optional Server-Timing metrics. It records no URL, request/response body, token, form identifier or employee data. Across the nine measured batches (189 requests):

| Request kind | Count | Median total | Median TTFB | Median download | Median JSON parse |
| --- | ---: | ---: | ---: | ---: | ---: |
| Read calendar | 45 | 526.2 ms | 512.9 ms | 6.2 ms | 0.6 ms |
| Open entry | 36 | 411.2 ms | 399.9 ms | 5.8 ms | 0.5 ms |
| Validate field | 72 | 281.5 ms | 270.4 ms | 5.4 ms | 0.1 ms |
| Save draft | 36 | 404.0 ms | 394.2 ms | 5.8 ms | 0.2 ms |

TTFB accounted for **97.1% of summed request duration**. All requests used HTTP/2 with zero new connection time; no Server-Timing metrics were exposed. Calendar responses were the largest (about 80 KB decoded / 12 KB compressed), but their download and parse times were small. `fetch` header/body timings and Resource Timing phases can overlap; do not add their medians together.

[Chrome's timing reference](https://developer.chrome.com/docs/devtools/network/reference/#timing-explanation) defines TTFB as network round-trip latency plus server response preparation. It cannot identify database, validation-engine or server CPU costs. The [W3C Server Timing draft](https://www.w3.org/TR/server-timing/#introduction) describes the server-provided metrics needed to expose those internal costs. The [Resource Timing specification](https://www.w3.org/TR/resource-timing/) defines the request/response timestamps used here. Thus reducing sequential round trips is supported by this profile; a claim that a particular Workday backend component is slow is not.

### Other ways to reduce requests

1. **Native weekly form is the strongest next candidate.** Live inspection of Actions → Enter Time by Week showed multiple rows per day with exact In, Out, Out Reason, Time Type and Comment fields, including all four existing draft blocks. This could avoid opening and saving a separate form for every entry. The form also supplies blank default rows for empty days, so a prototype must distinguish those from real entries and preserve lunch gaps, worktags and comments. It was canceled without editing or advancing its Next step. Its request schema, validation behavior, draft-save semantics and performance are not yet established; no bulk-save implementation is claimed.
2. **Combine field updates only after observing the native protocol.** The current two validations are intentional change/restore probes. Removing one would change the workload and is not a legitimate optimization of this benchmark. Actual imports need separate measurement of changed In/Out fields, required Out Reason, and optional comments. Do not bypass server validation just to reduce the count.
3. **Keep state reads shared within an operation.** This is the measured improvement above. A production version still needs concurrent-edit protection, failure reconciliation and one final UI refresh. Avoid caching flow keys between operations.
4. **Payload trimming and extra connection tuning are low priorities.** The measured download/parse costs are tiny and connections were already reused. Parallel form writes were not attempted: the observed flow protocol supplies evolving identifiers, and safe concurrent saves have not been demonstrated.

The retained sanitized measurements are in [`workday-batch-results.json`](workday-batch-results.json). Original entry times, count and Not Submitted status were confirmed again in Workday after the last batch and after canceling the weekly form. Nothing was reviewed, submitted, deleted, or newly created.

## Earlier single-entry results — 2026-10-27

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
- Not established: creation without dialogs, arbitrary updates persisted with new values, optional comments, other tenants/locales, expired sessions, submitted/locked records on the live service, a successful native batch comparison, or the native weekly form's save workflow. Synthetic tests cover rejection/recovery cases but do not establish live compatibility.

The original single-entry probe's per-step savings did not offset the extra state reads. The batch measurements above now demonstrate savings from sharing those reads, subject to the stated limits. Merely hiding the DOM dialog would still perform its rendering and would not demonstrate a speed improvement.

## Reproducing deliberately

This is a developer experiment, not a new Auto-fill mode. Use a controlled account or an approved existing draft. Inspect the fresh Network responses first: Workday's private protocol can change.

1. Load the request harness as a developer snippet in the intended Workday tab. It only defines `CalendarHoursRequestExperiment`; it does not run automatically.
2. Supply the **current observed** calendar JSON URL (without `clientRequestID`) and `X-Workday-Client` version. Do not paste credentials or old flow identifiers into code.
3. Call `create({calendarUrl, clientVersion, origin: location.origin}).run({date, start, end, type})`. `start`/`end` are minutes after midnight and must match the displayed draft. The probe temporarily validates `end + 1`, restores `end`, then saves. Capture the returned timing object only.
4. For the DOM comparison, load `workday-dom-performance.js` and supply `doc`, the current `workday-content.js` module exports, `workday-core.js` module exports, and the same target. CommonJS wrappers can expose these modules for a debugging session without installing another extension or calling their installer.
5. Alternate paths; stop on any exception. Never automatically retry an uncertain save. Compare complete trials and record any exclusions.
6. Reload Workday, verify all original entries and status, and discard the temporary debugging globals by that reload. No extension reload or permission expansion is needed.

For a request batch, supply distinct approved targets to `client.runBatch(targets, {verification: "each"})` or the experimental `{verification: "end"}`. Empty, duplicate, over-20-entry and concurrent batches are rejected. For profiling, load `workday-request-profiler.js`, create `const profiler = CalendarHoursRequestProfiler.create()`, and pass `fetcher: profiler.fetcher` when creating the request client. Capture `profiler.measurements` with each returned result. Increase the page's resource timing buffer for long sessions; a missing Resource Timing record is reported as absent rather than zero.

The measured request strategy order was original / each / end; end / each / original; each / original / end. Original means sequentially calling `run` once per target with the same target order. Timings exclude snippet loading and debugging-tool transport.

`npm test` runs the synthetic tests. `npm run package` packages only `extension/`, leaving this experiment out of the installed product.
