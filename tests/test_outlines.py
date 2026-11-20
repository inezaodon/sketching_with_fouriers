"""Tests for edge -> stroke curves. Run: python tests/test_outlines.py (numpy + opencv only)."""

from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from cv_neon.portrait_bundle import separate_outline_paths  # noqa: E402
from cv_neon.strokes import _signed_area, edges_to_curves  # noqa: E402


def _ring_and_line() -> np.ndarray:
    edges = np.zeros((200, 200), np.uint8)
    cv2.circle(edges, (60, 60), 40, 255, 1)  # closed ring
    cv2.line(edges, (120, 150), (190, 150), 255, 1)  # open stroke
    return edges


def _is_out_and_back(c: np.ndarray) -> bool:
    """Exact retrace: z_j == z_(N-j), starting from an endpoint."""
    return np.allclose(c[1:], c[1:][::-1], atol=1e-9)


def test_ring_is_one_loop_and_line_is_one_stroke():
    curves = edges_to_curves(_ring_and_line(), min_length=5, total_points=600)
    assert len(curves) == 2, len(curves)
    ring, line = curves  # longest traced length first
    assert not _is_out_and_back(ring)
    assert _is_out_and_back(line)


def test_open_stroke_is_exact_out_and_back():
    # The property the Fourier side relies on: c_k = c_-k, so symmetric truncation
    # keeps the stroke a single line instead of opening it into a loop.
    _, line = edges_to_curves(_ring_and_line(), min_length=5, total_points=600)
    z = line[:, 0] + 1j * line[:, 1]
    c = np.fft.fft(z)
    k = np.arange(1, len(z) // 2)
    assert np.allclose(c[k], c[-k], atol=1e-6 * np.abs(c).max())


def test_points_proportional_to_traced_length():
    curves = edges_to_curves(_ring_and_line(), min_length=5, total_points=600)
    ring, line = curves
    # ring ~ 2*pi*40 ~ 250 px once round; line 70 px out and back ~ 140 px
    assert len(ring) > len(line)
    assert abs(sum(map(len, curves)) - 600) <= 4


def test_closed_loops_wind_consistently():
    ring, _ = edges_to_curves(_ring_and_line(), min_length=5, total_points=600)
    assert _signed_area(ring) < 0


def test_specks_and_short_strokes_dropped():
    edges = _ring_and_line()
    edges[10, 10] = edges[10, 11] = 255  # 2-px speck
    assert len(edges_to_curves(edges, min_length=5)) == 2
    assert len(edges_to_curves(edges, min_length=100)) == 1  # only the ring survives


def test_stroke_continues_straight_through_a_junction():
    # A long horizontal line crossed by a short vertical tick: the horizontal should
    # come out as one stroke, not be split at the crossing.
    edges = np.zeros((100, 200), np.uint8)
    cv2.line(edges, (10, 50), (190, 50), 255, 1)
    cv2.line(edges, (100, 35), (100, 65), 255, 1)
    curves = edges_to_curves(edges, min_length=5, total_points=800, sigma=0)
    longest = curves[0]
    span = longest[:, 0].max() - longest[:, 0].min()
    assert span > 170, span


def test_staircase_is_smoothed():
    edges = np.zeros((120, 120), np.uint8)
    cv2.line(edges, (10, 10), (110, 40), 255, 1)  # shallow diagonal -> pixel stairs
    raw = edges_to_curves(edges, min_length=5, total_points=400, sigma=0)[0]
    smooth = edges_to_curves(edges, min_length=5, total_points=400, sigma=1.0)[0]

    def wiggle(c):  # distance from the straight line through the endpoints
        a, b = c[0], c[len(c) // 2]
        d = (b - a) / np.linalg.norm(b - a)
        r = c - a
        return np.abs(r[:, 0] * d[1] - r[:, 1] * d[0]).mean()

    assert wiggle(smooth) < wiggle(raw)


def test_bundle_format_and_blank_image():
    out = separate_outline_paths(_ring_and_line(), min_peri=10)
    assert len(out) == 2 and set(out[0][0]) == {"x", "y"}
    assert separate_outline_paths(np.zeros((50, 50), np.uint8), min_peri=10) == []


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
