import { describe, expect, it } from 'vitest';
import { ARMORY_JUNK_PIECES, ARMORY_JUNK_WEIGHT, ARMORY_PIECES, ARMORY_WEAPON_PIECES } from '@/engine/ArmoryData';

describe('ArmoryData', () => {
  it('weights junk pieces heavily in the armory pool', () => {
    const junkEntries = ARMORY_PIECES.filter((piece) => !piece.cellFragments).length;
    const weaponEntries = ARMORY_PIECES.filter((piece) => piece.cellFragments).length;

    expect(weaponEntries).toBe(ARMORY_WEAPON_PIECES.length);
    expect(junkEntries).toBe(ARMORY_JUNK_PIECES.length * ARMORY_JUNK_WEIGHT);
    expect(ARMORY_PIECES).toHaveLength(ARMORY_WEAPON_PIECES.length + ARMORY_JUNK_PIECES.length * ARMORY_JUNK_WEIGHT);
  });
});
