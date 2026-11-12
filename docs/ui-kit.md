# ApexDrive look and feel

Every screen uses the same small set of parts so the system feels like one app.
When you (or AI Studio) add or change a screen, use these instead of hand-styling.

## Rules
- **Plain words, sentence case.** "My prospects", not "The Bench (My Active Prospects)". No ALL CAPS, no typewriter font.
- **Readable sizes.** Body text 14–15px, never under 12px.
- **One blue button per screen** for the main action. Everything else is white (secondary) or plain (ghost).
- **Colour means something:** red = needs attention, amber = waiting / warning, green = done / good, violet = manager assist, blue = action.
- **Dates for people:** "Wed, Nov 11 · 11:00 AM", "3 days ago". Never show `2026-11-11`.
- **Every list gets the Toolbar:** search, the 2–4 filters that matter for that list, quick chips for the common questions, a sort, a count and Clear.

## Parts (`src/components/ui/kit.tsx`)
| Part | Use it for |
|---|---|
| `Page` | Wraps a screen (max width, spacing) |
| `PageHeader` | Title, one-line explanation, actions on the right |
| `SectionTitle` | A heading inside a panel, with an optional action on the right |
| `Btn` | Buttons: `primary`, `secondary`, `ghost`, `danger`, `success`, `attention`; sizes `md` / `sm` |
| `Panel` | White rounded card; `interactive` for clickable cards |
| `Badge` | Small coloured label (`tone`: neutral, blue, green, amber, red, violet, teal) |
| `Stat` | A number with a label; pass `onClick` + `active` to make it a filter |
| `Toolbar` | Search, filters (`defaultValue` for non-"all" defaults), chips, sort, count, Clear. Folds behind "Filters" on phones |
| `Switch` | Small segmented control (Board / Table, sections inside a page) |
| `Dialog` | Centred pop-up with title |
| `EmptyState` | "Nothing here" with a hint |
| `useSticky` | `useState` that remembers the value on this device (sorts, views) |

Also:
- `src/components/ui/NextStepPill.tsx` — the green "Next: …" / red "No next step · Plan it" line, and `nextStepSortKey`.
- `src/utils/format.ts` — `formatDay`, `formatDayTime`, `formatStamp`, `formatRelative`, `lastContactText`, `formatMoney`, `plural`, `matches`.
- `src/utils/stages.ts` — stage names and colours (`stageLabel`, `stageTone`, `PIPELINE_STAGES`).

## Logging a visit
There is one way to log a visit, call, Meet, email or text: My Plan's "How did it go?" form.
From anywhere else, call `onLogVisit(dealership)`; it opens that form (today's planned stop if there is one, otherwise an unplanned one).
Don't build a second visit form.

## Light and dark mode

- Choice is Auto (follows the device), Light or Dark. Top-bar menu and Settings → Appearance & data. Saved per device in `apexdrive_theme`; `src/utils/theme.ts` holds the logic.
- Write screens with the normal palette (`bg-white`, `text-slate-700`, `bg-amber-50`). `src/index.css` swaps the palette values in dark mode, so nothing is written twice. Do not hard-code hex colours.
- Colours that must not flip have their own names: `bg-brand`, `bg-danger`, `bg-success` (solid buttons), `text-onaccent` (text on them, never `text-white`), `bg-ink` / `bg-ink-2` (dark toast), `bg-scrim` (dialog backdrop).

## Layers and the Back button

- Nothing navigates away to show a form. The dealership record is a pop-in; My Plan forms (log a visit, add to plan, edit a slot, next step) open on top of whatever screen you are on: a right-hand panel on a computer, full screen on a phone. Closing or saving returns you to where you were (usually the record).
- My Plan is always mounted; `pageVisible` decides whether its page shows. Its forms open from anywhere via `planRequest` in `App.tsx`.
- Every screen change and every overlay adds a browser-history step (`src/utils/backStack.ts`). Back closes the top layer, steps back inside multi-step forms, then returns to the previous screen with its scroll position. New overlays: wrap them in `Dialog`/`FormShell`/`Sheet`, or add `<BackLayer onBack={close} />`.

## My team (who needs help)

- `src/features/team/signals.ts` holds the rules (pure code, tested). One report per rep; the manager's screen and the rep's "Worth a look" card read the same report.
- Status: Needs help if any rule says so or three things need an eye at once; Keep an eye if anything is open; otherwise On track. Acting on a flag (nudge, offer to join, note, check-in, "It's fine") quietens it for a week unless it gets worse.
- Owners and admins change the numbers in Settings → Team rules. Check-ins, notes and handled flags live in `src/features/team/store.ts`.
- Demo: Jason's team has Marcus (gone quiet), Priya (losing at Negotiation, one deal stuck), Ellie (new starter), Kelley (keep an eye) and Kevin (on track). See `REP_SITUATIONS` in `src/data/demo/places.ts`.
