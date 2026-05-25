import { ArmoryFragmentTag, BombKind, PieceDefinition, Position } from './types';

// Meteor fragments use original polyomino silhouettes instead of the standard
// seven tetromino roster so the core mode has a more distinct identity.

function cloneMatrix(matrix: number[][]): number[][] {
  return matrix.map((row) => [...row]);
}

function rotateSquareMatrix(matrix: number[][]): number[][] {
  const size = matrix.length;
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => matrix[size - 1 - col]?.[row] ?? 0)
  );
}

function createRotations(baseMatrix: number[][]): number[][][] {
  const rotations = [cloneMatrix(baseMatrix)];
  while (rotations.length < 4) {
    rotations.push(rotateSquareMatrix(rotations[rotations.length - 1]));
  }
  return rotations;
}

const PIECE_SPARK: PieceDefinition = {
  name: 'Spark',
  color: 0,
  isComet: false,
  matrices: createRotations([
    [0, 0, 0, 0],
    [0, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]),
};

const PIECE_BEND: PieceDefinition = {
  name: 'Bend',
  color: 1,
  isComet: false,
  matrices: createRotations([
    [0, 1, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]),
};

const PIECE_SLAB: PieceDefinition = {
  name: 'Slab',
  color: 2,
  isComet: false,
  matrices: createRotations([
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]),
};

const PIECE_ARC: PieceDefinition = {
  name: 'Arc',
  color: 3,
  isComet: false,
  matrices: createRotations([
    [1, 0, 1, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]),
};

const PIECE_VANE: PieceDefinition = {
  name: 'Vane',
  color: 4,
  isComet: false,
  matrices: createRotations([
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
  ]),
};

const PIECE_WAVE: PieceDefinition = {
  name: 'Wave',
  color: 5,
  isComet: false,
  matrices: createRotations([
    [1, 0, 0, 0],
    [1, 1, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
  ]),
};

const PIECE_NOVA: PieceDefinition = {
  name: 'Nova',
  color: 6,
  isComet: false,
  matrices: createRotations([
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 0],
  ]),
};

const SUPPORT_WEIGHT_MATRICES = [
  [
    [1, 1, 1],
    [1, 1, 1],
  ],
  [
    [1, 1, 1],
    [1, 1, 1],
  ],
  [
    [1, 1, 1],
    [1, 1, 1],
  ],
  [
    [1, 1, 1],
    [1, 1, 1],
  ],
] as number[][][];

export const SUPPORT_WEIGHT_PIECE: PieceDefinition = {
  name: 'Anchor',
  color: 10,
  isComet: false,
  special: 'supportWeight',
  matrices: SUPPORT_WEIGHT_MATRICES.map((matrix) => matrix.map((row) => [...row])),
};

// Comet: 6-block straight piece, only 2 rotation states
const PIECE_COMET: PieceDefinition = {
  name: 'Comet',
  color: 7,
  isComet: true,
  matrices: [
    [[0,0,0,0,0,0],[1,1,1,1,1,1],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]],
    [[0,1,0,0,0,0],[0,1,0,0,0,0],[0,1,0,0,0,0],[0,1,0,0,0,0],[0,1,0,0,0,0],[0,1,0,0,0,0]],
    [[0,0,0,0,0,0],[1,1,1,1,1,1],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]],
    [[0,1,0,0,0,0],[0,1,0,0,0,0],[0,1,0,0,0,0],[0,1,0,0,0,0],[0,1,0,0,0,0],[0,1,0,0,0,0]],
  ],
};

export const STANDARD_PIECES = [
  PIECE_SPARK,
  PIECE_BEND,
  PIECE_SLAB,
  PIECE_ARC,
  PIECE_VANE,
  PIECE_WAVE,
  PIECE_NOVA,
];
export const ALL_PIECES = [...STANDARD_PIECES, PIECE_COMET];

export function getPieceDefinitionCellColor(
  definition: PieceDefinition,
  rotation: number,
  col: number,
  row: number,
): number {
  const rotationColors = definition.cellColors?.[rotation] ?? definition.cellColors?.[0];
  const color = rotationColors?.[row]?.[col];
  return typeof color === 'number' && color >= 0 ? color : definition.color;
}

export function getPieceDefinitionArmoryFragment(
  definition: PieceDefinition,
  rotation: number,
  col: number,
  row: number,
): ArmoryFragmentTag | null {
  const rotationFragments = definition.cellFragments?.[rotation] ?? definition.cellFragments?.[0];
  return rotationFragments?.[row]?.[col] ?? null;
}

export class Piece {
  definition: PieceDefinition;
  x: number;
  y: number;
  rotation: number;
  /** Bomb cells stored as "col,row" keys in matrix-local coordinates */
  bombCells: Set<string> = new Set();
  bombKinds: Map<string, BombKind> = new Map();
  fireCells: Set<string> = new Set();
  /** Legacy oversized-bomb flag kept for compatibility with older saves/tests */
  isMegaBomb: boolean = false;

  constructor(definition: PieceDefinition, x: number, y: number) {
    this.definition = definition;
    this.x = x;
    this.y = y;
    this.rotation = 0;
  }

  getMatrix(): number[][] {
    return this.definition.matrices[this.rotation];
  }

  /** Check if a matrix-local cell (col, row) is a bomb */
  isBombAt(col: number, row: number): boolean {
    return this.bombCells.has(`${col},${row}`);
  }

  getBombKindAt(col: number, row: number): BombKind | null {
    return this.bombKinds.get(`${col},${row}`) ?? null;
  }

  isFireAt(col: number, row: number): boolean {
    return this.fireCells.has(`${col},${row}`);
  }

  getColorAt(col: number, row: number): number {
    return getPieceDefinitionCellColor(this.definition, this.rotation, col, row);
  }

  getArmoryFragmentAt(col: number, row: number): ArmoryFragmentTag | null {
    return getPieceDefinitionArmoryFragment(this.definition, this.rotation, col, row);
  }

  getOccupiedCells(): Position[] {
    const matrix = this.getMatrix();
    const cells: Position[] = [];
    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        if (matrix[row][col] === 1) {
          cells.push({ x: this.x + col, y: this.y + row });
        }
      }
    }
    return cells;
  }

  clone(): Piece {
    const p = new Piece(this.definition, this.x, this.y);
    p.rotation = this.rotation;
    p.bombCells = new Set(this.bombCells);
    p.bombKinds = new Map(this.bombKinds);
    p.fireCells = new Set(this.fireCells);
    p.isMegaBomb = this.isMegaBomb;
    return p;
  }

  getRotated(direction: 1 | -1): Piece {
    const p = this.clone();
    const oldRotation = p.rotation;
    p.rotation = (p.rotation + direction + 4) % 4;

    const size = this.definition.matrices[oldRotation].length;
    const rotateKey = (key: string): string => {
      const [col, row] = key.split(',').map(Number);
      let nc: number;
      let nr: number;
      if (direction === 1) {
        nc = size - 1 - row;
        nr = col;
      } else {
        nc = row;
        nr = size - 1 - col;
      }
      return `${nc},${nr}`;
    };

    if (p.bombCells.size > 0) {
      p.bombCells = new Set(Array.from(p.bombCells, rotateKey));
    }

    if (p.bombKinds.size > 0) {
      p.bombKinds = new Map(Array.from(p.bombKinds.entries(), ([key, kind]) => [rotateKey(key), kind]));
    }

    if (p.fireCells.size > 0) {
      p.fireCells = new Set(Array.from(p.fireCells, rotateKey));
    }

    return p;
  }

  getMatrixSize(): number {
    return this.getMatrix().length;
  }
}
