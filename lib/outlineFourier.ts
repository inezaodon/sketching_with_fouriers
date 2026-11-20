/**
 * One Fourier series per traced outline (the DrawingWithFFT approach).
 *
 * The stitched single path chains every edge contour into one loop, so the epicycles
 * also draw a jump line between each pair of features and spend terms on those jumps.
 * Here each outline is its own closed curve with its own centroid and epicycle stack,
 * so features never connect and every term goes to real shape.
 *
 * Outlines arrive already resampled at a common arc-length spacing, so keeping the
 * lowest-|k| `maxTerms × weight` terms per outline gives the same detail everywhere.
 */

import { buildFourierModel, type FourierModel, type Point2 } from "./fourier";

/** Fewest terms an outline is drawn with: DC plus k = ±1 (an ellipse). */
export const MIN_OUTLINE_TERMS = 3;

export function buildOutlineModels(outlines: Point2[][]): FourierModel[] {
  const usable = outlines.filter((o) => o.length >= 4);
  if (usable.length === 0) return [];
  const longest = Math.max(...usable.map((o) => o.length));
  return usable.map((o) => {
    // Keep every bin; the visualizer truncates by |k| at draw time.
    const m = buildFourierModel(o, o.length, o.length);
    m.weight = o.length / longest;
    return m;
  });
}

/** Terms to draw for one model given the global slider value. */
export function termCapFor(model: FourierModel, maxTerms: number): number {
  if (model.weight === undefined) return maxTerms;
  return Math.max(MIN_OUTLINE_TERMS, Math.round(maxTerms * model.weight));
}
