"""Tests for per-outline extraction. Run: python tests/test_outlines.py (numpy + opencv only)."""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cv_neon.portrait_bundle import _signed_area, separate_outline_paths  # noqa: E402


def _ring_and_line() -> np.ndarray:
    edges = np.zeros((200, 200), np.uint8)
    cv2.circle(edges, (60, 60), 40, 255, 1)  # closed 1-px ring -> outer + hole contour
    cv2.line(edges, (120, 150), (190, 150), 255, 1)  # open stroke
    return edges


def test_closed_ring_is_drawn_once():
    outlines = separate_outline_paths(_ring_and_line(), min_peri=10, total_points=600)
    # ring + line, not ring twice (hole dropped) + line
    assert len(outlines) == 2, len(outlines)


def test_points_proportional_to_length():
    outlines = separate_outline_paths(_ring_and_line(), min_peri=10, total_points=600)
    ring, line = outlines  # sorted longest first
    # ring perimeter ~ 2*pi*40 ~ 250; line contour out-and-back ~ 140
    assert len(ring) > len(line)
    assert abs(sum(map(len, outlines)) - 600) <= 2


def test_short_outlines_dropped():
    outlines = separate_outline_paths(_ring_and_line(), min_peri=200, total_points=600)
    assert len(outlines) == 1


def test_consistent_winding():
    outlines = separate_outline_paths(_ring_and_line(), min_peri=10, total_points=600)
    ring = np.array([[p["x"], p["y"]] for p in outlines[0]])
    assert _signed_area(ring) < 0


def test_blank_image():
    assert separate_outline_paths(np.zeros((50, 50), np.uint8), min_peri=10) == []


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
