/* HARBOR BLACKOUT - centralized English string catalog.
   Every visible word in the game, including procedural texture lettering,
   radio subtitles, accessibility labels and error states, resolves through HB.t().
   Catalog values are restricted to printable ASCII, so no non-Latin script,
   CJK punctuation, full-width form or missing-glyph substitute can be displayed. */
(function (HB) {
  'use strict';

  var CATALOG = {
    /* Document identity */
    DOC_TITLE: 'HARBOR BLACKOUT',
    DOC_DESCRIPTION: 'HARBOR BLACKOUT - a single-player browser first-person mission at NORTHSTAR HARBOR.',
    A11Y_VIEWPORT: 'HARBOR BLACKOUT first-person game view',

    /* Boot / loading */
    A11Y_BOOT: 'Loading screen',
    BOOT_KICKER: 'NORTHSTAR HARBOR INCIDENT FILE 04',
    TITLE: 'HARBOR BLACKOUT',
    BOOT_STAGE_0: 'INITIALIZING RENDERER',
    BOOT_STAGE_1: 'GENERATING SURFACE MATERIALS',
    BOOT_STAGE_2: 'BUILDING CONTAINER YARD',
    BOOT_STAGE_3: 'BUILDING MAINTENANCE SHED',
    BOOT_STAGE_4: 'BUILDING QUAYSIDE AND EXTRACTION',
    BOOT_STAGE_5: 'CALIBRATING DEFENSE NETWORK',
    BOOT_STAGE_6: 'MISSION READY',
    BOOT_NOTE: 'All assets are generated locally. No network connection is required.',

    /* Title */
    A11Y_TITLE: 'Title screen',
    TITLE_KICKER: 'A SINGLE-PLAYER FIRST-PERSON MISSION',
    TITLE_A: 'HARBOR',
    TITLE_B: 'BLACKOUT',
    TITLE_TAGLINE: 'NORTHSTAR HARBOR / 05:42 / DAWN',
    TITLE_BRIEF: 'The automated defense grid has locked down the port. Disable three relays, survive the machines, and reach the extraction boat before the harbor wakes up.',
    BTN_BEGIN: 'BEGIN MISSION',
    BTN_SETTINGS: 'SETTINGS',
    BTN_CONTROLS: 'CONTROLS',
    TITLE_FOOT_A: 'BUILD',
    TITLE_FOOT_B: 'HARBOR BLACKOUT V1.0',
    TITLE_FOOT_C: '/ LOCAL WEBGL BUILD',

    /* Control legend rows: key label and action label */
    LEG_MOVE: 'W A S D', LEG_MOVE_ACT: 'MOVE',
    LEG_LOOK: 'MOUSE', LEG_LOOK_ACT: 'LOOK',
    LEG_FIRE: 'LEFT CLICK', LEG_FIRE_ACT: 'FIRE',
    LEG_ADS: 'RIGHT CLICK', LEG_ADS_ACT: 'AIM',
    LEG_RELOAD: 'R', LEG_RELOAD_ACT: 'RELOAD',
    LEG_INTERACT: 'E', LEG_INTERACT_ACT: 'INTERACT',
    LEG_SPRINT: 'SHIFT', LEG_SPRINT_ACT: 'SPRINT',
    LEG_CROUCH: 'C / CTRL', LEG_CROUCH_ACT: 'CROUCH',
    LEG_JUMP: 'SPACE', LEG_JUMP_ACT: 'JUMP',
    LEG_PAUSE: 'ESC', LEG_PAUSE_ACT: 'PAUSE',

    /* Intro cinematic */
    A11Y_INTRO: 'Mission introduction',
    INTRO_KICKER: 'NORTHSTAR HARBOR / RESTRICTED WATERS',
    INTRO_LOCATION: 'NORTHSTAR HARBOR',
    INTRO_TIME: '05:42 LOCAL / HEAVY RAIN / LOW VISIBILITY',
    BTN_SKIP: 'SKIP',
    RADIO_CMD: 'COMMAND',
    RADIO_OPS: 'OPERATIONS',
    RADIO_TECH: 'TECHNICIAN',
    RADIO_PILOT: 'EXTRACTION PILOT',
    R_INTRO_1: 'Field unit, the port authority lost contact with the defense grid at 04:10.',
    R_INTRO_2: 'Automated sentries are holding the yard. We cannot move cargo until the network is dark.',
    R_INTRO_3: 'Take out relay stations A, B and C. Hold your position at each panel until the link drops.',
    R_INTRO_4: 'The boat waits at Berth 04. It leaves when all three relays are offline. Move.',
    R_START: 'Command out. Watch the drones. They hunt by sight and sound.',

    /* HUD */
    A11Y_HUD: 'Heads-up display',
    HUD_VITALS: 'VITALS',
    HUD_AMMO: 'AMMUNITION',
    WEAPON_NAME: 'AR-9 SERVICE RIFLE',
    RELOAD_HINT: 'PRESS R TO RELOAD',
    RELOADING: 'RELOADING',
    EMPTY: 'MAGAZINE EMPTY',
    NO_RESERVE: 'NO RESERVE AMMUNITION',
    LOW_AMMO: 'LOW AMMUNITION',
    OBJ_PHASE: 'CURRENT OBJECTIVE',
    OBJ_RELAYS: 'DISABLE DEFENSE RELAYS',
    OBJ_EXTRACT: 'REACH THE EXTRACTION BOAT',
    OBJ_DONE: 'ALL RELAYS OFFLINE',
    OBJ_DETAIL_A: 'RELAY A / CONTAINER YARD',
    OBJ_DETAIL_B: 'RELAY B / MAINTENANCE SHED',
    OBJ_DETAIL_C: 'RELAY C / QUAYSIDE',
    OBJ_DETAIL_EXTRACT: 'BERTH 04 / EXTRACTION BOAT',
    OBJ_DETAIL_DONE: 'PROCEED TO THE GANGWAY',
    OBJ_COUNT: 'RELAYS OFFLINE: {0} OF 3',
    OBJ_DETAIL_GENERIC: 'DISABLE THE REMAINING RELAYS',
    COMPASS_N: 'N', COMPASS_NE: 'NE', COMPASS_E: 'E', COMPASS_SE: 'SE',
    COMPASS_S: 'S', COMPASS_SW: 'SW', COMPASS_W: 'W', COMPASS_NW: 'NW',
    WAVE_TITLE: 'THREAT WARNING',
    WAVE_1: 'REINFORCEMENTS / WAVE 01',
    WAVE_2: 'REINFORCEMENTS / WAVE 02',
    WAVE_3: 'REINFORCEMENTS / WAVE 03',
    WAVE_FINAL: 'FINAL SECURITY SWEEP',

    /* Markers and interaction */
    MARKER_RELAY_A: 'RELAY A',
    MARKER_RELAY_B: 'RELAY B',
    MARKER_RELAY_C: 'RELAY C',
    MARKER_BOAT: 'EXTRACTION',
    MARKER_UNIT: 'M',
    INT_RELAY_A: 'DISABLE RELAY A',
    INT_RELAY_B: 'DISABLE RELAY B',
    INT_RELAY_C: 'DISABLE RELAY C',
    INT_BOARD: 'BOARD EXTRACTION BOAT',
    INT_HOLD: 'HOLD E',
    INT_HINT: 'RELEASE OR MOVE AWAY TO ABORT',
    INT_LOCKED: 'EXTRACTION LOCKED - DISABLE ALL RELAYS',
    INT_ABORTED: 'LINK INTERRUPTED',
    INT_AMMO: 'TAKE AMMUNITION',
    INT_AMMO_HOLD: 'HOLD E',
    INT_DISABLED: 'RELAY OFFLINE',

    /* Combat feedback */
    ENEMY_DRONE: 'DEFENSE DRONE',
    ENEMY_HOUND: 'SECURITY HOUND',
    KILL_FEED: '{0} NEUTRALIZED',
    TOAST_HIT: 'TARGET HIT',
    TOAST_RELAY_DONE: 'RELAY {0} OFFLINE',
    TOAST_AMMO: 'AMMUNITION RESUPPLIED',
    TOAST_WAVE: 'REINFORCEMENTS INBOUND',
    TOAST_WATER: 'PULLED FROM THE WATER',
    TOAST_EXTRACT_OPEN: 'EXTRACTION CLEARED',
    TOAST_LINK_LOST: 'LINK LOST - HOLD AGAIN',
    TOAST_NO_AMMO: 'OUT OF AMMUNITION',
    TOAST_SAVED: 'SETTINGS STORED',

    /* Radio lines during play */
    R_BEGIN: 'Field unit, you are inside the perimeter. Relay A is in the container yard.',
    /* The speaker is rendered separately above each line, so the line itself
       carries the message only. */
    R_WAVE_1: 'The grid just reassigned sentries to your position. Stay sharp.',
    R_WAVE_2: 'Two more contacts inbound. Use the containers for cover.',
    R_WAVE_3: 'The network is failing over to local control. Expect a final push.',
    R_RELAY_1: 'Relay A is dark. Two stations left.',
    R_RELAY_2: 'Relay B is dark. Quayside station is the last one.',
    R_RELAY_3: 'All relays are offline. Get to Berth 04 now.',
    R_ALL_DONE: 'Engines are running. I will hold for two minutes, no longer.',
    R_HURT: 'Your vitals are dropping. Break contact and recover.',
    R_LOW_AMMO: 'Check your reserve. Ammunition caches sit beside each relay.',
    R_WATER: 'You went over the edge. We dragged you back. Watch your footing.',
    R_DEATH: 'Field unit, respond. We lost your signal.',
    R_VICTORY: 'All aboard. Casting off now.',
    R_EXTRACT_LOCKED: 'I cannot leave until every relay is dark.',
    R_HINT_SHED: 'Relay B is inside the maintenance shed. The bay door is open.',

    /* Pause / settings / controls */
    A11Y_PAUSE: 'Paused game menu',
    PAUSE_KICKER: 'MISSION SUSPENDED',
    PAUSE_TITLE: 'PAUSED',
    PAUSE_SUB: 'The harbor is holding its breath.',
    BTN_RESUME: 'RESUME MISSION',
    BTN_RESTART: 'RESTART MISSION',
    BTN_QUIT_TITLE: 'QUIT TO TITLE',
    A11Y_SETTINGS: 'Settings panel',
    SETTINGS_KICKER: 'SYSTEM CONFIGURATION',
    SETTINGS_TITLE: 'SETTINGS',
    SET_VOLUME: 'MASTER VOLUME',
    SET_MUTE: 'MUTE ALL AUDIO',
    SET_SENSITIVITY: 'MOUSE SENSITIVITY',
    SET_INVERT_Y: 'INVERT VERTICAL LOOK',
    SET_FOV: 'FIELD OF VIEW',
    SET_QUALITY: 'GRAPHICS QUALITY',
    SET_SHAKE: 'REDUCED CAMERA SHAKE',
    SET_SUBTITLES: 'RADIO SUBTITLES',
    QUALITY_LOW: 'LOW',
    QUALITY_MEDIUM: 'MEDIUM',
    QUALITY_HIGH: 'HIGH',
    SETTINGS_NOTE: 'Changes apply immediately and are stored locally in this browser.',
    BTN_BACK: 'BACK',
    BTN_RESET_DEFAULTS: 'RESET DEFAULTS',
    OUT_ON: 'ON',
    OUT_OFF: 'OFF',
    A11Y_CONTROLS_PANEL: 'Controls guide',
    CONTROLS_KICKER: 'FIELD MANUAL',
    CONTROLS_TITLE: 'CONTROLS',
    CONTROLS_NOTE: 'On touch screens, use the left stick to move, drag the right side to look, and tap the action buttons. Pointer lock starts only after you press BEGIN MISSION. Press ESC or click outside the window to pause.',
    LOOK_HINT: 'POINTER LOCK UNAVAILABLE - MOVE MOUSE OR ARROW KEYS TO LOOK',
    CLICK_TO_RESUME: 'CLICK TO RESUME',

    /* Touch */
    A11Y_TOUCH: 'Touch controls',
    A11Y_LOOK_ZONE: 'Drag here to look around',
    TOUCH_FIRE: 'FIRE',
    A11Y_FIRE: 'Fire weapon',
    TOUCH_ADS: 'AIM',
    A11Y_ADS: 'Aim down sights',
    TOUCH_RELOAD: 'RELOAD',
    A11Y_RELOAD: 'Reload weapon',
    TOUCH_JUMP: 'JUMP',
    A11Y_JUMP: 'Jump',
    TOUCH_CROUCH: 'CROUCH',
    A11Y_CROUCH: 'Crouch',
    TOUCH_INTERACT: 'USE',
    A11Y_INTERACT: 'Interact with objective',
    TOUCH_SPRINT: 'SPRINT',
    A11Y_SPRINT: 'Sprint',

    /* Death / victory / debrief */
    A11Y_DEATH: 'Mission failed screen',
    DEATH_KICKER: 'SIGNAL LOST',
    DEATH_TITLE: 'MISSION FAILED',
    DEATH_CAUSE_COMBAT: 'Hostile fire overwhelmed your position at NORTHSTAR HARBOR.',
    DEATH_CAUSE_WATER: 'You went into the water and the current pulled you under.',
    DEATH_CAUSE_GENERIC: 'The mission ended before extraction was possible.',
    BTN_RETRY: 'RETRY MISSION',
    A11Y_VICTORY: 'Extraction confirmed screen',
    VICTORY_KICKER: 'BERTH 04 / 06:00 LOCAL',
    VICTORY_TITLE: 'EXTRACTION CONFIRMED',
    VICTORY_SUB: 'THE HARBOR GOES DARK BEHIND YOU',
    A11Y_DEBRIEF: 'Mission debrief',
    DEBRIEF_KICKER: 'AFTER ACTION REPORT',
    DEBRIEF_TITLE: 'MISSION DEBRIEF',
    DEBRIEF_SUB: 'NORTHSTAR HARBOR DEFENSE GRID / STATUS: OFFLINE',
    STAT_TIME: 'COMPLETION TIME',
    STAT_ACCURACY: 'ACCURACY',
    STAT_KILLS: 'ENEMIES DESTROYED',
    STAT_SHOTS: 'SHOTS FIRED',
    STAT_RETRIES: 'RETRY COUNT',
    STAT_RELAYS: 'RELAYS DISABLED',
    STAT_RATING: 'FIELD RATING',
    RATING_S: 'CLEAN SWEEP',
    RATING_A: 'PROFESSIONAL',
    RATING_B: 'EFFECTIVE',
    RATING_C: 'SURVIVED',
    BTN_REPLAY: 'RUN MISSION AGAIN',

    /* Errors */
    A11Y_ERROR: 'Error screen',
    ERROR_KICKER: 'SYSTEM FAULT',
    ERROR_TITLE: 'UNABLE TO START',
    ERROR_NOTE: 'Enable hardware acceleration and reload this page in a current desktop browser.',
    ERROR_DETAIL_WEBGL: 'WebGL is unavailable in this browser context.',
    ERROR_DETAIL_CONTEXT: 'The graphics context could not be created.',
    ERROR_DETAIL_RUNTIME: 'A runtime fault stopped the mission. Reload to try again.',

    /* In-world signage, decals and equipment plates */
    LBL_HARBOR: 'NORTHSTAR HARBOR',
    LBL_NORTHSTAR_FREIGHT: 'NORTHSTAR FREIGHT',
    LBL_ATLANTIC_CARGO: 'ATLANTIC CARGO',
    LBL_PACIFIC_LOGISTICS: 'PACIFIC LOGISTICS',
    LBL_AUTHORIZED: 'AUTHORIZED PERSONNEL ONLY',
    LBL_KEEP_CLEAR: 'KEEP CLEAR',
    LBL_HIGH_VOLTAGE: 'HIGH VOLTAGE',
    LBL_MAX_LOAD: 'MAX LOAD 2500 KG',
    LBL_BERTH_04: 'BERTH 04',
    LBL_CONTAINER_YARD: 'CONTAINER YARD',
    LBL_MAINTENANCE_SHED: 'MAINTENANCE SHED',
    LBL_QUAYSIDE: 'QUAYSIDE',
    LBL_RELAY_A: 'RELAY A',
    LBL_RELAY_B: 'RELAY B',
    LBL_RELAY_C: 'RELAY C',
    LBL_EXTRACTION_BOAT: 'EXTRACTION BOAT',
    LBL_AR9: 'AR-9 SERVICE RIFLE',
    LBL_SERIAL: 'NS-AR9-00417',
    LBL_INSPECTION: 'INSPECTION 08/26',
    LBL_DANGER: 'DANGER',
    LBL_NO_ENTRY: 'NO ENTRY',
    LBL_SECURE_AREA: 'SECURE AREA',
    LBL_MANIFEST: 'CARGO MANIFEST',
    LBL_POWER: 'POWER DISTRIBUTION',
    LBL_FIRE_HOSE: 'FIRE HOSE',
    LBL_CRANE_07: 'CRANE 07',
    LBL_GATE_03: 'GATE 03',
    LBL_SECURITY: 'NORTHSTAR SECURITY',
    LBL_GRID: 'AUTOMATED DEFENSE NETWORK',
    LBL_PROPERTY: 'PROPERTY OF NORTHSTAR FREIGHT',
    LBL_GRAFFITI_1: 'NIGHT SHIFT',
    LBL_GRAFFITI_2: 'KEEP OUT',
    LBL_GRAFFITI_3: 'NO SIGNAL',
    LBL_STATUS_ONLINE: 'STATUS: ONLINE',
    LBL_STATUS_DISABLED: 'STATUS: DISABLED',
    LBL_TERMINAL_1: 'DEFENSE GRID / ACTIVE',
    LBL_TERMINAL_2: 'BERTH OPERATIONS',
    LBL_TERMINAL_3: 'POWER BUS 04',
    LBL_MOORING: 'MOORING 04',
    LBL_DECK_02: 'DECK 02',
    LBL_EMERGENCY: 'EMERGENCY STATION',
    LBL_LIFE_RING: 'LIFE RING',
    LBL_HEIGHT: 'MAX HEIGHT 4.2 M',
    LBL_FUEL: 'DIESEL / NO SMOKING',
    LBL_BOAT_NAME: 'MERIDIAN 04',
    LBL_CARGO_1: 'NSFU 481203 7',
    LBL_CARGO_2: 'ATLC 770415 2',
    LBL_CARGO_3: 'PCFL 229018 5',
    LBL_CONTAINER_ID_A: 'NSFU 009812 4',
    LBL_CONTAINER_ID_B: 'ATLC 331870 1',
    LBL_CONTAINER_ID_C: 'PCFL 664502 8',
    LBL_FLOOR_MARK: 'KEEP CLEAR',
    LBL_SWITCH: 'MAIN ISOLATOR',
    LBL_RELAY_PANEL: 'DEFENSE RELAY / HOLD TO ISOLATE',
    LBL_CAUTION: 'CAUTION / WET DECK',
    LBL_ARROW_NOTE: 'BERTH 04',
    LBL_NETWORK: 'GRID LINK 04',
    LBL_HAZARD: 'AUTOMATED SENTRY ZONE',
    LBL_CRATE: 'FRAGILE / THIS SIDE UP',
    LBL_BARREL: 'INDUSTRIAL LUBRICANT',
    LBL_VALVE: 'VALVE 12',
    LBL_LOCKER: 'TOOL LOCKER',
    LBL_GENERATOR: 'GENERATOR 02',
    LBL_SCREEN_A_ON: 'RELAY A|STATUS: ONLINE',
    LBL_SCREEN_A_OFF: 'RELAY A|STATUS: DISABLED',
    LBL_SCREEN_B_ON: 'RELAY B|STATUS: ONLINE',
    LBL_SCREEN_B_OFF: 'RELAY B|STATUS: DISABLED',
    LBL_SCREEN_C_ON: 'RELAY C|STATUS: ONLINE',
    LBL_SCREEN_C_OFF: 'RELAY C|STATUS: DISABLED',
    LBL_SCREEN_BOAT: 'EXTRACTION BOAT|BERTH 04',
    LBL_SCREEN_GATE: 'GATE 03|RESTRICTED',
    LBL_SCREEN_SHED: 'MAINTENANCE|BAY 02',
    LBL_DOOR_NOTE: 'AUTHORIZED PERSONNEL ONLY',
    LBL_TOOL_BOARD: 'TOOL BOARD / BAY 02'
  };

  var FORBIDDEN = [
    { name: 'Han', re: /\p{Script=Han}/u },
    { name: 'Hiragana', re: /\p{Script=Hiragana}/u },
    { name: 'Katakana', re: /\p{Script=Katakana}/u },
    { name: 'Hangul', re: /\p{Script=Hangul}/u },
    { name: 'Cyrillic', re: /\p{Script=Cyrillic}/u },
    { name: 'Greek', re: /\p{Script=Greek}/u },
    { name: 'Arabic', re: /\p{Script=Arabic}/u },
    { name: 'Hebrew', re: /\p{Script=Hebrew}/u },
    { name: 'Thai', re: /\p{Script=Thai}/u },
    { name: 'Devanagari', re: /\p{Script=Devanagari}/u },
    { name: 'CJK symbols and punctuation', re: /[\u2E80-\u2FFF\u3000-\u303F\u31C0-\u31EF\u3200-\u32FF\uFE30-\uFE4F]/u },
    { name: 'CJK compatibility and full-width forms', re: /[\u3300-\u33FF\uF900-\uFAFF\uFF00-\uFFEF]/u },
    { name: 'CJK extension planes', re: /[\u{20000}-\u{2FA1F}]/u },
    { name: 'non-ASCII character', re: /[^\x09\x0A\x0D\x20-\x7E]/ }
  ];

  var registry = [];
  var violations = [];
  var checked = Object.create(null);

  function describe(value) {
    var out = [];
    for (var i = 0; i < value.length; i++) {
      var ch = value.charAt(i);
      if (/[^\x09\x0A\x0D\x20-\x7E]/.test(ch)) {
        out.push('U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
      }
    }
    return out.slice(0, 8).join(' ');
  }

  function validate(value, source) {
    var s = String(value);
    for (var i = 0; i < FORBIDDEN.length; i++) {
      if (FORBIDDEN[i].re.test(s)) {
        var msg = 'Rejected ' + FORBIDDEN[i].name + ' in ' + source + ' (' + describe(s) + ')';
        if (violations.indexOf(msg) === -1) violations.push(msg);
        if (window.console) console.error('[HARBOR BLACKOUT] ' + msg);
        return false;
      }
    }
    return true;
  }

  function assertEnglish(value, source) {
    if (!validate(value, source || 'runtime string')) {
      throw new Error('HARBOR BLACKOUT: non-English text rejected: ' + String(value).slice(0, 40));
    }
    return String(value);
  }

  function t(key) {
    var value = Object.prototype.hasOwnProperty.call(CATALOG, key) ? CATALOG[key] : null;
    if (value === null) {
      var msg = 'Missing catalog key: ' + key;
      if (violations.indexOf(msg) === -1) violations.push(msg);
      if (window.console) console.error('[HARBOR BLACKOUT] ' + msg);
      return key;
    }
    if (!checked[key]) { validate(value, 'catalog:' + key); checked[key] = true; }
    var out = value;
    for (var i = 1; i < arguments.length; i++) {
      out = out.split('{' + (i - 1) + '}').join(String(arguments[i]));
    }
    validate(out, 'rendered:' + key);
    return out;
  }

  /* All Canvas / SVG / DOM wording is recorded here for runtime auditing. */
  function register(kind, value) {
    assertEnglish(value, kind);
    registry.push({ kind: kind, value: String(value) });
    return String(value);
  }

  function auditCatalog() {
    Object.keys(CATALOG).forEach(function (k) { validate(CATALOG[k], 'catalog:' + k); });
  }

  function auditDOM() {
    var root = document.documentElement;
    if (root.getAttribute('lang') !== 'en') violations.push('Document language is not en');
    validate(document.title, 'document.title');
    var meta = document.querySelector('meta[name="description"]');
    if (meta) validate(meta.getAttribute('content'), 'meta description');
    var nodes = document.querySelectorAll('#overlay *, #viewport');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var attrs = ['aria-label', 'title', 'placeholder', 'alt', 'value'];
      for (var a = 0; a < attrs.length; a++) {
        var v = el.getAttribute(attrs[a]);
        if (v !== null && v !== '') validate(v, 'attribute ' + attrs[a] + ' on ' + (el.id || el.tagName));
      }
      if (el.children.length === 0 && el.textContent && el.textContent.trim()) {
        validate(el.textContent, 'text node in ' + (el.id || el.tagName));
      }
    }
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.trim()) validate(node.nodeValue, 'text node');
    }
    return violations.slice();
  }

  function installObserver() {
    if (typeof MutationObserver === 'undefined') return;
    var observer = new MutationObserver(function (records) {
      for (var r = 0; r < records.length; r++) {
        var rec = records[r];
        if (rec.type === 'characterData') {
          validate(rec.target.nodeValue || '', 'dynamic text node');
        } else if (rec.type === 'attributes') {
          validate(rec.target.getAttribute(rec.attributeName) || '', 'dynamic attribute ' + rec.attributeName);
        } else if (rec.addedNodes) {
          for (var n = 0; n < rec.addedNodes.length; n++) {
            var added = rec.addedNodes[n];
            if (added.nodeType === 3) validate(added.nodeValue || '', 'added text node');
            else if (added.nodeType === 1) {
              validate(added.textContent || '', 'added element text');
              var at = added.getAttribute && added.getAttribute('aria-label');
              if (at) validate(at, 'added aria-label');
            }
          }
        }
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder', 'alt', 'value'] });
  }

  function audit() {
    auditCatalog();
    registry.forEach(function (e) { validate(e.value, e.kind); });
    auditDOM();
    return { violations: violations.slice(), catalogSize: Object.keys(CATALOG).length, registeredStrings: registry.length };
  }

  HB.t = t;
  HB.strings = {
    CATALOG: CATALOG,
    t: t,
    register: register,
    assertEnglish: assertEnglish,
    validate: validate,
    audit: audit,
    auditDOM: auditDOM,
    installObserver: installObserver,
    violations: violations,
    registry: registry
  };
})(window.HB = window.HB || {});
