/* Temporary diagnostic: observe boot progression in headless Chrome. */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const QADIR = '/tmp/harbor-blackout-qa';
const SUB = path.join(QADIR, 'repo', 'harbor-blackout');
const PORT = 8766;

function serve() {
  fs.mkdirSync(SUB, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(SUB, 'index.html'));
  const srv = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/') rel = '/index.html';
    fs.readFile(path.join(QADIR, 'repo', rel), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  });
  return new Promise(resolve => srv.listen(PORT, '127.0.0.1', () => resolve(srv)));
}

(async () => {
  const server = await serve();
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push('[' + m.type() + '] ' + m.text().slice(0, 300)); });
  page.on('pageerror', e => errors.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
  await page.goto(`http://127.0.0.1:${PORT}/harbor-blackout/index.html`, { waitUntil: 'load' });
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    const snap = await page.evaluate(() => {
      const H = window.HB;
      const G = H && H.game && H.game.state;
      return {
        t: performance.now().toFixed(0),
        state: G && G.state,
        booted: G && G.booted,
        stageIndex: G && G.stageIndex,
        stages: G && G.stages.length,
        bootTimer: G && +G.bootTimer.toFixed(3),
        frames: G && G.frameTimes.length,
        lastFrameMs: G && G.frameTimes.length ? +G.frameTimes[G.frameTimes.length - 1].toFixed(1) : null,
        colliders: H && H.world && H.world.data.colliders.length,
        signs: H && H.world && H.world.data.signs.length,
        fill: document.getElementById('boot-fill') ? document.getElementById('boot-fill').style.width : null,
        stageText: document.getElementById('boot-stage') ? document.getElementById('boot-stage').textContent : null
      };
    });
    console.log(i + 1, JSON.stringify(snap));
  }
  console.log('ERRORS', JSON.stringify(errors.slice(0, 30), null, 2));
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
