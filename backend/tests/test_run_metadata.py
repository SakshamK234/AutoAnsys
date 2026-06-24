"""Tests for the run-metadata reproducibility record (pure, stdlib-only)."""

from __future__ import annotations

import json

from app.run_metadata import SCHEMA_VERSION, build_run_metadata, to_json


def test_build_run_metadata_fields():
    meta = build_run_metadata(
        kind="job",
        entity_id="abc-123",
        cfd_mode="full_car",
        config={"cfd_mode": "full_car", "solver": {}},
        fluent_module="ANSYS/2025R1",
        git_sha="deadbeef",
        generated_at="2026-06-23T00:00:00+00:00",
    )
    assert meta["schema_version"] == SCHEMA_VERSION
    assert meta["kind"] == "job"
    assert meta["id"] == "abc-123"
    assert meta["cfd_mode"] == "full_car"
    assert meta["fluent_module"] == "ANSYS/2025R1"
    assert meta["git_sha"] == "deadbeef"
    assert meta["generated_at"] == "2026-06-23T00:00:00+00:00"
    assert meta["config"]["cfd_mode"] == "full_car"


def test_missing_git_sha_falls_back():
    meta = build_run_metadata(
        kind="mesh", entity_id="m1", cfd_mode="individual_part",
        config={}, fluent_module="ANSYS/2025R1", git_sha="",
    )
    assert meta["git_sha"] == "unknown"
    assert meta["generated_at"]  # auto-filled


def test_to_json_roundtrips_and_is_sorted():
    meta = build_run_metadata(
        kind="job", entity_id="x", cfd_mode="full_car",
        config={"b": 1, "a": 2}, fluent_module="m", git_sha="s",
        generated_at="t",
    )
    text = to_json(meta)
    parsed = json.loads(text)
    assert parsed == meta
    # sorted keys → "cfd_mode" appears before "config", etc.
    assert text.index('"cfd_mode"') < text.index('"config"')
