"use client";

// An interactive rebuild of Midjourney Medical's ASCII intro, taken apart and
// re-authored as our own modules (see ./swirl): a vortex field of monospace
// cells that spins and condenses into a word, finished with a CRT post pass.
// The renderer reads a mutable config ref every frame, so controls update the
// effect live — no re-init. Below the main rebuild are a few EXPERIMENTS that
// push the same engine somewhere the original never went.

import { useEffect, useRef, useState } from "react";
import { Slider, ColorControl, SegmentedControl, GhostButton } from "./controls";
import { SectionLabel } from "../section-label";
import { useSwirlStage, DEFAULT_STAGE, type StageConfig } from "./use-swirl-stage";
import { VARIANTS } from "./resolver";
import { DEFAULT_TEXT } from "./default-text";
import { SwirlExperiments } from "./experiments";

export function SwirlPlayground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [variantId, setVariantId] = useState(VARIANTS[0].id);
  const [ink, setInk] = useState(VARIANTS[0].ink);
  const [logoColor, setLogoColor] = useState(VARIANTS[0].logo);
  const [bg, setBg] = useState(VARIANTS[0].bg);
  const [rows, setRows] = useState<string[]>(VARIANTS[0].rows);
  const [scanlines, setScanlines] = useState(0.4);
  const [aberration, setAberration] = useState(1);
  const [curvature, setCurvature] = useState(1);
  const [zoom, setZoom] = useState(VARIANTS[0].zoom);
  const [failed, setFailed] = useState(false);

  // The background prompt text is fixed; it is not user-editable.
  const cfg = useRef<StageConfig>({
    ...DEFAULT_STAGE,
    rows,
    inkStops: [ink],
    logoColor,
    bg,
    text: DEFAULT_TEXT,
    scanlines,
    aberration,
    curvature,
    zoom,
  });
  useEffect(() => {
    cfg.current = {
      ...DEFAULT_STAGE,
      rows,
      inkStops: [ink],
      logoColor,
      bg,
      text: DEFAULT_TEXT,
      scanlines,
      aberration,
      curvature,
      zoom,
    };
  }, [rows, ink, logoColor, bg, scanlines, aberration, curvature, zoom]);

  const stage = useSwirlStage(canvasRef, cfg, () => setFailed(true));

  const pickVariant = (id: string) => {
    const v = VARIANTS.find((x) => x.id === id) ?? VARIANTS[0];
    setVariantId(v.id);
    setInk(v.ink);
    setLogoColor(v.logo);
    setBg(v.bg);
    setRows(v.rows);
    setZoom(v.zoom);
    stage.current.replay();
  };

  return (
    <>
      <section className="flex min-w-0 flex-col gap-3">
        <SectionLabel
          action={!failed && <GhostButton onClick={() => stage.current.replay()}>Replay</GhostButton>}
        >
          Implementation
        </SectionLabel>

        <div
          className="relative z-10 overflow-hidden rounded-xl border border-[var(--border-line)]"
          style={{ backgroundColor: bg }}
        >
          {failed ? (
            <div className="flex aspect-[16/10] w-full items-center justify-center px-6 text-center text-[13px] text-[var(--text-tertiary)]">
              Your browser doesn&apos;t support WebGL2, so the live playground can&apos;t run here.
            </div>
          ) : (
            <canvas ref={canvasRef} className="block aspect-[16/10] w-full" />
          )}
        </div>

        {!failed && (
          <div className="-mt-5 flex min-w-0 flex-col gap-3 rounded-b-xl border border-t-0 border-[var(--border-line)] bg-[var(--bg-surface)] p-3 pt-5">
            <div className="grid grid-cols-1 items-center gap-x-4 gap-y-3 sm:grid-cols-2">
              <SegmentedControl
                options={VARIANTS.map((v) => ({ id: v.id, label: v.label }))}
                activeId={variantId}
                onPick={pickVariant}
              />
              <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-0.5">
                <ColorControl label="Letters" value={ink} onChange={setInk} />
                <ColorControl label="Logo" value={logoColor} onChange={setLogoColor} />
                <ColorControl label="Background" value={bg} onChange={setBg} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
              <Slider label="Zoom" value={zoom} min={0.5} max={1.6} format={(v) => v.toFixed(2) + "x"} onChange={setZoom} />
              <Slider label="Scanlines" value={scanlines} min={0} max={1} format={(v) => (v * 100).toFixed(0) + "%"} onChange={setScanlines} />
              <Slider label="Aberration" value={aberration} min={0} max={3} onChange={setAberration} />
              <Slider label="Curvature" value={curvature} min={0} max={1} format={(v) => (v * 100).toFixed(0) + "%"} onChange={setCurvature} />
            </div>
          </div>
        )}
      </section>

      <SwirlExperiments />
    </>
  );
}

