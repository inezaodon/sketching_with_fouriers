"use client";

/**
 * What every panel should draw right now, following the playground's "Draw as" choice:
 * separate outlines (one Fourier series each) or the single stitched path.
 */

import { useMemo } from "react";
import { epicyclePosition, type FourierModel, type Point2 } from "./fourier";
import { termCapFor } from "./outlineFourier";
import { useSketchStore } from "./store";

export type ActiveCurves = {
  /** Traced polylines in image-pixel coordinates (closed). */
  source: Point2[][];
  /** Fourier models to draw / export. */
  models: FourierModel[];
  outlineMode: boolean;
};

export function useActiveCurves(): ActiveCurves {
  const drawMode = useSketchStore((s) => s.drawMode);
  const outlines = useSketchStore((s) => s.outlines);
  const outlineModels = useSketchStore((s) => s.outlineModels);
  const sourcePath = useSketchStore((s) => s.sourcePath);
  const model = useSketchStore((s) => s.model);
  const regionModels = useSketchStore((s) => s.regionModels);
  const featureRegions = useSketchStore((s) => s.featureRegions);

  return useMemo(() => {
    if (drawMode === "outlines" && outlineModels.length > 0) {
      return { source: outlines, models: outlineModels, outlineMode: true };
    }
    const models = featureRegions > 1 && regionModels.length > 0 ? regionModels : model ? [model] : [];
    return { source: sourcePath.length ? [sourcePath] : [], models, outlineMode: false };
  }, [drawMode, outlines, outlineModels, sourcePath, model, regionModels, featureRegions]);
}

/** One full turn of each model at its term cap, as polylines. */
export function reconstructCurves(models: FourierModel[], maxTerms: number, maxSamples = 240): Point2[][] {
  return models.map((m) => {
    const cap = termCapFor(m, maxTerms);
    const n = Math.max(24, Math.min(maxSamples, m.fftN));
    return Array.from({ length: n + 1 }, (_, i) => epicyclePosition(m, (i / n) * 2 * Math.PI, cap));
  });
}

export function boundsOf(curves: Point2[][]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of curves)
    for (const p of c) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  return { minX, minY, maxX, maxY };
}

/** SVG path data for polylines, fitted into a `size × size` box with `pad` margin. */
export function curvesToFittedPath(curves: Point2[][], size = 100, pad = 10, close = false): string {
  if (curves.length === 0) return "";
  const { minX, minY, maxX, maxY } = boundsOf(curves);
  const s = (size - 2 * pad) / Math.max(maxX - minX || 1, maxY - minY || 1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return curves
    .map(
      (c) =>
        c
          .map((p, i) => `${i === 0 ? "M" : "L"}${(size / 2 + (p.x - cx) * s).toFixed(2)},${(size / 2 + (p.y - cy) * s).toFixed(2)}`)
          .join("") + (close ? "Z" : ""),
    )
    .join(" ");
}

/** SVG path data in the curves' own (image pixel) coordinates. */
export function curvesToPixelPath(curves: Point2[][], close = true): string {
  return curves
    .map((c) => c.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("") + (close ? "Z" : ""))
    .join(" ");
}
