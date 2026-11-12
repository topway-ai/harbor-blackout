/* HARBOR BLACKOUT - first-person movement, collision, vitals and camera.
   Simulation is frame-rate independent: every rate is multiplied by dt,
   and the game loop clamps large deltas after focus loss. */
(function (HB) {
  'use strict';

  var U = HB.util;
  var P = {
    x: 0, y: 0, z: 42,
    velY: 0, yaw: 0, pitch: 0,
    height: 1.72, eye: 1.6, targetEye: 1.6,
    radius: .42, onGround: true,
    health: 100, maxHealth: 100,
    dead: false, deathCause: 'DEATH_CAUSE_COMBAT',
    sprinting: false, crouching: false, ads: false,
    bob: 0, bobAmount: 0, swayX: 0, swayY: 0,
    shake: 0, kickPitch: 0, kickYaw: 0,
    lastDamage: -99, damageDir: 0, damageTime: -99,
    lastSafe: { x: 0, z: 42 }, safeTimer: 0, waterCooldown: 0,
    stepTimer: 0, time: 0, speedNow: 0, reducedShake: false,
    baseFov: 82, fov: 82
  };

  function camera() { return HB.render.state.camera; }

  function reset() {
    var s = HB.world.spawn();
    P.x = s.x; P.y = 0; P.z = s.z;
    P.velY = 0; P.yaw = s.yaw; P.pitch = 0;
    P.height = 1.72; P.eye = 1.6; P.targetEye = 1.6;
    P.health = 100; P.dead = false; P.deathCause = 'DEATH_CAUSE_COMBAT';
    P.onGround = true; P.bob = 0; P.shake = 0;
    P.kickPitch = 0; P.kickYaw = 0;
    P.lastDamage = -99; P.damageTime = -99;
    P.lastSafe = { x: s.x, z: s.z }; P.safeTimer = 0; P.waterCooldown = 0;
    P.stepTimer = 0; P.time = 0; P.speedNow = 0;
    camera().fov = P.baseFov; camera().updateProjectionMatrix();
    syncCamera(0);
  }

  function forward(out) {
    var v = out || new THREE.Vector3();
    v.set(-Math.sin(P.yaw) * Math.cos(P.pitch), Math.sin(P.pitch), -Math.cos(P.yaw) * Math.cos(P.pitch));
    return v.normalize();
  }

  function right(out) {
    var v = out || new THREE.Vector3();
    v.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
    return v.normalize();
  }

  function applyDamage(amount, sourceX, sourceZ, cause) {
    if (P.dead) return;
    P.health = Math.max(0, P.health - amount);
    P.lastDamage = P.time;
    P.damageTime = P.time;
    P.shake = Math.min(1.1, P.shake + .35 + amount * .014);
    if (sourceX !== undefined) {
      var ang = Math.atan2(sourceX - P.x, -(sourceZ - P.z));
      P.damageDir = U.angleWrap(ang - P.yaw);
    }
    HB.audio.hurt();
    HB.ui.damageFlash(Math.min(1, amount / 22));
    HB.ui.damageArc(P.damageDir);
    if (P.health <= 0) {
      P.dead = true;
      P.deathCause = cause || 'DEATH_CAUSE_COMBAT';
    }
  }

  function waterRecovery() {
    if (P.waterCooldown > 0) return;
    P.waterCooldown = 2.5;
    var safe = HB.world.nearestSafe(P.x, P.z);
    P.x = safe.x; P.z = safe.z; P.y = 0; P.velY = 0;
    P.shake = .8;
    HB.ui.radio('RADIO_CMD', 'R_WATER');
    HB.ui.toast('TOAST_WATER');
    applyDamage(12, undefined, undefined, 'DEATH_CAUSE_WATER');
  }

  function addRecoil(v, ads) {
    var scale = P.reducedShake ? .55 : 1;
    P.kickPitch += v * (ads ? .6 : 1) * scale;
    P.kickYaw += (Math.random() - .5) * v * .42 * scale;
    P.shake = Math.min(1, P.shake + v * .22 * scale);
  }

  function syncCamera(dt) {
    var cam = camera();
    var rv = right();
    var bobY = Math.sin(P.bob * 2) * .032 * P.bobAmount;
    var bobX = Math.cos(P.bob) * .022 * P.bobAmount;
    var shakeScale = P.reducedShake ? .28 : 1;
    var sx = (Math.random() - .5) * P.shake * .018 * shakeScale;
    var sy = (Math.random() - .5) * P.shake * .018 * shakeScale;
    cam.position.set(
      P.x + rv.x * bobX + sx,
      P.y + P.eye + bobY + sy,
      P.z + rv.z * bobX
    );
    cam.rotation.set(P.pitch + P.kickPitch + sy * .4, P.yaw + P.kickYaw + sx * .4, 0, 'YXZ');
    var targetFov = P.baseFov + (P.sprinting ? 4.5 : 0) - (P.ads ? 15 : 0);
    P.fov = U.damp(P.fov, targetFov, 9, dt || .016);
    if (Math.abs(cam.fov - P.fov) > .02) { cam.fov = P.fov; cam.updateProjectionMatrix(); }
    HB.render.state.viewCamera.fov = 62 - (P.ads ? 5 : 0);
    HB.render.state.viewCamera.updateProjectionMatrix();
  }

  function update(dt, input, game) {
    P.time += dt;
    P.waterCooldown = Math.max(0, P.waterCooldown - dt);
    if (P.dead) { syncCamera(dt); return; }

    /* Look. */
    var look = input.consumeLook();
    P.yaw -= look.dx;
    P.pitch = U.clamp(P.pitch - look.dy, -1.42, 1.42);
    P.kickPitch = U.damp(P.kickPitch, 0, 11, dt);
    P.kickYaw = U.damp(P.kickYaw, 0, 11, dt);
    P.shake = Math.max(0, P.shake - dt * 2.2);

    /* Stance and speed. */
    P.crouching = input.actionDown('CROUCH');
    P.ads = input.actionDown('AIM') && !P.sprinting;
    P.sprinting = input.actionDown('SPRINT') && !P.crouching && !P.ads;
    P.targetEye = P.crouching ? 1.02 : 1.6;
    P.height = P.crouching ? 1.18 : 1.72;
    P.eye = U.damp(P.eye, P.targetEye, 12, dt);

    var mv = input.moveVector();
    var moving = Math.abs(mv.x) + Math.abs(mv.y) > .05;
    var speed = P.crouching ? 2.5 : (P.ads ? 3.1 : (P.sprinting ? 7.2 : 4.7));
    if (!P.onGround) speed *= .82;
    var f = forward(), r = right();
    var dx = (r.x * mv.x + f.x * mv.y) * speed * dt;
    var dz = (r.z * mv.x + f.z * mv.y) * speed * dt;
    var res = HB.world.resolveMove(P.x, P.z, dx, dz, P.radius, P.y, P.height);
    P.x = res.x; P.z = res.z;
    P.speedNow = moving ? speed : 0;

    /* Jump and gravity. */
    if (P.onGround && input.actionPressed('JUMP') && !P.crouching) {
      P.velY = 5.5; P.onGround = false; HB.audio.step(true);
    }
    if (!P.onGround || P.velY > 0) {
      P.velY -= 16.5 * dt;
      P.y += P.velY * dt;
      if (P.y <= 0) { P.y = 0; P.velY = 0; P.onGround = true; }
    }

    /* Footstep cadence, head bob and sway. */
    if (P.onGround && moving) {
      P.stepTimer += dt * speed;
      if (P.stepTimer > 2.15) { P.stepTimer = 0; HB.audio.step(P.sprinting); }
      P.bob += dt * (P.sprinting ? 13 : 9);
    }
    P.bobAmount = U.damp(P.bobAmount, (P.onGround && moving && !P.ads) ? (P.sprinting ? 1.25 : .8) : 0, 8, dt);

    /* Water edge recovery. */
    if (HB.world.isHazard(P.x, P.z)) waterRecovery();

    /* Health recovery after a calm window. */
    if (P.time - P.lastDamage > 6 && P.health < P.maxHealth) {
      P.health = Math.min(P.maxHealth, P.health + 6.5 * dt);
    }
    P.safeTimer += dt;
    if (P.safeTimer > .4 && P.onGround && !HB.world.isHazard(P.x, P.z)) {
      P.safeTimer = 0; P.lastSafe.x = P.x; P.lastSafe.z = P.z;
    }
    syncCamera(dt);
  }

  HB.player = {
    state: P,
    reset: reset,
    update: update,
    forward: forward,
    right: right,
    applyDamage: applyDamage,
    addRecoil: addRecoil,
    waterRecovery: waterRecovery,
    position: function () { return new THREE.Vector3(P.x, P.y + P.eye, P.z); },
    direction: forward,
    setFov: function (v) { P.baseFov = v; P.fov = v; camera().fov = v; camera().updateProjectionMatrix(); },
    setReducedShake: function (v) { P.reducedShake = !!v; }
  };
})(window.HB = window.HB || {});
