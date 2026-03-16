import { describe, it, expect, beforeEach } from 'vitest';
import { EffectManager } from '@/renderer/EffectManager';

describe('EffectManager', () => {
  let effects: EffectManager;

  beforeEach(() => {
    effects = new EffectManager();
  });

  describe('particles', () => {
    it('starts with no particles', () => {
      expect(effects.particles.length).toBe(0);
      expect(effects.hasActiveEffects).toBe(false);
    });

    it('spawns explosion particles', () => {
      effects.spawnExplosion(100, 100, '#ff0000', 1);
      expect(effects.particles.length).toBeGreaterThan(0);
      expect(effects.hasActiveEffects).toBe(true);
    });

    it('spawns line clear particles', () => {
      effects.spawnLineClear(100, 0, 300, 30);
      expect(effects.particles.length).toBeGreaterThan(0);
    });

    it('particles decay over time', () => {
      effects.spawnExplosion(100, 100, '#ff0000', 1);
      const initialCount = effects.particles.length;

      // Advance time far enough to decay most particles
      effects.update(2000);

      expect(effects.particles.length).toBeLessThan(initialCount);
    });

    it('particles have gravity applied', () => {
      effects.spawnExplosion(100, 100, '#ff0000', 1);
      const initialY = effects.particles[0].y;

      effects.update(100);

      // Particles should have moved (gravity pulls down)
      // vy changes due to gravity, so position changes
      expect(effects.particles[0].y).not.toBe(initialY);
    });
  });

  describe('screen shake', () => {
    it('has no shake by default', () => {
      expect(effects.getShakeOffset()).toEqual({ x: 0, y: 0 });
    });

    it('produces shake offset after addShake', () => {
      effects.addShake(5, 300);
      effects.update(50); // advance a bit

      const offset = effects.getShakeOffset();
      // Shake should produce non-zero offset
      expect(Math.abs(offset.x) + Math.abs(offset.y)).toBeGreaterThan(0);
    });

    it('shake decays over time', () => {
      effects.addShake(5, 100);
      effects.update(50);
      const midShake = effects.getShakeOffset();

      effects.update(60); // past duration
      const endShake = effects.getShakeOffset();

      // After duration, shake should be gone
      expect(endShake).toEqual({ x: 0, y: 0 });
    });

    it('stacks shake intensity', () => {
      effects.addShake(3, 300);
      effects.addShake(5, 300);

      effects.update(10);
      const offset = effects.getShakeOffset();
      // Higher intensity shake should dominate
      expect(Math.abs(offset.x) + Math.abs(offset.y)).toBeGreaterThan(0);
    });
  });

  describe('screen flash', () => {
    it('starts at 0', () => {
      expect(effects.screenFlash).toBe(0);
    });

    it('adds flash duration', () => {
      effects.addFlash(120);
      expect(effects.screenFlash).toBe(120);
      expect(effects.hasActiveEffects).toBe(true);
    });

    it('flash decays over time', () => {
      effects.addFlash(100);
      effects.update(60);
      expect(effects.screenFlash).toBe(40);

      effects.update(50);
      expect(effects.screenFlash).toBe(0);
    });
  });

  describe('row flash', () => {
    it('sets and decays row flash', () => {
      effects.addRowFlash([18, 19]);
      expect(effects.rowFlashRows).toEqual([18, 19]);
      expect(effects.rowFlashTimer).toBe(150);

      effects.update(100);
      expect(effects.rowFlashTimer).toBe(50);

      effects.update(60);
      expect(effects.rowFlashTimer).toBe(0);
      expect(effects.rowFlashRows).toEqual([]);
    });
  });

  describe('reset', () => {
    it('clears all effects', () => {
      effects.spawnExplosion(100, 100, '#ff0000', 1);
      effects.addShake(5, 300);
      effects.addFlash(120);
      effects.addRowFlash([18, 19]);

      effects.reset();

      expect(effects.particles.length).toBe(0);
      expect(effects.getShakeOffset()).toEqual({ x: 0, y: 0 });
      expect(effects.screenFlash).toBe(0);
      expect(effects.rowFlashRows).toEqual([]);
      expect(effects.hasActiveEffects).toBe(false);
    });
  });
});
