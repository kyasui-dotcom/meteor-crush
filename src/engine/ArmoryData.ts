import { ArmoryFragmentTag, PieceDefinition, WeaponId } from './types';

export interface ArmoryWeaponRecipe {
  id: WeaponId;
  label: string;
  color: number;
  activationText: string;
}

export const ARMORY_WEAPONS: ArmoryWeaponRecipe[] = [
  { id: 'missile', label: 'MISSILE', color: 11, activationText: 'MISSILE FIRE' },
  { id: 'bomb', label: 'BOMB', color: 12, activationText: 'BOMB BURST' },
  { id: 'tub', label: 'TUB', color: 13, activationText: 'TUB DROP' },
  { id: 'pan', label: 'PAN', color: 14, activationText: 'PAN SWEEP' },
  { id: 'katana', label: 'KATANA', color: 18, activationText: 'KATANA SLASH' },
  { id: 'sword', label: 'SWORD', color: 19, activationText: 'SWORD CLEAVE' },
  { id: 'spear', label: 'SPEAR', color: 20, activationText: 'SPEAR THRUST' },
];

const ARMORY_WEAPON_COLOR: Record<WeaponId, number> = Object.fromEntries(
  ARMORY_WEAPONS.map((weapon) => [weapon.id, weapon.color]),
) as Record<WeaponId, number>;

function getPlateTag(weaponId: WeaponId, fragmentIndex: number): ArmoryFragmentTag {
  return { weaponId, fragmentIndex };
}

function getTripletTags(weaponId: WeaponId): [ArmoryFragmentTag, ArmoryFragmentTag, ArmoryFragmentTag] {
  return [
    getPlateTag(weaponId, 0),
    getPlateTag(weaponId, 1),
    getPlateTag(weaponId, 2),
  ];
}

function cloneMatrix<T>(matrix: (T | null)[][]): (T | null)[][] {
  return matrix.map((row) => [...row]);
}

function rotateSquareMatrix<T>(matrix: (T | null)[][]): (T | null)[][] {
  const size = matrix.length;
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => matrix[size - 1 - col]?.[row] ?? null),
  );
}

function createSquareRotations<T>(base: (T | null)[][]): (T | null)[][][] {
  const rotations = [cloneMatrix(base)];
  while (rotations.length < 4) {
    rotations.push(rotateSquareMatrix(rotations[rotations.length - 1]));
  }
  return rotations;
}

function createSquareNumberRotations(base: number[][]): number[][][] {
  const clone = (matrix: number[][]) => matrix.map((row) => [...row]);
  const rotate = (matrix: number[][]): number[][] => {
    const size = matrix.length;
    return Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => matrix[size - 1 - col]?.[row] ?? 0),
    );
  };

  const rotations = [clone(base)];
  while (rotations.length < 4) {
    rotations.push(rotate(rotations[rotations.length - 1]));
  }
  return rotations;
}

function createColorGrid(tags: (ArmoryFragmentTag | null)[][]): number[][] {
  return tags.map((row) => row.map((tag) => (tag ? ARMORY_WEAPON_COLOR[tag.weaponId] : -1)));
}

function createColorRotations(tagRotations: (ArmoryFragmentTag | null)[][][]): number[][][] {
  return tagRotations.map((rotation) => createColorGrid(rotation));
}

function cloneNumberRotations(rotations: number[][][]): number[][][] {
  return rotations.map((matrix) => matrix.map((row) => [...row]));
}

function createLinePiece(
  name: string,
  tags: [ArmoryFragmentTag, ArmoryFragmentTag, ArmoryFragmentTag],
): PieceDefinition {
  const matrices = [
    [[1, 1, 1]],
    [[1], [1], [1]],
    [[1, 1, 1]],
    [[1], [1], [1]],
  ];
  const cellFragments = [
    [[tags[0], tags[1], tags[2]]],
    [[tags[0]], [tags[1]], [tags[2]]],
    [[tags[0], tags[1], tags[2]]],
    [[tags[0]], [tags[1]], [tags[2]]],
  ];

  return {
    name,
    color: ARMORY_WEAPON_COLOR[tags[0].weaponId],
    isComet: false,
    matrices: matrices.map((matrix) => matrix.map((row) => [...row])),
    cellFragments,
    cellColors: createColorRotations(cellFragments),
  };
}

function createLPiece(
  name: string,
  tags: [ArmoryFragmentTag, ArmoryFragmentTag, ArmoryFragmentTag],
): PieceDefinition {
  const baseMatrix = [
    [1, 1],
    [0, 1],
  ];
  const baseTags: (ArmoryFragmentTag | null)[][] = [
    [tags[0], tags[1]],
    [null, tags[2]],
  ];
  const cellFragments = createSquareRotations(baseTags);

  return {
    name,
    color: ARMORY_WEAPON_COLOR[tags[0].weaponId],
    isComet: false,
    matrices: createSquareNumberRotations(baseMatrix),
    cellFragments,
    cellColors: createColorRotations(cellFragments),
  };
}

function createJPiece(
  name: string,
  tags: [ArmoryFragmentTag, ArmoryFragmentTag, ArmoryFragmentTag],
): PieceDefinition {
  const baseMatrix = [
    [1, 0],
    [1, 1],
  ];
  const baseTags: (ArmoryFragmentTag | null)[][] = [
    [tags[0], null],
    [tags[1], tags[2]],
  ];
  const cellFragments = createSquareRotations(baseTags);

  return {
    name,
    color: ARMORY_WEAPON_COLOR[tags[0].weaponId],
    isComet: false,
    matrices: createSquareNumberRotations(baseMatrix),
    cellFragments,
    cellColors: createColorRotations(cellFragments),
  };
}

function createNeutralPiece(name: string, color: number, matrices: number[][][]): PieceDefinition {
  return {
    name,
    color,
    isComet: false,
    matrices: cloneNumberRotations(matrices),
  };
}

function createNeutralLinePiece(name: string, color: number): PieceDefinition {
  return createNeutralPiece(name, color, [
    [[1, 1, 1]],
    [[1], [1], [1]],
    [[1, 1, 1]],
    [[1], [1], [1]],
  ]);
}

function createNeutralLPiece(name: string, color: number): PieceDefinition {
  return createNeutralPiece(name, color, createSquareNumberRotations([
    [1, 1],
    [0, 1],
  ]));
}

function createNeutralJPiece(name: string, color: number): PieceDefinition {
  return createNeutralPiece(name, color, createSquareNumberRotations([
    [1, 0],
    [1, 1],
  ]));
}

function createNeutralSquarePiece(name: string, color: number): PieceDefinition {
  const square = [
    [1, 1],
    [1, 1],
  ];
  return createNeutralPiece(name, color, [square, square, square, square]);
}

const MISSILE = 'missile' as const;
const BOMB = 'bomb' as const;
const TUB = 'tub' as const;
const PAN = 'pan' as const;
const KATANA = 'katana' as const;
const SWORD = 'sword' as const;
const SPEAR = 'spear' as const;

export const ARMORY_WEAPON_PIECES: PieceDefinition[] = [
  createLinePiece('MissileRack', getTripletTags(MISSILE)),
  createLPiece('MissileBracket', getTripletTags(MISSILE)),
  createJPiece('MissileCradle', getTripletTags(MISSILE)),

  createLinePiece('BombRack', getTripletTags(BOMB)),
  createLPiece('BombBracket', getTripletTags(BOMB)),
  createJPiece('BombCradle', getTripletTags(BOMB)),

  createLinePiece('TubRack', getTripletTags(TUB)),
  createLPiece('TubBracket', getTripletTags(TUB)),
  createJPiece('TubCradle', getTripletTags(TUB)),

  createLinePiece('PanRack', getTripletTags(PAN)),
  createLPiece('PanBracket', getTripletTags(PAN)),
  createJPiece('PanCradle', getTripletTags(PAN)),

  createLinePiece('KatanaRack', getTripletTags(KATANA)),
  createLPiece('KatanaBracket', getTripletTags(KATANA)),
  createJPiece('KatanaCradle', getTripletTags(KATANA)),

  createLinePiece('SwordRack', getTripletTags(SWORD)),
  createLPiece('SwordBracket', getTripletTags(SWORD)),
  createJPiece('SwordCradle', getTripletTags(SWORD)),

  createLinePiece('SpearRack', getTripletTags(SPEAR)),
  createLPiece('SpearBracket', getTripletTags(SPEAR)),
  createJPiece('SpearCradle', getTripletTags(SPEAR)),
];

export const ARMORY_JUNK_PIECES: PieceDefinition[] = [
  createNeutralLinePiece('ScrapBar', 0),
  createNeutralLPiece('ScrapHook', 6),
  createNeutralJPiece('ScrapBrace', 4),
  createNeutralSquarePiece('ScrapCrate', 1),
  createNeutralLinePiece('RubbleBar', 5),
  createNeutralLPiece('RubbleHook', 3),
  createNeutralJPiece('DebrisBrace', 2),
  createNeutralSquarePiece('CargoCrate', 6),
];

export const ARMORY_JUNK_WEIGHT = 6;

export const ARMORY_PIECES: PieceDefinition[] = [
  ...ARMORY_WEAPON_PIECES,
  ...Array.from({ length: ARMORY_JUNK_WEIGHT }).flatMap(() => ARMORY_JUNK_PIECES),
];

export function getArmoryWeapon(weaponId: WeaponId): ArmoryWeaponRecipe {
  return ARMORY_WEAPONS.find((weapon) => weapon.id === weaponId) ?? ARMORY_WEAPONS[0];
}
