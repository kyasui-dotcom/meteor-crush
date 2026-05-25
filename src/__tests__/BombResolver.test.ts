import { describe, it, expect } from 'vitest';
import { BombResolver } from '@/engine/BombResolver';
import { Board } from '@/engine/Board';
import { BOARD_HEIGHT } from '@/lib/constants';

describe('BombResolver', () => {
  describe('findIgnitedBombs', () => {
    it('finds bombs that are touching fire blocks orthogonally', () => {
      const board = new Board();
      const y = BOARD_HEIGHT - 5;

      board.setCell(4, y, { type: 'bomb', color: 16, bombKind: 'thunder' });
      board.setCell(3, y, { type: 'block', color: 15, fire: true });
      board.setCell(8, y, { type: 'bomb', color: 17, bombKind: 'cluster' });
      board.setCell(9, y + 1, { type: 'block', color: 15, fire: true });

      const ignited = BombResolver.findIgnitedBombs(board);

      expect(ignited).toContainEqual({ x: 4, y });
      expect(ignited).not.toContainEqual({ x: 8, y });
    });

    it('deduplicates a fused 2x2 mega bomb even if multiple cells touch fire', () => {
      const board = new Board();
      const x = 4;
      const y = BOARD_HEIGHT - 8;

      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          board.setCell(x + dx, y + dy, {
            type: 'bomb',
            color: 8,
            bombKind: 'normal',
            megaBomb: true,
            megaBombAnchorX: x,
            megaBombAnchorY: y,
          });
        }
      }
      board.setCell(x - 1, y, { type: 'block', color: 15, fire: true });
      board.setCell(x + 2, y + 1, { type: 'block', color: 15, fire: true });

      const ignited = BombResolver.findIgnitedBombs(board);

      expect(ignited).toHaveLength(1);
      expect(ignited[0]).toEqual({ x, y });
    });
  });

  describe('resolve', () => {
    it('thunder bombs destroy diagonals all the way to the board edge', () => {
      const board = new Board();
      const cx = 5;
      const cy = BOARD_HEIGHT - 12;

      board.setCell(cx, cy, { type: 'bomb', color: 16, bombKind: 'thunder' });
      board.setCell(0, cy - 5, { type: 'block', color: 0 });
      board.setCell(11, cy + 6, { type: 'block', color: 1 });
      board.setCell(cx + 1, cy, { type: 'block', color: 2 });

      const result = BombResolver.resolve(board, [{ x: cx, y: cy }], 2);

      expect(result.chainBombCount).toBe(1);
      expect(board.getCell(0, cy - 5).type).toBe('empty');
      expect(board.getCell(11, cy + 6).type).toBe('empty');
      expect(board.getCell(cx + 1, cy).type).toBe('block');
    });

    it('cluster bombs destroy orthogonal lanes all the way to the board edge', () => {
      const board = new Board();
      const cx = 5;
      const cy = BOARD_HEIGHT - 12;

      board.setCell(cx, cy, { type: 'bomb', color: 17, bombKind: 'cluster' });
      board.setCell(cx, 0, { type: 'block', color: 0 });
      board.setCell(11, cy, { type: 'block', color: 1 });
      board.setCell(cx + 1, cy + 1, { type: 'block', color: 2 });

      BombResolver.resolve(board, [{ x: cx, y: cy }], 2);

      expect(board.getCell(cx, 0).type).toBe('empty');
      expect(board.getCell(11, cy).type).toBe('empty');
      expect(board.getCell(cx + 1, cy + 1).type).toBe('block');
    });

    it('normal bombs keep a local radial burst', () => {
      const board = new Board();
      const cx = 5;
      const cy = BOARD_HEIGHT - 10;

      board.setCell(cx, cy, { type: 'bomb', color: 8, bombKind: 'normal' });
      board.setCell(cx, cy - 2, { type: 'block', color: 0 });
      board.setCell(cx + 1, cy, { type: 'block', color: 1 });
      board.setCell(cx, cy - 3, { type: 'block', color: 2 });

      BombResolver.resolve(board, [{ x: cx, y: cy }], 2);

      expect(board.getCell(cx, cy - 2).type).toBe('empty');
      expect(board.getCell(cx + 1, cy).type).toBe('empty');
      expect(board.getCell(cx, cy - 3).type).toBe('block');
    });

    it('chains when one bomb blast reaches another bomb', () => {
      const board = new Board();
      const cy = BOARD_HEIGHT - 6;

      board.setCell(4, cy, { type: 'bomb', color: 16, bombKind: 'thunder' });
      board.setCell(6, cy + 2, { type: 'bomb', color: 17, bombKind: 'cluster' });
      board.setCell(6, cy, { type: 'block', color: 3 });

      const result = BombResolver.resolve(board, [{ x: 4, y: cy }], 2);

      expect(result.chainBombCount).toBe(2);
      expect(board.getCell(6, cy).type).toBe('empty');
    });

    it('treats a fused 2x2 mega bomb as one larger explosion', () => {
      const board = new Board();
      const x = 4;
      const y = BOARD_HEIGHT - 10;

      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          board.setCell(x + dx, y + dy, {
            type: 'bomb',
            color: 8,
            bombKind: 'normal',
            megaBomb: true,
            megaBombAnchorX: x,
            megaBombAnchorY: y,
          });
        }
      }
      board.setCell(7, y, { type: 'block', color: 0 });

      const result = BombResolver.resolve(board, [{ x, y }], 2);

      expect(result.chainBombCount).toBe(1);
      expect(board.getCell(7, y).type).toBe('empty');
      expect(board.getCell(x, y).type).toBe('empty');
      expect(board.getCell(x + 1, y + 1).type).toBe('empty');
    });
  });
});
