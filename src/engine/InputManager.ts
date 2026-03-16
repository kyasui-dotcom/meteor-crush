import { DAS_DELAY, DAS_REPEAT_RATE } from '@/lib/constants';
import { InputAction } from './types';

interface KeyState {
  pressed: boolean;
  justPressed: boolean;
  heldTime: number;
  dasActive: boolean;
  dasTimer: number;
}

const DEFAULT_KEY_MAP: Record<string, InputAction> = {
  'ArrowLeft': 'left',
  'ArrowRight': 'right',
  'ArrowDown': 'down',
  'ArrowUp': 'rotateCW',
  'KeyA': 'left',
  'KeyD': 'right',
  'KeyS': 'down',
  'KeyW': 'rotateCW',
  'KeyZ': 'rotateCCW',
  'Space': 'hardDrop',
  'ShiftLeft': 'hold',
  'ShiftRight': 'hold',
  'KeyC': 'hold',
  'Escape': 'pause',
  'KeyP': 'pause',
};

export class InputManager {
  private keyStates: Map<InputAction, KeyState> = new Map();
  private keyMap: Record<string, InputAction>;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.keyMap = { ...DEFAULT_KEY_MAP };

    const actions: InputAction[] = ['left', 'right', 'down', 'rotateCW', 'rotateCCW', 'hardDrop', 'hold', 'pause'];
    for (const action of actions) {
      this.keyStates.set(action, {
        pressed: false,
        justPressed: false,
        heldTime: 0,
        dasActive: false,
        dasTimer: 0,
      });
    }

    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
  }

  bind(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
  }

  unbind(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
  }

  private onKeyDown(e: KeyboardEvent): void {
    const action = this.keyMap[e.code];
    if (!action) return;
    e.preventDefault();

    const state = this.keyStates.get(action)!;
    if (!state.pressed) {
      state.justPressed = true;
    }
    state.pressed = true;
  }

  private onKeyUp(e: KeyboardEvent): void {
    const action = this.keyMap[e.code];
    if (!action) return;

    const state = this.keyStates.get(action)!;
    state.pressed = false;
    state.justPressed = false;
    state.heldTime = 0;
    state.dasActive = false;
    state.dasTimer = 0;
  }

  // Call once per frame
  update(deltaTime: number): void {
    for (const [, state] of this.keyStates) {
      if (state.pressed) {
        state.heldTime += deltaTime;
      }
    }
  }

  isJustPressed(action: InputAction): boolean {
    const state = this.keyStates.get(action);
    if (!state) return false;
    if (state.justPressed) {
      state.justPressed = false;
      return true;
    }
    return false;
  }

  // DAS: returns true on initial press and after DAS delay at repeat rate
  isDASActive(action: InputAction, deltaTime: number): boolean {
    const state = this.keyStates.get(action);
    if (!state || !state.pressed) return false;

    if (state.justPressed) {
      state.justPressed = false;
      state.dasTimer = 0;
      state.dasActive = false;
      return true;
    }

    if (state.heldTime >= DAS_DELAY) {
      state.dasTimer += deltaTime;
      if (!state.dasActive || state.dasTimer >= DAS_REPEAT_RATE) {
        state.dasTimer = 0;
        state.dasActive = true;
        return true;
      }
    }

    return false;
  }

  isPressed(action: InputAction): boolean {
    return this.keyStates.get(action)?.pressed ?? false;
  }

  /** Inject a one-shot action (used by TouchManager) */
  injectAction(action: InputAction): void {
    const state = this.keyStates.get(action);
    if (state) {
      state.justPressed = true;
    }
  }

  resetAll(): void {
    for (const [, state] of this.keyStates) {
      state.pressed = false;
      state.justPressed = false;
      state.heldTime = 0;
      state.dasActive = false;
      state.dasTimer = 0;
    }
  }
}
