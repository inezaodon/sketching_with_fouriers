"use client";

import { curvesToFittedPath, reconstructCurves, useActiveCurves } from "@/lib/activeCurves";
import { useSketchStore } from "@/lib/store";
import { motion } from "framer-motion";
import { useMemo } from "react";
import type { ReactNode } from "react";

/** Uniform square frame so photos, neon, and SVGs align across the four columns. */
function CompareFrame({ tone, children }: { tone: "light" | "dark"; children: ReactNode }) {
  const shell =
    tone === "dark"
      ? "border-slate-700/80 bg-slate-900"
      : "border-stone-200/90 bg-stone-50";
  return (
    <div
      className={`relative mt-2 aspect-square w-full max-h-64 min-h-0 overflow-hidden rounded-xl border ${shell}`}
    >
      <div className="absolute inset-0 flex items-center justify-center p-1.5 sm:p-2">{children}</div>
    </div>
  );
}

export function CompareSection() {
  const { source, models, outlineMode } = useActiveCurves();
  const maxTerms = useSketchStore((s) => s.maxTerms);
  const originalImageSrc = useSketchStore((s) => s.originalImageSrc);
  const lineArtDataUrl = useSketchStore((s) => s.lineArtDataUrl);

  const sourceSvg = useMemo(() => curvesToFittedPath(source, 100, 10, true), [source]);
  const fourierSvg = useMemo(
    () => curvesToFittedPath(reconstructCurves(models, maxTerms, 200), 100, 10),
    [models, maxTerms],
  );

  return (
    <section
      id="pipeline-four-up"
      className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24"
      aria-labelledby="pipeline-four-heading"
    >
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center font-mono text-xs uppercase tracking-[0.28em] text-cyan-800/80"
      >
        Pipeline overview
      </motion.p>
      <motion.h2
        id="pipeline-four-heading"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-2 font-heading text-center text-3xl font-bold text-slate-900 sm:text-4xl"
      >
        Photo · neon · traced loop · Fourier sketch
      </motion.h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600">
        The row below is one end-to-end run: each square matches a stage from pixels to the curve the epicycles redraw.
      </p>
      <motion.ol
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mx-auto mt-8 max-w-3xl list-decimal space-y-3 pl-5 text-left text-sm leading-relaxed text-slate-600 sm:pl-6"
      >
        <li>
          <span className="font-medium text-slate-800">Photo</span> — the raster you upload (or the bundled default).
          Everything downstream uses this resolution and aspect after the server resizes the long edge.
        </li>
        <li>
          <span className="font-medium text-slate-800">Neon (OpenCV)</span> — blur, Canny edges, contour cleanup, then
          glow / HSV styling in Python. It is a <em>preview</em> of line energy; the Fourier input comes from the same
          Canny edges, so eyes, nose, and outline all contribute.
        </li>
        <li>
          <span className="font-medium text-slate-800">Traced outlines</span> —{" "}
          {outlineMode ? (
            <>
              every edge outline as its own closed curve, resampled at the same arc-length spacing. Keeping them separate
              means no jump lines between features.
            </>
          ) : (
            <>all edge contours stitched by nearest-neighbour endpoints into one closed loop (jump lines included).</>
          )}{" "}
          Each <span className="font-mono text-slate-800">(x, y)</span> point becomes a complex number{" "}
          <span className="font-mono text-slate-800">z_j = x_j + i y_j</span>.
        </li>
        <li>
          <span className="font-medium text-slate-800">Epicycle trace</span> — one full turn of each curve’s sum of
          rotating vectors, with amplitudes and phases from the browser DFT. With enough terms it matches the tracing;
          fewer terms smooth it into a looser sketch.
        </li>
      </motion.ol>

      <div className="mt-10 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <div className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">1 · Photo</div>
          <CompareFrame tone="light">
            {originalImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={originalImageSrc} alt="" className="h-full w-full object-contain object-center" />
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </CompareFrame>
        </div>
        <div className="min-w-0 rounded-2xl border border-stone-200 bg-slate-950 p-3 shadow-sm">
          <div className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-400">
            2 · Neon (OpenCV)
          </div>
          <CompareFrame tone="dark">
            {lineArtDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lineArtDataUrl} alt="" className="h-full w-full object-contain object-center" />
            ) : (
              <span className="text-xs text-slate-500">—</span>
            )}
          </CompareFrame>
        </div>
        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <div className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">
            3 · Traced {outlineMode ? "outlines" : "loop"}
          </div>
          <CompareFrame tone="light">
            <svg viewBox="0 0 100 100" className="h-full w-full text-emerald-700/90" preserveAspectRatio="xMidYMid meet">
              <rect width="100" height="100" fill="#fafafa" rx="4" />
              <path d={sourceSvg} fill="none" stroke="currentColor" strokeWidth="0.5" />
            </svg>
          </CompareFrame>
        </div>
        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <div className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">
            4 · Epicycle trace
          </div>
          <CompareFrame tone="light">
            <svg viewBox="0 0 100 100" className="h-full w-full text-cyan-700/90" preserveAspectRatio="xMidYMid meet">
              <rect width="100" height="100" fill="#fafafa" rx="4" />
              <path d={fourierSvg} fill="none" stroke="currentColor" strokeWidth="0.55" />
            </svg>
          </CompareFrame>
        </div>
      </div>
    </section>
  );
}
