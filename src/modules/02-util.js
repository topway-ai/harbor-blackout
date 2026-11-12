/* HARBOR BLACKOUT - small math, random and formatting helpers. */
(function (HB) {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
  function smoothstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function angleWrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  function angleDelta(a, b) { return angleWrap(b - a); }
  function dist2(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hash2(x, y, seed) {
    var n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647);
    n = Math.imul(n ^ n >>> 13, 1274126177);
    return ((n ^ n >>> 16) >>> 0) / 4294967296;
  }

  function noise2(x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
    var c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }

  function fbm(x, y, seed, octaves) {
    var sum = 0, amp = .5, freq = 1, norm = 0;
    for (var i = 0; i < (octaves || 4); i++) {
      sum += amp * noise2(x * freq, y * freq, seed + i * 17);
      norm += amp; amp *= .5; freq *= 2;
    }
    return sum / norm;
  }

  function formatTime(sec) {
    var s = Math.max(0, Math.floor(sec));
    var m = Math.floor(s / 60);
    return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function pointInRect(x, z, r, margin) {
    var m = margin || 0;
    return x >= r.minX - m && x <= r.maxX + m && z >= r.minZ - m && z <= r.maxZ + m;
  }

  /* Axis-aligned collider. yTop lets low props be jumped over visually. */
  function box(x, z, w, d, h, opts) {
    var o = opts || {};
    return {
      minX: x - w / 2, maxX: x + w / 2,
      minZ: z - d / 2, maxZ: z + d / 2,
      minY: o.minY || 0, maxY: o.maxY === undefined ? h : o.maxY,
      tag: o.tag || 'structure', solid: o.solid !== false
    };
  }

  HB.util = {
    clamp: clamp, lerp: lerp, damp: damp, smoothstep: smoothstep,
    angleWrap: angleWrap, angleDelta: angleDelta, dist2: dist2,
    mulberry32: mulberry32, hash2: hash2, noise2: noise2, fbm: fbm,
    formatTime: formatTime, pointInRect: pointInRect, box: box
  };
})(window.HB = window.HB || {});
