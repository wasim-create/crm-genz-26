# ApexDrive CRM — "My Plan" Spec v3 (rebuild)

## 0. Purpose and principles

My Plan is the sales rep's lifeline for the day. It is the ONE place reps work: they plan, contact dealerships and record what happened, and the CRM fills itself in as a side effect. No separate "update the CRM" chores. Earlier CRMs (incl. HubSpot) failed because reps never went past the first login, so My Plan must be useful on first open with zero typing.

Principles:
- **Lifeline, not route planner.** Travel only appears when an in-person visit is planned.
- **Records fill themselves.** Every action started or logged in My Plan writes back to the CRM.
- **Code calculates, AI advises.** A deterministic, unit-tested scheduling engine does all times, distances, durations, slot suggestions, reordering and recalculation. AI only suggests who, which tasks and method, drafts messages and action points, and explains in plain English. With AI off, everything still works.
- **Simple enough for anyone.** One decision per screen, big buttons, words with every icon, plain English, Undo everywhere, autosave.
- **Phone for working the day, laptop for planning the week.**

**Goal of this build:** a REALISTIC DEMO the team can play with to decide whether they like it. Google Tasks, Google Calendar and Sheets connections are MOCKED behind clean connector interfaces, so they can be wired up for real in the test version without UI changes.

---

## 1. Clean-up (do first)

- Delete the duplicate old planner: `src/services/schedulingEngine.ts`, `src/types/planner.ts`, `src/data/plannerSeedData.ts`, `src/utils/schedulingEngine.test.ts`, and their imports in `App.tsx` and `storageAdapter.ts`.
- Keep ONE module, `src/features/myplan/`, with ONE engine (`engine/`) and its tests. Rebuild its components from scratch per this spec. Don't patch the current ones.
- My Plan must use the CRM's real data and storage adapter, not its own made-up dealerships or a separate localStorage key:
  - **Dealerships, groups, contacts, products:** read from the CRM's data.
  - **Plans:** stored per user, through the storage adapter.
  - **Logged outcomes:** written back to the CRM (section 9).
- Remove the hardcoded user `rep_1`. Every user has their own plan.

---

## 2. Core concepts

**Slot** = one contact with ONE target. The target is either:
- a **dealership** (rooftop), or
- a **dealer group**, e.g. a meeting with group HQ. When the target is a group, the rep can tick which rooftops the conversation covers. Outcomes are recorded on the group and on each ticked rooftop.

A slot has:
- **how:** In-person visit, Phone call, Google Meet, Email or Text
- **when:** exact time, Morning, Afternoon, or Anytime that day
- **contact person(s):** pick an existing contact, add a new one, or switch to someone else, before or after the contact ("I spoke with someone else")
- **one or more TASKS** (section 5), each with its own outcome
- notes, status, points, and a lock (for confirmed appointments, Manager Assist meetings and calendar events)

Email and text batches: multi-select is a shortcut only. Each selected dealership becomes its own separate slot.

**Task** = something to do during the slot, chosen from the stage's task list (multi-select). Some tasks have options:
- **Product pitch / Upsell:** choose one or more products from the catalog.
- **Keyfetch inventory check:** only for Keyfetch clients.

**Action point** = a to-do about literally anything ("Place Keyfetch order for Frisco Honda — 200 units", "Send brochure", "Ask Jason about terms").
- Optionally linked to a dealership, group or slot.
- Has a due date and an optional reminder.
- Created manually, from a task outcome, or as an AI suggestion the rep accepts.
- Syncs both ways with Google Tasks (section 10).

**Plan-later basket** = dealerships the rep wants to contact soon but hasn't scheduled. Adding one takes one tap ("Plan later") from anywhere, with an optional note and suggested tasks. Used heavily during the week, then emptied into days during weekly planning.

---

## 3. Screens

### 3.1 Today (phone first; the default screen when working)
- Header: the date; Today / Week / Month tabs; a ◀ ▶ "Go to date" control.
- **Day summary:**
  - If there is NO in-person visit: show only the number of items, "Your day: Light / Good / Full", and the time free. No travel.
  - If there are in-person visits: "Leave home by 9:20 AM", drive time and "Home around 5:30 PM".
- **NOW / NEXT card:** the next slot, with one big button for the next step (section 8).
- **Timeline:**
  - Each slot is a card: time, how (icon + word), dealership or group name, a stage chip (Prospect / Sign-up & Onboarding / Client, with a colored left edge), task chips, contact, distance band (in-person only), lock, points.
  - Drive time appears between in-person cards only.
- **Action points due today:** a short list with checkboxes.
- A fixed **"+ Add"** button.

### 3.2 Plan my week (laptop first; also works on a phone)
- Left: the **Plan-later basket**, plus suggestions (due follow-ups, Keyfetch checks due, Manager Priorities, upsells with active product bonuses).
- Right: **Mon–Fri columns** (weekend optional). Each day shows its slots, how full it is, the leave-by time if visiting, the main area, and any trip banner.
- Drag from the basket into a day, or tap an item → "Put on…" → pick a day. Then choose tasks / how / time, using the engine's slot suggestions.
- Drag between days and within a day; arrows work too.
- A week summary: slots by stage, in-person vs remote, home region vs out of town.

### 3.3 Month
An overview, not slot-by-slot planning: colored dots per day, goals, trips, repeats, priorities, and how full each week is. Tap a week or day to open it.

### 3.4 Past days (diary)
Planned vs done, task outcomes, notes, synced activity and points. Editable within the edit window (section 11).

### 3.5 Manager view
Managers, team leads and owners can open any rep's Today, Week or Month (read-only), push Manager Priorities into the basket or a day, and suggest changes the rep can accept or decline. Managers have their own My Plan.

---

## 4. Adding a slot (one flow, two ways in)

"+ Add" opens a full-screen panel showing "Step X of Y", a big Back button, and a summary line of choices so far.

**Step 1 — two big, equal choices:**
- **"Choose a dealership"** (recommended default, shown first)
- **"Choose what to do"** (In-person visit / Phone call / Google Meet / Email / Text)

**Choose a dealership:**
- Tabs: **PROSPECTS | SIGN-UP & ONBOARDING | CLIENTS | GROUPS**, each with a count. Map the CRM stages correctly:
  - **Prospects** = Claimed, Visit Planned, Visited, Follow-up, In Progress, HOT, Negotiation, Not Now (plus Pool, via "Find more")
  - **Sign-up & Onboarding** = Contract, Won, Signed, Onboarding
  - **Clients** = Client
  - **Groups** = dealer groups
- Default list: the rep's bench and clients. Show "Suggested for you" at the top, with a one-line reason each.
- Search box and quick filters (Due now · Nearby · Hot · Manager priority · Not contacted lately · In basket). "More filters" opens all the CRM filters.
- "Find more nearby" opens the Prospect Pool, home region first. "Add a new dealership" opens a manual add.
- Each row shows: name, city, stage, distance band + miles, main contact, and the reason it's suggested.

**Then:**
1. **Tasks:** the stage's task list as big checkboxes, with the most likely ones pre-ticked. Product options open inline.
2. **How:** most likely pre-selected. Skipped if the rep chose "what to do" first.
3. **Who:** the contact(s). Pre-selected if there's only one. "+ Add new contact" (name, title, phone, email). For a group target, also tick the rooftops covered.
4. **When:**
   - the engine's 2–3 best slots, explained ("Tue 10:30 AM — after Smith Motors, 12 min drive")
   - Morning / Afternoon / Anytime
   - "Pick my own time"
   - "Plan later" (to the basket)
5. **Confirm**, in plain words, with Undo. After an in-person visit is added: "2 more dealerships within 10 miles — add one?"

**Choose what to do first:**
- In-person / Phone / Meet: pick ONE target, then Tasks → Who → When.
- Email / Text: pick MULTIPLE targets. The result is one slot per target, sharing a message template that can be edited per slot. Send times are suggested by the engine.

**Other entry points:** every dealership and group card, the pool, the client list, map pins, Manager Priorities and AI suggestions offer "Add to my plan" and "Plan later", using this same flow, pre-filled.

---

## 5. Tasks by stage (multi-select; editable list in Settings)

| Stage | Tasks |
|---|---|
| **Prospect** | First visit / introduction · Follow-up · Product pitch (choose products) · Decision-maker meeting · Manager Assist meeting · Record product interest |
| **Sign-up & Onboarding** | Contract signing · Confirm products signed (choose products) · Onboarding training · Setup check · Handover to servicing |
| **Client** | Keyfetch inventory check (Keyfetch clients only) · Upsell (choose products the client doesn't have yet) · Promotions / sales follow-up · Check-in · Fix an issue |
| **Group** | Group meeting · Group-wide pitch (choose products, tick rooftops) · Expansion to sister rooftops |

Each task has a default duration. The slot duration = the sum of the task durations (with sensible caps), and can be edited.

---

## 6. Editing and moving

- **Tap any card** to open "Edit this slot": change the day, time, how, tasks, products, contact(s), duration or notes; lock or unlock it; remove it. Save shows "Updated · Undo".
- **Reorder within a day:** ▲ / ▼ arrows (always visible, large) AND drag and drop (touch and mouse).
- **Move between days:**
  - "Move to another day" (Tomorrow / pick from a calendar), from the card and the edit screen.
  - Drag between days in Week view.
  - "Send back to basket".
- **Locked slots** keep their time. Others flow around them.
- After ANY change, the engine recalculates (section 7) and explains what changed in one line, with Undo.

---

## 7. Scheduling engine (deterministic, unit-tested)

**Coordinates:** use real lat/lng for every seeded dealership and every rep's home, in all 5 regions. No ZIP lookup that only knows Texas. Distances between stops are calculated dealership-to-dealership, never by comparing each one's distance from home.

**Distance bands (from home, straight line):**
- 🟢 0–60 mi: home region
- 🟡 60–69 mi: edge
- 🔴 70+ mi: out of town → offered as a trip day, with nearby stops suggested

Bands are editable in Settings.

**Travel:** drive time = straight-line × 1.3 at 30 mph metro / 50 mph rural, rounded up to the next 5 min, plus 10 min parking. Google Maps is used when a key is configured. Travel is shown only between in-person slots, and from or to home.

**Leave-by:** first in-person start − drive − 10 min parking − 10 min margin. Shown only if there is an in-person slot.

**Live contact window, 10:00 AM–4:00 PM** (dealership local time): in-person, phone and Meet. Never suggested outside it. Allowed if the rep insists, with a gentle note.

**Email and text:**
- They do NOT take time in the live window.
- Prep time is suggested before 10, after 4, or in gaps.
- Send times use editable defaults (Email Tue–Thu ~10–11:30 or 2–3; Text Tue–Fri 10:30–3:30).

**Ordering and reordering:**
- Times flow from the day's start and the order of slots.
- Exact times are respected unless the rep moves the slot. When slots swap, BOTH get new times calculated from their new positions. The bug where the new first slot keeps its old time must be impossible.
- Locked slots keep their time. Overlaps with locked slots are detected and fixed or flagged.

**Warnings** (plain English, one-tap fixes): past 4 PM, before 10 AM, an impossible drive, an over-full day, an overlap. Fixes include: Put it back · Move to another day · Turn into a phone call · Swap order.

**Overrun:** "I need more time" (+15 / +30) recalculates the rest of the day instantly and explains the effect.

**Unit tests:** bands, drive times, leave-by, live window, swap/reorder correctness, locked slots, overlaps, overrun, empty day, remote-only day.

---

## 8. Working through the day

The NOW / NEXT card shows one big button for each step:
- **In person:** Start driving (opens Maps) → I've arrived (check-in) → Done – how did it go?
- **Phone:** Call now → How did it go?
- **Meet:** Join meeting → How did it go?
- **Email:** Review & send (or "Scheduled for 10:15 AM" · Edit / Cancel)
- **Text:** Send text (opens a pre-filled message) → Done

**"How did it go?"** asks about EACH task, one simple card per task:
- **Product pitch / Record interest:** per product, Low / Medium / High / Not interested.
- **Upsell:** per product, Pitched / Interested / Won / Lost. A Won product is added to the client's products.
- **Keyfetch inventory check:** "Needs refill?" Yes / No. If Yes, enter a quantity. This automatically creates the action point "Place Keyfetch order for [dealership] — [qty] units" (due today), shown on the dealership card until ticked.
- **Contract signing / Confirm products:** products signed (from the catalog).
- **Others:** a simple outcome (Done / Needs follow-up / Not now / Issue).

Plus:
- "Who did you speak with?" (pre-filled; switch or add a new contact)
- an optional voice or text note
- AI-suggested action points (accept / edit / dismiss)
- "Plan the next step?" (pre-filled Add flow, or "Plan later")

Points are shown with a short celebration.

**Can't do it?** Later today / Tomorrow / Pick a day / Turn into a call / Plan later / Skip (with reason). Nothing is ever lost.

---

## 9. Write-back to the CRM (the "records fill themselves" part)

Saving an outcome automatically:
- creates the CRM **Activity** record(s) (type, contact, tasks, notes, live-window flag), on the dealership, or on the group plus each ticked rooftop
- updates **last contact** and suggests a **stage change** when it's implied (e.g. a first visit moves Claimed → Visited). Stage changes are confirmed with one tap, never silent.
- updates **product interest**, **upsell** status per product, **products signed**, and **contacts** (new or changed)
- records the **Keyfetch inventory check** and refill quantity (quantity only, no money)
- creates **action points**
- awards **points** through the existing Game Rules / Points Ledger (no hardcoded point values in My Plan)
- writes the **audit log**, and feeds the Executive Desk, Manager Assist and the incentive trail as those features already expect

---

## 10. Action points + Google Tasks (two-way sync)

- A **"To do" list** in My Plan (Today shows items due today; there's a full list with Overdue / Today / Upcoming / Done), plus action points shown on every dealership and group card.
- **Create one from:** a task outcome (auto), AI suggestions (accept / edit / dismiss), "+ Action point" anywhere (title, optional dealership, due date, reminder), or voice.
- **Tick off** in the CRM or in Google Tasks; both stay in sync. Edits and deletes sync too, and the dealership link is kept in the task notes.
- **Demo:** a mock Google Tasks connector with realistic behaviour and a visible "Synced with Google Tasks" state. A clean interface, so the real API can be plugged in later.
- **Points** for completing action points come from Game Rules (configurable).
- **Overdue** action points show gently on Today and in the weekly reminder.

---

## 11. Editing past slots (24-hour window)

**Within 24 hours of a slot's end, the rep can edit:**
- task outcomes
- product interest / upsell statuses
- the refill quantity
- the contact spoken with
- notes
- action points created from it

**Never editable by the rep:** the date and time it happened, check-in time, the "how", or the points (points are recalculated automatically from edited outcomes).

**After 24 hours:** read-only, except "Add a correction note". Managers can edit with a required reason. Every edit is audited (who, when, old value → new value). The window length is editable in Settings.

---

## 12. Weekly planning reminder

- On first use, ask: "When do you like to plan your week?" The default is Sunday 6:00 PM; the rep can change the day and time, or turn it off. It's changeable later in My Plan settings.
- The reminder says, e.g., "Your basket has 9 dealerships and 3 follow-ups are due. Plan your week?" It opens Plan my week.
- **Demo:** an in-app notification. Built so push, email, or a Google Calendar reminder can be added later.

---

## 13. Google Calendar (two-way, mocked in the demo)

- Slots appear in the rep's Google Calendar (title "Visit — Smith Motors", tasks in the description). Changes in either place sync.
- Calendar events appear in My Plan as locked blocks.
- **Demo:** a mock connector behind a clean interface.

---

## 14. Works with poor signal

- Today's and this week's plan, the dealership details for those slots, contacts and action points are kept on the device.
- Logging outcomes, checking in, adding action points and moving slots all work offline. Changes queue and sync when the signal returns.
- A small "Offline — will sync when you're back online" note shows while offline.

---

## 15. Look and feel

- Calm, modern, one simple column on the phone. Week planning is wider on a laptop.
- Body text ≥ 17px, buttons ≥ 48px, high contrast, icons always with words, one primary button per screen. A "Bigger text" option. Light and dark mode.
- **Stage colors (the same everywhere):** Prospect · Sign-up & Onboarding · Client · Group.
- No pop-ups on top of pop-ups. Steps open as full-screen panels with a big Back button.
- Gamification stays calm: points shown small, celebrations short.
- **First-time walkthrough** (3–4 screens, replayable): "This is your day" · "Tap + to add" · "Tap the card to change it" · "Plan your week on Sunday". It also sets the weekly reminder.

---

## 16. Demo data (realistic, per user)

Use the CRM's real seeded users, dealerships, groups, contacts and products. For every rep and manager:
- 4 weeks of past slots (with task outcomes, upsells, Keyfetch checks, action points)
- this week, partly planned
- next week's basket, with items in it
- at least one dealer-group meeting
- one trip
- an email batch (separate slots)
- a call list
- one over-full day
- a locked Manager Assist meeting
- overdue and due-today action points

Each user sees their own plan.

---

## 17. Test scenarios (walk through these, then make them work)

1. A rep who rarely uses apps adds a visit to a Client for tomorrow, ticks "Upsell (Ceramic Pro, GAP)" and "Keyfetch inventory check", in ≤ 5 taps.
2. On Sunday evening, the rep opens Plan my week, drags 6 basket items into Mon–Thu, and gets realistic times. Mon shows "Leave home by 9:25 AM".
3. An empty day shows no travel or leave-by time; a phone-only day shows no travel.
4. Swapping the first two visits with ▼ gives both correct new times, the drive time updates, and Undo works. Dragging a slot past a locked Manager Assist meeting leaves the meeting's time unchanged.
5. The rep taps a slot, changes Phone → In-person and the time, and adds a task. It saves and recalculates.
6. After a client visit: Upsell Ceramic Pro = Won, GAP = Interested; Keyfetch refill = Yes, 200. The CRM activity, products, upsell statuses and points update, and the action point "Place Keyfetch order — 200 units" appears in My Plan, on the dealership card, and in (mock) Google Tasks. Ticking it off in Google Tasks ticks it off in the CRM.
7. A group meeting with HQ covering 3 rooftops: outcomes are recorded on the group and on all 3 rooftops.
8. The rep spoke with a different person than planned, and adds them as a new contact during "How did it go?".
9. The next day, the rep edits the refill quantity (allowed, within 24 h). Two days later, editing is blocked except for a correction note; a manager edits with a reason, and it's audited.
10. With signal off, the rep logs a visit and adds an action point. They sync when back online.
11. Jason Scott opens Kelley's week (read-only) and pushes a priority into her basket. Kelley sees it on Sunday and schedules it.
12. With AI switched off, everything above still works except suggestions and drafts.

---

## 18. Not in this build (future)

- Real Google Sheets / Tasks / Calendar / Gmail connections (demo uses mocks behind interfaces).
- Placing Keyfetch orders inside the CRM and showing order status on the dealership card. For now, the action point reminds the rep to order through the existing system.
- A real SMS sending service.
