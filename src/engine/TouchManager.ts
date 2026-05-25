import { InputAction } from './types';

const TAP_MAX_MOVE = 15; // max px movement for a tap
const LONG_PRESS_TIME = 350; // ms for hold gesture

export class TouchManager {
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private isSwiping = false;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired = false;

  private actionCallback: (action: InputAction) => void;

  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;

  constructor(
    actionCallback: (action: InputAction) => void,
    _moveToColumnCallback?: (column: number) => void,
  ) {
    this.actionCallback = actionCallback;
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchMove = this.onTouchMove.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);
  }

  updateLayout(): void {
    // Canvas-position movement is disabled.
  }

  bind(element: HTMLElement): void {
    element.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    element.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    element.addEventListener('touchend', this.boundTouchEnd, { passive: false });
  }

  unbind(element: HTMLElement): void {
    element.removeEventListener('touchstart', this.boundTouchStart);
    element.removeEventListener('touchmove', this.boundTouchMove);
    element.removeEventListener('touchend', this.boundTouchEnd);
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.startTime = Date.now();
    this.isSwiping = false;
    this.longPressFired = false;

    // Start long press detection
    this.longPressTimer = setTimeout(() => {
      if (!this.isSwiping) {
        this.longPressFired = true;
        this.actionCallback('hold');
      }
    }, LONG_PRESS_TIME);
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    const dx = touch.clientX - this.startX;
    const dy = touch.clientY - this.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (!this.isSwiping && (absDx > TAP_MAX_MOVE || absDy > TAP_MAX_MOVE)) {
      this.isSwiping = true;
      this.clearLongPress();
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    this.clearLongPress();

    if (this.longPressFired) return;

    const endTime = Date.now();
    const duration = endTime - this.startTime;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - this.startX;
    const dy = touch.clientY - this.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (!this.isSwiping && absDx < TAP_MAX_MOVE && absDy < TAP_MAX_MOVE) {
      // Tap → rotate CW
      if (duration < LONG_PRESS_TIME) {
        this.actionCallback('rotateCW');
      }
      return;
    }
  }

  private clearLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}
