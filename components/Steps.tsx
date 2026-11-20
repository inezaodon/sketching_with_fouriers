"use client";

import { VisualDeck } from "@/components/VisualDeck";
import { motion } from "framer-motion";

const beats = [
  { k: "01", t: "Original idea", d: "Photo or silhouette → raster pipeline." },
  {
    k: "02",
    t: "Extracted path",
    d: "OpenCV Canny → thinned and traced into strokes, smoothed, resampled at even spacing (neon PNG is preview).",
  },
  { k: "03", t: "Fourier coefficients", d: "Each outline as complex z_j → exact DFT at its true length (no padding)." },
  { k: "04", t: "Reconstruction", d: "Lowest frequencies first; each outline’s chain of phasors redraws it." },
];

export function Steps() {
  return (
    <section id="pipeline" className="mx-auto max-w-6xl px-4 py-24">
      <motion.h2
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        className="font-heading text-center text-3xl font-bold text-slate-900 sm:text-4xl"
      >
        Visual deck — four canvases
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-slate-600"
      >
        The live sketch, the edge mask with the traced curves, the neon line art, and the photo with its overlay —{" "}
        <span className="font-medium text-slate-800">reorder panels</span> with the arrows.
      </motion.p>

      <VisualDeck />

      <div className="mx-auto mt-14 grid max-w-4xl gap-3 sm:grid-cols-2">
        {beats.map((b, i) => (
          <motion.div
            key={b.k}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-stone-200 bg-white/90 px-4 py-3 shadow-sm"
          >
            <div className="font-mono text-[10px] uppercase tracking-wider text-cyan-700/90">{b.k}</div>
            <div className="mt-1 font-heading text-sm font-semibold text-slate-900">{b.t}</div>
            <p className="mt-1 text-xs leading-snug text-slate-600">{b.d}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
