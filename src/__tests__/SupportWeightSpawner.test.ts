import { afterEach, describe, expect, it, vi } from 'vitest';
import { Board } from '@/engine/Board';
import { SupportWeightSpawner } from '@/engine/modes/SupportWeightSpawner';

describe('SupportWeightSpawner', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not spawn a support weight on an easy empty board', () => {
    const board = new Board();
    const spawner = new SupportWeightSpawner();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    for (let i = 0; i < 16; i++) {
      expect(spawner.getSpawnOverride(board, 0)).toBeNull();
    }
  });

  it('can spawn a support weight once the stack gets tall enough', () => {
    const board = new Board();
    const spawner = new SupportWeightSpawner();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    for (let y = 12; y < board.height; y++) {
      board.setCell(2, y, { type: 'block', color: 0 });
      board.setCell(3, y, { type: 'block', color: 1 });
      if (y !== 16 && y !== 18) {
        board.setCell(4, y, { type: 'block', color: 2 });
      }
    }

    for (let i = 0; i < 5; i++) {
      expect(spawner.getSpawnOverride(board, 0)).toBeNull();
    }

    const override = spawner.getSpawnOverride(board, 0);
    expect(override?.special).toBe('supportWeight');
    expect(override?.name).toBe('Anchor');
  });
});
