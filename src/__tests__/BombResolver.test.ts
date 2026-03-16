import { describe, it, expect } from 'vitest';
import { BombResolver } from '@/engine/BombResolver';
import { Board } from '@/engine/Board';
import { BOARD_WIDTH, BOARD_HEIGHT } from '@/lib/constants';

describe('BombResolver', () => {
  describe('findBombsInRows', () => {
    it('finds bombs in specified rows', () => {
      const board = new Board();
      const bottomRow = BOARD_HEIGHT - 1;

      board.setCell(3, bottomRow, { type: 'bomb', color: 8 });
      board.setCell(7, bottomRow, { type: 'bomb', color: 8 });
      board.setCell(5, bottomRow, { type: 'block', color: 0 });

      const bombs = BombResolver.findBombsInRows(board, [bottomRow]);
      expect(bombs.length).toBe(2);
      expect(bombs).toContainEqual({ x: 3, y: bottomRow });
      expect(bombs).toContainEqual({ x: 7, y: bottomRow });
    });

    it('returns empty array when no bombs', () => {
      const board = new Board();
      const row = BOARD_HEIGHT - 1;

      for (let x = 0; x < BOARD_WIDTH; x++) {
        board.setCell(x, row, { type: 'block', color: 0 });
      }

      expect(BombResolver.findBombsInRows(board, [row])).toEqual([]);
    });
  });

  describe('resolve', () => {
    it('explodes a single bomb and destroys surrounding cells', () => {
      const board = new Board();
      const cy = BOARD_HEIGHT - 5;
      const cx = 5;

      // Place bomb and surrounding blocks
      board.setCell(cx, cy, { type: 'bomb', color: 8 });
      board.setCell(cx + 1, cy, { type: 'block', color: 0 });
      board.setCell(cx - 1, cy, { type: 'block', color: 1 });
      board.setCell(cx, cy + 1, { type: 'block', color: 2 });
      board.setCell(cx, cy - 1, { type: 'block', color: 3 });

      const result = BombResolver.resolve(board, [{ x: cx, y: cy }], 2);

      expect(result.destroyedCells.length).toBeGreaterThan(0);
      expect(result.chainBombCount).toBe(1);

      // Surrounding cells should be destroyed
      expect(board.getCell(cx + 1, cy).type).toBe('empty');
      expect(board.getCell(cx - 1, cy).type).toBe('empty');
    });

    it('chain-explodes when bomb hits another bomb', () => {
      const board = new Board();
      const cy = BOARD_HEIGHT - 5;

      // Two bombs within radius of each other (distance 1)
      board.setCell(3, cy, { type: 'bomb', color: 8 });
      board.setCell(4, cy, { type: 'bomb', color: 8 });

      // Place block near second bomb but outside first bomb's radius
      board.setCell(6, cy, { type: 'block', color: 0 });

      const result = BombResolver.resolve(board, [{ x: 3, y: cy }], 2);

      // Both bombs should have exploded
      expect(result.chainBombCount).toBe(2);
      // Block at distance 2 from second bomb should be destroyed
      expect(board.getCell(6, cy).type).toBe('empty');
    });

    it('respects radius - does not destroy cells beyond range', () => {
      const board = new Board();
      const cy = BOARD_HEIGHT - 5;

      board.setCell(5, cy, { type: 'bomb', color: 8 });
      // Place block far away
      board.setCell(0, cy, { type: 'block', color: 0 });

      BombResolver.resolve(board, [{ x: 5, y: cy }], 2);

      // Far away block should NOT be destroyed
      expect(board.getCell(0, cy).type).toBe('block');
    });
  });
});
