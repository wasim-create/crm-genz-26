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
| Manager Assist in every state | Jason (Pending, Accepted, Completed), Jose (Reschedule Proposed), Michael Ballero (Declined) |
| Incentives in every state | Donna's queue — Eligible, Pending verification, Verified (amount changed), Approved, Paid, Rejected (sister rooftop), Disputed (conflicts) |
| Ownership transfer | Trinity Toyota of Irving and Big Tex Chevrolet — handed from Jose to Carlos; origin stays with Jose |
| Dealer groups + placeholders | Trinity Motor Group has two "details needed" rooftops |
| Referrals | South Shore BMW (internal, Jason), Fox Valley Mazda and Oak Cliff Auto Outlet (external) |
| Open Radar finds | Pool records marked Radar; Lake Lanier Jeep / Burbank VW claimed from Radar |
| Onboarding checklist | Signed / Onboarding dealerships → Servicing tab |
| At-risk client | Minuteman Chevrolet (no reply for 5 weeks, health below 70) |
| Workspace matching | Two unmatched items (a forwarded dealer list, a "Coffee — Mark?" event) |
| Over-full day / trip day | Kevin's Wednesday; Kelley's and Todd Bilius's Thursday trip days |
| No next step / waiting | Kevin (Northwest CDJR), Todd Kelly (Brand Boulevard Nissan), Carlos (Stockyards Kia) have none; Todd Bilius is waiting on Gwinnett Subaru; Kelley has waited too long on North Shore Auto Sales |
| Google Calendar busy times | Each rep has one personal event (dentist, school pickup…) that the week strip works around |
| Rookie | Carlos: first deal (Trinity Honda), a cancelled visit, a training day, Rookie League |

## Changing the story

Add or edit a dealership in `places.ts` and pick a scenario; the engine writes its history. Named contacts in
`people` are used in the notes. After changing anything, run `npm test` — the consistency checks will tell you
if something no longer adds up. Bump `SEED_VERSION` in `seedData.ts` so browsers load the new story.

## Next steps after a meeting

When a rep saves "How did it go?", the last card is **Next step**. It is pre-filled by reading the note with plain
rules in `src/features/myplan/engine/nextStep.ts` — dates ("next Tuesday", "by Friday", "after the 20th", "after Q1"),
what to do (visit, call, Meet, install, training, signing, demo, bring the manager), things to send ("send the
agenda by Friday" → a dated action point), tasks ("recount the tags" → Keyfetch check), people named ("with Tracy")
and stage hints ("went with another provider" → Lost, "revisit after Q1" → Not Now). Each suggestion shows the words
it came from; the rep confirms or changes it. If the rep picks "No next step" they give a reason (waiting on them,
not now until a date, or no further action).

`src/utils/nextStepStatus.ts` answers "what happens next?" for every dealership (a planned slot, the basket, an open
assist, a dated next action, or the skip reason). Deals with none — or waiting on the dealer for more than a week —
are flagged on the finished My Plan card, the Bench, the Pipeline, the dealership record and the Executive Desk,
each with **Plan it**.
