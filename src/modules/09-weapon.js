/* HARBOR BLACKOUT - detailed first-person AR-9 viewmodel.
   Built entirely from primitives with PBR materials. Includes aim down sights,
   recoil, reload, sprint, sway, muzzle flash, shell ejection and an English
   engraving plate rendered through the validated catalog. */
(function (HB) {
  'use strict';

  var U = HB.util;
  var V = null;
  var W = {
    mag: 30, reserve: 210, magSize: 30, maxReserve: 270,
    cooldown: 0, reloading: false, reloadT: 0, reloadDur: 2.15,
    flash: 0, spread: 0, recoil: 0, recoilRot: 0,
    lastYaw: 0, lastPitch: 0, sway: { x: 0, y: 0 },
    shells: [], dryPlayed: false, shotsFired: 0
  };
  var root, gun, swayGroup, muzzle, flashSprite, flashLight, dropMag, insertMag, leftHand, rightHand;
  var basePos = new THREE.Vector3(.27, -.30, -.62);
  var adsPos = new THREE.Vector3(0, -.163, -.46);
  var sprintPos = new THREE.Vector3(.32, -.44, -.55);
  var shellGeo = new THREE.CylinderGeometry(.012, .012, .038, 6);
  var shellMat = new THREE.MeshStandardMaterial({ color: 0xb89a52, metalness: .9, roughness: .3 });
  var parts = {};

  function box(w, h, d, mat, x, y, z, parent, rx, ry, rz) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz;
    (parent || gun).add(m);
    return m;
  }
  function cyl(r, h, mat, x, y, z, parent, rx) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat);
    m.position.set(x, y, z); if (rx) m.rotation.x = rx;
    (parent || gun).add(m);
    return m;
  }

  function build() {
    V = HB.render.state.viewScene;
    var M = HB.materials.all();
    root = new THREE.Group();
    swayGroup = new THREE.Group();
    gun = new THREE.Group();
    root.add(swayGroup); swayGroup.add(gun); V.add(root);

    var body = M.black, metal = M.steel, dark = M.dark, rubber = new THREE.MeshStandardMaterial({ color: 0x252b2e, roughness: .9, metalness: .05 });
    var glove = new THREE.MeshStandardMaterial({ color: 0x364047, roughness: .82, metalness: .08 });
    var glovePalm = new THREE.MeshStandardMaterial({ color: 0x2b3339, roughness: .88, metalness: .06 });

    /* Receiver and upper. */
    box(.155, .155, .56, body, 0, 0, 0, gun);
    box(.165, .055, .54, dark, 0, .095, -.01, gun);
    box(.11, .02, .5, metal, 0, .128, -.01, gun);
    for (var i = 0; i < 12; i++) box(.115, .018, .015, metal, 0, .143, -.24 + i * .041, gun);
    /* Ejection port and charging handle. */
    box(.012, .065, .13, new THREE.MeshStandardMaterial({ color: 0x0b0f11, roughness: .7 }), .081, .025, -.03, gun);
    box(.03, .03, .11, metal, .095, .075, .09, gun);
    /* Handguard with vents. */
    box(.135, .125, .40, dark, 0, .005, -.47, gun);
    for (var v = 0; v < 6; v++) {
      box(.14, .012, .022, metal, 0, .068, -.31 - v * .062, gun);
      box(.012, .055, .03, body, .071, -.005, -.34 - v * .062, gun);
      box(.012, .055, .03, body, -.071, -.005, -.34 - v * .062, gun);
    }
    /* Barrel, gas block, muzzle brake. */
    cyl(.019, .34, metal, 0, .005, -.82, gun, Math.PI / 2);
    cyl(.032, .055, dark, 0, .005, -.70, gun, Math.PI / 2);
    cyl(.034, .085, metal, 0, .005, -.99, gun, Math.PI / 2);
    cyl(.027, .01, body, 0, .005, -1.036, gun, Math.PI / 2);
    /* Front sight post. */
    box(.018, .085, .018, metal, 0, .105, -.68, gun);
    box(.055, .016, .03, dark, 0, .145, -.68, gun);
    /* Optic: housing, lens, turret, reticle lines. */
    box(.088, .088, .20, body, 0, .205, -.12, gun);
    cyl(.042, .012, M.glass, 0, .205, -.226, gun, Math.PI / 2);
    cyl(.046, .016, metal, 0, .205, -.222, gun, Math.PI / 2);
    cyl(.018, .03, metal, 0, .262, -.12, gun);
    box(.13, .022, .09, dark, 0, .165, -.12, gun);
    var reticleMat = new THREE.MeshBasicMaterial({ color: 0xffb45f });
    box(.002, .03, .002, reticleMat, 0, .205, -.235, gun);
    box(.03, .002, .002, reticleMat, 0, .205, -.235, gun);
    /* Stock, buffer tube, cheek rest, butt pad. */
    cyl(.032, .26, metal, 0, .01, .36, gun, Math.PI / 2);
    box(.12, .14, .27, dark, 0, .005, .48, gun);
    box(.13, .17, .035, rubber, 0, .005, .625, gun);
    box(.105, .035, .22, rubber, 0, .085, .48, gun);
    /* Grip, trigger guard, magazine well and magazine. */
    box(.082, .20, .095, rubber, 0, -.175, .13, gun, -.22);
    box(.012, .012, .10, metal, 0, -.085, .075, gun, .1);
    box(.075, .012, .12, metal, 0, -.115, .035, gun);
    box(.12, .13, .155, body, 0, -.105, -.11, gun);
    parts.magazine = box(.095, .26, .13, dark, 0, -.27, -.11, gun, -.12);
    box(.10, .02, .135, metal, 0, -.405, -.11, gun);
    /* Selector, bolt catch, sling loops. */
    cyl(.018, .012, metal, .087, -.03, .16, gun, Math.PI / 2);
    box(.016, .06, .02, metal, -.082, -.02, -.13, gun);
    box(.025, .025, .012, metal, .075, -.02, -.58, gun);
    /* English engraving / serial plates (catalog-driven lettering). */
    var engraving = new THREE.Mesh(new THREE.PlaneGeometry(.36, .062),
      new THREE.MeshBasicMaterial({ map: HB.materials.sign('LBL_AR9', { bg: '#252d31', fg: '#c8d2ce', font: 30, width: 640, height: 96, borderWidth: 2, rivets: false, seed: 61 }), toneMapped: false }));
    engraving.position.set(.079, -.035, .01); engraving.rotation.y = Math.PI / 2; gun.add(engraving);
    var serial = new THREE.Mesh(new THREE.PlaneGeometry(.26, .045),
      new THREE.MeshBasicMaterial({ map: HB.materials.sign('LBL_SERIAL', { bg: '#252d31', fg: '#9fb0ae', font: 26, width: 560, height: 90, borderWidth: 2, rivets: false, seed: 62 }), toneMapped: false }));
    serial.position.set(-.079, -.035, .04); serial.rotation.y = -Math.PI / 2; gun.add(serial);

    /* Gloved hands and forearms. */
    leftHand = new THREE.Group();
    var lPalm = box(.105, .085, .16, glovePalm, 0, 0, 0, leftHand);
    for (var f = 0; f < 4; f++) box(.022, .045, .12, glove, -.04 + f * .027, .055, -.06, leftHand, -.35);
    box(.075, .06, .10, glove, .06, -.01, .04, leftHand, .3);
    var lArm = cyl(.058, .34, glove, .03, -.14, .20, leftHand, 1.15);
    lArm.rotation.z = .18;
    leftHand.position.set(-.085, -.075, -.46);
    gun.add(leftHand);

    rightHand = new THREE.Group();
    box(.10, .10, .13, glovePalm, 0, 0, 0, rightHand);
    for (var g = 0; g < 4; g++) box(.022, .05, .10, glove, -.035 + g * .025, -.05, -.04, rightHand, .4);
    box(.07, .06, .11, glove, -.065, .02, .03, rightHand, -.3);
    cyl(.058, .36, glove, .05, -.18, .20, rightHand, 1.2);
    rightHand.position.set(.075, -.19, .14);
    gun.add(rightHand);

    /* Muzzle flash: additive sprite plus a short cone and a viewmodel light. */
    var glowTex = HB.materials.glow('rgb(255,214,140)');
    flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
    flashSprite.scale.set(.42, .42, 1);
    flashSprite.position.set(0, .005, -1.09);
    flashSprite.visible = false;
    gun.add(flashSprite);
    var cone = new THREE.Mesh(new THREE.ConeGeometry(.075, .26, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd18a, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(0, .005, -1.14);
    cone.visible = false;
    gun.add(cone); parts.flashCone = cone;
    flashLight = new THREE.PointLight(0xffbe70, 0, 3, 2);
    flashLight.position.set(0, .1, -1.05);
    gun.add(flashLight);
    muzzle = new THREE.Vector3(0, .005, -1.08);

    /* Reload magazine props, hidden until the animation runs. */
    dropMag = box(.095, .26, .13, dark, 0, -.27, -.11, gun, -.12);
    dropMag.visible = false;
    insertMag = box(.095, .26, .13, dark, 0, -.27, -.11, gun, -.12);
    insertMag.visible = false;

    root.position.copy(basePos);
    root.rotation.set(0, 0, 0);
  }

  function ejectShell() {
    if (W.shells.length > 14) {
      var old = W.shells.shift(); gun.remove(old.mesh); old.mesh.geometry.dispose();
    }
    var mesh = new THREE.Mesh(shellGeo, shellMat);
    mesh.position.set(.1, .03, -.02);
    gun.add(mesh);
    W.shells.push({
      mesh: mesh, life: 1.4,
      vx: 1.6 + Math.random() * 1.1, vy: 1.4 + Math.random() * .9, vz: .4 + Math.random() * 1.2,
      rx: Math.random() * 10, ry: Math.random() * 10
    });
    HB.audio.shell();
  }

  function startReload() {
    if (W.reloading || W.mag >= W.magSize || W.reserve <= 0) return;
    W.reloading = true; W.reloadT = 0;
    HB.audio.reloadOut();
  }

  function finishReload() {
    var need = W.magSize - W.mag;
    var take = Math.min(need, W.reserve);
    W.mag += take; W.reserve -= take;
    W.reloading = false;
    HB.audio.bolt();
  }

  function fire(game) {
    if (W.reloading || W.cooldown > 0) return false;
    if (W.mag <= 0) {
      if (!W.dryPlayed) { HB.audio.dryFire(); HB.ui.toast('TOAST_NO_AMMO'); W.dryPlayed = true; }
      return false;
    }
    W.dryPlayed = false;
    W.mag--;
    W.cooldown = .097;
    W.shotsFired++;
    W.flash = .055;
    W.spread = Math.min(1, W.spread + .19);
    W.recoil = Math.min(1, W.recoil + .32);
    W.recoilRot += .06;
    flashSprite.visible = true; parts.flashCone.visible = true;
    flashLight.intensity = 5;
    ejectShell();
    HB.audio.gunshot();
    HB.player.addRecoil(.017, HB.player.state.ads);
    HB.combat.fire(game);
    if (W.mag === 0 && W.reserve > 0) HB.ui.toast('EMPTY');
    return true;
  }

  function reset() {
    W.mag = W.magSize; W.reserve = 210; W.cooldown = 0;
    W.reloading = false; W.reloadT = 0; W.flash = 0; W.spread = 0;
    W.recoil = 0; W.recoilRot = 0; W.shotsFired = 0; W.dryPlayed = false;
    for (var i = 0; i < W.shells.length; i++) gun.remove(W.shells[i].mesh);
    W.shells.length = 0;
    parts.magazine.visible = true;
    dropMag.visible = false; insertMag.visible = false;
    gun.rotation.set(0, 0, 0);
    root.position.copy(basePos);
  }

  function update(dt, input, player, game) {
    if (!root) return;
    W.cooldown = Math.max(0, W.cooldown - dt);
    W.spread = Math.max(0, W.spread - dt * (player.ads ? 2.1 : 1.35));
    W.recoil = U.damp(W.recoil, 0, 9, dt);
    W.recoilRot = U.damp(W.recoilRot, 0, 10, dt);

    if (game.state === 'PLAYING' && input.actionPressed('RELOAD')) startReload();
    if (W.reloading) {
      W.reloadT += dt;
      var p = W.reloadT / W.reloadDur;
      if (p < .25) {
        parts.magazine.visible = false;
        dropMag.visible = true;
        dropMag.position.set(0, -.27 - p * 1.8, -.11);
        dropMag.rotation.x = -.12 + p * 2;
      } else if (p < .52) {
        dropMag.visible = false;
        insertMag.visible = true;
        var q = (p - .25) / .27;
        insertMag.position.set(.16 * (1 - q), -.8 + q * .53, -.11);
        insertMag.rotation.x = -.12 * q;
        if (!W._clickA && q > .1) { HB.audio.reloadIn(); W._clickA = true; }
      } else {
        insertMag.visible = false;
        parts.magazine.visible = true;
      }
      if (p >= 1) { finishReload(); W._clickA = false; }
    }

    if (game.state === 'PLAYING' && input.actionDown('FIRE')) fire(game);

    /* Flash decay. */
    if (W.flash > 0) {
      W.flash -= dt;
      flashLight.intensity = Math.max(0, flashLight.intensity - dt * 90);
      if (W.flash <= 0) { flashSprite.visible = false; parts.flashCone.visible = false; flashLight.intensity = 0; }
    }
    flashSprite.material.rotation = Math.random() * 6.28;
    flashSprite.scale.setScalar(.34 + Math.random() * .16);

    /* Ejected shells. */
    for (var i = W.shells.length - 1; i >= 0; i--) {
      var s = W.shells[i];
      s.life -= dt;
      s.vy -= 9 * dt;
      s.mesh.position.x += s.vx * dt; s.mesh.position.y += s.vy * dt; s.mesh.position.z += s.vz * dt;
      s.mesh.rotation.x += s.rx * dt; s.mesh.rotation.y += s.ry * dt;
      if (s.life <= 0 || s.mesh.position.y < -1.4) {
        gun.remove(s.mesh); W.shells.splice(i, 1);
      }
    }

    /* Aim / sprint / reload poses, sway and bob. */
    var target = basePos.clone();
    var targetRot = new THREE.Euler(0, 0, 0);
    if (player.ads) { target.copy(adsPos); }
    else if (player.sprinting) {
      target.copy(sprintPos);
      targetRot.set(-.22, .28, .18);
    }
    if (W.reloading) {
      var rp = Math.sin(Math.min(1, W.reloadT / W.reloadDur) * Math.PI);
      target.y -= rp * .18; target.x += rp * .09;
      targetRot.x += rp * .34; targetRot.z += rp * .42;
    }
    target.z += W.recoil * .12;
    target.y += W.recoil * .022;
    root.position.lerp(target, 1 - Math.exp(-13 * dt));
    gun.rotation.x = U.damp(gun.rotation.x, targetRot.x + W.recoilRot, 11, dt);
    gun.rotation.y = U.damp(gun.rotation.y, targetRot.y, 11, dt);
    gun.rotation.z = U.damp(gun.rotation.z, targetRot.z, 11, dt);

    var dyaw = U.angleDelta(W.lastYaw, player.yaw);
    var dpitch = U.angleDelta(W.lastPitch, player.pitch);
    W.lastYaw = player.yaw; W.lastPitch = player.pitch;
    W.sway.x = U.damp(W.sway.x, U.clamp(dyaw * 3.2, -.16, .16), 8, dt);
    W.sway.y = U.damp(W.sway.y, U.clamp(dpitch * 3.2, -.14, .14), 8, dt);
    swayGroup.rotation.y = W.sway.x * (player.ads ? .25 : 1);
    swayGroup.rotation.x = W.sway.y * (player.ads ? .25 : 1);
    swayGroup.position.y = Math.sin(player.bob * 2) * .012 * player.bobAmount * (player.ads ? .25 : 1);
    swayGroup.position.x = Math.cos(player.bob) * .012 * player.bobAmount * (player.ads ? .25 : 1);
    leftHand.visible = !player.ads || true;
    rightHand.visible = true;
    var visADS = player.ads ? .3 : 1;
    leftHand.scale.setScalar(visADS === 1 ? 1 : 1);
  }

  HB.weapon = {
    data: W,
    init: build,
    reset: reset,
    update: update,
    reload: startReload,
    addAmmo: function (n) { W.reserve = Math.min(W.maxReserve, W.reserve + n); },
    canReload: function () { return !W.reloading && W.mag < W.magSize && W.reserve > 0; },
    spread: function () { return W.spread; }
  };
})(window.HB = window.HB || {});
