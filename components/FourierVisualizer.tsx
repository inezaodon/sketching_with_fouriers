"use client";

import { epicyclePosition, type FourierModel } from "@/lib/fourier";
import { termCapFor } from "@/lib/outlineFourier";
import { useSketchStore } from "@/lib/store";
import { useEffect, useMemo, useRef } from "react";

type Props = {
  className?: string;
  width: number;
  height: number;
  /** Light canvas matches the rest of the airy UI; dark is available for embeds. */
  theme?: "light" | "dark";
};

/** Bounds of every model's reconstructed curve at its own term cap. Costly, so computed once per change, not per frame. */
function unionBounds(models: FourierModel[], caps: number[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  models.forEach((m, mi) => {
    const samples = Math.min(240, Math.max(48, m.fftN));
    for (let i = 0; i <= samples; i++) {
      const p = epicyclePosition(m, (i / samples) * Math.PI * 2, caps[mi]);
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  });
  return { minX, minY, maxX, maxY };
}

export function FourierVisualizer({ className, width, height, theme = "light" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const model = useSketchStore((s) => s.model);
  const regionModels = useSketchStore((s) => s.regionModels);
  const outlineModels = useSketchStore((s) => s.outlineModels);
  const drawMode = useSketchStore((s) => s.drawMode);
  const featureRegions = useSketchStore((s) => s.featureRegions);
  const maxTerms = useSketchStore((s) => s.maxTerms);
  const speed = useSketchStore((s) => s.speed);
  const showCircles = useSketchStore((s) => s.showCircles);
  const showPath = useSketchStore((s) => s.showPath);
  const showVectors = useSketchStore((s) => s.showVectors);
  const lineWidth = useSketchStore((s) => s.lineWidth);
  const scrub = useSketchStore((s) => s.scrub);
  const tRef = useRef(0);
  /** Trace points in model (image) coordinates, so a resize or rescale never mixes coordinate frames. */
  const traceRefs = useRef<{ x: number; y: number }[][]>([]);

  const outlineMode = drawMode === "outlines" && outlineModels.length > 0;
  const useMulti = !outlineMode && featureRegions > 1 && regionModels.length > 0;
  const models = useMemo(
    () => (outlineMode ? outlineModels : useMulti ? regionModels : model ? [model] : []),
    [outlineMode, outlineModels, useMulti, regionModels, model],
  );

  useEffect(() => {
    traceRefs.current = models.map(() => []);
  }, [models, maxTerms]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !model) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const c = ctx2d;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    const ms = models;
    if (ms.length === 0) return;
    const caps = ms.map((m) => termCapFor(m, maxTerms));
    const refN = Math.max(...ms.map((m) => m.fftN), 64);
    const dt = ((2 * Math.PI) / refN) * speed * 0.4;
    // One full loop of t is a complete drawing; older trace points only overdraw it.
    const traceCap = Math.ceil((2 * Math.PI) / dt) + 2;

    const w = width;
    const h = height;
    const { minX, minY, maxX, maxY } = unionBounds(ms, caps);
    const pad = 28;
    const bw = maxX - minX || 1;
    const bh = maxY - minY || 1;
    const scale = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
    const ox = w / 2 - ((minX + maxX) / 2) * scale;
    const oy = h / 2 - ((minY + maxY) / 2) * scale;
    const map = (p: { x: number; y: number }) => ({
      x: ox + p.x * scale,
      y: oy + p.y * scale,
    });

    // Outline mode is one drawing, so one ink; region / single-path modes keep per-stack hues.
    const hueFor = (ri: number) => (outlineMode ? 200 : (ri * 53) % 360);
    const circleAlpha = outlineMode ? 0.08 : theme === "light" ? 0.14 : 0.1;
    const vectorAlpha = outlineMode ? 0.18 : theme === "light" ? 0.32 : 0.24;

    let raf = 0;

    function frame() {
      c.fillStyle = theme === "light" ? "#f1f5f9" : "#06060a";
      c.fillRect(0, 0, w, h);

      tRef.current += dt;
      const t = tRef.current;

      while (traceRefs.current.length < ms.length) traceRefs.current.push([]);
      traceRefs.current.length = ms.length;

      if (showCircles || showVectors) {
        c.lineWidth = 1;
        ms.forEach((m, ri) => {
          const hue = hueFor(ri);
          const circleStroke =
            theme === "light" ? `hsla(${hue}, 35%, 55%, ${circleAlpha})` : `hsla(${hue}, 40%, 70%, ${circleAlpha})`;
          const vectorStroke =
            theme === "light" ? `hsla(${hue}, 75%, 42%, ${vectorAlpha})` : `hsla(${hue}, 80%, 60%, ${vectorAlpha})`;
          const C = map(m.centroid);
          let x = C.x;
          let y = C.y;
          const n = Math.min(caps[ri], m.coeffsRe.length);
          const vectors = new Path2D();
          vectors.moveTo(x, y);
          for (let k = 0; k < n; k++) {
            const ck = m.coeffsRe[k];
            const sk = m.coeffsIm[k];
            const r = Math.hypot(ck, sk) * scale;
            const angle = m.freqs[k] * t + Math.atan2(sk, ck);
            const nx = x + r * Math.cos(angle);
            const ny = y + r * Math.sin(angle);
            if (showCircles && r > 0.4) {
              c.strokeStyle = circleStroke;
              c.beginPath();
              c.arc(x, y, r, 0, Math.PI * 2);
              c.stroke();
            }
            vectors.lineTo(nx, ny);
            x = nx;
            y = ny;
          }
          if (showVectors) {
            c.strokeStyle = vectorStroke;
            c.stroke(vectors);
          }
        });
      }

      if (showPath) {
        c.lineWidth = lineWidth;
        c.lineJoin = "round";
        c.lineCap = "round";
        ms.forEach((m, ri) => {
          const tr = traceRefs.current[ri];
          if (!tr) return;
          tr.unshift(epicyclePosition(m, t, caps[ri]));
          if (tr.length > traceCap) tr.length = traceCap;
          if (tr.length < 2) return;
          const lim = Math.max(2, Math.floor(tr.length * scrub));
          const hue = hueFor(ri);
          c.beginPath();
          c.moveTo(ox + tr[0].x * scale, oy + tr[0].y * scale);
          for (let i = 1; i < lim; i++) c.lineTo(ox + tr[i].x * scale, oy + tr[i].y * scale);
          c.strokeStyle = theme === "light" ? `hsl(${hue} 62% ${outlineMode ? 30 : 38}%)` : `hsl(${hue} 70% 62%)`;
          c.stroke();
        });
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [
    model,
    models,
    outlineMode,
    maxTerms,
    speed,
    showCircles,
    showPath,
    showVectors,
    lineWidth,
    scrub,
    width,
    height,
    theme,
  ]);

  if (!model) return <div className={className} style={{ width, height }} />;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width, height, touchAction: "none" }}
      aria-label="Fourier epicycle drawing"
    />
  );
}
