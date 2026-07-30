"use client";

// Chromatic Glow playground — the detail-page editor. Type a word and it blooms with
// the RGB chromatic split live. Sliders drive the bloom, the split distance, the noise
// grain, and the three tint colours (warm / cool / fringe). Remix rolls a fresh pair.
// Built on the same ChromaGlow engine the card uses, from the shared Vault control kit
// so it matches the site.

import { useEffect, useMemo, useRef, useState } from "react";
import { ChromaGlow, type ChromaParams } from "./engine";
import {
  defaultChromaParams, remixChromaParams, toHex, fromHex,
} from "./params";
import { PG_PREVIEW, PG_PANEL, Slider, ColorControl, GhostButton } from "../swirl/controls";
import { SectionLabel } from "../section-label";
import { hapticTap } from "../../lib/haptics";

const LABEL = "text-[12px] text-[var(--text-tertiary)]";

export function ChromaGlowPlayground() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ChromaGlow | null>(null);

  const [params, setParams] = useState<ChromaParams>(() => defaultChromaParams());
  const [word, setWord] = useState("chrome");

  const full = useMemo<ChromaParams>(() => ({ ...params, word }), [params, word]);

  // Mount the engine only when the playground scrolls into view, so the detail hero
  // card and the playground don't both spin up WebGL during the view-transition morph.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let raf = 0;
    let started = false;
    let onScreen = true;
    const sync = () => {
      const eng = engineRef.current;
      if (!eng) return;
      if (onScreen) eng.start();
      else eng.stop();
    };
    const build = () => {
      if (started) return;
      started = true;
      raf = requestAnimationFrame(() => {
        const eng = new ChromaGlow(host, full);
        if (!eng.ok) return;
        engineRef.current = eng;
        eng.start();
        if (document.fonts?.load) {
          const probe = document.createElement("span");
          probe.style.cssText = "position:absolute;visibility:hidden;font-family:var(--font-neue-corp)";
          probe.textContent = "Ag";
          document.body.appendChild(probe);
          const fam = getComputedStyle(probe).fontFamily.split(",")[0].replace(/["']/g, "").trim();
          document.body.removeChild(probe);
          document.fonts.load(`800 1em "${fam}"`).then(() => eng.setFont(`"${fam}", sans-serif`), () => {});
        }
      });
    };
    const io = new IntersectionObserver(
      (es) => {
        onScreen = es[0]?.isIntersecting ?? false;
        if (onScreen) build();
        sync();
      },
      { rootMargin: "200px" },
    );
    io.observe(host);
    const onResize = () => engineRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // push params/word to the engine
  useEffect(() => { engineRef.current?.setParams(full); }, [full]);

  const patch = (p: Partial<ChromaParams>) => setParams((prev) => ({ ...prev, ...p }));
  const remix = () => {
    hapticTap();
    // keep the user's typed word — Remix only rolls a fresh colour world, so you can apply
    // different presets to the same text.
    const { word: _drop, ...colours } = remixChromaParams();
    void _drop;
    setParams((prev) => ({ ...prev, ...colours }));
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionLabel action={<GhostButton onClick={remix}>Remix</GhostButton>}>
        Playground
      </SectionLabel>

      {/* live preview */}
      <div className={`${PG_PREVIEW} aspect-[1344/620] w-full bg-[#1c2133]`}>
        <div ref={hostRef} data-canvas-card className="absolute inset-0 h-full w-full" />
      </div>

      {/* controls */}
      <div className={PG_PANEL}>
        {/* word */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className={`${LABEL} shrink-0`}>Word</span>
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="type a word"
            maxLength={14}
            className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border-line)] bg-[var(--bg-page)] px-3 text-[12px] text-[var(--text-primary)] outline-none transition-colors duration-150 ease-[var(--ease-out)] placeholder:text-[var(--text-tertiary)] hover:border-[var(--border-ring)] focus:border-[var(--border-ring)] sm:ml-auto sm:w-[180px] sm:flex-none"
          />
        </div>

        {/* two columns: Glow | Colours */}
        <div className="grid grid-cols-1 items-start gap-x-6 gap-y-5 sm:grid-cols-2">
          <div className="flex flex-col gap-3 self-start">
            <span className={LABEL}>Glow</span>
            <Slider label="Bloom" value={params.bloom} min={0.4} max={2} step={0.01}
              format={(v) => v.toFixed(2)} onChange={(v) => patch({ bloom: v })} />
            <Slider label="Split" value={params.split} min={0} max={20} step={0.5}
              format={(v) => `${v.toFixed(1)}px`} onChange={(v) => patch({ split: v })} />
            <Slider label="Core" value={params.core} min={0} max={1.4} step={0.01}
              format={(v) => v.toFixed(2)} onChange={(v) => patch({ core: v })} />
            <Slider label="Spectral" value={params.spectral} min={0} max={1} step={0.01}
              format={(v) => v.toFixed(2)} onChange={(v) => patch({ spectral: v })} />
            <Slider label="Grain" value={params.noise} min={0} max={0.4} step={0.01}
              format={(v) => v.toFixed(2)} onChange={(v) => patch({ noise: v })} />
          </div>

          <div className="flex flex-col gap-3">
            <span className={LABEL}>Colours</span>
            <ColorControl label="Warm" value={toHex(params.warm)}
              onChange={(hex) => patch({ warm: fromHex(hex) })} />
            <ColorControl label="Cool" value={toHex(params.cool)}
              onChange={(hex) => patch({ cool: fromHex(hex) })} />
            <ColorControl label="Fringe" value={toHex(params.red)}
              onChange={(hex) => patch({ red: fromHex(hex) })} />
            <ColorControl label="Background" value={toHex(params.bg)}
              onChange={(hex) => patch({ bg: fromHex(hex) })} />
          </div>
        </div>
      </div>
    </div>
  );
}

