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
  let manager: TouchManager;
  let element: ReturnType<typeof createMockElement>;

  beforeEach(() => {
    vi.useFakeTimers();
    actions = [];
    manager = new TouchManager((action) => actions.push(action));
    element = createMockElement();
    manager.bind(element);
    manager.updateLayout();
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

  it('dragging no longer triggers soft drop', () => {
    element._trigger('touchstart', createTouchEvent('touchstart', 100, 100));
    element._trigger('touchmove', createTouchEvent('touchmove', 105, 140));
    vi.advanceTimersByTime(50);
    element._trigger('touchend', createTouchEvent('touchend', 105, 140));

    expect(actions).toEqual([]);
  });

  it('upward swipe no longer triggers hard drop', () => {
    element._trigger('touchstart', createTouchEvent('touchstart', 100, 200));
    element._trigger('touchmove', createTouchEvent('touchmove', 100, 100));
    vi.advanceTimersByTime(50);
    element._trigger('touchend', createTouchEvent('touchend', 100, 100));

    expect(actions).toEqual([]);
  });

  it('swipe cancels long press timer', () => {
    element._trigger('touchstart', createTouchEvent('touchstart', 100, 200));

    element._trigger('touchmove', createTouchEvent('touchmove', 100, 100));

    vi.advanceTimersByTime(400);

    expect(actions).not.toContain('hold');
  });

  it('horizontal swipes no longer move the piece to the touched column', () => {
    element._trigger('touchstart', createTouchEvent('touchstart', 110, 200));
    element._trigger('touchmove', createTouchEvent('touchmove', 220, 205));
    vi.advanceTimersByTime(50);
    element._trigger('touchend', createTouchEvent('touchend', 220, 205));

    expect(actions).toEqual([]);
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
