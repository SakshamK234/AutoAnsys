---
version: 1
slug: "frontend-src-app-tsx"
primary_target: "frontend/src/App.tsx"
related_targets: ["frontend/src"]
---

# Surface: AutoAnsys app shell + all screens (frontend/src)

Scope: the whole operating UI (login, dashboard, runs, run detail, new-run
wizard, meshes, geometries, sweep, compare, templates, groups). Mode: Operate.
Audience: FSAE aero engineers at laptops; job: submit CFD runs, watch them,
judge results, compare iterations. Constraints: React 19 + Vite + Tailwind v4;
real backend API (profiles, live WS events, error_message/progress fields);
guests read-only; desktop-first, usable at 390px.

## Direction contract

THESIS: A race team's livery system applied to simulation work: every run is a
numbered, striped entry in the team's season, identifiable at a glance across
lists, charts, and comparisons. It refuses the category default — a graphite
dashboard with one teal accent and shadowed cards.

OWN-WORLD: Technical white ground (#F7F7F4), near-black ink (#14161B), one
committed racing-blue field (#1D43D8) owning the nav rail and primary actions.
Signal red #D92D20 / amber #B54708 / green #097A49 for states only. Six-hue
livery series palette for run identity stripes. Saira (incl. Condensed) for
display numerals and section heads in caps; Archivo for UI text; JetBrains
Mono for all data numerics. Hairline #D9D9D2 seams, no drop shadows; charts
and contours live in bordered "plates" with figure captions.

STORY: The engineer lands on the season board (dashboard), reads cluster +
active-run state in seconds, opens a run and sees its stage progress like a
lap chart, gets a verdict (coefficients + convergence badge or a stamped
FAILED with the reason), and compares striped iterations side by side.

FIRST VIEWPORT (dashboard, 1440×900): 208px racing-blue rail left (logo mark,
icon+label nav — labels forced the width past the drafted 72px; user chip
bottom). Content: top strip = page title "Season board" + cluster status
capsule + "New run" primary button. Below it a single seamed TIMING-TOWER
strip (finish-review raise): five columns — Season / On track / In queue /
Finished / Failed — condensed caps labels over mono numerals, hairline
dividers, heavy top+bottom rules; replaces the drafted row of four stat
tiles. Below left 2/3: "On track now" — active runs as striped rows with
live stage chips and iteration progress. Right 1/3: "Latest verdicts" —
completed runs with Cd/Cl mono numbers and stripe + roundel number. Primary
action = New run, top right.

FORM: Motorsport livery graphic system — candidate 5 of my ordered grounded
list. seed:86d6dbe124eec0cf
Raises (named for their donors):
- Stamped verdicts (jet-age ticket wallet, declined): terminal states render
  as angled rubber-stamp marks on detail headers — CONVERGED / FAILED /
  CANCELLED; nothing disappears, it cancels.
- Plate discipline (lexicon page, declined): color for data lives inside
  bordered plates with "Fig." captions; chrome stays ink on ground.
- Seams + isolated destructive (dark-first console, competitive): hairline
  seams divide panels, no shadows; Cancel/Delete sit isolated with space.
- Density courage (Ikeda datamatics, declined): tables set in JetBrains Mono
  tabular numerics at real data density.
- Full-bleed focus (vertical feed, declined): the contour viewer is a
  full-viewport black lightbox with a white glyph rail.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
