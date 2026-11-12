/* HARBOR BLACKOUT - hitscan combat, accuracy tracking and pooled effects.
   Bullets are resolved analytically against enemy hit volumes and the world's
   collider set, so cover works consistently for the player and the AI. */
(function (HB) {
  'use strict';

  var U = HB.util;
  var MAX_PARTICLES = 320;
  var particles = [];
  var points = null;
  var posAttr, colAttr, sizeAttr, alphaAttr;
  var tracers = [];
  var tracerIndex = 0;

  var VERT = [
    'attribute float aSize; attribute float aAlpha;',
    'varying vec3 vColor; varying float vAlpha;',
    'void main() {',
    '  vColor = color; vAlpha = aAlpha;',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_PointSize = clamp(aSize * (260.0 / max(0.2, -mv.z)), 1.0, 64.0);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');
  var FRAG = [
    'varying vec3 vColor; varying float vAlpha;',
    'void main() {',
    '  vec2 c = gl_PointCoord - 0.5;',
    '  float d = length(c);',
    '  float a = (1.0 - smoothstep(0.18, 0.5, d)) * vAlpha;',
    '  if (a < 0.01) discard;',
    '  gl_FragColor = vec4(vColor, a);',
    '}'
  ].join('\n');

  function init() {
    var geo = new THREE.BufferGeometry();
    posAttr = new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3);
    colAttr = new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3);
    sizeAttr = new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1);
    alphaAttr = new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES), 1);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('color', colAttr);
    geo.setAttribute('aSize', sizeAttr);
    geo.setAttribute('aAlpha', alphaAttr);
    geo.setDrawRange(0, 0);
    var mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, vertexColors: true,
      blending: THREE.AdditiveBlending
    });
    points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    HB.render.state.scene.add(points);

    for (var i = 0; i < 8; i++) {
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      var line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffd39a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      line.frustumCulled = false;
      line.visible = false;
      HB.render.state.scene.add(line);
      tracers.push({ line: line, life: 0 });
    }
  }

  function spawn(x, y, z, vx, vy, vz, color, size, life, gravity) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({
      x: x, y: y, z: z, vx: vx, vy: vy, vz: vz,
      color: color, size: size, life: life, maxLife: life, gravity: gravity === undefined ? 9 : gravity
    });
  }

  function sparks(p, count, color) {
    for (var i = 0; i < count; i++) {
      spawn(p.x, p.y, p.z,
        (Math.random() - .5) * 5, Math.random() * 3.4 + .4, (Math.random() - .5) * 5,
        color || { r: 1, g: .68, b: .3 }, .05 + Math.random() * .05, .28 + Math.random() * .35, 12);
    }
  }

  function smoke(p, count) {
    for (var i = 0; i < count; i++) {
      spawn(p.x, p.y, p.z,
        (Math.random() - .5) * 1.1, .4 + Math.random() * .8, (Math.random() - .5) * 1.1,
        { r: .46, g: .52, b: .55 }, .22 + Math.random() * .25, .7 + Math.random() * .8, -.7);
    }
  }

  function explosion(p) {
    sparks(p, 26, { r: 1, g: .55, b: .22 });
    smoke(p, 12);
    HB.audio.kill();
  }

  function tracer(a, b) {
    var t = tracers[tracerIndex++ % tracers.length];
    var arr = t.line.geometry.attributes.position.array;
    arr[0] = a.x; arr[1] = a.y - .08; arr[2] = a.z;
    arr[3] = b.x; arr[4] = b.y; arr[5] = b.z;
    t.line.geometry.attributes.position.needsUpdate = true;
    t.line.material.opacity = .5;
    t.line.visible = true;
    t.life = .07;
  }

  function fire(game) {
    game.stats.shots++;
    var p = HB.player.state;
    var origin = HB.player.position();
    var dir = HB.player.forward();
    /* Cone spread grows while firing, tightens when aiming or crouching. */
    var spread = (.0035 + HB.weapon.spread() * .014) * (p.ads ? .34 : 1) * (p.crouching ? .72 : 1) * (p.sprinting ? 1.8 : 1);
    var r = HB.player.right();
    var up = new THREE.Vector3().crossVectors(r, dir).normalize();
    dir.addScaledVector(r, (Math.random() - .5) * spread * 2);
    dir.addScaledVector(up, (Math.random() - .5) * spread * 2);
    dir.normalize();

    var worldHit = HB.world.raycast(origin, dir, 160);
    var limit = Math.min(worldHit.dist, 160);
    var enemyHit = HB.enemies.raycast(origin, dir, limit);
    var end = null;
    if (enemyHit) {
      end = enemyHit.point;
      game.stats.hits++;
      HB.enemies.damage(enemyHit.enemy, enemyHit.damage || 34, game);
      HB.audio.hit();
      HB.ui.hitMarker(false);
      sparks(end, 9, { r: 1, g: .48, b: .28 });
    } else if (worldHit.type !== 'none' && worldHit.point) {
      end = worldHit.point;
      HB.audio.impact();
      sparks(end, 7, worldHit.type === 'water' ? { r: .6, g: .8, b: .9 } : { r: 1, g: .72, b: .36 });
      if (worldHit.type === 'water') smoke(end, 2);
    } else {
      end = origin.clone().addScaledVector(dir, 160);
    }
    tracer(origin.clone().addScaledVector(dir, 1.0), end);
  }

  function update(dt) {
    var n = Math.min(particles.length, MAX_PARTICLES);
    for (var i = particles.length - 1; i >= 0; i--) {
      var q = particles[i];
      q.life -= dt;
      if (q.life <= 0) { particles.splice(i, 1); continue; }
      q.vy -= q.gravity * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      q.vx *= 1 - dt * .9; q.vz *= 1 - dt * .9;
    }
    n = Math.min(particles.length, MAX_PARTICLES);
    for (var k = 0; k < n; k++) {
      var s = particles[k];
      posAttr.array[k * 3] = s.x; posAttr.array[k * 3 + 1] = s.y; posAttr.array[k * 3 + 2] = s.z;
      colAttr.array[k * 3] = s.color.r; colAttr.array[k * 3 + 1] = s.color.g; colAttr.array[k * 3 + 2] = s.color.b;
      sizeAttr.array[k] = s.size;
      alphaAttr.array[k] = U.clamp(s.life / s.maxLife, 0, 1);
    }
    posAttr.needsUpdate = colAttr.needsUpdate = sizeAttr.needsUpdate = alphaAttr.needsUpdate = true;
    points.geometry.setDrawRange(0, n);
    for (var t = 0; t < tracers.length; t++) {
      var tr = tracers[t];
      if (tr.life > 0) {
        tr.life -= dt;
        tr.line.material.opacity = Math.max(0, tr.life / .07) * .5;
        if (tr.life <= 0) tr.line.visible = false;
      }
    }
  }

  function reset() {
    particles.length = 0;
    if (points) points.geometry.setDrawRange(0, 0);
    for (var i = 0; i < tracers.length; i++) { tracers[i].life = 0; tracers[i].line.visible = false; }
  }

  HB.combat = {
    init: init, fire: fire, update: update, reset: reset,
    sparks: sparks, smoke: smoke, explosion: explosion, tracer: tracer,
    count: function () { return particles.length; }
  };
})(window.HB = window.HB || {});
