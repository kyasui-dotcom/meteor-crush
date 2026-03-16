import { InputAction } from './types';

const VERTICAL_SWIPE_THRESHOLD = 30; // px for vertical swipe detection
const TAP_MAX_MOVE = 15; // max px movement for a tap
const LONG_PRESS_TIME = 350; // ms for hold gesture
const HARD_DROP_VELOCITY = 0.8; // px/ms upward for hard drop
const HORIZONTAL_DEAD_ZONE = 10; // px before position tracking kicks in

export interface BoardLayout {
  /** Canvas-relative X offset of the board left edge (CSS pixels) */
  offsetX: number;
  /** Cell size in CSS pixels */
  cellSize: number;
}

export class TouchManager {
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private isSwiping = false;
  private swipeDirection: 'horizontal' | 'vertical' | null = null;
  private softDropTriggered = false;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired = false;
  private lastTargetColumn = -1;

  private actionCallback: (action: InputAction) => void;
  private moveToColumnCallback: ((column: number) => void) | null = null;
  private boardLayout: BoardLayout | null = null;
  private canvasElement: HTMLElement | null = null;

  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;

  constructor(
    actionCallback: (action: InputAction) => void,
    moveToColumnCallback?: (column: number) => void,
  ) {
    this.actionCallback = actionCallback;
    this.moveToColumnCallback = moveToColumnCallback || null;
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchMove = this.onTouchMove.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);
  }

  /** Update board layout info (call on resize) */
  updateLayout(layout: BoardLayout): void {
    this.boardLayout = layout;
  }

  bind(element: HTMLElement): void {
    this.canvasElement = element;
    element.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    element.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    element.addEventListener('touchend', this.boundTouchEnd, { passive: false });
  }

  unbind(element: HTMLElement): void {
    this.canvasElement = null;
    element.removeEventListener('touchstart', this.boundTouchStart);
    element.removeEventListener('touchmove', this.boundTouchMove);
    element.removeEventListener('touchend', this.boundTouchEnd);
  }

  /** Convert a clientX position to a board column index */
  private clientXToColumn(clientX: number): number | null {
    if (!this.boardLayout || !this.canvasElement) return null;
    const rect = this.canvasElement.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const col = Math.floor((canvasX - this.boardLayout.offsetX) / this.boardLayout.cellSize);
    return col;
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const touch = e.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.startTime = Date.now();
    this.isSwiping = false;
    this.swipeDirection = null;
    this.softDropTriggered = false;
    this.longPressFired = false;
    this.lastTargetColumn = -1;

    // Immediately move piece to touch position
    if (this.moveToColumnCallback) {
      const col = this.clientXToColumn(touch.clientX);
      if (col !== null) {
        this.lastTargetColumn = col;
        this.moveToColumnCallback(col);
      }
    }

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

    // Determine swipe direction once threshold exceeded
    if (!this.swipeDirection) {
      if (absDy > VERTICAL_SWIPE_THRESHOLD && absDy > absDx) {
        this.isSwiping = true;
        this.swipeDirection = 'vertical';
        this.clearLongPress();
      } else if (absDx > HORIZONTAL_DEAD_ZONE) {
        this.isSwiping = true;
        this.swipeDirection = 'horizontal';
        this.clearLongPress();
      }
    }

    if (this.swipeDirection === 'horizontal') {
      // Position-based: move piece to the column under the finger
      if (this.moveToColumnCallback) {
        const col = this.clientXToColumn(touch.clientX);
        if (col !== null && col !== this.lastTargetColumn) {
          this.lastTargetColumn = col;
          this.moveToColumnCallback(col);
        }
      }
    } else if (this.swipeDirection === 'vertical' && dy > VERTICAL_SWIPE_THRESHOLD) {
      // Downward swipe = soft drop
      if (!this.softDropTriggered) {
        this.softDropTriggered = true;
        this.actionCallback('down');
      }
      if (absDy > VERTICAL_SWIPE_THRESHOLD * 2) {
        this.actionCallback('down');
      }
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

    // Upward swipe → hard drop
    if (this.swipeDirection === 'vertical' && dy < -VERTICAL_SWIPE_THRESHOLD) {
      const velocity = absDy / duration;
      if (velocity > HARD_DROP_VELOCITY || absDy > 80) {
        this.actionCallback('hardDrop');
      }
    }
  }

  private clearLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}
