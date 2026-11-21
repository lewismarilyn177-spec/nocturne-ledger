import { CONFIG } from './config.js';
import { LEVELS } from './levels.js';
import { World } from './world.js';
import { Guard, createGuards } from './guards.js';
import { Player } from './player.js';
import { Renderer } from './render.js';
import { initAudio, resumeAudio, playFootstep, playAlertChirp, playLureThud, playPickupChime, playCaughtBuzz, playLevelComplete } from './audio.js';
import { input } from './input.js';

const canvas = document.getElementById('canvas');
const renderer = new Renderer(canvas);

let gameState = 'start';
let currentLevelIndex = 0;
let world = null;
let player = null;
let guards = [];
let ledger = null;
let exit = null;
let noiseEvents = [];
let stats = { time: 0, timesSpotted: 0, luresUsed: 0, currentLevel: 1 };
let toast = null;
let lastTime = 0;
let shotMode = null;
let shotSettled = false;
let shotFrameCount = 0;

function parseURLParams() {
  const params = new URLSearchParams(window.location.search);
  shotMode = params.get('shot');
}

function initLevel(levelIndex) {
  const levelData = LEVELS[levelIndex];
  world = new World(levelData);

  const spawnX = levelData.spawn.x * CONFIG.tile.size + CONFIG.tile.size / 2;
  const spawnY = levelData.spawn.y * CONFIG.tile.size + CONFIG.tile.size / 2;
  player = new Player(spawnX, spawnY);

  guards = createGuards(levelData);

  ledger = {
    x: levelData.ledger.x * CONFIG.tile.size + CONFIG.tile.size / 2,
    y: levelData.ledger.y * CONFIG.tile.size + CONFIG.tile.size / 2,
    collected: false
  };

  exit = {
    x: levelData.exit.x * CONFIG.tile.size + CONFIG.tile.size / 2,
    y: levelData.exit.y * CONFIG.tile.size + CONFIG.tile.size / 2
  };

  noiseEvents = [];
  stats.time = 0;
  stats.timesSpotted = 0;
  stats.luresUsed = 0;
  stats.currentLevel = levelIndex + 1;

  showToast(`FLOOR ${levelIndex + 1}/3 - ${levelData.name}`, levelData.hint);
}

function showToast(title, hint) {
  toast = { text: `${title} — ${hint}`, timer: CONFIG.hud.toastDuration };
}

function updateToast(dt) {
  if (toast) {
    toast.timer -= dt;
    if (toast.timer <= 0) toast = null;
  }
}

function handleInput() {
  if (input.isPausePressed()) {
    if (gameState === 'play') {
      gameState = 'paused';
    } else if (gameState === 'paused') {
      gameState = 'play';
    }
    input.keys.delete('KeyP');
    input.keys.delete('Escape');
  }

  if (gameState === 'start' || gameState === 'paused' || gameState === 'complete' || gameState === 'caught') {
    return;
  }

  if (input.isActionPressed()) {
    if (!player.hasLedger && ledger && !ledger.collected) {
      if (player.tryPickupLedger(ledger.x, ledger.y)) {
        ledger.collected = true;
        playPickupChime();
      }
    } else if (player.hasLedger && exit) {
      if (player.tryExit(exit.x, exit.y)) {
        playLevelComplete();
        completeLevel();
      }
    }
    input.keys.delete('KeyE');
  }

  if (input.isLurePressed() && player.lures > 0 && player.lureCooldown <= 0) {
    player.throwLure(guards, noiseEvents);
    stats.luresUsed++;
    playLureThud();
    input.keys.delete('KeyG');
  }
}

function updatePlayerLightFactor() {
  if (world && player) {
    player.currentLightFactor = world.getLightFactor(player.x, player.y);
  }
}

function checkDetection() {
  if (!world || !player) return;

  for (const guard of guards) {
    if (guard.isPlayerDetected()) {
      stats.timesSpotted++;
      playCaughtBuzz();
      gameState = 'caught';
      return;
    }
  }
}

function checkLedgerPickup() {
  if (ledger && !ledger.collected && player && !player.hasLedger) {
    if (player.tryPickupLedger(ledger.x, ledger.y)) {
      ledger.collected = true;
      playPickupChime();
    }
  }
}

function checkExit() {
  if (exit && player && player.hasLedger) {
    if (player.tryExit(exit.x, exit.y)) {
      playLevelComplete();
      completeLevel();
    }
  }
}

function completeLevel() {
  if (currentLevelIndex < LEVELS.length - 1) {
    gameState = 'complete';
  } else {
    gameState = 'complete';
  }
}

function startGame() {
  initAudio();
  resumeAudio();
  currentLevelIndex = 0;
  stats = { time: 0, timesSpotted: 0, luresUsed: 0 };
  initLevel(0);
  gameState = 'play';
}

function retryLevel() {
  stats = { time: 0, timesSpotted: 0, luresUsed: 0 };
  initLevel(currentLevelIndex);
  gameState = 'play';
}

function nextLevel() {
  currentLevelIndex++;
  if (currentLevelIndex >= LEVELS.length) {
    currentLevelIndex = 0;
  }
  stats = { time: 0, timesSpotted: 0, luresUsed: 0 };
  initLevel(currentLevelIndex);
  gameState = 'play';
}

function handleScreenClick(mouseX, mouseY) {
  const action = renderer.checkButtonClick(gameState, mouseX, mouseY);
  if (action === 'start') {
    startGame();
  } else if (action === 'resume') {
    gameState = 'play';
  } else if (action === 'continue') {
    nextLevel();
  } else if (action === 'retry') {
    retryLevel();
  }
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  handleScreenClick(mouseX, mouseY);
});

function setupShotHooks() {
  parseURLParams();

  if (shotMode === 'start') {
    gameState = 'start';
    return true;
  }

  if (shotMode && gameState === 'start') {
    startGame();
  }

  return false;
}

function updateShotHooks() {
  if (!shotMode || shotSettled) return;

  shotFrameCount++;

  const settleFrames = CONFIG.screenshot.settleFrames;

  if (shotFrameCount < settleFrames) return;

  if (shotMode === 'play') {
    for (const guard of guards) {
      guard.alert = 0;
      guard.state = 'patrol';
    }
    shotSettled = true;
  } else if (shotMode === 'lure') {
    const lureX = player.x + 140;
    const lureY = player.y + 60;
    noiseEvents.push({
      x: lureX,
      y: lureY,
      radius: CONFIG.player.sprintNoiseRadius * 1.8,
      type: 'lure'
    });
    if (guards.length > 0) {
      guards[0].state = 'search';
      guards[0].alert = 0.6;
      guards[0].lastKnownPlayerX = lureX;
      guards[0].lastKnownPlayerY = lureY;
      guards[0].searchTimer = CONFIG.guard.searchTime;
    }
    shotSettled = true;
  } else if (shotMode === 'end') {
    gameState = 'complete';
    shotSettled = true;
  }
}

function gameLoop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  handleInput();

  if (gameState === 'play') {
    stats.time += dt;

    player.update(dt, world, guards, noiseEvents);

    updatePlayerLightFactor();

    for (const guard of guards) {
      guard.update(dt, player, world, noiseEvents);
    }

    if (noiseEvents.length > 20) {
      noiseEvents = noiseEvents.slice(-20);
    }

    checkDetection();
    checkLedgerPickup();
    checkExit();

    updateToast(dt);
  }

  const levelData = LEVELS[currentLevelIndex];
  renderer.render(world, player, guards, ledger, exit, gameState, levelData, stats, toast);

  updateShotHooks();

  requestAnimationFrame(gameLoop);
}

function init() {
  renderer.resize();
  setupShotHooks();
  requestAnimationFrame(gameLoop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}