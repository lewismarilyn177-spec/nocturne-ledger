// Keyboard + mouse input, one flat map the game loop reads.
export class Input {
  constructor() {
    this.keys = new Set();
    this.mouse = { x: 480, y: 300 };
    window.addEventListener('keydown', (e) => { this.keys.add(e.code); if (['Space','KeyW','KeyA','KeyS','KeyD'].includes(e.code)) e.preventDefault(); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
  }
  down(code) { return this.keys.has(code); }
}