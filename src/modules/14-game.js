/* HARBOR BLACKOUT - settings, game state machine, boot sequence and main loop.
   Frame deltas are clamped after focus loss; all simulation uses dt. */
(function (HB) {
  'use strict';

  var U = HB.util;
  var DEFAULTS = {
    volume: 70, muted: false, sensitivity: 100, invertY: false,
    fov: 82, quality: 'medium', reducedShake: false, subtitles: true
  };
  var STORE_KEY = 'harbor-blackout-settings-v1';

  var settings = {
    values: Object.assign({}, DEFAULTS),
    load: function () {
      try {
        var raw = window.localStorage.getItem(STORE_KEY);
        if (!raw) return;
        var o = JSON.parse(raw);
        if (!o || typeof o !== 'object') return;
        var v = settings.values;
        if (Number.isFinite(o.volume)) v.volume = U.clamp(o.volume, 0, 100);
        if (Number.isFinite(o.sensitivity)) v.sensitivity = U.clamp(o.sensitivity, 20, 250);
        if (Number.isFinite(o.fov)) v.fov = U.clamp(o.fov, 65, 105);
        if (['low', 'medium', 'high'].indexOf(o.quality) >= 0) v.quality = o.quality;
        ['muted', 'invertY', 'reducedShake', 'subtitles'].forEach(function (k) {
          if (typeof o[k] === 'boolean') v[k] = o[k];
        });
      } catch (e) { /* Stored settings are optional. */ }
    },
    save: function () {
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(settings.values)); } catch (e) { /* ignore */ }
    },
    reset: function () { settings.values = Object.assign({}, DEFAULTS); settings.save(); },
    apply: function () {
      var v = settings.values;
      HB.audio.setVolume(v.volume / 100);
      HB.audio.setMute(v.muted);
      HB.input.setSensitivity(v.sensitivity / 100);
      HB.input.setInvertY(v.invertY);
      HB.player.setFov(v.fov);
      HB.player.setReducedShake(v.reducedShake);
      if (HB.render.state.renderer && HB.render.state.quality !== v.quality) {
        HB.render.applyQuality(v.quality);
      }
      HB.world.setRainCount(HB.render.settings().rain);
      if (HB.ui.syncOutputs) HB.ui.syncOutputs();
    }
  };
  HB.settings = settings;

  var G = {
    state: 'BOOT',
    player: null,
    stats: { shots: 0, hits: 0, kills: 0, relays: 0, time: 0 },
    retries: 0,
    time: 0,
    stages: [],
    stageIndex: 0,
    bootTimer: 0,
    bootLast: -1e9,
    introTime: 0,
    introStep: -1,
    victoryTime: 0,
    lastFrame: 0,
    frameTimes: [],
    booted: false,
    lowAmmoNotified: false,
    hintShown: false
  };

  var INTRO_LINES = [
    { t: .4, speaker: 'RADIO_CMD', line: 'R_INTRO_1' },
    { t: 3.3, speaker: 'RADIO_OPS', line: 'R_INTRO_2' },
    { t: 6.3, speaker: 'RADIO_TECH', line: 'R_INTRO_3' },
    { t: 9.3, speaker: 'RADIO_CMD', line: 'R_INTRO_4' }
  ];

  function resetMission() {
    HB.ui.resetTransient();
    HB.player.reset();
    HB.weapon.reset();
    HB.enemies.reset();
    HB.combat.reset();
    HB.objectives.reset(G);
    G.stats = { shots: 0, hits: 0, kills: 0, relays: 0, time: 0 };
    G.lowAmmoNotified = false;
    G.hintShown = false;
    HB.enemies.initialWave(G);
    HB.ui.lockedHint(false);
    HB.ui.radio('RADIO_CMD', 'R_START');
  }

  function setState(s) {
    G.state = s;
    HB.ui.setScreen(s);
    HB.render.setViewVisible(['PLAYING', 'PAUSED', 'SETTINGS', 'CONTROLS'].indexOf(s) >= 0);
    HB.input.setEnabled(s === 'PLAYING');
    if (s !== 'PLAYING') HB.input.releaseLock();
    if (s === 'PAUSED') HB.ui.pauseSubtitle();
    if (s === 'DEBRIEF') HB.ui.debrief(G.stats, G.retries);
    if (s === 'PLAYING') { HB.input.clear(); HB.audio.resumeAudio(); }
  }

  function startMission() {
    if (G.state === 'INTRO' || G.state === 'PLAYING' || G.state === 'PAUSED') return;
    HB.audio.start();
    G.retries = 0;
    resetMission();
    /* Pointer lock is requested only when active gameplay begins. */
    G.introTime = 0; G.introStep = -1;
    setState('INTRO');
    HB.audio.start();
  }

  /* Pointer lock is a desktop-only affordance; touch devices use their own
     look zone and must never be asked to capture the pointer. */
  function lockForDesktop() {
    if (HB.ui && HB.ui.isTouch && HB.ui.isTouch()) return;
    HB.input.requestLock();
  }

  function skipIntro() {
    if (G.state !== 'INTRO') return;
    setState('PLAYING');
    lockForDesktop();
    HB.ui.radio('RADIO_CMD', 'R_BEGIN');
  }

  function pause() {
    if (G.state !== 'PLAYING') return;
    setState('PAUSED');
  }

  function resume() {
    if (G.state !== 'PAUSED') return;
    setState('PLAYING');
    lockForDesktop();
  }

  function retry() {
    G.retries++;
    resetMission();
    setState('PLAYING');
    lockForDesktop();
  }

  function restart() {
    G.retries++;
    resetMission();
    setState('PLAYING');
    lockForDesktop();
  }

  function toTitle() {
    HB.ui.resetTransient();
    setState('TITLE');
  }

  function die() {
    if (G.state !== 'PLAYING') return;
    HB.ui.setDeathCause(HB.player.state.deathCause);
    HB.audio.death();
    HB.ui.radioNow('RADIO_CMD', 'R_DEATH');
    setState('DEAD');
  }

  function win() {
    if (G.state !== 'PLAYING') return;
    HB.audio.victory();
    G.victoryTime = 2.9;
    setState('VICTORY');
  }

  function titleCamera(dt) {
    var cam = HB.render.state.camera;
    var t = G.time;
    cam.position.set(10 + Math.sin(t * .11) * 16, 8.2 + Math.sin(t * .17) * .8, 30 + Math.cos(t * .11) * 9);
    cam.lookAt(0, 4.2, -22);
    var vm = HB.weapon.data;
    HB.render.state.viewCamera.rotation.set(0, 0, 0);
  }

  function introCamera(dt) {
    var cam = HB.render.state.camera;
    var t = U.clamp(G.introTime / 12.5, 0, 1);
    cam.position.set(Math.sin(t * 2.1) * 3.2, 3.4 - t * 1.0, 40 - t * 30);
    cam.lookAt(Math.sin(t * 3) * 2, 2.6, -18 - t * 22);
  }

  function updateIntro(dt) {
    G.introTime += dt;
    for (var i = 0; i < INTRO_LINES.length; i++) {
      if (G.introStep < i && G.introTime >= INTRO_LINES[i].t) {
        HB.ui.introRadio(INTRO_LINES[i].speaker, INTRO_LINES[i].line);
        G.introStep = i;
      }
    }
    if (G.introTime > 13) skipIntro();
  }

  /* Boot stages are paced by wall-clock timestamps, not by the clamped
     simulation delta. On a slow software renderer a single frame can take
     longer than a second; using clamped dt here would stall loading. */
  function processBoot(now) {
    if (now - G.bootLast < 90) return;
    G.bootLast = now;
    if (G.stageIndex >= G.stages.length) {
      finishBoot();
      return;
    }
    var stage = G.stages[G.stageIndex];
    try { stage.fn(); }
    catch (e) {
      console.error('[HARBOR BLACKOUT] boot failure', e);
      HB.ui.showError('ERROR_DETAIL_RUNTIME');
      G.state = 'ERROR';
      return;
    }
    G.stageIndex++;
    HB.ui.bootProgress(G.stageIndex / (G.stages.length + 1), stage.key);
  }

  function finishBoot() {
    if (G.booted) return;
    G.booted = true;
    HB.enemies.init();
    HB.combat.init();
    HB.weapon.init();
    HB.ui.buildMarkers();
    HB.player.reset();
    HB.settings.apply();
    HB.render.setPost('uDamage', 0);
    HB.ui.bootProgress(1, 'BOOT_STAGE_6');
    setState('TITLE');
  }

  /* The simulation uses fixed-size substeps. A single clamped delta made the
     whole mission run in slow motion on a slow renderer; splitting the same
     capped window keeps gameplay at real-time pacing without letting a huge
     delta after focus loss teleport the player or the enemies. */
  var MAX_STEP = .05;
  var MAX_CATCHUP = .3;

  function stepPlaying(dt) {
    G.stats.time += dt;
    HB.player.update(dt, HB.input, G);
    HB.weapon.update(dt, HB.input, HB.player.state, G);
    HB.objectives.update(dt, G);
    HB.enemies.update(dt, G);
    HB.combat.update(dt);
    if (HB.player.state.dead) { die(); return; }
    if (!G.hintShown && G.stats.time > 22 && HB.world.data.relays[0].state === 'online') {
      G.hintShown = true; HB.ui.radio('RADIO_TECH', 'R_HINT_SHED');
    }
    var ammo = HB.weapon.data.mag + HB.weapon.data.reserve;
    if (!G.lowAmmoNotified && ammo < 45) { G.lowAmmoNotified = true; HB.ui.radio('RADIO_OPS', 'R_LOW_AMMO'); }
  }

  function frame(now) {
    window.requestAnimationFrame(frame);
    var elapsed = (now - G.lastFrame) / 1000;
    if (!isFinite(elapsed) || elapsed < 0) elapsed = .016;
    G.lastFrame = now;
    /* Record the real frame duration, not the clamped simulation delta. */
    G.frameTimes.push(elapsed * 1000);
    if (G.frameTimes.length > 600) G.frameTimes.shift();

    var total = Math.min(elapsed, MAX_CATCHUP);
    var steps = Math.max(1, Math.min(Math.ceil(MAX_CATCHUP / MAX_STEP), Math.ceil(total / MAX_STEP)));
    var dt = total / steps;

    if (G.state === 'BOOT') {
      processBoot(now);
    } else if (G.state === 'TITLE') {
      G.time += total;
      HB.render.setPost('uTime', G.time);
      titleCamera(total);
      HB.world.update(total, HB.render.state.camera, G.time);
    } else if (G.state === 'INTRO') {
      for (var i = 0; i < steps; i++) { G.time += dt; updateIntro(dt); }
      HB.render.setPost('uTime', G.time);
      introCamera(total);
      HB.world.update(total, HB.render.state.camera, G.time);
    } else if (G.state === 'PLAYING') {
      for (var s = 0; s < steps; s++) {
        G.time += dt;
        stepPlaying(dt);
        if (G.state !== 'PLAYING') break;
      }
      HB.render.setPost('uTime', G.time);
      HB.world.update(total, HB.render.state.camera, G.time);
      HB.ui.update(G, total);
      HB.audio.update(total, HB.enemies.nearestDistance(), HB.enemies.count() > 0);
    } else if (G.state === 'VICTORY') {
      G.time += total;
      G.victoryTime -= total;
      HB.combat.update(total);
      HB.world.update(total, HB.render.state.camera, G.time);
      HB.render.setPost('uTime', G.time);
      var cam = HB.render.state.camera;
      cam.position.y = U.damp(cam.position.y, 3.4, 2, total);
      cam.rotation.z += total * .035;
      if (G.victoryTime <= 0) setState('DEBRIEF');
    } else {
      G.time += total;
      HB.combat.update(total * .25);
      HB.world.update(total * .25, HB.render.state.camera, G.time);
      HB.render.setPost('uTime', G.time);
    }
    /* The opaque boot overlay covers the canvas; skip GPU work while the
       world is still being assembled so loading stays responsive. */
    if (G.state !== 'BOOT' && G.state !== 'ERROR') HB.render.render();
  }

  function handleEscape() {
    if (G.state === 'PLAYING') pause();
    else if (G.state === 'PAUSED') resume();
    else if (G.state === 'SETTINGS') setState('TITLE');
    else if (G.state === 'CONTROLS') setState('TITLE');
    else if (G.state === 'INTRO') skipIntro();
  }

  function perf() {
    var a = G.frameTimes.slice(-240);
    if (!a.length) return { samples: 0 };
    var sum = 0;
    for (var i = 0; i < a.length; i++) sum += a[i];
    var sorted = a.slice().sort(function (x, y) { return x - y; });
    var avg = sum / a.length;
    var gl = HB.render.state.renderer.getContext();
    var dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      samples: a.length,
      avgFrameMs: +avg.toFixed(2),
      avgFps: +(1000 / avg).toFixed(1),
      p95FrameMs: +sorted[Math.floor(sorted.length * .95)].toFixed(2),
      maxFrameMs: +sorted[sorted.length - 1].toFixed(2),
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      quality: HB.render.state.quality,
      resolution: HB.render.state.width + 'x' + HB.render.state.height
    };
  }

  function init() {
    var canvas = document.getElementById('viewport');
    settings.load();
    HB.ui.init(HB.game);
    /* Feature detection before constructing the renderer. */
    var gl = null;
    try {
      var probe = document.createElement('canvas');
      gl = probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl');
    } catch (e) { gl = null; }
    if (!gl) {
      HB.ui.showError('ERROR_DETAIL_WEBGL');
      G.state = 'ERROR';
      return;
    }
    try { HB.render.create(canvas, settings.values.quality); }
    catch (e) {
      console.error('[HARBOR BLACKOUT] renderer failure', e);
      HB.ui.showError('ERROR_DETAIL_CONTEXT'); G.state = 'ERROR'; return;
    }
    G.player = HB.player.state;
    G.player.position = HB.player.position;
    HB.input.bind(canvas, {
      onLockLost: function () { if (G.state === 'PLAYING') pause(); },
      onBlur: function () { if (G.state === 'PLAYING') pause(); },
      onEscape: handleEscape
    });
    settings.apply();
    G.stages = [{ key: 'BOOT_STAGE_0', fn: function () { /* renderer ready */ } }].concat(HB.world.stages(HB.render.state.scene));
    HB.ui.bootProgress(0, 'BOOT_STAGE_0');
    window.addEventListener('resize', function () { HB.render.resize(); });
    /* A suspended tab must not accumulate a delta that the next frame tries
       to catch up; the loop also caps total catch-up as a second guard. */
    function resyncClock() { G.lastFrame = performance.now(); }
    window.addEventListener('focus', resyncClock);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) resyncClock(); });
    window.addEventListener('keydown', function (e) {
      if (G.state === 'INTRO' && e.code !== 'Escape') skipIntro();
    });
    window.addEventListener('error', function (ev) {
      console.error('[HARBOR BLACKOUT] runtime error', ev.error || ev.message);
    });
    G.lastFrame = performance.now();
    window.requestAnimationFrame(frame);
  }

  HB.game = {
    state: G,
    init: init,
    setState: setState,
    startMission: startMission,
    skipIntro: skipIntro,
    pause: pause,
    resume: resume,
    retry: retry,
    restart: restart,
    toTitle: toTitle,
    win: win,
    die: die,
    perf: perf
  };
})(window.HB = window.HB || {});
