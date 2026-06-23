"""Tests for the tolerant Fluent report-file parser (pure, stdlib-only)."""

from __future__ import annotations

from app.post.report_files import parse_report_file


def test_whitespace_with_quoted_header():
    # Plausible real Fluent report-file layout: title line, quoted header,
    # whitespace-delimited data.
    text = (
        '"Convergence history of drag_force"\n'
        '"Iteration" "drag_force" "lift_force" "mom_y"\n'
        "1 81.20 -270.30 -15.10\n"
        "2 80.95 -271.10 -15.05\n"
    )
    rows = parse_report_file(text)
    assert len(rows) == 2
    assert rows[0]["iteration"] == 1
    assert rows[0]["drag_force"] == 81.20
    assert rows[1]["lift_force"] == -271.10


def test_tab_delimited():
    text = '"Iteration"\t"drag_force"\t"lift_force"\t"mom_y"\n1\t81.2\t-270.3\t-15.1\n'
    rows = parse_report_file(text)
    assert rows[0]["drag_force"] == 81.2


def test_comma_delimited_mock_format():
    text = "iteration,drag_force,lift_force,mom_y\n1,81.2,-270.3,-15.1\n"
    rows = parse_report_file(text)
    assert rows[0]["mom_y"] == -15.1


def test_extra_flow_time_column_is_kept_by_name():
    # Some report files include a flow-time/time column; name-keying ignores it.
    text = (
        '"Iteration" "flow-time" "drag_force" "lift_force" "mom_y"\n'
        "1 0.0 81.2 -270.3 -15.1\n"
    )
    rows = parse_report_file(text)
    assert rows[0]["drag_force"] == 81.2
    assert rows[0]["flow-time"] == 0.0


def test_skips_sexpr_and_comment_lines():
    text = (
        "(\n"
        "; a comment\n"
        '"Iteration" "drag_force"\n'
        "1 81.2\n"
        ")\n"
    )
    rows = parse_report_file(text)
    assert len(rows) == 1
    assert rows[0]["drag_force"] == 81.2


def test_no_header_uses_positional_names():
    text = "1 81.2 -270.3\n2 80.9 -271.0\n"
    rows = parse_report_file(text)
    assert rows[0]["iteration"] == 1
    assert rows[0]["col1"] == 81.2


def test_empty_text_returns_empty():
    assert parse_report_file("") == []
    assert parse_report_file("\n; only a comment\n") == []


def test_residual_style_columns():
    text = (
        '"iter" "continuity" "x-velocity" "y-velocity" "z-velocity" "k" "omega"\n'
        "1 1.0e-01 8.0e-02 7.0e-02 9.0e-02 1.2e-01 1.1e-01\n"
    )
    rows = parse_report_file(text)
    assert rows[0]["continuity"] == 0.1
    assert rows[0]["x-velocity"] == 0.08
