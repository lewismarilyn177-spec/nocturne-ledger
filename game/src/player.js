// Wren, the night courier: movement, sneak, sprint, noise emission, lure throws.
import { PLAYER, NOISE } from './config.js';
import { isWall } from './world.js';
import { sfx } from './audio.js';
export function makePlayer(world) {
  return { x: world.player.x, y: world.player.y, crouch: false, hasLedger: false,
    noiseLevel: 0, lures: 3, stepClock: 0, shadowed: 0 };
}
export function updatePlayer(world, player, input, dt, time) {
  const sprinting = input.down('Space') && !player.crouch && player.hasLedger === false;
  const speed = player.crouch ? PLAYER.sneak : (sprinting ? PLAYER.sprint : PLAYER.walk);
  let dx = 0, dy = 0;
  if (input.down('KeyW')) dy -= 1;
  if (input.down('KeyS')) dy += 1;
  if (input.down('KeyA')) dx -= 1;
  if (input.down('KeyD')) dx += 1;
  const moving = dx !== 0 || dy !== 0;
  if (moving) {
    const d = Math.hypot(dx, dy);
    const nx = player.x + (dx / d) * speed * dt, ny = player.y + (dy / d) * speed * dt;
    if (!isWall(world, nx + Math.sign(dx) * 8, player.y)) player.x = nx;
    if (!isWall(world, player.x, ny + Math.sign(dy) * 8)) player.y = ny;
    player.stepClock += dt * (sprinting ? 2 : player.crouch ? 0.6 : 1);
    if (player.stepClock > 0.34) { player.stepClock = 0; if (!player.crouch) sfx.step(); }
  }
  // Sound meter: sprint is loud, walk is a whisper, sneak is silence.
  const emit = moving ? (sprinting ? NOISE.sprint : player.crouch ? NOISE.sneak : NOISE.walk) : 0;
  player.noiseLevel += ((emit / NOISE.sprint) - player.noiseLevel) * Math.min(1, dt * 6);
  player.lureRadius = emit;
  player.shadowed = player.shadowed ?? 0;
  return moving;
}
export function throwLure(player, tx, ty, noises) {
  if (player.lures <= 0) return null;
  player.lures--;
  const d = Math.hypot(tx - player.x, ty - player.y), maxD = 260;
  const t = Math.min(1, d / maxD);
  const lx = player.x + (tx - player.x) * t, ly = player.y + (ty - player.y) * t;
  noises.push({ x: lx, y: ly, radius: NOISE.lure, born: performance.now(), kind: 'lure' });
  return { x: lx, y: ly };
}