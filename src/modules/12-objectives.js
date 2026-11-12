/* HARBOR BLACKOUT - relay shutdown, reinforcement escalation and extraction.
   Interactions are hold-to-complete, show progress, and decay when interrupted
   by releasing the key, moving away, looking away or taking damage. */
(function (HB) {
  'use strict';

  var U = HB.util;
  var O = {
    current: null, progress: 0, waveIndex: 0,
    wavePending: null, waveDelay: 0, extractionActive: false,
    lastDamageSeen: -99, completedCount: 0, interrupted: false
  };

  var WAVE_SPECS = [
    ['hound', 'drone', 'hound'],
    ['hound', 'hound', 'drone', 'drone'],
    ['hound', 'drone', 'hound', 'drone', 'hound']
  ];
  var WAVE_KEYS = ['WAVE_1', 'WAVE_2', 'WAVE_3'];
  var RADIO_KEYS = ['R_WAVE_1', 'R_WAVE_2', 'R_WAVE_3'];
  var RELAY_RADIO = ['R_RELAY_1', 'R_RELAY_2', 'R_RELAY_3'];
  var RELAY_MARKERS = ['MARKER_RELAY_A', 'MARKER_RELAY_B', 'MARKER_RELAY_C'];
  var RELAY_INT = ['INT_RELAY_A', 'INT_RELAY_B', 'INT_RELAY_C'];
  var RELAY_DETAIL = ['OBJ_DETAIL_A', 'OBJ_DETAIL_B', 'OBJ_DETAIL_C'];

  function relays() { return HB.world.data.relays; }
  function caches() { return HB.world.data.ammoCaches; }

  function reset(game) {
    var rs = relays();
    for (var i = 0; i < rs.length; i++) {
      rs[i].state = 'online'; rs[i].progress = 0;
      HB.world.setRelayVisual(i, false);
    }
    var cs = caches();
    for (var c = 0; c < cs.length; c++) if (cs[c]) cs[c].used = false;
    HB.world.data.extraction.active = false;
    HB.world.data.extraction.progress = 0;
    O.current = null; O.progress = 0; O.waveIndex = 0;
    O.wavePending = null; O.waveDelay = 0; O.extractionActive = false;
    O.completedCount = 0; O.interrupted = false;
    O.lastDamageSeen = HB.player.state.lastDamage;
  }

  function nearestTarget() {
    var P = HB.player.state;
    var fwd = HB.player.forward();
    var rs = relays();
    var best = null, bestScore = Infinity;
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      if (r.state !== 'online') continue;
      var dx = r.x - P.x, dz = r.z - P.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d > 3.1) continue;
      var dot = (dx * fwd.x + dz * fwd.z) / Math.max(.001, d * Math.hypot(fwd.x, fwd.z));
      if (dot < -.15) continue;
      if (d < bestScore) {
        bestScore = d;
        best = { type: 'relay', index: i, key: RELAY_INT[i], hold: r.holdTime, object: r };
      }
    }
    var cs = caches();
    for (var c = 0; c < cs.length; c++) {
      var a = cs[c];
      if (!a || a.used) continue;
      var d2 = U.dist2(P.x, P.z, a.x, a.z);
      if (d2 < 2.6 && d2 < bestScore) {
        bestScore = d2;
        best = { type: 'ammo', index: c, key: 'INT_AMMO', hold: .55, object: a };
      }
    }
    var ex = HB.world.data.extraction;
    if (ex.active) {
      var d3 = U.dist2(P.x, P.z, ex.x, ex.z);
      if (d3 < ex.radius && d3 < bestScore) {
        bestScore = d3;
        best = { type: 'extract', index: -1, key: 'INT_BOARD', hold: ex.holdTime, object: ex };
      }
    } else if (U.dist2(P.x, P.z, ex.x, ex.z) < ex.radius) {
      HB.ui.lockedHint(true);
    } else HB.ui.lockedHint(false);
    return best;
  }

  function finishRelay(index, game) {
    var r = relays()[index];
    r.state = 'disabled'; r.progress = 1;
    HB.world.setRelayVisual(index, true);
    O.completedCount++;
    if (game && game.stats) game.stats.relays = O.completedCount;
    HB.audio.relayDone();
    HB.ui.toast('TOAST_RELAY_DONE', String.fromCharCode(65 + index));
    HB.ui.radio('RADIO_CMD', RELAY_RADIO[index]);
    HB.ui.objectivePulse();
    if (O.waveIndex < WAVE_SPECS.length) {
      O.wavePending = WAVE_SPECS[O.waveIndex];
      O.waveDelay = 1.7;
      HB.ui.waveWarning(WAVE_KEYS[O.waveIndex], 3.2);
      HB.ui.radio('RADIO_OPS', RADIO_KEYS[O.waveIndex]);
      HB.audio.enemyAlert();
      O.waveIndex++;
    }
    if (O.completedCount === 3) {
      HB.world.data.extraction.active = true;
      O.extractionActive = true;
      HB.ui.toast('TOAST_EXTRACT_OPEN');
      HB.ui.radio('RADIO_PILOT', 'R_ALL_DONE');
    }
  }

  function update(dt, game) {
    var input = HB.input;
    var target = nearestTarget();
    var holding = input.actionDown('INTERACT');
    var damaged = HB.player.state.lastDamage !== O.lastDamageSeen;
    O.lastDamageSeen = HB.player.state.lastDamage;

    if (O.wavePending) {
      O.waveDelay -= dt;
      if (O.waveDelay <= 0) {
        HB.enemies.spawnWave(O.wavePending, game);
        O.wavePending = null;
      }
    }

    if (target && holding) {
      if (!O.current || O.current.type !== target.type || O.current.index !== target.index) {
        O.current = target; O.progress = 0; O.interrupted = false;
      }
      O.progress += dt / target.hold * (damaged ? .45 : 1);
      if (damaged) O.progress = Math.max(0, O.progress - .06);
      if (target.type === 'relay' && Math.floor(O.progress * 8) !== Math.floor((O.progress - dt / target.hold) * 8)) HB.audio.relayLoop();
      if (O.progress >= 1) {
        O.progress = 1;
        if (target.type === 'relay') finishRelay(target.index, game);
        else if (target.type === 'ammo') {
          target.object.used = true;
          HB.weapon.addAmmo(60);
          HB.ui.toast('TOAST_AMMO');
          HB.audio.ui();
        } else if (target.type === 'extract') {
          HB.ui.radioNow('RADIO_PILOT', 'R_VICTORY');
          HB.game.win();
        }
        O.current = null; O.progress = 0;
      }
    } else {
      if (O.progress > .12 && !O.interrupted) {
        O.interrupted = true;
        HB.ui.toast('TOAST_LINK_LOST');
      }
      O.progress = Math.max(0, O.progress - dt * .55);
      if (O.progress === 0) O.current = null;
    }
    HB.ui.interaction(target, holding ? O.progress : O.progress, target ? target.key : null);
  }

  function markers() {
    var out = [];
    var rs = relays();
    for (var i = 0; i < rs.length; i++) {
      out.push({ key: RELAY_MARKERS[i], pos: rs[i].marker, done: rs[i].state === 'disabled', type: 'relay' });
    }
    var ex = HB.world.data.extraction;
    out.push({ key: 'MARKER_BOAT', pos: ex.marker, done: false, type: 'boat', visible: ex.active });
    return out.slice();
  }

  function status() {
    var rs = relays();
    var n = 0, first = -1;
    for (var i = 0; i < rs.length; i++) {
      if (rs[i].state === 'disabled') n++;
      else if (first < 0) first = i;
    }
    var all = n === 3;
    return {
      disabled: n,
      all: all,
      titleKey: all ? 'OBJ_EXTRACT' : 'OBJ_RELAYS',
      detailKey: all ? 'OBJ_DETAIL_EXTRACT' : (first >= 0 ? RELAY_DETAIL[first] : 'OBJ_DETAIL_GENERIC'),
      count: HB.t('OBJ_COUNT', n)
    };
  }

  HB.objectives = {
    state: O,
    reset: reset,
    update: update,
    markers: markers,
    status: status
  };
})(window.HB = window.HB || {});
