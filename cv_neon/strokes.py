"""
Edge map -> drawing strokes for per-curve Fourier series.

`findContours` on a 1-px Canny edge walks the *pixel boundary*: an open stroke
comes back as a thin loop whose return trip does not retrace the way out. With
few Fourier terms those loops puff up into ellipses. Here the edge map is
treated as a graph of pixels and traced into strokes instead:

1. Clean: drop edge specks below `min_pixels`.
2. Thin to a 1-px skeleton (Zhang-Suen), so every pixel has a clear degree.
3. Trace: walk the pixel graph edge by edge, starting at stroke endpoints and
   carrying straight on through junctions (smallest turn), so a jawline crossed
   by a wrinkle stays one stroke.
4. Smooth each stroke along its length (Gaussian, sigma ~1 px) to remove the
   pixel staircase, which otherwise costs high-frequency terms.
5. Encode: closed loops as-is; open strokes as an *exact* out-and-back
   [p0..pn..p1], starting at an endpoint. That makes the curve even,
   z(-t) = z(t), so its Fourier coefficients satisfy c_k = c_-k, and any
   truncation that keeps +/-k in pairs still retraces itself: an open stroke
   stays a single line at every term count instead of opening into a loop.
"""

from __future__ import annotations

import cv2
import numpy as np

# 8 neighbours as (dy, dx); orthogonal first so they win ties.
_NBRS = ((-1, 0), (0, 1), (1, 0), (0, -1), (-1, 1), (1, 1), (1, -1), (-1, -1))


def remove_specks(edges: np.ndarray, min_pixels: int) -> np.ndarray:
    """Drop 8-connected edge components smaller than `min_pixels`."""
    mask = (edges > 0).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    keep = np.zeros(n, dtype=bool)
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= min_pixels
    return keep[labels].astype(np.uint8)


def thin(mask: np.ndarray) -> np.ndarray:
    """Zhang-Suen thinning (vectorised). Input/output: uint8 0/1."""
    img = (mask > 0).astype(np.uint8)
    while True:
        changed = False
        for step in (0, 1):
            p = np.pad(img, 1)
            p2, p3, p4 = p[:-2, 1:-1], p[:-2, 2:], p[1:-1, 2:]
            p5, p6, p7 = p[2:, 2:], p[2:, 1:-1], p[2:, :-2]
            p8, p9 = p[1:-1, :-2], p[:-2, :-2]
            ring = (p2, p3, p4, p5, p6, p7, p8, p9, p2)
            b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
            a = sum(((ring[i] == 0) & (ring[i + 1] == 1)).astype(np.uint8) for i in range(8))
            if step == 0:
                c = (p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)
            else:
                c = (p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0)
            kill = (img == 1) & (b >= 2) & (b <= 6) & (a == 1) & c
            if kill.any():
                img[kill] = 0
                changed = True
        if not changed:
            return img


def _neighbours(skel: np.ndarray, y: int, x: int) -> list[tuple[int, int]]:
    """8-neighbours, but a diagonal only when no shared orthogonal pixel links them
    (otherwise corners form little triangles that look like junctions)."""
    h, w = skel.shape
    out = []
    for dy, dx in _NBRS:
        ny, nx = y + dy, x + dx
        if not (0 <= ny < h and 0 <= nx < w) or not skel[ny, nx]:
            continue
        if dy and dx and (skel[y, nx] or skel[ny, x]):
            continue
        out.append((ny, nx))
    return out


def trace_strokes(skel: np.ndarray) -> list[np.ndarray]:
    """Walk every skeleton edge exactly once. Returns (N, 2) float arrays of (x, y);
    a closed loop repeats its first point at the end."""
    ys, xs = np.nonzero(skel)
    nbrs = {(y, x): _neighbours(skel, y, x) for y, x in zip(ys.tolist(), xs.tolist())}
    used: set[tuple[tuple[int, int], tuple[int, int]]] = set()

    def key(a, b):
        return (a, b) if a < b else (b, a)

    def walk(start, first):
        path = [start, first]
        used.add(key(start, first))
        while True:
            cur = path[-1]
            options = [n for n in nbrs[cur] if key(cur, n) not in used]
            if not options:
                return path
            # direction over the last few pixels, so 8-connectivity jitter does not decide
            back = path[max(0, len(path) - 4)]
            d = np.array([cur[1] - back[1], cur[0] - back[0]], dtype=float)
            d /= np.linalg.norm(d) or 1.0

            def turn(n):
                v = np.array([n[1] - cur[1], n[0] - cur[0]], dtype=float)
                return -float(v @ d) / (np.linalg.norm(v) or 1.0)

            nxt = min(options, key=turn)
            used.add(key(cur, nxt))
            path.append(nxt)

    strokes: list[list[tuple[int, int]]] = []
    endpoints = [p for p, n in nbrs.items() if len(n) == 1]
    junctions = [p for p, n in nbrs.items() if len(n) >= 3]
    for group in (endpoints, junctions, list(nbrs)):
        for p in group:
            for n in nbrs[p]:
                if key(p, n) not in used:
                    strokes.append(walk(p, n))

    return [np.array([(x, y) for y, x in s], dtype=np.float64) for s in strokes]


def smooth_stroke(pts: np.ndarray, sigma: float, closed: bool) -> np.ndarray:
    """Gaussian smoothing along the stroke; endpoints of open strokes stay put."""
    n = len(pts)
    if sigma <= 0 or n < 5:
        return pts
    r = max(1, int(round(3 * sigma)))
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    if closed:
        core = pts[:-1]
        padded = np.concatenate([core[-r:], core, core[:r]])
        out = np.stack([np.convolve(padded[:, i], k, mode="valid") for i in (0, 1)], axis=1)
        return np.vstack([out, out[:1]])
    padded = np.concatenate([np.repeat(pts[:1], r, 0), pts, np.repeat(pts[-1:], r, 0)])
    out = np.stack([np.convolve(padded[:, i], k, mode="valid") for i in (0, 1)], axis=1)
    out[0], out[-1] = pts[0], pts[-1]
    return out


def _arc_length(pts: np.ndarray) -> float:
    return float(np.linalg.norm(np.diff(pts, axis=0), axis=1).sum())


def _resample_open(pts: np.ndarray, n: int) -> np.ndarray:
    """n points evenly spaced along an open polyline, including both ends."""
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    cum = np.concatenate([[0.0], np.cumsum(seg)])
    t = np.linspace(0.0, cum[-1], n)
    return np.stack([np.interp(t, cum, pts[:, 0]), np.interp(t, cum, pts[:, 1])], axis=1)


def _signed_area(pts: np.ndarray) -> float:
    x, y = pts[:, 0], pts[:, 1]
    return 0.5 * float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))


def edges_to_curves(
    edges: np.ndarray,
    *,
    min_length: float,
    total_points: int = 8192,
    min_pixels: int = 12,
    sigma: float = 1.0,
    max_curves: int = 160,
) -> list[np.ndarray]:
    """
    Edge map -> closed sample curves ready for a DFT, each (N, 2) (x, y), no repeated end point.
    Points are allotted by traced length (out-and-back counts twice), so spacing is even
    across all curves.
    """
    skel = thin(remove_specks(edges, min_pixels))
    curves: list[tuple[float, np.ndarray, bool]] = []
    for s in trace_strokes(skel):
        closed = len(s) > 3 and np.array_equal(s[0], s[-1])
        s = smooth_stroke(s, sigma, closed)
        length = _arc_length(s)
        if length < min_length:
            continue
        curves.append((length * (1 if closed else 2), s, closed))

    curves.sort(key=lambda c: c[0], reverse=True)
    curves = curves[:max_curves]
    if not curves:
        return []
    total = sum(c[0] for c in curves)

    out: list[np.ndarray] = []
    for traced, s, closed in curves:
        n = max(8, int(round(total_points * traced / total)))
        if closed:
            loop = _resample_open(s, n + 1)[:-1]  # drop the repeated start
            if _signed_area(loop) > 0:
                loop = loop[::-1]
            out.append(loop)
        else:
            m = n // 2 + 1  # out-and-back of m points has 2m - 2 samples
            fwd = _resample_open(s, m)
            out.append(np.vstack([fwd, fwd[-2:0:-1]]))
    return out
