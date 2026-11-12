/* Runtime audio signal check for the published HARBOR BLACKOUT build.
   Run: node tools/audio-qa.js
   Read-only: it does not change game state or repository files. It patches
   AudioNode.connect so an AnalyserNode sits just before the speakers, then
   samples the master output for the ambient bed, a gunshot and mute.
   This proves a signal path exists; it is not a listening or quality test. */
const { chromium } = require('playwright-core');

const SITE = 'https://topway-ai.github.io/harbor-blackout/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--no-sandbox', '--disable-dev-shm-usage'
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ARGS });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.addInitScript(() => {
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest) {
      if (dest instanceof AudioDestinationNode && !window.__hbAnalyser) {
        const an = this.context.createAnalyser();
        an.fftSize = 2048;
        window.__hbAnalyser = an;
        window.__hbCtx = this.context;
        orig.call(this, an);
        return orig.call(an, dest);
      }
      return orig.apply(this, arguments);
    };
  });

  await page.goto(SITE, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(
    () => window.HB && HB.game && HB.game.state && HB.game.state.state === 'TITLE',
    null, { polling: 500, timeout: 180000 }
  );

  const beforeGesture = await page.evaluate(() => ({
    started: HB.audio.isStarted(), contextExists: !!window.__hbCtx
  }));

  await page.click('#btn-begin');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => HB.game.state.state === 'PLAYING', null,
    { polling: 300, timeout: 120000 });
  await page.waitForTimeout(2200);

  const ambient = await page.evaluate(() => {
    const an = window.__hbAnalyser;
    const buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf);
    let peak = 0, sum = 0;
    for (let i = 0; i < buf.length; i++) {
      peak = Math.max(peak, Math.abs(buf[i]));
      sum += buf[i] * buf[i];
    }
    return {
      started: HB.audio.isStarted(),
      ctxState: window.__hbCtx.state,
      currentTime: +window.__hbCtx.currentTime.toFixed(2),
      sampleRate: window.__hbCtx.sampleRate,
      peak: +peak.toFixed(5),
      rms: +Math.sqrt(sum / buf.length).toFixed(5)
    };
  });

  await page.evaluate(() => HB.audio.gunshot());
  await page.waitForTimeout(260);
  const gunshot = await page.evaluate(() => {
    const an = window.__hbAnalyser;
    const buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i]));
    return +peak.toFixed(5);
  });

  await page.evaluate(() => HB.audio.setMute(true));
  await page.waitForTimeout(500);
  const muted = await page.evaluate(() => {
    const an = window.__hbAnalyser;
    const buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf);
    let peak = 0, sum = 0;
    for (let i = 0; i < buf.length; i++) {
      peak = Math.max(peak, Math.abs(buf[i]));
      sum += buf[i] * buf[i];
    }
    return { peak: +peak.toFixed(5), rms: +Math.sqrt(sum / buf.length).toFixed(5) };
  });
  await page.evaluate(() => HB.audio.setMute(false));

  await browser.close();
  const pass = !beforeGesture.started && !beforeGesture.contextExists &&
    ambient.started && ambient.ctxState === 'running' && ambient.rms > 0 &&
    gunshot > 0 && muted.peak === 0 && muted.rms === 0 && errors.length === 0;
  console.log(JSON.stringify({
    pass: pass, beforeGesture: beforeGesture, ambient: ambient,
    gunshotPeak: gunshot, muted: muted, errors: errors
  }, null, 2));
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
