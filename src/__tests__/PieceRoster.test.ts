import { describe, expect, it } from 'vitest';
import { STANDARD_PIECES } from '@/engine/Piece';

describe('meteor fragment roster', () => {
  it('mixes fragment sizes instead of relying on only 4-cell pieces', () => {
    const occupiedCounts = STANDARD_PIECES.map((definition) => (
      definition.matrices[0].flat().filter((cell) => cell === 1).length
    ));

    expect(occupiedCounts.some((count) => count === 3)).toBe(true);
    expect(occupiedCounts.some((count) => count === 4)).toBe(true);
    expect(occupiedCounts.some((count) => count === 5)).toBe(true);
  });
});
