"""Parse CalculiX output files (.dat) for FEA result summaries."""

from __future__ import annotations

import logging
import math
import re

logger = logging.getLogger(__name__)


def parse_dat_results(dat_content: str, yield_strength_pa: float | None = None) -> dict:
    """Parse a CalculiX .dat text file and extract summary metrics.

    Returns a dict matching the FEAJobSummary schema fields.
    """
    max_disp = _parse_max_displacement(dat_content)
    stresses = _parse_stresses(dat_content)
    max_reaction = _parse_max_reaction_force(dat_content)

    max_vm = stresses.get("max_von_mises", 0.0)
    max_principal = stresses.get("max_principal", 0.0)
    min_principal = stresses.get("min_principal", 0.0)

    max_vm_mpa = max_vm / 1e6
    max_principal_mpa = max_principal / 1e6
    min_principal_mpa = min_principal / 1e6
    yield_mpa = yield_strength_pa / 1e6 if yield_strength_pa else None

    safety_factor = None
    yielded = None
    if yield_mpa and max_vm_mpa > 0:
        safety_factor = round(yield_mpa / max_vm_mpa, 2)
        yielded = max_vm_mpa > yield_mpa

    return {
        "max_displacement_mm": round(max_disp * 1000, 4),
        "max_von_mises_stress_mpa": round(max_vm_mpa, 2),
        "max_principal_stress_mpa": round(max_principal_mpa, 2),
        "min_principal_stress_mpa": round(min_principal_mpa, 2),
        "max_reaction_force_n": round(max_reaction, 2),
        "yielded": yielded,
        "yield_strength_mpa": round(yield_mpa, 2) if yield_mpa else None,
        "safety_factor": safety_factor,
    }


def _parse_max_displacement(content: str) -> float:
    """Extract maximum displacement magnitude from the displacement block."""
    max_mag = 0.0
    in_disp_block = False

    for line in content.splitlines():
        stripped = line.strip()
        if "displacements" in stripped.lower() and "for set" in stripped.lower():
            in_disp_block = True
            continue
        if in_disp_block:
            if stripped == "" or stripped.startswith("*") or "statistics" in stripped.lower():
                in_disp_block = False
                continue
            parts = stripped.split()
            if len(parts) >= 4:
                try:
                    ux, uy, uz = float(parts[1]), float(parts[2]), float(parts[3])
                    mag = math.sqrt(ux * ux + uy * uy + uz * uz)
                    max_mag = max(max_mag, mag)
                except (ValueError, IndexError):
                    pass

    return max_mag


def _parse_stresses(content: str) -> dict:
    """Extract stress components from the stress block.

    CalculiX .dat stress output has columns:
    element, intpt, sxx, syy, szz, sxy, sxz, syz
    """
    max_vm = 0.0
    max_p1 = -1e30
    min_p3 = 1e30
    in_stress_block = False

    for line in content.splitlines():
        stripped = line.strip()
        if "stresses" in stripped.lower() and "for set" in stripped.lower():
            in_stress_block = True
            continue
        if in_stress_block:
            if stripped == "" or stripped.startswith("*") or "statistics" in stripped.lower():
                in_stress_block = False
                continue
            parts = stripped.split()
            if len(parts) >= 8:
                try:
                    sxx = float(parts[2])
                    syy = float(parts[3])
                    szz = float(parts[4])
                    sxy = float(parts[5])
                    sxz = float(parts[6])
                    syz = float(parts[7])

                    vm = _von_mises(sxx, syy, szz, sxy, sxz, syz)
                    p1, p3 = _principal_stresses(sxx, syy, szz, sxy, sxz, syz)

                    max_vm = max(max_vm, vm)
                    max_p1 = max(max_p1, p1)
                    min_p3 = min(min_p3, p3)
                except (ValueError, IndexError):
                    pass

    if min_p3 > 1e29:
        min_p3 = 0.0
    if max_p1 < -1e29:
        max_p1 = 0.0

    return {
        "max_von_mises": max_vm,
        "max_principal": max_p1,
        "min_principal": min_p3,
    }


def _parse_max_reaction_force(content: str) -> float:
    """Extract max reaction force magnitude from reaction forces block."""
    max_rf = 0.0
    in_rf_block = False

    for line in content.splitlines():
        stripped = line.strip()
        if "forces" in stripped.lower() and ("reaction" in stripped.lower() or "for set" in stripped.lower()):
            in_rf_block = True
            continue
        if in_rf_block:
            if stripped == "" or stripped.startswith("*") or "statistics" in stripped.lower():
                in_rf_block = False
                continue
            parts = stripped.split()
            if len(parts) >= 4:
                try:
                    fx, fy, fz = float(parts[1]), float(parts[2]), float(parts[3])
                    mag = math.sqrt(fx * fx + fy * fy + fz * fz)
                    max_rf = max(max_rf, mag)
                except (ValueError, IndexError):
                    pass

    return max_rf


def _von_mises(sxx: float, syy: float, szz: float, sxy: float, sxz: float, syz: float) -> float:
    return math.sqrt(
        0.5 * (
            (sxx - syy) ** 2
            + (syy - szz) ** 2
            + (szz - sxx) ** 2
            + 6.0 * (sxy ** 2 + sxz ** 2 + syz ** 2)
        )
    )


def _principal_stresses(
    sxx: float, syy: float, szz: float, sxy: float, sxz: float, syz: float
) -> tuple[float, float]:
    """Compute max and min principal stresses via the characteristic equation."""
    I1 = sxx + syy + szz
    I2 = (sxx * syy + syy * szz + szz * sxx) - (sxy ** 2 + sxz ** 2 + syz ** 2)
    I3 = (
        sxx * syy * szz
        + 2 * sxy * sxz * syz
        - sxx * syz ** 2
        - syy * sxz ** 2
        - szz * sxy ** 2
    )

    p = I1 / 3.0
    q = (I1 ** 2 - 3.0 * I2)
    if q < 0:
        q = 0.0
    q = q / 9.0
    r = (2.0 * I1 ** 3 - 9.0 * I1 * I2 + 27.0 * I3) / 54.0

    sq = math.sqrt(q) if q > 0 else 0.0
    if sq > 0:
        cos_arg = r / (q * sq)
        cos_arg = max(-1.0, min(1.0, cos_arg))
        theta = math.acos(cos_arg) / 3.0
        sq2 = 2.0 * math.sqrt(q)
        s1 = p + sq2 * math.cos(theta)
        s2 = p + sq2 * math.cos(theta - 2.0 * math.pi / 3.0)
        s3 = p + sq2 * math.cos(theta + 2.0 * math.pi / 3.0)
        return max(s1, s2, s3), min(s1, s2, s3)

    return p, p
