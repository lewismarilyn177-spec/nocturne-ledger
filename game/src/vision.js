// Vision + light: cone hit-tests against walls, and the lamp-light factor that
// decides whether the player is actually visible to a sentry.
import { GUARD } from './config.js';
import { lineBlocked } from './world.js';
export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}
export function coneSees(world, gx, gy, facing, px, py) {
  const dx = px - gx, dy = py - gy, dist = Math.hypot(dx, dy);
  if (dist > GUARD.range) return 0;
  if (angleDiff(Math.atan2(dy, dx), facing) > (GUARD.fov * Math.PI / 180) / 2) return 0;
  if (lineBlocked(world, gx, gy, px, py)) return 0;
  return Math.max(0.15, 1 - dist / GUARD.range);
}
// 0 = deep shadow, 1 = standing in a lamp pool. Crouching in shadow hides Wren.
export function shadowFactor(world, player, time) {
  let lit = 0;
  for (const lamp of world.lamps) {
    const d = Math.hypot(lamp.x - player.x, lamp.y - player.y);
    const flick = 1 + Math.sin(time * 0.006 + lamp.x) * 0.12;
    const r = 150 * flick;
    if (d < r) lit = Math.max(lit, 1 - d / r);
  }
  return Math.min(1, lit);
}