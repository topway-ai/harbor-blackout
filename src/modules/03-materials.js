/* HARBOR BLACKOUT - procedural materials and controlled English lettering.
   Base surface textures contain paint, ribs, rust, grain and weathering only.
   No text, logo, lettering or watermark is ever drawn into a base texture.
   All lettering is added by sign()/label(), which resolve through the validated
   English catalog and reject any unexpected script. */
(function (HB) {
  'use strict';

  var U = HB.util;
  var textures = {};
  var materials = {};
  var envCube = null;
  var maxAnisotropy = 4;

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return { c: c, x: c.getContext('2d') };
  }

  function colorTexture(canvasObj, repeatX, repeatY, srgb) {
    var tex = new THREE.CanvasTexture(canvasObj.c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX || 1, repeatY || 1);
    tex.anisotropy = maxAnisotropy;
    if (srgb !== false) tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;
    return tex;
  }

  function paintField(o, w, h, base, seed, scale, contrast) {
    var ctx = o.x;
    var img = ctx.createImageData(w, h);
    var d = img.data;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var n = U.fbm(x / (scale || 26), y / (scale || 26), seed, 4);
        var m = (n - .5) * (contrast || 46);
        var grain = (U.hash2(x, y, seed + 991) - .5) * 13;
        var i = (y * w + x) * 4;
        d[i] = U.clamp(base[0] + m + grain, 0, 255);
        d[i + 1] = U.clamp(base[1] + m + grain, 0, 255);
        d[i + 2] = U.clamp(base[2] + m + grain, 0, 255);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function streaks(ctx, w, h, seed, count, color, alpha, widthRange) {
    var rnd = U.mulberry32(seed);
    ctx.save();
    for (var i = 0; i < count; i++) {
      var x = rnd() * w, y = rnd() * h * .6;
      var len = (0.2 + rnd() * .8) * h;
      ctx.globalAlpha = alpha * (.3 + rnd() * .7);
      ctx.strokeStyle = color;
      ctx.lineWidth = (widthRange || 3) * (.3 + rnd());
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + (rnd() - .5) * 5, y + len * .35, x + (rnd() - .5) * 7, y + len * .7, x + (rnd() - .5) * 4, y + len);
      ctx.stroke();
    }
    ctx.restore();
  }

  function speckles(ctx, w, h, seed, count, colors, maxSize) {
    var rnd = U.mulberry32(seed);
    for (var i = 0; i < count; i++) {
      ctx.globalAlpha = .12 + rnd() * .5;
      ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
      var s = 1 + rnd() * (maxSize || 4);
      ctx.fillRect(rnd() * w, rnd() * h, s, s * (.4 + rnd()));
    }
    ctx.globalAlpha = 1;
  }

  function concrete() {
    var o = makeCanvas(256, 256);
    paintField(o, 256, 256, [74, 84, 90], 11, 30, 38);
    var rnd = U.mulberry32(311);
    o.x.strokeStyle = 'rgba(22,30,34,.42)';
    for (var i = 0; i < 26; i++) {
      o.x.lineWidth = .4 + rnd() * 1.1;
      o.x.beginPath();
      var x = rnd() * 256, y = rnd() * 256;
      o.x.moveTo(x, y);
      for (var k = 0; k < 4; k++) { x += (rnd() - .5) * 40; y += (rnd() - .5) * 40; o.x.lineTo(x, y); }
      o.x.stroke();
    }
    for (var j = 0; j < 14; j++) {
      var cx = rnd() * 256, cy = rnd() * 256, r = 12 + rnd() * 42;
      var g = o.x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(28,38,44,.30)');
      g.addColorStop(1, 'rgba(28,38,44,0)');
      o.x.fillStyle = g; o.x.beginPath(); o.x.arc(cx, cy, r, 0, 6.283); o.x.fill();
    }
    speckles(o.x, 256, 256, 512, 900, ['#20292e', '#aab4b6', '#596770'], 2);
    return colorTexture(o, 1, 1);
  }

  function container(base, seed) {
    var o = makeCanvas(256, 256);
    paintField(o, 256, 256, base, seed, 24, 26);
    var ctx = o.x;
    /* Corrugated ribs: alternating light and shade, no lettering. */
    for (var x = 0; x < 256; x += 16) {
      var g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, 'rgba(0,0,0,.34)');
      g.addColorStop(.28, 'rgba(255,255,255,.10)');
      g.addColorStop(.62, 'rgba(255,255,255,.035)');
      g.addColorStop(1, 'rgba(0,0,0,.30)');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 16, 256);
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x, 0, 1.2, 256);
    }
    /* Top and bottom frame rails. */
    ctx.fillStyle = 'rgba(9,14,17,.55)'; ctx.fillRect(0, 0, 256, 9); ctx.fillRect(0, 247, 256, 9);
    ctx.fillStyle = 'rgba(200,210,214,.10)'; ctx.fillRect(0, 9, 256, 2); ctx.fillRect(0, 245, 256, 2);
    streaks(ctx, 256, 256, seed + 71, 46, '#7d3f22', .32, 4);
    streaks(ctx, 256, 256, seed + 93, 22, '#171d20', .22, 2);
    /* Chipped paint revealing primer. */
    var rnd = U.mulberry32(seed + 200);
    for (var i = 0; i < 130; i++) {
      ctx.globalAlpha = .12 + rnd() * .32;
      ctx.fillStyle = rnd() > .45 ? '#8d4a2c' : '#aeb8b8';
      var w = 2 + rnd() * 15, h = 1 + rnd() * 6;
      ctx.fillRect(rnd() * 256, rnd() * 256, w, h);
    }
    ctx.globalAlpha = 1;
    speckles(ctx, 256, 256, seed + 7, 600, ['#101619', '#b9c1c1'], 2);
    /* Corner castings and rivets. */
    ctx.fillStyle = 'rgba(12,17,20,.65)';
    [[2, 2], [238, 2], [2, 238], [238, 238]].forEach(function (p) { ctx.fillRect(p[0], p[1], 16, 16); });
    ctx.fillStyle = 'rgba(190,198,200,.28)';
    for (var rx = 10; rx < 256; rx += 32) { ctx.fillRect(rx, 5, 2, 2); ctx.fillRect(rx, 249, 2, 2); }
    return colorTexture(o, 1, 1);
  }

  function rust() {
    var o = makeCanvas(128, 128);
    paintField(o, 128, 128, [104, 60, 38], 71, 12, 62);
    speckles(o.x, 128, 128, 88, 900, ['#3a2318', '#c98048', '#7d452a'], 3);
    return colorTexture(o, 1, 1);
  }

  function steelDeck() {
    var o = makeCanvas(256, 256);
    paintField(o, 256, 256, [58, 68, 74], 42, 34, 30);
    var ctx = o.x;
    ctx.strokeStyle = 'rgba(180,195,200,.13)'; ctx.lineWidth = 2;
    for (var y = 0; y < 256; y += 32) {
      for (var x = 0; x < 256; x += 32) {
        ctx.beginPath(); ctx.moveTo(x + 8, y + 12); ctx.lineTo(x + 22, y + 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 8, y + 20); ctx.lineTo(x + 22, y + 28); ctx.stroke();
      }
    }
    streaks(ctx, 256, 256, 51, 26, '#8b4a29', .2, 3);
    speckles(ctx, 256, 256, 62, 500, ['#1d272c', '#9aa8ac'], 2);
    return colorTexture(o, 1, 1);
  }

  function wood() {
    var o = makeCanvas(256, 256);
    paintField(o, 256, 256, [116, 88, 58], 17, 20, 34);
    var ctx = o.x;
    for (var y = 0; y < 256; y += 42) {
      ctx.fillStyle = 'rgba(28,20,14,.5)'; ctx.fillRect(0, y, 256, 3);
      ctx.fillStyle = 'rgba(220,190,150,.08)'; ctx.fillRect(0, y + 3, 256, 2);
      for (var k = 0; k < 8; k++) {
        ctx.strokeStyle = 'rgba(48,32,20,.18)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y + 8 + k * 4);
        ctx.bezierCurveTo(80, y + 6 + k * 4, 160, y + 12 + k * 4, 256, y + 8 + k * 4);
        ctx.stroke();
      }
    }
    speckles(ctx, 256, 256, 21, 400, ['#3a2a1c', '#c7a77c'], 2);
    return colorTexture(o, 1, 1);
  }

  function hazard() {
    var o = makeCanvas(128, 128);
    var ctx = o.x;
    paintField(o, 128, 128, [178, 142, 48], 31, 22, 22);
    ctx.save();
    ctx.strokeStyle = 'rgba(18,20,20,.85)'; ctx.lineWidth = 18;
    for (var i = -128; i < 256; i += 36) {
      ctx.beginPath(); ctx.moveTo(i, 128); ctx.lineTo(i + 128, 0); ctx.stroke();
    }
    ctx.restore();
    speckles(ctx, 128, 128, 37, 340, ['#101416', '#e3c87d'], 2);
    return colorTexture(o, 1, 1);
  }

  function fence() {
    var o = makeCanvas(128, 128);
    var ctx = o.x;
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(150,170,178,.55)'; ctx.lineWidth = 1.1;
    for (var x = -128; x < 256; x += 12) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 128, 128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 128, 0); ctx.lineTo(x, 128); ctx.stroke();
    }
    return colorTexture(o, 1, 1);
  }

  function darkMetal() {
    var o = makeCanvas(128, 128);
    paintField(o, 128, 128, [48, 57, 62], 9, 18, 26);
    streaks(o.x, 128, 128, 19, 20, '#8b4a29', .18, 2);
    speckles(o.x, 128, 128, 26, 300, ['#141b1f', '#8b9a9f'], 2);
    return colorTexture(o, 1, 1);
  }

  function glow(color) {
    var o = makeCanvas(64, 64);
    var g = o.x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color);
    g.addColorStop(.3, color.replace('rgb(', 'rgba(').replace(')', ',.55)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    o.x.fillStyle = g; o.x.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(o.c);
    tex.needsUpdate = true;
    return tex;
  }

  function cubeFace(index) {
    var o = makeCanvas(128, 128);
    var ctx = o.x;
    var g = ctx.createLinearGradient(0, 0, 0, 128);
    if (index === 2) { /* sky */
      g.addColorStop(0, '#7d919e'); g.addColorStop(1, '#a6b2b6');
    } else if (index === 3) { /* ground bounce */
      g.addColorStop(0, '#1b262c'); g.addColorStop(1, '#0c1216');
    } else {
      g.addColorStop(0, '#6b7f8c'); g.addColorStop(.55, '#8a969b');
      g.addColorStop(.72, '#b08455'); g.addColorStop(.78, '#4c565c');
      g.addColorStop(1, '#1a242a');
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    if (index !== 2 && index !== 3) {
      var rnd = U.mulberry32(100 + index);
      ctx.fillStyle = 'rgba(18,26,31,.55)';
      for (var i = 0; i < 12; i++) {
        var w = 5 + rnd() * 18, h = 4 + rnd() * 15;
        ctx.fillRect(rnd() * 128, 76 + rnd() * 8 - h, w, h);
      }
      var gg = ctx.createLinearGradient(0, 70, 0, 128);
      gg.addColorStop(0, 'rgba(226,157,84,.20)'); gg.addColorStop(1, 'rgba(226,157,84,0)');
      ctx.fillStyle = gg; ctx.fillRect(0, 70, 128, 58);
    }
    return o.c;
  }

  function environment() {
    var faces = [0, 1, 2, 3, 4, 5].map(cubeFace);
    var tex = new THREE.CubeTexture(faces);
    tex.needsUpdate = true;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  /* Controlled lettering. The string must already be English and catalog-derived. */
  function drawSpacedText(ctx, text, px, x, y, spacing, maxW) {
    var size = px;
    ctx.font = 'bold ' + size + 'px Arial, Helvetica, sans-serif';
    var w = 0;
    for (var i = 0; i < text.length; i++) w += ctx.measureText(text[i]).width + spacing;
    while (w > maxW && size > 8) {
      size -= 1; ctx.font = 'bold ' + size + 'px Arial, Helvetica, sans-serif';
      w = 0;
      for (var j = 0; j < text.length; j++) w += ctx.measureText(text[j]).width + spacing;
    }
    var sx = x - w / 2;
    for (var k = 0; k < text.length; k++) {
      ctx.fillText(text[k], sx, y);
      sx += ctx.measureText(text[k]).width + spacing;
    }
  }

  function label(text, opts) {
    var o = opts || {};
    HB.strings.assertEnglish(text, 'canvas label');
    HB.strings.register('canvas label', text);
    var lines = String(text).split('|');
    lines.forEach(function (line) { HB.strings.register('canvas label line', line); });
    var w = o.width || 512, h = o.height || 128;
    var c = makeCanvas(w, h);
    var ctx = c.x;
    var bg = o.bg || '#1b262c';
    var fg = o.fg || '#e8edea';
    var seed = o.seed || 7;
    if (o.screen) {
      paintField(c, w, h, [13, 26, 30], seed, 18, 12);
      ctx.fillStyle = 'rgba(90,190,190,.055)';
      for (var sy = 0; sy < h; sy += 4) ctx.fillRect(0, sy, w, 1);
      ctx.strokeStyle = o.accent || 'rgba(240,173,85,.6)'; ctx.lineWidth = 3;
      ctx.strokeRect(4, 4, w - 8, h - 8);
    } else {
      paintField(c, w, h, hexToRgb(bg), seed, 20, 22);
      streaks(ctx, w, h, seed + 13, 10, '#000000', .10, 2);
      speckles(ctx, w, h, seed + 29, Math.floor(w * h / 500), ['#10171b', '#c9d1cf'], 2);
      ctx.strokeStyle = o.border || 'rgba(226,232,228,.5)'; ctx.lineWidth = o.borderWidth || 4;
      ctx.strokeRect(7, 7, w - 14, h - 14);
      if (o.rivets !== false) {
        ctx.fillStyle = 'rgba(210,218,216,.45)';
        [[16, 16], [w - 16, 16], [16, h - 16], [w - 16, h - 16]].forEach(function (p) {
          ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 6.283); ctx.fill();
        });
      }
    }
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    ctx.shadowColor = o.screen ? (o.accent || 'rgba(120,220,220,.8)') : 'rgba(0,0,0,.6)';
    ctx.shadowBlur = o.screen ? 8 : 2;
    var spacing = o.spacing === undefined ? Math.max(1, (o.font || 40) * .075) : o.spacing;
    var px = o.font || 40;
    var lineH = px * 1.35;
    var startY = h / 2 - (lines.length - 1) * lineH / 2;
    for (var i = 0; i < lines.length; i++) {
      drawSpacedText(ctx, lines[i], px - (i ? 4 : 0), w / 2, startY + i * lineH, spacing, w - 34);
    }
    ctx.shadowBlur = 0;
    if (o.stripe) {
      ctx.fillStyle = o.stripe;
      ctx.fillRect(0, h - 14, w, 14);
    }
    var tex = new THREE.CanvasTexture(c.c);
    tex.anisotropy = maxAnisotropy;
    tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;
    return tex;
  }

  /* Preferred entry point: catalog key -> validated English sign texture. */
  function sign(key, opts) {
    return label(HB.t(key), opts);
  }

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
  }

  function init(anisotropy) {
    maxAnisotropy = anisotropy || 4;
    textures.concrete = concrete();
    textures.containerBlue = container([44, 72, 86], 3);
    textures.containerTeal = container([50, 84, 82], 5);
    textures.containerRust = container([112, 62, 43], 7);
    textures.containerGrey = container([72, 80, 84], 9);
    textures.containerSand = container([124, 108, 76], 13);
    textures.rust = rust();
    textures.deck = steelDeck();
    textures.wood = wood();
    textures.hazard = hazard();
    textures.fence = fence();
    textures.dark = darkMetal();
    textures.glowAmber = glow('rgb(255,186,96)');
    textures.glowRed = glow('rgb(255,80,60)');
    textures.glowCyan = glow('rgb(120,220,230)');
    envCube = environment();

    materials.concrete = new THREE.MeshStandardMaterial({ map: textures.concrete, roughness: .58, metalness: .08, color: 0xa8b2b6, envMap: envCube, envMapIntensity: .55 });
    materials.ground = new THREE.MeshStandardMaterial({ map: textures.concrete, roughness: .42, metalness: .12, color: 0x7e8a90, envMap: envCube, envMapIntensity: .85 });
    materials.puddle = new THREE.MeshStandardMaterial({ color: 0x27353c, roughness: .08, metalness: .82, envMap: envCube, envMapIntensity: 1.25, transparent: true, opacity: .9 });
    materials.deck = new THREE.MeshStandardMaterial({ map: textures.deck, roughness: .52, metalness: .62, color: 0x9ba7ab, envMap: envCube, envMapIntensity: .5 });
    materials.rust = new THREE.MeshStandardMaterial({ map: textures.rust, roughness: .8, metalness: .35, color: 0xaaaaaa });
    materials.wood = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: .82, metalness: .02, color: 0xbbaa99 });
    materials.hazard = new THREE.MeshStandardMaterial({ map: textures.hazard, roughness: .7, metalness: .2 });
    materials.dark = new THREE.MeshStandardMaterial({ map: textures.dark, roughness: .58, metalness: .68, color: 0x9aa6ab, envMap: envCube, envMapIntensity: .5 });
    materials.steel = new THREE.MeshStandardMaterial({ color: 0x56656d, roughness: .42, metalness: .8, envMap: envCube, envMapIntensity: .75 });
    materials.black = new THREE.MeshStandardMaterial({ color: 0x151c21, roughness: .48, metalness: .55 });
    materials.paintYellow = new THREE.MeshStandardMaterial({ color: 0xb08a3c, roughness: .68, metalness: .25 });
    materials.paintWhite = new THREE.MeshStandardMaterial({ color: 0x9fa9a9, roughness: .72, metalness: .12 });
    materials.concreteWall = new THREE.MeshStandardMaterial({ color: 0x4c585f, roughness: .9, metalness: .04, map: textures.concrete });
    materials.glass = new THREE.MeshStandardMaterial({ color: 0x263b45, roughness: .12, metalness: .35, transparent: true, opacity: .6, envMap: envCube, envMapIntensity: 1 });
    materials.fence = new THREE.MeshBasicMaterial({ map: textures.fence, transparent: true, side: THREE.DoubleSide, depthWrite: false, color: 0x9fb0b8 });
    materials.lamp = new THREE.MeshBasicMaterial({ color: 0xffc078 });
    materials.lampOff = new THREE.MeshBasicMaterial({ color: 0x3a4145 });
    materials.redLamp = new THREE.MeshBasicMaterial({ color: 0xff5038 });
    materials.greenLamp = new THREE.MeshBasicMaterial({ color: 0x8fd0b0 });
    materials.water = new THREE.MeshStandardMaterial({ color: 0x22343e, roughness: .18, metalness: .55, envMap: envCube, envMapIntensity: 1.4, transparent: true, opacity: .94 });
    materials.silhouette = new THREE.MeshBasicMaterial({ color: 0x273640, fog: true });
    materials.container = [
      new THREE.MeshStandardMaterial({ map: textures.containerBlue, roughness: .62, metalness: .52, envMap: envCube, envMapIntensity: .45 }),
      new THREE.MeshStandardMaterial({ map: textures.containerTeal, roughness: .62, metalness: .52, envMap: envCube, envMapIntensity: .45 }),
      new THREE.MeshStandardMaterial({ map: textures.containerRust, roughness: .72, metalness: .42, envMap: envCube, envMapIntensity: .4 }),
      new THREE.MeshStandardMaterial({ map: textures.containerGrey, roughness: .62, metalness: .5, envMap: envCube, envMapIntensity: .45 }),
      new THREE.MeshStandardMaterial({ map: textures.containerSand, roughness: .7, metalness: .38, envMap: envCube, envMapIntensity: .4 })
    ];
    return materials;
  }

  HB.materials = {
    init: init, label: label, sign: sign, glow: glow,
    get: function (name) { return materials[name]; },
    all: function () { return materials; },
    textures: function () { return textures; },
    env: function () { return envCube; }
  };
})(window.HB = window.HB || {});
