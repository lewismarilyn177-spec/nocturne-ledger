// Sentry behaviour: patrol waypoints, hearing, suspicion, chase and search.
import { GUARD, TILE } from './config.js';
import { coneSees } from './vision.js';
import { lineBlocked } from './world.js';
export function makeGuards(world, levelDef) {
  const list = [];
  const routes = levelDef.guardPaths;
  for (const route of routes) {
    const first = route[0];
    list.push({
      x: first[0] * TILE + TILE / 2, y: first[1] * TILE + TILE / 2, facing: 0,
      route: route.map(([tx, ty]) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 })),
      wp: 1, state: 'patrol', alert: 0, timer: 0, suspect: null, caught: false,
    });
  }
  return list;
}
export function updateGuards(world, guards, dt, player, noises, time) {
  for (const g of guards) {
    let visibility = coneSees(world, g.x, g.y, g.facing, player.x, player.y);
    if (player.crouch) visibility *= 0.35;
    if (player.shadowed > 0.45) visibility *= 0.25;
    let heardNoise = null;
    for (const n of noises) {
      const d = Math.hypot(n.x - g.x, n.y - g.y);
      if (d < n.radius && !lineBlocked(world, g.x, g.y, n.x, n.y)) heardNoise = n;
    }
    if (visibility > 0.22) {
      g.alert += dt / (GUARD.spotMs * (player.crouch ? 2 : 1));
      g.suspect = { x: player.x, y: player.y };
    } else {
      g.alert -= dt * 0.45;
      if (heardNoise) { g.alert = Math.max(g.alert, 0.6); g.suspect = { x: heardNoise.x, y: heardNoise.y }; }
    }
    g.alert = Math.max(0, Math.min(1.2, g.alert));
    if (g.alert >= 1) { g.state = 'chase'; g.timer = GUARD.searchMs; }
    else if (g.state === 'chase') { g.timer -= dt; if (g.timer <= 0) { g.state = 'search'; g.timer = GUARD.searchMs; } }
    else if (g.state === 'search') { g.timer -= dt; if (g.timer <= 0) { g.state = 'patrol'; g.suspect = null; } }
    else if (g.alert > 0.3) g.state = 'suspicious';
    else if (g.state === 'suspicious') { g.state = 'patrol'; g.suspect = null; }
    moveGuard(world, g, dt, player);
  }
}
function moveGuard(world, g, dt, player) {
  let goal, speed;
  if (g.state === 'chase') { goal = player; speed = GUARD.chase; }
  else if (g.state === 'search' || g.state === 'suspicious') { goal = g.suspect ?? g.route[0]; speed = GUARD.search; }
  else {
    goal = g.route[g.wp % g.route.length];
    speed = GUARD.patrol;
    if (Math.hypot(g.x - goal.x, g.y - goal.y) < 12) g.wp++;
  }
  const dx = goal.x - g.x, dy = goal.y - g.y, d = Math.hypot(dx, dy);
  if (d > 6) {
    const step = speed * dt;
    const nx = g.x + (dx / d) * step, ny = g.y + (dy / d) * step;
    if (!wallAt(world, nx, g.y)) g.x = nx;
    if (!wallAt(world, g.x, ny)) g.y = ny;
    g.facing = Math.atan2(dy, dx);
    if (g.state === 'chase' && Math.hypot(player.x - g.x, player.y - g.y) < 20) g.caught = true;
  } else if (g.state !== 'chase') g.facing += dt * 1.2;
}
function wallAt(world, x, y) {
  for (const [ox, oy] of [[TILE * 0.3, 0], [-TILE * 0.3, 0], [0, TILE * 0.3], [0, -TILE * 0.3]]) {
    if (isWallAt(world, x + ox, y + oy)) return true;
  }
  return false;
}
import { isWall as isWallAt } from './world.js';