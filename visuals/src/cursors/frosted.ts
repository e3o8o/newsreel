// Vanilla port of FrostedWord.tsx: a word as frosted glass, built from stacked
// text copies (sharp fading down, blurred fading up, two chromatic twins, a top
// sheen) under a rounded glass-chip overlay. Same layer stack, JSX to DOM.

const CSS = `
.fw-root { position: relative; display: inline-block; }
.fw-glow { pointer-events: none; position: absolute; left: 50%; top: 50%; z-index: -1;
  height: 130px; width: 540px; max-width: 130%; transform: translate(-50%, -50%);
  background: radial-gradient(ellipse 100% 100% at 50% 50%, var(--fw-page) 0%, transparent 70%);
  filter: blur(30px); }
.fw-tilt { position: relative; display: inline-block;
  transform: translateX(-1px) translateY(-2px) rotate(-1deg); }
.fw-layer { position: absolute; inset: 0; }
.fw-soft { color: var(--fw-ink); opacity: 0.14; filter: blur(9px); }
.fw-deep { color: var(--fw-ink); opacity: 0.16; transform: translate(-1.5px, 3px); filter: blur(5px);
  -webkit-mask-image: linear-gradient(186deg, transparent 20%, black 100%);
  mask-image: linear-gradient(186deg, transparent 20%, black 100%); }
.fw-sharp { position: relative; z-index: 10;
  -webkit-mask-image: linear-gradient(186deg, black 0%, black 40%, transparent 100%);
  mask-image: linear-gradient(186deg, black 0%, black 40%, transparent 100%); }
.fw-blur { filter: blur(2px);
  -webkit-mask-image: linear-gradient(186deg, transparent 0%, black 60%, black 100%);
  mask-image: linear-gradient(186deg, transparent 0%, black 60%, black 100%); }
.fw-near { color: var(--fw-ink); opacity: 0.28; transform: translate(1.5px, 2px); filter: blur(3.5px);
  -webkit-mask-image: linear-gradient(186deg, transparent 30%, black 100%);
  mask-image: linear-gradient(186deg, transparent 30%, black 100%); }
.fw-sheen { opacity: 0.7; color: rgba(255,255,255,0.9);
  -webkit-mask-image: linear-gradient(180deg, black 0%, transparent 30%);
  mask-image: linear-gradient(180deg, black 0%, transparent 30%); }
.fw-chip { pointer-events: none; position: absolute; inset: -4px -8px;
  background: linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.14) 38%,
    rgba(255,255,255,0.08) 62%, rgba(255,255,255,0.24) 100%);
  border: 1px solid rgba(0,0,0,0.06); border-top-color: rgba(255,255,255,0.75);
  border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 1px rgba(0,0,0,0.05),
    inset 0 0 0 3px rgba(255,255,255,0.14), inset 0 0 0 4px rgba(0,0,0,0.045),
    inset 0 8px 16px rgba(255,255,255,0.18), 0 1px 3px rgba(0,0,0,0.07), 0 6px 16px rgba(0,0,0,0.07); }
.fw-gloss { pointer-events: none; position: absolute; inset: -4px -8px; border-radius: 10px;
  background: linear-gradient(180deg, rgba(255,255,255,0.7), transparent 12%);
  mix-blend-mode: overlay; }
`;

let injected = false;

export function frostedWord(text: string, opts: { ink?: string; page?: string } = {}): HTMLElement {
  if (!injected) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    injected = true;
  }
  const root = document.createElement("span");
  root.className = "fw-root";
  root.style.setProperty("--fw-ink", opts.ink ?? "#1b1b1e");
  root.style.setProperty("--fw-page", opts.page ?? "#f4f4f6");

  const glow = document.createElement("span");
  glow.className = "fw-glow";
  glow.setAttribute("aria-hidden", "true");
  root.appendChild(glow);

  const tilt = document.createElement("span");
  tilt.className = "fw-tilt";
  root.appendChild(tilt);

  const layer = (cls: string, withText = true) => {
    const el = document.createElement("span");
    el.className = cls;
    if (withText) el.textContent = text;
    tilt.appendChild(el);
    return el;
  };
  layer("fw-layer fw-soft");
  layer("fw-layer fw-deep");
  layer("fw-sharp");
  layer("fw-layer fw-blur");
  layer("fw-layer fw-near");
  layer("fw-layer fw-sheen");
  layer("fw-chip", false);
  layer("fw-gloss", false);
  return root;
}
