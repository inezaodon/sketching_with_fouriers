"use client";

import { FourierVisualizer } from "@/components/FourierVisualizer";
import { Button } from "@/components/ui/button";
import { useResponsiveCanvasSize } from "@/hooks/useResponsiveCanvasSize";
import { useSketchStore } from "@/lib/store";
import { motion } from "framer-motion";
import { ArrowDown, Sigma } from "lucide-react";

function go(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export function Hero() {
  const { ref: canvasRef, width: canvasW, height: canvasH } = useResponsiveCanvasSize({ maxWidth: 560, aspect: 1 / 1.1, minWidth: 260, minHeight: 280 });
  const outlineCount = useSketchStore((s) => s.outlineModels.length);
  const maxTerms = useSketchStore((s) => s.maxTerms);

  return (
    <section
      id="top"
      className="relative flex min-h-[100dvh] items-center overflow-hidden px-4 pb-16 pt-24"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_50%_-20%,rgba(125,211,252,0.35),transparent_55%),radial-gradient(ellipse_70%_60%_at_100%_0%,rgba(196,181,253,0.25),transparent_50%),radial-gradient(ellipse_60%_50%_at_0%_100%,rgba(251,207,232,0.2),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] [background-size:48px_48px]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 text-center lg:text-left">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-4 font-mono text-xs uppercase tracking-[0.28em] text-cyan-800/80"
          >
            Fourier curves from images
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.02, duration: 0.55 }}
            className="font-heading text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl"
          >
            A portrait drawn by{" "}
            <span className="bg-gradient-to-r from-cyan-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
              spinning circles
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0"
          >
            OpenCV traces the edges of a photo. Each outline becomes a complex signal, its Fourier transform becomes a
            chain of rotating vectors, and their tips redraw the face — then the whole thing exports as one formula you
            can paste into Desmos.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start"
          >
            <Button size="lg" onClick={() => go("experiment")}>
              Try the playground <ArrowDown className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="ghost" onClick={() => go("export")}>
              <Sigma className="h-4 w-4" /> Get the Desmos formula
            </Button>
          </motion.div>
          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-4 text-left lg:mx-0"
          >
            {[
              ["Outlines", outlineCount > 0 ? String(outlineCount) : "—"],
              ["Terms", String(maxTerms)],
              ["Desmos", "1 formula"],
            ].map(([k, v]) => (
              <div key={k} className="border-l-2 border-cyan-500/40 pl-3">
                <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{k}</dt>
                <dd className="mt-0.5 font-heading text-sm font-semibold text-slate-900 sm:text-base">{v}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mx-auto w-full min-w-0 max-w-[560px]"
        >
          <div className="rounded-[28px] border border-white/70 bg-white/60 p-2 shadow-[0_30px_80px_-30px_rgba(14,116,144,0.35)] backdrop-blur">
            <div ref={canvasRef} className="w-full min-w-0 overflow-hidden rounded-[22px]">
              <FourierVisualizer width={canvasW} height={canvasH} theme="light" className="block w-full" />
            </div>
          </div>
          <p className="mt-3 text-center font-mono text-[11px] text-slate-500">
            Live · every line is a sum of rotating vectors
          </p>
        </motion.div>
      </div>
    </section>
  );
}
