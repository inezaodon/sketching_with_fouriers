/**
 * One-line Desmos export: a single LaTeX expression that draws every curve (one per outline,
 * or the single stitched path) — paste it into one Desmos expression row and it graphs.
 *
 * Shape (M curves, terms flattened into shared lists, curve j owns A[O[j]…O[j+1]−1]):
 *
 *   [ ( total(A[s] cos(2π F[s] t + P[s])), −total(A[s] sin(2π F[s] t + P[s])) ) for j=[1…M] ]
 *     with A=[…], F=[…], P=[…], O=[…]
 *
 * • Each curve's centroid is folded into its DC (F=0) term, so no separate origin lists.
 * • Uses 2πt so Desmos' default parametric range 0 ≤ t ≤ 1 draws the whole curve.
 * • Y is negated (image rows point down, Desmos y points up).
 * • Coordinates are centred and scaled to fit Desmos' default ±10 view, so the drawing
 *   appears right after pasting without zooming.
 */

import { epicyclePosition, type FourierModel } from "./fourier";
import { termCapFor } from "./outlineFourier";

/** Half-height of the drawing in Desmos units (default view is roughly ±10 × ±7). */
const TARGET_HALF_EXTENT = 6;

type Term = { A: number; F: number; P: number };

export type DesmosFormula = {
  latex: string;
  curves: number;
  terms: number;
};

function fmt(x: number, digits: number): string {
  if (!Number.isFinite(x)) return "0";
  const s = x.toFixed(digits).replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

function list(values: string[]): string {
  return `\\left[${values.join(",")}\\right]`;
}

/** Terms for one model at its drawing cap, with the centroid folded into the DC term. */
function termsFor(model: FourierModel, cap: number): Term[] {
  const n = Math.min(cap, model.coeffsRe.length);
  let dcRe = model.centroid.x;
  let dcIm = model.centroid.y;
  const out: Term[] = [];
  for (let k = 0; k < n; k++) {
    const re = model.coeffsRe[k];
    const im = model.coeffsIm[k];
    if (model.freqs[k] === 0) {
      dcRe += re;
      dcIm += im;
      continue;
    }
    out.push({ A: Math.hypot(re, im), F: model.freqs[k], P: Math.atan2(im, re) });
  }
  out.unshift({ A: Math.hypot(dcRe, dcIm), F: 0, P: Math.atan2(dcIm, dcRe) });
  return out;
}

function boundsOf(models: FourierModel[], caps: number[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  models.forEach((m, i) => {
    const samples = Math.min(200, Math.max(32, m.fftN));
    for (let s = 0; s < samples; s++) {
      const p = epicyclePosition(m, (s / samples) * 2 * Math.PI, caps[i]);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  });
  return { minX, minY, maxX, maxY };
}

export function buildDesmosFormula(models: FourierModel[], maxTerms: number): DesmosFormula | null {
  if (models.length === 0) return null;
  const caps = models.map((m) => termCapFor(m, maxTerms));

  // Centre on the drawing and scale it to a comfortable size in Desmos units.
  const b = boundsOf(models, caps);
  const midX = (b.minX + b.maxX) / 2;
  const midY = (b.minY + b.maxY) / 2;
  const half = Math.max(b.maxX - b.minX, b.maxY - b.minY) / 2 || 1;
  const scale = TARGET_HALF_EXTENT / half;

  const curves = models.map((m, i) => {
    const terms = termsFor(m, caps[i]);
    // shift: subtract the midpoint from the DC term (complex), then scale every amplitude
    const dc = terms[0];
    const re = dc.A * Math.cos(dc.P) - midX;
    const im = dc.A * Math.sin(dc.P) - midY;
    terms[0] = { A: Math.hypot(re, im), F: 0, P: Math.atan2(im, re) };
    return terms
      .map((t) => ({ ...t, A: t.A * scale }))
      .filter((t, k) => k === 0 || t.A >= 5e-4);
  });

  const all = curves.flat();
  const A = list(all.map((t) => fmt(t.A, 4)));
  const F = list(all.map((t) => String(t.F)));
  const P = list(all.map((t) => fmt(t.P, 4)));
  const wave = (fn: "cos" | "sin", idx: string) =>
    `\\operatorname{total}\\left(A${idx}\\${fn}\\left(2\\pi F${idx}t+P${idx}\\right)\\right)`;

  let latex: string;
  if (curves.length === 1) {
    latex = `\\left(${wave("cos", "")},-${wave("sin", "")}\\right)\\operatorname{with}A=${A},F=${F},P=${P}`;
  } else {
    const offsets: string[] = [];
    let o = 1;
    for (const c of curves) {
      offsets.push(String(o));
      o += c.length;
    }
    offsets.push(String(o));
    const s = "\\left[O\\left[j\\right]...O\\left[j+1\\right]-1\\right]";
    latex =
      `\\left[\\left(${wave("cos", s)},-${wave("sin", s)}\\right)` +
      `\\operatorname{for}j=\\left[1,...,${curves.length}\\right]\\right]` +
      `\\operatorname{with}A=${A},F=${F},P=${P},O=${list(offsets)}`;
  }
  return { latex, curves: curves.length, terms: all.length };
}
