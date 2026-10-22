---
name: AutoAnsys
description: A race team's livery system applied to CFD simulation work — technical white ground, near-black ink, one committed racing-blue field.
colors:
  ground: "#f7f7f4"
  paper: "#fffffe"
  ink: "#14161b"
  ink-2: "#4a4e58"
  ink-3: "#6b6f78"
  seam: "#dcdcd4"
  seam-strong: "#b9b9b0"
  race: "#1d43d8"
  race-deep: "#1634ab"
  race-ink: "#0e2060"
  race-tint: "#e8edfc"
  race-text: "#b9c6f4"
  ok: "#097a49"
  ok-tint: "#e3f3ea"
  warn: "#b54708"
  warn-tint: "#fdf0e3"
  crit: "#d92d20"
  crit-tint: "#fdeae8"
  livery-1: "#1d43d8"
  livery-2: "#d92d20"
  livery-3: "#0a8f6a"
  livery-4: "#e8a013"
  livery-5: "#7a2fd0"
  livery-6: "#0e8fb8"
  lightbox-black: "#0b0c0f"
typography:
  display:
    fontFamily: "Saira, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    letterSpacing: "0.1em"
  title:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.1em"
  body:
    fontFamily: "Archivo, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.14em"
  data:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "13px"
    fontWeight: 600
    fontVariation: "tabular-nums"
rounded:
  none: "0px"
  control: "3px"
  stamp: "4px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.race}"
    textColor: "#ffffff"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.race-deep}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 16px"
  button-danger:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.crit}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 16px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 12px"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
  status-chip:
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "2px 8px"
  nav-item-active:
    backgroundColor: "#ffffff"
    textColor: "{colors.race-deep}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
---

# Design System: AutoAnsys

## Overview

**Creative North Star: "The Team Livery"**

AutoAnsys dresses CFD work in a race team's graphic system. The ground is
technical white (#F7F7F4), the ink is near-black (#14161B), and exactly one
committed color field exists in the chrome: the racing-blue nav rail. Every
run is a numbered, striped entry in the team's season — a deterministic
three-band livery stripe and a two-digit roundel car number derived from its
id — so one design iteration is recognizable at a glance across lists, charts,
and comparisons. The world explicitly refuses the category default: no
graphite dashboard, no single teal accent, no shadowed cards.

Density is real-data density: tables and stat strips set in JetBrains Mono
tabular numerals, condensed-caps labels, hairline seams instead of elevation.
Color is disciplined — state hues (green/amber/red) carry meaning only, the
six-hue livery palette carries identity only, and chrome stays ink on ground.
Terminal states are declared, not hidden: a run that fails gets an angled
rubber stamp, not a quiet gray badge.

**Key Characteristics:**
- One committed color field (the racing-blue rail); the rest of the chrome is ink on white
- Deterministic run identity: livery stripe + roundel number, consistent across every surface
- Hairline seams, zero drop shadows; depth by border weight and tone
- JetBrains Mono tabular numerals for every data number
- Data graphics live inside bordered "Fig." plates with captions
- Stamped terminal verdicts (Finished / Failed / Cancelled) at -6°
- One authored entrance animation (`settle`), route-level only

## Colors

A technical-white and ink neutral set, one racing blue, three state hues, and
a six-hue livery series reserved for identity.

### Primary
- **Racing Blue** (#1d43d8, `race`): the single committed field — owns the nav
  rail background, primary buttons, selection highlight, caret, focus ring,
  and active tab underline. **Race Deep** (#1634ab) is its hover/pressed and
  on-tint text shade; **Race Ink** (#0e2060) its darkest step; **Race Tint**
  (#e8edfc) the "on track" chip background; **Race Text** (#b9c6f4) the muted
  label color on the blue rail.

### Secondary
- **Livery Series 1–6** (#1d43d8, #d92d20, #0a8f6a, #e8a013, #7a2fd0,
  #0e8fb8): run-identity hues only. They paint stripe bands, chart series,
  and compare chips, hashed deterministically from the entity id
  (`lib/livery.ts`). Never used for chrome, buttons, or state.

### Tertiary
- **OK Green** (#097a49) on **OK Tint** (#e3f3ea): finished/converged.
- **Warn Amber** (#b54708) on **Warn Tint** (#fdf0e3): queued/attention.
- **Crit Red** (#d92d20) on **Crit Tint** (#fdeae8): failed/destructive.
  State colors appear only where they mean something — chips, stamps, toasts,
  danger buttons, toned numerals — never as decoration.

### Neutral
- **Ground** (#f7f7f4): the app background, slightly warm technical white.
- **Paper** (#fffffe): panel, plate, input, and card surfaces.
- **Ink** (#14161b): primary text and heavy structural rules.
- **Ink 2** (#4a4e58): secondary text, section-head labels.
- **Ink 3** (#6b6f78): tertiary text, hints, placeholders (holds ≥4.5:1 on
  paper/ground at body sizes).
- **Seam** (#dcdcd4): the standard 1px hairline between and around panels.
- **Seam Strong** (#b9b9b0): control borders, dashed empty-state borders,
  scrollbar thumbs.
- **Lightbox Black** (#0b0c0f): the full-bleed contour viewer field.

### Named Rules
**The One Field Rule.** Racing blue is the only large color field in the
chrome, and it belongs to the nav rail. Everywhere else, blue appears only
as small committed accents (primary button, focus, active tab).
**The Plate Rule.** Color for data (charts, contours, series hues) lives
inside bordered plates with "Fig." captions. Chrome stays ink on ground.
**The Identity-Is-Not-State Rule.** Livery hues identify runs; state hues
judge them. The two palettes share #1d43d8 and #d92d20 by value but never
swap roles.

## Typography

**Display Font:** Saira (variable 100–900, self-hosted; sans-serif fallback)
**Condensed Label Font:** Saira Condensed (600/700, self-hosted)
**Body Font:** Archivo (variable 100–900 + italic 400, self-hosted)
**Data Font:** JetBrains Mono (variable 100–800, self-hosted)

**Character:** A motorsport signage pairing — Saira's engineered display
voice for page titles and the wordmark, its Condensed cut doing all the
uppercase labeling work, Archivo as the quiet UI workhorse, and JetBrains
Mono giving every number timing-screen authority. All fonts are self-hosted
woff2 (`frontend/public/fonts/`); no CDN.

### Hierarchy
- **Display** (Saira 700, 26px, tracking-tight): page titles via PageHeader.
  The rail wordmark uses the same face at 17px.
- **Title / Section** (Saira Condensed 700, 13px, 0.08–0.1em, UPPERCASE):
  buttons, tabs, dialog titles, `.section-head` (which trails a hairline
  seam to the edge).
- **Body** (Archivo 400, 14px base set on `body`): all running UI text;
  `text-sm`/`text-xs` steps for detail and hints.
- **Label** (Saira Condensed 700, 10–11px, 0.12–0.16em, UPPERCASE): field
  labels, plate captions, stat labels, timing-tower column heads.
- **Data** (JetBrains Mono 600, 13–26px, `tabular-nums` via `.tnum`):
  every numeral that columns up — coefficients, counts, iteration numbers,
  stat-tile values (26px), timing-tower values (20px).

### Named Rules
**The Mono Numerals Rule.** Any number a user might compare or scan down a
column is set in JetBrains Mono with tabular figures. Archivo never carries
data numerals.
**The Condensed Caps Rule.** Labels, buttons, and section heads are Saira
Condensed 700 uppercase with wide tracking (0.08–0.16em). Archivo stays
sentence-case.

## Layout

Desktop-first with a 208px (w-52) fixed racing-blue rail on the left and a
scrolling main column capped at 1200px (`max-w-[1200px]`, 16px/32px side
padding, 24px top). Below `lg` the rail becomes a 48px blue top bar with a
240px drawer; content gets `pt-12`. Usable down to 390px.

Rhythm is tight and seamed: 36px (h-9) control height everywhere, 16px panel
padding, 8px gaps between run rows, 32px (mt-8) between page sections,
24px (mb-6) under page headers. The dashboard's signature layout is a single
full-width timing-tower strip (heavy 2px ink rules top and bottom, hairline
column dividers) followed by a 2/3–1/3 split (`xl:grid-cols-[1fr_380px]`):
active runs left, latest verdicts right. Tables run at real data density;
whitespace is spent isolating destructive actions, not padding cards.

## Elevation & Depth

**No drop shadows, anywhere.** Depth is conveyed by hairline seams
(1px #dcdcd4 borders), stronger borders for interactive controls (#b9b9b0),
heavy 2px ink rules for emphasis moments (the timing tower), and surface
tone (paper panels on the ground background). Overlays (dialogs, mobile
drawer) separate with a 40% ink scrim (`bg-ink/40`); the contour lightbox
goes full-bleed #0b0c0f. Motion is the only other depth cue: the single
`settle` entrance (240ms, 4px rise, `cubic-bezier(0.16,1,0.3,1)`), applied
at route/dialog level only and disabled under `prefers-reduced-motion`.

### Named Rules
**The Seam Rule.** Panels never float. If two regions need separating, draw
a 1px seam; if a moment needs weight, thicken the rule to 2px ink — never
add a shadow.
**The One Entrance Rule.** `.settle` fires once per route or dialog mount,
never scattered per-card.

## Shapes

Rectilinear and near-square: panels, plates, dialogs, toasts, and the timing
tower have 0 radius; interactive controls (buttons, inputs, selects, chips,
nav items) carry a barely-there 3px radius; the stamp 4px. The only circles
are the roundel car number (2px ink border on paper) and the 6px live-pulse
dot. Signature silhouettes: the three-band vertical livery stripe (14px wide,
3:2:1 band ratio), the -6° rotated stamp with a fractal-noise mask for rubber
texture, the 8px checkered strip (`repeating-conic-gradient`) for finish
moments, and the stacked wing-element wordmark. Empty states use dashed
#b9b9b0 borders.

## Components

### Buttons
- **Shape:** near-square (3px radius), 36px tall, 16px horizontal padding;
  Saira Condensed 700 13px uppercase, 0.08em tracking.
- **Primary:** racing blue (#1d43d8) with white text; hover deepens to
  #1634ab. One per view region — the committed action.
- **Secondary (default):** paper surface, #b9b9b0 border, ink text; hover
  darkens border to ink-3 and fills with ground.
- **Ghost:** borderless ink-2 text; hover `ink/5` wash.
- **Danger:** paper with 40%-crit border and crit text; hover fills crit-tint.
  Destructive actions sit isolated with space and use the two-step
  ConfirmButton ("Sure?" arms for 3s) — never a native confirm.
- **Busy:** spinning 14px loader inline; disabled at 45% opacity.

### Chips (status)
- **Style:** 3px radius, 1px border at 30–40% of the state hue, state tint
  background, state-colored Saira Condensed 11px uppercase label.
- **States:** Draft (ground/ink-2), In queue (warn), On track (race-tint +
  pulsing 6px `live-dot`), Finished (ok), Failed (crit), Cancelled
  (ground/ink-3).

### Cards / Containers
- **Panel:** square-cornered paper with a 1px #dcdcd4 seam; no shadow; 16px
  internal padding typical.
- **Plate (signature):** a `<figure>` panel whose caption bar ("FIG. N —
  LABEL", Saira Condensed 11px, 0.14em) sits above a 1px seam; all charts
  and contour thumbnails live inside one.
- **Stat tile:** seamed paper, 11px condensed label over a 26px mono
  numeral, optionally toned ok/crit/race-deep.

### Inputs / Fields
- **Style:** 36px, 3px radius, paper surface, #b9b9b0 border; number inputs
  switch to mono 13px tabular.
- **Focus:** border turns racing blue (#1d43d8), outline suppressed on the
  control itself; global `:focus-visible` elsewhere is a 2px race outline
  offset 2px.
- **Label:** Saira Condensed 700 11px uppercase ink-2 above; hints in 12px
  ink-3 below. Selects use an inline ink-2 chevron SVG, no native arrow.

### Navigation
- **Rail:** 208px racing-blue field; stacked wing-element logo + Saira
  wordmark; items are icon (16px Lucide, 2.25 stroke) + Saira Condensed
  13px uppercase label. Active = white pill with race-deep text; inactive =
  race-text (#b9c6f4), hover white on `white/10`. User chip pinned bottom
  above a `white/15` hairline. Mobile: 48px blue top bar + left drawer over
  an ink scrim.
- **Tabs:** condensed-caps, 2px bottom border; active = race border + ink
  text.

### Livery identity (signature)
- **Stripe:** 14px three-band vertical mark (bands 3:2:1), hues hashed from
  the entity id out of the six-hue series; stretches to row height.
- **Roundel:** circular car number (01–99, same hash), 2px ink border on
  paper, condensed bold tabular digits.
- The same hash keys chart series and compare chips, so a run looks like
  itself everywhere.

### Stamp (signature)
- Angled (-6°) 2.5px bordered caps mark, 15px condensed, 0.22em tracking,
  fractal-noise mask for rubber texture; colored by verdict (Finished = ok,
  Failed = crit, Cancelled = ink-3). Terminal states only — nothing
  disappears, it cancels.

### Timing tower (signature)
- One full-width strip bounded by 2px ink rules top and bottom: equal
  columns, each an 11px condensed label (0.16em) over a 20px mono numeral,
  divided by hairline seams; counts tone race-deep/ok/crit where meaningful.
  Stacks vertically below `sm`.

### Contour lightbox (signature)
- Full-viewport #0b0c0f field, image centered and contained; a 56px white
  glyph rail on the right (close, download, prev/next, mono "n/m" counter);
  condensed-caps caption bottom-left; Escape/arrow keys wired.

### Toasts
- Seamed tint bars (ok-tint or crit-tint with matching 40% border), bottom
  center, max 4, auto-dismiss 3.5s/7s.

## Do's and Don'ts

### Do:
- **Do** give every run-shaped entity its Stripe + Roundel from
  `lib/livery.ts`; identity must survive across lists, charts, and compare.
- **Do** set every comparable numeral in JetBrains Mono with `.tnum`.
- **Do** put any chart, contour, or color-bearing data graphic inside a
  Plate with a "Fig." caption.
- **Do** stamp terminal states on detail headers (Finished / Failed /
  Cancelled) and keep the failure's `error_message` readable beside it.
- **Do** isolate Cancel/Delete with surrounding space and the two-step
  ConfirmButton.
- **Do** keep labels in Saira Condensed 700 uppercase with 0.08–0.16em
  tracking, and section heads trailing their hairline to the edge.

### Don't:
- **Don't** add drop shadows; separation is seams (1px #dcdcd4) or heavy
  ink rules (2px), never elevation.
- **Don't** introduce a second large color field; racing blue's field is
  the rail, full stop.
- **Don't** use livery hues for state or state hues for decoration; green,
  amber, and red appear only where they judge something.
- **Don't** round beyond 3px on controls (4px on the stamp); panels and
  plates stay square.
- **Don't** scatter entrance animations per card; `.settle` is route/dialog
  level only, and all motion collapses under `prefers-reduced-motion`.
- **Don't** fall back to the category default — graphite dashboard, teal
  accent, shadowed cards — anywhere in this product.
