import { CONFIG } from './config.js';
import { inVisionCone, getVisionConePoints, calculateAlertChange, canHearNoise } from './vision.js';
import { globalRandom } from './random.js';

const { guard } = CONFIG;
const { speed, vision, alert, hearingRadius, searchTime, patrolPause, searchPause } = guard;

export class Guard {
  constructor(x, y, waypoints, id) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.radius = guard.radius;
    this.waypoints = waypoints;
    this.waypointIndex = 0;
    this.state = 'patrol';
    this.angle = 0;
    this.targetX = x;
    this.targetY = y;
    this.alert = 0;
    this.lastKnownPlayerX = null;
    this.lastKnownPlayerY = null;
    this.searchTimer = 0;
    this.searchPauseTimer = 0;
    this.patrolPauseTimer = 0;
    this.lastNoiseX = null;
    this.lastNoiseY = null;
    this.noiseTimer = 0;
    this.suspicionTarget = null;
  }

  update(dt, player, world, noiseEvents) {
    this.processNoise(noiseEvents);
    this.updateAlert(player, world, dt);
    this.updateStateMachine(dt, player, world);
    this.move(dt, world);
    this.updateAngle();
  }

  processNoise(noiseEvents) {
    for (const noise of noiseEvents) {
      if (canHearNoise(this.x, this.y, noise.x, noise.y, noise.radius)) {
        this.lastNoiseX = noise.x;
        this.lastNoiseY = noise.y;
        this.noiseTimer = 2.0;
        if (this.state === 'patrol') {
          this.state = 'suspicious';
          this.suspicionTarget = { x: noise.x, y: noise.y };
        }
      }
    }
    if (this.noiseTimer > 0) {
      this.noiseTimer -= 1/60;
    }
  }

  updateAlert(player, world, dt) {
    const alertChange = calculateAlertChange(this, player, world, dt);
    this.alert = Math.max(0, Math.min(1, this.alert + alertChange));
  }

  updateStateMachine(dt, player, world) {
    const lightFactor = world.getLightFactor(player.x, player.y);
    const visionResult = inVisionCone(this.x, this.y, this.angle, player.x, player.y, lightFactor);
    const canSeePlayer = visionResult.inCone;

    switch (this.state) {
      case 'patrol':
        if (canSeePlayer) {
          this.state = 'suspicious';
          this.lastKnownPlayerX = player.x;
          this.lastKnownPlayerY = player.y;
        } else if (this.noiseTimer > 0) {
          this.state = 'suspicious';
          this.suspicionTarget = { x: this.lastNoiseX, y: this.lastNoiseY };
        }
        break;

      case 'suspicious':
        if (canSeePlayer) {
          this.alert = Math.max(this.alert, alert.chaseThreshold);
          this.state = 'chase';
          this.lastKnownPlayerX = player.x;
          this.lastKnownPlayerY = player.y;
        } else if (this.alert >= alert.suspiciousThreshold) {
          this.state = 'search';
          this.searchTimer = searchTime;
          this.searchPauseTimer = 0;
        } else if (this.noiseTimer <= 0 && !this.suspicionTarget) {
          this.state = 'patrol';
        }
        break;

      case 'chase':
        if (canSeePlayer) {
          this.lastKnownPlayerX = player.x;
          this.lastKnownPlayerY = player.y;
        } else {
          this.state = 'search';
          this.searchTimer = searchTime;
          this.searchPauseTimer = 0;
        }
        break;

      case 'search':
        this.searchTimer -= dt;
        if (this.searchTimer <= 0) {
          if (this.searchPauseTimer <= 0) {
            this.searchPauseTimer = searchPause;
          }
          this.searchPauseTimer -= dt;
          if (this.searchPauseTimer <= 0) {
            this.state = 'patrol';
            this.lastKnownPlayerX = null;
            this.lastKnownPlayerY = null;
          }
        }
        break;
    }
  }

  move(dt, world) {
    let targetSpeed = speed.walk;
    let moveX = 0, moveY = 0;

    switch (this.state) {
      case 'patrol':
        this.movePatrol(dt, world);
        return;

      case 'suspicious':
        targetSpeed = speed.walk;
        if (this.suspicionTarget) {
          moveX = this.suspicionTarget.x - this.x;
          moveY = this.suspicionTarget.y - this.y;
        }
        break;

      case 'chase':
        targetSpeed = speed.chase;
        if (this.lastKnownPlayerX !== null) {
          moveX = this.lastKnownPlayerX - this.x;
          moveY = this.lastKnownPlayerY - this.y;
        }
        break;

      case 'search':
        targetSpeed = speed.search;
        if (this.lastKnownPlayerX !== null) {
          moveX = this.lastKnownPlayerX - this.x;
          moveY = this.lastKnownPlayerY - this.y;
        }
        break;
    }

    if (moveX !== 0 || moveY !== 0) {
      const dist = Math.hypot(moveX, moveY);
      if (dist > 1) {
        moveX = (moveX / dist) * targetSpeed * dt;
        moveY = (moveY / dist) * targetSpeed * dt;
        const result = world.resolveCollision(this.x, this.y, this.radius, moveX, moveY);
        this.x = result.x;
        this.y = result.y;
      } else if (this.state === 'suspicious') {
        this.suspicionTarget = null;
      }
    }
  }

  movePatrol(dt, world) {
    if (this.waypoints.length === 0) return;

    const target = this.waypoints[this.waypointIndex];
    const targetPx = target.x * CONFIG.tile.size + CONFIG.tile.size / 2;
    const targetPy = target.y * CONFIG.tile.size + CONFIG.tile.size / 2;

    const dx = targetPx - this.x;
    const dy = targetPy - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 5) {
      this.patrolPauseTimer -= dt;
      if (this.patrolPauseTimer <= 0) {
        this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
        this.patrolPauseTimer = patrolPause;
      }
      return;
    }

    const moveX = (dx / dist) * speed.walk * dt;
    const moveY = (dy / dist) * speed.walk * dt;
    const result = world.resolveCollision(this.x, this.y, this.radius, moveX, moveY);
    this.x = result.x;
    this.y = result.y;
  }

  updateAngle() {
    let targetAngle = this.angle;

    switch (this.state) {
      case 'patrol':
        if (this.waypoints.length > 0) {
          const target = this.waypoints[this.waypointIndex];
          const targetPx = target.x * CONFIG.tile.size + CONFIG.tile.size / 2;
          const targetPy = target.y * CONFIG.tile.size + CONFIG.tile.size / 2;
          targetAngle = Math.atan2(targetPy - this.y, targetPx - this.x);
        }
        break;
      case 'suspicious':
        if (this.suspicionTarget) {
          targetAngle = Math.atan2(this.suspicionTarget.y - this.y, this.suspicionTarget.x - this.x);
        } else if (this.lastNoiseX !== null) {
          targetAngle = Math.atan2(this.lastNoiseY - this.y, this.lastNoiseX - this.x);
        }
        break;
      case 'chase':
      case 'search':
        if (this.lastKnownPlayerX !== null) {
          targetAngle = Math.atan2(this.lastKnownPlayerY - this.y, this.lastKnownPlayerX - this.x);
        }
        break;
    }

    let diff = targetAngle - this.angle;
    while (diff <= -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    this.angle += diff * 0.15;
  }

  getVisionConePoints(lightFactor) {
    return getVisionConePoints(this.x, this.y, this.angle, lightFactor);
  }

  isPlayerDetected() {
    return this.state === 'chase' && this.alert >= alert.chaseThreshold;
  }
}

export function createGuards(levelData) {
  return levelData.guards.map((g, i) => new Guard(
    g.x * CONFIG.tile.size + CONFIG.tile.size / 2,
    g.y * CONFIG.tile.size + CONFIG.tile.size / 2,
    g.waypoints,
    i
  ));
}