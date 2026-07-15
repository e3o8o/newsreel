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
const { palette } = require('../style.cjs');
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

// Full-frame card: kicker, headline, optional bullet lines.
function card(p, W, H, { kicker, title, lines = [], big }) {
    return `<style>${base(W, H)}
      .card{background:${p.cardBg}; color:${p.fg}; display:flex; flex-direction:column; justify-content:center; padding:0 ${Math.round(W * 0.09)}px;}
      .kick{color:${p.accent}; font-size:26px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; margin-bottom:26px;}
      .title{font-size:${big ? 72 : 58}px; font-weight:700; line-height:1.1; letter-spacing:-.02em;}
      .lines{margin-top:40px; display:flex; flex-direction:column; gap:18px;}
      .line{font-size:30px; color:${p.muted}; line-height:1.4; display:flex; align-items:center; gap:16px;}
      .dot{color:${p.accent}; font-size:22px;}
    </style>
    <div class="frame card">
      ${kicker ? `<div class="kick">${escapeHtml(kicker)}</div>` : ''}
      <div class="title">${escapeHtml(title)}</div>
      ${lines.length ? `<div class="lines">${lines.map((l) => `<div class="line"><span class="dot">&#9656;</span><span>${escapeHtml(l)}</span></div>`).join('')}</div>` : ''}
    </div>`;
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
    const p = palette(c.get('style', {}));
    const cardsDir = ensureDir(path.join(c.resolve(c.req('output.workDir')), 'cards'));

    // Title card lists what the video covers, derived from the shot captions.
    const full = {
        title: card(p, W, H, {
            kicker: project,
            title: c.get('video.title', 'What shipped this week'),
            big: true,
            lines: shots.map((s) => s.caption).filter(Boolean).slice(0, 4),
        }),
    };
    const closing = c.get('closingCard');
    if (closing && closing.title) {
        full.closing = card(p, W, H, {
            kicker: project,
            title: closing.title,
            lines: Array.isArray(closing.lines) ? closing.lines : [],
        });
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
