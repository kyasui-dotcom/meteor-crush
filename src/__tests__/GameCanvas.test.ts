// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createGameSnapshot } from '@/components/game/GameCanvas';
import { GameEngine } from '@/engine/GameEngine';
import { ArmoryMode } from '@/engine/modes/ArmoryMode';
import { BomberMode } from '@/engine/modes/BomberMode';

describe('createGameSnapshot', () => {
  it('reports bomber mode from the engine state', () => {
    const engine = new GameEngine();
    engine.start(new BomberMode());

    const snapshot = createGameSnapshot(engine);

    expect(snapshot.mode).toBe('bomber');
    expect(snapshot.lines).toBe(engine.totalLinesCleared);
  });

  it('reports armory mode from the engine state', () => {
    const engine = new GameEngine();
    engine.start(new ArmoryMode());

    const snapshot = createGameSnapshot(engine);

    expect(snapshot.mode).toBe('armory');
    expect(snapshot.lines).toBe(engine.getArmoryWeaponCount());
  });
});
