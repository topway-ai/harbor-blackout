/* Frame-aware input diagnostic.
   Under software WebGL a rendered frame can take hundreds of milliseconds, so
   short key holds may span zero simulation frames. This checks cadence first,
   then verifies crouch, ADS and reload across enough frames to be meaningful. */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const SUB = '/tmp/harbor-blackout-qa/repo/harbor-blackout';
const PORT = 8770;
(async () => {
  fs.mkdirSync(SUB, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(SUB, 'index.html'));
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    fs.readFile(path.join('/tmp/harbor-blackout-qa/repo', rel), (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(d);
    });
  });
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${PORT}/harbor-blackout/index.html`, { waitUntil: 'load' });
  for (let i = 0; i < 100; i++) { if (await page.evaluate(() => HB.game.state.state === 'TITLE')) break; await page.waitForTimeout(400); }
  await page.click('#btn-begin');
  const b = await page.locator('#btn-skip').boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(600);
  const snap = () => page.evaluate(() => ({
    state: HB.game.state.state, enabled: HB.input.state.enabled, locked: HB.input.isLocked(),
    keys: Object.keys(HB.input.state.keys).filter(k => HB.input.state.keys[k]),
    mouse: HB.input.state.mouse,
    crouch: HB.player.state.crouching, ads: HB.player.state.ads, sprint: HB.player.state.sprinting,
    eye: +HB.player.state.eye.toFixed(2),
    mag: HB.weapon.data.mag, reserve: HB.weapon.data.reserve,
    reloading: HB.weapon.data.reloading, reloadT: +HB.weapon.data.reloadT.toFixed(2),
    frames: HB.game.state.frameTimes.length
  }));
  console.log('BASE', JSON.stringify(await snap()));

  const f0 = await page.evaluate(() => HB.game.state.frameTimes.length);
  await page.waitForTimeout(3000);
  const f1 = await page.evaluate(() => HB.game.state.frameTimes.length);
  console.log('CADENCE frames/3s', f1 - f0, 'approxFps', ((f1 - f0) / 3).toFixed(1));
  console.log('PERF', JSON.stringify(await page.evaluate(() => HB.game.perf())));

  await page.keyboard.down('KeyC'); await page.waitForTimeout(2000);
  console.log('C HELD 2s', JSON.stringify(await snap()));
  await page.keyboard.up('KeyC'); await page.waitForTimeout(1200);
  console.log('C RELEASED', JSON.stringify(await snap()));

  await page.mouse.down({ button: 'right' }); await page.waitForTimeout(2000);
  console.log('RMB HELD 2s', JSON.stringify(await snap()));
  await page.mouse.up({ button: 'right' }); await page.waitForTimeout(1200);
  console.log('RMB RELEASED', JSON.stringify(await snap()));

  await page.mouse.down({ button: 'left' }); await page.waitForTimeout(900); await page.mouse.up({ button: 'left' });
  console.log('AFTER FIRE', JSON.stringify(await snap()));
  await page.keyboard.press('KeyR');
  let reloaded = false;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    const s = await snap();
    if (i % 4 === 0 || s.mag === 30) console.log('RELOAD t+' + (i + 1) + 's', JSON.stringify({ mag: s.mag, reserve: s.reserve, reloading: s.reloading, reloadT: s.reloadT }));
    if (s.mag === 30 && !s.reloading) { reloaded = true; break; }
  }
  console.log('RELOAD COMPLETED', reloaded);
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
