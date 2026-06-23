"""Tolerant parser for ANSYS Fluent report-file output.

AUDIT S7: the previous parsers used ``csv.DictReader`` and assumed a clean,
comma-delimited file with exactly the columns the **mock** generator writes
(``iteration,cd,cl,cm``). Real Fluent ``/solve/report-files`` output is
**whitespace/tab-delimited** with a multi-line, quoted header and sometimes an
extra flow-time column, so ``DictReader`` finds none of those keys and the
endpoint returns ``[]``. This module parses the real format (and still accepts
the comma-delimited mock), normalising columns by name so callers are immune to
column order / extra columns.

[needs-cluster] The exact 2025R1 report-file header has not been confirmed
against a real run (no run exists yet — decision #4). This parser is deliberately
permissive; ``tests/test_report_files.py`` pins it against several plausible real
layouts. Confirm against a real ARC ``forces.csv`` and tighten if needed.

Pure / stdlib-only so the numeric core is unit-tested without Fluent.
"""

from __future__ import annotations

_COMMENT_PREFIXES = ("(", ")", ";", "#", "//")


def _strip_token(tok: str) -> str:
    """Strip surrounding quotes/whitespace from a single token."""
    return tok.strip().strip('"').strip("'").strip()


def _split(line: str) -> list[str]:
    """Split a line on comma if present, else on any run of whitespace."""
    raw = line.split(",") if "," in line else line.split()
    return [_strip_token(t) for t in raw if _strip_token(t) != ""]


def _is_number(tok: str) -> bool:
    try:
        float(tok)
        return True
    except (TypeError, ValueError):
        return False


def _looks_like_data(tokens: list[str]) -> bool:
    """A data row is all-numeric (iteration + values)."""
    return len(tokens) >= 2 and all(_is_number(t) for t in tokens)


def _normalize(name: str) -> str:
    """Normalise a column name: lowercase, quotes stripped, spaces -> underscore."""
    return _strip_token(name).lower().replace(" ", "_")


def parse_report_file(text: str) -> list[dict]:
    """Parse Fluent report-file text into a list of row dicts.

    Keys are normalised column names (lowercase, quotes stripped). Returns ``[]``
    if no tabular data is found. The header is the last non-data, multi-token line
    seen before the first data row; if there is none, positional names
    ``col0..colN`` are used (first column aliased to ``iteration``).
    """
    header: list[str] | None = None
    pending_header: list[str] | None = None
    rows: list[dict] = []

    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith(_COMMENT_PREFIXES):
            continue

        tokens = _split(line)
        if not tokens:
            continue

        if _looks_like_data(tokens):
            if header is None:
                if pending_header and len(pending_header) >= len(tokens):
                    header = [_normalize(h) for h in pending_header]
                else:
                    header = ["iteration"] + [f"col{i}" for i in range(1, len(tokens))]
            row: dict = {}
            for i, value in enumerate(tokens):
                key = header[i] if i < len(header) else f"col{i}"
                row[key] = float(value)
            rows.append(row)
        else:
            # Non-numeric line — a candidate header (e.g. "Iteration" "drag_force").
            pending_header = tokens

    return rows
