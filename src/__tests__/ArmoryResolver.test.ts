import { describe, expect, it } from 'vitest';
import { ArmoryResolver } from '@/engine/ArmoryResolver';
import { Board } from '@/engine/Board';
import { WeaponId } from '@/engine/types';

const WEAPON_COLORS: Record<WeaponId, number> = {
  missile: 11,
  bomb: 12,
  tub: 13,
  pan: 14,
  katana: 18,
  sword: 19,
  spear: 20,
};

function seedRecipe(board: Board, weaponId: WeaponId, originX: number, originY: number): void {
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      board.setCell(originX + col, originY + row, {
        type: 'block',
        color: WEAPON_COLORS[weaponId],
        weaponId,
        fragmentIndex: row * 2 + col,
      });
    }
  }
}

describe('ArmoryResolver', () => {
  it('requires a full 2x2 weapon plate to fire a weapon', () => {
    const board = new Board();
    seedRecipe(board, 'bomb', 2, 10);
    board.setCell(3, 11, { type: 'empty', color: -1 });

    const result = ArmoryResolver.resolve(board);

    expect(result.weapons).toHaveLength(0);
    expect(board.getCell(2, 10).type).toBe('block');
  });

  it('does not count junk blocks toward a weapon plate', () => {
    const board = new Board();
    seedRecipe(board, 'bomb', 2, 10);
    board.setCell(3, 11, { type: 'block', color: 6 });

    const result = ArmoryResolver.resolve(board);

    expect(result.weapons).toHaveLength(0);
    expect(board.getCell(2, 10).type).toBe('block');
    expect(board.getCell(3, 11).type).toBe('block');
  });

  it('upgrades a horizontal six-cell weapon slab into one overdrive attack', () => {
    const board = new Board();
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        board.setCell(3 + col, 10 + row, {
          type: 'block',
          color: WEAPON_COLORS.bomb,
          weaponId: 'bomb',
          fragmentIndex: row * 3 + col,
        });
      }
    }
    board.setCell(1, 8, { type: 'block', color: 0 });
    board.setCell(7, 14, { type: 'block', color: 1 });
    board.setCell(0, 8, { type: 'block', color: 2 });

    const result = ArmoryResolver.resolve(board);

    expect(result.weapons).toHaveLength(1);
    expect(result.weapons[0].weaponId).toBe('bomb');
    expect(result.weapons[0].power).toBe(2);
    expect(result.weapons[0].matchedCells).toHaveLength(6);
    expect(result.weapons[0].activationText).toBe('BOMB OVERDRIVE');
    expect(board.getCell(1, 8).type).toBe('empty');
    expect(board.getCell(7, 14).type).toBe('empty');
    expect(board.getCell(0, 8).type).toBe('block');
  });

  it('upgrades a vertical six-cell weapon slab into one overdrive attack', () => {
    const board = new Board();
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        board.setCell(5 + col, 10 + row, {
          type: 'block',
          color: WEAPON_COLORS.sword,
          weaponId: 'sword',
          fragmentIndex: row * 2 + col,
        });
      }
    }
    board.setCell(4, 1, { type: 'block', color: 0 });
    board.setCell(7, 20, { type: 'block', color: 1 });
    board.setCell(3, 20, { type: 'block', color: 2 });

    const result = ArmoryResolver.resolve(board);

    expect(result.weapons).toHaveLength(1);
    expect(result.weapons[0].weaponId).toBe('sword');
    expect(result.weapons[0].power).toBe(2);
    expect(result.weapons[0].matchedCells).toHaveLength(6);
    expect(board.getCell(4, 1).type).toBe('empty');
    expect(board.getCell(7, 20).type).toBe('empty');
    expect(board.getCell(3, 20).type).toBe('block');
  });

  it('chains a weapon from a single weapon cell hit by another weapon attack', () => {
    const board = new Board();
    seedRecipe(board, 'pan', 4, 13);
    board.setCell(1, 12, {
      type: 'block',
      color: WEAPON_COLORS.bomb,
      weaponId: 'bomb',
      fragmentIndex: 0,
    });
    board.setCell(0, 11, { type: 'block', color: 1 });

    const result = ArmoryResolver.resolve(board);

    expect(result.weapons.map((weapon) => weapon.weaponId)).toEqual(['pan', 'bomb']);
    expect(result.weapons[1].matchedCells).toEqual([{ x: 1, y: 12 }]);
    expect(result.weapons[1].power).toBe(1);
    expect(board.getCell(1, 12).type).toBe('empty');
    expect(board.getCell(0, 11).type).toBe('empty');
  });

  it('fires a bomb recipe and destroys a wider nearby area', () => {
    const board = new Board();
    seedRecipe(board, 'bomb', 3, 11);
    board.setCell(2, 10, { type: 'block', color: 0 });
    board.setCell(6, 14, { type: 'block', color: 1 });
    board.setCell(1, 9, { type: 'block', color: 2 });

    const result = ArmoryResolver.resolve(board);

    expect(result.weapons).toHaveLength(1);
    expect(result.weapons[0].weaponId).toBe('bomb');
    expect(result.destroyedCells).toEqual(
      expect.arrayContaining([{ x: 2, y: 10 }, { x: 6, y: 14 }]),
    );
    expect(board.getCell(2, 10).type).toBe('empty');
    expect(board.getCell(6, 14).type).toBe('empty');
    expect(board.getCell(1, 9).type).toBe('block');
    expect(board.getCell(4, 11).type).toBe('empty');
  });

  it('fires a missile through a three-column barrage above the completed plate', () => {
    const board = new Board();
    seedRecipe(board, 'missile', 4, 12);
    board.setCell(3, 6, { type: 'block', color: 1 });
    board.setCell(4, 6, { type: 'block', color: 2 });
    board.setCell(5, 6, { type: 'block', color: 3 });
    board.setCell(6, 6, { type: 'block', color: 4 });
    board.setCell(2, 6, { type: 'block', color: 5 });

    const result = ArmoryResolver.resolve(board);

    expect(result.weapons).toHaveLength(1);
    expect(result.weapons[0].weaponId).toBe('missile');
    expect(board.getCell(3, 6).type).toBe('empty');
    expect(board.getCell(4, 6).type).toBe('empty');
    expect(board.getCell(5, 6).type).toBe('empty');
    expect(board.getCell(6, 6).type).toBe('block');
    expect(board.getCell(2, 6).type).toBe('block');
  });

  it('fires a sword through a two-column full-height cleave', () => {
    const board = new Board();
    seedRecipe(board, 'sword', 5, 10);
    board.setCell(4, 1, { type: 'block', color: 2 });
    board.setCell(5, 8, { type: 'block', color: 3 });
    board.setCell(6, 20, { type: 'block', color: 4 });
    board.setCell(3, 8, { type: 'block', color: 5 });

    const result = ArmoryResolver.resolve(board);

    expect(result.weapons).toHaveLength(1);
    expect(result.weapons[0].weaponId).toBe('sword');
    expect(board.getCell(4, 1).type).toBe('block');
    expect(board.getCell(5, 8).type).toBe('empty');
    expect(board.getCell(6, 20).type).toBe('empty');
    expect(board.getCell(3, 8).type).toBe('block');
  });

  it('fires a spear forward in a two-row lane', () => {
    const board = new Board();
    seedRecipe(board, 'spear', 3, 12);
    board.setCell(8, 11, { type: 'block', color: 1 });
    board.setCell(8, 12, { type: 'block', color: 2 });
    board.setCell(8, 13, { type: 'block', color: 3 });
    board.setCell(8, 14, { type: 'block', color: 4 });
    board.setCell(2, 12, { type: 'block', color: 4 });

    const result = ArmoryResolver.resolve(board);

    expect(result.weapons).toHaveLength(1);
    expect(result.weapons[0].weaponId).toBe('spear');
    expect(board.getCell(8, 11).type).toBe('block');
    expect(board.getCell(8, 12).type).toBe('empty');
    expect(board.getCell(8, 13).type).toBe('empty');
    expect(board.getCell(8, 14).type).toBe('block');
    expect(board.getCell(2, 12).type).toBe('block');
  });
});
