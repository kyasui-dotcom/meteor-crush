import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TouchManager } from '@/engine/TouchManager';
import { InputAction } from '@/engine/types';

// Helper to create mock TouchEvent
function createTouchEvent(
  type: 'touchstart' | 'touchmove' | 'touchend',
  clientX: number,
  clientY: number,
): TouchEvent {
  const touch = { clientX, clientY, identifier: 0 } as Touch;
  return {
    type,
    preventDefault: vi.fn(),
    touches: type === 'touchend' ? [] : [touch],
    changedTouches: [touch],
  } as unknown as TouchEvent;
}

// Helper to create a mock element with getBoundingClientRect
function createMockElement() {
  const listeners: Record<string, EventListener> = {};
  return {
    addEventListener: vi.fn((type: string, handler: EventListener) => {
      listeners[type] = handler;
    }),
    removeEventListener: vi.fn((type: string) => {
      delete listeners[type];
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 600 }),
    _trigger(type: string, event: TouchEvent) {
      listeners[type]?.(event);
    },
    _listeners: listeners,
  } as unknown as HTMLElement & { _trigger: (type: string, event: TouchEvent) => void };
}

describe('TouchManager', () => {
  let actions: InputAction[];
  let moveColumns: number[];
  let manager: TouchManager;
  let element: ReturnType<typeof createMockElement>;

  beforeEach(() => {
    vi.useFakeTimers();
    actions = [];
    moveColumns = [];
    manager = new TouchManager(
      (action) => actions.push(action),
      (col) => moveColumns.push(col),
    );
    element = createMockElement();
    manager.bind(element);
    // Set board layout: board starts at x=50, cell size=30
    manager.updateLayout({ offsetX: 50, cellSize: 30 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('binds touch events on bind()', () => {
    expect(element.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: false });
    expect(element.addEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
    expect(element.addEventListener).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: false });
  });

  it('unbinds touch events on unbind()', () => {
    manager.unbind(element);
    expect(element.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(element.removeEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function));
    expect(element.removeEventListener).toHaveBeenCalledWith('touchend', expect.any(Function));
  });

  it('tap triggers rotateCW', () => {
    element._trigger('touchstart', createTouchEvent('touchstart', 100, 100));

    vi.advanceTimersByTime(50);
    element._trigger('touchend', createTouchEvent('touchend', 102, 101));

    expect(actions).toContain('rotateCW');
  });

  it('tap does not trigger if duration >= LONG_PRESS_TIME', () => {
    element._trigger('touchstart', createTouchEvent('touchstart', 100, 100));

    vi.advanceTimersByTime(350);
    element._trigger('touchend', createTouchEvent('touchend', 102, 101));

    expect(actions).toContain('hold');
    expect(actions).not.toContain('rotateCW');
  });

  it('long press triggers hold', () => {
    element._trigger('touchstart', createTouchEvent('touchstart', 100, 100));

    vi.advanceTimersByTime(400);

    expect(actions).toEqual(['hold']);
  });

  describe('position-based horizontal movement', () => {
    it('moves to column on touchstart', () => {
      // Touch at x=110, board offsetX=50, cellSize=30
      // Column = floor((110 - 50) / 30) = floor(2.0) = 2
      element._trigger('touchstart', createTouchEvent('touchstart', 110, 200));

      expect(moveColumns).toContain(2);
    });

    it('moves to new column on horizontal touchmove', () => {
      element._trigger('touchstart', createTouchEvent('touchstart', 110, 200));
      moveColumns.length = 0; // clear initial move

      // Move horizontally past dead zone (10px) to a new column
      // x=170 → column = floor((170 - 50) / 30) = floor(4.0) = 4
      element._trigger('touchmove', createTouchEvent('touchmove', 170, 200));

      expect(moveColumns).toContain(4);
    });

    it('does not re-emit for same column', () => {
      // Touch at column 2
      element._trigger('touchstart', createTouchEvent('touchstart', 110, 200));
      moveColumns.length = 0;

      // Move slightly within same column (x=115 → still column 2)
      element._trigger('touchmove', createTouchEvent('touchmove', 125, 200));

      // No new column emission since it's the same column
      expect(moveColumns.length).toBe(0);
    });
  });

  it('downward swipe triggers down action', () => {
    element._trigger('touchstart', createTouchEvent('touchstart', 100, 100));

    element._trigger('touchmove', createTouchEvent('touchmove', 105, 140));

    expect(actions).toContain('down');
  });

  it('upward swipe triggers hardDrop', () => {
    element._trigger('touchstart', createTouchEvent('touchstart', 100, 200));

    element._trigger('touchmove', createTouchEvent('touchmove', 100, 100));

    vi.advanceTimersByTime(50);
    element._trigger('touchend', createTouchEvent('touchend', 100, 100));

    expect(actions).toContain('hardDrop');
  });

  it('swipe cancels long press timer', () => {
    element._trigger('touchstart', createTouchEvent('touchstart', 100, 200));

    element._trigger('touchmove', createTouchEvent('touchmove', 100, 100));

    vi.advanceTimersByTime(400);

    expect(actions).not.toContain('hold');
  });

  it('prevents default on all events', () => {
    const startEvent = createTouchEvent('touchstart', 100, 100);
    const moveEvent = createTouchEvent('touchmove', 110, 110);
    const endEvent = createTouchEvent('touchend', 110, 110);

    element._trigger('touchstart', startEvent);
    element._trigger('touchmove', moveEvent);
    vi.advanceTimersByTime(50);
    element._trigger('touchend', endEvent);

    expect(startEvent.preventDefault).toHaveBeenCalled();
    expect(moveEvent.preventDefault).toHaveBeenCalled();
    expect(endEvent.preventDefault).toHaveBeenCalled();
  });
});
