// World parsing: map grid -> walls, lamps, pickups, spawn and exit.
import { TILE } from './config.js';
export function buildWorld(levelDef) {
  const rows = levelDef.map;
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const walls = new Set(), lamps = [];
  let player = { x: 1.5 * TILE, y: 1.5 * TILE };
  let exit = { x: 24 * TILE, y: 10 * TILE };
  let ledger = null;
  for (let y = 0; y < h; y++) {
    const row = rows[y].padEnd(w, '.');
    for (let x = 0; x < row.length; x++) {
      const c = row[x], cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE;
      if (c === '#') walls.add(x + ',' + y);
      else if (c === 'L') lamps.push({ x: cx, y: cy });
      else if (c === 'P') player = { x: cx, y: cy };
      else if (c === 'X') exit = { x: cx, y: cy };
      else if (c === 'l') ledger = { x: cx, y: cy };
    }
  }
  return { w, h, walls, lamps, player, exit, ledger, crates: extractCrates(walls) };
}
// Rectangular clusters of interior walls become cover blocks the board can read.
function extractCrates(walls) {
  const crates = [], seen = new Set();
  for (const key of walls) {
    if (seen.has(key)) continue;
    const [sx, sy] = key.split(',').map(Number);
    let ex = sx, ey = sy;
    while (walls.has((ex + 1) + ',' + sy) && !seen.has((ex + 1) + ',' + sy)) ex++;
    let grow = true;
    while (grow) {
      for (let x = sx; x <= ex; x++) if (!walls.has(x + ',' + (ey + 1))) { grow = false; break; }
      if (grow) ey++;
    }
    for (let x = sx; x <= ex; x++) for (let y = sy; y <= ey; y++) seen.add(x + ',' + y);
    if (ex > sx && ey > sy) crates.push({ x: sx * TILE, y: sy * TILE, w: (ex - sx + 1) * TILE, h: (ey - sy + 1) * TILE });
  }
  return crates;
}
export function isWall(world, x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  return tx < 0 || ty < 0 || tx >= world.w || ty >= world.h || world.walls.has(tx + ',' + ty);
}
export function lineBlocked(world, x0, y0, x1, y1) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isWall(world, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true;
  }
  return false;
}