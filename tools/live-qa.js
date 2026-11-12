/* Live-site validation for the published GitHub Pages build.
   Run: node tools/live-qa.js
   Uses the same local Chrome and software WebGL settings as tools/ui-qa.js.
   It only reads the public site; it does not change repository state. */
const { chromium } = require('playwright-core');

const SITE = 'https://topway-ai.github.io/harbor-blackout/';
const ORIGIN = 'https://topway-ai.github.io';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--no-sandbox', '--disable-dev-shm-usage'
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ARGS });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  const external = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => {
    const u = r.url();
    if (u.startsWith('data:') || u.startsWith(ORIGIN)) return;
    external.push(u);
  });

  await page.goto(SITE, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(
    () => window.HB && HB.game && HB.game.state && HB.game.state.state === 'TITLE',
    null, { polling: 500, timeout: 180000 }
  );

  const result = await page.evaluate(() => {
    const audit = HB.strings.audit();
    const visible = document.body.innerText || '';
    return {
      state: HB.game.state.state,
      booted: HB.game.state.booted,
      lang: document.documentElement.lang,
      title: document.title,
      auditViolations: audit.violations,
      catalogSize: audit.catalogSize,
      nonAsciiVisible: (visible.match(/[^\x09\x0A\x0D\x20-\x7E]/g) || []).length,
      relays: HB.world.data.relays.length,
      colliders: HB.world.data.colliders.length
    };
  });
  await browser.close();

  const pass = result.state === 'TITLE' && result.lang === 'en' &&
    result.title === 'HARBOR BLACKOUT' && result.auditViolations.length === 0 &&
    result.nonAsciiVisible === 0 && result.relays === 3 &&
    errors.length === 0 && external.length === 0;
  console.log(JSON.stringify({
    site: SITE, pass: pass, result: result,
    errors: errors, externalRequests: external
  }, null, 2));
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
