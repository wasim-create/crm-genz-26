# To-do list (ideas agreed, not built yet)

- **Monday morning summary by email or notification.** Send each manager their weekly team summary (the one on My team) automatically on Monday morning, so they don't have to open the app first. Needs a real email or push-notification service connected.
- **Get ready for real use: shared database and sign-in.** Replace the per-browser demo storage with a proper shared database, real logins instead of the "Viewing as" switcher, and data that follows each person across devices (check-ins, notes, team rules, weekly snapshots, plans, logs). Needs decisions first: which service, and how AI Studio fits in.
- **Before go-live: turn off the demo clock.** Set `DEMO_CLOCK_ENABLED = false` in `src/utils/simClock.ts` (or show it only to admins).
