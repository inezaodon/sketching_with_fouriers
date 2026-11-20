/**
 * Run: node --test tests/fourier.test.ts   (Node ≥ 23 strips types natively)
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFourierModel, epicyclePosition, resampleByArcLength, type Point2 } from "../lib/fourier.ts";

function ellipse(n: number, cx: number, cy: number): Point2[] {
  return Array.from({ length: n }, (_, i) => {
    const u = (i / n) * 2 * Math.PI;
    return { x: cx + 50 * Math.cos(u), y: cy + 20 * Math.sin(u) };
  });
}

function maxError(pts: Point2[], n: number, cap: number, origin?: Point2) {
  const m = buildFourierModel(pts, n, n, origin);
  const ref = resampleByArcLength(pts, n); // what the model actually encodes
  let worst = 0;
  for (let i = 0; i < n; i++) {
    const p = epicyclePosition(m, (i / n) * 2 * Math.PI, cap);
    worst = Math.max(worst, Math.hypot(p.x - ref[i].x, p.y - ref[i].y));
  }
  return { m, worst };
}

test("non-power-of-two length is transformed exactly, not zero-padded", () => {
  const pts = ellipse(170, 300, 200);
  const { m, worst } = maxError(pts, 170, 170);
  assert.equal(m.fftN, 170);
  assert.ok(worst < 0.05, `full reconstruction off by ${worst}`);
});

test("low-term reconstruction of an off-origin curve stays near it", () => {
  // Zero padding put samples at the origin, so few-term fits were dragged toward it.
  // An ellipse resampled by arc length is not a pure 3-term curve, so allow a few px (the padding bug was ~300 px off).
  const pts = ellipse(170, 300, 200);
  const { worst } = maxError(pts, 170, 3, { x: 0, y: 0 });
  assert.ok(worst < 8, `3-term ellipse off by ${worst}`);
});

test("power-of-two path still uses the FFT and matches", () => {
  const pts = ellipse(256, 10, -40);
  const { m, worst } = maxError(pts, 256, 256);
  assert.equal(m.fftN, 256);
  assert.ok(worst < 0.05, `full reconstruction off by ${worst}`);
});
