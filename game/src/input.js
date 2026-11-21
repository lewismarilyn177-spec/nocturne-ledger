export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => this.keys.clear());
  }

  onKeyDown(e) {
    const code = e.code;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyE', 'KeyG', 'KeyP', 'Escape'].includes(code)) {
      e.preventDefault();
    }
    this.keys.add(code);
  }

  onKeyUp(e) {
    this.keys.delete(e.code);
  }

  onMouseMove(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  }

  onMouseDown(e) {
    if (e.button === 0) this.mouseDown = true;
  }

  onMouseUp(e) {
    if (e.button === 0) this.mouseDown = false;
  }

  isPressed(code) {
    return this.keys.has(code);
  }

  getMovementVector() {
    let x = 0, y = 0;
    if (this.isPressed('KeyW') || this.isPressed('ArrowUp')) y -= 1;
    if (this.isPressed('KeyS') || this.isPressed('ArrowDown')) y += 1;
    if (this.isPressed('KeyA') || this.isPressed('ArrowLeft')) x -= 1;
    if (this.isPressed('KeyD') || this.isPressed('ArrowRight')) x += 1;
    return { x, y };
  }

  isSneaking() {
    return this.isPressed('ShiftLeft') || this.isPressed('ShiftRight');
  }

  isSprinting() {
    return this.isPressed('Space');
  }

  isActionPressed() {
    return this.isPressed('KeyE');
  }

  isLurePressed() {
    return this.isPressed('KeyG');
  }

  isPausePressed() {
    return this.isPressed('KeyP') || this.isPressed('Escape');
  }

  getMousePosition(canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: this.mouseX - rect.left,
      y: this.mouseY - rect.top
    };
  }

  clear() {
    this.keys.clear();
    this.mouseDown = false;
  }
}

export const input = new Input();