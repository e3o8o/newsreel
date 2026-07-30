// Optional behaviour for the color-depth buttons. Pure CSS gets you every static
// look; this adds the two interactive bits:
//   1. the cursor-reactive materials (Metal's glint, Foil's sheen) follow the
//      pointer — it writes --pointer-x/y, --glare-x/y and --shine-angle on the
//      element; the smoothing lives in the CSS transitions, not here.
//   2. the toggle switch flips its `data-on` on click so the knob slides.
//
// Drop it in and call `initColorDepth()` once (or let it auto-run on load). It is
// framework-free and safe to run again after adding more buttons.

function initColorDepth(root = document) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // cursor-reactive materials
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
        { passive: true },
      );
      el.addEventListener("pointerleave", () => {
        px = 0.5;
        py = 0.5;
        schedule();
      });
    });
  }

  // toggle switches: flip data-on on click (the CSS slides the knob)
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


// Bundled as an ES module by the newsreel scene harness: the adapter calls this
// AFTER it has built its buttons (the auto-run above fires before they exist).
export { initColorDepth };
