import { CONFIG } from './config.js';

const TILE = CONFIG.tile.size;
const COLS = CONFIG.tile.cols;
const ROWS = CONFIG.tile.rows;

export class World {
  constructor(levelData) {
    this.tileSize = TILE;
    this.cols = COLS;
    this.rows = ROWS;
    this.width = COLS * TILE;
    this.height = ROWS * TILE;

    this.walls = [];
    this.wallGrid = new Uint8Array(COLS * ROWS);
    this.coverGrid = new Uint8Array(COLS * ROWS);
    this.lamps = [];
    this.crates = [];

    this.parseLevel(levelData);
    this.buildSpatialIndex();
  }

  parseLevel(levelData) {
    const map = levelData.map;
    for (let y = 0; y < map.length; y++) {
      const row = map[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '#') {
          this.wallGrid[y * COLS + x] = 1;
          this.walls.push({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2, tileX: x, tileY: y });
        }
      }
    }

    for (const lamp of levelData.lamps) {
      this.lamps.push({ x: lamp.x * TILE + TILE / 2, y: lamp.y * TILE + TILE / 2 });
    }

    for (const crate of levelData.crates) {
      this.coverGrid[crate.y * COLS + crate.x] = 1;
      this.crates.push({ x: crate.x * TILE + TILE / 2, y: crate.y * TILE + TILE / 2, tileX: crate.x, tileY: crate.y });
    }
  }

  buildSpatialIndex() {
    this.wallCells = new Map();
    for (const wall of this.walls) {
      const key = `${wall.tileX},${wall.tileY}`;
      if (!this.wallCells.has(key)) this.wallCells.set(key, []);
      this.wallCells.get(key).push(wall);
    }
  }

  isWallAt(tileX, tileY) {
    if (tileX < 0 || tileX >= COLS || tileY < 0 || tileY >= ROWS) return true;
    return this.wallGrid[tileY * COLS + tileX] === 1;
  }

  isCoverAt(tileX, tileY) {
    if (tileX < 0 || tileX >= COLS || tileY < 0 || tileY >= ROWS) return false;
    return this.coverGrid[tileY * COLS + tileX] === 1;
  }

  checkCircleWallCollision(cx, cy, radius) {
    const minTileX = Math.max(0, Math.floor((cx - radius) / TILE));
    const maxTileX = Math.min(COLS - 1, Math.floor((cx + radius) / TILE));
    const minTileY = Math.max(0, Math.floor((cy - radius) / TILE));
    const maxTileY = Math.min(ROWS - 1, Math.floor((cy + radius) / TILE));

    let pushX = 0, pushY = 0;
    let collided = false;

    for (let ty = minTileY; ty <= maxTileY; ty++) {
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        if (!this.isWallAt(tx, ty)) continue;
        const wx = tx * TILE + TILE / 2;
        const wy = ty * TILE + TILE / 2;
        const dx = cx - wx;
        const dy = cy - wy;
        const dist = Math.hypot(dx, dy);
        const minDist = radius + TILE / 2;
        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          pushX += (dx / dist) * overlap;
          pushY += (dy / dist) * overlap;
          collided = true;
        } else if (dist === 0) {
          pushX += 0.1;
          pushY += 0.1;
          collided = true;
        }
      }
    }

    for (const crate of this.crates) {
      const dx = cx - crate.x;
      const dy = cy - crate.y;
      const dist = Math.hypot(dx, dy);
      const minDist = radius + TILE / 2;
      if (dist < minDist && dist > 0.001) {
        const overlap = minDist - dist;
        pushX += (dx / dist) * overlap;
        pushY += (dy / dist) * overlap;
        collided = true;
      }
    }

    return { collided, pushX, pushY };
  }

  resolveCollision(x, y, radius, dx, dy) {
    let nx = x + dx;
    let ny = y;

    let result = this.checkCircleWallCollision(nx, ny, radius);
    if (result.collided) {
      nx = x;
    }

    nx = x;
    ny = y + dy;
    result = this.checkCircleWallCollision(nx, ny, radius);
    if (result.collided) {
      ny = y;
    }

    nx = x + dx;
    ny = y + dy;
    result = this.checkCircleWallCollision(nx, ny, radius);
    if (result.collided) {
      nx = x;
      ny = y;
    }

    return { x: nx, y: ny };
  }

  lineOfSight(x1, y1, x2, y2, maxDist, samples = 8) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist > maxDist) return false;
    if (dist === 0) return true;

    const stepX = dx / dist;
    const stepY = dy / dist;
    const sampleDist = dist / samples;

    for (let i = 1; i <= samples; i++) {
      const sx = x1 + stepX * sampleDist * i;
      const sy = y1 + stepY * sampleDist * i;
      const tx = Math.floor(sx / TILE);
      const ty = Math.floor(sy / TILE);
      if (this.isWallAt(tx, ty)) return false;
    }
    return true;
  }

  getLightFactor(x, y) {
    let maxLight = 0;
    const { lampRadius, lampIntensity, falloffExponent, losSamples } = CONFIG.light;

    for (const lamp of this.lamps) {
      const dx = lamp.x - x;
      const dy = lamp.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist > lampRadius) continue;

      if (!this.lineOfSight(lamp.x, lamp.y, x, y, lampRadius, losSamples)) continue;

      const falloff = Math.pow(1 - dist / lampRadius, falloffExponent);
      const light = lampIntensity * falloff;
      if (light > maxLight) maxLight = light;
    }

    return Math.min(1, maxLight);
  }

  getLampPositions() {
    return this.lamps.map(l => ({ x: l.x, y: l.y }));
  }
}