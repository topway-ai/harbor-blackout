/* HARBOR BLACKOUT - WebGL renderer, scalable quality, post-processing and
   planar reflection for the harbor water. */
(function (HB) {
  'use strict';

  var R = {
    renderer: null, scene: null, camera: null, viewScene: null, viewCamera: null,
    quality: 'medium', target: null, postScene: null, postCamera: null, postMat: null,
    reflector: null, width: 1, height: 1, dpr: 1, enabledPost: true
  };

  var POST_VERT = [
    'varying vec2 vUv;',
    'void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'
  ].join('\n');

  var POST_FRAG = [
    'precision highp float;',
    'uniform sampler2D tDiffuse;',
    'uniform float uTime;',
    'uniform float uDamage;',
    'uniform float uHealth;',
    'uniform float uAberration;',
    'uniform float uGrain;',
    'uniform float uVignette;',
    'uniform float uAds;',
    'varying vec2 vUv;',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'void main() {',
    '  vec2 uv = vUv;',
    '  vec2 center = uv - 0.5;',
    '  float r2 = dot(center, center);',
    '  vec2 off = center * r2 * uAberration;',
    '  vec3 col;',
    '  col.r = texture2D(tDiffuse, uv + off).r;',
    '  col.g = texture2D(tDiffuse, uv).g;',
    '  col.b = texture2D(tDiffuse, uv - off).b;',
    /* Cool the shadows, keep the amber practical lights warm. */
    '  float lum = dot(col, vec3(0.299, 0.587, 0.114));',
    '  vec3 cool = vec3(0.88, 0.96, 1.04);',
    '  vec3 warm = vec3(1.06, 0.99, 0.90);',
    '  col *= mix(cool, warm, smoothstep(0.28, 0.75, lum));',
    '  col = mix(vec3(lum), col, 1.06 - 0.16 * (1.0 - uHealth));',
    '  float vig = 1.0 - uVignette * smoothstep(0.12, 0.78, r2) * 1.35;',
    '  col *= vig;',
    '  float grain = (hash(uv * vec2(1024.0, 768.0) + fract(uTime) * 91.7) - 0.5) * uGrain;',
    '  col += grain;',
    '  float edge = smoothstep(0.10, 0.62, r2);',
    '  col = mix(col, mix(col, vec3(0.72, 0.10, 0.08), 0.62), uDamage * edge);',
    '  col *= 1.0 - 0.10 * uAds * edge;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function makeTarget(w, h) {
    var t = new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false
    });
    t.texture.encoding = THREE.sRGBEncoding;
    return t;
  }

  function qualitySettings(q) {
    return {
      low: { dpr: 1, shadows: 0, shadowSize: 512, post: true, aberration: 0, grain: .012, reflection: false, rain: 700 },
      medium: { dpr: Math.min(window.devicePixelRatio || 1, 1.5), shadows: 1, shadowSize: 1024, post: true, aberration: .0015, grain: .019, reflection: false, rain: 1500 },
      high: { dpr: Math.min(window.devicePixelRatio || 1, 2), shadows: 1, shadowSize: 2048, post: true, aberration: .0032, grain: .024, reflection: true, rain: 2600 }
    }[q] || null;
  }

  function create(canvas, quality) {
    R.quality = quality || 'medium';
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: R.quality !== 'low', powerPreference: 'high-performance', alpha: false, preserveDrawingBuffer: false });
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    renderer.setClearColor(0x697b86, 1);
    R.renderer = renderer;

    R.scene = new THREE.Scene();
    R.scene.background = new THREE.Color(0x6d7f8a);
    R.scene.fog = new THREE.FogExp2(0x6b7c88, .0068);
    R.camera = new THREE.PerspectiveCamera(82, 1, .06, 620);
    R.camera.rotation.order = 'YXZ';

    R.viewScene = new THREE.Scene();
    R.viewCamera = new THREE.PerspectiveCamera(62, 1, .01, 12);
    R.viewScene.add(new THREE.AmbientLight(0xb8ccd8, 1.25));
    var vmKey = new THREE.DirectionalLight(0xffd7ad, 1.6); vmKey.position.set(-1, 2, 3); R.viewScene.add(vmKey);
    var vmFill = new THREE.DirectionalLight(0x7fa8c0, .7); vmFill.position.set(2, -1, 1); R.viewScene.add(vmFill);

    R.postScene = new THREE.Scene();
    R.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    R.postMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }, uTime: { value: 0 }, uDamage: { value: 0 },
        uHealth: { value: 1 }, uAberration: { value: .0015 }, uGrain: { value: .02 },
        uVignette: { value: .34 }, uAds: { value: 0 }
      },
      vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false, depthWrite: false
    });
    var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), R.postMat);
    quad.frustumCulled = false;
    R.postScene.add(quad);

    applyQuality(R.quality);
    resize();
    return R;
  }

  function applyQuality(q) {
    R.quality = q;
    var s = qualitySettings(q);
    R.dpr = s.dpr;
    R.renderer.setPixelRatio(s.dpr);
    R.renderer.shadowMap.enabled = !!s.shadows;
    R.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    R.enabledPost = s.post;
    R.postMat.uniforms.uAberration.value = s.aberration;
    R.postMat.uniforms.uGrain.value = s.grain;
    R.settings = s;
    if (R.sun) {
      R.sun.castShadow = !!s.shadows;
      if (s.shadows) { R.sun.shadow.mapSize.set(s.shadowSize, s.shadowSize); R.sun.shadow.map && R.sun.shadow.map.dispose(); R.sun.shadow.map = null; }
    }
    if (R.reflector) R.reflector.visible = s.reflection;
    resize();
    return s;
  }

  function resize() {
    var w = Math.max(2, window.innerWidth), h = Math.max(2, window.innerHeight);
    R.width = w; R.height = h;
    R.renderer.setSize(w, h, false);
    R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
    R.viewCamera.aspect = w / h; R.viewCamera.updateProjectionMatrix();
    var pw = Math.floor(w * R.dpr), ph = Math.floor(h * R.dpr);
    if (R.target) R.target.dispose();
    R.target = makeTarget(pw, ph);
    R.postMat.uniforms.tDiffuse.value = R.target.texture;
  }

  function setPost(uniform, value) {
    if (R.postMat) R.postMat.uniforms[uniform].value = value;
  }

  /* Cinematic screens show the world only; the first-person rifle belongs to
     active gameplay. */
  function setViewVisible(v) {
    if (R.viewScene) R.viewScene.visible = !!v;
  }

  function render() {
    var renderer = R.renderer;
    if (R.enabledPost) {
      renderer.setRenderTarget(R.target);
      renderer.autoClear = true;
      renderer.clear(true, true, true);
      renderer.render(R.scene, R.camera);
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(R.viewScene, R.viewCamera);
      renderer.autoClear = true;
      renderer.setRenderTarget(null);
      renderer.render(R.postScene, R.postCamera);
    } else {
      renderer.setRenderTarget(null);
      renderer.autoClear = true;
      renderer.clear(true, true, true);
      renderer.render(R.scene, R.camera);
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(R.viewScene, R.viewCamera);
      renderer.autoClear = true;
    }
  }

  /* ---- Planar water reflection (high quality only) ---- */
  var REFLECT_VERT = [
    'uniform mat4 textureMatrix;',
    'varying vec4 vProjected;',
    'varying vec2 vWorld;',
    'void main() {',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWorld = wp.xz;',
    '  vProjected = textureMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  var REFLECT_FRAG = [
    'precision highp float;',
    'uniform sampler2D tDiffuse;',
    'uniform float uTime;',
    'uniform vec3 uWater;',
    'uniform vec3 uFogColor;',
    'uniform float uFogDensity;',
    'varying vec4 vProjected;',
    'varying vec2 vWorld;',
    'void main() {',
    '  vec2 ripple = vec2(sin(vWorld.y * 0.34 + uTime * 1.3), cos(vWorld.x * 0.29 - uTime * 1.1)) * 0.004;',
    '  vec2 uv = vProjected.xy / max(vProjected.w, 0.0001) + ripple;',
    '  vec3 refl = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb;',
    '  float band = 0.5 + 0.5 * sin(vWorld.y * 0.22 + uTime * 0.8 + sin(vWorld.x * 0.11) * 2.0);',
    '  vec3 col = mix(uWater, refl, 0.62) + vec3(0.035, 0.045, 0.05) * band;',
    '  float d = length(vWorld - cameraPosition.xz);',
    '  float fog = 1.0 - exp(-uFogDensity * uFogDensity * d * d);',
    '  col = mix(col, uFogColor, clamp(fog, 0.0, 0.92));',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function createReflector(width, depth, y, size) {
    var group = new THREE.Group();
    var res = size || 512;
    var rt = makeTarget(res, Math.floor(res * .6));
    var textureMatrix = new THREE.Matrix4();
    var virtualCamera = new THREE.PerspectiveCamera();
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: rt.texture }, textureMatrix: { value: textureMatrix },
        uTime: { value: 0 }, uWater: { value: new THREE.Color(0x243a45) },
        uFogColor: { value: new THREE.Color(0x6b7c88) }, uFogDensity: { value: .0068 }
      },
      vertexShader: REFLECT_VERT, fragmentShader: REFLECT_FRAG,
      fog: false, side: THREE.DoubleSide
    });
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth, 1, 1), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = y;
    plane.frustumCulled = false;
    group.add(plane);

    var reflectorWorld = new THREE.Vector3(), cameraWorld = new THREE.Vector3();
    var rot = new THREE.Matrix4(), normal = new THREE.Vector3(), view = new THREE.Vector3();
    var lookAtPos = new THREE.Vector3(), target = new THREE.Vector3();

    plane.onBeforeRender = function (renderer, scene, camera) {
      if (!R.settings.reflection) return;
      var prevTarget = renderer.getRenderTarget();
      plane.visible = false;
      reflectorWorld.setFromMatrixPosition(plane.matrixWorld);
      cameraWorld.setFromMatrixPosition(camera.matrixWorld);
      rot.extractRotation(plane.matrixWorld);
      normal.set(0, 0, 1).applyMatrix4(rot);
      view.subVectors(reflectorWorld, cameraWorld);
      if (view.dot(normal) > 0) { plane.visible = true; return; }
      view.reflect(normal).negate().add(reflectorWorld);
      rot.extractRotation(camera.matrixWorld);
      lookAtPos.set(0, 0, -1).applyMatrix4(rot).add(cameraWorld);
      target.subVectors(reflectorWorld, lookAtPos);
      target.reflect(normal).negate().add(reflectorWorld);
      virtualCamera.position.copy(view);
      virtualCamera.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
      virtualCamera.lookAt(target);
      virtualCamera.far = camera.far;
      virtualCamera.near = camera.near;
      virtualCamera.updateMatrixWorld();
      virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
      textureMatrix.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1);
      textureMatrix.multiply(virtualCamera.projectionMatrix).multiply(virtualCamera.matrixWorldInverse).multiply(plane.matrixWorld);
      renderer.setRenderTarget(rt);
      renderer.clear(true, true, true);
      renderer.render(scene, virtualCamera);
      renderer.setRenderTarget(prevTarget);
      plane.visible = true;
    };
    group.userData = { plane: plane, material: mat, target: rt, update: function (t) { mat.uniforms.uTime.value = t; } };
    R.reflector = plane;
    plane.visible = R.settings.reflection;
    return group;
  }

  HB.render = {
    create: create, render: render, resize: resize, applyQuality: applyQuality,
    setPost: setPost, setViewVisible: setViewVisible, createReflector: createReflector,
    settings: function () { return R.settings; },
    state: R
  };
})(window.HB = window.HB || {});
