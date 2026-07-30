// Scene: ghost-reveal — a feathered mask slides across an element so it materialises out of
// nothing instead of fading in as a whole.
// props: text, sub, direction (left|right|up|down), loop, accent, bg, feather.
//
// The mask is the whole trick. A plain opacity fade moves every pixel together and reads as a
// dissolve; a long soft ramp travelling across the box means the leading edge is already solid
// while the tail is still transparent, so the thing looks like it is arriving.
//
// The drop uses ramp PNGs. A CSS gradient does the same job with an exactly known profile,
// which matters: the mask is three box-widths long, so at one end the box sits entirely on the
// opaque third (fully shown) and at the other entirely on the transparent third (fully gone).
// A PNG whose ramp did not run edge to edge would leave the reveal stuck half-finished.

import { SANS, MONO } from "../shared/source";

type Dir = "left" | "right" | "up" | "down";

const ramp = (deg: number, feather: number) =>
    `linear-gradient(${deg}deg, #000 0%, #000 ${33.3 - feather}%, ` +
    `rgba(0,0,0,0) ${33.3 + feather}%, rgba(0,0,0,0) 100%)`;

const SETUP = (feather: number): Record<Dir, { img: string; size: string; hidden: string; shown: string }> => ({
    right: { img: ramp(90, feather), size: "300% 100%", hidden: "100% 0", shown: "0% 0" },
    left: { img: ramp(270, feather), size: "300% 100%", hidden: "0% 0", shown: "100% 0" },
    down: { img: ramp(180, feather), size: "100% 300%", hidden: "0 100%", shown: "0 0" },
    up: { img: ramp(0, feather), size: "100% 300%", hidden: "0 0", shown: "0 100%" },
});

export default {
    async mount(host: HTMLElement, props: Record<string, unknown>) {
        const text = typeof props.text === "string" ? props.text : "materialise";
        const sub = typeof props.sub === "string" ? props.sub : "a feathered mask, not a fade";
        const dir: Dir = (["left", "right", "up", "down"] as const).includes(props.direction as Dir)
            ? (props.direction as Dir) : "right";
        const accent = typeof props.accent === "string" ? props.accent : "#7c3aed";
        // how much of the travel is soft edge: 0 is a hard wipe, 16 is a long ghost
        const feather = typeof props.feather === "number" ? Math.min(32, Math.max(0, props.feather)) : 14;
        const loop = props.loop !== false;
        const s = SETUP(feather)[dir];

        const stage = document.createElement("div");
        Object.assign(stage.style, {
            position: "absolute", inset: "0", display: "grid", placeItems: "center",
            background: typeof props.bg === "string" ? props.bg : "#0b0d12",
            fontFamily: SANS, color: "#fff",
        });
        host.appendChild(stage);

        const panel = document.createElement("div");
        Object.assign(panel.style, {
            display: "flex", flexDirection: "column", alignItems: "center", gap: "18px",
            padding: "56px 72px", borderRadius: "20px",
            background: "linear-gradient(140deg, rgba(255,255,255,.10), rgba(255,255,255,.03))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.14)",
            maskImage: s.img, WebkitMaskImage: s.img,
            maskSize: s.size, WebkitMaskSize: s.size,
            maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
            maskPosition: s.hidden, WebkitMaskPosition: s.hidden,
            transition: "mask-position 1500ms cubic-bezier(.4,0,.1,1), " +
                "-webkit-mask-position 1500ms cubic-bezier(.4,0,.1,1)",
        });
        panel.innerHTML =
            `<div style="font:600 74px/1 ${SANS};letter-spacing:-.045em">${text}</div>` +
            `<div style="font:500 13px/1 ${MONO};letter-spacing:.16em;text-transform:uppercase;color:${accent}">${sub}</div>`;
        stage.appendChild(panel);

        const setPos = (v: string) => {
            panel.style.maskPosition = v;
            panel.style.setProperty("-webkit-mask-position", v);
        };

        let timer = 0, shown = false;
        const flip = () => { shown = !shown; setPos(shown ? s.shown : s.hidden); };

        return {
            start: () => {
                // two frames of settle, so the transition has a start value to run from
                requestAnimationFrame(() => requestAnimationFrame(flip));
                if (loop) timer = window.setInterval(flip, 2800);
            },
            action: async (name: string) => {
                if (name === "reveal" || name === "toggle") flip();
            },
            destroy: () => { clearInterval(timer); stage.remove(); },
        };
    },
};
