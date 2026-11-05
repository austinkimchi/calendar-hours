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

## Verification follow-up on November 6, 2026

The signed-in Google Auth Platform verification panel shows Homepage requirements, App functionality, Branding guidelines, and Request minimum scopes as complete. Data-access verification remains under review. Privacy policy requirements is the only flagged step: the November 5 feedback asks for data-protection mechanisms for sensitive data.

Branding already points to `https://calendarhours.austin.kim/privacy/`, and that public page loads correctly. The policy's expanded [data-protection section](https://calendarhours.austin.kim/privacy/#data-protection) names the protected data and explains HTTPS encryption in transit, token isolation, sign-in and concurrent-update validation, temporary event-data processing, and token removal/revocation requests. It explicitly distinguishes these protections from application-level encryption at rest, which the extension does not provide. The top of the policy links directly to the section.

The policy URL is unchanged. [Google's guidance](https://support.google.com/cloud/answer/13806988?hl=en) says to reply to the existing verification email after updating the policy; update the Cloud Console URL only if it changes. The verification panel also asks for a reply after resolving the issue. Do not restart or cancel the existing review. Prepare one reply draft from `austink765@gmail.com` in the latest verification thread with the direct section link; the user reviews and sends it. A policy deployment or draft is not Google approval.
