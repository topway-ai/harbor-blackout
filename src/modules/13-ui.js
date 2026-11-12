/* HARBOR BLACKOUT - tactical HUD, screens, settings, subtitles and touch UI.
   Every visible phrase is set from the English catalog via text(); no screen
   writes a literal user-facing string of its own. */
(function (HB) {
  'use strict';

  var U = HB.util;
  var el = {};
  var game = null;
  var compassItems = [];
  var markerEls = [];
  var radioQueue = [];
  var radioTimer = 0;
  var toastTimer = 0;
  var flashLevel = 0;
  var waveTimer = 0;
  var locked = false;
  var introRadioEl = null;
  var settingsReturn = 'TITLE';
  var controlsReturn = 'TITLE';
  var touchMode = false;
  var subtitlesOn = true;

  var DIRS = [
    { a: 0, key: 'COMPASS_N' }, { a: 45, key: 'COMPASS_NE' },
    { a: 90, key: 'COMPASS_E' }, { a: 135, key: 'COMPASS_SE' },
    { a: 180, key: 'COMPASS_S' }, { a: 225, key: 'COMPASS_SW' },
    { a: 270, key: 'COMPASS_W' }, { a: 315, key: 'COMPASS_NW' }
  ];

  function $(id) { return document.getElementById(id); }

  function text(node, key) {
    if (!node) return;
    var args = Array.prototype.slice.call(arguments, 2);
    node.textContent = HB.t.apply(null, [key].concat(args));
  }

  function localize() {
    document.documentElement.setAttribute('lang', 'en');
    document.title = HB.t('DOC_TITLE');
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', HB.t('DOC_DESCRIPTION'));
    $('viewport').setAttribute('aria-label', HB.t('A11Y_VIEWPORT'));
    var all = document.querySelectorAll('[data-key]');
    for (var i = 0; i < all.length; i++) text(all[i], all[i].getAttribute('data-key'));
    var aria = document.querySelectorAll('[data-aria-key]');
    for (var j = 0; j < aria.length; j++) aria[j].setAttribute('aria-label', HB.t(aria[j].getAttribute('data-aria-key')));
  }

  function fillLegends() {
    var pairs = [
      ['LEG_MOVE', 'LEG_MOVE_ACT'], ['LEG_LOOK', 'LEG_LOOK_ACT'],
      ['LEG_FIRE', 'LEG_FIRE_ACT'], ['LEG_ADS', 'LEG_ADS_ACT'],
      ['LEG_INTERACT', 'LEG_INTERACT_ACT'], ['LEG_SPRINT', 'LEG_SPRINT_ACT'],
      ['LEG_CROUCH', 'LEG_CROUCH_ACT'], ['LEG_JUMP', 'LEG_JUMP_ACT'],
      ['LEG_RELOAD', 'LEG_RELOAD_ACT'], ['LEG_PAUSE', 'LEG_PAUSE_ACT']
    ];
    var keys = $('legend-keys'), acts = $('legend-actions');
    pairs.forEach(function (p, i) {
      var row = document.createElement('div');
      var b = document.createElement('b'); b.textContent = HB.t(p[0]);
      var s = document.createElement('span'); s.textContent = HB.t(p[1]);
      row.appendChild(b); row.appendChild(s);
      (i % 2 === 0 ? keys : acts).appendChild(row);
    });
    var grid = $('controls-grid');
    pairs.forEach(function (p) {
      var d = document.createElement('div'); d.className = 'ctrl';
      var label = document.createElement('span'); label.textContent = HB.t(p[1]);
      var key = document.createElement('b'); key.textContent = HB.t(p[0]);
      d.appendChild(label); d.appendChild(key); grid.appendChild(d);
    });
  }

  function buildCompass() {
    var track = $('compass-track');
    for (var t = 0; t < 24; t++) {
      var tick = document.createElement('i');
      tick.className = 'tick';
      compassItems.push({ node: tick, angle: t * 15, cardinal: false });
      track.appendChild(tick);
    }
    DIRS.forEach(function (d) {
      var n = document.createElement('i');
      if (d.a % 90 === 0) n.className = 'cardinal';
      n.textContent = HB.t(d.key);
      compassItems.push({ node: n, angle: d.a, cardinal: true, key: d.key });
      track.appendChild(n);
    });
  }

  function buildMarkers() {
    var layer = $('markers');
    var defs = HB.objectives.markers();
    defs.forEach(function (d) {
      var n = document.createElement('div');
      n.className = 'marker';
      var dia = document.createElement('div'); dia.className = 'diamond';
      var title = document.createElement('div'); title.className = 'mtitle'; title.textContent = HB.t(d.key);
      var dist = document.createElement('div'); dist.className = 'mdist';
      n.appendChild(dia); n.appendChild(title); n.appendChild(dist);
      layer.appendChild(n);
      markerEls.push({ node: n, dist: dist, key: d.key });
    });
  }

  function setScreen(state) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
    var map = {
      BOOT: ['boot'], TITLE: ['title'], INTRO: ['intro'],
      PLAYING: ['hud'], PAUSED: ['hud', 'pause'], SETTINGS: ['settings'],
      CONTROLS: ['controls'], DEAD: ['hud', 'death'],
      VICTORY: ['victory'], DEBRIEF: ['debrief'], ERROR: ['error']
    };
    (map[state] || []).forEach(function (id) { $(id).classList.add('active'); });
    if (state === 'PLAYING' && touchMode) $('touch').classList.add('active');
    $('letterbox').classList.toggle('on', state === 'INTRO' || state === 'VICTORY');
    document.body.classList.toggle('in-game', state === 'PLAYING' || state === 'PAUSED');
  }

  function bootProgress(fraction, stageKey) {
    $('boot-fill').style.width = Math.round(fraction * 100) + '%';
    text($('boot-stage'), stageKey);
  }

  /* ---------------------------- transient feedback ---------------------- */
  function toast(key, arg) {
    var n = $('toast');
    text(n, key, arg === undefined ? '' : arg);
    n.classList.add('show');
    toastTimer = 2.2;
  }

  function radio(speakerKey, lineKey) {
    if (!subtitlesOn) return;
    radioQueue.push({ speaker: speakerKey, line: lineKey });
    HB.audio.radioBeep();
  }

  function introRadio(speakerKey, lineKey) {
    if (!introRadioEl) introRadioEl = $('intro-radio');
    introRadioEl.textContent = '';
    var b = document.createElement('b'); b.textContent = HB.t(speakerKey);
    introRadioEl.appendChild(b);
    introRadioEl.appendChild(document.createTextNode(HB.t(lineKey)));
    HB.audio.radioBeep();
  }

  /* Terminal lines are displayed at once. The subtitle queue is drained only
     while the HUD updates, so a line queued immediately before victory or death
     would never be shown and could resurface in the next mission. */
  function radioNow(speakerKey, lineKey) {
    radioQueue.length = 0;
    radioTimer = 0;
    if (!subtitlesOn) { $('radio').classList.remove('show'); return; }
    text($('radio-speaker'), speakerKey);
    text($('radio-text'), lineKey);
    $('radio').classList.add('show');
    HB.audio.radioBeep();
  }

  /* Every new mission starts with a clean HUD: no queued subtitles, no stale
     interaction prompt, no inherited kill feed, wave banner or damage arc. */
  function resetTransient() {
    radioQueue.length = 0;
    radioTimer = 0;
    toastTimer = 0;
    waveTimer = 0;
    flashLevel = 0;
    locked = false;
    ['radio', 'toast', 'wave-warning', 'interaction', 'hitmarker', 'look-hint'].forEach(function (id) {
      $(id).classList.remove('show');
    });
    $('radio-speaker').textContent = '';
    $('radio-text').textContent = '';
    $('toast').textContent = '';
    $('killfeed').textContent = '';
    $('damage-arcs').textContent = '';
    if (introRadioEl) introRadioEl.textContent = '';
    if (HB.render && HB.render.setPost) HB.render.setPost('uDamage', 0);
  }

  function hitMarker(kill) {
    var n = $('hitmarker');
    n.classList.remove('show'); n.classList.toggle('kill', !!kill);
    void n.offsetWidth;
    n.classList.add('show');
  }

  function killFeed(enemyKey) {
    var feed = $('killfeed');
    var d = document.createElement('div');
    d.className = 'kf';
    d.textContent = HB.t('KILL_FEED', HB.t(enemyKey));
    feed.appendChild(d);
    while (feed.children.length > 4) feed.removeChild(feed.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 3600);
  }

  function damageArc(angle) {
    var n = document.createElement('div');
    n.className = 'dmg-arc show';
    n.style.transform = 'rotate(' + (angle * 180 / Math.PI) + 'deg)';
    $('damage-arcs').appendChild(n);
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 780);
  }

  function damageFlash(v) { flashLevel = Math.max(flashLevel, v); }

  function waveWarning(key, dur) {
    text($('wave-name'), key);
    $('wave-warning').classList.add('show');
    waveTimer = dur || 3;
  }

  function objectivePulse() {
    var n = $('obj-title');
    n.style.color = 'var(--signal)';
    setTimeout(function () { n.style.color = ''; }, 900);
  }

  function lockedHint(v) { locked = v; }

  function interaction(target, progress, key) {
    var n = $('interaction');
    if (!target && !locked) { n.classList.remove('show'); return; }
    n.classList.add('show');
    if (target && key) {
      text($('interaction-label'), key);
      text($('interaction-hint'), 'INT_HINT');
      $('interaction-fill').style.width = Math.round(progress * 100) + '%';
      $('interaction-fill').style.background = 'var(--signal)';
    } else {
      text($('interaction-label'), 'INT_LOCKED');
      $('interaction-hint').textContent = HB.t('INT_HINT');
      $('interaction-fill').style.width = '0%';
      $('interaction-fill').style.background = 'var(--alarm)';
    }
  }

  /* ---------------------------- per-frame HUD --------------------------- */
  function updateCompass(yaw) {
    var heading = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
    for (var i = 0; i < compassItems.length; i++) {
      var it = compassItems[i];
      var d = U.angleWrap((it.angle - heading) * Math.PI / 180) * 180 / Math.PI;
      if (Math.abs(d) > 60) { it.node.style.display = 'none'; continue; }
      it.node.style.display = 'block';
      it.node.style.left = (50 + d / 1.2) + '%';
      if (it.cardinal) it.node.style.transform = 'translateX(-50%)';
    }
    var idx = Math.round(heading / 45) % 8;
    text($('compass-head'), DIRS[idx].key);
  }

  function updateMarkers(camera) {
    var defs = HB.objectives.markers();
    var w = window.innerWidth, h = window.innerHeight;
    var P = HB.player.state;
    var v = new THREE.Vector3();
    for (var i = 0; i < markerEls.length; i++) {
      var m = markerEls[i], d = defs[i];
      if (!d) continue;
      var visible = d.type === 'boat' ? d.visible : true;
      if (!visible) { m.node.style.display = 'none'; continue; }
      v.copy(d.pos).project(camera);
      var dist = U.dist2(P.x, P.z, d.pos.x, d.pos.z);
      if (v.z > 1 || v.z < -1 || dist > 190) { m.node.classList.add('offscreen'); }
      else {
        m.node.classList.remove('offscreen');
        m.node.style.left = ((v.x * .5 + .5) * w) + 'px';
        m.node.style.top = ((-v.y * .5 + .5) * h - 26) + 'px';
        m.dist.textContent = Math.round(dist) + ' ' + HB.t('MARKER_UNIT');
      }
      m.node.classList.toggle('done', !!d.done);
      m.node.style.display = 'block';
    }
  }

  function update(gameRef, dt) {
    var P = HB.player.state;
    var S = HB.weapon.data;
    if (gameRef.state !== 'PLAYING' && gameRef.state !== 'PAUSED' && gameRef.state !== 'DEAD') return;

    updateCompass(P.yaw);
    updateMarkers(HB.render.state.camera);

    var st = HB.objectives.status();
    text($('obj-title'), st.titleKey);
    text($('obj-detail'), st.detailKey);
    var pips = $('relay-pips').children;
    var rs = HB.world.data.relays;
    for (var i = 0; i < pips.length; i++) {
      pips[i].className = '';
      if (rs[i] && rs[i].state === 'disabled') pips[i].className = 'done';
      else if (rs[i] && rs[i].progress > 0) pips[i].className = 'active';
    }
    $('ammo-mag').textContent = String(S.mag);
    $('ammo-reserve').textContent = String(S.reserve);
    text($('weapon-label'), 'WEAPON_NAME');
    var hint = S.reloading ? 'RELOADING' : (S.mag === 0 ? (S.reserve > 0 ? 'EMPTY' : 'NO_RESERVE') : (S.mag <= 6 ? 'RELOAD_HINT' : ''));
    if (hint) text($('reload-hint'), hint); else $('reload-hint').textContent = '';
    $('health-num').textContent = String(Math.ceil(P.health));
    $('health-fill').style.width = (P.health / P.maxHealth * 100) + '%';
    $('health-fill').parentNode.classList.toggle('low', P.health < 35);
    $('crosshair').classList.toggle('ads', P.ads);

    /* Damage vignette through post-processing. */
    flashLevel = Math.max(0, flashLevel - dt * 2.6);
    HB.render.setPost('uDamage', flashLevel);
    HB.render.setPost('uHealth', P.health / 100);
    HB.render.setPost('uAds', P.ads ? 1 : 0);
    HB.render.setPost('uTime', HB.world.data.time);

    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('show'); }
    if (waveTimer > 0) { waveTimer -= dt; if (waveTimer <= 0) $('wave-warning').classList.remove('show'); }

    /* Radio subtitle queue. */
    var r = $('radio');
    if (radioTimer > 0) radioTimer -= dt;
    if (radioTimer <= 0) {
      if (radioQueue.length) {
        var q = radioQueue.shift();
        text($('radio-speaker'), q.speaker);
        text($('radio-text'), q.line);
        r.classList.add('show');
        radioTimer = Math.max(3.4, HB.t(q.line).length * .055);
      } else r.classList.remove('show');
    }

    var hintEl = $('look-hint');
    if (!HB.input.isLocked() && HB.input.state.fallback) {
      text(hintEl, 'LOOK_HINT'); hintEl.classList.add('show');
    } else hintEl.classList.remove('show');
  }

  /* ---------------------------- settings -------------------------------- */
  function bindSettings(g) {
    var s = HB.settings.values;
    $('set-volume').value = String(s.volume);
    $('set-mute').checked = s.muted;
    $('set-sens').value = String(s.sensitivity);
    $('set-invert').checked = s.invertY;
    $('set-fov').value = String(s.fov);
    $('set-quality').value = s.quality;
    $('set-shake').checked = s.reducedShake;
    $('set-subs').checked = s.subtitles;
    syncOutputs();

    $('set-volume').addEventListener('input', function () { s.volume = +this.value; HB.settings.save(); HB.settings.apply(); syncOutputs(); });
    $('set-mute').addEventListener('change', function () { s.muted = this.checked; HB.settings.save(); HB.settings.apply(); syncOutputs(); });
    $('set-sens').addEventListener('input', function () { s.sensitivity = +this.value; HB.settings.save(); HB.settings.apply(); syncOutputs(); });
    $('set-invert').addEventListener('change', function () { s.invertY = this.checked; HB.settings.save(); HB.settings.apply(); syncOutputs(); });
    $('set-fov').addEventListener('input', function () { s.fov = +this.value; HB.settings.save(); HB.settings.apply(); syncOutputs(); });
    $('set-quality').addEventListener('change', function () { s.quality = this.value; HB.settings.save(); HB.settings.apply(); syncOutputs(); });
    $('set-shake').addEventListener('change', function () { s.reducedShake = this.checked; HB.settings.save(); HB.settings.apply(); syncOutputs(); });
    $('set-subs').addEventListener('change', function () { s.subtitles = this.checked; HB.settings.save(); HB.settings.apply(); syncOutputs(); });
    $('btn-settings-reset').addEventListener('click', function () {
      HB.settings.reset(); HB.settings.apply();
      var v = HB.settings.values;
      $('set-volume').value = v.volume; $('set-mute').checked = v.muted;
      $('set-sens').value = v.sensitivity; $('set-invert').checked = v.invertY;
      $('set-fov').value = v.fov; $('set-quality').value = v.quality;
      $('set-shake').checked = v.reducedShake; $('set-subs').checked = v.subtitles;
      syncOutputs(); HB.audio.ui(); toast('TOAST_SAVED');
    });
  }

  function syncOutputs() {
    var s = HB.settings.values;
    $('out-volume').textContent = String(s.volume);
    $('out-mute').textContent = HB.t(s.muted ? 'OUT_ON' : 'OUT_OFF');
    $('out-sens').textContent = String(s.sensitivity);
    $('out-invert').textContent = HB.t(s.invertY ? 'OUT_ON' : 'OUT_OFF');
    $('out-fov').textContent = String(s.fov);
    $('out-shake').textContent = HB.t(s.reducedShake ? 'OUT_ON' : 'OUT_OFF');
    $('out-subs').textContent = HB.t(s.subtitles ? 'OUT_ON' : 'OUT_OFF');
    subtitlesOn = s.subtitles;
  }

  /* ---------------------------- touch ----------------------------------- */
  function bindTouch() {
    var stick = $('touch-stick'), knob = $('touch-stick-knob');
    var stickId = null, cx = 0, cy = 0;
    function stickStart(e) {
      var t = e.changedTouches ? e.changedTouches[0] : e;
      stickId = t.identifier || 'mouse';
      var r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      stickMove(e);
    }
    function stickMove(e) {
      var list = e.changedTouches || [e];
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        if (stickId !== null && (t.identifier || 'mouse') !== stickId) continue;
        var dx = t.clientX - cx, dy = t.clientY - cy;
        var len = Math.hypot(dx, dy), max = 44;
        if (len > max) { dx *= max / len; dy *= max / len; }
        knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        HB.input.state.touch.moveX = dx / max;
        HB.input.state.touch.moveY = dy / max;
      }
      if (e.cancelable) e.preventDefault();
    }
    function stickEnd(e) {
      stickId = null;
      knob.style.transform = '';
      HB.input.state.touch.moveX = 0; HB.input.state.touch.moveY = 0;
    }
    stick.addEventListener('touchstart', stickStart, { passive: false });
    stick.addEventListener('touchmove', stickMove, { passive: false });
    stick.addEventListener('touchend', stickEnd);
    stick.addEventListener('touchcancel', stickEnd);
    stick.addEventListener('mousedown', stickStart);
    window.addEventListener('mousemove', function (e) { if (stickId === 'mouse') stickMove(e); });
    window.addEventListener('mouseup', function () { if (stickId === 'mouse') stickEnd(); });

    var look = $('touch-look'), lookId = null, lx = 0, ly = 0;
    look.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY;
    }, { passive: true });
    look.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier !== lookId) continue;
        HB.input.lookDelta((t.clientX - lx) * 1.6, (t.clientY - ly) * 1.6);
        lx = t.clientX; ly = t.clientY;
      }
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    look.addEventListener('touchend', function () { lookId = null; });

    var buttons = [
      ['tb-fire', 'fire'], ['tb-aim', 'aim'], ['tb-reload', 'reload'],
      ['tb-jump', 'jump'], ['tb-crouch', 'crouch'], ['tb-interact', 'interact'],
      ['tb-sprint', 'sprint']
    ];
    buttons.forEach(function (pair) {
      var b = $(pair[0]), field = pair[1];
      function down(e) {
        HB.input.state.touch[field] = true;
        b.classList.add('down');
        if (e.cancelable) e.preventDefault();
      }
      function up(e) {
        HB.input.state.touch[field] = false;
        b.classList.remove('down');
        if (e.cancelable) e.preventDefault();
      }
      b.addEventListener('touchstart', down, { passive: false });
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('touchcancel', up);
      b.addEventListener('mousedown', down);
      b.addEventListener('mouseup', up);
      b.addEventListener('mouseleave', up);
    });
  }

  /* ---------------------------- buttons --------------------------------- */
  function bindButtons(g) {
    function on(id, fn) {
      $(id).addEventListener('click', function (e) {
        /* Keep keyboard focus off menu buttons: Space must not re-trigger the
           focused button while the player is in the mission. */
        if (e.currentTarget && e.currentTarget.blur) e.currentTarget.blur();
        HB.audio.ui();
        fn();
      });
    }
    on('btn-begin', function () { g.startMission(); });
    on('btn-settings-title', function () { settingsReturn = 'TITLE'; g.setState('SETTINGS'); });
    on('btn-controls-title', function () { controlsReturn = 'TITLE'; g.setState('CONTROLS'); });
    on('btn-skip', function () { g.skipIntro(); });
    on('btn-resume', function () { g.resume(); });
    on('btn-settings-pause', function () { settingsReturn = 'PAUSED'; g.setState('SETTINGS'); });
    on('btn-controls-pause', function () { controlsReturn = 'PAUSED'; g.setState('CONTROLS'); });
    on('btn-restart-pause', function () { g.restart(); });
    on('btn-quit-pause', function () { g.toTitle(); });
    on('btn-quit-death', function () { g.toTitle(); });
    on('btn-retry', function () { g.retry(); });
    on('btn-debrief-retry', function () { g.restart(); });
    on('btn-debrief-title', function () { g.toTitle(); });
    on('btn-settings-back', function () { g.setState(settingsReturn); });
    on('btn-controls-back', function () { g.setState(controlsReturn); });
    $('intro').addEventListener('click', function (e) { if (e.target === this) g.skipIntro(); });
  }

  function debrief(stats, retries) {
    var accuracy = stats.shots ? Math.round(stats.hits / stats.shots * 100) : 0;
    $('stat-time').textContent = U.formatTime(stats.time);
    $('stat-accuracy').textContent = accuracy + '%';
    $('stat-kills').textContent = String(stats.kills);
    $('stat-shots').textContent = String(stats.shots);
    $('stat-retries').textContent = String(retries);
    $('stat-relays').textContent = String(stats.relays) + ' / 3';
    text($('stat-rating'), accuracy >= 55 ? 'RATING_S' : (accuracy >= 38 ? 'RATING_A' : (stats.retries === 0 ? 'RATING_B' : 'RATING_C')));
  }

  function pauseSubtitle() { text($('pause-sub'), 'PAUSE_SUB'); }
  function setDeathCause(key) { text($('death-cause'), key); }
  function showError(detailKey) { text($('error-detail'), detailKey); setScreen('ERROR'); }

  function init(g) {
    game = g;
    touchMode = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0 || window.innerWidth < 720;
    document.body.classList.toggle('touch-mode', touchMode);
    localize();
    fillLegends();
    buildCompass();
    bindButtons(g);
    bindSettings(g);
    if (touchMode) bindTouch();
    HB.strings.installObserver();
    var audit = HB.strings.audit();
    if (audit.violations.length) console.error('[HARBOR BLACKOUT] language audit', audit.violations);
    return audit;
  }

  HB.ui = {
    init: init,
    localize: localize,
    setScreen: setScreen,
    bootProgress: bootProgress,
    update: update,
    text: text,
    toast: toast,
    radio: radio,
    radioNow: radioNow,
    resetTransient: resetTransient,
    introRadio: introRadio,
    hitMarker: hitMarker,
    killFeed: killFeed,
    damageArc: damageArc,
    damageFlash: damageFlash,
    waveWarning: waveWarning,
    objectivePulse: objectivePulse,
    lockedHint: lockedHint,
    interaction: interaction,
    buildMarkers: buildMarkers,
    debrief: debrief,
    pauseSubtitle: pauseSubtitle,
    setDeathCause: setDeathCause,
    showError: showError,
    syncOutputs: syncOutputs,
    isTouch: function () { return touchMode; }
  };
})(window.HB = window.HB || {});
