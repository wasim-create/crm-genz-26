# ApexDrive "My Plan" Full Rebuild Specification & Architecture Plan

## Executive Overview
This plan specifies the clean, complete rebuild of **My Plan** from scratch as a brand-new, self-contained feature module located in `src/features/myplan/`. All legacy planner code, multi-pane grids, route-first map tabs, and half-built hybrid components will be deleted completely first.

The rebuilt My Plan is designed around one core product principle:
> **"So simple that someone who finds technology very difficult can use it just by looking at it."**

And the Golden Architectural Rule:
> **"Code calculates, AI advises."** Deterministic algorithms handle all distances, drive times, leave-by calculations, slot feasibility, and day-overrun recalculations. Gemini AI strictly advises on who to reach, why, and drafts personalized copy without ever calculating numbers.

---

## 1. Delete List: Legacy Planner Code to be Removed Completely

The following files will be deleted in their entirety prior to building the new module:

1. `src/components/views/PlannerView.tsx` (23.5 KB) — Legacy day/week/month/agenda planner grid and route-first map layout.
2. `src/components/views/WorkDayMobileModal.tsx` (7.8 KB) — Legacy "Work my day" modal.
3. `src/components/views/AddToPlanModal.tsx` (28.8 KB) — Legacy cluttered 4-step modal.
4. `src/components/views/PlanAdjustmentModal.tsx` (7.6 KB) — Legacy overrun pop-up.
5. `src/components/views/PlanPickerModal.tsx` (19.0 KB) — Hybrid picker from previous iteration.
6. `src/components/views/SlotSuggestionsModal.tsx` (13.7 KB) — Hybrid slot modal.
7. `src/components/views/TripPlanningModal.tsx` (10.0 KB) — Hybrid trip modal.
8. `src/components/views/CallSessionModal.tsx` (10.1 KB) — Old call runner modal.
9. `src/components/views/TextQueueDrawer.tsx` (5.1 KB) — Old text drawer.
10. `src/components/views/PlanWalkthroughModal.tsx` (5.9 KB) — Old walkthrough modal.
11. `src/components/views/MyPlanView.tsx` (88.6 KB) — Legacy composite view file.
12. `src/services/dayEngine.ts` & `src/utils/dayEngine.test.ts` (18.0 KB) — Old legacy planner engine.

### Code/State/Route Cleanups:
- `src/App.tsx`: Remove all legacy imports (`PlannerView`, `WorkDayMobileModal`, `AddToPlanModal`, old `MyPlanView`). Remove legacy state hooks (`isWorkDayModalOpen`, `isAddPlanModalOpen`). Mount the clean `<MyPlanModule />` directly.
- `src/components/navigation/TopNavigation.tsx` / `Sidebar.tsx`: Ensure navigation item points exclusively to `my_plan` view.
- External Entry Points: Update every "Add to my plan" trigger (`ProspectPoolView.tsx`, `DealershipDetailModal.tsx`, `Manager Priorities`, `Google Calendar`) to call the new module's clean entry API `openAddPlan({ dealership, defaultActivity })`.

---

## 2. New Module Structure (`src/features/myplan/`)

```
src/features/myplan/
├── MyPlanModule.tsx                 # Main self-contained container with view switching & opening question
├── types/
│   └── myplan.types.ts              # Canonical PlanSlot, DaySettings, Trip, and send-queue types
├── engine/
│   ├── schedulingEngine.ts          # Deterministic math: Haversine distance, bands, drive times, leave-by, slot finding, recalculation
│   └── __tests__/
│       └── schedulingEngine.test.ts # Comprehensive unit tests for all mathematical & scheduling rules
├── components/
│   ├── DayView.tsx                  # Single-column timeline with summary card, cards, travel lines, ▲/▼ arrows
│   ├── WeekView.tsx                 # Calm 7-day card stack/columns + "Not scheduled yet" tray
│   ├── MonthView.tsx                # High-level goals, trip days, week fullness overview
│   ├── PastDaysDiary.tsx            # Read-only diary with planned vs actual, outcomes, notes, and points
│   ├── DaySummaryCard.tsx           # Leave-by badge, total items, drive time, "How full is my day?" bar, home time
│   ├── SlotCard.tsx                 # Large touch-friendly card with colored work-type left edge, ▲/▼ buttons, drag handle
│   ├── NextActionBanner.tsx         # Today's active slot with ONE big primary action button
│   ├── OutcomeLoggingSheet.tsx      # "How did it go?" outcome buttons, Keyfetch top-up counter, voice/text notes
│   ├── AddFlow/
│   │   ├── AddFlowModal.tsx         # Full-screen calm step-by-step panel with "← Back" and "Step X of Y"
│   │   ├── StepWhoAndWhat.tsx       # Unified "What do you want to do?" + "Who with?" (Prospects/Onboarding/Clients)
│   │   ├── StepContactPurpose.tsx   # Contact selection (auto-skipped if only 1) & smart stage-based purpose
│   │   ├── StepWhen.tsx             # 2-3 plain-English slot suggestions + Morning/Afternoon/Custom
│   │   └── NearbySuggestionsPrompt.tsx # "3 more dealerships within 10 miles. Add one?"
│   ├── TripPlanningSheet.tsx        # Out-of-town trip prompt with 15-mile proximity clustering
│   ├── TextQueueDrawer.tsx          # Native SMS dispatcher drawer with deep links
│   └── ManagerTeamScheduleView.tsx  # Manager team overview & push priority handler
└── context/
    └── MyPlanContext.tsx            # Clean state provider with Undo stack and LocalStorage/Sheets sync
```

---

## 3. Detailed Screen Descriptions

### Screen 1: The Opening Question (First-Time or Day-Start)
- **Visuals**: A calm, focused banner or centered card asking: *"What are you planning today?"*
- **Controls**: Four large, inviting pill buttons: `[ Today ]`, `[ Tomorrow ]`, `[ This week ]`, `[ Choose days ]`.
- **Behavior**: Remembers the rep's previous preference. Clicking any option smoothly transitions into that view. Experienced reps jump straight to their default view.

### Screen 2: Day View (The Main Timeline)
- **Layout**: Centered, single-column feed (max 720px wide on desktop; 100% full-width on mobile). No sidebars, no multi-calendar panes.
- **Header**:
  - Large date title (e.g., **"Tuesday, November 10"**) in 24px bold font.
  - Simple `◀` and `▶` day navigation arrows with a distinct **"Today"** return button.
  - Three large segmented view tabs: **Day** | **Week** | **Month**.
  - Secondary toggle for **"Bigger text"** (boosts font size to 19px+ for ultimate accessibility).
- **Day Summary Card**:
  - Prominent indigo/blue pill: **"🚗 Leave home by 9:15 AM"** (derived from first in-person appointment minus drive time minus 10m parking minus 10m safety buffer).
  - Metric row: Total items (e.g. *5 activities*), total driving (e.g. *1 hr 35 min*), and estimated arrival: **"Home around 5:30 PM"**.
  - **"How full is my day?" bar**: A smooth 4-state indicator with colored segments:
    - *Light* (<4 hrs) · *Good* (4–6.5 hrs) · *Full* (6.5–8 hrs) · *Too much* (>8 hrs / overtime alert).
- **The Next Action Banner (Today only)**:
  - Highlights the upcoming stop with a glowing border and **ONE large 52px primary button**:
    - In-Person: `[ Start driving (Maps) ]` $\rightarrow$ `[ I've arrived ]` $\rightarrow$ `[ Done – how did it go? ]`.
    - Phone Call: `[ Call now (555-0199) ]` $\rightarrow$ `[ Done – how did it go? ]`.
    - Google Meet: `[ Join video meeting ]` $\rightarrow$ `[ Done – how did it go? ]`.
    - Email: `[ Review & send email ]`.
    - Text message: `[ Send text ]` (opens native messaging app with pre-filled copy).
- **Timeline Cards**:
  - Between cards: A clean connector line with travel metrics: `🚗 25 min drive (14 miles)`.
  - Individual `SlotCard`:
    - **Colored left border (4px)**:
      - 🟢 **Emerald**: New Prospect (Pool, Bench, Pitching, Trial)
      - 🟠 **Amber**: Sign-up & Onboarding
      - 🔵 **Indigo**: Client Care (Active Accounts, Keyfetch Top-ups)
    - **Time display**: Large 18px bold text (e.g. `10:30 AM – 11:15 AM`).
    - **Header**: Activity icon + plain text (`Car` *In-person visit*), dealership name in large font (`Lone Star Ford`), city (`Plano, TX`).
    - **Distance Band Badge**: Dot + miles (`🟢 18 mi` Home Region, `🟡 64 mi` Edge, or `🔴 85 mi` Out of Town).
    - **Contact**: `John Miller (General Manager)`.
    - **Right-side controls**: Large, tap-friendly `▲` (Move up) and `▼` (Move down) arrow buttons + subtle drag handle (`⋮⋮`).
    - **Status chip**: `Planned`, `Done` (with green check), or `Skipped`.
    - Small points badge (e.g., `+25 pts`).
- **Fixed "+ Add" Button**:
  - Fixed at the bottom center of the mobile screen (sticky 56px floating action pill with `+ Add to plan`), and stationed cleanly below the summary card on desktop.

### Screen 3: The Single Add Flow (Step 1 to Step 4 Full-Screen Panel)
- **Design Philosophy**: Full-screen overlay (not a nested popup). A prominent `← Back` button on top-left, a clear `Step X of Y` indicator on top-right, and a persistent summary line showing selections made so far (e.g. *In-Person Visit · Lone Star Ford*).
- **Step 1: "What & Who"**:
  - Top: *"What do you want to do?"* (Optional; 5 big toggle buttons): `[ In-person visit ]`, `[ Phone call ]`, `[ Google Meet ]`, `[ Email ]`, `[ Text message ]`.
  - Bottom: *"Who with?"*:
    - Three main tabs: `PROSPECTS (14)` | `SIGN-UP & ONBOARDING (3)` | `CLIENTS (8)`.
    - Search input for dealership, city, or brand.
    - Quick filter chips: `Due now`, `Nearby`, `Hot`, `Manager priority`, `Not contacted lately`.
    - *"Suggested for you"* at the very top (AI-curated recommendations with a 1-line plain reason, e.g. *"Haven't spoken with Dave in 18 days"*).
    - Rep's claimed Bench is shown by default.
    - `[ Find more nearby ]` opens the Prospect Pool (sorted home region first).
    - Multi-select capability active when Email or Text is chosen, or for building a Call List.
- **Step 2: Contact & Purpose**:
  - If dealership has only 1 contact, automatically pre-selects and skips to Purpose!
  - Purpose choices dynamically styled by account stage:
    - *Prospects*: First visit & lot walk, Follow-up pitch, Decision-maker meeting, Manager Assist meeting.
    - *Onboarding*: Contract signing, System walkthrough, Training check.
    - *Clients*: Keyfetch top-up, Upsell review, Quarterly check-in.
- **Step 3 (When): Smart Slot Picker**:
  - Displays top 2–3 deterministic slots calculated by the engine with plain-English rationales:
    - *Option A*: *"Tue 10:30 AM — Right after Lone Star Ford (12 min drive)"*
    - *Option B*: *"Tue 1:30 PM — Afternoon opening in North Plano cluster"*
  - Quick choices: `[ Morning ]`, `[ Afternoon ]`, `[ Anytime that day ]`.
  - `[ Pick my own time ]`: Dropdown for custom hour. If outside the 10 AM – 4 PM Golden Window, displays a courteous note explaining dealerships prefer visits between 10 AM and 4 PM with a one-tap override.
- **Step 4: Confirmation & Proximity Follow-up**:
  - Instant confirmation banner: *"Added Lone Star Ford for Tuesday at 10:30 AM. Leave home by 9:45 AM."* with an immediate `[ Undo ]` button.
  - If In-Person, displays proximity nudge: *"3 more dealerships within 10 miles. Add one?"*

### Screen 4: "How Did It Go?" (Outcome Logging Sheet)
- **Visuals**: Clean sliding bottom sheet or modal after completing a slot.
- **Controls**:
  - Large one-tap outcome buttons:
    - Prospects: `[ 🔥 Hot / Contract ]`, `[ 💬 Interested ]`, `[ ⏳ Follow-up needed ]`, `[ ❄️ Not now ]`.
    - Clients: `[ ✅ All good ]`, `[ 🔑 Keyfetch top-up done ]`, `[ 📈 Upsell interest ]`, `[ ⚠️ Issue to fix ]`.
  - For Keyfetch top-ups: A dedicated quantity input box (e.g. `[ 250 ] tags replenished` — strictly quantities, zero dollar amounts).
  - Voice recording button or text notes area.
  - Dedicated prompt: *"Plan the next step?"* (re-opens the Add flow pre-filled with the same dealership).
  - Short, calm points celebration (`+35 Points earned!`).

### Screen 5: Week View
- **Layout**: Calm vertical list of 7 days on mobile; clean 7-column planner on desktop.
- **Card Contents per Day**:
  - Date title, Leave-by time, count of items categorized by colored dots, fullness bar, and out-of-town trip banners.
- **"Not Scheduled Yet" Tray**:
  - Sits at the top of the Week view. Reps can drag or use arrow buttons to assign unscheduled or skipped leads to specific days.

### Screen 6: Month View (Overview)
- **Purpose**: High-level visual planner, not micro-scheduling.
- **Display**: Monthly calendar grid highlighting dedicated Out-of-Town Trip banners, monthly goals, Manager Priorities, and day capacity dots (green = light/good, amber = full, red = overbooked). Tapping any week or day switches directly to its detail view.

### Screen 7: Past Days Diary
- **Purpose**: Read-only historical record of rep execution.
- **Features**: Compares planned vs actual times, displays logged notes and outcomes, shows synced Google Workspace activity (emails sent, Meet meetings completed), and records points earned without cluttering active planning.

---

## 4. Walkthrough of the 10 Test Scenarios

### Scenario 1: Quick Add in 4 Taps (Non-Tech-Savvy Rep)
1. **Tap 1**: Rep taps the big `+ Add` button.
2. **Tap 2**: Taps `In-person visit` (or taps `Lone Star Ford` directly under Prospects).
3. **Tap 3**: Purpose is pre-selected (*First visit & lot walk*). Rep taps `Continue to Time`.
4. **Tap 4**: Engine suggests `Tomorrow 10:30 AM (Right after morning coffee, 20 min drive)`. Rep taps `Select 10:30 AM`.
5. **Result**: Slot is saved. The Day Summary Card instantly recalculates and displays: **"🚗 Leave home by 9:20 AM"** in plain English.

### Scenario 2: Reordering with Arrow Buttons & Instant Recalculation
1. Rep is looking at tomorrow's schedule with Visit A at 10:00 AM (20 min drive) and Visit B at 11:30 AM (15 min drive from A).
2. Rep taps the `▼` button on Visit A's card.
3. Visit B moves to the top; Visit A moves second.
4. The deterministic scheduling engine instantly recalculates:
   - Visit B is now set for 10:00 AM (drive from rep's home = 35 min).
   - Visit A is now set for 11:45 AM (drive from B to A = 15 min).
   - The top banner updates to: **"Leave home by 9:05 AM"**.
   - A friendly notification toast appears: *"Swapped order. Smith Motors is now first. Leave home 15 min earlier. · [Undo]"*.

### Scenario 3: Moving Across a Locked Manager Assist Meeting
1. The day has: Visit 1 (10:00 AM), **🔒 Manager Assist with VP Jason Scott (11:30 AM – 12:15 PM)**, and Visit 2 (1:30 PM).
2. The rep drags Visit 2 or clicks `▲` twice to move it earlier.
3. The engine recognizes the 11:30 AM block is **Locked (🔒)**.
4. The engine places Visit 2 into the morning opening at 10:45 AM, keeping Jason Scott's meeting firmly anchored at 11:30 AM.
5. All drive times and buffers adjust without touching the locked meeting.

### Scenario 4: Todd Bilius Batches 8 Prospect Emails
1. Todd taps `+ Add`, selects `Email`, and ticks 8 prospects in his bench.
2. He clicks `Schedule 8 Emails`.
3. In accordance with Section 6, the system **creates 8 separate, individual PlanSlot items** (not one bulk slot).
4. The engine staggers send times sensibly inside the recommended send window (e.g., 10:05 AM, 10:15 AM, 10:25 AM...).
5. In the timeline, Todd can expand the grouped header, click on the 3rd email, personalize its body copy, or delete the 5th email individually.

### Scenario 5: Carlos Makes a Call List of 6 Clients & Reschedules One
1. Carlos selects `Phone call`, ticks 6 active clients, and confirms.
2. The engine creates 6 distinct call slots placed back to back with 5-min buffers between 10:30 AM and 12:00 PM.
3. Carlos realizes he cannot reach the 4th client today.
4. He taps the card's `...` menu, selects `Move to another day`, and taps `Tomorrow`.
5. The 4th call slot moves to tomorrow's "Not scheduled yet" tray, and today's remaining calls collapse cleanly with recalculated times.

### Scenario 6: Kevin Handles Edge (65 mi) vs Out-of-Town (110 mi)
1. Kevin opens the Add flow and picks *Classic Chevrolet* (65 miles from home).
   - The card shows a gentle yellow flag: `🟡 Edge of your region (65 mi)`. Kevin adds it to his day normally.
2. Kevin then selects *Tyler Ford* (110 miles from home).
   - The system intercepts: `🔴 Out-of-Town (110 mi)`.
   - The **Trip Planning Sheet** slides up: *"This is about a 4.2-hour round trip. Make it a dedicated trip day?"*
   - The engine automatically clusters and displays 2 other prospects within 15 miles of Tyler Ford.
   - Kevin accepts, converting Thursday into a dedicated Multi-Stop Trip Day.

### Scenario 7: Todd Kelly Books at 8:30 AM (Golden Window Warning)
1. Todd Kelly picks custom time `8:30 AM` for a dealership phone call.
2. The engine flags that 8:30 AM is outside the 10:00 AM – 4:00 PM Live Contact Window.
3. A calm warning appears: *"Dealership general managers and sales staff are usually busy in morning meetings before 10:00 AM. Would you prefer 10:15 AM?"*
4. Two buttons are presented: `[ Switch to 10:15 AM ]` and `[ Keep 8:30 AM anyway ]`. Todd clicks `Keep 8:30 AM`, and the slot is placed with a soft warning badge.

### Scenario 8: Lone Star Ford Keyfetch Client Pre-Selection
1. Rep selects *Lone Star Ford* (an active Keyfetch client) first from the Clients tab.
2. The screen asks *"How do you want to connect?"* and **pre-selects `In-person visit`** with the purpose automatically set to **`Keyfetch top-up`**.
3. The engine finds available gaps between existing visits that allow 20 minutes for top-up + drive time.
4. The rep confirms in 2 taps; the outcome form will include the Keyfetch replenishment quantity counter.

### Scenario 9: Mid-Day 30-Minute Overrun & 1-Tap Recovery
1. During a 1:00 PM visit, the dealer wants an extended product demo. The rep taps `+30 min (Need more time)`.
2. The engine immediately recalculates the rest of the day.
3. A subsequent phone call that was scheduled for 3:45 PM is pushed to 4:15 PM (past the 4:00 PM Golden Window cutoff).
4. The timeline highlights the overrun call card with an amber warning pill and offers two 1-tap resolution buttons:
   - `[ Turn into scheduled email ]`
   - `[ Move to tomorrow ]`
5. The rep taps `[ Move to tomorrow ]`. The day timeline returns to a clean, stress-free green state.

### Scenario 10: Week Drag-and-Drop & Offline/No-AI Operation
1. The rep opens the Week view.
2. In the "Not scheduled yet" tray, there is a prospect card.
3. The rep drags the card onto Thursday.
4. The rep taps the `▲` button to move it to the first slot of Thursday.
5. All times and Thursday's leave-by banner update immediately.
6. The rep tests the app with the AI Assistant toggle switched **OFF**: all distances, travel times, slot suggestions, drag-and-drop, arrow reordering, and leave-by calculations continue to function with 100% precision because they are powered strictly by the deterministic TypeScript scheduling engine.

---

## 5. Architectural Safeguards
- **Zero Money Rule**: Verified that no dollar signs, packages, or compensation math exist in `src/features/myplan/`.
- **Pure Deterministic Math**: The scheduling engine in `src/features/myplan/engine/` is self-contained and covered by comprehensive unit tests.
- **Accessibility**: 48px min touch targets, 17px min body text, high-contrast borders, and screen-reader labels for all arrow buttons.
- **Rollback Safety**: Full Undo history stack for any slot moves or deletions.
