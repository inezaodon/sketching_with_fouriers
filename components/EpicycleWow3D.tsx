"use client";

import { boundsOf, reconstructCurves, useActiveCurves } from "@/lib/activeCurves";
import { useSketchStore } from "@/lib/store";
import { Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

function Ribbon() {
  const { models } = useActiveCurves();
  const maxTerms = useSketchStore((s) => s.maxTerms);

  const lines = useMemo(() => {
    const curves = reconstructCurves(models, maxTerms, 320);
    if (curves.length === 0) return [] as THREE.Vector3[][];
    const { minX, minY, maxX, maxY } = boundsOf(curves);
    const k = 18 / Math.max(maxX - minX || 1, maxY - minY || 1);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    // XY follow the sketch; Z is a wave along each curve, phase-shifted per curve so outlines separate in depth.
    return curves.map((c, j) =>
      c.map(
        (p, i) =>
          new THREE.Vector3(
            (p.x - cx) * k,
            -(p.y - cy) * k,
            Math.sin((i / Math.max(1, c.length - 1)) * 2 * Math.PI * 2 + j * 0.9) * 0.9,
          ),
      ),
    );
  }, [models, maxTerms]);

  if (lines.length === 0) return null;

  return (
    <group>
      {lines.map((pts, j) => (
        <Line key={j} points={pts} color="#0e7490" lineWidth={1.6} transparent opacity={0.92} />
      ))}
    </group>
  );
}

export function EpicycleWow3D() {
  return (
    <section id="ribbon" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-800/80">Wow feature</p>
        <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 sm:text-4xl">3D ribbon of the same curve</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">
          The same Fourier curves in 3D: XY follow the sketch and each outline ripples in depth along its own length. <span className="font-medium text-slate-800">Drag</span> to rotate the view, scroll or pinch to
          zoom (wheel does not scroll the page while the pointer is here).
        </p>
      </div>
      <div
        data-lenis-prevent
        className="mt-8 h-[min(72vh,620px)] min-h-[300px] w-full cursor-grab overflow-hidden rounded-2xl border border-stone-200 bg-slate-100 shadow-md shadow-slate-300/40 touch-manipulation active:cursor-grabbing"
      >
        <Canvas
          className="h-full min-h-[280px] w-full touch-manipulation"
          style={{ height: "100%", width: "100%" }}
          camera={{ position: [0, 2, 11], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={["#e8eef7"]} />
          <ambientLight intensity={0.55} />
          <pointLight position={[10, 10, 10]} intensity={0.65} color="#38bdf8" />
          <Ribbon />
          <OrbitControls
            makeDefault
            target={[0, 0, 0]}
            enableDamping
            dampingFactor={0.06}
            enableZoom
            zoomSpeed={0.85}
            minDistance={5}
            maxDistance={28}
            enablePan
            screenSpacePanning
          />
        </Canvas>
      </div>
    </section>
  );
}
