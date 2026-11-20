"use client";

import { useEffect, useState } from "react";

const LINKS: { href: string; label: string; wide?: boolean }[] = [
  { href: "#pipeline-four-up", label: "Pipeline" },
  { href: "#math", label: "Math", wide: true },
  { href: "#experiment", label: "Playground" },
  { href: "#export", label: "Desmos" },
  { href: "#ribbon", label: "3D", wide: true },
];

/** Sticky top bar: appears solid once the hero scrolls away; highlights the section in view. */
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(`#${e.target.id}`, e.isIntersecting ? e.intersectionRatio : 0);
        let best: string | null = null;
        let bestRatio = 0;
        for (const [k, v] of visible) if (v > bestRatio) [best, bestRatio] = [k, v];
        setActive(best);
      },
      { threshold: [0, 0.15, 0.4, 0.7], rootMargin: "-64px 0px -30% 0px" },
    );
    // Sections mount after the portrait loads, so look them up lazily.
    const attach = () => {
      for (const l of LINKS) {
        const el = document.querySelector(l.href);
        if (el) io.observe(el);
      }
    };
    attach();
    const mo = new MutationObserver(attach);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled ? "bg-white/80 shadow-[0_1px_0_rgba(15,23,42,0.06)] backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <a href="#top" className="flex shrink-0 items-center gap-2 font-heading text-sm font-semibold text-slate-900">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-cyan-600" aria-hidden>
            <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="17" cy="9" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
            <path d="M12 12 L17 9 L19.6 7.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="hidden sm:inline">Fourier portrait studio</span>
        </a>
        <ul className="-mr-2 flex min-w-0 items-center gap-0.5 overflow-x-auto text-xs font-medium sm:gap-1 sm:text-sm">
          {LINKS.map((l) => (
            <li key={l.href} className={l.wide ? "hidden sm:block" : undefined}>
              <a
                href={l.href}
                aria-current={active === l.href ? "true" : undefined}
                className={`block whitespace-nowrap rounded-full px-2.5 py-1.5 transition-colors sm:px-3 ${
                  active === l.href ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-900/5 hover:text-slate-900"
                }`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
