const { startVisualsServer, sceneUrl } = require('/Users/elemoghenekaro/Workspace/tasks/projects/newsreel/lib/visuals.cjs');
const { chromium } = require('playwright');
(async () => {
  const s = await startVisualsServer();
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(sceneUrl(s.url, { scene: 'design-tiles', props: {} }));
  await p.waitForFunction(() => window.__NEWSREEL_READY__ || window.__NEWSREEL_ERROR__, null, { timeout: 15000 });
  await p.waitForTimeout(2500);
  console.log(JSON.stringify(await p.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg')];
    const root = document.querySelector('#stage > div');
    return {
      resolvedFont: root ? getComputedStyle(root).fontFamily : null,
      svgCount: svgs.length,
      viewBoxes: svgs.slice(0,3).map(s => s.getAttribute('viewBox')),
      rects: svgs.slice(0,2).map(s => s.querySelectorAll('rect').length),
      boxes: svgs.slice(0,3).map(s => { const r = s.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }),
      cssHeight: svgs[0] ? svgs[0].style.height : null,
    };
  }), null, 1));
  await b.close(); await s.close();
})();
