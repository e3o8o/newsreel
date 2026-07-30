import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mediaUrl } from "../../lib/video-sources";
import { isMuted } from "../../lib/sound";

const MODEL_URL = mediaUrl("/vault/gold-scar/scar.glb");
const SOUND_URL = mediaUrl("/vault/gold-scar/chest.mp3");

const MAGNET_EASE = 0.05;

export class GoldScar {
  private host: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;

  private pivot = new THREE.Group();
  private model: THREE.Group | null = null;
  private aura?: THREE.Mesh;
  private backGlow?: THREE.Mesh;
  private outlineMats: THREE.ShaderMaterial[] = [];
  private baseY = 0;

  private restX = 0;
  private restY = 0;
  private curX = 0;
  private curY = 0;
  private pointer = { x: 0, y: 0, inside: false };
  private smoothPointerX = 0;

  private snd: HTMLAudioElement | null = null;
  private hoverInt = 0;

  private coarse =
    typeof window !== "undefined" &&
    !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  private tapPulse = 0;

  private modelReady = false;
  private bgReady = false;
  private revealed = false;

  private raf = 0;
  private running = false;
  private disposed = false;
  private clock = new THREE.Clock();

  private ro?: ResizeObserver;
  private cleanup: (() => void)[] = [];

  constructor(host: HTMLElement) {
    this.host = host;
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    const canvas = this.renderer.domElement;
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
      cursor: "grab",
      touchAction: "pan-y",

      opacity: "0",
      transition: "opacity 450ms var(--ease-out, ease-out)",
    });
    host.appendChild(canvas);

    this.camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 6);

    this.scene.add(this.pivot);
    this.addLights();
    this.addBackGlow();
    this.addBeam();
    this.loadModel();
    this.bindEvents();
  }

  private addLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));

    const key = new THREE.DirectionalLight(0xfff4d8, 4.0);
    key.position.set(2, 3, 5);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 2.4);
    fill.position.set(0, 0, 6);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffe9a8, 1.6);
    rim.position.set(-3, 1, -2);
    this.scene.add(rim);
  }

  private addBackGlow() {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);

    g.addColorStop(0, "rgba(255,215,40,0.95)");
    g.addColorStop(0.22, "rgba(255,200,25,0.55)");
    g.addColorStop(0.5, "rgba(255,190,20,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.PlaneGeometry(2.4, 1.2);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.55,
    });
    const glow = new THREE.Mesh(geo, mat);
    glow.position.set(0.1, 0.0, -0.5);
    this.backGlow = glow;
    this.scene.add(glow);
  }

  private addBeam() {
    const geo = new THREE.PlaneGeometry(4.5, 6, 1, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1 },
        uPointer: { value: 0 },
        uCore: { value: new THREE.Color("#ffe63a") },
        uGold: { value: new THREE.Color("#ffd21e") },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uPointer;
        uniform vec3 uCore;
        uniform vec3 uGold;
        varying vec2 vUv;

        float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f*f*(3.0-2.0*f);
          float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
          return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
        }

        void main() {
          float t = uTime;
          float y = vUv.y;

          float sway = sin(t * 0.7 + y * 2.0) * 0.035 * y
                     + sin(t * 1.7 + y * 5.0) * 0.012 * y;
          float x = (vUv.x - 0.5) - sway - uPointer * 0.025 * y;

          float base = smoothstep(0.0, 0.06, y);
          float top  = 1.0 - smoothstep(0.55, 1.0, y);
          float vert = base * top;

          float widen = 1.0 + y * 0.30;
          float envelope = smoothstep(0.20 * widen, 0.0, abs(x)) * 0.4;

          float cols = 0.0;
          cols += 0.30 * exp(-pow((x + 0.12) / (0.030 * widen), 2.0));
          cols += 0.75 * exp(-pow((x + 0.05) / (0.032 * widen), 2.0));
          cols += 1.00 * exp(-pow((x - 0.01) / (0.034 * widen), 2.0));
          cols += 0.30 * exp(-pow((x - 0.08) / (0.030 * widen), 2.0));
          cols += 0.30 * exp(-pow((x - 0.15) / (0.028 * widen), 2.0));

          float flow = noise(vec2(x * 6.0, y * 5.0 - t * 1.1));
          float flicker = 0.74 + 0.26 * flow;
          float pulse = 0.9 + 0.1 * sin(t * 1.3);

          float r1 = sin((fract(y - t * 0.28) ) * 3.14159);
          float r2 = sin((fract(y - t * 0.16 + 0.5)) * 3.14159);
          float risers = (pow(max(r1,0.0), 6.0) + pow(max(r2,0.0), 6.0) * 0.7) * 0.35;

          float core = cols;
          float beam = (cols + envelope) * vert * flicker * pulse;
          beam += risers * cols * vert;

          float pool = smoothstep(0.30, 0.0, length(vec2(x * 1.6, y - 0.02))) * (1.0 - smoothstep(0.0, 0.28, y));
          beam += pool * 0.5;

          beam *= uIntensity * 0.6;

          vec3 col = mix(uGold, uCore, clamp(core, 0.0, 1.0));
          float a = clamp(beam, 0.0, 1.0);
          gl_FragColor = vec4(col * beam, a);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.FrontSide,
    });
    this.aura = new THREE.Mesh(geo, mat);

    this.aura.position.set(0.1, 3.0, -1.5);
    this.aura.renderOrder = 0;
    this.scene.add(this.aura);
  }

  private loadModel() {
    const loader = new GLTFLoader();
    loader.setCrossOrigin("anonymous");
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (this.disposed) return;
        const model = gltf.scene;

        const meshes: THREE.Mesh[] = [];
        model.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
        });

        const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
        for (const mesh of meshes) {
          const skinned = mesh as THREE.SkinnedMesh;
          const outlineGeo = toCreasedNormals(mesh.geometry, Math.PI / 3);
          const isSkinned = !!skinned.isSkinnedMesh && !!skinned.skeleton;
          const mat = this.makeOutlineMaterial(size, isSkinned);
          let outline: THREE.Mesh;
          if (isSkinned) {
            const so = new THREE.SkinnedMesh(outlineGeo, mat);
            so.bind(skinned.skeleton, skinned.bindMatrix);
            outline = so;
          } else {
            outline = new THREE.Mesh(outlineGeo, mat);
          }
          outline.renderOrder = -1;
          mesh.add(outline);
          this.outlineMats.push(mat);
        }

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size3 = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size3.x, size3.y, size3.z) || 1;
        model.position.sub(center);
        const inner = new THREE.Group();
        inner.add(model);
        const s = 1.55 / maxDim;
        inner.scale.setScalar(s);
        this.pivot.add(inner);
        this.model = model;

        this.pivot.position.set(0.1, 0.08, 0);
        this.baseY = this.pivot.position.y;
        this.restY = this.curY = 4.37;
        this.restX = this.curX = 0.147;
        this.modelReady = true;
        this.maybeReveal();
      },
      undefined,
      () => {

        this.modelReady = true;
        this.maybeReveal();
      },
    );
  }

  markBackdropReady() {
    this.bgReady = true;
    this.maybeReveal();
  }

  private maybeReveal() {
    if (this.revealed || this.disposed) return;
    if (!this.modelReady || !this.bgReady) return;
    this.revealed = true;
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(() => {
      this.renderer.domElement.style.opacity = "1";
    });
  }

  private makeOutlineMaterial(size: THREE.Vector2, skinned: boolean): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color("#ffef7a") },
        uThickness: { value: 4.0 },
        uSize: { value: size.clone() },
      },
      vertexShader: `
        #include <common>
        #include <skinning_pars_vertex>
        uniform float uThickness;
        uniform vec2 uSize;
        void main() {
          #include <beginnormal_vertex>
          #include <skinbase_vertex>
          #include <skinnormal_vertex>
          #include <begin_vertex>
          #include <skinning_vertex>
          #include <project_vertex>

          vec4 clipN = projectionMatrix * modelViewMatrix * vec4(objectNormal, 0.0);
          vec2 offset = normalize(clipN.xy) * uThickness / uSize * gl_Position.w * 2.0;
          gl_Position.xy += offset;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        void main() { gl_FragColor = vec4(uColor, 1.0); }`,
      side: THREE.BackSide,
      defines: skinned ? { USE_SKINNING: "" } : {},
    });
  }

  private bindEvents() {
    const host = this.host;

    const onMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      this.pointer.inside = true;
    };
    const onLeave = () => {
      this.pointer.inside = false;
    };

    const onTap = () => {
      if (this.coarse) this.tapPulse = 1;
    };

    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointerdown", onTap);
    this.cleanup.push(() => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onTap);
    });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
  }

  private resize() {
    if (this.disposed) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    for (const m of this.outlineMats) m.uniforms.uSize.value.copy(size);
  }

  private initSound() {
    if (this.snd) return;
    this.snd = new Audio(SOUND_URL);
    this.snd.loop = true;
    this.snd.volume = 0;
    this.snd.crossOrigin = "anonymous";
  }

  private updateSound() {
    if (!this.snd) return;

    const peak = this.coarse ? 0.4 : 0.9;
    const target = isMuted() ? 0 : this.hoverInt * peak;
    this.snd.volume += (target - this.snd.volume) * 0.08;
    if (target > 0.01 && this.snd.paused) this.snd.play().catch(() => {});
    if (this.snd.volume < 0.01 && !this.snd.paused) this.snd.pause();
  }

  start() {
    if (this.running || this.disposed) return;
    this.initSound();
    this.running = true;
    this.clock.getDelta();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.snd && !this.snd.paused) this.snd.pause();
  }

  private loop = () => {
    if (!this.running) return;
    const t = this.clock.getElapsedTime();

    const PULL = 0.40;
    const leanY = this.pointer.inside ? this.pointer.x * PULL : 0;
    const leanX = this.pointer.inside ? -this.pointer.y * PULL * 0.6 : 0;
    this.curY += (this.restY + leanY - this.curY) * MAGNET_EASE;
    this.curX += (this.restX + leanX - this.curX) * MAGNET_EASE;
    this.pivot.rotation.x = this.curX;
    this.pivot.rotation.y = this.curY;
    this.pivot.position.y = this.baseY + Math.sin(t * 0.9) * 0.022;

    let want = 0;
    if (this.coarse) {
      this.tapPulse *= 0.985;
      if (this.tapPulse < 0.001) this.tapPulse = 0;
      want = this.tapPulse;
    } else if (this.pointer.inside) {
      const dist = Math.hypot(this.pointer.x, this.pointer.y);
      want = Math.max(0.25, 1 - dist * 0.7);
    }
    this.hoverInt += (want - this.hoverInt) * 0.05;

    const pTargetX = this.pointer.inside ? this.pointer.x : 0;
    this.smoothPointerX += (pTargetX - this.smoothPointerX) * 0.07;

    if (this.aura) {
      const u = (this.aura.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = t;
      u.uIntensity.value = 1.0 + this.hoverInt * 0.35 + Math.sin(t * 0.8) * 0.05;
      u.uPointer.value = this.smoothPointerX;
    }

    if (this.backGlow) {
      const m = this.backGlow.material as THREE.MeshBasicMaterial;
      m.opacity = 0.5 + Math.sin(t * 1.1) * 0.05 + this.hoverInt * 0.14;
      const breathe = 1.0 + Math.sin(t * 0.9) * 0.02;
      const sx = breathe + this.smoothPointerX * 0.06;
      const sy = breathe - this.smoothPointerX * 0.04;
      this.backGlow.scale.set(sx, sy, 1);
    }

    this.updateSound();

    if (this.revealed) this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  };

  renderStill() {
    if (!this.revealed) return;
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.disposed = true;
    this.stop();
    this.cleanup.forEach((fn) => fn());
    this.ro?.disconnect();
    if (this.snd) {
      this.snd.pause();
      this.snd.src = "";
      this.snd = null;
    }
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose?.();
        const m = mesh.material as THREE.Material | THREE.Material[];
        Array.isArray(m) ? m.forEach((x) => x.dispose()) : m?.dispose?.();
      }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    const canvas = this.renderer.domElement;
    canvas.parentNode?.removeChild(canvas);
  }
}

