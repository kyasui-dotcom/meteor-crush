import { describe, expect, it } from 'vitest';
import { Board } from '@/engine/Board';
import { CoreMatchResolver } from '@/engine/CoreMatchResolver';

describe('CoreMatchResolver', () => {
  it('clears a same-color cluster of five or more when it contains a core', () => {
    const board = new Board();
    board.setCell(2, 10, { type: 'block', color: 0 });
    board.setCell(3, 10, { type: 'block', color: 0 });
    board.setCell(4, 10, { type: 'block', color: 0 });
    board.setCell(3, 11, { type: 'block', color: 0, core: true });
    board.setCell(3, 12, { type: 'block', color: 0 });

    const result = CoreMatchResolver.resolve(board);

    expect(result.clearedCells).toHaveLength(5);
    expect(result.clearedCoreCount).toBe(1);
    expect(board.getCell(3, 11).type).toBe('empty');
  });

  it('does not clear smaller clusters even when a core is present', () => {
    const board = new Board();
    board.setCell(4, 12, { type: 'block', color: 1 });
    board.setCell(5, 12, { type: 'block', color: 1 });
    board.setCell(5, 13, { type: 'block', color: 1, core: true });
    board.setCell(6, 13, { type: 'block', color: 1 });

    const result = CoreMatchResolver.resolve(board);

    expect(result.clearedCells).toHaveLength(0);
    expect(result.clearedCoreCount).toBe(0);
    expect(board.getCell(5, 13).core).toBe(true);
  });

  it('does not clear large clusters unless they absorb a core', () => {
    const board = new Board();
    board.setCell(1, 8, { type: 'block', color: 2 });
    board.setCell(2, 8, { type: 'block', color: 2 });
    board.setCell(3, 8, { type: 'block', color: 2 });
    board.setCell(2, 9, { type: 'block', color: 2 });
    board.setCell(2, 10, { type: 'block', color: 2 });

    const result = CoreMatchResolver.resolve(board);

    expect(result.clearedCells).toHaveLength(0);
    expect(result.clearedCoreCount).toBe(0);
    expect(board.getCell(2, 9).type).toBe('block');
  });

  it('clears a same-color horizontal line of four even without a core', () => {
    const board = new Board();
    board.setCell(2, 12, { type: 'block', color: 1 });
    board.setCell(3, 12, { type: 'block', color: 1 });
    board.setCell(4, 12, { type: 'block', color: 1 });
    board.setCell(5, 12, { type: 'block', color: 1 });
    board.setCell(6, 12, { type: 'block', color: 2 });

    const result = CoreMatchResolver.resolve(board);

    expect(result.clearedCells).toEqual(
      expect.arrayContaining([{ x: 2, y: 12 }, { x: 3, y: 12 }, { x: 4, y: 12 }, { x: 5, y: 12 }]),
    );
    expect(result.clearedCoreCount).toBe(0);
    expect(board.getCell(2, 12).type).toBe('empty');
    expect(board.getCell(6, 12).type).toBe('block');
  });

  it('clears a same-color vertical line of four without clearing cores by line rule', () => {
    const board = new Board();
    board.setCell(7, 9, { type: 'block', color: 4 });
    board.setCell(7, 10, { type: 'block', color: 4 });
    board.setCell(7, 11, { type: 'block', color: 4 });
    board.setCell(7, 12, { type: 'block', color: 4 });
    board.setCell(9, 10, { type: 'block', color: 4, core: true });
    board.setCell(9, 11, { type: 'block', color: 4 });
    board.setCell(9, 12, { type: 'block', color: 4 });
    board.setCell(9, 13, { type: 'block', color: 4 });

    const result = CoreMatchResolver.resolve(board);

    expect(result.clearedCells).toEqual(
      expect.arrayContaining([{ x: 7, y: 9 }, { x: 7, y: 10 }, { x: 7, y: 11 }, { x: 7, y: 12 }]),
    );
    expect(result.clearedCells).not.toEqual(expect.arrayContaining([{ x: 9, y: 10 }]));
    expect(board.getCell(9, 10).core).toBe(true);
    expect(result.clearedCoreCount).toBe(0);
  });

  it('keeps core cells fixed when gravity is applied', () => {
    const board = new Board();
    board.setCell(2, 15, { type: 'block', color: 2, core: true });
    board.setCell(2, 10, { type: 'block', color: 2 });

    board.applyGravity();

    expect(board.getCell(2, 15).core).toBe(true);
    expect(board.getCell(2, 14).type).toBe('block');
  });
});
