'use strict';
// Render the title card, the closing card, and one transparent lower-third per shot as PNGs.
//
// ⚠️ All text is rendered from HTML via Playwright, never with ffmpeg drawtext: many ffmpeg
//    builds ship without the drawtext filter (the reference build did), and debugging that at
//    assembly time is miserable. Chromium is already a dependency of the capture step.
//
// Config keys: project, video.title, capture.viewport, style.accent, style.theme,
//              output.workDir, shots[] (id, caption, tag?), closingCard.title, closingCard.lines[]

const path = require('path');
const { chromium } = require('../deps.cjs');
const { palette, backgroundCss, initRandom } = require('../style.cjs');
const { styleForKind } = require('../kinds.cjs');
const { ensureDir } = require('../util.cjs');

// ⚠️ Every config-supplied string goes through here before it reaches the HTML. Without it a
//    caption containing a literal `<` or `&` silently vanishes or breaks the card: `A < B`
//    parses as an unknown tag, `&amp;` renders as `&`. Config strings are prose, not markup.
//    The cost is that captions can no longer carry deliberate markup; use style.accent and
//    the card layout for emphasis instead.
const escapeHtml = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;')     // must run first, or it double-escapes the entities below
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const base = (W, H) => `
  * { margin:0; padding:0; box-sizing:border-box; font-family:-apple-system,'Helvetica Neue',Arial,sans-serif; }
  .frame { width:${W}px; height:${H}px; position:relative; overflow:hidden; }
`;

// TITLE CARDS. One layout for every video is why every thumbnail looked like the last one,
// whatever the video was actually for. There are four here, each a different composition and
// type treatment, and a kind picks the one that suits it (an ad wants a full-bleed shout, a
// report wants a calm panel). video.card overrides; "random" rolls one.
//
// They all take the same content and the same palette, so switching layout is one word in the
// config and never a rewrite.

const LAYOUTS = ['panel', 'edge', 'split', 'stack'];

// The layout a kind reaches for by default.
const LAYOUT_FOR_KIND = {
    report: 'panel',
    demo: 'split',
    ad: 'edge',
    launch: 'stack',
};

function pickLayout(want, kind) {
    const w = String(want || '').trim().toLowerCase();
    if (LAYOUTS.includes(w)) return w;
    if (w === 'random') return LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
    return LAYOUT_FOR_KIND[String(kind || '').toLowerCase()] || 'panel';
}

// 1. PANEL — the calm one: dark panel floating on the gradient, kicker over a headline.
function layoutPanel(p, W, H, { kicker, title, lines, big }, style) {
    const pad = Math.max(0, Number(style.padding) || 64);
    const radius = Math.max(0, Number(style.radius) || 16);
    const shadow = Number(style.shadow) === 0 ? 0 : (Number(style.shadow) || 0.35);
    return `<style>${base(W, H)}
      .bg{width:${W}px; height:${H}px; background:${backgroundCss(style)};}
      .panel{position:absolute; left:${pad}px; top:${pad}px; right:${pad}px; bottom:${pad}px;
             background:${p.cardBg}; color:${p.fg}; border-radius:${radius}px;
             box-shadow:0 24px 64px rgba(0,0,0,${shadow});
             display:flex; flex-direction:column; justify-content:center; padding:0 ${Math.round(W * 0.08)}px;}
      .kick{color:${p.accent}; font-size:26px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; margin-bottom:26px;}
      .title{font-size:${big ? 72 : 58}px; font-weight:700; line-height:1.1; letter-spacing:-.02em;}
      .lines{margin-top:40px; display:flex; flex-direction:column; gap:18px;}
      .line{font-size:30px; color:${p.muted}; line-height:1.4; display:flex; align-items:center; gap:16px;}
      .dot{color:${p.accent}; font-size:22px;}
    </style>
    <div class="frame bg">
      <div class="panel">
        ${kicker ? `<div class="kick">${escapeHtml(kicker)}</div>` : ''}
        <div class="title">${escapeHtml(title)}</div>
        ${lines.length ? `<div class="lines">${lines.map((l) => `<div class="line"><span class="dot">&#9656;</span><span>${escapeHtml(l)}</span></div>`).join('')}</div>` : ''}
      </div>
    </div>`;
}

// 2. EDGE — no panel at all: the gradient IS the card, an oversized headline sits on the
//    bottom-left over a scrim, with a rule in the accent. The loud one.
function layoutEdge(p, W, H, { kicker, title, lines }, style) {
    const pad = Math.round(W * 0.075);
    return `<style>${base(W, H)}
      .bg{width:${W}px; height:${H}px; background:${backgroundCss(style)}; position:relative;}
      .scrim{position:absolute; inset:0; background:linear-gradient(0deg, rgba(6,8,12,.86) 0%, rgba(6,8,12,.36) 46%, rgba(6,8,12,0) 74%);}
      .body{position:absolute; left:${pad}px; right:${pad}px; bottom:${Math.round(H * 0.11)}px; color:#fff;}
      .rule{width:96px; height:6px; border-radius:3px; background:${p.accent}; margin-bottom:30px;}
      .kick{font-size:24px; font-weight:600; letter-spacing:.2em; text-transform:uppercase; color:${p.accent}; margin-bottom:18px;}
      .title{font-size:${Math.round(W * 0.062)}px; font-weight:800; line-height:1.02; letter-spacing:-.035em; max-width:${Math.round(W * 0.8)}px;}
      .lines{margin-top:26px; display:flex; flex-wrap:wrap; gap:10px 26px;}
      .line{font-size:25px; color:rgba(255,255,255,.82);}
    </style>
    <div class="frame bg">
      <div class="scrim"></div>
      <div class="body">
        <div class="rule"></div>
        ${kicker ? `<div class="kick">${escapeHtml(kicker)}</div>` : ''}
        <div class="title">${escapeHtml(title)}</div>
        ${lines.length ? `<div class="lines">${lines.map((l) => `<div class="line">${escapeHtml(l)}</div>`).join('')}</div>` : ''}
      </div>
    </div>`;
}

// 3. SPLIT — two columns: the headline on a dark field, the contents listed on an accent
//    slab beside it. The one that carries information.
function layoutSplit(p, W, H, { kicker, title, lines }, style) {
    const pad = Math.round(W * 0.06);
    return `<style>${base(W, H)}
      .bg{width:${W}px; height:${H}px; background:${backgroundCss(style)}; display:flex; align-items:stretch; padding:${pad}px; gap:${Math.round(pad * 0.6)}px;}
      .left{flex:1.35; background:${p.cardBg}; color:${p.fg}; border-radius:18px; padding:${Math.round(pad * 0.9)}px;
            display:flex; flex-direction:column; justify-content:center; box-shadow:0 24px 64px rgba(0,0,0,.34);}
      .kick{font-size:22px; font-weight:600; letter-spacing:.18em; text-transform:uppercase; color:${p.accent}; margin-bottom:22px;}
      .title{font-size:${Math.round(W * 0.042)}px; font-weight:700; line-height:1.08; letter-spacing:-.03em;}
      .right{flex:1; background:${p.accent}; border-radius:18px; padding:${Math.round(pad * 0.8)}px;
             display:flex; flex-direction:column; justify-content:center; gap:16px; box-shadow:0 24px 64px rgba(0,0,0,.28);}
      .item{font-size:26px; font-weight:600; color:#0b0d12; line-height:1.3; display:flex; gap:12px;}
      .n{opacity:.55; font-variant-numeric:tabular-nums;}
    </style>
    <div class="frame bg">
      <div class="left">
        ${kicker ? `<div class="kick">${escapeHtml(kicker)}</div>` : ''}
        <div class="title">${escapeHtml(title)}</div>
      </div>
      ${lines.length ? `<div class="right">${lines.map((l, i) => `<div class="item"><span class="n">${String(i + 1).padStart(2, '0')}</span><span>${escapeHtml(l)}</span></div>`).join('')}</div>` : ''}
    </div>`;
}

// 4. STACK — centred and quiet: a mono kicker, one very large line, a hairline, the contents
//    small underneath. The premium one.
function layoutStack(p, W, H, { kicker, title, lines }, style) {
    return `<style>${base(W, H)}
      .bg{width:${W}px; height:${H}px; background:${backgroundCss(style)}; position:relative;}
      .veil{position:absolute; inset:0; background:radial-gradient(120% 90% at 50% 46%, rgba(6,8,12,.34) 0%, rgba(6,8,12,.88) 72%);}
      .body{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
            text-align:center; padding:0 ${Math.round(W * 0.1)}px; color:#fff;}
      .kick{font-family:ui-monospace,'SF Mono',Menlo,monospace; font-size:21px; letter-spacing:.32em;
            text-transform:uppercase; color:${p.accent}; margin-bottom:34px;}
      .title{font-size:${Math.round(W * 0.056)}px; font-weight:700; line-height:1.05; letter-spacing:-.035em;}
      .hr{width:120px; height:1px; background:rgba(255,255,255,.28); margin:36px 0 26px;}
      .lines{display:flex; flex-wrap:wrap; justify-content:center; gap:8px 22px;}
      .line{font-family:ui-monospace,'SF Mono',Menlo,monospace; font-size:20px; color:rgba(255,255,255,.66);}
    </style>
    <div class="frame bg">
      <div class="veil"></div>
      <div class="body">
        ${kicker ? `<div class="kick">${escapeHtml(kicker)}</div>` : ''}
        <div class="title">${escapeHtml(title)}</div>
        ${lines.length ? `<div class="hr"></div><div class="lines">${lines.map((l) => `<div class="line">${escapeHtml(l)}</div>`).join('')}</div>` : ''}
      </div>
    </div>`;
}

const RENDERERS = { panel: layoutPanel, edge: layoutEdge, split: layoutSplit, stack: layoutStack };

function card(p, W, H, content, style = {}, layout = 'panel') {
    const render = RENDERERS[layout] || layoutPanel;
    return render(p, W, H, { lines: [], ...content }, style);
}

// Transparent full-frame carrying only a lower-third caption bar, overlaid on a clip later.
function lower(p, W, H, { tag, text }) {
    return `<style>${base(W, H)}
      body{background:transparent;}
      .lt{position:absolute; left:60px; right:60px; bottom:56px; display:flex; align-items:center; gap:22px;
          background:${p.barBg}; border:1px solid ${p.accent}59; border-left:5px solid ${p.accent};
          border-radius:14px; padding:22px 30px; backdrop-filter:blur(4px);}
      .tag{flex:none; background:${p.accent}; color:${p.tagFg}; font-weight:700; font-size:18px; letter-spacing:.04em;
           padding:8px 16px; border-radius:8px; text-transform:uppercase;}
      .txt{color:${p.fg}; font-size:29px; font-weight:500; line-height:1.25;}
    </style>
    <div class="frame">
      <div class="lt">${tag ? `<div class="tag">${escapeHtml(tag)}</div>` : ''}<div class="txt">${escapeHtml(text)}</div></div>
    </div>`;
}

async function run(c) {
    const project = c.req('project');
    const shots = c.req('shots');
    const { width: W, height: H } = c.get('capture.viewport', { width: 1440, height: 900 });
    // what the video is FOR decides the look; anything set in the config still wins
    const style = styleForKind(c.get('video.kind'), c.get('style', {}));

    // 🎴 The CARDS may take a different background from the frames. That is not a stylistic
    //    nicety: the title card is what a video is represented by everywhere it is not playing
    //    (the poster, the social unfurl, the thumbnail in a feed), so it often wants a full
    //    image while the frames around the footage stay a calm gradient behind the content.
    //    Falls back to style.background, so a config that says nothing behaves as before.
    const cardStyle = { ...style, background: c.get('style.cardBackground', style.background) };

    // Background image paths are config paths: they resolve against the config file's
    // directory like every other path here, never the shell's cwd.
    for (const s of [style, cardStyle]) {
        if (s.background && s.background.image) {
            s.background = { ...s.background, image: c.resolve(s.background.image) };
        }
    }
    const p = palette(style);
    // the composition follows the kind unless the config names one (or asks for "random")
    const layout = pickLayout(c.get('video.card'), c.get('video.kind'));
    console.log(`cards: layout "${layout}"`);
    const workDir = c.resolve(c.req('output.workDir'));
    const cardsDir = ensureDir(path.join(workDir, 'cards'));
    // share one "random" background roll with assemble (see lib/style.cjs)
    initRandom(ensureDir(workDir), { reroll: Boolean(c.args.reroll) });

    // Title card lists what the video covers, derived from the shot captions.
    const full = {
        title: card(p, W, H, {
            kicker: project,
            title: c.get('video.title', 'What shipped this week'),
            big: true,
            lines: shots.map((s) => s.caption).filter(Boolean).slice(0, 4),
        }, cardStyle, layout),
    };
    const closing = c.get('closingCard');
    if (closing && closing.title) {
        full.closing = card(p, W, H, {
            kicker: project,
            title: closing.title,
            lines: Array.isArray(closing.lines) ? closing.lines : [],
        }, cardStyle, layout);
    }

    const launch = chromium(c.root);
    const browser = await launch.launch();
    const written = [];
    try {
        const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

        for (const [name, html] of Object.entries(full)) {
            await page.setContent(`<html><body>${html}</body></html>`, { waitUntil: 'networkidle' });
            await page.screenshot({ path: path.join(cardsDir, `card-${name}.png`) });
            written.push(`card-${name}.png`);
        }
        for (const s of shots) {
            if (!s.caption) { console.log(`${s.id}: no caption, skipping lower-third`); continue; }
            await page.setContent(`<html><body>${lower(p, W, H, { tag: s.tag || s.id, text: s.caption })}</body></html>`, {
                waitUntil: 'networkidle',
            });
            await page.screenshot({ path: path.join(cardsDir, `lower-${s.id}.png`), omitBackground: true });
            written.push(`lower-${s.id}.png`);
        }
    } finally {
        await browser.close().catch(() => {});
    }

    console.log(`CARDS RENDERED -> ${cardsDir}\n  ${written.join('\n  ')}`);
    return written;
}

module.exports = { run };
