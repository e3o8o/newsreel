// The landing's behaviour: build the gallery from the catalog, mount live scenes only when
// they scroll into view (and stop them when they leave — a dozen WebGL contexts running at
// once will melt a laptop), wire the copy actions, and drive the usage tabs.

const catalog = await fetch("./catalog.json").then((r) => r.json());
const VISUALS = catalog.visuals;

const grid = document.getElementById("grid");
const filters = document.getElementById("filters");
const toast = document.getElementById("toast");

document.getElementById("live-count").textContent = VISUALS.filter((v) => v.status === "live").length;
document.getElementById("all-count").textContent = VISUALS.length;

// ── copy, with a width-locked label and one shared toast ──────────────────
let toastTimer = 0;
function flash(message) {
  toast.querySelector(".toast-text").textContent = message;
  toast.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-on"), 1400);
}
async function copy(text, btn, label = "copied") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // clipboard is permission-gated in some contexts; the textarea fallback always works
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  if (btn) {
    const slot = btn.querySelector(".lockable");
    const was = slot ? slot.textContent : null;
    btn.classList.add("is-copied");
    if (slot) slot.textContent = "copied";
    setTimeout(() => {
      btn.classList.remove("is-copied");
      if (slot && was !== null) slot.textContent = was;
    }, 1400);
  }
  flash(label);
}

document.querySelectorAll("[data-copy]").forEach((el) => {
  el.addEventListener("click", () => {
    copy(el.dataset.copy, null, "copied");
    el.classList.add("is-copied");
    setTimeout(() => el.classList.remove("is-copied"), 1400);
  });
});

// ── the snippets each card hands you ──────────────────────────────────────
const embedFor = (v) => `import scene from "./visuals/primitives/${v.scene}.js";

const handle = await scene.mount(document.querySelector("#stage"), ${JSON.stringify(v.props || {}, null, 2)});
handle.start();
// handle.destroy() when you tear the element down`;

const configFor = (v) => JSON.stringify({
  id: v.id,
  type: "generated",
  scene: v.scene,
  props: v.props || {},
  duration: 8,
  narration: "Say something true here.",
}, null, 4);

const promptFor = (v) =>
  `Build this: ${v.title} — ${v.blurb}\n\nTechnique: ${v.tech}.\n\n` +
  `The full source and the original build prompt are in the newsreel repo:\n` +
  `incoming/visual-prompts.md (search for "${v.title}").`;

// ── cards ─────────────────────────────────────────────────────────────────
function card(v) {
  const el = document.createElement("article");
  el.className = "card";
  el.dataset.id = v.id;
  el.dataset.status = v.status;
  el.dataset.vibe = (v.vibe || []).join(" ");

  const stage = document.createElement("div");
  stage.className = "stage";
  if (v.status === "live") {
    const mount = document.createElement("div");
    mount.className = "mount";
    stage.appendChild(mount);
    el._mount = mount;
  } else {
    const ph = document.createElement("div");
    ph.className = "placeholder";
    ph.textContent = "prompt only";
    stage.appendChild(ph);
  }

  const body = document.createElement("div");
  body.className = "card-body";
  body.innerHTML = `
    <div class="card-title">
      <span>${v.title}</span>
      <span class="badge ${v.status === "live" ? "is-live" : ""}">${v.status === "live" ? "live" : "prompt"}</span>
    </div>
    <p class="card-blurb">${v.blurb}</p>
    <p class="card-tech">${v.status === "live" ? v.tech : `needs: ${v.needs}`}</p>
  `;

  const actions = document.createElement("div");
  actions.className = "card-actions";
  const act = (label, text, note) => {
    const b = document.createElement("button");
    b.className = "act";
    b.type = "button";
    b.innerHTML = `<span class="lockable">${label}</span>`;
    b.addEventListener("click", () => copy(text, b, note));
    return b;
  };
  if (v.status === "live") {
    actions.append(
      act("embed", embedFor(v), "embed code copied"),
      act("config", configFor(v), "shot config copied"),
    );
  }
  actions.append(act("prompt", promptFor(v), "build prompt copied"));
  body.appendChild(actions);

  // Remix: retype the scene's own word and remount, so you can preview YOUR content
  // in a style before committing it to a config.
  const wordKey = ["word", "text", "letter", "label"].find((k) => v.props && k in v.props);
  if (v.status === "live" && wordKey) {
    const remix = document.createElement("div");
    remix.className = "remix";
    const input = document.createElement("input");
    input.value = String(v.props[wordKey]);
    input.setAttribute("aria-label", `Remix the ${v.title} text`);
    const go = document.createElement("button");
    go.className = "act";
    go.type = "button";
    go.innerHTML = '<span class="lockable">remix</span>';
    const apply = () => {
      v.props = { ...v.props, [wordKey]: input.value.slice(0, 18) || v.props[wordKey] };
      remount(el, v);
    };
    go.addEventListener("click", apply);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") apply(); });
    remix.append(input, go);
    body.appendChild(remix);
  }

  el.append(stage, body);
  return el;
}

// ── live mounting, gated on visibility ────────────────────────────────────
const REGISTRY = {};
async function loadScene(name) {
  if (!REGISTRY[name]) REGISTRY[name] = import(`./visuals/primitives/${name}.js`);
  return REGISTRY[name];
}

// The scenes are authored for a 1440x900 frame; the card scales that whole stage down, so a
// preview is the real thing rather than a squeezed re-layout.
const STAGE_W = 1440;
const STAGE_H = 900;
function fitStage(el) {
  if (!el._mount) return;
  const box = el.querySelector(".stage");
  if (!box) return;
  const s = box.clientWidth / STAGE_W;
  el._mount.style.transform = `scale(${s})`;
}

async function mountCard(el, v) {
  if (el._handle || el._mounting || v.status !== "live") return;
  el._mounting = true;
  fitStage(el);
  try {
    const mod = await loadScene(v.scene);
    el._handle = await mod.default.mount(el._mount, v.props || {});
    el._handle.start();
  } catch (e) {
    el._mount.innerHTML = `<div class="placeholder">unavailable here</div>`;
    console.warn(`scene "${v.scene}" failed to mount:`, e);
  } finally {
    el._mounting = false;
  }
}

function unmountCard(el) {
  if (!el._handle) return;
  try { el._handle.destroy(); } catch { /* already gone */ }
  el._handle = null;
  if (el._mount) el._mount.innerHTML = "";
}

function remount(el, v) {
  unmountCard(el);
  mountCard(el, v);
}

// One observer for the whole grid: cards re-fit when the column width changes.
const ro = new ResizeObserver((entries) => {
  for (const e of entries) fitStage(e.target);
});

const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      const v = VISUALS.find((x) => x.id === e.target.dataset.id);
      if (!v) continue;
      if (e.isIntersecting) mountCard(e.target, v);
      else unmountCard(e.target);
    }
  },
  { rootMargin: "160px 0px" },
);

// Pause everything while the tab is hidden: a backgrounded page should cost nothing.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  grid.querySelectorAll(".card").forEach(unmountCard);
});

// ── filters ───────────────────────────────────────────────────────────────
const VIBES = ["all", "live", ...new Set(VISUALS.flatMap((v) => v.vibe || []))];
let active = "all";

function render() {
  grid.innerHTML = "";
  const list = VISUALS.filter((v) => {
    if (active === "all") return true;
    if (active === "live") return v.status === "live";
    return (v.vibe || []).includes(active);
  });
  for (const v of list) {
    const el = card(v);
    grid.appendChild(el);
    if (v.status === "live") {
      io.observe(el);
      ro.observe(el);
    }
  }
}

for (const vibe of VIBES) {
  const b = document.createElement("button");
  b.className = `filter${vibe === "all" ? " is-active" : ""}`;
  b.type = "button";
  b.textContent = vibe;
  b.addEventListener("click", () => {
    active = vibe;
    filters.querySelectorAll(".filter").forEach((f) => f.classList.toggle("is-active", f === b));
    grid.querySelectorAll(".card").forEach(unmountCard);
    render();
  });
  filters.appendChild(b);
}
render();

// ── usage tabs ────────────────────────────────────────────────────────────
document.getElementById("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t === tab));
  document.querySelectorAll(".panel").forEach((p) => {
    p.classList.toggle("is-active", p.dataset.panel === tab.dataset.panel);
  });
});
