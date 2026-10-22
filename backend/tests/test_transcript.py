"""Transcript parser tests — pinned to the real 2025R1 transcript format
(ground truth: ARC job 6388594 fluent.log and the job 6442862 failure)."""

from app.post.transcript import failure_summary, parse_transcript, residuals_to_csv

SOLVE_SAMPLE = """\
  iter  continuity  x-velocity  y-velocity  z-velocity           k       omega       mom_y  lift_force  drag_force     time/iter
     1  1.0000e+00  1.0312e-04  4.0856e-05  9.2775e-05  6.7327e-01  4.0975e-01 -1.4504e-01 -5.1701e+01 -2.6186e+01  0:00:58  299
     2  7.3849e-01  5.5470e-05  2.4301e-05  4.9335e-05  5.4010e-01  3.6666e-01 -2.0347e-01 -8.4866e+01 -3.7798e+01  0:01:02  298
  iter  continuity  x-velocity  y-velocity  z-velocity           k       omega       mom_y  lift_force  drag_force     time/iter
    12  5.8141e-01  2.1924e-05  2.1017e-05  2.5579e-05  1.4152e-02  9.5412e-03 -3.1769e-01 -1.5903e+02 -6.1883e+01  0:00:48  288
"""

FAILURE_SAMPLE = """\
IMPORT_DONE
CEFB_DONE
VOLUME_DONE
CLASSIFIER_DONE

Error: Invalid Zone name.
Error Object: symmetry-1

Warning: An error or interrupt occurred while reading the journal file.
Some commands may not have been completed.
"""


def test_residual_and_force_rows_parse():
    st = parse_transcript(SOLVE_SAMPLE)
    assert [r["iteration"] for r in st.residuals] == [1, 2, 12]
    assert st.residuals[1]["continuity"] == 0.73849
    assert st.residuals[2]["omega"] == 9.5412e-03
    # Report-definition columns ride in the same table.
    assert st.report_values[0]["drag_force"] == -26.186
    assert st.report_values[2]["lift_force"] == -159.03
    assert st.iteration == 12
    assert not st.journal_aborted


def test_repeated_headers_and_time_tokens_are_ignored():
    st = parse_transcript(SOLVE_SAMPLE)
    for row in st.residuals:
        assert "time/iter" not in row


def test_residuals_csv_schema():
    st = parse_transcript(SOLVE_SAMPLE)
    lines = residuals_to_csv(st.residuals).splitlines()
    assert lines[0] == "iteration,continuity,x_velocity,y_velocity,z_velocity,k,omega"
    assert lines[1].startswith("1,")
    assert len(lines) == 1 + len(st.residuals)


def test_stage_markers_track_last_stage():
    st = parse_transcript(FAILURE_SAMPLE)
    assert st.stage_marker == "CLASSIFIER_DONE"
    assert st.stage_label == "Boundaries classified"


def test_failure_summary_names_abort_errors_and_stage():
    st = parse_transcript(FAILURE_SAMPLE)
    assert st.journal_aborted
    summary = failure_summary(st, slurm_tail="JOURNAL_ABORT_DETECTED — killing Fluent")
    assert "journal aborted" in summary
    assert "Invalid Zone name" in summary
    assert "Boundaries classified" in summary


def test_walltime_failure_without_transcript():
    st = parse_transcript("")
    summary = failure_summary(st, slurm_tail="slurmstepd: error: JOB CANCELLED DUE TO TIME LIMIT")
    assert "walltime" in summary
