/* HARBOR BLACKOUT - fully synthesized WebAudio soundscape.
   No audio files, no network requests. The context is created only after a
   user gesture, as required by browser autoplay policy. */
(function (HB) {
  'use strict';

  var ctx = null;
  var master = null;
  var noiseBuffer = null;
  var ambience = null;
  var volume = .7;
  var muted = false;
  var started = false;
  var hornTimer = 0;
  var droneGain = null;
  var droneOsc = null;

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = .004; comp.release.value = .22;
    master.connect(comp); comp.connect(ctx.destination);
    var len = ctx.sampleRate * 2;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuffer.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function start() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (started) return;
    started = true;
    var now = ctx.currentTime;

    function noiseSource() {
      var s = ctx.createBufferSource();
      s.buffer = noiseBuffer; s.loop = true; s.start();
      return s;
    }
    function gain(v) { var g = ctx.createGain(); g.gain.value = v; return g; }

    /* Rain: filtered wide noise with a slow breathing envelope. */
    var rain = noiseSource();
    var rainHP = ctx.createBiquadFilter(); rainHP.type = 'highpass'; rainHP.frequency.value = 420;
    var rainLP = ctx.createBiquadFilter(); rainLP.type = 'lowpass'; rainLP.frequency.value = 6200;
    var rainGain = gain(.11);
    rain.connect(rainHP); rainHP.connect(rainLP); rainLP.connect(rainGain); rainGain.connect(master);
    var rainLfo = ctx.createOscillator(); rainLfo.frequency.value = .09;
    var rainLfoGain = gain(.028); rainLfo.connect(rainLfoGain); rainLfoGain.connect(rainGain.gain); rainLfo.start();

    /* Wind: band-passed noise sweeping slowly. */
    var wind = noiseSource();
    var windBP = ctx.createBiquadFilter(); windBP.type = 'bandpass'; windBP.frequency.value = 520; windBP.Q.value = .7;
    var windGain = gain(.055);
    wind.connect(windBP); windBP.connect(windGain); windGain.connect(master);
    var windLfo = ctx.createOscillator(); windLfo.frequency.value = .055;
    var windLfoGain = gain(240); windLfo.connect(windLfoGain); windLfoGain.connect(windBP.frequency); windLfo.start();

    /* Sea wash: low, slow noise swell. */
    var sea = noiseSource();
    var seaLP = ctx.createBiquadFilter(); seaLP.type = 'lowpass'; seaLP.frequency.value = 330;
    var seaGain = gain(.035);
    sea.connect(seaLP); seaLP.connect(seaGain); seaGain.connect(master);
    var seaLfo = ctx.createOscillator(); seaLfo.frequency.value = .13;
    var seaLfoGain = gain(.018); seaLfo.connect(seaLfoGain); seaLfoGain.connect(seaGain.gain); seaLfo.start();

    /* Harbor drone: two detuned low oscillators. */
    var baseOsc = ctx.createOscillator(); baseOsc.type = 'sine'; baseOsc.frequency.value = 52;
    var baseOsc2 = ctx.createOscillator(); baseOsc2.type = 'triangle'; baseOsc2.frequency.value = 78.4;
    var baseGain = gain(.035);
    baseOsc.connect(baseGain); baseOsc2.connect(baseGain); baseGain.connect(master);
    baseOsc.start(); baseOsc2.start();

    /* Enemy proximity hum, driven from update(). */
    droneOsc = ctx.createOscillator(); droneOsc.type = 'sawtooth'; droneOsc.frequency.value = 128;
    var droneLP = ctx.createBiquadFilter(); droneLP.type = 'lowpass'; droneLP.frequency.value = 420;
    droneGain = gain(0);
    droneOsc.connect(droneLP); droneLP.connect(droneGain); droneGain.connect(master);
    droneOsc.start();

    ambience = { rain: rainGain, wind: windGain, sea: seaGain, base: baseGain };
    horn(now + 6);
    hornTimer = 0;
  }

  function env(node, target, attack, decay, peak) {
    var now = ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(0.0001, now);
    node.gain.exponentialRampToValueAtTime(peak || target, now + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
  }

  function burst(opts) {
    if (!ctx || muted) return;
    var now = ctx.currentTime;
    var s = ctx.createBufferSource();
    s.buffer = noiseBuffer;
    s.playbackRate.value = opts.rate || 1;
    var f = ctx.createBiquadFilter();
    f.type = opts.filter || 'bandpass'; f.frequency.value = opts.freq || 1200; f.Q.value = opts.q || 1;
    var g = ctx.createGain();
    s.connect(f); f.connect(g); g.connect(master);
    env(g, 0, opts.attack || .002, opts.decay || .12, opts.peak || .3);
    s.start(now, Math.random() * 1.4, (opts.decay || .12) + (opts.attack || .002) + .02);
    s.stop(now + (opts.decay || .12) + (opts.attack || .002) + .06);
  }

  function tone(freq, dur, type, peak, sweepTo) {
    if (!ctx || muted) return;
    var now = ctx.currentTime;
    var o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, now);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, now + dur);
    var g = ctx.createGain();
    o.connect(g); g.connect(master);
    env(g, 0, .006, dur, peak || .12);
    o.start(now); o.stop(now + dur + .04);
  }

  function horn(atTime) {
    if (!ctx) return;
    var t = atTime || ctx.currentTime;
    var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 96;
    var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 144;
    var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    var g = ctx.createGain();
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(.055, t + .7);
    g.gain.setValueAtTime(.055, t + 1.6);
    g.gain.exponentialRampToValueAtTime(.0001, t + 2.8);
    o.start(t); o2.start(t); o.stop(t + 2.9); o2.stop(t + 2.9);
  }

  var api = {
    start: start,
    isStarted: function () { return started; },
    suspend: function () { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resumeAudio: function () { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setVolume: function (v) { volume = HB.util.clamp(v, 0, 1); if (master) master.gain.value = muted ? 0 : volume; },
    setMute: function (m) { muted = !!m; if (master) master.gain.value = muted ? 0 : volume; },
    update: function (dt, nearestEnemy, inCombat) {
      if (!ctx || !started) return;
      hornTimer += dt;
      if (hornTimer > 27) { horn(); hornTimer = 0; }
      if (droneGain && droneOsc) {
        var target = nearestEnemy < 2 ? 0 : (nearestEnemy < 28 ? .028 * (1 - nearestEnemy / 28) : 0);
        droneGain.gain.value += (target - droneGain.gain.value) * Math.min(1, dt * 3);
        droneOsc.frequency.value = 120 + (inCombat ? 24 : 0) + Math.sin(ctx.currentTime * 5) * 6;
      }
      if (ambience) ambience.rain.gain.value = .105 + Math.sin(ctx.currentTime * .4) * .012;
    },
    gunshot: function () {
      burst({ freq: 1900, q: .6, decay: .13, peak: .36, rate: 1.1 });
      burst({ freq: 260, q: 1.2, decay: .19, peak: .3, rate: .6, filter: 'lowpass' });
      tone(110, .12, 'triangle', .16, 48);
    },
    dryFire: function () { burst({ freq: 2600, q: 3, decay: .035, peak: .12 }); },
    shell: function () { burst({ freq: 4200, q: 2, decay: .05, peak: .07 }); },
    reloadOut: function () { burst({ freq: 900, q: 2.5, decay: .07, peak: .16 }); tone(320, .06, 'square', .045, 180); },
    reloadIn: function () { burst({ freq: 1400, q: 2, decay: .06, peak: .2 }); tone(210, .08, 'square', .05, 330); },
    bolt: function () { burst({ freq: 1700, q: 3, decay: .05, peak: .19 }); },
    hit: function () { tone(1350, .055, 'square', .075, 900); },
    kill: function () { burst({ freq: 420, q: .8, decay: .3, peak: .28, filter: 'lowpass' }); tone(180, .35, 'sawtooth', .1, 60); },
    impact: function () { burst({ freq: 3300, q: 2.5, decay: .045, peak: .075 }); },
    hurt: function () { burst({ freq: 300, q: .7, decay: .3, peak: .3, filter: 'lowpass' }); tone(70, .3, 'sine', .16, 45); },
    enemyShot: function () { tone(760, .16, 'sawtooth', .075, 240); burst({ freq: 2100, q: 3, decay: .08, peak: .06 }); },
    enemyAlert: function () { tone(520, .12, 'square', .06, 880); },
    houndStep: function () { burst({ freq: 240, q: 1.4, decay: .05, peak: .06, filter: 'lowpass' }); },
    relayLoop: function () { tone(440, .18, 'sine', .05, 660); },
    relayDone: function () { tone(300, .5, 'sine', .11, 120); burst({ freq: 600, q: 1, decay: .4, peak: .1, filter: 'lowpass' }); },
    radioBeep: function () { tone(1180, .045, 'square', .035); },
    ui: function () { tone(680, .045, 'sine', .045); },
    step: function (running) { burst({ freq: running ? 420 : 300, q: 1.1, decay: .07, peak: running ? .055 : .035, filter: 'lowpass' }); },
    victory: function () {
      [392, 523, 659, 784].forEach(function (f, i) { setTimeout(function () { tone(f, .55, 'sine', .09); }, i * 190); });
    },
    death: function () { tone(180, 1.1, 'sawtooth', .11, 48); }
  };

  HB.audio = api;
})(window.HB = window.HB || {});
