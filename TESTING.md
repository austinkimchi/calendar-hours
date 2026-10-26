# Edge Calendar test notes — October 26, 2026

- Today's Work calendar event began at 10:55am, ended at 12:45pm, and displayed `SCU Block (1.83 hours)`.
- In the full event editor, changing the end field to 1:00pm caused the installed extension to update the title immediately to `SCU Block (2.08 hours)`. That edit was discarded.
- Resizing the block on the calendar grid to end at 1:15pm saved the new time, but the installed v0.2.0 build left the title at `1.83 hours` and showed its save error. The event was restored to 12:45pm and `SCU Block (1.83 hours)`; the grid showed both original values afterward.
- Live DOM inspection found that the event popup title is a `span` with `role="heading"`, and the editor's recurrence control is outside a `main` element. The v0.2.0 grid path assumed otherwise.
- Opening the event editor directly in a separate Edge tab by its Calendar event URL worked. The v0.2.1 development build uses an inactive tab for saving and verifying a changed title, while painting the new duration on the grid immediately.
- v0.2.1 passes 15 local automated tests, including background save, verification, and a second resize while the first update is running. Its inactive-tab flow still needs an installed-extension test in Edge. It has not been submitted to the Chrome Web Store.
