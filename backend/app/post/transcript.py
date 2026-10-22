"""Fluent transcript (fluent.log) parsing: residual history, live progress
stage markers, and failure-reason extraction.

Ground truth (ARC job 6388594, 2025R1 solver transcript):

    iter  continuity  x-velocity  y-velocity  z-velocity           k       omega       mom_y  lift_force  drag_force     time/iter
       1  1.0000e+00  1.0312e-04  4.0856e-05  9.2775e-05  6.7327e-01  4.0975e-01 -1.4504e-01 -5.1701e+01 -2.6186e+01  0:00:58  299

- The header repeats every few rows; its column list includes any report
  definitions (``mom_y``/``lift_force``/``drag_force``), so one pass yields the
  residual history AND the per-iteration force history.
- Fluent writes NO residuals file in batch (probe 6380354) — the transcript is
  the only residual source.

Stage markers are the ``(display "..._DONE")`` sentinels the journals print;
they drive the live progress UI (GUI_PLAN G1.5).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

_HEADER_RE = re.compile(r"^\s*iter\s+continuity\s+")
_TIME_TOKEN_RE = re.compile(r"^\d+:\d{2}:\d{2}$")

# The six residual columns the API's ResidualData schema expects, mapped from
# the transcript's spelling. (k-epsilon runs print "epsilon" — mapped to omega's
# slot so the UI still charts six curves rather than dropping the run.)
_RESIDUAL_COLS = {
    "continuity": "continuity",
    "x-velocity": "x_velocity",
    "y-velocity": "y_velocity",
    "z-velocity": "z_velocity",
    "k": "k",
    "omega": "omega",
    "epsilon": "omega",
    "nut": "k",
}

# Ordered journal stage markers → human-readable stage labels. The last marker
# seen in the transcript is the pipeline's current stage. Covers watertight,
# fault-tolerant, combined and solver-from-case journals.
STAGE_MARKERS: list[tuple[str, str]] = [
    ("IMPORT_DONE", "Geometry imported"),
    ("DGF_DONE", "Flow described"),
    ("DELETE_BODIES_DONE", "Junk bodies removed"),
    ("SHELL_SPLIT_DONE", "CAD shell split"),
    ("CEFB_DONE", "Flow boundaries created"),
    ("IDREG_DONE", "Fluid region identified"),
    ("URS_DONE", "Region settings updated"),
    ("SCOPED_SIZING_DONE", "Sizing controls added"),
    ("CMCO_DONE", "Mesh controls chosen"),
    ("SIZING_DONE", "Sizing controls added"),
    ("SURF_DONE", "Surface mesh / wrap complete"),
    ("REGIONS_DONE", "Regions computed"),
    ("PRISMS_DONE", "Boundary layers grown"),
    ("VOLUME_DONE", "Volume mesh complete"),
    ("CLASSIFY_BEGIN", "Classifying boundaries"),
    ("CLASSIFIER_DONE", "Boundaries classified"),
    ("CARVE_DONE", "Domain carved"),
    ("ASSIGN_LOADED", "Zones merged & named"),
    ("ZONE_TYPES_PINNED", "Zone types pinned"),
    ("MESH_WRITTEN", "Mesh written"),
    ("CASE_LOADED", "Case loaded"),
    ("SOLVE_BEGIN", "Solving"),
    ("COMBINED_SOLVE_COMPLETE", "Solve complete"),
    ("SOLVE_COMPLETE", "Solve complete"),
    ("CONTOURS_DONE", "Contours rendered"),
]
_MARKER_ORDER = {m: i for i, (m, _) in enumerate(STAGE_MARKERS)}


@dataclass
class TranscriptState:
    """Everything the poller / post-processing needs from one transcript read."""

    stage_marker: str | None = None
    stage_label: str | None = None
    iteration: int | None = None
    # Residual history rows: {"iteration": int, "<residual>": float, ...}
    residuals: list[dict] = field(default_factory=list)
    # Per-iteration report-definition values: {"iteration": int, "<name>": float}
    report_values: list[dict] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    journal_aborted: bool = False


def parse_transcript(text: str) -> TranscriptState:
    """Parse (a tail of) a Fluent transcript.

    Safe on partial files: a header row is required before data rows are
    interpreted, and rows that fail to parse are skipped.
    """
    state = TranscriptState()
    columns: list[str] | None = None

    lines = text.splitlines()
    for i, line in enumerate(lines):
        stripped = line.strip()

        # Stage markers ((display "...") output — the marker is the whole line).
        if stripped in _MARKER_ORDER:
            if state.stage_marker is None or _MARKER_ORDER[stripped] >= _MARKER_ORDER[state.stage_marker]:
                state.stage_marker = stripped
                state.stage_label = dict(STAGE_MARKERS)[stripped]
            continue

        if _HEADER_RE.match(line):
            columns = line.split()
            continue

        if "Error" in line:
            # Transcript error reports: "Error: <msg>" / "Error at Node 0: ...",
            # with the object on the following "Error Object:" line.
            if stripped.startswith("Error") and stripped not in state.errors:
                state.errors.append(stripped)
                nxt = lines[i + 1].strip() if i + 1 < len(lines) else ""
                if nxt.startswith("Error Object:") and nxt not in state.errors:
                    state.errors.append(nxt)
            continue

        if "An error or interrupt occurred while reading the journal" in line:
            state.journal_aborted = True
            continue

        if columns is None or not stripped:
            continue

        tokens = stripped.split()
        if not tokens[0].isdigit():
            continue
        # Data row: iter, one float per column, then "H:MM:SS remaining".
        # Trailing time/iter tokens are dropped by position, not format.
        values = tokens[1:]
        # Strip the trailing time token + remaining-iterations counter if present.
        while values and (_TIME_TOKEN_RE.match(values[-1]) or values[-1].isdigit()):
            values.pop()
        names = columns[1 : 1 + len(values)]
        if len(values) < 2:
            continue
        try:
            iteration = int(tokens[0])
            parsed = {n: float(v) for n, v in zip(names, values)}
        except ValueError:
            continue

        state.iteration = iteration
        res_row: dict = {"iteration": iteration}
        rep_row: dict = {"iteration": iteration}
        for name, value in parsed.items():
            if name in _RESIDUAL_COLS:
                res_row[_RESIDUAL_COLS[name]] = value
            elif name != "time/iter":
                rep_row[name] = value
        if len(res_row) > 1:
            state.residuals.append(res_row)
        if len(rep_row) > 1:
            state.report_values.append(rep_row)

    return state


def residuals_to_csv(residuals: list[dict]) -> str:
    """Serialize parsed residual rows into the CSV schema the API serves.

    Column order matches ``ResidualData``; missing residuals default to 0.0
    (e.g. omega on a laminar run).
    """
    cols = ["iteration", "continuity", "x_velocity", "y_velocity", "z_velocity", "k", "omega"]
    out = [",".join(cols)]
    for row in residuals:
        out.append(",".join(
            str(int(row["iteration"])) if c == "iteration" else f"{row.get(c, 0.0):.8e}"
            for c in cols
        ))
    return "\n".join(out) + "\n"


def failure_summary(state: TranscriptState, slurm_tail: str = "") -> str:
    """Build a one-paragraph human-readable failure reason (GUI_PLAN G1.6)."""
    parts: list[str] = []
    if state.journal_aborted or "JOURNAL_ABORT_DETECTED" in slurm_tail:
        parts.append(
            "The Fluent journal aborted mid-run (a command failed and Fluent "
            "stopped processing the script)."
        )
    if state.errors:
        shown = state.errors[-6:]
        parts.append("Last Fluent errors: " + " | ".join(shown))
    if not parts:
        # Order matters: SLURM phrases a walltime kill as "CANCELLED DUE TO
        # TIME LIMIT", so the time-limit check must win over plain cancel.
        if "DUE TO TIME LIMIT" in slurm_tail or "TIMEOUT" in slurm_tail:
            parts.append("The SLURM job hit its walltime limit before finishing.")
        elif "CANCELLED" in slurm_tail:
            parts.append("The SLURM job was cancelled.")
        else:
            parts.append(
                "The run ended without completing. Check the SLURM and Fluent "
                "logs in the Files tab for details."
            )
    if state.stage_label:
        parts.append(f"Last completed stage: {state.stage_label}.")
    if state.iteration:
        parts.append(f"Last solver iteration: {state.iteration}.")
    return " ".join(parts)
