// Nocturne Ledger — game loop, level flow, start/complete screens, screenshot hooks.
import { VIEW_W, VIEW_H, LEVEL_COUNT, SHOT_FRAME_MS } from './config.js';
import { LEVELS } from './levels.js';
import { makeRng } from './random.js';
import { buildWorld, isWall } from './world.js';
import { makeGuards, updateGuards } from './guards.js';
import { makePlayer, updatePlayer, throwLure } from './player.js';
import { shadowFactor } from './vision.js';
import { render } from './render.js';
import { initAudio, sfx } from './audio.js';
import { Input } from './input.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input();

const game = {
  state: 'menu', levelIndex: 0, world: null, player: null, guards: [],
  noises: [], lureMarks: [], levelName: '', alertMax: 0,
  stats: { time: 0, spotted: 0, luresThrown: 0 }, rng: makeRng(1),
  shotMode: null, shotClock: 0,
};

function startLevel(i) {
  game.levelIndex = i;
  const def = LEVELS[i];
  game.world = buildWorld(def);
  game.player = makePlayer(game.world);
  game.guards = makeGuards(game.world, def);
  game.noises = []; game.lureMarks = [];
  game.levelName = def.name;
  game.alertMax = 0;
  game.state = 'play';
  showScreen(null);
  setIntro(def.intro);
}
function setIntro(text) {
  let el = document.getElementById('introBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'introBanner';
    el.style.cssText = 'position:absolute;top:14px;left:50%;transform:translateX(-50%);background:#16283fdd;border:1px solid #3c6ca8;padding:8px 18px;border-radius:6px;font-size:14px;color:#cfe0ff';
    document.getElementById('ui').appendChild(el);
  }
  el.textContent = text;
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 1s'; }, 4200);
  setTimeout(() => { el.remove(); }, 5400);
}
function showScreen(id) {
  for (const s of ['startScreen', 'endScreen']) {
    const el = document.getElementById(s);
    el.classList.toggle('hidden', s !== id);
  }
}
function endLevel(won) {
  game.state = won ? 'complete' : 'caught';
  const last = game.levelIndex + 1 >= LEVEL_COUNT;
  document.getElementById('endTitle').textContent = won ? (last ? 'THE NIGHT ENDS' : 'FLOOR CLEARED') : 'CAUGHT IN THE LIGHT';
  document.getElementById('endSub').textContent = won ? game.levelName : 'A sentry grabbed Wren on floor ' + (game.levelIndex + 1);
  document.getElementById('endStats').innerHTML =
    'Time on floor: ' + game.stats.time.toFixed(1) + 's<br>Times spotted: ' + game.stats.spotted +
    '<br>Lures thrown: ' + game.stats.luresThrown;
  document.getElementById('endBtn').textContent = won ? (last ? 'PLAY AGAIN' : 'NEXT FLOOR') : 'RETRY FLOOR';
  document.getElementById('endBtn').onclick = () => {
    if (won && !last) startLevel(game.levelIndex + 1);
    else if (won) { game.stats = { time: 0, spotted: 0, luresThrown: 0 }; startLevel(0); }
    else startLevel(game.levelIndex);
  };
  showScreen('endScreen');
  (won ? sfx.escape : sfx.caught)();
}

document.getElementById('startBtn').onclick = () => { initAudio(); game.stats = { time: 0, spotted: 0, luresThrown: 0 }; startLevel(0); };
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && (game.state === 'play' || game.state === 'paused')) {
    game.state = game.state === 'play' ? 'paused' : 'play';
  }
  if (e.code === 'KeyC' || e.code === 'ShiftLeft') game.player && (game.player.crouch = e.type === 'keydown');
});
window.addEventListener('keyup', (e) => { if (e.code === 'KeyC' || e.code === 'ShiftLeft') game.player && (game.player.crouch = false); });
canvas.addEventListener('mousedown', () => {
  if (game.state !== 'play' || !game.player) return;
  const wx = game.player.x + (input.mouse.x - VIEW_W / 2);
  const wy = game.player.y + (input.mouse.y - VIEW_H / 2);
  const mark = throwLure(game.player, wx, wy, game.noises);
  if (mark) { game.lureMarks.push(mark); game.stats.luresThrown++; sfx.lure(); }
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (game.state === 'play' && game.world) {
    game.stats.time += dt;
    const moving = updatePlayer(game.world, game.player, input, dt, now);
    if (moving && game.player.noiseLevel > 0.15) game.noises.push({ x: game.player.x, y: game.player.y, radius: game.player.lureRadius, born: now, kind: 'step' });
    updateGuards(game.world, game.guards, dt, game.player, game.noises, now);
    game.noises = game.noises.filter((n) => now - n.born < 800);
    game.alertMax = Math.max(...game.guards.map((g) => g.alert));
    const wasCalm = game.guards.every((g) => g.state !== 'chase');
    if (game.guards.some((g) => g.caught)) { game.stats.spotted++; sfx.caught(); endLevel(false); }
    if (game.guards.some((g) => g.state === 'chase') && wasCalm) sfx.spotted();
    if (game.world.ledger && !game.player.hasLedger && Math.hypot(game.world.ledger.x - game.player.x, game.world.ledger.y - game.player.y) < 22) {
      game.player.hasLedger = true; sfx.pickup();
    }
    if (game.player.hasLedger && Math.hypot(game.world.exit.x - game.player.x, game.world.exit.y - game.player.y) < 26) {
      sfx.escape(); endLevel(true);
    }
  }
  if (game.world) render(ctx, game.world, game, now);
  else {
    ctx.fillStyle = '#07090f'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  shotTick(now);
  requestAnimationFrame(frame);
}
// Screenshot hooks for the maker: ?shot=start|play|alert|lure|end&seed=N drives the game
// to a representative state and tags the canvas so the shot script can crop it.
function shotTick(now) {
  const params = new URLSearchParams(location.search);
  const mode = params.get('shot');
  if (!mode) return;
  if (params.get('seed')) game.rng = makeRng(Number(params.get('seed')) || 1);
  if (mode === 'start') { if (game.state === 'menu' && !game._shotBooted) { game._shotBooted = true; document.getElementById('startBtn').click(); game.state = 'menu'; document.getElementById('startScreen').classList.remove('hidden'); document.getElementById('endScreen').classList.add('hidden'); } return; }
  if (game.state === 'menu') document.getElementById('startBtn').click();
  if (game._shotDone) return;
  if (mode === 'end') { game._shotDone = true; endLevel(true); return; }
  if (now - game.shotClock < SHOT_FRAME_MS) return;
  game.shotClock = now;
  if (mode === 'play') { game._shotDone = true; game.guards.forEach((g) => { g.alert = 0; g.state = 'patrol'; }); return; }
  if (mode === 'alert') { game._shotDone = true; game.guards.forEach((g, i) => { if (i === 0) { g.state = 'chase'; g.alert = 1; } }); return; }
  if (mode === 'lure') { game._shotDone = true; game.lureMarks.push({ x: game.player.x + 140, y: game.player.y + 60 }); game.noises.push({ x: game.player.x + 140, y: game.player.y + 60, radius: 300, born: now, kind: 'lure' }); game.guards.forEach((g, i) => { if (i === 0) { g.state = 'search'; g.alert = 0.6; g.suspect = { x: game.player.x + 140, y: game.player.y + 60 }; } }); return; }
  if (mode === 'end') { game._shotDone = true; endLevel(true); }
}
requestAnimationFrame(frame);