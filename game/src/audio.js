// Procedural WebAudio: footsteps, alerts, the lure clink and a low night drone.
let ctx = null, drone = null;
export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext ?? window.webkitAudioContext)();
  const master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
  drone = { master, osc: ctx.createOscillator(), g: ctx.createGain() };
  drone.osc.type = 'sine'; drone.osc.frequency.value = 55;
  drone.g.gain.value = 0.06; drone.osc.connect(drone.g); drone.g.connect(master);
  drone.osc.start();
}
export function blip(freq, dur = 0.12, type = 'square', vol = 0.25) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g); g.connect(drone.master);
  o.start(); o.stop(ctx.currentTime + dur);
}
export const sfx = {
  step: () => blip(140 + Math.random() * 40, 0.06, 'triangle', 0.12),
  spotted: () => { blip(660, 0.14, 'sawtooth', 0.3); setTimeout(() => blip(880, 0.18, 'sawtooth', 0.3), 120); },
  lost: () => blip(330, 0.2, 'sine', 0.2),
  lure: () => blip(1200, 0.09, 'square', 0.2),
  pickup: () => { blip(520, 0.1, 'square', 0.25); setTimeout(() => blip(780, 0.14, 'square', 0.25), 90); },
  escape: () => { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.25), i * 110)); },
  caught: () => { blip(200, 0.3, 'sawtooth', 0.3); setTimeout(() => blip(140, 0.4, 'sawtooth', 0.3), 200); },
};