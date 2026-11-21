import { CONFIG } from './config.js';
import { input } from './input.js';
import { globalRandom } from './random.js';

const { player, tile } = CONFIG;
const { radius, speed, sprintNoiseInterval, sprintNoiseRadius, lureThrowSpeed, maxLures } = player;
const TILE = tile.size;

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.hasLedger = false;
    this.lures = maxLures;
    this.maxLures = maxLures;
    this.sneaking = false;
    this.sprinting = false;
    this.sprintNoiseTimer = 0;
    this.lureCooldown = 0;
    this.moveSpeed = speed.walk;
  }

  update(dt, world, guards, noiseEvents) {
    this.handleInput();
    this.move(dt, world);
    this.updateSprintNoise(dt, noiseEvents);
    this.updateLureCooldown(dt);
    this.throwLure(guards, noiseEvents);
  }

  handleInput() {
    this.sneaking = input.isSneaking();
    this.sprinting = input.isSprinting() && !this.sneaking;

    if (this.sneaking) {
      this.moveSpeed = speed.sneak;
    } else if (this.sprinting) {
      this.moveSpeed = speed.sprint;
    } else {
      this.moveSpeed = speed.walk;
    }
  }

  move(dt, world) {
    const dir = input.getMovementVector();
    if (dir.x === 0 && dir.y === 0) return;

    const len = Math.hypot(dir.x, dir.y);
    const dx = (dir.x / len) * this.moveSpeed * dt;
    const dy = (dir.y / len) * this.moveSpeed * dt;

    const result = world.resolveCollision(this.x, this.y, this.radius, dx, dy);
    this.x = result.x;
    this.y = result.y;
  }

  updateSprintNoise(dt, noiseEvents) {
    if (this.sprinting) {
      this.sprintNoiseTimer -= dt;
      if (this.sprintNoiseTimer <= 0) {
        noiseEvents.push({
          x: this.x,
          y: this.y,
          radius: sprintNoiseRadius,
          type: 'footstep'
        });
        this.sprintNoiseTimer = sprintNoiseInterval;
      }
    } else {
      this.sprintNoiseTimer = 0;
    }
  }

  updateLureCooldown(dt) {
    if (this.lureCooldown > 0) {
      this.lureCooldown -= dt;
    }
  }

  throwLure(guards, noiseEvents) {
    if (!input.isLurePressed() || this.lures <= 0 || this.lureCooldown > 0) return;

    const mousePos = input.getMousePosition(document.querySelector('canvas'));
    if (!mousePos) return;

    const dx = mousePos.x - this.x;
    const dy = mousePos.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) return;

    const throwX = this.x + (dx / dist) * 15;
    const throwY = this.y + (dy / dist) * 15;

    const vx = (dx / dist) * lureThrowSpeed;
    const vy = (dy / dist) * lureThrowSpeed;

    this.lures--;
    this.lureCooldown = 0.5;

    this.simulateLureArc(throwX, throwY, vx, vy, noiseEvents);
  }

  simulateLureArc(startX, startY, vx, vy, noiseEvents) {
    const gravity = 400;
    let x = startX;
    let y = startY;
    let velocityX = vx;
    let velocityY = vy;
    const dt = 1/60;
    let time = 0;

    while (time < 2.0) {
      x += velocityX * dt;
      y += velocityY * dt;
      velocityY += gravity * dt;
      time += dt;

      const tileX = Math.floor(x / TILE);
      const tileY = Math.floor(y / TILE);

      if (tileX < 0 || tileX >= CONFIG.tile.cols || tileY < 0 || tileY >= CONFIG.tile.rows) break;
    }

    noiseEvents.push({
      x: x,
      y: y,
      radius: sprintNoiseRadius * 1.8,
      type: 'lure'
    });
  }

  tryPickupLedger(ledgerX, ledgerY) {
    if (this.hasLedger) return false;
    const dx = ledgerX - this.x;
    const dy = ledgerY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < TILE * 0.8) {
      this.hasLedger = true;
      return true;
    }
    return false;
  }

  tryExit(exitX, exitY) {
    if (!this.hasLedger) return false;
    const dx = exitX - this.x;
    const dy = exitY - this.y;
    const dist = Math.hypot(dx, dy);
    return dist < TILE * 0.8;
  }

  addLure(count = 1) {
    this.lures = Math.min(this.maxLures, this.lures + count);
  }
}