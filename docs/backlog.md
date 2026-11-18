# To-do list (ideas agreed, not built yet)

- **Monday morning summary by email or notification.** Send each manager their weekly team summary (the one on My team) automatically on Monday morning, so they don't have to open the app first. Needs a real email or push-notification service connected.
- **Get ready for real use: shared database and sign-in.** Replace the per-browser demo storage with a proper shared database, real logins instead of the "Viewing as" switcher, and data that follows each person across devices (check-ins, notes, team rules, weekly snapshots, plans, logs). Needs decisions first: which service, and how AI Studio fits in.
- **Before go-live: turn off the demo clock.** Set `DEMO_CLOCK_ENABLED = false` in `src/utils/simClock.ts` (or show it only to admins).
- **Read the Keyfetch sheets straight from Google.** For now they're uploaded as CSV in Keyfetch stock → Sheets. Needs the shared database and sign-in.
- **Office stock 'data' tab.** The app works out office stock from deliveries and dispatches; once live, compare it with the group sheet's 'data' tab.
- **Google Meet attendance.** Once reps sign in with Google, read each meeting's attendance record (Google Meet API: who joined, and when they joined and left). Use it to mark internal meetings done or not with real times, and to spot dealers who didn't join a Google Meet. Covers reps who join from a phone or email notification rather than My Plan. Needs the shared database and sign-in, each rep's permission, and a decision on what managers see (only the result, or the join and leave times).
- **Before go-live: hide demo tools in My Plan settings** ("Demo tools", "Pretend I have no signal", "Show the reminder now (demo)").
