"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

const EQ_CONTINUOUS =
  "f(t) = \\sum_{k} c_k\\, e^{i\\omega_k t} \\;\\;\\Rightarrow\\;\\; \\text{tip traces the outline.}";

const EQ_SOBEL =
  "G_x = I * k_x,\\quad G_y = I * k_y,\\quad |\\nabla I| \\approx \\sqrt{G_x^2 + G_y^2}";

const EQ_DFT =
  "\\tilde{X}[k] = \\sum_{j=0}^{N-1} z_j\\, e^{-2\\pi i\\, jk / N}, \\qquad c_k = \\frac{\\tilde{X}[k]}{N}";

const EQ_TIP =
  "\\mathbf{p}(t) \\approx O + \\sum_k |c_k| \\begin{pmatrix} \\cos(\\omega_k t + \\varphi_k) \\\\ \\sin(\\omega_k t + \\varphi_k) \\end{pmatrix}, \\quad \\varphi_k = \\arg(c_k)";

export function MathCore() {
  const refMain = useRef<HTMLDivElement>(null);
  const refSobel = useRef<HTMLDivElement>(null);
  const refDft = useRef<HTMLDivElement>(null);
  const refTip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opts = { displayMode: true, throwOnError: false } as const;
    if (refMain.current) katex.render(EQ_CONTINUOUS, refMain.current, opts);
    if (refSobel.current) katex.render(EQ_SOBEL, refSobel.current, opts);
    if (refDft.current) katex.render(EQ_DFT, refDft.current, opts);
    if (refTip.current) katex.render(EQ_TIP, refTip.current, opts);
  }, []);

  return (
    <section id="math" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-24">
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-heading text-center text-3xl font-bold text-slate-900 sm:text-4xl"
      >
        The heart of it
      </motion.h2>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="mt-10 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-6 text-center text-slate-900 shadow-sm"
      >
        <div ref={refMain} className="katex-wrap" />
      </motion.div>
      <motion.ul
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-8 grid gap-4 text-sm text-slate-600 sm:grid-cols-3"
      >
        <li className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <span className="font-mono text-cyan-800">Each term</span> — a vector rotating at its own frequency.
        </li>
        <li className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <span className="font-mono text-violet-800">Together</span> — they interfere into a walking pen tip.
        </li>
        <li className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <span className="font-mono text-fuchsia-800">Truncate</span> — keep low frequencies for a looser, gestural
          sketch.
        </li>
      </motion.ul>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-16 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <h3 className="font-heading text-lg font-semibold text-slate-900">From pixels to complex samples</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The <strong>portrait bundle</strong> runs on the server: OpenCV blur → Canny →{" "}
          <span className="font-mono text-slate-800">findContours</span>, so eyes, nose, mouth, and jaw come back as
          separate outlines. Each one is resampled at the same arc-length spacing and kept as its{" "}
          <strong>own closed curve</strong> <span className="font-mono text-slate-800">z_j</span> — no stitching, so
          no jump lines between features. A separate neon pass is only for display.
        </p>
        <div className="mt-6 overflow-x-auto rounded-xl border border-stone-100 bg-slate-50 p-4 text-center text-slate-900">
          <div ref={refSobel} className="katex-wrap" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <h3 className="font-heading text-lg font-semibold text-slate-900">Discrete Fourier on the loop</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          With each outline’s centroid as origin <span className="font-mono text-cyan-900">O</span>,{" "}
          <span className="font-mono text-cyan-900">z_j = (x_j - O_x) + i(y_j - O_y)</span>. The transform runs at
          the outline’s true length <span className="font-mono text-slate-800">N</span> (zero-padding would drag the
          curve toward the origin). Terms are drawn lowest <span className="font-mono text-slate-800">|k|</span> first,
          and the Terms slider keeps the same fraction of each outline’s spectrum.
        </p>
        <div className="mt-6 space-y-4">
          <div className="overflow-x-auto rounded-xl border border-stone-100 bg-slate-50 p-4 text-center text-slate-900">
            <div ref={refDft} className="katex-wrap" />
          </div>
          <div className="overflow-x-auto rounded-xl border border-stone-100 bg-slate-50 p-4 text-center text-slate-900">
            <div ref={refTip} className="katex-wrap" />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
