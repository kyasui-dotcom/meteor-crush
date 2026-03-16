import { PieceDefinition, Position } from './types';

// Standard 7 tetrominoes + comet (6-block straight)
// Each piece has 4 rotation states represented as matrices
// 1 = filled, 0 = empty

const PIECE_I: PieceDefinition = {
  name: 'I',
  color: 0,
  isComet: false,
  matrices: [
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
    [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
    [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
  ],
};

const PIECE_O: PieceDefinition = {
  name: 'O',
  color: 1,
  isComet: false,
  matrices: [
    [[1,1],[1,1]],
    [[1,1],[1,1]],
    [[1,1],[1,1]],
    [[1,1],[1,1]],
  ],
};

const PIECE_T: PieceDefinition = {
  name: 'T',
  color: 2,
  isComet: false,
  matrices: [
    [[0,1,0],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,1],[0,1,0]],
    [[0,1,0],[1,1,0],[0,1,0]],
  ],
};

const PIECE_S: PieceDefinition = {
  name: 'S',
  color: 3,
  isComet: false,
  matrices: [
    [[0,1,1],[1,1,0],[0,0,0]],
    [[0,1,0],[0,1,1],[0,0,1]],
    [[0,0,0],[0,1,1],[1,1,0]],
    [[1,0,0],[1,1,0],[0,1,0]],
  ],
};

const PIECE_Z: PieceDefinition = {
  name: 'Z',
  color: 4,
  isComet: false,
  matrices: [
    [[1,1,0],[0,1,1],[0,0,0]],
    [[0,0,1],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,0],[0,1,1]],
    [[0,1,0],[1,1,0],[1,0,0]],
  ],
};

const PIECE_J: PieceDefinition = {
  name: 'J',
  color: 5,
  isComet: false,
  matrices: [
    [[1,0,0],[1,1,1],[0,0,0]],
    [[0,1,1],[0,1,0],[0,1,0]],
    [[0,0,0],[1,1,1],[0,0,1]],
    [[0,1,0],[0,1,0],[1,1,0]],
  ],
};

const PIECE_L: PieceDefinition = {
  name: 'L',
  color: 6,
  isComet: false,
  matrices: [
    [[0,0,1],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,0],[0,1,1]],
    [[0,0,0],[1,1,1],[1,0,0]],
    [[1,1,0],[0,1,0],[0,1,0]],
  ],
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

export const STANDARD_PIECES = [PIECE_I, PIECE_O, PIECE_T, PIECE_S, PIECE_Z, PIECE_J, PIECE_L];
export const ALL_PIECES = [...STANDARD_PIECES, PIECE_COMET];

export class Piece {
  definition: PieceDefinition;
  x: number;
  y: number;
  rotation: number;
  /** Bomb cells stored as "col,row" keys in matrix-local coordinates */
  bombCells: Set<string> = new Set();
  /** Whether this piece is a mega bomb (all cells are bombs, larger blast) */
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
    p.isMegaBomb = this.isMegaBomb;
    return p;
  }

  getRotated(direction: 1 | -1): Piece {
    const p = this.clone();
    const oldRotation = p.rotation;
    p.rotation = (p.rotation + direction + 4) % 4;

    // Transform bomb cell coordinates for the new rotation
    if (p.bombCells.size > 0) {
      const size = this.definition.matrices[oldRotation].length;
      const newBombs = new Set<string>();
      for (const key of p.bombCells) {
        const [col, row] = key.split(',').map(Number);
        let nc: number, nr: number;
        if (direction === 1) {
          // CW: (col, row) → (size-1-row, col)
          nc = size - 1 - row;
          nr = col;
        } else {
          // CCW: (col, row) → (row, size-1-col)
          nc = row;
          nr = size - 1 - col;
        }
        newBombs.add(`${nc},${nr}`);
      }
      p.bombCells = newBombs;
    }

    return p;
  }

  getMatrixSize(): number {
    return this.getMatrix().length;
  }
}
