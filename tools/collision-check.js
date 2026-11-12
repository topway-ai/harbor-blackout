/* Read-only geometry probe around the maintenance shed relays.
   Reports whether the playthrough bot was standing inside a solid collider
   and whether any movement direction can escape it. */
'use strict';
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..');
const SUB = '/tmp/harbor-blackout-qa/repo/harbor-blackout';
const PORT = 8771;
(async () => {
  fs.mkdirSync(SUB, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(SUB, 'index.html'));
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    fs.readFile(path.join('/tmp/harbor-blackout-qa/repo', rel), (e, d) => {
      if (e) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(d);
    });
  });
  await new Promise(r => srv.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.goto(`http://127.0.0.1:${PORT}/harbor-blackout/index.html`, { waitUntil: 'load' });
  for (let i = 0; i < 120; i++) { if (await page.evaluate(() => HB.game.state.state === 'TITLE')) break; await page.waitForTimeout(400); }
  const out = await page.evaluate(() => {
    const W = HB.world.data, r = 0.42, feetY = 0, height = 1.72;
    const P = { x: -8.0, z: -62.1 };
    const hits = W.colliders.filter(c => {
      if (!c.solid) return false;
      if (!(feetY < c.maxY - .12 && feetY + height > c.minY + .05)) return false;
      const cx = Math.min(Math.max(P.x, c.minX), c.maxX);
      const cz = Math.min(Math.max(P.z, c.minZ), c.maxZ);
      const dx = P.x - cx, dz = P.z - cz;
      return dx * dx + dz * dz < r * r;
    }).map(c => ({ minX: +c.minX.toFixed(1), maxX: +c.maxX.toFixed(1), minZ: +c.minZ.toFixed(1), maxZ: +c.maxZ.toFixed(1), minY: +c.minY.toFixed(1), maxY: +c.maxY.toFixed(1) }));
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const escape = dirs.map(([dx, dz]) => {
      const d = 0.36;
      const res = HB.world.resolveMove(P.x, P.z, dx * d, dz * d, r, feetY, height);
      return { dir: [dx, dz], moved: +Math.hypot(res.x - P.x, res.z - P.z).toFixed(3) };
    });
    const grid = [];
    for (let gx = -14; gx <= 0; gx += 2) {
      let row = '';
      for (let gz = -70; gz <= -54; gz += 2) row += HB.world.validPosition(gx, gz, 0.42, 0, 1.72) ? '.' : '#';
      grid.push(row);
    }
    return {
      point: P,
      validHere: HB.world.validPosition(P.x, P.z, r, feetY, height),
      radii: [0.42, 0.43, 0.44, 0.46, 0.5, 0.55, 0.6].map(rr => ({ r: rr, ok: HB.world.validPosition(P.x, P.z, rr, 0, 1.72) })),
      nearColliders: W.colliders.filter(c => c.solid && Math.abs((c.minX + c.maxX) / 2 - P.x) < 3 && Math.abs((c.minZ + c.maxZ) / 2 - P.z) < 3).map(c => ({ minX: +c.minX.toFixed(2), maxX: +c.maxX.toFixed(2), minZ: +c.minZ.toFixed(2), maxZ: +c.maxZ.toFixed(2), minY: +c.minY.toFixed(1), maxY: +c.maxY.toFixed(1) })),
      overlappingColliders: hits,
      escapes: escape,
      walkableRects: W.walkable.map(w => ({ minX: +w.minX.toFixed(1), minZ: +w.minZ.toFixed(1), maxX: +w.maxX.toFixed(1), maxZ: +w.maxZ.toFixed(1) })),
      gridX: '-14..0 step 2', gridZ: '-70..-54 step 2', grid,
      relays: W.relays.map(r => ({ id: r.id, x: r.x, z: r.z })),
      colliderCount: W.colliders.length
    };
  });
  console.log(JSON.stringify(out, null, 2));
  await browser.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
