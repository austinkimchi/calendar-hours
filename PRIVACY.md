# Calendar Hours privacy policy

Updated November 6, 2026. The [public privacy policy](https://calendarhours.austin.kim/privacy/) is the canonical version. [Jump to data protection](https://calendarhours.austin.kim/privacy/#data-protection).

## Google user data accessed

On an open Google Calendar page, Calendar Hours reads visible event titles, dates, start and end times, and displayed time zone information to calculate durations. If you choose **Connect Google Calendar**, Google grants the extension permission to view and edit events on calendars you can access (`calendar.events`) and read your calendar list (`calendar.calendarlist.readonly`). The extension reads a qualifying event's title, start and end times, status, and version before a direct title save. The optional Workday import reads events in the dates and calendars you select, including event descriptions only if you enable description comments. The calendar picker reads calendar names, IDs, time zones, and access information. The extension does not request your Google profile, contacts, email, files, or location.

## How Google user data is used

Calendar Hours calculates elapsed hours or minutes and suggests or inserts a duration in an event title. When you move or resize a qualifying one-time event and enable automatic updates, it can read that event through the Google Calendar API and save a corrected **title only**; it does not change the event's start or end time. If the direct save cannot run, it may open an inactive Google Calendar editor tab and use Calendar's Save button. An event you are editing yourself still needs your Save action. The calendar list is used only to populate the optional Workday calendar picker.

When you start **Auto-fill from Calendar** in Workday Enter Time, the extension reads events from your selected calendars for the displayed dates, matches your configured phrase, and enters their time intervals into Workday as unsubmitted drafts for your review. It never submits a time card. Time zone calculations use Calendar's displayed zone or your device's zone locally; the extension does not change either setting.

## Sharing and disclosure

Direct event reads and title changes are sent between the extension and Google Calendar. If you start a Workday import, the extension transfers matching event time intervals to *your* Workday organization through its visible form. Event descriptions are transferred as comments of up to 1,000 characters only if you separately enable **Import event descriptions as comments**; event titles are not copied into comments. Your Workday organization controls data entered into Workday under its own policies.

Selected Google calendar IDs and names are stored as preferences in browser sync storage. If you use browser sync, Chrome or Edge may transfer these preferences through its own sync service under your browser account. Google OAuth access tokens stay in local extension storage and are not included in browser sync. The Calendar Hours developer does not receive, sell, or share your Google Calendar events or tokens with advertisers or data brokers. The extension has no analytics, advertising, developer account system, Firebase service, or developer-operated data server.

## Data protection: how we secure Google user data

We protect Google user data, including calendar names and IDs, event titles, times and optional descriptions, and OAuth access tokens, using the following mechanisms:

- **Encryption in transit.** Requests to Google's Calendar API and OAuth services use HTTPS (TLS), which encrypts the data while it travels between your browser and Google. User-requested Workday imports use the employer's HTTPS Workday page.
- **Restricted access to tokens.** Google API requests run in the extension's background code. Short-lived OAuth access tokens are kept in local extension storage, excluded from browser sync, and are not sent to Calendar or Workday web pages or to the developer. Where the browser supports it, local token storage is restricted to trusted extension contexts rather than content scripts.
- **Sign-in and update validation.** The extension validates Google's sign-in response against a randomly generated request value and the expected redirect address before accepting a token. Before an API title update, it checks the event's title, times and version to avoid overwriting a concurrent edit.
- **Limited event-data storage.** Event records used for calculations and imports are processed temporarily in browser memory and are not saved to extension storage or a developer database. Selected calendar names and IDs are retained separately as preferences, as described under Sharing and disclosure.
- **Disconnection and credential handling.** Disconnecting Google Calendar removes the local access token and requests revocation from Google. The extension does not read or store Google or Workday account passwords or Workday cookies.

Local storage protection relies on the browser's extension isolation and your device's security. Calendar Hours does not add its own encryption at rest to local extension storage; the encryption described above protects network traffic. Retention and deletion controls are described below.

## Retention and deletion

Calendar Hours does not maintain a developer copy or history of Google Calendar events. Event data used for a calculation, direct save, or Workday import is held temporarily in browser memory and is not persisted in extension storage. An updated title remains in your Google Calendar until you edit or delete it there. Workday drafts remain with your organization until you change or delete them in Workday.

The short-lived Google OAuth access token remains in local extension storage until you disconnect Google Calendar, remove the extension, or a later authorization replaces it; an expired token cannot be used for API access. **Disconnect Google Calendar** in extension settings removes the local token and asks Google to revoke it. Removing the extension clears its local storage. Formatting options, matching phrases, selected calendar IDs and names, and Workday preferences remain in browser sync storage until you change or clear them; your browser provider controls any synced copies and their retention. Clear extension sync data through your browser's sync controls if you also want those copies removed.

## Your controls and contact

You can use basic title suggestions without connecting Google, disable automatic updates and Workday import separately, disconnect Google Calendar, or remove the extension. For support or questions about this policy, use [Calendar Hours support](https://github.com/austinkimchi/calendar-hours/issues) or the contact on its [Chrome Web Store listing](https://chromewebstore.google.com/detail/calendar-hours/gkhggalcelmdidfdnllmdpaaapjiegig).
