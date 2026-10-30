# Google OAuth verification notes

Calendar Hours uses project `calendar-hours-512821` and the Web Store extension ID `gkhggalcelmdidfdnllmdpaaapjiegig`. The app homepage is [calendarhours.austin.kim](https://calendarhours.austin.kim/) and its [privacy policy](https://calendarhours.austin.kim/privacy/) is on the same domain. The verified Search Console domain property is `austin.kim`.

## Scope justification

| Scope | Use | Why narrower access is insufficient |
| --- | --- | --- |
| `calendar.events` | Read a qualifying event after a move or resize, then update only its title to show the new duration. Read selected calendar events for a user-triggered Workday draft import. | `calendar.events.readonly` cannot save the corrected title. `calendar.events.owned` would exclude editable shared calendars that the user selects. The extension does not request the broader `calendar` scope. |
| `calendar.calendarlist.readonly` | Show the user's available calendars, names, and IDs in the optional Workday calendar picker. | The event scope does not provide calendar discovery; the extension needs no write access to the calendar list. |

The Google connection is optional for title formatting. Fast API saves and Workday import are separately enabled in settings. The browser extension sends direct title changes to Google Calendar. It sends selected event times, and descriptions only with the separate comment switch, to the user's Workday organization when the user starts an import. It has no developer backend, analytics, or stored event history. Tokens stay in local extension storage; preferences may use browser sync.

## Reviewer demo

Google requests a video of the same app showing the complete English consent screen, the actual grant, and use of each scope. Use a generic test event and hide unrelated personal calendar data. Show:

1. Calendar Hours Settings → General → Connect Google Calendar; the full Google consent screen with both requested permissions; then Connected status.
2. Workday calendar picker populated from the read-only calendar list scope.
3. A generic one-time Calendar event resized with fast saves enabled, then its corrected title without an editor tab, showing use of event read/edit access.
4. Optionally, a user-triggered Workday import that leaves an unsubmitted draft, if the reviewer needs to see the event-read part of that feature. Never submit a time card in the video.

The video should be shared with Google's OAuth reviewers through the verification form. Redact account email, unrelated events, and Workday organization details before sharing. [Google's verification requirements](https://support.google.com/cloud/answer/13464321) and [submission steps](https://support.google.com/cloud/answer/13461325) are the source for this checklist.

## State on October 29, 2026

The site and policy are public. Google Cloud Branding has the site and policy URLs and `austin.kim` as an authorized domain. `calendar.events` is classified as sensitive, `calendar.calendarlist.readonly` as non-sensitive; there are no restricted scopes. The OAuth app remains in Testing with one test user until publication and verification submission are completed. Chrome Web Store v0.3.1 was pending review at the last observed dashboard check; verify its current status before filming.
