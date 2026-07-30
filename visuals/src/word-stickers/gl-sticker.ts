// The drop imports a WebGL sticker renderer that is not included in it. The engine already
// carries a complete DOM/canvas path and picks it whenever `available` is false, so this
// stub is all that stands between the drop and running: no peel shader, everything else
// (render, drag, throw, bounce) is the original.
export class StickerGL {
    readonly canvas: HTMLCanvasElement = document.createElement("canvas");
    readonly available = false;
    resize(_w: number, _h: number, _dpr: number) {}
    makeTexture(_c: HTMLCanvasElement, _w: number, _h: number) { return { tex: null as unknown as WebGLTexture }; }
    beginFrame() {}
    drawSticker(_o: Record<string, unknown>) {}
    destroy() {}
}
