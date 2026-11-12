/* HARBOR BLACKOUT - procedural harbor world.
   Zones: container yard (south), maintenance shed interior (center),
   quayside and extraction berth (north). Everything is built from geometry
   and canvas textures at runtime; no external assets are fetched.

   Base textures never contain lettering. Every sign, label and screen is
   created by signPlane(), which resolves an English catalog key through
   HB.materials.sign() and therefore through the string validator. */
(function (HB) {
  'use strict';

  var U = HB.util;
  var M = null;
  var S = null;

  var W = {
    scene: null,
    colliders: [],
    walkable: [],
    hazards: [],
    relays: [],
    extraction: null,
    enemySpawns: [],
    routes: [],
    safePoints: [],
    signs: [],
    beacons: [],
    rain: null,
    rainPositions: null,
    rainCount: 0,
    water: null,
    waveStreaks: [],
    sun: null,
    spawn: { x: 0, z: 42, yaw: 0 },
    relayOrder: ['A', 'B', 'C'],
    time: 0
  };

  function box(w, h, d, mat, x, y, z, parent, opts) {
    var o = opts || {};
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    if (o.ry) mesh.rotation.y = o.ry;
    if (o.rx) mesh.rotation.x = o.rx;
    mesh.castShadow = o.cast !== false;
    mesh.receiveShadow = o.receive !== false;
    (parent || S).add(mesh);
    return mesh;
  }

  function cyl(rt, rb, h, seg, mat, x, y, z, parent, opts) {
    var o = opts || {};
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 10), mat);
    mesh.position.set(x, y, z);
    if (o.rx) mesh.rotation.x = o.rx;
    if (o.rz) mesh.rotation.z = o.rz;
    mesh.castShadow = o.cast !== false;
    mesh.receiveShadow = o.receive !== false;
    (parent || S).add(mesh);
    return mesh;
  }

  function signPlane(key, opts, w, h, x, y, z, ry, parent) {
    var tex = HB.materials.sign(key, opts);
    var mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide, transparent: false });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry || 0;
    (parent || S).add(mesh);
    W.signs.push({ key: key, mesh: mesh });
    return mesh;
  }

  function instances(geo, mat, transforms, parent) {
    if (!transforms.length) return null;
    var im = new THREE.InstancedMesh(geo, mat, transforms.length);
    var dummy = new THREE.Object3D();
    for (var i = 0; i < transforms.length; i++) {
      var t = transforms[i];
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
      dummy.scale.set(t.sx || 1, t.sy || 1, t.sz || 1);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      if (t.color) im.setColorAt(i, new THREE.Color(t.color));
    }
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = true;
    im.receiveShadow = true;
    (parent || S).add(im);
    return im;
  }

  function collider(x, z, w, d, h, tag) {
    W.colliders.push(U.box(x, z, w, d, h, { tag: tag || 'structure' }));
  }

  function rect(minX, maxX, minZ, maxZ, tag) {
    return { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ, tag: tag || 'zone' };
  }

  function lamp(x, y, z, color, intensity, parent) {
    var g = new THREE.Group();
    g.position.set(x, y, z);
    var shade = cyl(.36, .22, .18, 10, M.get('dark'), 0, 0, 0, g, { cast: false });
    var bulb = cyl(.26, .26, .06, 10, new THREE.MeshBasicMaterial({ color: color }), 0, -.1, 0, g, { cast: false });
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: HB.materials.textures().glowAmber, color: color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.scale.set(2.6, 2.6, 1); sprite.position.y = -.12;
    g.add(sprite);
    (parent || S).add(g);
    if (intensity > 0) {
      var l = new THREE.PointLight(color, intensity, 16, 2);
      l.position.set(x, y - .15, z);
      (parent || S).add(l);
    }
    W.beacons.push({ group: g, sprite: sprite, phase: Math.random() * 6.28 });
    return g;
  }

  function wire(from, to, sag, radius, mat) {
    var a = new THREE.Vector3(from[0], from[1], from[2]);
    var b = new THREE.Vector3(to[0], to[1], to[2]);
    var mid = a.clone().add(b).multiplyScalar(.5); mid.y -= sag || 1.2;
    var curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    var mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, radius || .025, 4, false), mat || M.get('black'));
    mesh.castShadow = false;
    S.add(mesh);
    return mesh;
  }

  function puddle(x, z, r) {
    var geo = new THREE.CircleGeometry(r, 14);
    var m = new THREE.Mesh(geo, M.get('puddle'));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, .012, z);
    m.scale.set(1, .55 + Math.random() * .6, 1);
    m.receiveShadow = false;
    S.add(m);
    /* Cheap reflected amber light streak, no text or imagery. */
    var streak = new THREE.Mesh(new THREE.PlaneGeometry(r * .22, r * 1.4),
      new THREE.MeshBasicMaterial({ color: 0xffb765, transparent: true, opacity: .09, blending: THREE.AdditiveBlending, depthWrite: false }));
    streak.rotation.x = -Math.PI / 2; streak.position.set(x + r * .18, .018, z);
    S.add(streak);
  }

  function skyDome() {
    var geo = new THREE.SphereGeometry(400, 24, 16);
    var mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new THREE.Color(0x4b606e) }, uHorizon: { value: new THREE.Color(0x9aa7ab) }, uWarm: { value: new THREE.Color(0xd6a06a) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: [
        'uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uWarm; varying vec3 vP;',
        'void main(){ float h = normalize(vP).y;',
        ' vec3 c = mix(uHorizon, uTop, smoothstep(-0.02, 0.62, h));',
        ' float band = exp(-pow((h - 0.015) * 9.0, 2.0)) * 0.42;',
        ' c = mix(c, uWarm, band);',
        ' c *= 0.92 + 0.08 * smoothstep(-0.4, 0.1, h);',
        ' gl_FragColor = vec4(c, 1.0); }'
      ].join('\n')
    });
    var dome = new THREE.Mesh(geo, mat);
    dome.frustumCulled = false;
    S.add(dome);
  }

  /* ------------------------------ STAGE 0: renderer + materials --------- */
  function stageMaterials() {
    HB.materials.init(HB.render.state.renderer.capabilities.getMaxAnisotropy());
    M = HB.materials;
    W.walkable = [
      rect(-56, 56, -42, 54, 'yard'),
      rect(-26, 26, -76, -34, 'approach'),
      rect(-56, 56, -116, -68, 'quay'),
      rect(-5, 5, -128, -106, 'pier'),
      rect(-8, 8, -147, -122, 'boat')
    ];
    W.hazards = [rect(-90, -8.5, -170, -116, 'water'), rect(8.5, 90, -170, -116, 'water')];
    W.safePoints = [{ x: 0, z: 40 }, { x: 0, z: -44 }, { x: 0, z: -84 }, { x: 0, z: -104 }];
  }

  /* ------------------------------ STAGE 1: foundation ------------------- */
  function stageFoundation() {
    skyDome();
    var groundTex = HB.materials.textures().concrete.clone();
    groundTex.repeat.set(64, 64); groundTex.needsUpdate = true;
    var groundMat = new THREE.MeshStandardMaterial({ map: groundTex, color: 0x7f8a8f, roughness: .52, metalness: .1, envMap: HB.materials.env(), envMapIntensity: .55 });
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -.02, -30); ground.receiveShadow = true;
    S.add(ground);

    /* Zone surface patches. */
    var yardPatch = new THREE.Mesh(new THREE.PlaneGeometry(112, 96), groundMat);
    yardPatch.rotation.x = -Math.PI / 2; yardPatch.position.set(0, .002, 6); yardPatch.receiveShadow = true; S.add(yardPatch);
    var quayMat = new THREE.MeshStandardMaterial({ map: (function () { var t = HB.materials.textures().deck.clone(); t.repeat.set(22, 10); t.needsUpdate = true; return t; })(), color: 0x8b979c, roughness: .5, metalness: .5, envMap: HB.materials.env(), envMapIntensity: .6 });
    var quay = new THREE.Mesh(new THREE.PlaneGeometry(112, 48), quayMat);
    quay.rotation.x = -Math.PI / 2; quay.position.set(0, .01, -92); quay.receiveShadow = true; S.add(quay);

    /* Sea: base plane plus optional high-quality planar reflector. */
    var sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 420, 1, 1), M.get('water'));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, -1.15, -240); sea.receiveShadow = false;
    S.add(sea); W.water = sea;
    var reflector = HB.render.createReflector(600, 420, -1.13, 512);
    reflector.position.set(0, 0, -240);
    S.add(reflector);
    W.reflectorGroup = reflector;

    /* Moving wave highlights. */
    var waveMat = new THREE.MeshBasicMaterial({ color: 0x9ab4bd, transparent: true, opacity: .055, blending: THREE.AdditiveBlending, depthWrite: false });
    var waveGeo = new THREE.PlaneGeometry(9, .18);
    var waveTransforms = [];
    var rnd = U.mulberry32(991);
    for (var i = 0; i < 70; i++) {
      waveTransforms.push({ x: (rnd() - .5) * 220, z: -120 - rnd() * 120, y: -1.1 + rnd() * .02, ry: (rnd() - .5) * .3, sx: .6 + rnd() * 1.8 });
    }
    var waves = new THREE.InstancedMesh(waveGeo, waveMat, waveTransforms.length);
    var d = new THREE.Object3D();
    for (var k = 0; k < waveTransforms.length; k++) {
      var t = waveTransforms[k];
      d.position.set(t.x, t.y, t.z); d.rotation.set(-Math.PI / 2, 0, t.ry); d.scale.set(t.sx, 1, 1); d.updateMatrix();
      waves.setMatrixAt(k, d.matrix);
    }
    waves.instanceMatrix.needsUpdate = true;
    S.add(waves); W.waveStreaks.push(waves);

    /* Lighting: cool dawn sky, low warm sun from the east. */
    S.add(new THREE.HemisphereLight(0x9db4c4, 0x2a3338, .85));
    var sun = new THREE.DirectionalLight(0xc3d2dc, .9);
    sun.position.set(70, 78, 24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -105; sun.shadow.camera.right = 105;
    sun.shadow.camera.top = 105; sun.shadow.camera.bottom = -105;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 280;
    sun.shadow.bias = -.0006;
    S.add(sun); S.add(sun.target);
    W.sun = sun; HB.render.state.sun = sun;
    var warm = new THREE.DirectionalLight(0xe6a869, .28);
    warm.position.set(-60, 24, -110); S.add(warm);
    S.fog = new THREE.FogExp2(0x6b7c88, .0068);

    /* Rain volume: line segments recycled around the camera. */
    var count = HB.render.settings().rain;
    W.rainCount = count;
    var positions = new Float32Array(count * 6);
    var rnd2 = U.mulberry32(1234);
    for (var r = 0; r < count; r++) {
      var x = (rnd2() - .5) * 70, y = rnd2() * 26, z = (rnd2() - .5) * 70;
      positions[r * 6] = x; positions[r * 6 + 1] = y; positions[r * 6 + 2] = z;
      positions[r * 6 + 3] = x + .12; positions[r * 6 + 4] = y - .55; positions[r * 6 + 5] = z + .04;
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var rainMat = new THREE.LineBasicMaterial({ color: 0xb9ced9, transparent: true, opacity: .26, depthWrite: false });
    var rain = new THREE.LineSegments(geo, rainMat);
    rain.frustumCulled = false;
    S.add(rain); W.rain = rain; W.rainPositions = positions;
  }

  /* ------------------------------ STAGE 2: container yard --------------- */
  function containerStack(x, z, levels, colorIndex, rot, idKey) {
    var cw = 6.0, cd = 2.5, ch = 2.6;
    var rnd = U.mulberry32(Math.floor(x * 31 + z * 17 + 900));
    for (var i = 0; i < levels; i++) {
      var mat = M.all().container[colorIndex % 5];
      var m = box(cw, ch, cd, mat, x, ch / 2 + i * ch + .02, z, null, { ry: rot || 0 });
      m.castShadow = true; m.receiveShadow = true;
      /* Corner castings give the box a convincing silhouette. */
      if (i === levels - 1) {
        var cap = box(cw + .12, .12, cd + .12, M.get('dark'), x, ch * levels + .08, z, null, { ry: rot || 0, cast: false });
        cap.receiveShadow = false;
      }
    }
    collider(x, z, cw + .25, cd + .25, ch * levels, 'container');
    /* English company decal and cargo code on the visible long side. */
    var company = [ 'LBL_NORTHSTAR_FREIGHT', 'LBL_ATLANTIC_CARGO', 'LBL_PACIFIC_LOGISTICS' ][colorIndex % 3];
    signPlane(company, { bg: '#23343c', fg: '#dfe8e6', font: 34, border: 'rgba(220,230,228,.35)', seed: colorIndex * 13 + 3 },
      3.4, .78, x, 1.55, z + cd / 2 + .015, 0);
    if (idKey && levels === 1) {
      signPlane(idKey, { bg: '#26353b', fg: '#c8d4d2', font: 30, spacing: 2, borderWidth: 2, seed: 8 },
        2.6, .46, x - 1.3, 2.15, z + cd / 2 + .016, 0);
    }
    if (rnd() > .72) {
      signPlane('LBL_GRAFFITI_' + (1 + (colorIndex % 3)), { bg: '#2a363a', fg: '#c7a06a', font: 44, borderWidth: 0, rivets: false, seed: 44 },
        2.2, .62, x + 1.6, 1.0, z - cd / 2 - .016, Math.PI);
    }
  }

  function gantryCrane(x, z, height, span, labelKey) {
    var g = new THREE.Group(); g.position.set(x, 0, z); S.add(g);
    var legMat = M.get('steel');
    [-span / 2, span / 2].forEach(function (lx) {
      [-7, 7].forEach(function (lz) {
        box(1.05, height, 1.05, legMat, lx, height / 2, lz, g);
        box(2.2, .5, 2.2, M.get('dark'), lx, .25, lz, g);
      });
      box(1.1, .8, 16, M.get('dark'), lx, height * .35, 0, g);
    });
    box(span + 3, 1.5, 2.2, legMat, 0, height, 0, g);
    box(span + 1, .5, 1.4, M.get('rust'), 0, height + 1.1, 0, g);
    box(4.2, 2.2, 3.4, M.get('dark'), -span * .3, height - 1.4, 0, g);
    /* Boom reaching over the water/yard. */
    var boom = box(1.5, 1.1, 34, legMat, 0, height + 2.3, -12, g);
    boom.castShadow = true;
    box(1.6, 1.2, 2, M.get('paintYellow'), 0, height + 2.3, -28, g);
    wire([-span / 2 + 1, height + 2.4, -2], [0, height + 2.4, -28], 1.4, .05, M.get('black'));
    wire([span / 2 - 1, height + 2.4, -2], [0, height + 2.4, -28], 1.4, .05, M.get('black'));
    wire([0, height + 2.3, -28], [0, height - 4, -28], .1, .035, M.get('black'));
    box(2.6, .5, 2.2, M.get('hazard'), 0, height - 4.4, -28, g);
    signPlane(labelKey, { bg: '#263238', fg: '#e9d9a8', font: 42, seed: 5 }, 3.2, .9, -span * .3, height - 1.4, 1.75, 0, g);
    var beacon = new THREE.Mesh(new THREE.SphereGeometry(.17, 8, 8), M.get('redLamp'));
    beacon.position.set(0, height + 1.5, 0); g.add(beacon);
    W.beacons.push({ group: g, beacon: beacon, phase: Math.random() * 6.28 });
    collider(x - span / 2, z - 7, 1.4, 1.4, height, 'crane');
    collider(x + span / 2, z - 7, 1.4, 1.4, height, 'crane');
    collider(x - span / 2, z + 7, 1.4, 1.4, height, 'crane');
    collider(x + span / 2, z + 7, 1.4, 1.4, height, 'crane');
  }

  function fenceLine(x1, z1, x2, z2, height, gaps) {
    var dx = x2 - x1, dz = z2 - z1;
    var len = Math.sqrt(dx * dx + dz * dz);
    var nx = -dz / len, nz = dx / len;
    var count = Math.max(1, Math.floor(len / 3));
    var postTransforms = [];
    var panelMat = M.get('fence');
    for (var i = 0; i < count; i++) {
      var t = (i + .5) / count;
      var px = x1 + dx * t, pz = z1 + dz * t;
      var inGap = (gaps || []).some(function (gp) { return U.dist2(px, pz, gp.x, gp.z) < gp.r; });
      if (inGap) continue;
      postTransforms.push({ x: px, y: height / 2, z: pz });
      var panel = new THREE.Mesh(new THREE.PlaneGeometry(len / count, height), panelMat);
      panel.position.set(px, height / 2, pz);
      panel.rotation.y = Math.atan2(-nx, -nz);
      S.add(panel);
      if (i === 0 || i === count - 1 || i % 4 === 0) {
        var rail = box(len / count, .09, .09, M.get('steel'), px, height, pz);
        rail.rotation.y = Math.atan2(dx, dz);
        rail.castShadow = false;
      }
    }
    instances(new THREE.CylinderGeometry(.075, .09, height, 6), M.get('steel'), postTransforms);
    /* Fence collider, split around gaps. */
    var segs = (gaps || []).length ? [] : [{ a: 0, b: 1 }];
    if (!gaps || !gaps.length) {
      collider((x1 + x2) / 2, (z1 + z2) / 2, Math.abs(dx) + .35, Math.abs(dz) + .35, height, 'fence');
    }
    return segs;
  }

  function relayCabinet(id, screenOnKey, screenOffKey, x, z, ry) {
    var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry || 0; S.add(g);
    box(1.25, 1.9, .68, M.get('dark'), 0, .95, 0, g);
    box(1.35, .16, .78, M.get('steel'), 0, .08, 0, g);
    box(1.1, .13, .72, M.get('hazard'), 0, 1.86, 0, g);
    var screenMat = new THREE.MeshBasicMaterial({ map: HB.materials.sign(screenOnKey, { screen: true, accent: 'rgba(240,173,85,.75)', width: 320, height: 190, font: 36, seed: 21 }), toneMapped: false });
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(.94, .56), screenMat);
    screen.position.set(0, 1.32, .35); g.add(screen);
    var keypad = box(.6, .22, .06, M.get('black'), 0, .87, .37, g, { cast: false });
    keypad.rotation.x = -.4;
    var light = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 10), M.get('redLamp'));
    light.position.set(.45, 1.65, .38); g.add(light);
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: HB.materials.textures().glowRed, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(.9, .9, 1); glow.position.set(.45, 1.65, .42); g.add(glow);
    cyl(.035, .035, 1.5, 6, M.get('steel'), -.48, 2.55, -.1, g);
    var tip = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 8), M.get('redLamp'));
    tip.position.set(-.48, 3.3, -.1); g.add(tip);
    signPlane('LBL_RELAY_PANEL', { bg: '#1d282d', fg: '#d8e0dc', font: 26, spacing: 1, width: 512, height: 96, borderWidth: 3, seed: 15 },
      1.0, .2, 0, .62, .365, 0, g);
    signPlane('LBL_GRID', { bg: '#1d282d', fg: '#d8e0dc', font: 30, width: 512, height: 96, borderWidth: 3, seed: 16 },
      1.05, .22, 0, .28, .365, 0, g);
    /* Cable conduit. */
    cyl(.09, .09, 1.3, 8, M.get('black'), .7, .65, -.3, g, { rx: Math.PI / 2 });
    collider(x, z, 1.35, .8, 2.0, 'relay');
    var relay = {
      id: id, keyOn: screenOnKey, keyOff: screenOffKey,
      x: x, z: z, group: g, screen: screen, light: light, glow: glow,
      marker: new THREE.Vector3(x, 2.5, z),
      state: 'online', progress: 0, holdTime: 3.4,
      position: new THREE.Vector3(x, 1.3, z)
    };
    W.relays.push(relay);
    return relay;
  }

  function ammoCache(x, z, id) {
    var g = new THREE.Group(); g.position.set(x, 0, z); S.add(g);
    box(.9, .55, .6, M.get('wood'), 0, .28, 0, g);
    box(.95, .08, .65, M.get('dark'), 0, .58, 0, g);
    signPlane('LBL_CRATE', { bg: '#6d5638', fg: '#e6dec9', font: 25, width: 400, height: 90, borderWidth: 2, seed: 33 },
      .7, .18, 0, .34, .31, 0, g);
    collider(x, z, .95, .65, .6, 'crate');
    return { id: id, x: x, z: z, group: g, used: false, marker: new THREE.Vector3(x, 1.1, z) };
  }

  function stageYard() {
    var rnd = U.mulberry32(2026);
    /* Container stacks: a deliberate central lane keeps the route readable. */
    var rows = [
      { z: 26, xs: [-46, -38, -30, -22, -14, 14, 22, 30, 38, 46] },
      { z: 10, xs: [-46, -38, -22, -14, 22, 30, 38, 46] },
      { z: -8, xs: [-46, -38, -14, 14, 30, 38, 46] },
      { z: -26, xs: [-46, -38, -14, 14, 30, 38, 46] },
      { z: -34, xs: [-46, -38, -30, 30, 38, 46] }
    ];
    var ids = ['LBL_CARGO_1', 'LBL_CARGO_2', 'LBL_CARGO_3', 'LBL_CONTAINER_ID_A', 'LBL_CONTAINER_ID_B', 'LBL_CONTAINER_ID_C'];
    rows.forEach(function (row, ri) {
      row.xs.forEach(function (x, xi) {
        var levels = 1 + Math.floor(rnd() * 3);
        if (Math.abs(x) > 42 && rnd() > .6) levels = 3;
        containerStack(x, row.z, levels, (ri * 3 + xi) % 5, 0, ids[(ri + xi) % ids.length]);
      });
    });
    /* A pair of angled stacks for visual variety. */
    containerStack(-20, -16, 2, 2, .09, 'LBL_CONTAINER_ID_C');
    containerStack(20, 18, 2, 4, -.07, 'LBL_CONTAINER_ID_A');

    gantryCrane(-30, 4, 20, 22, 'LBL_CRANE_07');
    /* Crane legs are outside the main lane; keep the second crane near the quay. */

    /* Perimeter fence with a gate at the south entrance. */
    fenceLine(-56, 54, -12, 54, 3.1, []);
    fenceLine(12, 54, 56, 54, 3.1, []);
    fenceLine(-56, 54, -56, -42, 3.1, []);
    fenceLine(56, 54, 56, -42, 3.1, []);
    signPlane('LBL_HARBOR', { bg: '#1d2b32', fg: '#f0b46a', font: 62, width: 900, height: 170, seed: 2 },
      9, 1.7, 0, 3.6, 53.9, Math.PI);
    signPlane('LBL_AUTHORIZED', { bg: '#233038', fg: '#e8ede8', font: 32, width: 700, height: 110, seed: 3 },
      4.4, .7, -30, 2.4, 53.9, Math.PI);

    /* Zone gate into the maintenance approach. */
    box(1.1, 4.2, .8, M.get('steel'), -6.6, 2.1, -41, null);
    box(1.1, 4.2, .8, M.get('steel'), 6.6, 2.1, -41, null);
    box(14.2, 1.0, .9, M.get('dark'), 0, 4.0, -41, null);
    signPlane('LBL_GATE_03', { bg: '#243239', fg: '#f2c078', font: 44, seed: 4 },
      4.6, .85, 0, 4.0, -40.5, 0);
    signPlane('LBL_MAINTENANCE_SHED', { bg: '#25343a', fg: '#dfe8e4', font: 34, width: 760, height: 120, seed: 6 },
      6.4, 1.0, 0, 2.55, -40.5, 0);
    collider(-6.6, -41, 1.1, .8, 4.2, 'gate');
    collider(6.6, -41, 1.1, .8, 4.2, 'gate');

    /* Relay A sits in an open pocket among the stacks. */
    relayCabinet('A', 'LBL_SCREEN_A_ON', 'LBL_SCREEN_A_OFF', -28, -18, 0);
    W.ammoCaches = [ammoCache(-25.4, -16.8, 'A'), null, null];
    signPlane('LBL_DANGER', { bg: '#8e3a28', fg: '#f4e6cf', font: 44, seed: 9 },
      2.2, .62, -28, 2.9, -19.2, 0);
    signPlane('LBL_HIGH_VOLTAGE', { bg: '#283238', fg: '#f0c477', font: 30, width: 620, height: 110, seed: 10 },
      2.6, .56, -31, 1.7, -17.5, Math.PI / 2);

    /* Props: pallets, barrels, crates, cable reels, pipes. */
    var pallets = [], barrels = [], crates = [], reels = [];
    for (var i = 0; i < 70; i++) {
      var x = (rnd() - .5) * 100, z = -36 + rnd() * 86;
      if (Math.abs(x) < 8 || U.dist2(x, z, -28, -18) < 4) continue;
      if (rnd() > .55) pallets.push({ x: x, y: .09, z: z, ry: rnd() * 3 });
      else if (rnd() > .5) barrels.push({ x: x, y: .45, z: z });
      else crates.push({ x: x, y: .42, z: z, ry: rnd() * 3 });
    }
    instances(new THREE.BoxGeometry(1.5, .18, 1.1), M.get('wood'), pallets);
    instances(new THREE.CylinderGeometry(.36, .38, .9, 10), M.get('rust'), barrels);
    instances(new THREE.BoxGeometry(.9, .84, .9), M.get('wood'), crates);
    for (var b = 0; b < barrels.length; b += 3) {
      if (barrels[b]) collider(barrels[b].x, barrels[b].z, .78, .78, .9, 'barrel');
    }
    for (var c = 0; c < crates.length; c += 4) {
      if (crates[c]) collider(crates[c].x, crates[c].z, .95, .95, .85, 'crate');
    }
    [[-12, 34], [12, 34], [-12, -2], [12, -2]].forEach(function (p) {
      reels.push({ x: p[0], y: .65, z: p[1], rz: Math.PI / 2 });
    });
    instances(new THREE.CylinderGeometry(.65, .65, .8, 12), M.get('wood'), reels);

    /* Ground pipes and overhead cables. */
    for (var p = 0; p < 5; p++) {
      var pipe = cyl(.16, .16, 26, 8, M.get('rust'), -48 + p * 1.1, .2, 2, null, { rz: Math.PI / 2 });
      pipe.castShadow = false;
    }
    wire([-14, 7, 30], [14, 6.4, 30], 2.2, .035, M.get('black'));
    wire([-14, 7, 2], [14, 6.7, 2], 2.4, .035, M.get('black'));
    wire([-20, 8, -30], [20, 7.2, -30], 2.1, .035, M.get('black'));

    /* Yard lamps, signs and floor markings. */
    [[-10, 36], [10, 36], [-10, 0], [10, 0], [-10, -32], [10, -32], [-28, -12], [28, -12]].forEach(function (p, idx) {
      box(.18, 6, .18, M.get('steel'), p[0], 3, p[1], null, { cast: false });
      lamp(p[0], 6, p[1], 0xffb45f, idx % 2 === 0 ? .75 : .45);
      collider(p[0], p[1], .3, .3, 6, 'pole');
    });
    signPlane('LBL_CONTAINER_YARD', { bg: '#223038', fg: '#e6ece8', font: 38, width: 760, height: 130, seed: 11 },
      5.2, 1.0, -12, 2.7, 41.5, 0);
    signPlane('LBL_MAX_LOAD', { bg: '#c8a13c', fg: '#1c2224', font: 36, width: 620, height: 110, borderWidth: 3, seed: 12 },
      3.2, .6, -18, 1.5, 27.5, 0);
    signPlane('LBL_KEEP_CLEAR', { bg: '#293940', fg: '#dfe6e2', font: 34, width: 560, height: 100, seed: 13 },
      3.0, .55, 18, 1.4, -33.5, 0);
    signPlane('LBL_NORTHSTAR_FREIGHT', { bg: '#1f3038', fg: '#f0b46a', font: 46, width: 860, height: 150, seed: 14 },
      6.4, 1.15, 34, 2.5, -41.4, 0);
    /* Painted hazard stripes at lane edges, geometry only. */
    for (var s = 0; s < 8; s++) {
      var stripe = box(.16, .02, 4, M.get('paintYellow'), s % 2 ? 8 : -8, .012, 36 - s * 10, null, { cast: false });
      stripe.receiveShadow = false;
    }
    for (var q = 0; q < 26; q++) puddle((rnd() - .5) * 96, -34 + rnd() * 86, .7 + rnd() * 2.3);
  }

  /* ------------------------------ STAGE 3: maintenance shed ------------- */
  function stageShed() {
    var wall = M.get('concreteWall');
    var roofY = 7.4;
    /* Floor. */
    var floorTex = HB.materials.textures().deck.clone(); floorTex.repeat.set(8, 6); floorTex.needsUpdate = true;
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), new THREE.MeshStandardMaterial({ map: floorTex, color: 0x8a989c, roughness: .46, metalness: .45, envMap: HB.materials.env(), envMapIntensity: .55 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, .02, -60); floor.receiveShadow = true; S.add(floor);
    /* Side walls. */
    box(.5, roofY, 24, wall, -20, roofY / 2, -60, null);
    box(.5, roofY, 24, wall, 20, roofY / 2, -60, null);
    /* Front wall (south) with a 9 m bay door gap. */
    box(15.5, roofY, .5, wall, -12.25, roofY / 2, -48, null);
    box(15.5, roofY, .5, wall, 12.25, roofY / 2, -48, null);
    box(9, 2.0, .5, wall, 0, roofY - 1.0, -48, null);
    /* Back wall (north) with a door gap. */
    box(16, roofY, .5, wall, -12, roofY / 2, -72, null);
    box(16, roofY, .5, wall, 12, roofY / 2, -72, null);
    box(8, 2.0, .5, wall, 0, roofY - 1.0, -72, null);
    /* Roof and beams. */
    box(41, .4, 25, M.get('dark'), 0, roofY, -60, null);
    for (var i = -3; i <= 3; i++) {
      box(.35, .5, 24, M.get('steel'), i * 5.5, roofY - .45, -60, null);
    }
    collider(-20, -60, .6, 24, roofY, 'wall');
    collider(20, -60, .6, 24, roofY, 'wall');
    collider(-12.25, -48, 15.5, .6, roofY, 'wall');
    collider(12.25, -48, 15.5, .6, roofY, 'wall');
    collider(-12, -72, 16, .6, roofY, 'wall');
    collider(12, -72, 16, .6, roofY, 'wall');

    /* Bay door frame and raised roller shutter. */
    box(9.4, .35, .7, M.get('hazard'), 0, 5.0, -47.7, null);
    box(9, 1.2, .18, M.get('steel'), 0, 5.6, -47.7, null);
    signPlane('LBL_SCREEN_SHED', { screen: true, accent: 'rgba(240,173,85,.7)', width: 460, height: 190, font: 40, seed: 18 },
      3.6, 1.0, -6.2, 3.1, -47.65, 0);
    signPlane('LBL_DOOR_NOTE', { bg: '#8e3a28', fg: '#f2e4cf', font: 30, width: 620, height: 100, seed: 19 },
      3.4, .58, 6.2, 2.6, -47.65, 0);
    signPlane('LBL_MAINTENANCE_SHED', { bg: '#1e2b31', fg: '#f0b46a', font: 52, width: 900, height: 160, seed: 20 },
      9.0, 1.6, 0, 6.35, -47.62, 0);

    /* Interior: benches, lockers, generator, tool board, catwalk. */
    box(5.0, 1.0, 1.2, M.get('steel'), -13, .5, -58, null);
    collider(-13, -58, 5.2, 1.3, 1.0, 'bench');
    box(4.4, .1, 1.3, M.get('wood'), -13, 1.05, -58, null);
    box(1.1, 2.2, .6, M.get('rust'), -17.5, 1.1, -54, null);
    box(1.1, 2.2, .6, M.get('rust'), -16.3, 1.1, -54, null);
    collider(-17, -54, 2.4, .7, 2.2, 'locker');
    signPlane('LBL_LOCKER', { bg: '#394247', fg: '#dbe3df', font: 26, width: 420, height: 90, borderWidth: 2, seed: 22 },
      1.0, .25, -17, 1.8, -53.65, 0);
    box(3.2, 1.8, 1.6, M.get('dark'), 14, .9, -55, null);
    box(3.3, .18, 1.7, M.get('steel'), 14, 1.9, -55, null);
    collider(14, -55, 3.4, 1.8, 1.9, 'generator');
    signPlane('LBL_GENERATOR', { bg: '#2a353a', fg: '#e6d9b8', font: 30, width: 480, height: 100, seed: 23 },
      2.2, .5, 14, 1.35, -54.15, 0);
    signPlane('LBL_FUEL', { bg: '#8e3a28', fg: '#f4e7d2', font: 28, width: 520, height: 90, seed: 24 },
      2.4, .45, 14, .75, -54.14, 0);
    box(4.6, 1.4, .12, M.get('wood'), 0, 2.2, -71.6, null);
    signPlane('LBL_TOOL_BOARD', { bg: '#2b373c', fg: '#dfe7e2', font: 32, width: 560, height: 110, seed: 25 },
      3.4, .8, 0, 2.3, -71.5, 0);
    /* Catwalk along the east wall. */
    box(1.8, .18, 16, M.get('deck'), 18.6, 3.4, -60, null);
    for (var k = 0; k < 6; k++) {
      box(.08, 1.0, .08, M.get('steel'), 17.8, 3.95, -68 + k * 3, null, { cast: false });
      box(.08, .08, 3, M.get('steel'), 17.8, 4.45, -66.5 + k * 3, null, { cast: false });
    }
    /* Terminal screens. */
    signPlane('LBL_TERMINAL_1', { screen: true, accent: 'rgba(120,220,220,.6)', width: 420, height: 150, font: 30, seed: 26 },
      1.9, .7, -8, 1.8, -71.48, 0);
    signPlane('LBL_TERMINAL_2', { screen: true, accent: 'rgba(240,173,85,.6)', width: 420, height: 150, font: 30, seed: 27 },
      1.9, .7, 8, 1.8, -71.48, 0);
    signPlane('LBL_POWER', { bg: '#283238', fg: '#f0c477', font: 32, width: 520, height: 110, seed: 28 },
      2.4, .55, -8, 2.7, -47.65, 0);
    signPlane('LBL_HIGH_VOLTAGE', { bg: '#8e3a28', fg: '#f4e6cf', font: 32, width: 560, height: 100, seed: 29 },
      2.4, .5, 8, 2.7, -47.65, 0);
    /* Interior lighting. */
    [[-9, -54], [9, -54], [-9, -66], [9, -66]].forEach(function (p, idx) {
      box(.12, .2, 1.5, M.get('dark'), p[0], roofY - .4, p[1], null, { cast: false });
      lamp(p[0], roofY - .6, p[1], 0xffc383, idx < 2 ? .8 : .65);
    });
    /* Relay B against the west interior wall. */
    relayCabinet('B', 'LBL_SCREEN_B_ON', 'LBL_SCREEN_B_OFF', -8, -63, Math.PI / 2);
    W.ammoCaches[1] = ammoCache(-6.8, -61.6, 'B');
    signPlane('LBL_EMERGENCY', { bg: '#8e3a28', fg: '#f4e6cf', font: 30, width: 560, height: 100, seed: 30 },
      2.4, .5, 6, 1.9, -71.5, 0);
    /* Wet floor inside the open bay. */
    for (var pI = 0; pI < 10; pI++) puddle(-8 + pI * 1.7, -50 - (pI % 3) * 2, .6 + (pI % 3) * .3);
    /* Cable trays and pipes. */
    wire([-19, 5.4, -50], [19, 5.2, -50], .5, .06, M.get('black'));
    wire([-19, 5.4, -70], [19, 5.2, -70], .5, .06, M.get('black'));
    cyl(.2, .2, 22, 8, M.get('rust'), -19.4, 4.9, -60, null, { rz: Math.PI / 2 });
  }

  /* ------------------------------ STAGE 4: quayside and boat ------------ */
  function stageQuay() {
    var rnd = U.mulberry32(4477);
    /* Quay edge, bollards, mooring lines. */
    box(112, 1.3, .6, M.get('concreteWall'), 0, -.65, -116, null);
    for (var b = 0; b < 10; b++) {
      var bx = -48 + b * 10.5;
      if (Math.abs(bx) < 7) continue;
      cyl(.32, .4, .75, 10, M.get('dark'), bx, .38, -114.2, null);
      box(.9, .16, .9, M.get('rust'), bx, .78, -114.2, null);
      wire([bx, .8, -114.2], [bx * .35, .4, -124], 1.0, .04, M.get('black'));
      collider(bx, -114.2, .9, .9, .8, 'bollard');
    }
    signPlane('LBL_QUAYSIDE', { bg: '#223038', fg: '#f0b46a', font: 52, width: 760, height: 150, seed: 31 },
      6.0, 1.2, -22, 3.0, -72.3, 0);
    signPlane('LBL_BERTH_04', { bg: '#1e2b31', fg: '#e6ece8', font: 46, width: 620, height: 130, seed: 32 },
      4.4, 1.0, -6, 2.6, -115.6, 0);
    signPlane('LBL_MOORING', { bg: '#283238', fg: '#dfe6e2', font: 32, width: 520, height: 100, seed: 33 },
      2.6, .55, 24, 1.5, -115.6, 0);
    signPlane('LBL_CAUTION', { bg: '#c8a13c', fg: '#1c2224', font: 32, width: 560, height: 100, seed: 34 },
      2.8, .55, -24, 1.5, -115.6, 0);
    signPlane('LBL_HEIGHT', { bg: '#293940', fg: '#dce4e0', font: 30, width: 540, height: 100, seed: 35 },
      2.8, .55, 40, 2.4, -80, 0);

    /* Quay crane, cargo equipment and relay C. */
    gantryCrane(40, -94, 24, 26, 'LBL_CRANE_07');
    relayCabinet('C', 'LBL_SCREEN_C_ON', 'LBL_SCREEN_C_OFF', 32, -96, 0);
    W.ammoCaches[2] = ammoCache(34.4, -94.6, 'C');
    signPlane('LBL_HAZARD', { bg: '#8e3a28', fg: '#f4e6cf', font: 32, width: 620, height: 110, seed: 36 },
      3.2, .6, 32, 3.0, -97.2, 0);
    signPlane('LBL_PACIFIC_LOGISTICS', { bg: '#203038', fg: '#e2eae6', font: 40, width: 800, height: 130, seed: 37 },
      5.6, 1.0, -36, 2.4, -80.2, 0);
    signPlane('LBL_ATLANTIC_CARGO', { bg: '#26353b', fg: '#e2eae6', font: 40, width: 760, height: 130, seed: 38 },
      5.2, 1.0, 20, 2.4, -80.2, 0);

    /* Props on the quay. */
    var crates = [], barrels = [], pallets = [];
    for (var i = 0; i < 44; i++) {
      var x = (rnd() - .5) * 100, z = -74 - rnd() * 38;
      if (Math.abs(x) < 6 || U.dist2(x, z, 32, -96) < 5) continue;
      if (rnd() > .6) crates.push({ x: x, y: .42, z: z, ry: rnd() * 3 });
      else if (rnd() > .5) barrels.push({ x: x, y: .45, z: z });
      else pallets.push({ x: x, y: .09, z: z, ry: rnd() * 3 });
    }
    instances(new THREE.BoxGeometry(1.1, .84, 1.1), M.get('wood'), crates);
    instances(new THREE.CylinderGeometry(.38, .38, .9, 10), M.get('rust'), barrels);
    instances(new THREE.BoxGeometry(1.6, .18, 1.2), M.get('wood'), pallets);
    for (var c = 0; c < crates.length; c += 5) if (crates[c]) collider(crates[c].x, crates[c].z, 1.2, 1.2, .9, 'crate');
    /* Container stacks on the quay edge. */
    containerStack(-42, -86, 2, 0, 0, 'LBL_CARGO_2');
    containerStack(-34, -86, 1, 3, 0, 'LBL_CARGO_3');
    containerStack(46, -104, 2, 1, 0, 'LBL_CARGO_1');
    /* Equipment plates. */
    box(3.2, 2.0, 1.6, M.get('dark'), -18, 1.0, -104, null);
    collider(-18, -104, 3.4, 1.8, 2.0, 'equipment');
    signPlane('LBL_VALVE', { bg: '#2b363a', fg: '#dce4e0', font: 34, width: 460, height: 110, seed: 39 },
      2.0, .5, -18, 1.4, -103.15, 0);
    signPlane('LBL_FIRE_HOSE', { bg: '#8e3a28', fg: '#f4e6cf', font: 30, width: 480, height: 100, seed: 40 },
      2.2, .5, 12, 1.6, -103.2, 0);
    /* Lamps. */
    [[-14, -80], [14, -80], [-14, -104], [14, -104], [32, -90], [-32, -100]].forEach(function (p, idx) {
      box(.18, 6.5, .18, M.get('steel'), p[0], 3.25, p[1], null, { cast: false });
      lamp(p[0], 6.5, p[1], 0xffb45f, idx % 2 ? .5 : .8);
      collider(p[0], p[1], .3, .3, 6.5, 'pole');
    });
    for (var q = 0; q < 22; q++) puddle((rnd() - .5) * 100, -74 - rnd() * 40, .8 + rnd() * 2.2);

    /* Gangway from the quay to the boat. */
    var gang = box(4.6, .28, 18, M.get('deck'), 0, -.14, -117, null);
    gang.receiveShadow = true;
    [-2.35, 2.35].forEach(function (rx) {
      box(.09, 1.05, 18, M.get('steel'), rx, .52, -117, null, { cast: false });
      for (var j = 0; j < 6; j++) box(.09, .09, .09, M.get('steel'), rx, 1.05, -124 + j * 3, null, { cast: false });
    });
    signPlane('LBL_BERTH_04', { bg: '#233038', fg: '#f0b46a', font: 40, width: 560, height: 120, seed: 41 },
      3.2, .7, 0, 2.0, -109.4, 0);

    /* Extraction boat: extruded hull, deck, cabin, rails and lettering. */
    var shape = new THREE.Shape();
    shape.moveTo(-7, -11); shape.lineTo(7, -11); shape.lineTo(7, 8);
    shape.quadraticCurveTo(7, 12.5, 0, 13.5);
    shape.quadraticCurveTo(-7, 12.5, -7, 8);
    shape.closePath();
    var hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 2.5, bevelEnabled: true, bevelSize: .18, bevelThickness: .18, bevelSegments: 1, curveSegments: 8 });
    hullGeo.rotateX(-Math.PI / 2);
    var hull = new THREE.Mesh(hullGeo, M.get('dark'));
    hull.position.set(0, -3.35, -134);
    hull.castShadow = true; hull.receiveShadow = true;
    S.add(hull);
    box(13.6, .34, 25, M.get('deck'), 0, -.17, -134, null);
    box(13.6, .5, .3, M.get('steel'), 0, .05, -122.3, null);
    /* Cabin and wheelhouse. */
    box(7.4, 3.0, 5.2, M.get('paintWhite'), 0, 1.5, -128.5, null);
    box(7.8, .3, 5.6, M.get('dark'), 0, 3.1, -128.5, null);
    for (var w = -2; w <= 2; w++) {
      box(1.1, .9, .06, M.get('glass'), w * 1.4, 2.0, -125.87, null, { cast: false });
    }
    signPlane('LBL_BOAT_NAME', { bg: '#1d2b32', fg: '#f0b46a', font: 48, width: 700, height: 140, seed: 42 },
      4.2, .85, 0, 1.9, -125.84, 0);
    signPlane('LBL_EXTRACTION_BOAT', { bg: '#223038', fg: '#e6ece8', font: 40, width: 760, height: 130, seed: 43 },
      5.0, .85, 0, 1.0, -125.83, 0);
    /* Boarding console beside the extraction marker. */
    box(1.35, 1.5, .5, M.get('dark'), 0, .75, -138.4, null);
    signPlane('LBL_SCREEN_BOAT', { screen: true, accent: 'rgba(240,173,85,.7)', width: 420, height: 180, font: 34, seed: 44 },
      1.15, .62, 0, 1.12, -138.13, 0);
    box(.16, 3.6, .16, M.get('steel'), 0, 4.9, -128.5, null, { cast: false });
    var mastLamp = new THREE.Mesh(new THREE.SphereGeometry(.18, 10, 10), M.get('greenLamp'));
    mastLamp.position.set(0, 6.7, -128.5); S.add(mastLamp);
    lamp(0, 6.5, -128.5, 0xffd08a, .9);
    lamp(-5, 2.2, -138, 0xffb45f, .7);
    lamp(5, 2.2, -138, 0xffb45f, .7);
    /* Deck rails. */
    [-6.6, 6.6].forEach(function (rx) {
      for (var j = 0; j < 8; j++) box(.08, 1.0, .08, M.get('steel'), rx, .5, -142 + j * 2.6, null, { cast: false });
      box(.08, .08, 20, M.get('steel'), rx, 1.0, -132, null, { cast: false });
    });
    signPlane('LBL_DECK_02', { bg: '#283238', fg: '#dfe6e2', font: 32, width: 460, height: 100, seed: 45 },
      2.2, .5, -4, .3, -140, 0);
    signPlane('LBL_LIFE_RING', { bg: '#8e3a28', fg: '#f4e6cf', font: 30, width: 480, height: 100, seed: 46 },
      2.2, .5, 4, .3, -140, 0);
    W.extraction = {
      x: 0, z: -137, radius: 3.2,
      position: new THREE.Vector3(0, 1.2, -137),
      marker: new THREE.Vector3(0, 3.0, -137),
      active: false, progress: 0, holdTime: 1.6
    };
    /* Marker beacon on the deck. */
    var exLight = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 10), M.get('greenLamp'));
    exLight.position.set(0, 1.3, -137); S.add(exLight);
    W.extraction.light = exLight;
    /* Distant ships and horizon silhouettes. */
    var sil = M.get('silhouette');
    [[-95, -230, 38, 9], [70, -265, 52, 12], [10, -310, 70, 14]].forEach(function (sh) {
      box(sh[2], sh[3], 12, sil, sh[0], sh[3] / 2 - 1, sh[1], null, { cast: false, receive: false });
      box(sh[2] * .55, 5, 8, sil, sh[0] + 4, sh[3] + 1.5, sh[1], null, { cast: false, receive: false });
      for (var k = 0; k < 4; k++) box(5, 2.4, 2.6, sil, sh[0] - sh[2] * .3 + k * 6, sh[3] + 1, sh[1] + 2, null, { cast: false, receive: false });
    });
  }

  /* ------------------------------ STAGE 5: nav, spawns, details --------- */
  function stageDetails() {
    W.enemySpawns = [
      { x: 30, z: 6 }, { x: -34, z: -28 }, { x: 14, z: -20 },
      { x: -14, z: -56 }, { x: 14, z: -64 }, { x: -30, z: -84 },
      { x: 26, z: -88 }, { x: -20, z: -108 }, { x: 20, z: -108 },
      { x: 34, z: -32 }, { x: -34, z: 0 }
    ];
    W.routes = [
      [{ x: -10, z: 28 }, { x: -30, z: 12 }, { x: -34, z: -20 }, { x: -12, z: -30 }],
      [{ x: 12, z: 30 }, { x: 32, z: 14 }, { x: 28, z: -14 }, { x: 10, z: -28 }],
      [{ x: -10, z: -50 }, { x: -10, z: -68 }, { x: 10, z: -68 }, { x: 10, z: -50 }],
      [{ x: -24, z: -80 }, { x: -24, z: -106 }, { x: 22, z: -106 }, { x: 22, z: -80 }],
      [{ x: 0, z: -40 }, { x: 0, z: -66 }, { x: 0, z: -96 }, { x: 0, z: -112 }]
    ];
    /* Directional floor arrows are geometry, not glyphs. */
    var arrowMat = M.get('paintYellow');
    for (var i = 0; i < 9; i++) {
      var z = 34 - i * 16;
      if (z < -104) break;
      var a = new THREE.Mesh(new THREE.ConeGeometry(.42, 1.2, 3), arrowMat);
      a.rotation.x = -Math.PI / 2; a.rotation.z = Math.PI;
      a.position.set(0, .02, z);
      a.receiveShadow = false;
      S.add(a);
    }
    /* Wet-look sheen strips near lamps. */
    var rnd = U.mulberry32(7788);
    for (var k = 0; k < 24; k++) {
      var x = (rnd() - .5) * 90, z = -110 + rnd() * 150;
      puddle(x, z, .5 + rnd() * 1.4);
    }
    W.relays.forEach(function (r) { r.state = 'online'; r.progress = 0; });
    W.extraction.active = false;
    setRainCount(HB.render.settings().rain);
  }

  function setRainCount(n) {
    if (!W.rain) return;
    W.rainActive = Math.min(W.rainCount, n);
    W.rain.geometry.setDrawRange(0, W.rainActive * 2);
  }

  function stages(scene) {
    S = scene; W.scene = scene;
    return [
      { key: 'BOOT_STAGE_1', fn: stageMaterials },
      { key: 'BOOT_STAGE_2', fn: stageFoundation },
      { key: 'BOOT_STAGE_3', fn: stageYard },
      { key: 'BOOT_STAGE_4', fn: stageShed },
      { key: 'BOOT_STAGE_5', fn: stageQuay },
      { key: 'BOOT_STAGE_6', fn: stageDetails }
    ];
  }

  /* ------------------------------ runtime queries ------------------------ */
  function inWalkable(x, z, radius) {
    var r = radius || 0;
    for (var i = 0; i < W.walkable.length; i++) {
      if (U.pointInRect(x, z, W.walkable[i], -r)) return true;
    }
    return false;
  }

  function isHazard(x, z) {
    if (U.pointInRect(x, z, W.walkable[3], 0) || U.pointInRect(x, z, W.walkable[4], 0)) return false;
    for (var i = 0; i < W.hazards.length; i++) if (U.pointInRect(x, z, W.hazards[i], 0)) return true;
    return false;
  }

  function verticalOverlap(feetY, height, c) {
    return feetY < c.maxY - .12 && feetY + height > c.minY + .05;
  }

  function hitsCollider(x, z, radius, feetY, height, c) {
    if (!c.solid) return false;
    if (!verticalOverlap(feetY, height, c)) return false;
    var cx = U.clamp(x, c.minX, c.maxX), cz = U.clamp(z, c.minZ, c.maxZ);
    var dx = x - cx, dz = z - cz;
    return dx * dx + dz * dz < radius * radius;
  }

  function validPosition(x, z, radius, feetY, height) {
    if (!inWalkable(x, z, radius)) return false;
    for (var i = 0; i < W.colliders.length; i++) {
      if (hitsCollider(x, z, radius, feetY, height, W.colliders[i])) return false;
    }
    return true;
  }

  function resolveMove(x, z, dx, dz, radius, feetY, height) {
    var nx = x, nz = z, blocked = false;
    if (validPosition(x + dx, z, radius, feetY, height)) nx += dx; else blocked = true;
    if (validPosition(nx, z + dz, radius, feetY, height)) nz += dz; else blocked = true;
    return { x: nx, z: nz, blocked: blocked };
  }

  function rayBox(ox, oy, oz, dx, dy, dz, b) {
    var tmin = -Infinity, tmax = Infinity;
    var axes = [
      [ox, dx, b.minX, b.maxX], [oy, dy, b.minY, b.maxY], [oz, dz, b.minZ, b.maxZ]
    ];
    for (var i = 0; i < 3; i++) {
      var o = axes[i][0], d = axes[i][1], lo = axes[i][2], hi = axes[i][3];
      if (Math.abs(d) < 1e-8) { if (o < lo || o > hi) return Infinity; continue; }
      var t1 = (lo - o) / d, t2 = (hi - o) / d;
      if (t1 > t2) { var tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
    return tmin >= 0 ? tmin : (tmax >= 0 ? 0 : Infinity);
  }

  /* Analytic ray cast against colliders, ground and water. Used for hitscan
     occlusion, impact effects and enemy line-of-sight checks. */
  function raycast(origin, dir, maxDist) {
    var best = { dist: maxDist || 200, point: null, normal: null, type: 'none' };
    for (var i = 0; i < W.colliders.length; i++) {
      var t = rayBox(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, W.colliders[i]);
      if (t < best.dist && t > .02) {
        best.dist = t; best.type = 'structure';
      }
    }
    if (dir.y < -1e-6) {
      var tg = (0 - origin.y) / dir.y;
      if (tg > .02 && tg < best.dist) { best.dist = tg; best.type = 'ground'; }
      var tw = (-1.15 - origin.y) / dir.y;
      if (tw > .02 && tw < best.dist) { best.dist = tw; best.type = 'water'; }
    }
    if (best.type !== 'none') {
      best.point = new THREE.Vector3(origin.x + dir.x * best.dist, origin.y + dir.y * best.dist, origin.z + dir.z * best.dist);
      best.normal = best.type === 'structure' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 1, 0);
    }
    return best;
  }

  function lineBlocked(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < .01) return false;
    var hit = raycast(a, { x: dx / len, y: dy / len, z: dz / len }, len - .25);
    return hit.type === 'structure';
  }

  function nearestSafe(x, z) {
    var best = W.safePoints[0], bd = Infinity;
    for (var i = 0; i < W.safePoints.length; i++) {
      var d = U.dist2(x, z, W.safePoints[i].x, W.safePoints[i].z);
      if (d < bd) { bd = d; best = W.safePoints[i]; }
    }
    return best;
  }

  function setRelayVisual(index, disabled) {
    var r = W.relays[index];
    if (!r) return;
    var key = disabled ? r.keyOff : r.keyOn;
    var tex = HB.materials.sign(key, { screen: true, accent: disabled ? 'rgba(140,220,180,.8)' : 'rgba(240,173,85,.75)', width: 320, height: 190, font: 36, seed: disabled ? 77 : 21 });
    r.screen.material.map = tex;
    r.screen.material.needsUpdate = true;
    r.light.material = disabled ? M.get('greenLamp') : M.get('redLamp');
    r.glow.material.map = disabled ? HB.materials.textures().glowCyan : HB.materials.textures().glowRed;
    r.glow.material.needsUpdate = true;
  }

  function update(dt, camera, time) {
    W.time = time;
    /* Rain follows the camera and wraps in a local volume. */
    if (W.rain && W.rainPositions) {
      var p = W.rainPositions;
      var cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      for (var i = 0; i < W.rainCount; i++) {
        var o = i * 6;
        p[o + 1] -= dt * (14 + (i % 7));
        p[o + 4] = p[o + 1] - .55;
        if (p[o + 1] < -3) {
          var a = (i * 2.399963 + time * .13) % 6.283;
          var rad = 4 + ((i * 37) % 60) * .55;
          var x = cx + Math.cos(a) * rad, z = cz + Math.sin(a) * rad, y = cy + 16 + ((i * 13) % 9);
          p[o] = x; p[o + 1] = y; p[o + 2] = z;
          p[o + 3] = x + .12; p[o + 4] = y - .55; p[o + 5] = z + .04;
        } else {
          p[o] += dt * 1.4; p[o + 3] = p[o] + .12;
        }
      }
      W.rain.geometry.attributes.position.needsUpdate = true;
    }
    /* Beacons pulse gently. */
    for (var b = 0; b < W.beacons.length; b++) {
      var be = W.beacons[b];
      if (be.sprite) be.sprite.material.opacity = .55 + .35 * Math.sin(time * 2.1 + be.phase);
      if (be.beacon) be.beacon.visible = (time + be.phase) % 1.6 < .8;
    }
    /* Wave streaks drift slowly. */
    for (var w = 0; w < W.waveStreaks.length; w++) {
      W.waveStreaks[w].rotation.y = Math.sin(time * .08) * .02;
    }
    if (W.reflectorGroup) W.reflectorGroup.userData.update(time);
    if (W.extraction && W.extraction.light) {
      W.extraction.light.material = W.extraction.active ? M.get('greenLamp') : M.get('lampOff');
    }
  }

  HB.world = {
    data: W,
    stages: stages,
    update: update,
    inWalkable: inWalkable,
    isHazard: isHazard,
    validPosition: validPosition,
    resolveMove: resolveMove,
    raycast: raycast,
    lineBlocked: lineBlocked,
    nearestSafe: nearestSafe,
    setRainCount: setRainCount,
    setRelayVisual: setRelayVisual,
    spawn: function () { return W.spawn; }
  };
})(window.HB = window.HB || {});
