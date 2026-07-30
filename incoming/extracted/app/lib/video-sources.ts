// A Vault clip is encoded into three formats (see scripts/optimize-video.sh):
// AV1/WebM (smallest, modern browsers), VP9/WebM (Chrome/Firefox/Edge), and an
// H.264/MP4 universal fallback. Given the base path (no extension), build the
// <source> list in best-to-worst order so the browser picks the first format it
// can play and downloads only that one.
//
// Videos are served from Cloudflare R2 (zero egress) instead of Vercel's edge, so
// a viral spike doesn't burn Vercel bandwidth/edge requests. Defaults to the R2
// public bucket URL so prod uses R2 with no env config; override with
// NEXT_PUBLIC_MEDIA_BASE if the bucket URL changes, or set it to "" to serve from
// same-origin /public (useful for local dev without network).
const R2_MEDIA_BASE = "https://pub-58a0dfd4417141169bd84ab545cd7830.r2.dev";

// Public media base (no trailing slash). Empty string = serve from /public.
export const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE ?? R2_MEDIA_BASE).replace(/\/$/, "");

// The origin (scheme + host) media is served from, or "" when serving same-origin
// from /public. Used to preconnect the CDN early so the first video isn't stalled
// on DNS+TLS. Derived from MEDIA_BASE so it stays in sync automatically.
export const MEDIA_ORIGIN = (() => {
  if (!MEDIA_BASE) return "";
  try {
    return new URL(MEDIA_BASE).origin;
  } catch {
    return "";
  }
})();

// Resolve a /public-relative media path to its served URL (R2 in prod, local in dev).
// Pass a leading-slash path like "/vault/amo.mp4".
export function mediaUrl(path: string): string {
  return MEDIA_BASE ? `${MEDIA_BASE}${path}` : path;
}

export interface VideoSource {
  src: string;
  type: string;
}

export function videoSources(base: string): VideoSource[] {
  return [
    { src: mediaUrl(`${base}.av1.webm`), type: 'video/webm; codecs="av01.0.05M.08"' },
    { src: mediaUrl(`${base}.vp9.webm`), type: 'video/webm; codecs="vp9"' },
    { src: mediaUrl(`${base}.mp4`), type: "video/mp4" },
  ];
}

