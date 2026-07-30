const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = path.join(__dirname, 'site', '.shots');
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  for (const [name, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 140)); });
    await p.goto('http://127.0.0.1:8899/', { waitUntil: 'networkidle' });
    await p.waitForTimeout(3000);
    await p.screenshot({ path: path.join(out, `${name}-top.png`) });
    for (const sec of ['how', 'collection', 'studio', 'use']) {
      await p.evaluate((s) => document.getElementById(s).scrollIntoView(), sec);
      await p.waitForTimeout(sec === 'collection' ? 4000 : 1200);
      await p.screenshot({ path: path.join(out, `${name}-${sec}.png`) });
    }
    console.log(`${name}: ok${errs.length ? ' | console: ' + errs[0] : ''}`);
    await p.close();
  }
  await b.close();
})();
