/* UI, settings, input, touch, locale and screen-state QA.
   Screenshots are written to screenshots/. Results go to stdout and
   screenshots/qa-report.json. */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const QADIR = '/tmp/harbor-blackout-qa';
const SUB = path.join(QADIR, 'repo', 'harbor-blackout');
const SHOTS = path.join(ROOT, 'screenshots');
const PORT = 8769;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'];

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
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  });
  return new Promise(resolve => srv.listen(PORT, '127.0.0.1', () => resolve(srv)));
}

async function waitFor(page, state, ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await page.evaluate(() => HB.game.state.state) === state) return true;
    await page.waitForTimeout(350);
  }
  return false;
}
async function shot(page, name) { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); }
/* Software WebGL can take hundreds of milliseconds per rendered frame. Wait on
   observable game state instead of assuming a short key hold spanned a frame. */
async function until(page, fn, ms) {
  try { await page.waitForFunction(fn, null, { polling: 120, timeout: ms || 12000 }); return true; }
  catch (e) { return false; }
}
const URL = `http://127.0.0.1:${PORT}/harbor-blackout/index.html`;

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ARGS });
  const report = { checks: [], errors: [], screens: [], locale: {} };
  const ck = (name, ok, detail) => { report.checks.push({ name, ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + (detail === undefined ? '' : JSON.stringify(detail))); };

  /* ---------------- Desktop: screens, settings, gameplay input ----------- */
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push('[pageerror] ' + (e.stack || e.message).slice(0, 400)));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('[console] ' + m.text().slice(0, 300)); });
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:')) pageErrors.push('[external] ' + r.url()); });
  await page.goto(URL, { waitUntil: 'load' });
  await shot(page, 'qa-loading');
  ck('boot reaches title', await waitFor(page, 'TITLE', 120000));
  await shot(page, 'qa-title');
  report.screens.push('qa-loading', 'qa-title');

  /* Settings screen from title. */
  await page.click('#btn-settings-title');
  ck('settings screen active', await page.evaluate(() => document.getElementById('settings').classList.contains('active')));
  await shot(page, 'qa-settings'); report.screens.push('qa-settings');
  await page.evaluate(() => {
    const v = document.getElementById('set-volume'); v.value = '35'; v.dispatchEvent(new Event('input', { bubbles: true }));
    const s = document.getElementById('set-sens'); s.value = '180'; s.dispatchEvent(new Event('input', { bubbles: true }));
    const f = document.getElementById('set-fov'); f.value = '95'; f.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('set-mute').click();
    document.getElementById('set-invert').click();
    document.getElementById('set-shake').click();
    const q = document.getElementById('set-quality'); q.value = 'low'; q.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const setVals = await page.evaluate(() => ({ v: HB.settings.values, stored: JSON.parse(localStorage.getItem('harbor-blackout-settings-v1') || '{}') }));
  ck('settings update and persist', setVals.v.volume === 35 && setVals.v.sensitivity === 180 && setVals.v.fov === 95 && setVals.v.quality === 'low' && setVals.v.muted === true && setVals.v.invertY === true && setVals.stored.volume === 35, setVals.v);
  await page.click('#btn-settings-reset');
  ck('settings reset to defaults', await page.evaluate(() => HB.settings.values.volume === 70 && HB.settings.values.quality === 'medium'));
  await page.click('#btn-settings-back');

  await page.click('#btn-controls-title');
  await shot(page, 'qa-controls'); report.screens.push('qa-controls');
  ck('controls panel populated', await page.evaluate(() => document.getElementById('controls-grid').children.length >= 8));
  await page.click('#btn-controls-back');

  /* Intro: SKIP must be clickable with a real mouse. */
  await page.click('#btn-begin');
  ck('intro state after begin', await page.evaluate(() => HB.game.state.state) === 'INTRO');
  await shot(page, 'qa-intro'); report.screens.push('qa-intro');
  const bb = await page.locator('#btn-skip').boundingBox();
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  ck('SKIP button clickable with mouse', await waitFor(page, 'PLAYING', 10000));
  await page.waitForTimeout(500);
  await shot(page, 'qa-gameplay'); report.screens.push('qa-gameplay');

  /* Movement, sprint, crouch, jump, ADS, fire, reload, collision. */
  const before = await page.evaluate(() => ({ x: HB.player.state.x, z: HB.player.state.z }));
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(1100);
  const sprinting = await page.evaluate(() => ({ sprint: HB.player.state.sprinting, x: HB.player.state.x, z: HB.player.state.z }));
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
  ck('W moves player', Math.hypot(sprinting.x - before.x, sprinting.z - before.z) > 1, { before, after: [sprinting.x, sprinting.z] });
  ck('Shift sprint engaged', sprinting.sprint === true);
  ck('movement stays inside walkable geometry', await page.evaluate(() => HB.world.validPosition(HB.player.state.x, HB.player.state.z, HB.player.state.radius, HB.player.state.y, HB.player.state.height)));
  await page.keyboard.down('KeyC');
  const crouched = await until(page, () => HB.player.state.crouching, 12000);
  ck('C crouches', crouched, await page.evaluate(() => ({ crouch: HB.player.state.crouching, eye: +HB.player.state.eye.toFixed(2) })));
  await page.keyboard.up('KeyC');
  await until(page, () => !HB.player.state.crouching, 12000);
  await page.keyboard.press('Space');
  ck('Space jumps', await until(page, () => !HB.player.state.onGround || HB.player.state.velY > 0 || HB.player.state.y > 0, 12000));
  await until(page, () => HB.player.state.onGround, 12000);
  await page.mouse.down({ button: 'right' });
  const aimed = await until(page, () => HB.player.state.ads, 12000);
  ck('right mouse aims down sights', aimed, await page.evaluate(() => ({ ads: HB.player.state.ads, fov: +HB.player.state.fov.toFixed(1) })));
  const shotsBefore = await page.evaluate(() => ({ shots: HB.game.state.stats.shots, mag: HB.weapon.data.mag }));
  await page.mouse.down({ button: 'left' }); await page.waitForTimeout(700); await page.mouse.up({ button: 'left' }); await page.mouse.up({ button: 'right' });
  const shotsAfter = await page.evaluate(() => ({ shots: HB.game.state.stats.shots, mag: HB.weapon.data.mag }));
  ck('left mouse fires and consumes ammo', shotsAfter.shots > shotsBefore.shots && shotsAfter.mag < shotsBefore.mag, { before: shotsBefore, after: shotsAfter });
  await page.mouse.down({ button: 'right' });
  await until(page, () => HB.player.state.ads, 12000);
  await shot(page, 'qa-weapon-ads'); report.screens.push('qa-weapon-ads');
  await page.mouse.up({ button: 'right' });
  const reloadBefore = await page.evaluate(() => ({ mag: HB.weapon.data.mag, reserve: HB.weapon.data.reserve }));
  await page.keyboard.press('KeyR');
  const reloaded = await until(page, () => HB.weapon.data.mag === 30 && !HB.weapon.data.reloading, 30000);
  const reloadAfter = await page.evaluate(() => ({ mag: HB.weapon.data.mag, reserve: HB.weapon.data.reserve }));
  ck('R reloads magazine', reloaded && reloadAfter.reserve < reloadBefore.reserve, { before: reloadBefore, after: reloadAfter });

  /* Look around to capture container and equipment labels. */
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => HB.input.lookDelta(220, 0));
    await page.waitForTimeout(350);
    await shot(page, 'qa-labels-' + i); report.screens.push('qa-labels-' + i);
  }

  /* Damage feedback, death and retry. */
  await page.evaluate(() => HB.player.applyDamage(12, 4, 30, 'DEATH_CAUSE_COMBAT'));
  const healthAfter = await page.evaluate(() => HB.player.state.health);
  ck('damage reduces health', healthAfter <= 88, healthAfter);
  await page.evaluate(() => { HB.player.state.health = 0; HB.player.state.dead = true; });
  ck('death screen appears', await waitFor(page, 'DEAD', 10000));
  await shot(page, 'qa-death'); report.screens.push('qa-death');
  await page.click('#btn-retry');
  ck('retry restores health and gameplay', await page.evaluate(() => HB.game.state.state === 'PLAYING' && HB.player.state.health === 100));

  /* Pause / resume and settings from pause. */
  await page.keyboard.press('Escape');
  ck('Esc pauses', await page.evaluate(() => HB.game.state.state === 'PAUSED'));
  await shot(page, 'qa-pause'); report.screens.push('qa-pause');
  await page.click('#btn-settings-pause');
  ck('settings reachable from pause', await page.evaluate(() => HB.game.state.state === 'SETTINGS'));
  await page.click('#btn-settings-back');
  ck('settings back returns to pause', await page.evaluate(() => HB.game.state.state === 'PAUSED'));
  await page.click('#btn-resume');
  ck('resume returns to gameplay', await page.evaluate(() => HB.game.state.state === 'PLAYING'));

  const auditDesktop = await page.evaluate(() => ({
    audit: HB.strings.audit(), lang: document.documentElement.lang, title: document.title,
    domText: document.body.innerText,
    han: (document.body.innerText.match(/\p{Script=Han}/gu) || []).length,
    perf: HB.game.perf()
  }));
  ck('runtime catalog audit clean', auditDesktop.audit.violations.length === 0, auditDesktop.audit);
  ck('document language is en', auditDesktop.lang === 'en');
  ck('no Han characters in desktop DOM text', auditDesktop.han === 0);
  report.perfDesktop = auditDesktop.perf;
  report.errors.push(...pageErrors);
  ck('no runtime errors or external requests', pageErrors.length === 0, pageErrors.slice(0, 6));
  await context.close();

  /* ---------------- Non-English locale desktop --------------------------- */
  const zh = await browser.newContext({ viewport: { width: 1024, height: 640 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
  const zp = await zh.newPage();
  const zhErrors = [];
  zp.on('pageerror', e => zhErrors.push(e.message));
  await zp.goto(URL, { waitUntil: 'load' });
  ck('title reached with zh-CN locale', await waitFor(zp, 'TITLE', 120000));
  const zhInfo = await zp.evaluate(() => ({
    lang: document.documentElement.lang, title: document.title,
    navLang: navigator.language,
    audit: HB.strings.audit().violations.length,
    han: (document.body.innerText.match(/\p{Script=Han}/gu) || []).length,
    text: document.body.innerText.slice(0, 400),
    catalog: Object.keys(HB.strings.CATALOG).length
  }));
  await shot(zp, 'qa-locale-zh-title'); report.screens.push('qa-locale-zh-title');
  ck('non-English locale keeps English content', zhInfo.lang === 'en' && zhInfo.han === 0 && zhInfo.audit === 0, { navLang: zhInfo.navLang, lang: zhInfo.lang, han: zhInfo.han, audit: zhInfo.audit, title: zhInfo.title });
  report.locale.desktop = zhInfo;
  await zh.close();

  /* ---------------- Touch device ---------------------------------------- */
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP', isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mob.newPage();
  const mobErrors = [];
  mp.on('pageerror', e => mobErrors.push(e.message));
  await mp.goto(URL, { waitUntil: 'load' });
  ck('title reached on touch device', await waitFor(mp, 'TITLE', 120000));
  await shot(mp, 'qa-mobile-title'); report.screens.push('qa-mobile-title');
  await mp.tap('#btn-begin');
  const skipBox = await mp.locator('#btn-skip').boundingBox();
  await mp.touchscreen.tap(skipBox.x + skipBox.width / 2, skipBox.y + skipBox.height / 2);
  ck('touch device reaches gameplay', await waitFor(mp, 'PLAYING', 15000));
  const touchVisible = await mp.evaluate(() => document.getElementById('touch').classList.contains('active'));
  ck('touch controls visible', touchVisible);
  /* Touch buttons must not sit on top of the health/ammo readouts or the stick. */
  const hudOverlap = await mp.evaluate(() => {
    const rects = sel => Array.from(document.querySelectorAll(sel)).map(n => n.getBoundingClientRect());
    const hud = rects('.hud-bottom-left, .hud-bottom-right');
    const controls = rects('#touch button, #touch-stick');
    const hits = [];
    for (const h of hud) for (const c of controls) {
      const ox = Math.min(h.right, c.right) - Math.max(h.left, c.left);
      const oy = Math.min(h.bottom, c.bottom) - Math.max(h.top, c.top);
      if (ox > 2 && oy > 2) hits.push({ w: +ox.toFixed(1), h: +oy.toFixed(1) });
    }
    return hits;
  });
  ck('touch buttons avoid critical HUD readouts', hudOverlap.length === 0, hudOverlap);
  await until(mp, () => document.getElementById('obj-title').textContent.trim().length > 0, 12000);
  const objFit = await mp.evaluate(() => {
    const n = document.getElementById('obj-title');
    return { scroll: n.scrollWidth, client: n.clientWidth, text: n.textContent };
  });
  ck('objective title fits its panel', objFit.text.length > 0 && objFit.scroll <= objFit.client + 1, objFit);
  await shot(mp, 'qa-touch'); report.screens.push('qa-touch');

  /* Drive the virtual stick, look zone and action buttons with real touch
     events dispatched through the browser input pipeline. */
  const cdp = await mob.newCDPSession(mp);
  const touchAt = async (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const stick = await mp.locator('#touch-stick').boundingBox();
  const sx = stick.x + stick.width / 2, sy = stick.y + stick.height / 2;
  await touchAt('touchStart', [{ x: sx, y: sy, id: 1 }]);
  await touchAt('touchMove', [{ x: sx, y: sy - 40, id: 1 }]);
  const moveY = await mp.evaluate(() => HB.input.state.touch.moveY);
  await touchAt('touchEnd', []);
  ck('virtual stick drives movement input', moveY < -0.5, { moveY: +moveY.toFixed(2) });

  const lookBefore = await mp.evaluate(() => { window.__lookBefore = HB.player.state.yaw; return window.__lookBefore; });
  await touchAt('touchStart', [{ x: 300, y: 300, id: 2 }]);
  await touchAt('touchMove', [{ x: 260, y: 300, id: 2 }]);
  await touchAt('touchEnd', []);
  const lookChanged = await until(mp, () => Math.abs(HB.player.state.yaw - window.__lookBefore) > 0.001, 12000);
  ck('look zone steers the camera', lookChanged, { lookBefore });

  const tb = await mp.locator('#tb-fire').boundingBox();
  const fx = tb.x + tb.width / 2, fy = tb.y + tb.height / 2;
  const magBefore = await mp.evaluate(() => HB.weapon.data.mag);
  await touchAt('touchStart', [{ x: fx, y: fy, id: 3 }]);
  const firedByTouch = await mp.waitForFunction(n => HB.weapon.data.mag < n, magBefore, { polling: 120, timeout: 20000 }).then(() => true).catch(() => false);
  await touchAt('touchEnd', []);
  const touchOff = await mp.evaluate(() => !HB.input.actionDown('FIRE'));
  ck('touch FIRE button fires and releases', firedByTouch && touchOff, { magBefore, magAfter: await mp.evaluate(() => HB.weapon.data.mag) });
  const mobInfo = await mp.evaluate(() => ({
    lang: document.documentElement.lang,
    audit: HB.strings.audit().violations.length,
    han: (document.body.innerText.match(/\p{Script=Han}/gu) || []).length,
    navLang: navigator.language,
    touchLabels: Array.from(document.querySelectorAll('#touch button')).map(b => b.textContent)
  }));
  ck('touch labels are English-only', mobInfo.han === 0 && mobInfo.audit === 0 && mobInfo.lang === 'en', { navLang: mobInfo.navLang, labels: mobInfo.touchLabels });
  report.locale.mobile = mobInfo;
  report.errors.push(...mobErrors, ...zhErrors);
  await mob.close();

  /* ---------------- Save report ----------------------------------------- */
  const failed = report.checks.filter(c => !c.ok);
  report.summary = { total: report.checks.length, passed: report.checks.length - failed.length, failed: failed.map(f => f.name) };
  fs.writeFileSync(path.join(SHOTS, 'qa-report.json'), JSON.stringify(report, null, 2));
  console.log('SUMMARY', JSON.stringify(report.summary));
  console.log('PERF', JSON.stringify(report.perfDesktop));
  console.log('ERRORS', JSON.stringify(report.errors.slice(0, 20)));
  await browser.close();
  server.close();
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
