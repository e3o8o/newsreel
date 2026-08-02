// visuals/src/materials/color-depth.css
var color_depth_default = `/* The Art of Color Depth \u2014 button depth by technique, not by color.
 *
 * Six ways to give a flat button real depth. Each is a different METHOD; the
 * colors are just variables you swap. Every recipe styles the same markup:
 *
 *   <button class="depth-btn depth-<type>">
 *     <span class="depth-label">Get Started</span>
 *   </button>
 *
 * The depth never comes from one drop shadow. It is layers stacked on the same
 * element: a base gradient (the body), inset shadows (the bevel and inner glow),
 * a ::before that fades in on hover (the light turning on), and often a ::after
 * highlight (the specular sheen). Copy the shared base plus the one type you want.
 */

/* \u2500\u2500 shared base (same for every type) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.depth-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 22px;
  border: none;
  border-radius: 999px;
  font: 500 15px/1 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  letter-spacing: 0.01em;
  color: #fff;
  cursor: pointer;
  isolation: isolate; /* keep the ::before/::after layers under the label */
  overflow: hidden; /* clip every decoration layer to the pill */
  -webkit-tap-highlight-color: transparent;
  /* No scale/lift on the button itself \u2014 each material animates only its own
     look (a glint, a glow) on hover/press, nothing generic. */
  transition:
    filter 0.2s ease,
    box-shadow 0.2s ease;
}
.depth-label {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
}
/* icon variant: a square button (same material, different silhouette) */
.depth-btn.depth-icon {
  width: 44px;
  padding: 0;
  border-radius: 14px;
}

/* \u2500\u2500 Toggle switch: the material is the TRACK; a solid knob slides on top \u2500\u2500\u2500\u2500\u2500 */
.depth-btn.depth-toggle {
  width: 76px;
  padding: 0;
  cursor: pointer;
}
/* the knob \u2014 a smaller, textured circle that rides above the material and glides.
   Texture: a soft top highlight + a faint bottom shade baked into the background,
   plus a hairline rim, so it reads as a rounded physical dot, not a flat disc. */
.depth-knob {
  position: absolute;
  z-index: 3;
  top: 7px;
  left: 7px;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background:
    radial-gradient(120% 120% at 50% 22%, rgba(255, 255, 255, var(--knob-hi, 0.55)), rgba(255, 255, 255, 0) 55%),
    radial-gradient(120% 120% at 50% 100%, rgba(0, 0, 0, var(--knob-lo, 0.22)), rgba(0, 0, 0, 0) 55%),
    var(--knob, #ffffff);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.35),
    0 2px 5px rgba(0, 0, 0, 0.22),
    inset 0 1px 1px rgba(255, 255, 255, var(--knob-hi, 0.5)),
    inset 0 0 0 1px rgba(0, 0, 0, 0.06);
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.depth-toggle[data-on="true"] .depth-knob {
  transform: translateX(32px);
}
/* off state reads a little dimmer, so "on" is clearly the lit one */
.depth-toggle[data-on="false"] {
  filter: saturate(0.6) brightness(0.94);
}
/* per-material knob colour: dark knob on the pale materials, white elsewhere.
   Dark knobs get much softer texture (the highlight/shade would read as heavy
   gloss on a near-black circle). */
.depth-inset,
.depth-satin,
.depth-metal,
.depth-glass {
  --knob: #2a2f3a;
  --knob-hi: 0.14;
  --knob-lo: 0.08;
}
.depth-btn::before,
.depth-btn::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  z-index: 1;
  pointer-events: none;
}
/* ::before defaults to visible now; materials that want it hidden set opacity:0
   themselves. (No generic white sheen-fade on hover.) */

/* \u2500\u2500 Glossy \u2014 a specular highlight bar over a gradient body \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The classic app-button look. A bright-to-dark gradient body, faint inner rim
   light, a dark inset at the bottom for weight, and a blurred white bar that
   overhangs the top edge like studio lighting on plastic. */
.depth-glossy {
  overflow: hidden; /* clip the highlight bar to the pill */
  background: linear-gradient(180deg, #ffb347 0%, #e06c1f 100%);
  box-shadow:
    inset 0 -1px 4.1px 0.5px rgba(255, 224, 160, 0.55),
    inset 0 0 4px 0 rgb(255, 234, 200),
    inset 0 -36px 14.2px -28px rgba(180, 80, 20, 0.5),
    0 3px 8px rgba(200, 96, 30, 0.35);
  text-shadow: 0 1px 2px rgba(90, 40, 0, 0.5);
}
.depth-glossy::after {
  content: "";
  position: absolute;
  left: 10px;
  right: 10px;
  top: -5px;
  height: 28px;
  border-radius: 500px;
  background: linear-gradient(to top, rgba(255, 255, 255, 0), #fff);
  filter: blur(1px);
  opacity: 0.7;
  transition: opacity 0.3s ease, top 0.3s ease;
  z-index: 1;
}
.depth-glossy:hover::after {
  opacity: 0.9;
  top: -3px;
}

/* \u2500\u2500 Glow \u2014 a solid body lit from inside, hover turns the light up \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   No specular. The depth is an internal glow: a dark-to-bright gradient with
   inset color glows, and a ::before that swaps to a brighter gradient with crisp
   light along the lower inner edge \u2014 the button appears to power on. */
.depth-glow {
  color: #fdeaff;
  text-shadow: 0 1px 2px rgba(40, 0, 48, 0.55);
  background: linear-gradient(180deg, #2a0a45 0%, #a01fd0 100%);
  box-shadow:
    inset 0 -1.5px 2px 0 #d67bff,
    inset 0 0 10px 0 #b01ffb,
    inset 0 0 8px 0 #b01ffb,
    0 2px 6px rgba(140, 20, 200, 0.35);
}
/* the brighter "light on" layer: hidden at rest, fades in on hover */
.depth-glow::before {
  opacity: 0;
  transition: opacity 0.2s ease;
  background: linear-gradient(180deg, #45108a 9%, #c31ffb 100%);
  box-shadow:
    inset 0 -0.5px 1px 0 #ff8cf0,
    inset 0 -1px 3px 0 #ff8cf0,
    inset 0 -1.5px 5px 0 #ff9ce8,
    inset 0 0 12px 0 #d155ff,
    inset 0 0 10px 0 #d155ff;
}
.depth-glow:hover::before {
  opacity: 1;
}

/* \u2500\u2500 Metal \u2014 brushed surface with a bevel and a sheen that follows the cursor \u2500
   A cool vertical gradient with a bright top bevel and dark bottom bevel, a
   faint vertical "brushing", and a diagonal specular streak (::after) whose
   position tracks --pointer-x (a driver updates it while hovering; it rests in
   the centre). The glint slides to wherever the light "hits" as you move. */
.depth-metal {
  --pointer-x: 50%; /* driven by JS on hover; falls back to centre */
  color: #1c2230;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);
  overflow: hidden;
  background:
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.05) 0px,
      rgba(0, 0, 0, 0.04) 1px,
      rgba(255, 255, 255, 0.05) 2px
    ),
    linear-gradient(180deg, #f4f6f9 0%, #c3cad6 48%, #aab2c0 52%, #d3d9e2 100%);
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.9),
    inset 0 -1px 1px 0 rgba(30, 38, 56, 0.35),
    inset 0 0 0 1px rgba(255, 255, 255, 0.25),
    0 3px 8px rgba(30, 38, 56, 0.28);
}
/* the moving glint: a soft band positioned at the cursor's x (smoothed in CSS) */
.depth-metal::after {
  opacity: 0.85;
  background: radial-gradient(
    120% 140% at var(--pointer-x, 50%) -20%,
    rgba(255, 255, 255, 0.85) 0%,
    rgba(255, 255, 255, 0.25) 18%,
    rgba(255, 255, 255, 0) 42%
  );
  transition: opacity 0.3s ease, background 0.12s linear;
}
.depth-metal:hover::after {
  opacity: 1;
}

/* \u2500\u2500 Layered \u2014 depth from soft translucent overlays over any fill \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   No baked colours: a translucent black base plus faint layers, so it adds depth
   to a button of ANY fill. Kept smooth \u2014 one gentle top\u2192bottom dome on the body,
   a soft top sheen (::before, fades on press), and a clean even hairline rim
   (::after). Nothing heavy or uneven. */
.depth-layered {
  overflow: hidden;
  /* One smooth translucent body \u2014 no heavy center-shade. A single gentle
     top-to-bottom lightening does the doming, so it reads clean over any fill. */
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.1) 0%,
      rgba(255, 255, 255, 0) 40%,
      rgba(0, 0, 0, 0.12) 100%
    ),
    rgba(0, 0, 0, 0.55);
}
/* layer 1 \u2014 a soft top sheen (fades in on hover, off on press) */
.depth-layered::before {
  opacity: 0.1;
  background: linear-gradient(180deg, #fff 0%, rgba(255, 255, 255, 0) 60%);
  transition: opacity 0.2s ease;
}
.depth-layered:hover::before {
  opacity: 0.15;
}
.depth-layered:active::before {
  opacity: 0;
  transition-duration: 0.05s;
}
/* layer 2 \u2014 a clean, even hairline rim (soft, not the uneven white/grey band) */
.depth-layered::after {
  opacity: 1;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.16),
    inset 0 1px 0 0 rgba(255, 255, 255, 0.14);
}

/* \u2500\u2500 Inset \u2014 carved INTO the surface (the only recessed one) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Unlike every other type (which sit ON the page), this one reads as a hole cut
   into it. The trick: the fill is NEARLY the page colour, so it looks like the
   same surface pushed inward \u2014 then a hard dark shadow along the TOP inner edge
   (the near wall the light can't reach) and a bright highlight along the BOTTOM
   inner edge + a 1px light lip just BELOW the button (the far rim catching light).
   No outer drop shadow (recessed things don't float). Tuned for a light page. */
.depth-inset {
  color: #5b6473;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
  background: linear-gradient(180deg, #dfe3ea 0%, #eef1f6 100%);
  box-shadow:
    inset 0 3px 4px -1px rgba(60, 70, 90, 0.5),
    inset 0 6px 10px -6px rgba(60, 70, 90, 0.45),
    inset 0 -2px 2px -1px rgba(255, 255, 255, 0.95),
    inset 0 0 0 1px rgba(60, 70, 90, 0.12),
    0 1px 0 0 rgba(255, 255, 255, 0.9); /* the lit far lip below the cut */
}
.depth-inset:hover {
  transform: none; /* recessed things don't lift */
  box-shadow:
    inset 0 4px 6px -1px rgba(60, 70, 90, 0.58),
    inset 0 8px 12px -6px rgba(60, 70, 90, 0.5),
    inset 0 -2px 2px -1px rgba(255, 255, 255, 1),
    inset 0 0 0 1px rgba(60, 70, 90, 0.16),
    0 1px 0 0 rgba(255, 255, 255, 0.9);
}
.depth-inset:active {
  /* press flattens the depth \u2014 the cut shallows */
  box-shadow:
    inset 0 1px 2px 0 rgba(60, 70, 90, 0.4),
    inset 0 0 0 1px rgba(60, 70, 90, 0.12);
}

/* \u2500\u2500 Glass \u2014 real refraction through an SVG displacement filter \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The background is bent through the button, not just blurred. A tiny SVG filter
   (feImage of a red/blue gradient map -> three per-channel feDisplacementMaps ->
   blended) refracts what is behind it, then we stack glass highlights on top: a
   gradient border ring (::before), an inner diagonal shine (::after), a top edge
   light line, and a layered outer glow. Needs the <svg id="liquid-glass-filter">
   present in the document (see color-depth.html). Put it over something colorful.
   Falls back to a plain blur where url() backdrop filters aren't supported. */
.depth-glass {
  /* white text reads on the (often busy/photo) background behind the glass */
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.12) 0%,
    rgba(255, 255, 255, 0.05) 50%,
    rgba(255, 255, 255, 0.12) 100%
  );
  -webkit-backdrop-filter: blur(2px) saturate(1.5) brightness(1.05);
  backdrop-filter: blur(2px) saturate(1.5) brightness(1.05);
  box-shadow:
    0 8px 32px rgba(31, 38, 135, 0.15),
    inset 0 0 0 1px rgba(255, 255, 255, 0.18),
    0 4px 24px rgba(0, 0, 0, 0.06),
    inset 0 1px 1px rgba(255, 255, 255, 0.4);
}
@supports (backdrop-filter: url(#liquid-glass-filter)) or
  (-webkit-backdrop-filter: url(#liquid-glass-filter)) {
  .depth-glass {
    -webkit-backdrop-filter: url(#liquid-glass-filter) saturate(1.5) brightness(1.05);
    backdrop-filter: url(#liquid-glass-filter) saturate(1.5) brightness(1.05);
  }
}
.depth-glass::before {
  opacity: 1;
  padding: 1px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.5) 0%,
    rgba(255, 255, 255, 0.1) 45%,
    transparent 100%
  );
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
.depth-glass::after {
  opacity: 0.8;
  inset: 2px;
  border-radius: inherit;
  background:
    linear-gradient(to right, transparent 10%, rgba(255, 255, 255, 0.6) 50%, transparent 90%)
      top / 100% 1px no-repeat,
    linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, transparent 50%, rgba(255, 255, 255, 0.05) 100%);
}
.depth-glass:hover {
  box-shadow:
    0 12px 40px rgba(31, 38, 135, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.25),
    0 6px 30px rgba(0, 0, 0, 0.08),
    inset 0 2px 2px rgba(255, 255, 255, 0.5);
}

/* \u2500\u2500 Foil \u2014 iridescent metal that reacts to the cursor \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The richest one: a silver metal base with a holographic rainbow that shifts,
   soft coloured "film" blobs, a pearly sheen, a moving shine band and a glare
   dot at the cursor. Built from stacked CHILD layers (not just pseudo-elements)
   because it needs five. A tiny JS driver feeds --pointer-x/y, --glare-x/y,
   --foil-shift and --shine-angle while hovering; without JS it still shows a
   handsome static foil. Markup:
     <button class="depth-btn depth-foil">
       <span class="depth-foil-l depth-foil-base"></span>
       <span class="depth-foil-l depth-foil-film"></span>
       <span class="depth-foil-l depth-foil-pearl"></span>
       <span class="depth-label">Get Started</span>
       <span class="depth-foil-l depth-foil-shine"></span>
       <span class="depth-foil-l depth-foil-glare"></span>
     </button>  */
.depth-foil {
  --foil-shift: 0%;
  --glare-x: 50%;
  --glare-y: 50%;
  --pointer-x: 50%;
  --pointer-y: 50%;
  --shine-angle: 135deg;
  color: #14202e;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.5);
  overflow: hidden;
  background: linear-gradient(135deg, #eee 0%, #dcdcdc 40%, #c9c9c9 72%, #e8e8e8 100%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.5),
    inset 0 1px 1px rgba(255, 255, 255, 0.7),
    inset 0 -2px 4px rgba(60, 70, 90, 0.3),
    0 3px 10px rgba(30, 38, 56, 0.3);
}
.depth-foil-l {
  position: absolute;
  inset: -48%;
  z-index: 1;
  background-repeat: no-repeat;
  pointer-events: none;
}
/* the rainbow band over silver \u2014 visible at rest, and it drifts on its own so
   the foil shimmers without the cursor. The JS driver nudges --foil-shift on
   hover, which composes on top of the ambient drift via translateX. */
.depth-foil-base {
  background: linear-gradient(
    112deg,
    transparent 22%,
    rgba(0, 220, 255, 0.4) 30%,
    rgba(80, 255, 190, 0.34) 36%,
    rgba(190, 255, 80, 0.26) 41%,
    rgba(255, 230, 70, 0.24) 47%,
    rgba(255, 70, 180, 0.36) 55%,
    rgba(150, 90, 255, 0.36) 63%,
    rgba(60, 120, 255, 0.3) 70%,
    transparent 80%
  );
  background-size: 240% 100%;
  filter: saturate(1.3) contrast(1.25);
  /* Ambient drift ONLY (background-position). The pointer does NOT move this
     layer \u2014 that's what made it jump/lose state on hover. The rainbow just
     glides on its own; the cursor drives the highlight layers below instead. */
  animation: depth-foil-drift 7s ease-in-out infinite alternate;
}
/* soft coloured film blobs \u2014 also visible at rest, gently breathing */
.depth-foil-film {
  background:
    radial-gradient(ellipse at 20% 30%, rgba(255, 70, 180, 0.34) 0%, transparent 48%),
    radial-gradient(ellipse at 70% 20%, rgba(0, 220, 255, 0.34) 0%, transparent 52%),
    radial-gradient(ellipse at 78% 74%, rgba(80, 255, 190, 0.34) 0%, transparent 56%);
  background-size: 150% 150%, 160% 160%, 145% 145%;
  filter: blur(0.4px) saturate(1.4);
  mix-blend-mode: screen;
  opacity: 0.7;
  animation: depth-foil-drift 9s ease-in-out infinite alternate-reverse;
}
@keyframes depth-foil-drift {
  from {
    background-position: 0% center;
  }
  to {
    background-position: 100% center;
  }
}
@media (prefers-reduced-motion: reduce) {
  .depth-foil-base,
  .depth-foil-film {
    animation: none;
  }
}
/* pearly sheen \u2014 a soft moving highlight that tracks the cursor smoothly */
.depth-foil-pearl {
  z-index: 2;
  inset: 0; /* keep it on-box so its position math is stable, no jump */
  background: radial-gradient(
    120% 120% at var(--glare-x, 50%) var(--glare-y, 50%),
    rgba(230, 238, 245, 0.6) 0%,
    rgba(205, 217, 226, 0.2) 26%,
    transparent 58%
  );
  mix-blend-mode: soft-light;
  opacity: 0.95;
  transition: background 0.12s linear; /* smooth the cursor tracking */
}
/* the travelling shine band, angled by the cursor */
.depth-foil-shine {
  z-index: 4;
  inset: 0;
  background: linear-gradient(
    var(--shine-angle, 120deg),
    transparent 30%,
    rgba(226, 235, 242, 0.5) 48%,
    rgba(0, 124, 255, 0.1) 58%,
    rgba(255, 0, 147, 0.1) 66%,
    transparent 82%
  );
  background-size: 200% 100%;
  background-position: calc(var(--pointer-x, 50%)) center;
  filter: blur(0.25px);
  mix-blend-mode: screen;
  opacity: 0.6;
  transition: background-position 0.12s linear;
}
/* a bright glare dot right under the cursor */
.depth-foil-glare {
  z-index: 5;
  inset: 0;
  background: radial-gradient(
    circle at var(--glare-x, 50%) var(--glare-y, 50%),
    rgba(230, 238, 245, 0.55) 0%,
    rgba(205, 218, 228, 0.16) 10%,
    transparent 38%
  );
  mix-blend-mode: screen;
  opacity: 0.5;
  transition: background 0.12s linear;
}
@media (prefers-reduced-motion: reduce) {
  .depth-foil-l {
    transition: none;
  }
}

/* \u2500\u2500 Neon \u2014 a crisp lit outline (a clean line, not a bloom) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Restrained on purpose: the depth is one precise bright RING drawn as a solid
   line, with only a whisper of glow so it reads as a lit tube, not a shadow
   storm. A very slight inner tint from the bottom grounds the body. Hover firms
   the line and adds the faintest bloom. Refined, "in line", not shadowy. */
.depth-neon {
  --neon: #35f0ff;
  color: #eafeff;
  background:
    linear-gradient(180deg, rgba(53, 240, 255, 0) 55%, color-mix(in srgb, var(--neon) 12%, transparent) 100%),
    #0b1016;
  text-shadow: 0 0 5px color-mix(in srgb, var(--neon) 55%, transparent);
}
/* the ring: a clean 1px line with only the faintest inner glow \u2014 no outer bloom */
.depth-neon::before {
  opacity: 1;
  box-shadow:
    inset 0 0 0 1px var(--neon),
    inset 0 0 2px 0 color-mix(in srgb, var(--neon) 45%, transparent);
  transition: box-shadow 0.25s ease;
}
.depth-neon:hover::before {
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--neon) 55%, #fff),
    inset 0 0 4px 0 color-mix(in srgb, var(--neon) 60%, transparent),
    0 0 4px -2px color-mix(in srgb, var(--neon) 50%, transparent);
}

/* \u2500\u2500 Duotone \u2014 a hard-bevel extruded key (crisp, not soft) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   No blur in the depth: a bright top FACE gradient, then a solid darker "side"
   under it built from stacked 1px box-shadows (the extrusion), so it looks like
   a chunky moulded plastic key. Pressing pushes it down onto its own side. */
.depth-duotone {
  background: linear-gradient(180deg, #ff8a4b 0%, #f2612f 100%);
  color: #fff;
  text-shadow: 0 1px 0 rgba(140, 50, 10, 0.6);
  box-shadow:
    inset 0 1px 0 rgba(255, 220, 190, 0.9),
    /* the extruded side: stacked hard shadows in the darker tone */
    0 1px 0 #c9481c,
    0 2px 0 #c9481c,
    0 3px 0 #b23f18,
    0 4px 0 #b23f18,
    0 5px 0 #9c3714,
    0 6px 0 #9c3714,
    0 8px 8px rgba(120, 40, 10, 0.35);
  transition:
    transform 0.12s cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 0.12s ease;
}
.depth-duotone:hover {
  transform: translateY(-1px);
}
.depth-duotone:active {
  /* slam down onto the extrusion */
  transform: translateY(5px);
  box-shadow:
    inset 0 1px 0 rgba(255, 220, 190, 0.9),
    0 1px 0 #b23f18,
    0 2px 4px rgba(120, 40, 10, 0.35);
}

/* \u2500\u2500 Satin \u2014 a single flat colour with the softest possible dome \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Deliberately the OPPOSITE of Glossy: no gradient body, no specular, no top
   light bar. One solid pastel, and the only depth is a very soft radial vignette
   baked into the background (brighter centre, a hair darker at the rim) plus a
   whisper-thin inner ring. Nothing hard anywhere \u2014 pure smooth matte. */
.depth-satin {
  color: #6a4a86;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.6);
  background:
    radial-gradient(
      120% 140% at 50% 38%,
      rgba(255, 255, 255, 0.5) 0%,
      rgba(255, 255, 255, 0) 55%
    ),
    radial-gradient(
      130% 130% at 50% 100%,
      rgba(150, 120, 200, 0.22) 0%,
      rgba(150, 120, 200, 0) 60%
    ),
    #e7dcfb;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.45),
    0 6px 18px -6px rgba(160, 130, 210, 0.4);
  transition:
    filter 0.25s ease,
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.depth-satin:hover {
  filter: brightness(1.03);
}
.depth-satin:active {
  box-shadow:
    inset 0 2px 6px 0 rgba(150, 120, 200, 0.4),
    inset 0 0 0 1px rgba(255, 255, 255, 0.4);
}

`;

// visuals/src/materials/color-depth.js
function initColorDepth(root = document) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) {
    root.querySelectorAll(".depth-metal, .depth-foil").forEach((el) => {
      if (el.dataset.depthBound) return;
      el.dataset.depthBound = "1";
      let raf = 0;
      let px = 0.5;
      let py = 0.5;
      const write = () => {
        raf = 0;
        const s = el.style;
        s.setProperty("--pointer-x", (px * 100).toFixed(1) + "%");
        s.setProperty("--pointer-y", (py * 100).toFixed(1) + "%");
        s.setProperty("--glare-x", (px * 100).toFixed(1) + "%");
        s.setProperty("--glare-y", (py * 100).toFixed(1) + "%");
        s.setProperty("--shine-angle", (110 + (px - 0.5) * 50).toFixed(1) + "deg");
      };
      const schedule = () => {
        if (!raf) raf = requestAnimationFrame(write);
      };
      el.addEventListener(
        "pointermove",
        (e) => {
          const r = el.getBoundingClientRect();
          if (r.width && r.height) {
            px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
            py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
          }
          schedule();
        },
        { passive: true }
      );
      el.addEventListener("pointerleave", () => {
        px = 0.5;
        py = 0.5;
        schedule();
      });
    });
  }
  root.querySelectorAll(".depth-toggle").forEach((el) => {
    if (el.dataset.depthToggleBound) return;
    el.dataset.depthToggleBound = "1";
    if (!el.hasAttribute("data-on")) el.setAttribute("data-on", "true");
    el.addEventListener("click", () => {
      el.setAttribute("data-on", el.getAttribute("data-on") === "true" ? "false" : "true");
    });
  });
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initColorDepth());
  } else {
    initColorDepth();
  }
}

// visuals/src/shared/ghost.ts
function ghostPointer(host, opts = {}) {
  const target = opts.target ?? host;
  const speed = opts.speed ?? 1;
  const bx = opts.boxX ?? 0.32;
  const by = opts.boxY ?? 0.28;
  let raf = 0;
  const t0 = performance.now();
  const tick = (now) => {
    const t = (now - t0) / 1e3 * speed;
    const r = host.getBoundingClientRect();
    const gx = 0.55 * Math.sin(t * 1.15) + 0.3 * Math.sin(t * 2.6 + 1) + 0.15 * Math.cos(t * 4.1 + 0.4);
    const gy = 0.55 * Math.cos(t * 0.95 + 2.1) + 0.3 * Math.sin(t * 2.2 + 0.5) + 0.15 * Math.cos(t * 3.7 + 1.7);
    const clientX = r.left + r.width * (0.5 + gx * bx);
    const clientY = r.top + r.height * (0.5 + gy * by);
    const ev = () => new PointerEvent("pointermove", { clientX, clientY, bubbles: true, pointerType: "mouse" });
    if (target === "hit") {
      const el = document.elementFromPoint(clientX, clientY);
      (el || host).dispatchEvent(ev());
    } else {
      target.dispatchEvent(ev());
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(raf) };
}

// visuals/src/materials/adapter.ts
var ALL = ["glossy", "glow", "metal", "layered", "inset", "glass", "neon", "duotone", "satin", "foil"];
function button(material, label) {
  const b = document.createElement("button");
  b.className = `depth-btn depth-${material}`;
  const lab = document.createElement("span");
  lab.className = "depth-label";
  lab.textContent = label;
  if (material === "foil") {
    for (const l of ["base", "film", "pearl"]) {
      const s = document.createElement("span");
      s.className = `depth-foil-l depth-foil-${l}`;
      s.setAttribute("aria-hidden", "true");
      b.appendChild(s);
    }
    b.appendChild(lab);
    for (const l of ["shine", "glare"]) {
      const s = document.createElement("span");
      s.className = `depth-foil-l depth-foil-${l}`;
      s.setAttribute("aria-hidden", "true");
      b.appendChild(s);
    }
  } else {
    b.appendChild(lab);
  }
  return b;
}
var adapter_default = {
  async mount(host, props) {
    const style = document.createElement("style");
    style.textContent = color_depth_default;
    host.appendChild(style);
    const dark = props.dark !== false;
    host.style.background = dark ? "radial-gradient(120% 120% at 50% 0%, #1d1f27 0%, #0c0d12 60%)" : "radial-gradient(120% 120% at 50% 0%, #ffffff 0%, #eceef3 60%)";
    const grid = document.createElement("div");
    Object.assign(grid.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      gridTemplateColumns: "repeat(5, auto)",
      alignContent: "center",
      justifyContent: "center",
      gap: "34px 30px",
      padding: "0 6%",
      // the buttons are authored at UI scale; camera wants them larger
      transform: "scale(1.55)",
      transformOrigin: "center"
    });
    const label = String(props.label ?? "Get Started");
    const list = Array.isArray(props.materials) ? props.materials : ALL;
    for (const m of list) grid.appendChild(button(m, label));
    host.appendChild(grid);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("id", "liquid-glass-svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.innerHTML = `<filter id="liquid-glass-filter" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="2" seed="7" result="n"/>
        <feGaussianBlur in="n" stdDeviation="3" result="nb"/>
        <feDisplacementMap in="SourceGraphic" in2="nb" scale="26" xChannelSelector="R" yChannelSelector="G"/>
      </filter>`;
    host.appendChild(svg);
    initColorDepth(host);
    const ghost = ghostPointer(host, { target: "hit", speed: 0.55, boxX: 0.34, boxY: 0.3 });
    return {
      start: () => {
      },
      destroy: () => {
        ghost.stop();
        grid.remove();
      }
    };
  }
};
export {
  adapter_default as default
};
