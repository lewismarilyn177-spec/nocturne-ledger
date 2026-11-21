// Tunable constants for Nocturne Ledger.
export const TILE = 40;
export const VIEW_W = 960, VIEW_H = 600;
export const COLORS = {
  floorDark: '#0c1018', floorLit: '#26314a', wall: '#3a4666', wallTop: '#4c5c85',
  shadow: 'rgba(2,4,9,0.82)', coneFill: 'rgba(255,196,80,0.16)', coneEdge: 'rgba(255,196,80,0.55)',
  player: '#8fd3ff', playerCrouch: '#6fa7c9', guard: '#e26d5a', guardAlert: '#ff5238', guardSusp: '#f0c96b',
  lure: '#c9f7a0', ledger: '#f4d35e', exit: '#63e6a0', ink: '#060810',
};
export const PLAYER = { walk: 118, sprint: 186, sneak: 62, radius: 9 };
export const GUARD = { patrol: 62, chase: 132, search: 84, fov: 78, range: 235, radius: 10, spotMs: 620, searchMs: 4200 };
export const NOISE = { sprint: 240, walk: 96, sneak: 26, lure: 300, door: 140 };
export const HEARING = { base: 190, sneakMul: 0.35 };
export const LIGHT = { lampRadius: 150, lampFlicker: 12 };
export const LEVEL_COUNT = 3;
export const SHOT_FRAME_MS = 420;