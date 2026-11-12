/* Full mission playthrough QA.
   The bot drives the game through its public input layer only: virtual actions,
   look deltas and DOM button clicks. It never writes game state (no relay
   shortcuts, no direct win calls). Navigation uses A* against the read-only
   world collision query validPosition(). */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const QADIR = '/tmp/harbor-blackout-qa';
const SUB = path.join(QADIR, 'repo', 'harbor-blackout');
const SHOTS = path.join(ROOT, 'screenshots');
const PORT = 8767;
const MAX_MS = 540000;

function serve() {
  fs.mkdirSync(SUB, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(SUB, 'index.html'));
  fs.writeFileSync(path.join(SUB, '.nojekyll'), '');
  const srv = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/') rel = '/index.html';
    const file = path.join(QADIR, 'repo', rel);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  });
  return new Promise(resolve => srv.listen(PORT, '127.0.0.1', () => resolve(srv)));
}

const BOT = function () {
  const H = window.HB;
  const Q = window.__QA = {
    log: [], done: false, failed: false, phase: 0, events: [],
    shots: 0, kills: 0, relays: 0, retries: 0, ticks: 0, stuckResets: 0
  };
  function note(s) { Q.log.push(s); if (Q.log.length > 90) Q.log.shift(); }

  const STEP = 2, X0 = -58, Z0 = -148, NX = 59, NZ = 102;
  function cellX(i) { return X0 + i * STEP; }
  function cellZ(j) { return Z0 + j * STEP; }
  function idx(i, j) { return j * NX + i; }
  function free(i, j) {
    if (i < 0 || j < 0 || i >= NX || j >= NZ) return false;
    const x = cellX(i), z = cellZ(j);
    /* Use the real player radius plus a small margin. A larger radius makes
       the bot's own standing cell look blocked and produces dead-end paths. */
    return H.world.validPosition(x, z, 0.46, 0, 1.72);
  }
  const cache = new Int8Array(NX * NZ);
  function isFree(i, j) {
    if (i < 0 || j < 0 || i >= NX || j >= NZ) return false;
    const k = idx(i, j);
    if (cache[k] === 0) cache[k] = free(i, j) ? 1 : -1;
    return cache[k] === 1;
  }
  function toCell(x, z) {
    return { i: Math.round((x - X0) / STEP), j: Math.round((z - Z0) / STEP) };
  }
  function nearestFree(ci, cj) {
    for (let r = 0; r <= 8; r++) {
      for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        if (isFree(ci + di, cj + dj)) return { i: ci + di, j: cj + dj };
      }
    }
    return null;
  }
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function astar(sx, sz, tx, tz) {
    const a = toCell(sx, sz), b = toCell(tx, tz);
    const start = nearestFree(a.i, a.j), goal = nearestFree(b.i, b.j);
    if (!start || !goal) return null;
    const startK = idx(start.i, start.j), goalK = idx(goal.i, goal.j);
    const g = new Float32Array(NX * NZ).fill(Infinity);
    const parent = new Int32Array(NX * NZ).fill(-1);
    const closed = new Uint8Array(NX * NZ);
    const open = [{ k: startK, f: 0 }];
    g[startK] = 0;
    const h = (i, j) => Math.hypot(i - goal.i, j - goal.j);
    let guard = 0;
    while (open.length && guard++ < 30000) {
      let bi = 0;
      for (let n = 1; n < open.length; n++) if (open[n].f < open[bi].f) bi = n;
      const cur = open.splice(bi, 1)[0];
      if (closed[cur.k]) continue;
      closed[cur.k] = 1;
      if (cur.k === goalK) {
        const out = [];
        let k = goalK;
        while (k >= 0) { out.push({ x: cellX(k % NX), z: cellZ(Math.floor(k / NX)) }); k = parent[k]; }
        out.reverse();
        return out;
      }
      const ci = cur.k % NX, cj = Math.floor(cur.k / NX);
      for (const d of DIRS) {
        const ni = ci + d[0], nj = cj + d[1];
        if (!isFree(ni, nj)) continue;
        if (d[0] && d[1] && (!isFree(ci + d[0], cj) || !isFree(ci, cj + d[1]))) continue;
        const nk = idx(ni, nj);
        if (closed[nk]) continue;
        const ng = g[cur.k] + (d[0] && d[1] ? 1.414 : 1);
        if (ng < g[nk]) {
          g[nk] = ng; parent[nk] = cur.k;
          open.push({ k: nk, f: ng + h(ni, nj) });
        }
      }
    }
    return null;
  }

  function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  function faceYaw(target) {
    const P = H.player.state;
    const f = 0.0021 * H.input.state.sensitivity;
    H.input.lookDelta(-wrap(target - P.yaw) / f, 0);
  }
  function facePoint(x, y, z) {
    const P = H.player.state;
    const eye = P.y + P.eye;
    const dx = x - P.x, dz = z - P.z, dy = y - eye;
    const horiz = Math.hypot(dx, dz);
    const f = 0.0021 * H.input.state.sensitivity;
    const wantYaw = Math.atan2(-dx, -dz);
    const wantPitch = Math.atan2(dy, horiz);
    H.input.lookDelta(-wrap(wantYaw - P.yaw) / f, -(wantPitch - P.pitch) / f);
  }
  /* Local steering: probe nearby headings against the real collision query and
     pick the one that both moves and stays closest to the A* waypoint. This
     gets the player out of narrow pockets between cabinets and pallets. */
  const HEADINGS = [0, .45, -.45, .9, -.9, 1.4, -1.4, 1.9, -1.9, 2.5, -2.5, Math.PI];
  function steerTo(wx, wz) {
    const P = H.player.state;
    const want = Math.atan2(-(wx - P.x), -(wz - P.z));
    let best = null;
    for (const off of HEADINGS) {
      const yaw = want + off;
      const dx = -Math.sin(yaw) * .5, dz = -Math.cos(yaw) * .5;
      const res = H.world.resolveMove(P.x, P.z, dx, dz, .42, P.y, P.height);
      const moved = Math.hypot(res.x - P.x, res.z - P.z);
      const score = moved - Math.abs(off) * .055;
      if (moved > .03 && (!best || score > best.score)) best = { yaw: yaw, score: score };
    }
    return best ? best.yaw : want;
  }
  function setActions(o) {
    const acts = ['FORWARD', 'BACK', 'LEFT', 'RIGHT', 'SPRINT', 'CROUCH', 'AIM', 'FIRE', 'INTERACT'];
    for (const a of acts) H.input.virtual(a, !!o[a]);
  }
  function press(a) { H.input.virtual('PRESS_' + a, true); }

  const targets = [
    { name: 'RELAY_A', type: 'relay', index: 0 },
    { name: 'RELAY_B', type: 'relay', index: 1 },
    { name: 'RELAY_C', type: 'relay', index: 2 },
    { name: 'EXTRACTION', type: 'extract', index: -1 }
  ];
  let path = null, pathGoal = null, lastPos = { x: 0, z: 0 }, stuckFor = 0, replans = 0;
  let combatStart = 0, lastKillCount = 0, ignoreUntil = 0;
  let lastState = '';

  function targetPos(t) {
    if (t.type === 'relay') {
      const r = H.world.data.relays[t.index];
      return { x: r.x, z: r.z, y: 1.2, reach: 2.7 };
    }
    const e = H.world.data.extraction;
    return { x: e.x, z: e.z, y: 1.2, reach: 2.6 };
  }

  function tick() {
    Q.ticks++;
    const G = H.game.state;
    if (G.state !== lastState) { note('STATE ' + G.state); lastState = G.state; }
    if (G.state === 'DEAD') {
      Q.retries++;
      note('DEATH at phase ' + Q.phase + ' - clicking retry');
      const b = document.getElementById('btn-retry');
      if (b) b.click();
      Q.phase = 0; path = null; stuckFor = 0; combatStart = 0; ignoreUntil = 0;
      requestAnimationFrame(tick);
      return;
    }
    /* A failed pointer-lock request can leave the mission paused; resume it
       through the actual UI button rather than writing game state. */
    if (G.state === 'PAUSED') {
      const b = document.getElementById('btn-resume');
      if (b) b.click();
      setActions({});
      requestAnimationFrame(tick);
      return;
    }
    if (G.state === 'VICTORY' || G.state === 'DEBRIEF') {
      setActions({});
      Q.done = true;
      Q.events.push({ at: Date.now(), name: 'WIN', state: G.state });
      note('WIN state=' + G.state);
      return;
    }
    if (G.state !== 'PLAYING') { requestAnimationFrame(tick); return; }

    const P = H.player.state;
    Q.shots = G.stats.shots; Q.kills = G.stats.kills; Q.relays = G.stats.relays;
    const t = targets[Math.min(Q.phase, targets.length - 1)];

    /* Skip phases already completed (e.g. a relay disabled by an earlier hold). */
    if (t.type === 'relay' && H.world.data.relays[t.index].state === 'disabled') {
      Q.phase++;
      note('ADVANCE after relay ' + t.name);
      path = null;
      requestAnimationFrame(tick);
      return;
    }
    if (t.type === 'extract' && !H.world.data.extraction.active) {
      note('WAIT extraction locked, relays=' + Q.relays);
      setActions({});
      requestAnimationFrame(tick);
      return;
    }

    const tp = targetPos(t);
    const dist = Math.hypot(tp.x - P.x, tp.z - P.z);

    /* Fight nearby threats before interacting or when surrounded. */
    const enemies = H.enemies.list().filter(e => e.state !== 'DEAD');
    let threat = null, best = 999;
    for (const e of enemies) {
      const d = Math.hypot(e.x - P.x, e.z - P.z);
      if (d < best) { best = d; threat = e; }
    }
    /* Objective-first behaviour: engage only close threats, and never let a
       covered drone stall the run. If a fight produces no kill after a few
       seconds, disengage and continue navigating. */
    const now = performance.now();
    if (G.stats.kills !== lastKillCount) { lastKillCount = G.stats.kills; combatStart = 0; }
    const fighting = threat && best < 10 && P.health > 25 && now > ignoreUntil && !H.world.lineBlocked(
      H.player.position(),
      { x: threat.x, y: threat.y + (threat.type === 'drone' ? 0 : 0.62), z: threat.z }
    );

    if (fighting) {
      if (!combatStart) combatStart = now;
      if (now - combatStart > 3500) {
        combatStart = 0; ignoreUntil = now + 3200;
        note('DISENGAGE covered threat at ' + best.toFixed(1));
      } else {
        facePoint(threat.x, threat.y + (threat.type === 'drone' ? 0 : 0.62), threat.z);
        const wd = H.weapon.data;
        const acts = { FIRE: true, AIM: true, CROUCH: true };
        if (wd.mag === 0 && !wd.reloading) press('RELOAD');
        setActions(acts);
        if (Q.ticks % 40 === 0) note('COMBAT nearest=' + best.toFixed(1) + ' hp=' + P.health.toFixed(0) + ' mag=' + wd.mag + ' reserve=' + wd.reserve + ' enemies=' + enemies.length);
        requestAnimationFrame(tick);
        return;
      }
    } else combatStart = 0;

    if (dist <= tp.reach) {
      /* Hold-to-disable: face the objective and keep E held. */
      facePoint(tp.x, tp.y, tp.z);
      setActions({ INTERACT: true });
      if (Q.ticks % 25 === 0) note('HOLD ' + t.name + ' d=' + dist.toFixed(1) + ' progress=' + (H.objectives.state.progress || 0).toFixed(2) + ' hp=' + P.health.toFixed(0) + ' ammo=' + H.weapon.data.mag + '/' + H.weapon.data.reserve);
      requestAnimationFrame(tick);
      return;
    }

    /* Navigate with A* waypoints. */
    if (!path || !path.length || !pathGoal || Math.hypot(pathGoal.x - tp.x, pathGoal.z - tp.z) > 1) {
      path = astar(P.x, P.z, tp.x, tp.z);
      pathGoal = { x: tp.x, z: tp.z };
      if (path && path.length > 1) path.shift();
      note('PATH ' + t.name + ' nodes=' + (path ? path.length : 0));
    }
    if (!path || !path.length) {
      note('NO PATH to ' + t.name + ' at ' + P.x.toFixed(1) + ',' + P.z.toFixed(1));
      Q.failed = true; Q.done = true; setActions({}); return;
    }
    let wp = path[0];
    while (path.length > 1 && Math.hypot(wp.x - P.x, wp.z - P.z) < 1.25) { path.shift(); wp = path[0]; }
    if (Math.hypot(wp.x - P.x, wp.z - P.z) < 1.25 && path.length === 1) {
      path = null;
      requestAnimationFrame(tick);
      return;
    }
    faceYaw(steerTo(wp.x, wp.z));
    const wd = H.weapon.data;
    if (wd.mag <= 5 && !wd.reloading && wd.reserve > 0) press('RELOAD');
    setActions({ FORWARD: true, SPRINT: true });

    const moved = Math.hypot(P.x - lastPos.x, P.z - lastPos.z);
    lastPos = { x: P.x, z: P.z };
    if (moved < 0.008) stuckFor++; else stuckFor = 0;
    if (stuckFor > 18) {
      stuckFor = 0; replans++; Q.stuckResets++;
      cache.fill(0);
      path = null;
      note('REPLAN ' + replans + ' at ' + P.x.toFixed(1) + ',' + P.z.toFixed(1));
      if (replans > 80) { Q.failed = true; Q.done = true; setActions({}); note('GAVE UP (stuck)'); return; }
    }
    if (Q.ticks % 45 === 0) note('MOVE ' + t.name + ' pos=' + P.x.toFixed(1) + ',' + P.z.toFixed(1) + ' d=' + dist.toFixed(1) + ' hp=' + P.health.toFixed(0) + ' ammo=' + H.weapon.data.mag + '/' + H.weapon.data.reserve + ' enemies=' + enemies.length);
    requestAnimationFrame(tick);
  }
  note('BOT START');
  requestAnimationFrame(tick);
};

async function waitForState(page, wanted, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await page.evaluate(() => window.HB && window.HB.game && window.HB.game.state.state);
    if (s === wanted) return true;
    if (s === 'ERROR') throw new Error('Game entered ERROR state');
    await page.waitForTimeout(350);
  }
  return false;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage']
  });
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 300)); });
  page.on('pageerror', e => errors.push('[pageerror] ' + (e.stack || e.message).slice(0, 500)));
  await page.goto(`http://127.0.0.1:${PORT}/harbor-blackout/index.html`, { waitUntil: 'load' });
  console.log('WAITING FOR TITLE...');
  if (!await waitForState(page, 'TITLE', 120000)) throw new Error('Title never reached');
  /* Low quality keeps the software renderer fast enough for a long playthrough. */
  await page.evaluate(() => { HB.settings.values.quality = 'low'; HB.settings.apply(); });
  await page.click('#btn-begin');
  await page.keyboard.press('Space');
  if (!await waitForState(page, 'PLAYING', 30000)) throw new Error('Playing state never reached');
  console.log('MISSION STARTED');
  await page.evaluate(BOT);

  let lastLogLen = 0, lastPhase = -1, lastRelays = -1, done = false;
  const started = Date.now();
  const shotNames = [];
  while (Date.now() - started < MAX_MS) {
    await page.waitForTimeout(900);
    const s = await page.evaluate(() => ({
      q: window.__QA ? {
        done: window.__QA.done, failed: window.__QA.failed, phase: window.__QA.phase,
        relays: window.__QA.relays, kills: window.__QA.kills, shots: window.__QA.shots,
        retries: window.__QA.retries, ticks: window.__QA.ticks,
        replans: window.__QA.stuckResets,
        log: window.__QA.log.slice()
      } : null,
      state: window.HB.game.state.state,
      health: +window.HB.player.state.health.toFixed(1),
      pos: [+window.HB.player.state.x.toFixed(1), +window.HB.player.state.z.toFixed(1)],
      relayStates: window.HB.world.data.relays.map(r => r.state),
      extraction: window.HB.world.data.extraction.active,
      stats: window.HB.game.state.stats,
      perf: window.HB.game.perf()
    }));
    if (s.q) {
      for (let i = lastLogLen; i < s.q.log.length; i++) console.log('  ', s.q.log[i]);
      lastLogLen = s.q.log.length;
      if (s.q.relays !== lastRelays) {
        console.log('PROGRESS relays=' + s.q.relays + ' phase=' + s.q.phase + ' pos=' + s.pos + ' hp=' + s.health + ' kills=' + s.q.kills);
        lastRelays = s.q.relays;
      }
      if (s.q.phase !== lastPhase) {
        lastPhase = s.q.phase;
        const name = ['zone-yard', 'zone-shed', 'zone-quay', 'zone-extraction'][Math.min(3, s.q.phase)];
        const f = path.join(SHOTS, 'play-' + name + '.png');
        await page.screenshot({ path: f });
        shotNames.push(name);
      }
      if (s.q.done) {
        done = true;
        console.log('BOT DONE failed=' + s.q.failed + ' state=' + s.state);
        await page.screenshot({ path: path.join(SHOTS, 'play-victory.png') });
        if (s.state === 'VICTORY') {
          await waitForState(page, 'DEBRIEF', 30000);
          await page.screenshot({ path: path.join(SHOTS, 'play-debrief.png') });
        }
        console.log('FINAL', JSON.stringify({ state: await page.evaluate(() => HB.game.state.state), stats: s.stats, perf: s.perf, retries: s.q.retries, shots: s.q.shots, kills: s.q.kills }, null, 2));
        /* RUN MISSION AGAIN must fully reset objectives, extraction, stats and
           vitals, so the mission cannot be left in a permanently stuck state. */
        await page.evaluate(() => document.getElementById('btn-debrief-retry').click());
        const afterRestart = await page.evaluate(() => ({
          state: HB.game.state.state,
          relays: HB.world.data.relays.map(r => r.state),
          extract: HB.world.data.extraction.active,
          stats: HB.game.state.stats,
          health: HB.player.state.health,
          mag: HB.weapon.data.mag,
          reserve: HB.weapon.data.reserve,
          radioVisible: document.getElementById('radio').classList.contains('show'),
          radioText: document.getElementById('radio-text').textContent,
          freshLines: ['', HB.t('R_START'), HB.t('R_BEGIN')]
        }));
        /* A subtitle queued just before victory must never bleed into the new
           mission. Only the two fresh opening lines (or nothing) are allowed. */
        const radioOK = afterRestart.freshLines.indexOf(afterRestart.radioText) >= 0;
        console.log('RADIO RESET', radioOK ? 'PASS' : 'FAIL', JSON.stringify({
          visible: afterRestart.radioVisible, text: afterRestart.radioText
        }));
        const resetOK = afterRestart.state === 'PLAYING' &&
          afterRestart.relays.every(x => x === 'online') && !afterRestart.extract &&
          afterRestart.stats.shots === 0 && afterRestart.stats.relays === 0 &&
          afterRestart.health === 100 && afterRestart.mag === 30 &&
          afterRestart.reserve === 210 && radioOK;
        console.log('RESTART RESET', resetOK ? 'PASS' : 'FAIL', JSON.stringify(afterRestart));
        await page.screenshot({ path: path.join(SHOTS, 'play-restart.png') });
        break;
      }
    }
  }
  if (!done) console.log('TIMEOUT - no completion in ' + MAX_MS + 'ms');
  console.log('ERRORS', JSON.stringify(errors.slice(0, 25), null, 2));
  console.log('SHOTS', JSON.stringify(shotNames));
  await browser.close();
  server.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
