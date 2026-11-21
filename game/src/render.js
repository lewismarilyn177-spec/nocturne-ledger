import { CONFIG } from './config.js';

const { canvas, tile, colors, light, guard, hud } = CONFIG;
const { width, height } = canvas;
const TILE = tile.size;
const COLS = tile.cols;
const ROWS = tile.rows;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lightCache = null;
    this.lightCacheValid = false;
  }

  resize() {
    this.canvas.width = width;
    this.canvas.height = height;
    this.lightCacheValid = false;
  }

  render(world, player, guards, ledger, exit, gameState, levelData, stats, toast) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    this.drawFloor(ctx, world);
    this.drawWalls(ctx, world);
    this.drawCrates(ctx, world);
    this.drawLamps(ctx, world);
    this.drawLedger(ctx, ledger);
    this.drawExit(ctx, exit, player.hasLedger);
    this.drawGuards(ctx, guards, world);
    this.drawPlayer(ctx, player);
    this.drawLightOverlay(ctx, world, player);
    this.drawHUD(ctx, gameState, levelData, stats, toast, player);
  }

  drawFloor(ctx, world) {
    ctx.fillStyle = colors.floor;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = 0; x <= width; x += TILE) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += TILE) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  drawWalls(ctx, world) {
    for (const wall of world.walls) {
      const x = wall.x - TILE / 2;
      const y = wall.y - TILE / 2;
      ctx.fillStyle = colors.wall;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = colors.wallTop;
      ctx.fillRect(x, y, TILE, 3);
    }
  }

  drawCrates(ctx, world) {
    for (const crate of world.crates) {
      const x = crate.x - TILE / 2;
      const y = crate.y - TILE / 2;
      ctx.fillStyle = colors.cover;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = colors.coverTop;
      ctx.fillRect(x, y, TILE, 4);
      ctx.strokeStyle = colors.wallTop;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    }
  }

  drawLamps(ctx, world) {
    for (const lamp of world.lamps) {
      const glowRadius = 28;
      const gradient = ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, glowRadius);
      gradient.addColorStop(0, 'rgba(240, 201, 107, 0.35)');
      gradient.addColorStop(0.5, 'rgba(240, 201, 107, 0.15)');
      gradient.addColorStop(1, 'rgba(240, 201, 107, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = colors.lampLight;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8d0';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawLedger(ctx, ledger) {
    if (!ledger || ledger.collected) return;
    const x = ledger.x;
    const y = ledger.y;
    const time = Date.now() / 300;
    const bob = Math.sin(time) * 3;
    ctx.fillStyle = colors.ledger;
    ctx.beginPath();
    ctx.moveTo(x, y + bob - 10);
    ctx.lineTo(x - 8, y + bob + 2);
    ctx.lineTo(x + 8, y + bob + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath();
    ctx.arc(x, y + bob - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawExit(ctx, exit, hasLedger) {
    const x = exit.x;
    const y = exit.y;
    ctx.fillStyle = hasLedger ? colors.exit : '#3a5a4a';
    ctx.beginPath();
    ctx.arc(x, y, TILE * 0.45, 0, Math.PI * 2);
    ctx.fill();
    if (hasLedger) {
      ctx.fillStyle = '#e0ffe8';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▲', x, y + 2);
    }
  }

  drawGuards(ctx, guards, world) {
    for (const g of guards) {
      const lightFactor = world.getLightFactor(g.x, g.y);
      const conePoints = g.getVisionConePoints(lightFactor);

      const coneAlpha = g.state === 'chase' ? 0.22 : 0.16;
      ctx.fillStyle = `rgba(240, 201, 107, ${coneAlpha})`;
      ctx.beginPath();
      ctx.moveTo(conePoints[0].x, conePoints[0].y);
      for (let i = 1; i < conePoints.length; i++) {
        ctx.lineTo(conePoints[i].x, conePoints[i].y);
      }
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgba(240, 201, 107, ${coneAlpha + 0.08})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(conePoints[0].x, conePoints[0].y);
      for (let i = 1; i < conePoints.length; i++) {
        ctx.lineTo(conePoints[i].x, conePoints[i].y);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.fillStyle = colors.guard;
      ctx.beginPath();
      ctx.arc(g.x, g.y, guard.radius, 0, Math.PI * 2);
      ctx.fill();

      const dirX = Math.cos(g.angle) * (guard.radius + 4);
      const dirY = Math.sin(g.angle) * (guard.radius + 4);
      ctx.strokeStyle = '#ff6650';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + dirX, g.y + dirY);
      ctx.stroke();

      if (g.alert > 0) {
        const alertRadius = 14 + g.alert * 10;
        ctx.strokeStyle = colors.alert;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(g.x, g.y, alertRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  drawPlayer(ctx, player) {
    ctx.fillStyle = colors.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4aa3c7';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (player.sneaking) {
      ctx.fillStyle = 'rgba(143, 211, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  buildLightCache(world) {
    if (this.lightCacheValid) return this.lightCache;

    const cache = document.createElement('canvas');
    cache.width = width;
    cache.height = height;
    const cctx = cache.getContext('2d');

    const { lampRadius, lampIntensity, falloffExponent, losSamples } = light;

    for (const lamp of world.lamps) {
      const gradient = cctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, lampRadius);
      gradient.addColorStop(0, `rgba(240, 201, 107, ${lampIntensity * 0.7})`);
      gradient.addColorStop(0.5, `rgba(240, 201, 107, ${lampIntensity * 0.3})`);
      gradient.addColorStop(1, 'rgba(240, 201, 107, 0)');
      cctx.fillStyle = gradient;
      cctx.beginPath();
      cctx.arc(lamp.x, lamp.y, lampRadius, 0, Math.PI * 2);
      cctx.fill();
    }

    this.lightCache = cache;
    this.lightCacheValid = true;
    return cache;
  }

  drawLightOverlay(ctx, world, player) {
    const lightCache = this.buildLightCache(world);

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(lightCache, 0, 0);
    ctx.restore();

    const playerLight = world.getLightFactor(player.x, player.y);
    if (playerLight < 0.3) {
      ctx.fillStyle = `rgba(0, 0, 0, ${(0.3 - playerLight) * 0.6})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  drawHUD(ctx, gameState, levelData, stats, toast, player) {
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const pad = 12;
    let y = pad;

    if (levelData) {
      ctx.fillStyle = '#e0e8f0';
      ctx.fillText(`FLOOR ${stats.currentLevel}/3 - ${levelData.name}`, pad, y);
      y += 18;
    }

    this.drawBar(ctx, 'SOUND', player.sprinting ? 0.7 : 0, pad, y, 180, 10, '#ff6644');
    y += 16;
    const lightFactor = player.currentLightFactor || 0;
    this.drawBar(ctx, 'LIGHT', lightFactor, pad, y, 180, 10, '#f0c96b');
    y += 16;

    ctx.fillStyle = '#a0b0c8';
    ctx.fillText(`LURES: ${player.lures}/${player.maxLures}`, pad, y);
    y += 16;

    if (player.hasLedger) {
      ctx.fillStyle = '#f0c96b';
      ctx.fillText('OBJECTIVE: Reach the exit hatch', pad, y);
    } else {
      ctx.fillStyle = '#a0b0c8';
      ctx.fillText('OBJECTIVE: Find the ledger', pad, y);
    }

    if (toast) {
      this.drawToast(ctx, toast);
    }

    if (gameState === 'start' || gameState === 'paused' || gameState === 'complete' || gameState === 'caught') {
      this.drawOverlay(ctx, gameState, stats, levelData);
    }
  }

  drawBar(ctx, label, value, x, y, w, h, color) {
    ctx.fillStyle = '#2a3648';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, value)), h);
    ctx.strokeStyle = '#3d4a63';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#8899aa';
    ctx.fillText(label, x + w + 8, y - 1);
  }

  drawToast(ctx, toast) {
    const { text, timer } = toast;
    const alpha = Math.min(1, timer / 1.5) * Math.min(1, (hud.toastDuration - timer) / 1.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#101623cc';
    const w = 400, h = 50;
    const x = (width - w) / 2;
    const y = 40;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#f0c96b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#f0c96b';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, y + h / 2);
    ctx.restore();
  }

  drawOverlay(ctx, gameState, stats, levelData) {
    ctx.fillStyle = 'rgba(16, 22, 35, 0.92)';
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (gameState === 'start') {
      ctx.fillStyle = '#f0c96b';
      ctx.font = 'bold 48px monospace';
      ctx.fillText('NOCTURNE LEDGER', width / 2, height / 2 - 80);
      ctx.fillStyle = '#8fd3ff';
      ctx.font = '18px monospace';
      ctx.fillText('A top-down stealth game of shadows and secrets', width / 2, height / 2 - 30);
      ctx.fillStyle = '#a0b0c8';
      ctx.font = '13px monospace';
      ctx.fillText('WASD / Arrows  Move    SHIFT  Sneak    SPACE  Sprint', width / 2, height / 2 + 20);
      ctx.fillText('E  Pick up ledger / Exit    G  Throw lure    P / ESC  Pause', width / 2, height / 2 + 45);
      this.drawButton(ctx, 'BEGIN THE NIGHT', width / 2, height / 2 + 100, 280, 48);
    } else if (gameState === 'paused') {
      ctx.fillStyle = '#f0c96b';
      ctx.font = 'bold 32px monospace';
      ctx.fillText('PAUSED', width / 2, height / 2 - 40);
      this.drawButton(ctx, 'RESUME (P)', width / 2, height / 2 + 20, 200, 40);
    } else if (gameState === 'complete') {
      ctx.fillStyle = '#4fd18b';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('FLOOR CLEARED', width / 2, height / 2 - 80);
      ctx.fillStyle = '#a0b0c8';
      ctx.font = '14px monospace';
      ctx.fillText(`Time: ${stats.time.toFixed(1)}s`, width / 2, height / 2 - 30);
      ctx.fillText(`Times Spotted: ${stats.timesSpotted}`, width / 2, height / 2 - 10);
      ctx.fillText(`Lures Used: ${stats.luresUsed}`, width / 2, height / 2 + 10);
      if (stats.currentLevel < 3) {
        this.drawButton(ctx, 'CONTINUE', width / 2, height / 2 + 60, 200, 44);
      } else {
        ctx.fillStyle = '#f0c96b';
        ctx.font = '16px monospace';
        ctx.fillText('THE LEDGER IS SECURE. THE NIGHT ENDS.', width / 2, height / 2 + 60);
      }
    } else if (gameState === 'caught') {
      ctx.fillStyle = '#c8443a';
      ctx.font = 'bold 36px monospace';
      ctx.fillText('CAUGHT', width / 2, height / 2 - 40);
      ctx.fillStyle = '#a0b0c8';
      ctx.font = '14px monospace';
      ctx.fillText('The guards found you. Try again.', width / 2, height / 2 + 10);
      this.drawButton(ctx, 'RETRY', width / 2, height / 2 + 60, 160, 40);
    }
  }

  drawButton(ctx, text, x, y, w, h) {
    ctx.fillStyle = '#1e2838';
    ctx.fillRect(x - w/2, y - h/2, w, h);
    ctx.strokeStyle = '#f0c96b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - w/2, y - h/2, w, h);
    ctx.fillStyle = '#f0c96b';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(text, x, y + 2);
  }

  checkButtonClick(gameState, mouseX, mouseY) {
    if (gameState === 'start') {
      const btnY = height / 2 + 100;
      if (Math.abs(mouseX - width/2) < 140 && Math.abs(mouseY - btnY) < 24) return 'start';
    } else if (gameState === 'paused') {
      const btnY = height / 2 + 20;
      if (Math.abs(mouseX - width/2) < 100 && Math.abs(mouseY - btnY) < 20) return 'resume';
    } else if (gameState === 'complete') {
      const btnY = height / 2 + 60;
      if (Math.abs(mouseX - width/2) < 100 && Math.abs(mouseY - btnY) < 22) return 'continue';
    } else if (gameState === 'caught') {
      const btnY = height / 2 + 60;
      if (Math.abs(mouseX - width/2) < 80 && Math.abs(mouseY - btnY) < 20) return 'retry';
    }
    return null;
  }
}