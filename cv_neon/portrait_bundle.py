"""Single OpenCV pipeline: Canny-chained DFT path, edge preview, and neon line-art PNG."""

from __future__ import annotations

import base64
import logging
from typing import Any

import cv2
import numpy as np

from cv_neon.pipeline import run_pipeline

_log = logging.getLogger(__name__)


def resize_to_max_side(bgr: np.ndarray, max_side: int) -> np.ndarray:
    h, w = bgr.shape[:2]
    scale = min(1.0, max_side / max(w, h))
    nw = max(64, int(round(w * scale)))
    nh = max(64, int(round(h * scale)))
    if nw == w and nh == h:
        return bgr
    return cv2.resize(bgr, (nw, nh), interpolation=cv2.INTER_AREA)


def map_edge_threshold_to_canny(edge_threshold: int) -> tuple[int, int]:
    """Map legacy UI 20–255 to Canny pair (higher → stricter / fewer edges)."""
    t = (float(edge_threshold) - 20.0) / (255.0 - 20.0)
    t = max(0.0, min(1.0, t))
    high = int(90 + t * 110)
    low = max(20, int(high * 0.42))
    return low, high


def resample_closed_polyline(pts: np.ndarray, n_out: int) -> np.ndarray:
    """Uniform arc-length samples on a closed piecewise-linear loop (pts Nx2)."""
    pts = np.asarray(pts, dtype=np.float64).reshape(-1, 2)
    if pts.shape[0] < 3:
        raise ValueError("need at least 3 points")
    if not np.allclose(pts[0], pts[-1], atol=0.5):
        pts = np.vstack([pts, pts[0:1]])
    seg = np.diff(pts, axis=0)
    seg_len = np.sqrt((seg**2).sum(axis=1))
    total = float(seg_len.sum())
    if total < 1e-9:
        return np.tile(pts[0], (n_out, 1))
    cum = np.concatenate([[0.0], np.cumsum(seg_len)])
    targets = (np.arange(n_out, dtype=np.float64) + 0.5) * (total / n_out)
    out = np.zeros((n_out, 2), dtype=np.float64)
    for i, target in enumerate(targets):
        j = int(np.searchsorted(cum, target, side="right") - 1)
        j = max(0, min(j, seg_len.shape[0] - 1))
        t0 = cum[j]
        sl = seg_len[j]
        if sl < 1e-12:
            out[i] = pts[j]
            continue
        u = (target - t0) / sl
        out[i] = pts[j] * (1.0 - u) + pts[j + 1] * u
    return out


def fallback_circle_path(w: int, h: int, n: int) -> list[dict[str, float]]:
    cx = w / 2.0
    cy = h / 2.0
    r = min(w, h) * 0.35
    out: list[dict[str, float]] = []
    for i in range(n):
        t = (i / n) * (2 * np.pi)
        out.append({"x": float(cx + np.cos(t) * r), "y": float(cy + np.sin(t) * r)})
    return out


def _path_dict_from_pts(samp: np.ndarray) -> list[dict[str, float]]:
    return [{"x": float(samp[i, 0]), "y": float(samp[i, 1])} for i in range(samp.shape[0])]


def _chain_contours_nearest_neighbour(
    contours: list[np.ndarray],
    min_peri: float,
) -> np.ndarray | None:
    """
    Chain all significant contours into one continuous open polyline using
    nearest-neighbour endpoint stitching, then close it back to the start.

    Each contour contributes its full point sequence. Between contours we jump
    directly (no filler points) — the DFT handles the discontinuity as
    high-frequency terms.

    Returns an (N, 2) float64 array, or None if no valid contours exist.
    """
    valid: list[np.ndarray] = []
    for cnt in contours:
        pts = cnt.reshape(-1, 2).astype(np.float64)
        if len(pts) < 2:
            continue
        peri = float(np.sum(np.linalg.norm(np.diff(pts, axis=0), axis=1)))
        if peri >= min_peri:
            valid.append(pts)

    if not valid:
        return None

    valid.sort(
        key=lambda p: np.sum(np.linalg.norm(np.diff(p, axis=0), axis=1)),
        reverse=True,
    )

    chained: list[np.ndarray] = [valid[0]]
    remaining = valid[1:]

    while remaining:
        last_pt = chained[-1][-1]
        best_idx = 0
        best_dist = np.inf
        best_flip = False

        for i, seg in enumerate(remaining):
            d_start = np.linalg.norm(seg[0] - last_pt)
            d_end = np.linalg.norm(seg[-1] - last_pt)
            if d_start <= d_end:
                d, flip = d_start, False
            else:
                d, flip = d_end, True
            if d < best_dist:
                best_dist = d
                best_idx = i
                best_flip = flip

        seg = remaining.pop(best_idx)
        if best_flip:
            seg = seg[::-1]
        chained.append(seg)

    return np.vstack(chained)


def _chained_canny_path(
    img: np.ndarray,
    canny_low: int,
    canny_high: int,
    sample_points: int,
    min_peri: float,
) -> list[dict[str, float]] | None:
    """
    Run Canny on the image, collect ALL contours (RETR_LIST so inner features
    are included), chain them into one path, resample by arc length.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, canny_low, canny_high)

    # RETR_LIST: retrieves every contour without hierarchy — gets eyes, nose,
    # mouth, jaw, hair, clothing as separate contours, not just the outer shell.
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return None

    chained = _chain_contours_nearest_neighbour(contours, min_peri=min_peri)
    if chained is None or len(chained) < 3:
        return None

    try:
        samp = resample_closed_polyline(chained, sample_points)
    except ValueError:
        return None
    return _path_dict_from_pts(samp)


def _signed_area(pts: np.ndarray) -> float:
    x, y = pts[:, 0], pts[:, 1]
    return 0.5 * float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))


def _resample_closed_count(pts: np.ndarray, n_out: int) -> np.ndarray:
    """Like `resample_closed_polyline`, but tolerates 2-point strokes (out-and-back)."""
    if pts.shape[0] == 2:
        pts = np.vstack([pts, pts[::-1]])
    return resample_closed_polyline(pts, n_out)


def separate_outline_paths(
    edges: np.ndarray,
    *,
    min_peri: float,
    total_points: int = 4096,
    min_points: int = 16,
    max_outlines: int = 120,
) -> list[list[dict[str, float]]]:
    """
    One closed curve per edge outline, so each gets its own Fourier series
    (the DrawingWithFFT approach) instead of being stitched into one path.

    Stitching draws a visible jump line between every pair of features and
    spends Fourier terms on those jumps. Kept separate, each outline is a
    smooth closed loop and the drawing has no connecting strokes.

    * RETR_CCOMP + drop holes: a closed 1-px Canny ring yields an outer and an
      inner contour 1 px apart; keeping both would draw it twice.
    * Points are allotted in proportion to perimeter, so every outline is
      sampled at the same spacing and the same term fraction means the same
      detail everywhere.
    * Winding is normalised via the signed area so outlines all run the same
      way round (matters for consistent epicycle direction).
    """
    contours, hierarchy = cv2.findContours(edges, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if not contours or hierarchy is None:
        return []

    kept: list[tuple[float, np.ndarray]] = []
    for cnt, hh in zip(contours, hierarchy[0]):
        if hh[3] != -1:  # hole of an outer ring
            continue
        pts = cnt.reshape(-1, 2).astype(np.float64)
        if pts.shape[0] < 2:
            continue
        peri = float(cv2.arcLength(cnt, True))
        if peri < min_peri:
            continue
        kept.append((peri, pts))

    kept.sort(key=lambda kp: kp[0], reverse=True)
    kept = kept[:max_outlines]
    if not kept:
        return []

    total_peri = sum(p for p, _ in kept)
    out: list[list[dict[str, float]]] = []
    for peri, pts in kept:
        if np.allclose(pts[0], pts[-1]):
            pts = pts[:-1]
        if pts.shape[0] >= 3 and _signed_area(pts) > 0:
            pts = pts[::-1]
        n = max(min_points, int(round(total_points * peri / total_peri)))
        try:
            samp = _resample_closed_count(pts, n)
        except ValueError:
            continue
        out.append([{"x": round(float(x), 2), "y": round(float(y), 2)} for x, y in samp])
    return out


def _photo_canny_path_and_edges(
    img: np.ndarray,
    canny_low: int,
    canny_high: int,
    sample_points: int,
    min_area: float,
    w: int,
    h: int,
) -> tuple[list[dict[str, float]], np.ndarray]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)
    edges = cv2.Canny(blurred, canny_low, canny_high)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return fallback_circle_path(w, h, sample_points), edges

    filled = np.zeros((h, w), dtype=np.uint8)
    for cnt in contours:
        if cv2.contourArea(cnt) >= min_area * 0.1:
            cv2.drawContours(filled, [cnt], -1, 255, thickness=cv2.FILLED)

    if filled.sum() == 0:
        return fallback_circle_path(w, h, sample_points), edges

    close_k = max(7, int(min(w, h) * 0.06)) | 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_k, close_k))
    closed = cv2.morphologyEx(filled, cv2.MORPH_CLOSE, kernel, iterations=3)
    closed = cv2.morphologyEx(closed, cv2.MORPH_DILATE, kernel, iterations=1)

    outer, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not outer:
        return fallback_circle_path(w, h, sample_points), edges

    best = max(outer, key=cv2.contourArea)
    if cv2.contourArea(best) < min_area:
        return fallback_circle_path(w, h, sample_points), closed

    pts = best.reshape(-1, 2).astype(np.float64)
    try:
        samp = resample_closed_polyline(pts, sample_points)
        return _path_dict_from_pts(samp), closed
    except ValueError:
        return fallback_circle_path(w, h, sample_points), edges


def build_portrait_bundle(
    bgr: np.ndarray,
    *,
    max_side: int = 420,
    sample_points: int = 512,
    edge_threshold: int = 105,
    min_area: float | None = None,
    outline_points: int = 4096,
) -> dict[str, Any]:
    """
    Returns JSON-serializable dict with width, height, fftOrigin, path,
    edgeMaskPngBase64, lineArtPngBase64, pathSource, lineArtPathVerify, and
    `outlines` (one closed, arc-length-resampled curve per edge outline).
    """
    img = resize_to_max_side(bgr, max_side)
    h, w = img.shape[:2]
    canny_low, canny_high = map_edge_threshold_to_canny(edge_threshold)

    if min_area is None:
        min_area = max(80.0, (w * h) * 0.001)

    # ── Strategy 1: chain all Canny contours (eyes, nose, mouth, hair, body) ──
    # min_peri filters sub-pixel noise; scale it with image size.
    min_peri = max(15.0, min_area**0.5)
    path_list = _chained_canny_path(
        img, canny_low, canny_high, sample_points, min_peri=min_peri
    )
    path_source = "chainedCanny"

    if path_list is None:
        # ── Strategy 2: single largest Canny contour (old photoCanny fallback) ──
        path_list, _photo_edges = _photo_canny_path_and_edges(
            img, canny_low, canny_high, sample_points, min_area, w, h
        )
        path_source = "photoCanny"
        _log.warning("portrait_bundle: chained path failed, fell back to photoCanny")

    # Edge mask PNG: use the Canny edge image for display
    gray_img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred_img = cv2.GaussianBlur(gray_img, (5, 5), 0)
    edge_for_png = cv2.Canny(blurred_img, canny_low, canny_high)

    line_art_verify = path_source == "chainedCanny" and path_list is not None

    outlines = separate_outline_paths(
        edge_for_png, min_peri=min_peri, total_points=outline_points
    )

    line_bgr = run_pipeline(
        img,
        use_sobel=False,
        canny_low=canny_low,
        canny_high=canny_high,
        sobel_thresh=96.0,
        blur_ksize=7,
        blur_sigma=0.0,
        min_area=min_area,
        epsilon_ratio=0.002,
        stroke=2,
        glow_passes=3,
        glow_sigma0=2.2,
        glow_sigma_growth=1.4,
        glow_mix=0.85,
        sharp_mix=1.0,
        hsv_v_gain=1.12,
        hsv_s_gain=1.35,
    )

    ok_e, edge_buf = cv2.imencode(".png", edge_for_png)
    ok_l, line_buf = cv2.imencode(".png", line_bgr)
    if not ok_e or not ok_l:
        raise RuntimeError("PNG encode failed")

    return {
        "width": w,
        "height": h,
        "fftOrigin": {"x": w / 2.0, "y": h / 2.0},
        "path": path_list,
        "edgeMaskPngBase64": base64.b64encode(edge_buf.tobytes()).decode("ascii"),
        "lineArtPngBase64": base64.b64encode(line_buf.tobytes()).decode("ascii"),
        "pathSource": path_source,
        "lineArtPathVerify": line_art_verify,
        "outlines": outlines,
    }
