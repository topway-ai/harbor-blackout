/* HARBOR BLACKOUT - keyboard, mouse, pointer lock, fallback look and touch input.
   Pointer lock is requested only inside a user gesture. If it is unavailable,
   mouse movement over the canvas and the arrow keys still control the view. */
(function (HB) {
  'use strict';

  var I = {
    keys: Object.create(null),
    edges: Object.create(null),
    virtual: Object.create(null),
    mouse: { left: false, right: false },
    lookX: 0, lookY: 0,
    pointerLocked: false,
    fallback: false,
    enabled: false,
    sensitivity: 1,
    invertY: false,
    touch: { moveX: 0, moveY: 0, fire: false, aim: false, sprint: false, crouch: false, interact: false, jump: false, reload: false },
    onLockLost: null,
    onBlur: null,
    onPause: null,
    onEscape: null,
    lastX: 0, lastY: 0,
    hasMouse: false
  };
  var canvas = null;

  var CODE_ACTION = {
    KeyW: 'FORWARD', ArrowUp: 'FORWARD',
    KeyS: 'BACK', ArrowDown: 'BACK',
    KeyA: 'LEFT', KeyD: 'RIGHT',
    ShiftLeft: 'SPRINT', ShiftRight: 'SPRINT',
    ControlLeft: 'CROUCH', ControlRight: 'CROUCH', KeyC: 'CROUCH',
    Space: 'JUMP', KeyR: 'RELOAD', KeyE: 'INTERACT'
  };

  function keyDown(e) {
    var code = e.code;
    if (code === 'Escape') { if (I.onEscape) I.onEscape(); return; }
    if (!I.enabled) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].indexOf(code) >= 0) e.preventDefault();
    if (!I.keys[code]) I.edges[code] = true;
    I.keys[code] = true;
  }
  function keyUp(e) { I.keys[e.code] = false; }

  function addLook(dx, dy) {
    I.lookX += dx; I.lookY += dy;
  }

  function mouseMove(e) {
    var dx = e.movementX || 0, dy = e.movementY || 0;
    if (I.pointerLocked) {
      addLook(dx, dy);
    } else if (I.fallback && I.enabled && I.hasMouse) {
      /* Unlocked fallback: relative movement still steers the camera. */
      addLook(dx * .9, dy * .9);
      I.lastX = e.clientX; I.lastY = e.clientY;
    }
  }

  function mouseDown(e) {
    if (!I.enabled) return;
    if (e.button === 0) I.mouse.left = true;
    if (e.button === 2) { I.mouse.right = true; e.preventDefault(); }
  }
  function mouseUp(e) {
    if (e.button === 0) I.mouse.left = false;
    if (e.button === 2) I.mouse.right = false;
  }

  function lockChange() {
    var wasLocked = I.pointerLocked;
    I.pointerLocked = (document.pointerLockElement === canvas);
    if (I.pointerLocked && !I.enabled) {
      /* A pending request can resolve after the state already left gameplay
         (for example when the intro starts immediately). Release it so menu
         and cinematic buttons stay clickable. */
      releaseLock();
      I.pointerLocked = false;
      return;
    }
    /* Only a genuine loss of an acquired lock pauses the mission. A failed
       request (no user gesture, unsupported browser) should leave the game in
       its mouse-look fallback instead of bouncing straight into pause. */
    if (!I.pointerLocked && wasLocked && I.enabled && I.onLockLost) I.onLockLost();
    if (!I.pointerLocked && wasLocked) I.fallback = true;
  }

  function clearAll() {
    I.keys = Object.create(null);
    I.edges = Object.create(null);
    I.mouse.left = I.mouse.right = false;
    I.touch.fire = I.touch.aim = I.touch.interact = false;
    I.touch.moveX = I.touch.moveY = 0;
    I.lookX = I.lookY = 0;
    for (var k in I.virtual) I.virtual[k] = false;
  }

  function bind(target, options) {
    canvas = target;
    var o = options || {};
    I.onLockLost = o.onLockLost || null;
    I.onBlur = o.onBlur || null;
    I.onPause = o.onPause || null;
    I.onEscape = o.onEscape || null;
    window.addEventListener('keydown', keyDown, { passive: false });
    window.addEventListener('keyup', keyUp);
    window.addEventListener('mousemove', mouseMove);
    window.addEventListener('mousedown', mouseDown);
    window.addEventListener('mouseup', mouseUp);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('pointerlockchange', lockChange);
    document.addEventListener('pointerlockerror', function () { I.fallback = true; });
    window.addEventListener('blur', function () { clearAll(); if (I.onBlur) I.onBlur(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { clearAll(); if (I.onBlur) I.onBlur(); }
    });
    window.addEventListener('mousemove', function () { I.hasMouse = true; }, { once: true });
  }

  function requestLock() {
    if (!canvas) return false;
    if (!canvas.requestPointerLock) { I.fallback = true; return false; }
    try {
      var p = canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(function () { I.fallback = true; });
      return true;
    } catch (e) { I.fallback = true; return false; }
  }

  function releaseLock() {
    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (e) { /* ignore */ }
    }
  }

  function virtual(action, on) { I.virtual[action] = !!on; }

  function actionDown(action) {
    if (I.virtual[action]) return true;
    switch (action) {
      case 'FIRE': return I.mouse.left || I.touch.fire;
      case 'AIM': return I.mouse.right || I.touch.aim;
      case 'SPRINT': return !!I.keys.ShiftLeft || !!I.keys.ShiftRight || I.touch.sprint;
      case 'CROUCH': return !!I.keys.KeyC || !!I.keys.ControlLeft || !!I.keys.ControlRight || I.touch.crouch;
      case 'INTERACT': return !!I.keys.KeyE || I.touch.interact;
      case 'FORWARD': return !!I.keys.KeyW || !!I.keys.ArrowUp;
      case 'BACK': return !!I.keys.KeyS || !!I.keys.ArrowDown;
      case 'LEFT': return !!I.keys.KeyA;
      case 'RIGHT': return !!I.keys.KeyD;
      default: return false;
    }
  }

  function actionPressed(action) {
    var codes = {
      JUMP: ['Space'], RELOAD: ['KeyR'], INTERACT: ['KeyE']
    }[action] || [];
    var hit = false;
    for (var i = 0; i < codes.length; i++) {
      if (I.edges[codes[i]]) { I.edges[codes[i]] = false; hit = true; }
    }
    if (I.virtual['PRESS_' + action]) { I.virtual['PRESS_' + action] = false; hit = true; }
    /* Touch buttons are level-triggered; latch them into an edge here. */
    if (action === 'JUMP' || action === 'RELOAD') {
      var field = action === 'JUMP' ? 'jump' : 'reload';
      var latch = action === 'JUMP' ? '_jumpLatched' : '_reloadLatched';
      if (I.touch[field] && !I[latch]) { I[latch] = true; hit = true; }
      if (!I.touch[field]) I[latch] = false;
    }
    return hit;
  }

  function moveVector() {
    var x = (actionDown('RIGHT') ? 1 : 0) - (actionDown('LEFT') ? 1 : 0) + I.touch.moveX;
    var y = (actionDown('FORWARD') ? 1 : 0) - (actionDown('BACK') ? 1 : 0) - I.touch.moveY;
    var len = Math.sqrt(x * x + y * y);
    if (len > 1) { x /= len; y /= len; }
    return { x: x, y: y };
  }

  function consumeLook() {
    var f = .0021 * I.sensitivity;
    var dx = I.lookX * f;
    var dy = I.lookY * f * (I.invertY ? -1 : 1);
    /* Arrow keys provide a keyboard-only fallback for looking. */
    if (I.enabled) {
      if (I.keys.ArrowLeft) dx -= .026;
      if (I.keys.ArrowRight) dx += .026;
    }
    I.lookX = 0; I.lookY = 0;
    return { dx: dx, dy: dy };
  }

  function lookDelta(dx, dy) { addLook(dx, dy); }

  HB.input = {
    state: I,
    bind: bind,
    requestLock: requestLock,
    releaseLock: releaseLock,
    setEnabled: function (v) { I.enabled = !!v; if (!v) { clearAll(); releaseLock(); } },
    setSensitivity: function (v) { I.sensitivity = v; },
    setInvertY: function (v) { I.invertY = !!v; },
    setFallback: function (v) { I.fallback = !!v; },
    virtual: virtual,
    actionDown: actionDown,
    actionPressed: actionPressed,
    moveVector: moveVector,
    consumeLook: consumeLook,
    lookDelta: lookDelta,
    clear: clearAll,
    isLocked: function () { return I.pointerLocked; }
  };
})(window.HB = window.HB || {});
