import { CONFIG } from './config.js';

const { vision, light } = CONFIG.guard;

export function angleDiff(a, b) {
  let diff = a - b;
  while (diff <= -Math.PI) diff += 2 * Math.PI;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  return diff;
}

export function inVisionCone(guardX, guardY, guardAngle, targetX, targetY, lightFactor) {
  const dx = targetX - guardX;
  const dy = targetY - guardY;
  const dist = Math.hypot(dx, dy);

  const effectiveRange = vision.range * (lightFactor < 0.5 ? light.shadowRangeFactor : 1);
  if (dist > effectiveRange) return { inCone: false, dist, factor: 0 };

  const angleToTarget = Math.atan2(dy, dx);
  const diff = Math.abs(angleDiff(angleToTarget, guardAngle));
  if (diff > vision.halfAngle) return { inCone: false, dist, factor: 0 };

  const angleFactor = 1 - diff / vision.halfAngle;
  const distFactor = 1 - dist / effectiveRange;
  let factor = angleFactor * distFactor;

  if (lightFactor < 0.5) {
    factor *= light.shadowDetectionFactor;
  }

  return { inCone: true, dist, factor: Math.max(0, Math.min(1, factor)) };
}

export function getVisionConePoints(guardX, guardY, guardAngle, lightFactor) {
  const effectiveRange = vision.range * (lightFactor < 0.5 ? light.shadowRangeFactor : 1);
  const halfAngle = vision.halfAngle;
  const segments = 16;
  const points = [];

  points.push({ x: guardX, y: guardY });

  for (let i = 0; i <= segments; i++) {
    const angle = guardAngle - halfAngle + (halfAngle * 2 * i / segments);
    points.push({
      x: guardX + Math.cos(angle) * effectiveRange,
      y: guardY + Math.sin(angle) * effectiveRange,
    });
  }

  return points;
}

export function calculateAlertChange(guard, player, world, dt) {
  const lightFactor = world.getLightFactor(player.x, player.y);
  const visionResult = inVisionCone(guard.x, guard.y, guard.angle, player.x, player.y, lightFactor);

  if (!visionResult.inCone) {
    return -CONFIG.guard.alert.decayRate * dt;
  }

  const riseRate = lightFactor > 0.5 ? CONFIG.guard.alert.riseRateLit : CONFIG.guard.alert.riseRateDim;
  return visionResult.factor * riseRate * dt;
}

export function canHearNoise(guardX, guardY, noiseX, noiseY, noiseRadius) {
  const dx = noiseX - guardX;
  const dy = noiseY - guardY;
  const dist = Math.hypot(dx, dy);
  return dist <= noiseRadius + CONFIG.guard.hearingRadius;
}