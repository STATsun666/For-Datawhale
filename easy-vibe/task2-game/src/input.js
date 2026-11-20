const ACTION_BY_CODE = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'fire',
};

const BLOCKED_CODES = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  constructor() {
    this.state = {
      left: false,
      right: false,
      up: false,
      down: false,
      fire: false,
    };
    this.onConfirm = null;
    this.onPause = null;

    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyP' || event.code === 'Escape') {
        if (!event.repeat && this.onPause) this.onPause();
        return;
      }

      if (event.code === 'Enter') {
        if (!event.repeat && this.onConfirm) this.onConfirm();
        return;
      }

      const action = ACTION_BY_CODE[event.code];
      if (!action) return;
      if (BLOCKED_CODES.has(event.code)) event.preventDefault();
      this.state[action] = true;
    });

    window.addEventListener('keyup', (event) => {
      const action = ACTION_BY_CODE[event.code];
      if (!action) return;
      this.state[action] = false;
    });

    window.addEventListener('blur', () => this.reset());
  }

  reset() {
    this.state.left = false;
    this.state.right = false;
    this.state.up = false;
    this.state.down = false;
    this.state.fire = false;
  }
}
