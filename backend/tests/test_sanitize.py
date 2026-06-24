"""Tests for input sanitization (pure, stdlib-only)."""

from __future__ import annotations

from app.utils.sanitize import (
    sanitize_for_journal,
    sanitize_for_shell,
    sanitize_path,
)


def test_sanitize_path_keeps_simple_basename():
    assert sanitize_path("wing.x_t") == "wing.x_t"
    assert sanitize_path("Front-Wing_v2.step") == "Front-Wing_v2.step"


def test_sanitize_path_strips_directories_and_traversal():
    # AUDIT E6: must not let ../ escape the workspace.
    assert sanitize_path("../../etc/passwd") == "passwd"
    assert sanitize_path("/abs/path/geom.stp") == "geom.stp"
    assert sanitize_path("sub\\dir\\car.x_b") == "car.x_b"


def test_sanitize_path_dot_only_is_empty():
    assert sanitize_path("..") == ""
    assert sanitize_path(".") == ""


def test_sanitize_path_drops_injection_chars():
    assert sanitize_path("ge;om`$().stp") == "geom.stp"


def test_sanitize_for_shell_and_journal_strip_metacharacters():
    assert ";" not in sanitize_for_shell("rm -rf /; echo")
    assert "`" not in sanitize_for_journal("a`b`c")
