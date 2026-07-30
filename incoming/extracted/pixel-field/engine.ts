import { gsap } from "gsap";

const PIXEL_START = 120;
const PIXEL_MIN = 2;

const PIXEL_STEPS = 24;
function buildPixelRamp(): number[] {
  const sizes: number[] = [];
  let prev = Infinity;
  for (let i = 0; i < PIXEL_STEPS; i++) {
    const t = i / (PIXEL_STEPS - 1);

    const size = Math.round(PIXEL_START + (PIXEL_MIN - PIXEL_START) * (t * (2 - t)));
    const clamped = Math.max(PIXEL_MIN, size);
    if (clamped < prev) {
      sizes.push(clamped);
      prev = clamped;
    }
  }
  if (sizes[sizes.length - 1] !== PIXEL_MIN) sizes.push(PIXEL_MIN);
  return sizes;
}
const BASE_PIXEL_SIZES = buildPixelRamp();
const INTERACTION_PIXEL_SIZE = 70;

const IN_DURATION = 0.5;
const OUT_DURATION = 0.35;
const SLIDE_DURATION = 0.5;
const SWAP_SCALE_MIN = 0.15;
const SWAP_SKEW = 0.18;

const INSET = 0.0;

const SCALE = { min: { scale: 0.33, width: 300 }, max: { scale: 1, width: 1400 } };

type DrawParams = {
  drawWidth: number;
  drawHeight: number;
  drawX: number;
  drawY: number;
};

type Particle = {
  x: number;
  y: number;
  color: { r: number; g: number; b: number };
  opacity: number;
  duration: number;
  startTime: number;
  size: number;
};

export type PixelFieldOptions = {

  hold?: number;

  interaction?: boolean;

  onImageChange?: (index: number) => void;
};

export class PixelField {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private temp: HTMLCanvasElement;
  private tempCtx: CanvasRenderingContext2D;

  private dpr = Math.min(window.devicePixelRatio || 1, 2);
  private cssW = 0;
  private cssH = 0;

  private images: HTMLImageElement[] = [];
  private current = 0;
  private img: HTMLImageElement | null = null;

  private keyed = new Map<HTMLImageElement, HTMLCanvasElement>();

  private basePixelSizes = BASE_PIXEL_SIZES;
  private pixelSizes = BASE_PIXEL_SIZES;
  private interactionPixelSize = INTERACTION_PIXEL_SIZE;
  private lastScale = 0;

  private drawParams: DrawParams | null = null;

  private idx = 0;

  private slideY = 0;
  private swapScale = 1;
  private swapSkew = 0;
  private timeline: gsap.core.Timeline | null = null;
  private raf = 0;
  private running = false;

  private interaction: boolean;
  private hovering = false;
  private mouse: { x: number; y: number } | null = null;
  private lastCell: string | null = null;
  private particles: Particle[] = [];

  private hold: number;
  private onImageChange?: (i: number) => void;

  constructor(host: HTMLElement, sources: HTMLImageElement[], opts: PixelFieldOptions = {}) {
    this.host = host;
    this.images = sources;
    this.img = sources[0] ?? null;
    this.hold = opts.hold ?? 1.6;
    this.interaction = !!opts.interaction;
    this.onImageChange = opts.onImageChange;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "ll-block--canvas-2d";
    this.ctx = this.canvas.getContext("2d")!;
    this.temp = document.createElement("canvas");
    this.tempCtx = this.temp.getContext("2d")!;
    this.host.appendChild(this.canvas);

    this.disableSmoothing(this.ctx);
    this.disableSmoothing(this.tempCtx);
    this.measure();

    if (this.interaction) {
      this.canvas.addEventListener("mouseenter", this.onEnter);
      this.canvas.addEventListener("mouseleave", this.onLeave);
      this.canvas.addEventListener("mousemove", this.onMove);
    }
  }

  private measure() {
    const r = this.host.getBoundingClientRect();
    this.cssW = r.width;
    this.cssH = r.height;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.disableSmoothing(this.ctx);
    this.scalePixelSizes();
    this.calcDrawParams();
  }

  private disableSmoothing(c: CanvasRenderingContext2D) {
    c.imageSmoothingEnabled = false;

    (c as unknown as Record<string, boolean>).webkitImageSmoothingEnabled = false;
    (c as unknown as Record<string, boolean>).mozImageSmoothingEnabled = false;
    (c as unknown as Record<string, boolean>).msImageSmoothingEnabled = false;
  }

  private calcDrawParams() {
    const img = this.img;
    if (!img) return;

    const boxW = this.cssW * (1 - 2 * INSET);
    const boxH = this.cssH * (1 - 2 * INSET);
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = boxW / boxH;

    const fitW = imgRatio > boxRatio ? boxW : boxH * imgRatio;
    const fitH = imgRatio > boxRatio ? boxW / imgRatio : boxH;
    this.drawParams = {
      drawWidth: fitW,
      drawHeight: fitH,
      drawX: (this.cssW - fitW) / 2,
      drawY: (this.cssH - fitH) / 2,
    };
  }

  private scalePixelSizes() {
    const w = this.cssW;
    if (!w) return;
    let f = SCALE.min.scale;
    if (w >= SCALE.max.width) f = SCALE.max.scale;
    else if (w > SCALE.min.width)
      f =
        SCALE.min.scale +
        ((SCALE.max.scale - SCALE.min.scale) * (w - SCALE.min.width)) /
          (SCALE.max.width - SCALE.min.width);
    if (Math.abs(f - this.lastScale) > 0.01) {
      this.pixelSizes = this.basePixelSizes.map((s) => Math.max(1, Math.round(s * f)));
      this.interactionPixelSize = Math.max(1, Math.round(INTERACTION_PIXEL_SIZE * f));
      this.lastScale = f;
    }
  }

  private pixelSizeNow(): number {
    const max = this.pixelSizes.length - 1;
    const i = Math.min(Math.floor(this.idx), max);
    return this.pixelSizes[i];
  }

  private gridParams(px: number) {
    const { drawX, drawY, drawWidth, drawHeight } = this.drawParams!;
    const blocksX = Math.ceil(drawWidth / px);
    const blocksY = Math.ceil(drawHeight / px);
    const totalWidth = blocksX * px;
    const totalHeight = blocksY * px;
    return {
      blocksX,
      blocksY,
      totalWidth,
      totalHeight,
      offsetX: drawX + (drawWidth - totalWidth) / 2,

      offsetY: drawY + (drawHeight - totalHeight) / 2 + Math.round(this.slideY / px) * px,
    };
  }

  private keyedSource(img: HTMLImageElement): HTMLCanvasElement {
    const cached = this.keyed.get(img);
    if (cached) return cached;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d")!;
    cx.drawImage(img, 0, 0);
    const data = cx.getImageData(0, 0, w, h);
    const d = data.data;
    const T = 236;
    const isWhite = (p: number) => d[p] >= T && d[p + 1] >= T && d[p + 2] >= T;

    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    const pushIfWhite = (x: number, y: number) => {
      const idx = y * w + x;
      if (seen[idx]) return;
      seen[idx] = 1;
      if (isWhite(idx * 4)) stack.push(idx);
    };
    for (let x = 0; x < w; x++) {
      pushIfWhite(x, 0);
      pushIfWhite(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      pushIfWhite(0, y);
      pushIfWhite(w - 1, y);
    }
    while (stack.length) {
      const idx = stack.pop()!;
      d[idx * 4 + 3] = 0;
      const x = idx % w;
      const y = (idx / w) | 0;
      if (x > 0) pushIfWhite(x - 1, y);
      if (x < w - 1) pushIfWhite(x + 1, y);
      if (y > 0) pushIfWhite(x, y - 1);
      if (y < h - 1) pushIfWhite(x, y + 1);
    }

    cx.putImageData(data, 0, 0);
    this.keyed.set(img, c);
    return c;
  }

  private draw = () => {
    if (!this.drawParams || !this.img) return;
    const { ctx, cssW, cssH } = this;
    const px = this.pixelSizeNow();
    const { drawWidth, drawHeight } = this.drawParams;

    const tw = Math.max(1, Math.ceil(drawWidth / px));
    const th = Math.max(1, Math.ceil(drawHeight / px));

    ctx.clearRect(0, 0, cssW, cssH);

    if (this.temp.width !== tw || this.temp.height !== th) {
      this.temp.width = tw;
      this.temp.height = th;
    }
    this.tempCtx.clearRect(0, 0, tw, th);
    this.tempCtx.drawImage(this.keyedSource(this.img), 0, 0, tw, th);

    const g = this.gridParams(px);

    const transforming = this.swapScale !== 1 || this.swapSkew !== 0;
    if (transforming) {
      const cx = this.drawParams.drawX + drawWidth / 2;
      const cy = this.drawParams.drawY + drawHeight / 2 + this.slideY;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(this.swapScale, this.swapScale);

      ctx.transform(1, 0, this.swapSkew, 1, 0, 0);
      ctx.translate(-cx, -cy);
    }

    ctx.drawImage(this.temp, 0, 0, tw, th, g.offsetX, g.offsetY, g.totalWidth, g.totalHeight);
    if (transforming) ctx.restore();

    if (this.interaction && this.hovering) this.drawInteraction();
    if (this.particles.length) {
      this.updateParticles();
      this.drawParticles();
    }
  };

  private sampleColor(px: number, cellX: number, cellY: number) {
    const { drawWidth, drawHeight } = this.drawParams!;
    const w = Math.max(1, Math.floor(drawWidth / px));
    const h = Math.max(1, Math.floor(drawHeight / px));
    if (this.temp.width !== w || this.temp.height !== h) {
      this.temp.width = w;
      this.temp.height = h;
      this.tempCtx.clearRect(0, 0, w, h);
      this.tempCtx.drawImage(this.img!, 0, 0, w, h);
    }
    const x = Math.max(0, Math.min(cellX, w - 1));
    const y = Math.max(0, Math.min(cellY, h - 1));
    const d = this.tempCtx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }

  private drawInteraction() {
    if (!this.mouse || !this.drawParams) return;
    const px = this.interactionPixelSize;
    const g = this.gridParams(px);
    const cx = Math.floor((this.mouse.x - g.offsetX) / px);
    const cy = Math.floor((this.mouse.y - g.offsetY) / px);
    const n = Math.max(0, Math.min(cx, g.blocksX - 1));
    const o = Math.max(0, Math.min(cy, g.blocksY - 1));
    const key = `${n},${o}`;
    if (this.lastCell === key) return;
    this.lastCell = key;
    this.spawnParticles(n, o, g, px);
  }

  private spawnParticles(
    cellX: number,
    cellY: number,
    g: ReturnType<PixelField["gridParams"]>,
    px: number,
  ) {
    const now = performance.now();
    const make = (gx: number, gy: number): Particle => ({
      x: g.offsetX + gx * px,
      y: g.offsetY + gy * px,
      color: this.sampleColor(px, gx, gy),
      opacity: 1,
      duration: 600 + Math.random() * 400,
      startTime: now,
      size: px,
    });
    this.particles.push(make(cellX, cellY));

    const neigh: { gx: number; gy: number }[] = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const gx = cellX + dx;
        const gy = cellY + dy;
        if ((dx || dy) && gx >= 0 && gx < g.blocksX && gy >= 0 && gy < g.blocksY)
          neigh.push({ gx, gy });
      }
    const count = Math.min(Math.floor(Math.random() * 3) + 1, neigh.length);
    neigh
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .forEach((c) => this.particles.push(make(c.gx, c.gy)));
  }

  private updateParticles() {
    const now = performance.now();
    this.particles = this.particles.filter((p) => {
      const age = now - p.startTime;
      if (age >= p.duration) return false;
      p.opacity = 1 - age / p.duration;
      return true;
    });
  }

  private drawParticles() {
    const c = this.ctx;
    for (const p of this.particles) {
      c.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.opacity})`;
      c.fillRect(p.x, p.y, p.size, p.size);
    }
  }

  private onEnter = () => {
    this.hovering = true;
  };
  private onLeave = () => {
    this.hovering = false;
    this.lastCell = null;
    this.mouse = null;
  };
  private onMove = (e: MouseEvent) => {
    if (!this.hovering) return;
    const r = this.canvas.getBoundingClientRect();
    this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  private revealIn(delay = 0) {
    const last = this.pixelSizes.length - 1;

    return gsap.timeline({ delay }).to(this, {
      idx: last,
      duration: IN_DURATION,
      ease: "power3.out",
    });
  }

  private revealOut() {

    return gsap.timeline().to(this, {
      idx: 0,
      duration: OUT_DURATION,
      ease: "power3.in",
    });
  }

  private advance() {
    this.current = (this.current + 1) % this.images.length;
    this.img = this.images[this.current];
    this.calcDrawParams();
    this.onImageChange?.(this.current);
  }

  private cycle(isFirst = false) {
    this.timeline?.kill();
    const tl = gsap.timeline({
      onComplete: () => this.cycle(),
    });
    const dist = this.cssH * 0.6;

    if (isFirst) {
      this.idx = 0;
      tl.add(this.revealIn(0));
    }

    tl.to({}, { duration: this.hold });
    tl.add(this.revealOut());

    tl.to(this, {
      slideY: -dist,
      swapScale: SWAP_SCALE_MIN,
      swapSkew: SWAP_SKEW,
      duration: SLIDE_DURATION * 0.4,
      ease: "power2.in",
      onComplete: () => {
        this.advance();
        this.idx = 0;
        this.slideY = dist;
        this.swapScale = SWAP_SCALE_MIN;
        this.swapSkew = -SWAP_SKEW;
      },
    });

    const growStart = tl.duration();
    tl.to(this, {
      slideY: 0,
      swapScale: 1,
      swapSkew: 0,
      duration: SLIDE_DURATION * 0.6,
      ease: "back.out(1.4)",
    });

    tl.add(this.revealIn(0), growStart + SLIDE_DURATION * 0.12);

    this.timeline = tl;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.timeline?.play();
    if (!this.timeline) this.cycle(true);
    const loop = () => {
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.timeline?.pause();
  }

  renderStill() {
    this.idx = this.pixelSizes.length - 1;
    this.draw();
  }

  resize() {
    this.measure();
    if (!this.running) this.draw();
  }

  destroy() {
    this.stop();
    this.timeline?.kill();
    this.timeline = null;
    this.particles = [];
    if (this.interaction) {
      this.canvas.removeEventListener("mouseenter", this.onEnter);
      this.canvas.removeEventListener("mouseleave", this.onLeave);
      this.canvas.removeEventListener("mousemove", this.onMove);
    }
    this.canvas.remove();
  }
}

