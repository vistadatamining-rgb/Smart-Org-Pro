# Smart Org Pro — Power BI Custom Visual

A pbiviz project scaffold for the org-chart visual: glass hover cards, live KPI
performance bars, six themes, five connector styles, four progress-bar styles,
Focus Mode, click-to-collapse/expand, Ctrl + wheel zoom, a department color
legend, and an always-visible data card under each person — all exposed through
the Format pane.

## v2.2.4.0 — Gauge style removed

Removed entirely, by request, rather than kept around as a fifth option: the
Progress bar style dropdown now offers Classic, Segmented, Target Marker, and
Gradient. (It had been fixed twice in a row — see v2.2.0.0 item 1 and v2.2.2.0
below — but was dropped anyway rather than continuing to carry its extra SVG/
geometry code.)

## v2.2.0.0 — four more real bugs, found by code audit against a live report

1. **Container style / Progress bar style / Tooltip style silently did nothing.**
   All three read their setting with `.value.value` — the pattern for an
   `ItemDropdown`. But all three are `NumUpDown` (per this project's Format Pane
   persistence bug), where `.value` is already the plain number — `.value.value` on
   a number is `undefined` in JavaScript, so every one of these three settings
   silently fell through to its default case no matter what number was typed in.
   This is specifically why **Gauge never actually rendered** — Progress bar style
   could never resolve to anything but "Classic". Fixed by converting the number to
   a style name properly (the same `pickByIndex` helper already used elsewhere).
2. **The target marker sat in almost the same spot on nearly every bar.** The bar's
   scale was based on the achievement *percentage*, with a fixed floor of 130 — since
   target always normalizes to exactly 100 on that scale, and the floor dominates for
   the entire 0-113% range (where almost all real KPIs land), the marker landed at the
   same ~77% position regardless of the actual numbers. Rebuilt the scale to use the
   **raw values** instead — this person's value, their target, and the highest value
   anyone on the chart has for that same field — so the marker's position genuinely
   reflects how this specific target compares to the data, and moves row to row.
3. **A collapsed KPI area could visually detach from its own +/- toggle and the
   connectors below it.** The node's outer box gets a *fixed* height (the max needed
   across every node in its current state, so one person's expanded KPI area doesn't
   overlap their neighbors) — but the KPI area itself had no explicit height, so a
   collapsed area (short content) left empty space between itself and the node's fixed
   bottom edge, where the toggle and next-level connectors are anchored. Gave the KPI
   area a `min-height` matching what was actually reserved for it, so a node's visible
   content always reaches its own bottom edge regardless of expand state.
4. **Gauge style now actually renders** (was unreachable before fix #1) with a needle,
   a target tick, and the percentage printed underneath the dial.

## v2.1.0.0 — three real bugs from a live screenshot report

1. **The employee hover panel (Overall Performance) was popping up over/behind the KPI
   area's own tooltip.** Its CSS trigger was `.sop-node:hover .sop-panel`, which fires
   on hovering ANYWHERE inside the node — including the KPI Performance area below the
   card, since both are children of the same `.sop-node`. Scoped the trigger to
   `.sop-cardslot:hover ~ .sop-panel` instead (the card itself, not the whole node), so
   hovering the photo/card shows only the performance panel, and hovering/clicking the
   KPI area below shows only the KPI tooltip — they can no longer both fire from the
   same hover. Also raised the performance panel's z-index above the KPI tooltip's as a
   safety margin in case their footprints ever do overlap.
2. **No visible sign the KPI area was clickable, or which state it was in.** Added a
   small ▾ / ▴ chevron in the corner of the KPI area (mirrors the existing +/- hierarchy
   toggle) — ▾ means click to expand, ▴ means click to collapse.
3. **Format Pane labels were unclear**, specifically:
   - The 4 manual-target fields said generic "Manual target for KPI 1" — never renamed
     to the actual measure like the visibility/direction fields were. Now all three
     (show / target / direction) rename to the real measure name, e.g. *"Sales — show
     this KPI? (1 = yes, 0 = hide it)"*, *"Sales — manual target (0 = use the Target
     measure instead)"*, *"Sales — lower is better? (1 = yes, 0 = higher is better)"*.
   - Every remaining on/off field was reworded from "(0 = off, 1 = on)" to
     "(1 = on, 0 = off)" — leading with what turns it ON, since that's almost always
     what someone is trying to do when they open that field.
   - Style pickers (Container/Progress/Tooltip style) were reworded to put "type 0-N"
     immediately after the field name, before the list of options — so the essential
     instruction survives even if the Format pane's narrow column truncates the option
     list after it.

## v2.0.0.0 — KPI Performance area rebuilt to spec (click-to-expand, 5+5 styles, conditional formatting)

The KPI/data-card area under each person's card was rebuilt from scratch against a
detailed feature spec. Nothing else in the visual changed — hierarchy, cards, photos,
connectors, zoom/pan, the existing hover Performance panel, and every other Format
Pane card are untouched.

### Data roles
- **Data card values** / **Data card targets** — unchanged, still pair by drop order.
- **Data card previous period** *(new, optional)* — pairs by drop order the same way
  targets do. Powers the tooltip's Previous/Growth rows only; leave it unbound and
  those two rows simply don't appear.

### Collapsed state (default)
Compact "Name    Value" rows only — no bars, no target, no gap. The value is colored
by conditional formatting (see below) if the KPI has a target or enough peer data to
compare against; otherwise it's the plain value color.

### Click behavior
Click **anywhere in the KPI area** (not on an individual KPI) to expand **every**
visible KPI for that person at once, and again to collapse. This is per-person — one
person can be expanded while everyone else stays collapsed. Whatever number of
measures you've bound (4, 6, 10...) all render; nothing is hard-coded to a count.

### Expanded state
Each KPI shows: name, a colored status dot + achievement %, a progress bar with a
**distinct target marker** (never just "fill to X%" with nothing to compare it to),
and an Actual/Target line underneath. Hovering the bar shows the detailed tooltip.

### 4 progress bar styles (Format → KPI Performance → *Progress style* dropdown)
Classic Horizontal · Segmented (10 blocks, target on its own block) · Target Marker
(thicker bar, bolder marker) · Gradient. All four draw the actual value AND the
target marker — style changes the visual treatment, not what information shows.

### 5 tooltip styles (*Tooltip style*, 0-4)
0 Minimal · 1 Executive Card (white, print-like) · 2 Modern Dark · 3 Glass/Premium
(blurred, gradient-text header) · 4 Detailed Analytics (wider, accent-striped rows).
All five show the same fields: Actual, Target, Achievement, Gap, and — only when a
previous-period measure is bound — Previous and Growth, plus a Status line colored by
the same conditional-formatting thresholds as everything else.

### Conditional formatting
Threshold-based, not a gradient: **Green** at or above the green threshold (default
100% of target), **Yellow** at or above the yellow threshold (default 80%), **Red**
below that. Applied consistently everywhere a KPI's status shows — collapsed value
color, expanded status dot, achievement %, progress bar fill, and every tooltip
style's Status row. Also supports **Higher is better** vs **Lower is better** per
KPI (for measures like Discount or Cost, where a lower value is the good outcome) —
the comparison mirrors around 100% so the same two thresholds work either way.

### Per-KPI visibility & direction
The Format pane can't generate a truly dynamic number of controls (one per bound
measure), so — the same way this project already handles 8 department colors — there
are **8 numbered slots** for KPI visibility and 8 for direction, and each slot's label
renames itself to your actual measure name once you bind it (e.g. "KPI 1 (unused)"
becomes "Show 'Sales' (0 = off, 1 = on)"). Measures beyond the 8th have no control and
are always shown, defaulting to "Higher is better".

### Format Pane structure (all NumUpDown/ColorPicker — see the note below)
Enable KPI Performance · Container style (0-7, same 8 looks as before: Glass, Neon,
Gradient, Sidebar, Elevated, Outline, Solid, Frost) · Progress style & height ·
Tooltip enable & style · font size, decimals, compact numbers, corner radius, opacity,
background/label/value colors · Green/Yellow thresholds & their 3 colors · 8×
visibility switches · 8× direction switches · 4× manual target overrides (0 = use the
measure instead).

**Why no ToggleSwitch or ItemDropdown anywhere on this card:** this project's Power BI
environment has a documented Format Pane bug where those two control types silently
fail to persist. Every control here is NumUpDown (0/1 for on-off, or a small index for
a style choice — the field's own name spells out what each number means) or
ColorPicker, both of which persist correctly.

## v1.8.0.0 — data card rebuilt to guarantee it looks like the tooltip

After several rounds where the data card's progress bar kept not showing despite
looking correct in the Format pane, this version stops maintaining a second, separately
-styled implementation and makes the data card **reuse the exact same CSS classes and
markup as the already-working hover tooltip's KPI rows** (`.sop-kpi-mini .row`,
`.kpi-label`, `.kpi-val`, `.track`). There is now only one bar implementation in the
whole visual, not two, so there's nothing left for the two to disagree about.

What changed:

- **Every per-field visibility toggle removed** (show labels / show values / show
  target / show % / show progress bar / tooltip arrow) — these were `ToggleSwitch`
  controls, the exact type with the documented persistence bug, and were the likely
  reason the bar kept silently not showing no matter what the pane displayed. A row
  now always shows its label, value, target (when there is one), % and bar — exactly
  like the tooltip's rows already do, with nothing to toggle off by accident.
- **The separate "target line" feature removed.** It duplicated what the bar +
  % badge already show; folding it away removes one more thing that could break.
- **4 layouts collapsed to 1.** The data card now always uses the same row shape as
  the tooltip: label — value — bar, one per line. "Two columns" / "one per row" /
  "inline chips" are gone.
- **7 bar styles collapsed to 1.** Same reasoning — one bar implementation, the
  proven one.
- **Progress bars now show even with NO target bound at all.** If a value has no
  target (measure or manual), its bar is drawn relative to the **highest value for
  that same field among all the people on the chart** — so Sales still gets a bar
  even if you never set up a Sales target, it's just showing "how this compares to
  your top performer" instead of "how this compares to your target." Hovering a bar's
  row shows which one it's doing in its tooltip text.
- **8 card styles (Glass/Neon/Gradient/Sidebar/Elevated/Outline/Solid/Frost) kept** —
  these only affect the outer box (background/border/glow), not the rows inside, so
  they were not the source of the bug and are unchanged.

## v1.7.1.0 — progress bar & filter logging

Three more fixes:

1. **Progress bar height not accounted for** — Even when `Show progress bar` was
   enabled, the height calculation (`computeDataCardHeight`) only reserved space
   IF at least one stat had a target. Meant if you had stats without targets,
   the progress bars (for those that did have targets) got clipped or invisible.
   Fixed: bar height is now reserved whenever `Show progress bar` is ON,
   regardless of whether the data actually has targets.
2. **Cross-filter logging.** The filter code now logs every step to the browser
   console — from the click to the filter target it derives to the actual
   `applyJsonFilter` call — so if filtering still doesn't work, you can right-
   click → Inspect → Console and see exactly where it's failing. This will help
   diagnose whether it's a "wrong table/column name" issue or something else.
3. **"Target for value 1/2/3/4" labels clearer.** Changed the Format Pane labels
   from *"Target for value 1 (0 = auto)"* to *"Manual target for stat 1 (0 = use
   measure or no target)"* so you understand these override the "Data card targets"
   measure, not replace it entirely.

## v1.7.0.0 — bug fixes

Four concrete fixes from a real bug report:

1. **Data card style/layout/bar-style dropdowns not applying.** These three were
   `ItemDropdown` controls, and this project's Power BI Desktop environment has a
   documented Format Pane bug where `ItemDropdown`/`ToggleSwitch` values silently
   fail to persist (they always revert to the compiled default, no matter what you
   pick). Converted all three to `NumUpDown` index pickers instead (0, 1, 2...),
   which — per the same investigation — persist correctly in this environment.
   The Format pane field name spells out what each number means, e.g.
   *"Card style: 0 Glass, 1 Neon, 2 Gradient, 3 Sidebar, 4 Elevated, 5 Outline,
   6 Solid, 7 Frost"*.
2. **"Sum of X" showing instead of "X"** in the data card labels — a regression
   from the previous round where the existing label-cleaning helper stopped being
   applied to the new target-line code path. Reapplied it everywhere a measure
   name is shown.
3. **Clicking a legend color didn't filter anything.** The `applyJsonFilter` call
   was using the wrong 4th argument (a plain `undefined` instead of the
   `FilterAction` enum) and pointed the filter at the column's *display* name
   instead of its real table/column name from `queryName`. Fixed both — cross-
   filtering needs Power BI **Service** (web), not Desktop, to actually take
   effect on other visuals on the page.
4. **The hover detail panel (Overall Performance %) getting clipped** for cards
   near the right or bottom edge of the chart. The panel was hardcoded to always
   open to the right (`left: 100% + 10px`) regardless of how much room was left.
   It now checks the node's position against the stage's bounding box and flips
   to open left/up when there isn't roughly 260px of room, so the % is never cut
   off again.

**Reminder if a style/layout/color still doesn't change:** given the documented
persistence bug, please re-test on **Power BI Service** (app.powerbi.com) rather
than Desktop before assuming a setting is still broken — Desktop in this specific
environment has been unreliable for several control types across this whole
project, independent of anything in this visual's code.

**Reminder about progress bars / the target line:** they only appear for a value
that actually has a target — either through the **Data card targets** role
(paired with **Data card values** by drop order) or a manual number in
Format → Data Card → *Target for value 1-4*. A value with no target shows the
number only, by design, since there's nothing to compare it against.

## Zooming

Hold **Ctrl** (or **Cmd** on macOS) and scroll the wheel over the chart to zoom
in and out around the mouse pointer. A plain wheel scroll still scrolls the chart
normally. The small `− 100% + ⟲` control in the bottom-right corner does the same
thing by click, and `⟲` snaps back to the configured default zoom. Both the
gesture and the buttons can be turned off in Format → **Zoom & Pan**.

This was written and structured by hand in a sandbox with no internet access,
so it has **not** been run through `pbiviz` or the TypeScript compiler yet.
The code follows the current (apiVersion 5.9) custom-visuals API and the
`powerbi-visuals-utils-formattingmodel` pattern, but please run the steps
below locally and send me any compiler/runtime errors — I'll fix them fast.

## 1. Prerequisites

- Node.js LTS (18 or 20)
- `npm install -g powerbi-visuals-tools`
- A Power BI Desktop or powerbi.com developer/test environment with
  **Developer visual** enabled (Options → Preview features)

## 2. Install & run

```bash
cd smart-org-pro-visual
npm install
pbiviz start
```

`pbiviz start` serves the visual on `https://localhost:8080`. In Power BI
Desktop, add the **Developer Visual** from the visualizations pane — it will
pick up your local build with hot reload.

## 3. Load sample data

Import `sample-data.csv` into Power BI (Get Data → Text/CSV), drop it onto the
Developer Visual, and map fields:

| Field           | Data role       |
|-----------------|-----------------|
| EmployeeID      | Employee ID     |
| ManagerID       | Manager ID      |
| Name            | Name            |
| Title           | Title           |
| Department      | Department      |
| Photo           | Photo URL       |
| Performance     | Performance %   |
| Attendance      | KPI measures    |
| TaskCompletion  | KPI measures    |
| Sales           | Data card values |
| Profit          | Data card values |
| Orders          | Data card values |
| Discount        | Data card values |
| SalesTarget     | Data card targets |
| ProfitTarget    | Data card targets |

`Manager ID` blank = root node (the CEO row). You can add more `KPI measures`
columns — each becomes a mini progress row inside the hover card.

`Data card values` is a separate bucket for raw business numbers (sales, profit,
order count, discount...). Unlike `KPI measures` — which are 0-100 percentages
drawn as bars inside the *hover* panel — data card values are shown as formatted
numbers in a small tooltip-style panel pinned **permanently under every person's
card**, always visible without hovering. Drop as many numeric columns in as you need.

`Data card targets` is optional and pairs with `Data card values` **by drop
order** — the 1st target measure belongs to the 1st value, the 2nd to the 2nd,
and so on. Where a value has a target, the data card also draws the target, the
% of target reached, and a progress bar, and colors the number on a three-color
gradient. You can skip the measure entirely and type a fixed target for each of
the first four values in Format → Data Card instead (0 = use the measure, or no
target at all). A manual target always wins over the measure.

## 4. Format pane

All the "engines" from the spec are exposed as Format pane cards:

- **Card Style** — Glass Card (hover KPI panel, original design) or Pill Card
  (photo ribbon, overlapping avatar — the reference screenshot style), plus a
  5-option color palette (Vibrant / Sunset / Ocean / Emerald Corporate /
  Monochrome Executive) used only by the Pill Card, colored by hierarchy depth
- **Layout Engine** — Vertical / Horizontal / Radial / Compact, card width, level spacing
- **Theme Engine** — Dark Neon / Corporate / Finance / HR / Healthcare / Apple Glass
- **Connector Lines** — Dashed / Straight / Curved / Animated Flow / Neon Glow
- **Performance Bar** — Linear Gradient / Neon / Liquid Fill / Segmented / Circular Ring
- **Interaction** — Focus Mode toggle, auto-collapse below a given depth
- **Department Legend** — on/off (either the switch or picking **Hidden** as the
  position), position (right / left / top / bottom / hidden), title
  text, font size, panel width and text color. The swatches come straight from
  the **Department Colors** card, so the key always matches what's on the chart
- **Data Card (under each person)** — a tooltip-style panel of raw numbers:
  - **8 styles** — Glass Tooltip, Neon Glow, Gradient Fill, Side Accent Bar,
    Elevated Card, Outline Ghost, Solid Dark, Frosted Minimal
  - **4 layouts** — Panel rows (the default: name, number and bar on one line,
    exactly like the hover card), two columns, one per row, inline chips
  - **7 progress bar styles** — Rounded Gradient, Neon Glow, Segmented,
    Animated Stripes, Gradient Track + Marker (the track shows the whole
    low/mid/high scale and a marker slides along it), Thick Pill with the %
    inside, and Dots — plus a bar height setting
  - each piece switches on and off independently: field names, the numbers
    themselves, the target, the % of target, the progress bar, the tooltip arrow
  - font size, decimal places, short-number mode (1.2K / 3.4M), corner radius,
    opacity, background, label and value colors, department-colored accent edge
  - **three-color gradient driven by % of target**: low / mid / high colors with
    three configurable stop percentages (defaults 50 / 80 / 100), so "good"
    can mean 90% of target if that's what it means for your team. The whole card
    — glow, edge, gradient fill — picks up the color of the person's *average*
    achievement, so a struggling person's card reads red at a glance
- **Zoom & Pan** — enable Ctrl + wheel zoom, show/hide the on-canvas zoom
  buttons, and set the default / min / max zoom percentages

## 5. Package for AppSource / sharing

```bash
pbiviz package
```

Produces a `.pbiviz` file in `/dist` you can import directly into a report or
submit to AppSource (after adding a real `assets/icon.png` — a 20×20 png
placeholder is required and isn't included here).

## 6. Licensing

The visual ships with a 5-day full-feature trial + Pro (daily/monthly) /
Premium (yearly/unlimited) tiers, verified **entirely offline** — no network
call, no server, no `WebAccess` privilege needed. This matches the
`License-Generator/` tool (adapted from the SmartProgressPro architecture)
also bundled in this project: you sign license keys on your own machine
(works fully air-gapped), the customer pastes the resulting string into the
visual, and `src/License/LicenseCrypto.ts` verifies it with an embedded
public key — never needs to phone home.

### One-time setup

Prints a `base64url(payload).base64url(signature)` string — send that to the
customer. They paste it into Format → License → **Activation key**, and type
the **same email** into **Customer email**. Both must match exactly (case-
insensitive) or the key is rejected — this is what enforces "one email per
key" (requirement #7), entirely client-side, with no server involved.

### What's actually enforced, and how

- **Trial anchor** (`src/License/TrialEngine.ts`): the first time the visual
  runs, it stores a `trialStartDate` via `src/License/Storage.ts`, keyed
  only by the visual's own GUID — **not** by email, so typing a different
  email can't reset the clock, and adding the visual again on another page
  or report reads the *same* stored trial instead of starting a new one
  (requirement #6) — **when the shared storage path is available; see the
  Power BI Desktop caveat below, it's an important one.**
- **Clock-rollback defense**: a `lastSeen` timestamp is ratcheted forward on
  every check and used as the tamper-resistant "effective now" for *both*
  the trial countdown and the paid-license expiry check in
  `LicenseEngine.ts`. If the OS clock is ever earlier than the last recorded
  `lastSeen` (beyond a 2-hour DST/timezone tolerance), the visual locks
  immediately with a "clock tampering detected" message — and because paid
  expiry reuses the same ratcheted value, rolling the clock back can't
  resurrect an already-expired Pro/Premium key either.
- **Email + device lock** (`LicenseEngine.ts`): the signed payload's
  `boundEmail` must match what's typed in Customer Email; an optional
  `deviceCode` (only present if you passed `--device` when issuing) must
  match this machine's own persisted code, shown read-only in the License
  card (`src/License/DeviceFingerprint.ts`).
- **Feature gating while unlicensed** (`src/Core/constants.ts`'s
  `FEATURE_MATRIX`, consulted throughout `render()` in `visual.ts`): the
  card style is forced to Glass, layout to Vertical, connector to Dashed,
  performance bar to Linear, theme to Dark Neon, Focus Mode off, and the
  hover detail/KPI panel is **never added to the DOM** (not hidden with
  CSS). `.sop-restricted` also kills every CSS animation/transition. None of
  this reads the user's actual Format-pane choices while unlicensed, so it
  can't be restored by toggling a class in DevTools — only by a valid
  license (or, per the honesty note below, by patching the compiled JS
  directly).
- **Expired/invalid state**: a centered lock icon at 70% opacity plus a
  tiled "SMART ORG PRO" watermark appears over the chart
  (`renderLicenseUi()` in `visual.ts`). It does **not** block clicks
  (`pointer-events: none` on the overlay) — the degraded free-tier chart
  underneath stays usable; the watermark is a persistent upgrade reminder,
  not a hard lockout screen.

### Known limitations — please read before relying on this

- **Nothing running as plain client-side JS in a `.pbiviz` can be made truly
  uncrackable.** The bundled code is fully readable and editable by anyone
  with browser DevTools. Signature verification stops someone from *forging*
  a license they were never issued — it does not stop someone from patching
  the compiled `visual.js` to skip the check entirely. This raises the bar a
  lot for casual reuse; it is not DRM.
- **This tool doesn't stop you (or anyone with the private key) from issuing
  several licenses under one email, or several device-locked keys for the
  same person** — see `License-Generator/README.md`'s "What this tool does
  NOT do". `src/License/TrialServerHook.ts` is an intentional no-op
  placeholder for a future server that would add that cross-device
  enforcement; the offline system here doesn't need one to function.
- **Power BI Desktop does not support the local storage API for custom
  visuals at all, by design** — `storageV2Service.status()` always resolves
  to `DisabledByAdmin` there, regardless of `capabilities.json` or org
  settings (confirmed via Microsoft's developer community; this cannot be
  worked around). `src/License/Storage.ts` handles this with a fallback to
  `persistProperties` (writes into the report file itself), which works in
  Desktop but is scoped to **this one visual instance/page** — re-adding the
  visual elsewhere under the fallback path starts a fresh trial, unlike the
  shared-storage path used in Power BI Service. If your customers mostly use
  Desktop, requirement #6 only fully holds within a single report; if they
  use the Service (web), it holds across every report on that account.
- V2 local storage (when it *is* available, e.g. Power BI Service) is
  scoped to "same GUID, same environment, same signed-in user" and isn't
  guaranteed to sync between Desktop and Service for the same person.

## Known gaps to fill in next

- `assets/icon.png` is not included — add a real icon before packaging.
- No selection/cross-filtering wired to `ISelectionManager` yet (click just
  drives Focus Mode / collapse locally).
- No native tooltip service integration — the glass panel is a custom hover
  overlay, not the Power BI tooltip API, so it won't appear in exported PDFs
  or on touch devices without a tap-to-toggle fallback.
- Mind Map / Matrix / Fishbone / Network layouts from the spec aren't ported
  yet — Vertical/Horizontal/Radial/Compact share one generic tree-layout
  algorithm, so adding another layout mode is mostly a new coordinate
  function, not a rewrite.
