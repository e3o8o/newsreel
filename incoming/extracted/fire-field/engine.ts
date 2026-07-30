import { isMuted } from "../../lib/sound";

const N = 16;
const FRAMES = 32;
const FPS = 18;

const BURN_RADIUS = 2.8;
const HEAL_RATE = 6.0;
const SWAY_MAX = 2.0;

const FIRE_FRAC = 0.6;

function decodeSheet(img: HTMLImageElement): ImageData[] {
  const c = document.createElement("canvas");
  c.width = N;
  c.height = N * FRAMES;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const out: ImageData[] = [];
  for (let f = 0; f < FRAMES; f++) out.push(ctx.getImageData(0, f * N, N, N));
  return out;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export type FireFieldOptions = {

  reduced?: boolean;
};

export class FireField {
  private stage: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private reduced: boolean;

  private fireSnd: HTMLAudioElement | null = null;
  private fizzSnd: HTMLAudioElement | null = null;
  private fireWanted = false;
  private lastFizz = 0;

  private off: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private buf: ImageData;

  private grid = new Float32Array(N * N * 4);
  private scratch = new Float32Array(N * N * 4);

  private dist = new Float32Array(N * N);
  private primed = false;

  private swayX = 0;
  private swayTarget = 0;

  private vel = { x: 0, y: 0 };
  private blobPhase = 0;

  private frames: ImageData[] | null = null;
  private netherrack: HTMLImageElement | null = null;

  private box = { x: 0, y: 0, size: 0, dpr: 1 };

  private pcell: { x: number; y: number } | null = null;
  private prevP: { x: number; y: number } | null = null;

  private hovering = false;

  private raf = 0;

  private wantRun = false;
  private last = 0;
  private acc = 0;
  private dead = false;

  constructor(stage: HTMLElement, opts: FireFieldOptions = {}) {
    this.stage = stage;
    this.reduced = !!opts.reduced;

    this.canvas = document.createElement("canvas");
    this.canvas.style.imageRendering = "pixelated";
    this.canvas.className = "pointer-events-none absolute inset-0 block h-full w-full";
    this.ctx = this.canvas.getContext("2d")!;
    this.stage.appendChild(this.canvas);

    try {
      this.fireSnd = new Audio("/vault/fire/fire.ogg");
      this.fireSnd.loop = true;
      this.fireSnd.volume = 0;
      this.fizzSnd = new Audio("/vault/fire/fizz.ogg");
      this.fizzSnd.volume = 0.18;
    } catch {}

    this.off = document.createElement("canvas");
    this.off.width = N;
    this.off.height = N;
    this.offCtx = this.off.getContext("2d")!;
    this.buf = this.offCtx.createImageData(N, N);

    this.resize();

    window.addEventListener("pointermove", this.onMove, { passive: true });
    this.stage.addEventListener("pointerenter", this.onEnter);
    this.stage.addEventListener("pointerleave", this.onCardLeave);
    this.stage.addEventListener("pointerdown", this.onTap, { passive: true });

    loadImage("/vault/fire/netterack.png")
      .then((img) => {
        if (!this.dead) this.netherrack = img;
      })
      .catch(() => {});
    loadImage("/vault/fire/fire_sheet.png")
      .then((img) => {
        if (this.dead) return;
        this.frames = decodeSheet(img);
        if (this.reduced) {
          this.acc = 16;
          this.grid.set(this.frames[16].data);
          this.primed = true;
          this.render();
          return;
        }

        this.kick();
      })
      .catch((e) => console.warn("fire texture:", e));
  }

  private stepAudio = (ms: number) => {
    if (!this.fireSnd) return;
    const target = this.fireWanted && !isMuted() ? 1.0 : 0;

    this.fireSnd.volume += (target - this.fireSnd.volume) * 0.08;
    if (target > 0 && this.fireSnd.paused) this.fireSnd.play().catch(() => {});
    if (this.fireSnd.volume < 0.01 && !this.fireSnd.paused) this.fireSnd.pause();
    void ms;
  };

  private playFizz(ms: number) {
    if (!this.fizzSnd || isMuted()) return;
    if (ms - this.lastFizz < 350) return;
    this.lastFizz = ms;
    try {
      this.fizzSnd.currentTime = 0;
      this.fizzSnd.play().catch(() => {});
    } catch {}
  }

  resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = this.stage.clientWidth;
    const ch = Math.max(1, this.stage.clientHeight);
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    const size = Math.min(cw, ch) * FIRE_FRAC;
    this.box.size = size;
    this.box.x = (cw - size) / 2;
    this.box.y = (ch - size) / 2 - ch * 0.08;
    this.box.dpr = dpr;
    this.ctx.imageSmoothingEnabled = false;
  };

  private onMove = (e: PointerEvent) => {
    const r = this.stage.getBoundingClientRect();
    const px = e.clientX - r.left - this.box.x;
    const py = e.clientY - r.top - this.box.y;
    if (px < 0 || py < 0 || px > this.box.size || py > this.box.size) {
      this.pcell = null;
      return;
    }
    this.pcell = { x: (px / this.box.size) * N, y: (py / this.box.size) * N };
  };
  private onEnter = () => {
    this.hovering = true;
  };
  private onCardLeave = () => {
    this.hovering = false;
    this.pcell = null;
  };

  private idx = (x: number, y: number) => y * N + x;

  private blowAll(ms: number) {
    for (let i = 0; i < N * N; i++) {
      const p = i * 4;
      if (this.grid[p + 3] > 127) {
        this.grid[p] = this.grid[p + 1] = this.grid[p + 2] = this.grid[p + 3] = 0;
        this.dist[i] = 1;
      }
    }
    this.playFizz(ms);
  }

  private onTap = () => {
    this.blowAll(performance.now());
  };

  private stepFire(dt: number, ms: number, src: Uint8ClampedArray) {
    const { grid, scratch, dist } = this;
    this.blobPhase += dt;

    if (!this.primed) {
      grid.set(src);
      this.primed = true;
    }

    if (this.pcell && this.prevP) {
      this.vel.x += ((this.pcell.x - this.prevP.x) / Math.max(dt, 0.001) - this.vel.x) * 0.3;
      this.vel.y += ((this.pcell.y - this.prevP.y) / Math.max(dt, 0.001) - this.vel.y) * 0.3;
    } else {
      this.vel.x *= 0.8;
      this.vel.y *= 0.8;
    }
    this.prevP = this.pcell ? { x: this.pcell.x, y: this.pcell.y } : null;

    this.swayTarget = this.pcell ? ((this.pcell.x - N / 2) / (N / 2)) * SWAY_MAX : 0;
    this.swayX += (this.swayTarget - this.swayX) * Math.min(1, dt * 6);
    this.fireWanted = this.hovering;

    const distDecay = Math.min(1, HEAL_RATE * dt);
    for (let i = 0; i < N * N; i++) {
      const p = i * 4;
      const srcLit = src[p + 3] > 127;
      const d = dist[i];

      if (d < 0.02) {

        if (srcLit) {
          grid[p] = src[p];
          grid[p + 1] = src[p + 1];
          grid[p + 2] = src[p + 2];
          grid[p + 3] = 255;
        } else {
          grid[p] = grid[p + 1] = grid[p + 2] = grid[p + 3] = 0;
        }
        continue;
      }

      const lit = grid[p + 3] > 127;
      if (!lit && srcLit) {
        if (Math.random() < distDecay * 0.6) {
          grid[p] = src[p];
          grid[p + 1] = src[p + 1];
          grid[p + 2] = src[p + 2];
          grid[p + 3] = 255;
          dist[i] = 0;
          continue;
        }
      } else if (lit && !srcLit) {

        grid[p] = grid[p + 1] = grid[p + 2] = grid[p + 3] = 0;
      }
      dist[i] = d * (1 - distDecay);
    }

    let snuffedNow = 0;
    if (this.pcell) {
      const cx = this.pcell.x;
      const cy = this.pcell.y;
      const r = BURN_RADIUS;

      const speed = Math.hypot(this.vel.x, this.vel.y);
      const inv = speed > 0.001 ? 1 / speed : 0;
      const pushX = this.vel.x * inv;
      const pushY = this.vel.y * inv - 0.8;
      const pl = Math.hypot(pushX, pushY) || 1;
      const ux = pushX / pl;
      const uy = pushY / pl;

      const reach = r + 1.2;
      const x0 = Math.max(0, Math.floor(cx - reach));
      const x1 = Math.min(N - 1, Math.ceil(cx + reach));
      const y0 = Math.max(0, Math.floor(cy - reach));
      const y1 = Math.min(N - 1, Math.ceil(cy + reach));

      scratch.set(grid);

      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const d = Math.hypot(dx, dy);
          if (d > r) continue;
          const i = this.idx(x, y);
          const p = i * 4;
          const fall = 1 - d / r;

          if (grid[p + 3] < 40) continue;

          const moveBy = 1 + Math.round(fall * 3);
          const tx = Math.min(N - 1, Math.max(0, x + Math.round(ux * moveBy)));
          const ty = Math.min(N - 1, Math.max(0, y + Math.round(uy * moveBy)));
          const tp = this.idx(tx, ty) * 4;

          let rr = grid[p];
          let gg = grid[p + 1];
          let bb = grid[p + 2];
          const heat = fall;
          rr = rr + (255 - rr) * heat * 0.6;
          gg = gg + (245 - gg) * heat * 0.45;
          bb = bb + (190 - bb) * heat * 0.3;

          if (rr + gg + bb >= scratch[tp] + scratch[tp + 1] + scratch[tp + 2]) {
            scratch[tp] = rr;
            scratch[tp + 1] = gg;
            scratch[tp + 2] = bb;
          }
          scratch[tp + 3] = 255;
          dist[this.idx(tx, ty)] = 1;

          if (fall > 0.12) {
            scratch[p] = 0;
            scratch[p + 1] = 0;
            scratch[p + 2] = 0;
            scratch[p + 3] = 0;
            dist[i] = 1;
            snuffedNow++;
          }
        }
      }
      grid.set(scratch);
    }

    if (snuffedNow >= 3) this.playFizz(ms);
  }

  private render() {
    if (!this.frames) return;
    const { ctx, canvas, box, off } = this;
    const out = this.buf.data;
    for (let y = 0; y < N; y++) {

      const leanFrac = 1 - y / (N - 1);
      const shift = Math.round(this.swayX * leanFrac);
      for (let x = 0; x < N; x++) {
        const p = this.idx(x, y) * 4;
        const sx = Math.min(N - 1, Math.max(0, x - shift));
        const gp = this.idx(sx, y) * 4;

        out[p] = this.grid[gp];
        out[p + 1] = this.grid[gp + 1];
        out[p + 2] = this.grid[gp + 2];
        out[p + 3] = this.grid[gp + 3];
      }
    }
    this.offCtx.putImageData(this.buf, 0, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const d = box.dpr;

    if (this.netherrack) {
      const bw = box.size;
      const bx = box.x;
      const by = box.y + box.size;
      ctx.drawImage(this.netherrack, bx * d, by * d, bw * d, bw * d);
    }

    ctx.drawImage(off, box.x * d, box.y * d, box.size * d, box.size * d);
  }

  private frame = (ms: number) => {
    this.raf = 0;
    const dt = this.last ? Math.min(0.05, (ms - this.last) / 1000) : 0.016;
    this.last = ms;
    this.acc = (this.acc + dt * FPS) % FRAMES;
    const f = Math.floor(this.acc) % FRAMES;
    this.stepFire(dt, ms, this.frames![f].data);
    this.stepAudio(ms);
    this.render();
    if (this.wantRun) this.raf = requestAnimationFrame(this.frame);
  };

  private kick() {
    if (!this.raf && this.wantRun && this.frames) {
      this.last = 0;
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  start() {
    if (this.reduced) return;
    this.wantRun = true;
    this.kick();
  }

  stop() {
    this.wantRun = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.fireSnd && !this.fireSnd.paused) this.fireSnd.pause();
  }

  destroy() {
    this.dead = true;
    this.stop();
    window.removeEventListener("pointermove", this.onMove);
    this.stage.removeEventListener("pointerenter", this.onEnter);
    this.stage.removeEventListener("pointerleave", this.onCardLeave);
    this.stage.removeEventListener("pointerdown", this.onTap);
    if (this.fireSnd) this.fireSnd.src = "";
    if (this.fizzSnd) this.fizzSnd.src = "";
    this.canvas.remove();
  }
}

