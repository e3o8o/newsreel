// Scene: image-sphere — a cloud of pictures orbiting an invisible sphere, each one turned to
// face the camera, near ones large and bright, far ones small and hazed into the background.
// props: sources[] (urls), count, radius, spin, tilt, bg, fov.
//
// The drop uses three.js. Billboarded quads on a sphere do not need a scene graph: the points
// are placed with a Fibonacci spiral, rotated by two angles, and projected by dividing by z.
// Because every quad faces the camera there is no orientation to solve, so an axis-aligned
// drawImage with a scale is exactly right, and painter's-algorithm sorting handles occlusion.

import { canvas, plate, sourceImages } from "../shared/source";

interface Point { x: number; y: number; z: number; img: CanvasImageSource; }

export default {
    async mount(host: HTMLElement, props: Record<string, unknown>) {
        const count = typeof props.count === "number" ? Math.max(8, Math.min(220, props.count)) : 84;
        const spin = typeof props.spin === "number" ? props.spin : 0.16;   // turns per second
        const tilt = typeof props.tilt === "number" ? props.tilt : 0.38;   // radians off the equator
        const bg = typeof props.bg === "string" ? props.bg : "#06070c";
        const fov = typeof props.fov === "number" ? props.fov : 900;

        const imgs = await sourceImages(props.sources, 12, (i) => plate(i * 29 + 5, 260, 340));

        const [c, ctx] = canvas(1, 1);
        Object.assign(c.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
        host.appendChild(c);

        // Fibonacci sphere: the only cheap way to scatter points evenly. Latitude bands leave
        // visible seams at the poles, which on a slow spin is all the eye looks at.
        const GOLDEN = Math.PI * (3 - Math.sqrt(5));
        const pts: Point[] = Array.from({ length: count }, (_, i) => {
            const y = 1 - (i / (count - 1)) * 2;
            const r = Math.sqrt(Math.max(0, 1 - y * y));
            const th = GOLDEN * i;
            return { x: Math.cos(th) * r, y, z: Math.sin(th) * r, img: imgs[i % imgs.length] };
        });

        let W = 0, H = 0, dpr = 1, radius = 0;
        const fit = () => {
            const b = host.getBoundingClientRect();
            dpr = Math.min(2, window.devicePixelRatio || 1);
            W = Math.max(1, b.width); H = Math.max(1, b.height);
            c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
            radius = typeof props.radius === "number" ? props.radius : Math.min(W, H) * 0.42;
        };
        fit();

        let raf = 0, drag = 0, vel = 0, held = false, lastX = 0;
        const t0 = performance.now();
        let last = t0;

        // dragging spins it and lets go with momentum, which is the drop's one interaction
        const down = (e: PointerEvent) => { held = true; lastX = e.clientX; vel = 0; };
        const move = (e: PointerEvent) => {
            if (!held) return;
            const d = (e.clientX - lastX) / 260;
            lastX = e.clientX;
            drag += d; vel = d * 60;
        };
        const up = () => { held = false; };
        c.addEventListener("pointerdown", down);
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);

        const draw = (now: number) => {
            const t = (now - t0) / 1000;
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            if (!held) { drag += vel * dt; vel *= Math.pow(0.06, dt); }

            const ang = t * spin * Math.PI * 2 + drag;
            const ca = Math.cos(ang), sa = Math.sin(ang);
            const ct = Math.cos(tilt), st = Math.sin(tilt);

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            const drawn = pts.map((p) => {
                // spin about Y, then tip about X
                const x1 = p.x * ca + p.z * sa;
                const z1 = -p.x * sa + p.z * ca;
                const y2 = p.y * ct - z1 * st;
                const z2 = p.y * st + z1 * ct;
                return { p, x: x1 * radius, y: y2 * radius, z: z2 * radius };
                // painter's algorithm. The projection divides by (fov + z), so a LARGER z is
                // further away: far ones have to be laid down first, which means descending.
            }).sort((a, b) => b.z - a.z);

            for (const d of drawn) {
                const depth = fov / (fov + d.z + radius);
                const iw = (d.p.img as HTMLCanvasElement).width || 260;
                const ih = (d.p.img as HTMLCanvasElement).height || 340;
                const w = 96 * depth, h = (ih / iw) * w;
                const x = W / 2 + d.x * depth, y = H / 2 + d.y * depth;

                // far side hazes toward the background rather than just shrinking, which is
                // what makes it read as a volume instead of a flat scatter
                const back = (d.z + radius) / (radius * 2);   // 0 at the near pole, 1 at the far one
                ctx.globalAlpha = 0.2 + (1 - back) * 0.8;
                ctx.save();
                ctx.shadowColor = "rgba(0,0,0,.45)";
                ctx.shadowBlur = 14 * depth;
                ctx.drawImage(d.p.img, x - w / 2, y - h / 2, w, h);
                ctx.restore();
            }
            ctx.globalAlpha = 1;
            raf = requestAnimationFrame(draw);
        };

        const onResize = () => fit();
        window.addEventListener("resize", onResize);

        return {
            start: () => { raf = requestAnimationFrame(draw); },
            action: async (name: string, args?: Record<string, unknown>) => {
                if (name === "spin") vel += Number(args?.by ?? 3);
            },
            destroy: () => {
                cancelAnimationFrame(raf);
                window.removeEventListener("resize", onResize);
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
                c.remove();
            },
        };
    },
};
