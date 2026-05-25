import { afterEach, describe, expect, it, vi } from 'vitest';
import { Board } from '@/engine/Board';
import { PurifyMode } from '@/engine/modes/PurifyMode';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PurifyMode', () => {
  it('uses 3-cell triad shards with both mono-color and mixed-color variants', () => {
    const pieceSet = new PurifyMode().getPieceSet();
    const distinctColorCounts = pieceSet.map((definition) => {
      const colors = definition.cellColors?.[0]
        .flat()
        .filter((color): color is number => typeof color === 'number' && color >= 0) ?? [];
      return new Set(colors).size;
    });

    expect(pieceSet).toHaveLength(16);
    expect(pieceSet.every((definition) => (
      definition.matrices[0].flat().filter((cell) => cell === 1).length === 3
    ))).toBe(true);
    expect(distinctColorCounts.some((count) => count === 1)).toBe(true);
    expect(distinctColorCounts.some((count) => count === 2)).toBe(true);
  });

  it('can spawn a rescue colony when the stack gets dangerous', () => {
    const mode = new PurifyMode();
    const board = new Board();
    mode.initializeBoard(board, 1);

    for (let x = 0; x < board.width; x += 2) {
      board.setCell(x, 4, { type: 'block', color: 1 });
    }

    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

    for (let i = 0; i < 5; i++) {
      expect(mode.getSpawnOverride?.(board, 1, 0) ?? null).toBeNull();
    }

    const override = mode.getSpawnOverride?.(board, 1, 0) ?? null;
    expect(override?.special).toBe('rescueColony');
    expect(randomSpy).toHaveBeenCalled();
  });
});
