// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputManager } from '@/engine/InputManager';

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager();
  });

  describe('injectAction', () => {
    it('sets justPressed for the given action', () => {
      input.injectAction('rotateCW');
      expect(input.isJustPressed('rotateCW')).toBe(true);
    });

    it('isJustPressed returns false after being consumed', () => {
      input.injectAction('left');
      expect(input.isJustPressed('left')).toBe(true);
      // Second call should return false (consumed)
      expect(input.isJustPressed('left')).toBe(false);
    });

    it('can inject multiple different actions', () => {
      input.injectAction('left');
      input.injectAction('rotateCW');

      expect(input.isJustPressed('left')).toBe(true);
      expect(input.isJustPressed('rotateCW')).toBe(true);
    });

    it('does not crash for unknown actions', () => {
      // injectAction should handle gracefully if action doesn't exist in keyStates
      expect(() => input.injectAction('pause')).not.toThrow();
    });

    it('injected action does not affect isPressed', () => {
      input.injectAction('hardDrop');
      // isPressed should be false (inject only sets justPressed, not pressed)
      expect(input.isPressed('hardDrop')).toBe(false);
    });

    it('resetAll clears injected actions', () => {
      input.injectAction('down');
      input.resetAll();
      expect(input.isJustPressed('down')).toBe(false);
    });
  });

  describe('bind / unbind', () => {
    it('adds keydown and keyup listeners on bind', () => {
      const spy = vi.spyOn(window, 'addEventListener');
      input.bind();
      expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('keyup', expect.any(Function));
      spy.mockRestore();
    });

    it('removes listeners on unbind', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      input.bind();
      input.unbind();
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe('pressAction / releaseAction', () => {
    it('marks an action as pressed until released', () => {
      input.pressAction('down');
      expect(input.isPressed('down')).toBe(true);

      input.releaseAction('down');
      expect(input.isPressed('down')).toBe(false);
    });

    it('sets justPressed when a held action starts', () => {
      input.pressAction('down');
      expect(input.isJustPressed('down')).toBe(true);
      expect(input.isJustPressed('down')).toBe(false);
    });
  });
});
