// src/cta/adapter.ts
var CSS = `
@keyframes cta-rise { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes cta-in { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }
.cta-root { position: absolute; inset: 0; overflow: hidden; background: #0a0b10;
  font-family: var(--font-neue-corp); color: #f6f7fb; }
.cta-aurora { position: absolute; inset: 0; filter: blur(70px) saturate(1.15); opacity: 0.85; }
.cta-bar { position: absolute; bottom: -12%; border-radius: 50% 50% 0 0;
  transform-origin: bottom center; transform: scaleY(0);
  animation: cta-rise 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.cta-stack { position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 26px; text-align: center; z-index: 2; }
.cta-brand { font-size: clamp(3rem, 7.5vw, 6.2rem); font-weight: 700; letter-spacing: -0.035em;
  opacity: 0; animation: cta-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards; }
.cta-tag { font-size: clamp(1.1rem, 2.2vw, 1.7rem); font-weight: 500; color: #c3c8d8;
  letter-spacing: 0.01em; opacity: 0; animation: cta-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.8s forwards; }
.cta-btn { position: relative; display: inline-flex; align-items: center; justify-content: center;
  margin-top: 14px; padding: 20px 52px; border-radius: 999px; overflow: hidden;
  font-size: clamp(1.15rem, 2.1vw, 1.6rem); font-weight: 700; color: #06281c;
  background: linear-gradient(180deg, #6ff0b8 0%, #16a86b 100%);
  box-shadow:
    inset 0 -1px 4.1px 0.5px rgba(210, 255, 232, 0.55),
    inset 0 0 4px 0 rgb(224, 255, 240),
    inset 0 -36px 14.2px -28px rgba(8, 92, 56, 0.55),
    0 6px 22px rgba(22, 168, 107, 0.4);
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.35);
  opacity: 0; animation: cta-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1.15s forwards; }
.cta-btn::after { content: ""; position: absolute; left: 12px; right: 12px; top: -6px; height: 30px;
  border-radius: 500px; background: linear-gradient(to top, rgba(255,255,255,0), #fff);
  filter: blur(1px); opacity: 0.75; }
.cta-url { font-size: clamp(0.95rem, 1.6vw, 1.25rem); color: #8b93a9; letter-spacing: 0.05em;
  opacity: 0; animation: cta-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1.45s forwards; }
`;
var DEFAULT_PALETTE = ["#16a86b", "#4f7cf7", "#9a5cf0", "#e8557a"];
var adapter_default = {
  async mount(host, props) {
    const style = document.createElement("style");
    style.textContent = CSS;
    host.appendChild(style);
    const root = document.createElement("div");
    root.className = "cta-root";
    host.appendChild(root);
    const palette = Array.isArray(props.palette) && props.palette.length ? props.palette : DEFAULT_PALETTE;
    const aurora = document.createElement("div");
    aurora.className = "cta-aurora";
    const bars = [
      { left: "4%", width: "26%", height: "68%", delay: 0 },
      { left: "26%", width: "30%", height: "88%", delay: 0.12 },
      { left: "50%", width: "26%", height: "74%", delay: 0.24 },
      { left: "70%", width: "26%", height: "58%", delay: 0.36 }
    ];
    bars.forEach((b, i) => {
      const el = document.createElement("div");
      el.className = "cta-bar";
      Object.assign(el.style, {
        left: b.left,
        width: b.width,
        height: b.height,
        background: palette[i % palette.length],
        animationDelay: `${b.delay}s`
      });
      aurora.appendChild(el);
    });
    root.appendChild(aurora);
    const stack = document.createElement("div");
    stack.className = "cta-stack";
    const brand = document.createElement("div");
    brand.className = "cta-brand";
    brand.textContent = String(props.brand ?? "financecrew");
    const tag = document.createElement("div");
    tag.className = "cta-tag";
    tag.textContent = String(props.tagline ?? "Accounting that runs itself.");
    const btn = document.createElement("div");
    btn.className = "cta-btn";
    btn.textContent = String(props.button ?? "Start free");
    const url = document.createElement("div");
    url.className = "cta-url";
    url.textContent = String(props.url ?? "financecrew.eu");
    stack.append(brand, tag, btn, url);
    root.appendChild(stack);
    return {
      start: () => {
      },
      destroy: () => root.remove()
    };
  }
};
export {
  adapter_default as default
};
