/* Browser QA harness. Serves the built game under a repository subpath. */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const QADIR = '/tmp/harbor-blackout-qa';
const SUB = path.join(QADIR, 'repo', 'harbor-blackout');
const SHOTS = path.join(ROOT, 'screenshots');
const PORT = 8765;

function serve() {
  fs.mkdirSync(SUB, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(SUB, 'index.html'));
  fs.writeFileSync(path.join(SUB, '.nojekyll'), '');
  const srv = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const file = path.join(QADIR, 'repo', rel);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(file);
      res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => srv.listen(PORT, '127.0.0.1', () => resolve(srv)));
}

async function waitForState(page, wanted, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await page.evaluate(() => window.HB && window.HB.game && window.HB.game.state.state);
    if (s === wanted) return true;
    if (s === 'ERROR') throw new Error('Game entered ERROR state');
    await page.waitForTimeout(400);
  }
  return false;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 400)); });
  page.on('pageerror', e => errors.push('[pageerror] ' + (e.stack || e.message).slice(0, 700)));
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:')) errors.push('[external request] ' + r.url()); });

  await page.goto(`http://127.0.0.1:${PORT}/harbor-blackout/index.html`, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(SHOTS, 'qa-loading.png') });
  const reached = await waitForState(page, 'TITLE', 90000);
  console.log('REACHED TITLE', reached);

  const info = await page.evaluate(() => {
    const H = window.HB;
    return {
      state: H.game.state.state,
      booted: H.game.state.booted,
      audit: H.strings.audit(),
      relays: H.world.data.relays.length,
      colliders: H.world.data.colliders.length,
      signs: H.world.data.signs.length,
      walkable: H.world.data.walkable.length,
      activeScreens: Array.from(document.querySelectorAll('.screen.active')).map(n => n.id),
      title: document.title,
      lang: document.documentElement.lang,
      perf: H.game.perf()
    };
  });
  console.log('INFO', JSON.stringify(info, null, 2).slice(0, 5000));
  await page.screenshot({ path: path.join(SHOTS, 'qa-title.png') });

  if (reached) {
    await page.click('#btn-begin');
    console.log('AFTER BEGIN', await page.evaluate(() => window.HB.game.state.state));
    await page.keyboard.press('Space');
    await page.waitForTimeout(1500);
    const play = await page.evaluate(() => ({
      state: window.HB.game.state.state,
      pos: [+window.HB.player.state.x.toFixed(1), +window.HB.player.state.y.toFixed(1), +window.HB.player.state.z.toFixed(1)],
      health: window.HB.player.state.health,
      mag: window.HB.weapon.data.mag,
      enemies: window.HB.enemies.count(),
      perf: window.HB.game.perf()
    }));
    console.log('PLAY', JSON.stringify(play));
    await page.screenshot({ path: path.join(SHOTS, 'qa-gameplay.png') });
  }
  console.log('ERRORS', JSON.stringify(errors.slice(0, 30), null, 2));
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
