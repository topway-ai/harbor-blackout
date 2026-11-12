/* HARBOR BLACKOUT - defense drones and security hounds.
   States: PATROL, ALERT, CHASE, ATTACK, STUN, DEAD. Enemies check line of sight
   against world colliders before firing, steer around obstacles, and are
   relocated if they remain stuck, so encounters do not deadlock. */
(function (HB) {
  'use strict';

  var U = HB.util;
  var list = [];
  var MAX_ACTIVE = 14;
  var scene = null;
  var aimLines = [];

  var DRONE_HP = 68;
  var HOUND_HP = 82;

  function makeGlow(color, scale) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: color === 'red' ? HB.materials.textures().glowRed : HB.materials.textures().glowAmber,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    s.scale.set(scale, scale, 1);
    return s;
  }

  function buildDrone(e) {
    var M = HB.materials.all();
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(.72, .22, .62), M.black);
    g.add(body);
    var plate = new THREE.Mesh(new THREE.BoxGeometry(.5, .06, .44), M.steel);
    plate.position.y = .14; g.add(plate);
    e.rotors = [];
    [[-.48, -.42], [.48, -.42], [-.48, .42], [.48, .42]].forEach(function (p) {
      var arm = new THREE.Mesh(new THREE.BoxGeometry(.42, .06, .06), M.dark);
      arm.position.set(p[0] * .55, 0, p[1] * .55);
      arm.rotation.y = Math.atan2(p[1], p[0]);
      g.add(arm);
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .08, 8), M.steel);
      hub.position.set(p[0], .03, p[1]); g.add(hub);
      var rotor = new THREE.Mesh(new THREE.BoxGeometry(.62, .015, .075), new THREE.MeshStandardMaterial({ color: 0x68757c, transparent: true, opacity: .65, roughness: .5 }));
      rotor.position.set(p[0], .08, p[1]); g.add(rotor);
      e.rotors.push(rotor);
    });
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0xff5038 });
    e.eye = new THREE.Mesh(new THREE.SphereGeometry(.085, 10, 10), eyeMat);
    e.eye.position.set(0, -.02, -.33); g.add(e.eye);
    e.glow = makeGlow('red', .7); e.glow.position.set(0, -.02, -.36); g.add(e.glow);
    var cannon = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, .3, 8), M.dark);
    cannon.rotation.x = Math.PI / 2; cannon.position.set(0, -.16, -.24); g.add(cannon);
    e.group = g;
    e.hitRadius = .78;
    e.hoverY = 3.0;
    return g;
  }

  function buildHound(e) {
    var M = HB.materials.all();
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(.62, .36, 1.15), M.dark);
    body.position.y = .55; g.add(body);
    var spine = new THREE.Mesh(new THREE.BoxGeometry(.46, .12, .9), M.steel);
    spine.position.set(0, .77, .05); g.add(spine);
    var head = new THREE.Mesh(new THREE.BoxGeometry(.44, .34, .42), M.black);
    head.position.set(0, .62, -.72); g.add(head);
    var jaw = new THREE.Mesh(new THREE.BoxGeometry(.34, .12, .28), M.steel);
    jaw.position.set(0, .46, -.88); g.add(jaw);
    e.eye = new THREE.Mesh(new THREE.BoxGeometry(.3, .06, .02), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    e.eye.position.set(0, .67, -.94); g.add(e.eye);
    e.glow = makeGlow('amber', .55); e.glow.position.set(0, .67, -.97); g.add(e.glow);
    e.legs = [];
    [[-.28, -.4], [.28, -.4], [-.28, .42], [.28, .42]].forEach(function (p) {
      var hip = new THREE.Mesh(new THREE.SphereGeometry(.075, 8, 8), M.steel);
      hip.position.set(p[0], .52, p[1]); g.add(hip);
      var leg = new THREE.Mesh(new THREE.BoxGeometry(.09, .5, .09), M.black);
      leg.position.set(p[0], .25, p[1]); g.add(leg);
      e.legs.push({ mesh: leg, baseY: .25, phase: (p[0] > 0 ? 0 : Math.PI) + (p[1] > 0 ? Math.PI : 0) });
    });
    var tail = new THREE.Mesh(new THREE.CylinderGeometry(.035, .05, .55, 6), M.steel);
    tail.rotation.x = 1.1; tail.position.set(0, .68, .68); g.add(tail);
    e.group = g;
    e.hitRadius = .8;
    e.hoverY = .55;
    return g;
  }

  function create(type, x, z, route) {
    var e = {
      type: type, x: x, z: z, y: type === 'drone' ? 3.0 : 0,
      hp: type === 'drone' ? DRONE_HP : HOUND_HP,
      maxHp: type === 'drone' ? DRONE_HP : HOUND_HP,
      state: 'PATROL', route: route || null, routeIdx: 0,
      attackCd: 1 + Math.random(), telegraph: 0, hitFlash: 0,
      deadTime: 0, stuckTime: 0, lastX: x, lastZ: z,
      phase: Math.random() * 6.28, speed: type === 'drone' ? 3.4 : 4.1,
      lastSeen: new THREE.Vector3(x, 0, z), seenTime: -99
    };
    var g = type === 'drone' ? buildDrone(e) : buildHound(e);
    g.position.set(x, e.y, z);
    g.castShadow = true;
    scene.add(g);
    list.push(e);
    return e;
  }

  function eyePos(e) {
    return new THREE.Vector3(e.x, e.y + (e.type === 'drone' ? .0 : .62), e.z);
  }

  function remove(e) {
    if (e.group && e.group.parent) e.group.parent.remove(e.group);
  }

  function raycast(origin, dir, maxDist) {
    var best = null;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.state === 'DEAD') continue;
      var cx = e.x - origin.x, cy = (e.y + (e.type === 'drone' ? 0 : .62)) - origin.y, cz = e.z - origin.z;
      var proj = cx * dir.x + cy * dir.y + cz * dir.z;
      if (proj < 0 || proj > maxDist) continue;
      var d2 = cx * cx + cy * cy + cz * cz - proj * proj;
      var r = e.hitRadius;
      if (d2 > r * r) continue;
      var t = proj - Math.sqrt(Math.max(0, r * r - d2));
      if (t < .05 || t > maxDist) continue;
      if (!best || t < best.dist) {
        best = {
          dist: t, enemy: e,
          point: new THREE.Vector3(origin.x + dir.x * t, origin.y + dir.y * t, origin.z + dir.z * t),
          damage: e.type === 'drone' ? 40 : 34
        };
      }
    }
    return best;
  }

  function damage(e, amount, game) {
    if (e.state === 'DEAD') return;
    e.hp -= amount;
    e.hitFlash = .14;
    e.state = 'STUN';
    e.stunTime = .16;
    e.lastSeen.set(game.player.position().x, 0, game.player.position().z);
    if (e.hp <= 0) {
      e.state = 'DEAD';
      e.deadTime = 0;
      game.stats.kills++;
      HB.ui.killFeed(e.type === 'drone' ? 'ENEMY_DRONE' : 'ENEMY_HOUND');
      HB.combat.explosion(new THREE.Vector3(e.x, e.y + .4, e.z));
      HB.ui.hitMarker(true);
      HB.ui.toast('TOAST_HIT');
    }
  }

  function steer(e, tx, tz, dt, speed) {
    var dx = tx - e.x, dz = tz - e.z;
    var len = Math.sqrt(dx * dx + dz * dz);
    if (len < .1) return;
    dx /= len; dz /= len;
    var step = speed * dt;
    var res = HB.world.resolveMove(e.x, e.z, dx * step, dz * step, .5, e.type === 'drone' ? 2.8 : 0, .9);
    var moved = U.dist2(e.x, e.z, res.x, res.z);
    if (moved < step * .25) {
      /* Try both perpendicular directions before giving up. */
      var sign = (e.phase > 3.14) ? 1 : -1;
      var cand = [
        { x: -dz * sign, z: dx * sign },
        { x: dz * sign, z: -dx * sign }
      ];
      for (var c = 0; c < cand.length; c++) {
        var r2 = HB.world.resolveMove(e.x, e.z, cand[c].x * step, cand[c].z * step, .5, e.type === 'drone' ? 2.8 : 0, .9);
        if (U.dist2(e.x, e.z, r2.x, r2.z) > step * .3) { res = r2; break; }
      }
      if (U.dist2(e.x, e.z, res.x, res.z) < step * .1) e.stuckTime += dt;
      else e.stuckTime = 0;
    } else e.stuckTime = 0;
    e.x = res.x; e.z = res.z;
    if (e.stuckTime > 2.2) {
      var sp = HB.world.data.enemySpawns[Math.floor(Math.random() * HB.world.data.enemySpawns.length)];
      e.x = sp.x; e.z = sp.z; e.stuckTime = 0;
    }
    var targetYaw = Math.atan2(-dx, -dz);
    e.group.rotation.y = U.damp(e.group.rotation.y, targetYaw, 6, dt);
  }

  function attackDrone(e, playerEye, dt, game) {
    e.attackCd -= dt;
    if (e.attackCd <= 0 && e.telegraph <= 0) {
      e.telegraph = .38;
      HB.audio.enemyAlert();
    }
    if (e.telegraph > 0) {
      e.telegraph -= dt;
      if (e.glow) e.glow.scale.setScalar(1.2);
      if (e.telegraph <= 0) {
        e.attackCd = 1.25 + Math.random() * .6;
        if (!HB.world.lineBlocked(eyePos(e), playerEye)) {
          HB.combat.tracer(eyePos(e), playerEye);
          HB.audio.enemyShot();
          HB.player.applyDamage(8, e.x, e.z, 'DEATH_CAUSE_COMBAT');
          HB.combat.sparks(playerEye, 4, { r: 1, g: .4, b: .25 });
        }
        if (e.glow) e.glow.scale.setScalar(.7);
      }
    }
  }

  function attackHound(e, playerEye, dt) {
    e.attackCd -= dt;
    if (e.attackCd <= 0) {
      e.attackCd = 1.15 + Math.random() * .4;
      if (!HB.world.lineBlocked(eyePos(e), playerEye)) {
        HB.audio.enemyShot();
        HB.player.applyDamage(13, e.x, e.z, 'DEATH_CAUSE_COMBAT');
        HB.combat.sparks(playerEye, 5, { r: 1, g: .45, b: .2 });
      }
    }
  }

  function update(dt, game) {
    var P = game.player;
    var playerEye = P.position();
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];
      e.phase += dt;
      if (e.state === 'DEAD') {
        e.deadTime += dt;
        e.y -= dt * 2.4;
        e.group.rotation.z += dt * 3;
        e.group.scale.setScalar(Math.max(.01, 1 - e.deadTime * .8));
        if (e.deadTime > 1.25) { remove(e); list.splice(i, 1); }
        else e.group.position.set(e.x, e.y, e.z);
        continue;
      }
      var dist = U.dist2(e.x, e.z, P.x, P.z);
      var los = !HB.world.lineBlocked(eyePos(e), playerEye);
      var detect = e.type === 'drone' ? 34 : 27;
      if (los && dist < detect) {
        e.lastSeen.set(P.x, 0, P.z);
        e.seenTime = e.phase;
        if (e.state === 'PATROL') { e.state = 'ALERT'; e.telegraph = .55; HB.audio.enemyAlert(); }
        else if (e.state === 'STUN' && e.stunTime <= 0) e.state = 'CHASE';
        else if (e.state === 'ALERT' || e.state === 'CHASE') e.state = e.telegraph > 0 ? 'ALERT' : 'CHASE';
      } else if (e.state === 'CHASE' && e.phase - e.seenTime > 5.5) {
        e.state = 'PATROL';
      }
      if (e.state === 'ALERT') {
        e.telegraph -= dt;
        if (e.telegraph <= 0) e.state = 'CHASE';
      }
      if (e.state === 'STUN') {
        e.stunTime -= dt;
        if (e.stunTime <= 0) e.state = 'CHASE';
      }

      var attackRange = e.type === 'drone' ? 24 : 2.0;
      if ((e.state === 'CHASE' || e.state === 'ATTACK') && dist < attackRange && los) {
        e.state = 'ATTACK';
      } else if (e.state === 'ATTACK' && (dist > attackRange || !los)) {
        e.state = 'CHASE';
      }

      if (e.state === 'PATROL') {
        var wp = e.route ? e.route[e.routeIdx % e.route.length] : { x: e.x, z: e.z };
        if (U.dist2(e.x, e.z, wp.x, wp.z) < 1.6) {
          e.routeIdx = (e.routeIdx + 1) % (e.route ? e.route.length : 1);
          wp = e.route ? e.route[e.routeIdx] : { x: e.x, z: e.z };
        }
        steer(e, wp.x, wp.z, dt, e.speed * .55);
      } else if (e.state === 'CHASE') {
        var tx = e.lastSeen.x, tz = e.lastSeen.z;
        steer(e, tx, tz, dt, e.speed * (e.type === 'drone' ? .8 : 1));
        if (e.type === 'hound' && Math.sin(e.phase * 12) > .9) HB.audio.houndStep();
      } else if (e.state === 'ATTACK') {
        if (e.type === 'drone') {
          /* Strafe while holding a firing position. */
          var perp = Math.sin(e.phase * .8) * dt * 1.5;
          var res = HB.world.resolveMove(e.x, e.z, perp, 0, .5, 2.8, .9);
          e.x = res.x; e.z = res.z;
          attackDrone(e, playerEye, dt, game);
        } else {
          if (dist > 1.5) steer(e, P.x, P.z, dt, 3.2);
          attackHound(e, playerEye, dt);
        }
      } else if (e.state === 'ALERT' || e.state === 'STUN') {
        /* Telegraph: hold position and brighten the sensor. */
      }

      /* Vertical motion and animation. */
      if (e.type === 'drone') {
        e.y = e.hoverY + Math.sin(e.phase * 2.1) * .18;
        for (var r = 0; r < e.rotors.length; r++) e.rotors[r].rotation.y += dt * 34;
      } else {
        e.y = .02 + Math.abs(Math.sin(e.phase * 7)) * .04;
        var walking = (e.state === 'CHASE' || e.state === 'PATROL' || e.state === 'ATTACK');
        for (var l = 0; l < e.legs.length; l++) {
          var leg = e.legs[l];
          leg.mesh.position.y = leg.baseY + (walking ? Math.sin(e.phase * 9 + leg.phase) * .08 : 0);
          leg.mesh.rotation.x = walking ? Math.sin(e.phase * 9 + leg.phase) * .35 : 0;
        }
      }
      e.group.position.set(e.x, e.y, e.z);
      if (e.hitFlash > 0) {
        e.hitFlash -= dt;
        if (e.eye && e.eye.material) e.eye.material.color.setHex(0xffffff);
      } else if (e.eye && e.eye.material) {
        e.eye.material.color.setHex(e.type === 'drone' ? 0xff5038 : 0xffb347);
      }
      if (e.glow) {
        var sc = e.state === 'ATTACK' || e.state === 'ALERT' ? 1.35 : .8;
        e.glow.scale.setScalar(sc + Math.sin(e.phase * 6) * .12);
      }
    }
  }

  function spawnWave(spec, game) {
    var active = list.filter(function (e) { return e.state !== 'DEAD'; }).length;
    var spawns = HB.world.data.enemySpawns.slice();
    spawns.sort(function (a, b) {
      return U.dist2(b.x, b.z, game.player.position().x, game.player.position().z) -
             U.dist2(a.x, a.z, game.player.position().x, game.player.position().z);
    });
    for (var i = 0; i < spec.length && active + i < MAX_ACTIVE; i++) {
      var s = spawns[i % spawns.length];
      var route = HB.world.data.routes[i % HB.world.data.routes.length];
      create(spec[i], s.x, s.z, route);
    }
  }

  function initialWave(game) {
    create('drone', 26, 4, HB.world.data.routes[1]);
    create('drone', -30, -24, HB.world.data.routes[0]);
    create('hound', 12, -30, HB.world.data.routes[4]);
    create('hound', -12, -56, HB.world.data.routes[2]);
  }

  function reset() {
    for (var i = 0; i < list.length; i++) remove(list[i]);
    list.length = 0;
  }

  function nearestDistance() {
    var P = HB.player.state;
    var best = Infinity;
    for (var i = 0; i < list.length; i++) {
      if (list[i].state === 'DEAD') continue;
      best = Math.min(best, U.dist2(list[i].x, list[i].z, P.x, P.z));
    }
    return best;
  }

  HB.enemies = {
    init: function () { scene = HB.render.state.scene; },
    reset: reset,
    update: update,
    raycast: raycast,
    damage: damage,
    initialWave: initialWave,
    spawnWave: spawnWave,
    nearestDistance: nearestDistance,
    list: function () { return list; },
    count: function () { return list.filter(function (e) { return e.state !== 'DEAD'; }).length; }
  };
})(window.HB = window.HB || {});
