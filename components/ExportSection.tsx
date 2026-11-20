"use client";

import { Button } from "@/components/ui/button";
import { curvesToFittedPath, reconstructCurves, useActiveCurves } from "@/lib/activeCurves";
import { buildDesmosExportText, copyToClipboard } from "@/lib/desmosExport";
import { buildDesmosFormula } from "@/lib/desmosFormula";
import { useSketchStore } from "@/lib/store";
import { motion } from "framer-motion";
import { Check, ClipboardCopy, ExternalLink } from "lucide-react";
import { useMemo, useRef, useState } from "react";

const DESMOS_URL = "https://www.desmos.com/calculator";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 font-heading text-lg font-semibold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}

export function ExportSection() {
  const { models, outlineMode } = useActiveCurves();
  const model = useSketchStore((s) => s.model);
  const maxTerms = useSketchStore((s) => s.maxTerms);
  const lastImageSize = useSketchStore((s) => s.lastImageSize);

  const formula = useMemo(() => buildDesmosFormula(models, maxTerms), [models, maxTerms]);
  const previewD = useMemo(() => curvesToFittedPath(reconstructCurves(models, maxTerms, 160)), [models, maxTerms]);
  const multiLine = useMemo(() => {
    if (!model) return "// No model yet.";
    return buildDesmosExportText(model, maxTerms, { imageWidth: lastImageSize?.w, imageHeight: lastImageSize?.h });
  }, [model, maxTerms, lastImageSize]);

  const formulaRef = useRef<HTMLTextAreaElement>(null);
  const multiRef = useRef<HTMLTextAreaElement>(null);
  // Remember *what* was copied so the "Copied" state clears itself when the formula changes.
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const copied = copiedText === null ? null : copiedText === formula?.latex ? "formula" : copiedText === multiLine ? "multi" : null;

  async function copy(which: "formula" | "multi") {
    const text = which === "formula" ? (formula?.latex ?? "") : multiLine;
    const r = await copyToClipboard(text, which === "formula" ? formulaRef.current : multiRef.current);
    setManual(r !== "ok");
    setCopiedText(r === "ok" ? text : null);
    if (r === "ok") window.setTimeout(() => setCopiedText((c) => (c === text ? null : c)), 2500);
  }

  const kb = formula ? (formula.latex.length / 1024).toFixed(1) : "0";

  return (
    <section id="export" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center"
      >
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-800/80">Export</p>
        <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 sm:text-4xl">
          One formula, straight into Desmos
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          The whole sketch as a single expression: every {outlineMode ? "outline" : "path"} with its amplitudes,
          frequencies and phases. Paste it into one empty Desmos row — it graphs immediately, centred and upright, using
          Desmos’ default <span className="font-mono text-slate-800">0 ≤ t ≤ 1</span>.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-12 grid min-w-0 gap-6 rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.18)] sm:p-8 lg:grid-cols-[minmax(0,1fr)_300px]"
      >
        <div className="min-w-0">
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              ["1", "Copy the formula", "One click — it is a single line."],
              ["2", "Open Desmos", "Any empty expression row."],
              ["3", "Paste", "It draws the same sketch."],
            ].map(([n, t, d]) => (
              <li key={n} className="flex gap-3 rounded-xl border border-stone-100 bg-stone-50/70 p-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 font-mono text-xs text-white">
                  {n}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-900">{t}</span>
                  <span className="block text-xs text-slate-500">{d}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" size="lg" onClick={() => copy("formula")} disabled={!formula} className="min-w-[13rem]">
              {copied === "formula" ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
              {copied === "formula" ? "Copied — now paste" : "Copy Desmos formula"}
            </Button>
            <a
              href={DESMOS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-stone-200 bg-white px-6 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-stone-300 hover:bg-stone-50"
            >
              Open Desmos <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          {manual && (
            <p className="mt-3 text-xs text-amber-800" role="status">
              The browser blocked clipboard access — the formula below is selected; press ⌘C / Ctrl+C.
            </p>
          )}

          <label className="mt-6 block font-mono text-[10px] uppercase tracking-wider text-slate-500" htmlFor="desmos-formula">
            The formula
          </label>
          <textarea
            id="desmos-formula"
            ref={formulaRef}
            readOnly
            spellCheck={false}
            rows={5}
            data-lenis-prevent
            value={formula?.latex ?? "No curves yet — wait for the portrait or upload one."}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-2 w-full resize-y break-all rounded-xl border border-stone-200 bg-stone-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 focus:border-cyan-400 focus:outline-none"
          />
          <p className="mt-2 text-xs text-slate-500">
            Changes with the playground’s <span className="font-medium text-slate-700">Terms</span> and{" "}
            <span className="font-medium text-slate-700">Draw as</span> settings. Fewer terms → shorter formula, looser
            sketch.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-[#fdfdfd]">
            <div className="border-b border-stone-100 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              What Desmos will draw
            </div>
            <svg viewBox="0 0 100 100" className="aspect-square w-full" aria-label="Preview of the exported curves">
              <defs>
                <pattern id="desmos-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M10 0H0V10" fill="none" stroke="#e2e8f0" strokeWidth="0.25" />
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#desmos-grid)" />
              <path d={previewD} fill="none" stroke="#c74440" strokeWidth="0.45" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Curves" value={String(formula?.curves ?? 0)} />
            <Stat label="Terms" value={String(formula?.terms ?? 0)} />
            <Stat label="Size" value={`${kb} KB`} />
          </div>
        </div>
      </motion.div>

      <details className="group mx-auto mt-6 max-w-6xl rounded-2xl border border-stone-200 bg-white/70 p-4 shadow-sm open:bg-white sm:p-5">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-700 marker:hidden">
          <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
          Multi-line export (named <span className="font-mono">X_1(t)</span>, <span className="font-mono">Y_1(t)</span>,
          single stitched path)
        </summary>
        <p className="mt-3 text-xs leading-relaxed text-slate-600">
          The older format: one named function per coordinate, chunked for long sums, with comments. Useful for editing
          individual terms; Desmos needs each line pasted into its own row.
        </p>
        <textarea
          ref={multiRef}
          readOnly
          spellCheck={false}
          rows={10}
          data-lenis-prevent
          value={multiLine}
          className="mt-3 w-full resize-y rounded-xl border border-stone-200 bg-stone-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700 focus:border-cyan-400 focus:outline-none"
        />
        <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => copy("multi")}>
          {copied === "multi" ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
          {copied === "multi" ? "Copied" : "Copy multi-line text"}
        </Button>
      </details>
    </section>
  );
}
