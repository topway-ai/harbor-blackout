'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const SUB = '/tmp/harbor-blackout-qa/repo/harbor-blackout';
const PORT = 8768;
(async () => {
  fs.mkdirSync(SUB, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(SUB, 'index.html'));
  const srv = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    fs.readFile(path.join('/tmp/harbor-blackout-qa/repo', rel), (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(d);
    });
  });
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.goto(`http://127.0.0.1:${PORT}/harbor-blackout/index.html`, { waitUntil: 'load' });
  for (let i = 0; i < 80; i++) {
    if (await page.evaluate(() => HB.game.state.state === 'TITLE')) break;
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => { HB.settings.values.quality = 'low'; HB.settings.apply(); });
  await page.click('#btn-begin');
  for (let k = 0; k < 4; k++) {
    console.log('SAMPLE', k, JSON.stringify(await page.evaluate(() => {
      const b = document.getElementById('btn-skip').getBoundingClientRect();
      const c = document.querySelector('.intro-card');
      const cr = c.getBoundingClientRect();
      const cs = getComputedStyle(c);
      const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
      return {
        btn: [b.left, b.top, b.width, b.height], card: [cr.left, cr.top, cr.width, cr.height],
        transform: cs.transform, animation: cs.animationName, transition: cs.transition,
        stack: document.elementsFromPoint(cx, cy).slice(0, 4).map(n => n.tagName + '.' + String(n.className || '').split(' ')[0]),
        dpr: window.devicePixelRatio
      };
    })));
    await page.waitForTimeout(250);
  }
  let clickResult;
  try { await page.click('#btn-skip', { timeout: 4000 }); clickResult = 'CLICK OK state=' + await page.evaluate(() => HB.game.state.state); }
  catch (e) { clickResult = 'CLICK FAILED: ' + e.message.split('\n').slice(0, 12).join(' | '); }
  console.log('CLICK RESULT', clickResult);
  const bb = await page.locator('#btn-skip').boundingBox();
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForTimeout(400);
  console.log('MOUSE CLICK STATE', await page.evaluate(() => HB.game.state.state));
  console.log('LOCK STATE', JSON.stringify(await page.evaluate(() => ({
    lock: document.pointerLockElement ? document.pointerLockElement.id || document.pointerLockElement.tagName : null,
    inputLocked: HB.input.isLocked(), enabled: HB.input.state.enabled,
    active: Array.from(document.querySelectorAll('.screen.active')).map(n => n.id),
    introPE: getComputedStyle(document.getElementById('intro')).pointerEvents,
    skipPE: getComputedStyle(document.getElementById('btn-skip')).pointerEvents
  }))));
  await page.evaluate(() => { window.__clicks = []; document.addEventListener('click', e => window.__clicks.push(e.target.tagName + '#' + (e.target.id || '')), true); });
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  console.log('CAPTURED CLICKS', JSON.stringify(await page.evaluate(() => window.__clicks)));
  await page.evaluate(() => document.getElementById('btn-skip').click());
  console.log('DOM CLICK STATE', await page.evaluate(() => HB.game.state.state));
  const info = await page.evaluate(() => {
    const b = document.getElementById('btn-skip');
    const r = b.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const c = document.querySelector('.intro-card').getBoundingClientRect();
    const ib = document.querySelector('.intro-bottom').getBoundingClientRect();
    return {
      state: HB.game.state.state,
      button: { x: r.left, y: r.top, w: r.width, h: r.height },
      card: { x: c.left, y: c.top, w: c.width, h: c.height },
      bottom: { x: ib.left, y: ib.top, w: ib.width, h: ib.height },
      hit: hit ? hit.outerHTML.slice(0, 160) : null,
      hitPath: (() => { let n = hit, out = []; while (n && out.length < 5) { out.push(n.tagName + (n.id ? '#' + n.id : '') + (n.className ? '.' + String(n.className).split(' ').join('.') : '')); n = n.parentElement; } return out; })()
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
