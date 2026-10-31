# Calendar Hours privacy policy

Updated October 31, 2026. The [public privacy policy](https://calendarhours.austin.kim/privacy/) is the canonical version.

## Google user data accessed

On an open Google Calendar page, Calendar Hours reads visible event titles, dates, start and end times, and displayed time zone information to calculate durations. If you choose **Connect Google Calendar**, Google grants the extension permission to view and edit events on calendars you can access (`calendar.events`) and read your calendar list (`calendar.calendarlist.readonly`). The extension reads a qualifying event's title, start and end times, status, and version before a direct title save. The optional Workday import reads events in the dates and calendars you select, including event descriptions only if you enable description comments. The calendar picker reads calendar names, IDs, time zones, and access information. The extension does not request your Google profile, contacts, email, files, or location.

## How Google user data is used

Calendar Hours calculates elapsed hours or minutes and suggests or inserts a duration in an event title. When you move or resize a qualifying one-time event and enable automatic updates, it can read that event through the Google Calendar API and save a corrected **title only**; it does not change the event's start or end time. If the direct save cannot run, it may open an inactive Google Calendar editor tab and use Calendar's Save button. An event you are editing yourself still needs your Save action. The calendar list is used only to populate the optional Workday calendar picker.

When you start **Auto-fill from Calendar** in Workday Enter Time, the extension reads events from your selected calendars for the displayed dates, matches your configured phrase, and enters their time intervals into Workday as unsubmitted drafts for your review. It never submits a time card. Time zone calculations use Calendar's displayed zone or your device's zone locally; the extension does not change either setting.

## Sharing and disclosure

Direct event reads and title changes are sent between the extension and Google Calendar. If you start a Workday import, the extension transfers matching event time intervals to *your* Workday organization through its visible form. Event descriptions are transferred as comments of up to 1,000 characters only if you separately enable **Import event descriptions as comments**; event titles are not copied into comments. Your Workday organization controls data entered into Workday under its own policies.

Selected Google calendar IDs and names are stored as preferences in browser sync storage. If you use browser sync, Chrome or Edge may transfer these preferences through its own sync service under your browser account. Google OAuth access tokens stay in local extension storage and are not included in browser sync. The Calendar Hours developer does not receive, sell, or share your Google Calendar events or tokens with advertisers or data brokers. The extension has no analytics, advertising, developer account system, Firebase service, or developer-operated data server.

## Data protection

Calendar API and OAuth requests use HTTPS directly between the extension and Google. OAuth tokens are stored locally, apart from synced preferences; where the browser supports it, the extension restricts token storage to trusted extension contexts. It checks the OAuth sign-in response against the original request and checks an event's version before saving its title, so a concurrent edit is not silently overwritten. Calendar events used for duration calculations or import remain in extension or tab memory while the operation runs and are not saved to extension storage. Workday import uses the page's visible form; the extension does not read or store Workday passwords or cookies.

## Retention and deletion

Calendar Hours does not maintain a developer copy or history of Google Calendar events. Event data used for a calculation, direct save, or Workday import is held temporarily in browser memory and is not persisted in extension storage. An updated title remains in your Google Calendar until you edit or delete it there. Workday drafts remain with your organization until you change or delete them in Workday.

The short-lived Google OAuth access token remains in local extension storage until you disconnect Google Calendar, remove the extension, or a later authorization replaces it; an expired token cannot be used for API access. **Disconnect Google Calendar** in extension settings removes the local token and asks Google to revoke it. Removing the extension clears its local storage. Formatting options, matching phrases, selected calendar IDs and names, and Workday preferences remain in browser sync storage until you change or clear them; your browser provider controls any synced copies and their retention. Clear extension sync data through your browser's sync controls if you also want those copies removed.

## Your controls and contact

You can use basic title suggestions without connecting Google, disable automatic updates and Workday import separately, disconnect Google Calendar, or remove the extension. For support or questions about this policy, use [Calendar Hours support](https://github.com/austinkimchi/calendar-hours/issues) or the contact on its [Chrome Web Store listing](https://chromewebstore.google.com/detail/calendar-hours/gkhggalcelmdidfdnllmdpaaapjiegig).
