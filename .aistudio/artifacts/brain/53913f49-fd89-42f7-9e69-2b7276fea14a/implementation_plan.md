# ApexDrive CRM: Improvement Pass v2 Implementation Plan

Comprehensive architectural and engineering plan to upgrade ApexDrive CRM into a field-sales platform with live gamification, dynamic manager assists, quantity-only product lifecycle servicing, audit-backed introduction incentives, AI coaching with manual stop locking, and financial-free executive reporting.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Strict No-Money Enforcement**: As specified in Section 1, every dollar figure, deal value, package price, revenue projection, and restock dollar total is eradicated from all UI views, data models, seeds, and AI prompts. The sole exception is **Incentive Dollar Amounts**, which are strictly access-controlled in both the data layer and the UI (visible exclusively to the owning rep, managers, owners, and finance controller Donna Clark; hidden from peers and team leads).

- **Navigation Renaming**: 
  - For Reps: *Handoffs* becomes **"My Assists"**
  - For Managers / Owners: *Handoffs* becomes **"Assist Requests"**
  - Settings Navigation: Added **"Game Rules Console"** & **"Incentive Rules"**
- **Catalog Scope**: Exactly 10 default products seeded, with dynamic open-catalog addition for managers/owners and quantity-only Keyfetch top-ups.
- **Pipeline Preservation**: "Handed Off" is removed as a pipeline stage; Manager Assist is rendered as an active badge/indicator across `Hot`, `Negotiation`, or `Contract`, ensuring reps retain ownership (`assignedRepId`).

---

## 1. Overview & Core Concept

ApexDrive CRM v2 empowers automotive field reps, territory managers, and dealership group owners to optimize their daily prospecting and client servicing. It transforms static CRM interactions into an engaging, live-gamified experience where reps earn points from verified, high-quality sales activities while adhering to field constraints (such as the 10 AM–4 PM dealership visit window).

### Target Personas
1. **Field Sales Reps (e.g., Alex Rivera, Marcus Vance)**: Use the mobile-optimized "Today" view, lock stops in the AI Planner, request manager assistance without surrendering deal ownership, track Keyfetch quantity top-ups, and see live point gains on every button.
2. **Territory & Regional Managers (e.g., Jason Scott, Sarah Jenkins)**: Push urgent priorities to rep schedules, accept assist requests, manage product bonuses (e.g., "+150 pts on Ceramic Pro"), and view team velocity.
3. **Finance Controller (Donna Clark)**: Audits introduction trails from origin claim to close, verifying and approving introduction incentive payouts with full trail accountability.
4. **Dealership Executives / Owners (David Sterling)**: Monitor group penetration, solo vs. assisted close ratios, and visual non-monetary health metrics on the Executive Desk.

---

## 2. Detailed Technical Plan by Sections (1–10)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        APEXDRIVE SYSTEM TOPOLOGY                       │
└────────────────────────────────────────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────────┐
│     Global Navigation & Game Strip    │   │      Role-Gated Permissions       │
│  Level Title • Progress • Points Ring │   │  Rep: Self-Only Incentive View    │
│  Streak Flame • Rank • Active Bonuses │   │  Manager/Owner/Finance: Full View │
└───────────────────┬───────────────────┘   └─────────────────┬─────────────────┘
                    │                                         │
        ┌───────────┴───────────┬─────────────────┬───────────┴───────────┐
        ▼                       ▼                 ▼                       ▼
┌──────────────────┐    ┌──────────────┐  ┌───────────────┐     ┌──────────────────┐
│  AI Day Planner  │    │   Pipeline   │  │   Portfolio   │     │  Game Rules &    │
│  - Locked Stops  │    │  - No Money  │  │ - Keyfetch    │     │  Finance Ledger  │
│  - Mgr Priorities│    │  - Assist    │  │   Quantity-   │     │ - Live Rules     │
│  - Ghost Radar   │    │    Badges    │  │   Only Top-Up │     │ - Intro Trail    │
│  - Temp Sparkline│    │  - Rep Owns  │  │ - Upsells Mini│     │ - Donna's Queue  │
└──────────────────┘    └──────────────┘  └───────────────┘     └──────────────────┘
```

### Section 1: No Monetary / Financial Data (Global Rule)
- **Data Model Purge**: Remove `dealValue`, `price`, `unitPrice`, `pricingModel`, `restockCost`, `totalRevenue`, `spend`, and `roi` from `src/types/crm.ts`, `seedData.ts`, and `storageAdapter.ts`.
- **UI Metrics Replacement**: Replace all dollar totals with operational volumes: counts of active prospects, visits completed inside good window (10 AM–4 PM), deals won, clients signed, products per client, upsells won, and Keyfetch units restocked.
- **Card & AI Sanitation**: Strip pricing mentions from all AI prompts, deal cards, and activity notes (e.g., convert "$3,800 VSC package" to "Comprehensive VSC & Certified Warranty Coverage").
- **Strict Exception**: Incentive dollar amounts exist *only* on `IntroductionIncentive` records and are strictly masked for unauthorized users.

### Section 2: Product Catalog & Product Lifecycle
- **Default Catalog (10 Products)**:
  1. Vehicle Service Contract (Extended Warranty)
  2. Certified Limited Warranty
  3. Keyfetch (*requires inventory top-ups* flag = true)
  4. GAP
  5. Tire & Wheel Protection
  6. Maintenance
  7. GPS + AI + Vehicle History Plug-in
  8. ChargeClub (No Capex)
  9. EV Solutions
  10. Ceramic Pro (*NEW launch badge*)
- **Open Catalog Operations**: Managers and owners can add new products via modal (name, category, description, inventory flag, launch badge) or toggle active status without deletion.
- **Scouting Stage**: 2-column checkbox matrix for product interest with optional Low / Medium / High priority rating.
- **Sign-Up Stage**: Pre-populates selected products directly from scouting interest.
- **Client Servicing**:
  - *Keyfetch Inventory Top-Ups*: Visible **only** if client has Keyfetch. Logged as quantity only (e.g., 50 fobs), displaying top-up history, average run-rate, and predicted re-order date.
  - *Upsells*: Mini-opportunity tracker (`Identified` → `Pitched` → `Interested` → `Won` / `Lost`) for products the client does not yet have. Winning adds the product to the client's live roster.
  - *Product Summary Matrix*: Tabular view of Has / Upselling / Not Offered Yet across the catalog.

### Section 3: Manager Assist Flow (Rep Retains Ownership)
- **Terminology & Navigation**:
  - Rep Nav: **"My Assists"**
  - Manager/Owner Nav: **"Assist Requests"**
- **Pipeline Stage Fix**: Delete the "Handed Off" stage column. The deal remains in `Hot`, `Negotiation`, or `Contract` with an animated **Manager Assist** badge.
- **Assist Request Modal**:
  - Types: *Join Call*, *In-Person Visit*, *Google Meet*, *Terms Review*, *Strategy Session*, *Closing/Signing Support*.
  - Meeting window picker enforcing the 10 AM–4 PM local window for visits.
  - AI briefing generated from notes, objections, and decision-maker profiles (zero pricing).
  - Defaults to the rep's actual direct manager (e.g., Jason Scott or Sarah Jenkins) with override selection.
- **Manager Response & Ownership**:
  - Actions: *Accept* (adds to both planners & Google Calendar), *Propose Alternate Time*, or *Decline with Reason*.
  - Rep retains `assignedRepId` and deal ownership.
  - Explicit ownership transfer requires a manager/owner action with an audited mandatory reason. Origin rep attribution is immutable.

### Section 4: Introduction Incentives (With or Without Assist)
- **Independence from Assists**: Introductions trigger automatically from configurable milestone events (e.g., qualified introduction, contract signed, onboarding complete), regardless of whether an assist took place.
- **Visual Introduction Trail**: Interactive timeline rendering the full genesis: `Source Claim` → `Visits & Good-Window Checks` → `Product Interest Logged` → `Manager Assist (if any)` → `Deal Closed & Signed` → `Onboarding`.
- **Donna Clark's Finance Queue**:
  - States: `Eligible` → `Pending Verification` → `Verified` → `Approved` → `Paid` / `Disputed` / `Rejected`.
  - Finance sets/edits the dollar amount, flags conflicts (e.g., dual-rep touches or transfers), and marks external payment details.
- **Role-Gated Data & UI Privacy**:
  - Sales reps see *only their own* incentive dollar amounts.
  - Managers, owners, and finance see *all* incentive amounts.
  - Peers and team leads see the trail and status, but the amount is completely masked (`$ —` or hidden, with no leaky placeholders). Enforced at the adapter layer.

### Section 5: Live Gamification Engine
- **Persistent Top Game Strip**: Rendered across the top bar on all pages:
  - Level number & professional title (Rookie → Road Warrior → Lot Legend → Closer → Territory Boss → Hall of Fame).
  - XP progress bar to next level.
  - Circular progress ring of Points Today vs. Daily Target.
  - Streak flame indicator with active days.
  - Territory Rank (`#1 in Texas Central`).
  - Active Multiplier / Bonus badges (`🔥 2x GAP`, `+150 Ceramic Pro`).
- **Live Action Buttons**: Dynamic point chips on interaction triggers (e.g., `Log Visit +40 pts`, `Request Assist +25 pts`, `Keyfetch Top-up +30 pts`).
- **Visual Rewards**: Animated notification toasts (`+40 pts • Visit logged at Smith Motors`), celebratory confetti bursts on deal closings and level-ups, and badging progress bars across 7 core categories.
- **Podium Leaderboard**: Real-time podium (1st, 2nd, 3rd) with filterable time horizons (Week, Month, Quarter, Season) and rank-change velocity markers (`▲2`).
- **Live Points Ledger**: Every single score increment is backed by a verifiable `PointsLedgerEntry` linked to the dealership, user, action, and active rule version.

### Section 6: Game Rules Console (Settings → Game Rules)
- **Access Control**: Owners edit all rules; managers create team/regional bonuses and quests; reps view in read-only transparency mode.
- **Scorable Actions Editor**: Configurable point values, daily caps, and enabled switches for 16 core field actions.
- **Product Bonuses**: Dynamic bonus builder targeting any catalog product (e.g., "+150 pts on Ceramic Pro upsells", "2x Multiplier on GAP sign-ups this month") with date ranges and regional filters.
- **Rule Simulation**: Live sandbox to recalculate how the leaderboard would shift under proposed rule changes before committing.

### Section 7: AI Coach, Manual Control & Manager Priorities
- **Today's Game Plan**: Smart sequence interleaving good-window stops (10 AM–4 PM), off-hour outreach (calls/emails), assists, Keyfetch top-ups due, overdue follow-ups, and manager priorities.
- **Stop Pinning & Locking (`isLocked: true`)**: Reps can manually pin stops or add custom personal blocks (`Admin / Catch-up 9–10 AM`). Clicking "AI Optimize Route" regenerates the sequence *around* locked stops without overwriting manual edits.
- **Missed-Communication Radar & Temperature**:
  - Dealership relationship temperature score (0–100) with micro sparkline and sentiment tags (*High Intent*, *Hesitant on Terms*, *Ghosting Risk*).
  - Direct one-click quick action buttons to resolve flagged communication gaps.
- **Manager Priorities**:
  - Managers push urgent tasks (Normal / High / Urgent) with linked dealerships, products, and bonus points.
  - Displays with a distinguished "Manager Priority: Jason Scott" badge in the rep's planner.
  - Reps can *Accept*, *Schedule*, *Complete*, or *Decline with Reason*.

### Section 8: Engaging Field Experience
- **Dedicated "Today" Rep Home**: Consolidates next stop navigation, pre-visit briefing, quick check-in, active daily quests, and manager priorities.
- **Universal Quick-Log Sheet**: Slide-out drawer to log visits, calls, emails, notes, Keyfetch top-ups, and product interest in seconds with instant point preview and celebration feedback.
- **Live Team Wins Feed**: Interactive stream of wins, badges, and milestones with peer reactions (`👏`, `🔥`).

### Section 9: Visual Reporting (Strictly Non-Monetary)
- **Executive Desk AI Narrative**: Dynamic summary headline with 3 key highlights, 3 operational concerns, and 3 high-impact recommendations.
- **Non-Monetary Charts**:
  - Funnel conversion and stage velocity.
  - Product penetration & upsells won by product.
  - Solo vs. assisted closing ratios.
  - Good-window (10 AM–4 PM) compliance vs. off-hour visits.
  - Keyfetch physical units topped up over time.
  - Territory geographic heatmap with 60-mile radius rings.
- **Finance Pipeline Funnel**: Flow metrics tracking introductions from `Eligible` to `Paid`, turnaround time, and regional volume.

### Section 10: Purge of Hardcoded & Static Artifacts
- Replace all static gamification constants with dynamic queries against `PointsLedger`.
- Eradicate hardcoded assist defaults (`"Dealer Principal"`, `"Standard contract terms"`); synthesize briefs dynamically from real contact and meeting history.
- Eliminate hardcoded restock prices (`$4.25`) and replace with clean quantity inputs.
- Clean up inactive demo buttons and bind every action to verifiable state mutations.

---

## 3. Files to Modify and Create

| Target File | Scope of Changes |
| :--- | :--- |
| `src/types/crm.ts` | Purge all financial fields (except `Incentive.amount`). Add `ProductCatalogItem`, `ManagerAssist`, `ManagerPriority`, `GameRule`, `ProductBonus`, `PointsLedgerEntry`, and locked stop properties. Remove `Handed Off` from `PipelineStage`. |
| `src/data/seedData.ts` | Remove all dollar signs. Seed exactly 10 catalog products (Ceramic Pro included), quantity-only Keyfetch top-ups, real assists in multiple states, manager priorities, and pre-computed points ledger entries. |
| `src/services/storageAdapter.ts` | Remove financial calculations. Add repositories for `Points_Ledger`, `Game_Rules`, `Product_Bonuses`, `Manager_Priorities`, and `Manager_Assists`. Enforce role-based masking of incentive amounts in the data layer. |
| `src/services/aiService.ts` | Scrub all financial references from prompts. Add AI logic for game plan generation with locked stop awareness, briefing generation, and relationship temperature scoring. |
| `src/components/layout/Navbar.tsx` | Embed the persistent top Game Strip (level title, points progress bar, today's point ring, streak flame, rank badge, active product bonus tags). |
| `src/components/layout/Sidebar.tsx` | Update navigation labels per role: "My Assists" for reps, "Assist Requests" for managers; add "Game Rules" under Settings. |
| `src/components/views/PlannerView.tsx` | Upgrade with AI Coach Today's Plan, stop pin/lock toggle, manager priority cards, drag-and-drop manual reordering, and zero-money metrics. |
| `src/components/views/PipelineView.tsx` | Remove "Handed Off" column. Add dynamic "Manager Assist" badges to `Hot`, `Negotiation`, and `Contract`. Display relationship temperature and non-monetary dealership metrics. |
| `src/components/views/DealershipDetailModal.tsx` | Add 2-column product interest checklist, relationship temperature sparklines, assist request flow with dynamic briefing, and Keyfetch quantity top-up log. |
| `src/components/views/ClientPortfolioView.tsx` | Show Keyfetch top-up history and predicted re-order dates **only** for Keyfetch clients. Add mini-opportunity upsell tracker across remaining catalog products. |
| `src/components/views/ManagerAssistView.tsx` | Replaces `HandoffClosingView.tsx`. Full assist request workflow: Accept/Propose/Decline, joint activity logging, explicit ownership transfer with required audited reason. |
| `src/components/views/FinanceLedgerView.tsx` | Introduction incentive queue with full visual timeline, independent of assist status. Enforce role-gated amount visibility. |
| `src/components/views/GameRulesConsoleView.tsx` | New view under Settings: scorable actions table, product bonus builder (e.g., Ceramic Pro +150), multipliers, and sandbox simulation. |
| `src/components/views/ExecutiveDeskView.tsx` | Complete overhaul to non-monetary visual storytelling: AI narrative headline, volume/rate KPIs, Recharts conversion and velocity charts, territory heatmap. |
| `src/components/common/QuickLogModal.tsx` | Universal quick-log drawer with live points preview chips and post-action celebration toasts. |

---

## 4. Verification & Testing Strategy

1. **Unit Testing (`node:test`)**:
   - Verify territory math (60-mile radius, 10 AM–4 PM window check).
   - Test live points calculations against ledger entries, multipliers, and product bonuses.
   - Test data-layer incentive visibility masking (confirm peer reps cannot read amounts).
2. **Compilation & Linting**: Run `compile_applet` and `lint_applet` to ensure strict TypeScript type safety without errors.
3. **End-to-End Browser Verification**:
   - Inspect the persistent Game Strip across all pages.
   - Test stop locking in the AI Planner and verify the AI regenerates around locked stops.
   - Verify Keyfetch quantity top-up behavior (present only for Keyfetch clients).
   - Verify role switching: confirm Rep view hides peer incentive amounts while Manager/Finance view displays them.
   - Verify Manager Assist workflow and ensure deal ownership remains with the origin rep.
