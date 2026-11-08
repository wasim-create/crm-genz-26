# Demo data — how it works

The demo is one connected story. Every screen reads the same records, so a visit
logged on a dealership is the same visit in My Plan, the points ledger, the
leaderboard, the Executive Desk and the incentive trail.

## Where it lives

| File | What it holds |
| --- | --- |
| `src/data/seedData.ts` | The GenZ team (**real names and designations — do not change**), F&I systems list and game rules. |
| `src/data/demo/places.ts` | Every dealership and dealer group, each with a **scenario** (e.g. `hot`, `client`, `lost`). |
| `src/data/demo/people.ts` | Dealership contacts (named heroes + generated, unique names). |
| `src/data/demo/story.ts` | The story engine: turns scenarios into dated history and derives everything else. |
| `src/features/myplan/data/seed.ts` | My Plan: past 4 weeks = the CRM's logged activity; next week = booked next steps, assists, priorities. |
| `src/data/demo/__tests__/consistency.test.ts` | Checks the data agrees with itself, for several different "todays". |

## Rules the data follows

- **Dates move with today.** Everything is built relative to the day the demo is opened (weekends skipped).
- **Territory.** Claimed dealerships are within 60 miles of the rep's home ZIP. The only exceptions are
  manager-assigned far accounts (Casco Bay Toyota, Scenic City Toyota), which are visited on trip days.
  The Pool includes a few in the 60–69 mile tolerance band and beyond, to show the warnings.
- **10 AM – 4 PM.** Visits, calls and Meets sit inside the window in the dealership's local time. Two deliberate
  exceptions: Todd Kelly's after-5 drop-in and Carlos's too-early first visit.
- **Points** are worked out from the activity: a rolling six-week season plus a small carry-over. Levels, ranks,
  streaks and badges come from the same ledger. Voicemails earn nothing.
- **Fictional dealers.** Dealership and group names are invented. Towns, roads and area codes are real; phone
  numbers use the reserved 555-01xx range.
- **Ceramic Pro** launched about five weeks ago, so it never appears before that date.

## What each feature has to show

| Feature | Where to look |
| --- | --- |
| Every pipeline stage | Pipeline — Pool through Client, plus Lost, Not Now and Disqualified |
| Manager Assist in every state | Jason (Pending, Accepted, Completed), Jose (Reschedule Proposed), Michael (Declined) |
| Incentives in every state | Donna's queue — Eligible, Pending verification, Verified (amount changed), Approved, Paid, Rejected (sister rooftop), Disputed (conflicts) |
| Ownership transfer | Trinity Toyota of Irving and Big Tex Chevrolet — handed from Jose to Carlos; origin stays with Jose |
| Dealer groups + placeholders | Trinity Motor Group has two "details needed" rooftops |
| Referrals | South Shore BMW (internal, Jason), Fox Valley Mazda and Oak Cliff Auto Outlet (external) |
| Open Radar finds | Pool records marked Radar; Lake Lanier Jeep / Burbank VW claimed from Radar |
| Onboarding checklist | Signed / Onboarding dealerships → Servicing tab |
| At-risk client | Minuteman Chevrolet (no reply for 5 weeks, health below 70) |
| Workspace matching | Two unmatched items (a forwarded dealer list, a "Coffee — Mark?" event) |
| Over-full day / trip day | Kevin's Wednesday; Kelley's and Todd Bilius's Thursday trip days |
| Rookie | Carlos: first deal (Trinity Honda), a cancelled visit, a training day, Rookie League |

## Changing the story

Add or edit a dealership in `places.ts` and pick a scenario; the engine writes its history. Named contacts in
`people` are used in the notes. After changing anything, run `npm test` — the consistency checks will tell you
if something no longer adds up. Bump `SEED_VERSION` in `seedData.ts` so browsers load the new story.
