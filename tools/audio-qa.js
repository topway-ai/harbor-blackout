/* Runtime audio signal check for the HARBOR BLACKOUT build.
   Run: node tools/audio-qa.js
   Override the target with HB_AUDIO_QA_URL, for example a local subpath server.
   Read-only: it does not write game state or repository files. It patches
   AudioNode.connect so an AnalyserNode sits just before the speakers, counts the
   WebAudio source nodes a gunshot schedules, and samples the master output for
   the ambient bed, a gunshot and mute.
   This proves a signal path exists; it is not a listening or quality test. */
const { chromium } = require('playwright-core');

const SITE = process.env.HB_AUDIO_QA_URL || 'https://topway-ai.github.io/harbor-blackout/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ARGS = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--no-sandbox', '--disable-dev-shm-usage'
];

function sampleWindow(page, durationMs, fire) {
  return page.evaluate(({ durationMs, fire }) => new Promise(resolve => {
    const an = window.__hbAnalyser;
    const buf = new Float32Array(an.fftSize);
    const countsBefore = Object.assign({}, window.__hbCounts);
    let maxPeak = 0, maxRms = 0, samples = 0;

    /* The gunshot envelope decays in about 0.19 s, so sampling once after a
       fixed delay would miss it. Sample continuously instead, and record the
       source nodes created synchronously by the call itself. */
    if (fire) HB.audio.gunshot();
    const countsAfterCall = Object.assign({}, window.__hbCounts);
    const created = {
      bufferSource: countsAfterCall.bufferSource - countsBefore.bufferSource,
      oscillator: countsAfterCall.oscillator - countsBefore.oscillator
    };

    const t0 = performance.now();
    const id = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      let peak = 0, sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = Math.abs(buf[i]);
        if (v > peak) peak = v;
        sum += buf[i] * buf[i];
      }
      const rms = Math.sqrt(sum / buf.length);
      if (peak > maxPeak) maxPeak = peak;
      if (rms > maxRms) maxRms = rms;
      samples++;
      if (performance.now() - t0 >= durationMs) {
        clearInterval(id);
        resolve({
          peak: +maxPeak.toFixed(5),
          rms: +maxRms.toFixed(5),
          samples: samples,
          created: created
        });
      }
    }, 10);
  }), { durationMs: durationMs, fire: !!fire });
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ARGS });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.addInitScript(() => {
    window.__hbCounts = { bufferSource: 0, oscillator: 0 };
    const proto = window.BaseAudioContext
      ? window.BaseAudioContext.prototype
      : (window.AudioContext ? window.AudioContext.prototype : null);
    if (proto) {
      const makeBufferSource = proto.createBufferSource;
      proto.createBufferSource = function () {
        window.__hbCounts.bufferSource++;
        return makeBufferSource.apply(this, arguments);
      };
      const makeOscillator = proto.createOscillator;
      proto.createOscillator = function () {
        window.__hbCounts.oscillator++;
        return makeOscillator.apply(this, arguments);
      };
    }

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
    started: HB.audio.isStarted(),
    contextExists: !!window.__hbCtx
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

  const baseline = await sampleWindow(page, 400, false);
  const gunshot = await sampleWindow(page, 400, true);

  await page.evaluate(() => HB.audio.setMute(true));
  await page.waitForTimeout(500);
  const muted = await sampleWindow(page, 250, false);
  await page.evaluate(() => HB.audio.setMute(false));

  await browser.close();
  const pass = !beforeGesture.started && !beforeGesture.contextExists &&
    ambient.started && ambient.ctxState === 'running' && ambient.sampleRate === 48000 &&
    ambient.rms > 0 &&
    baseline.samples >= 4 && gunshot.samples >= 4 &&
    gunshot.created.bufferSource >= 2 && gunshot.created.oscillator >= 1 &&
    gunshot.peak > 0 && gunshot.rms >= baseline.rms * 1.05 &&
    muted.peak === 0 && muted.rms === 0 && errors.length === 0;
  console.log(JSON.stringify({
    pass: pass, site: SITE, beforeGesture: beforeGesture, ambient: ambient,
    baseline: baseline, gunshot: gunshot,
    gunshotRmsRatio: +(gunshot.rms / (baseline.rms || 1)).toFixed(3),
    muted: muted, errors: errors
  }, null, 2));
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
