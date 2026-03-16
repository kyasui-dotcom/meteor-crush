import { BOARD_WIDTH, COMET_PROBABILITY, BOMB_PROBABILITY } from '@/lib/constants';
import { Piece, STANDARD_PIECES } from './Piece';
import { PieceDefinition } from './types';

// Comet piece definition imported separately
import { ALL_PIECES } from './Piece';
const COMET_PIECE = ALL_PIECES[ALL_PIECES.length - 1];

export class PieceFactory {
  private bag: PieceDefinition[] = [];
  /** Whether to assign bomb cells to new pieces */
  assignBombs: boolean = false;

  constructor() {
    this.refillBag();
  }

  private refillBag(): void {
    // 7-bag randomizer: shuffle all 7 standard pieces
    this.bag = [...STANDARD_PIECES];
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
  }

  next(): Piece {
    // Small chance of comet instead of next bag piece
    if (Math.random() < COMET_PROBABILITY) {
      return this.createPiece(COMET_PIECE);
    }

    if (this.bag.length === 0) {
      this.refillBag();
    }
    const def = this.bag.pop()!;
    return this.createPiece(def);
  }

  peek(count: number): PieceDefinition[] {
    // Preview next pieces without consuming them
    // bag is used as a stack (pop from end), so preview from end backwards
    const result: PieceDefinition[] = [];
    const tempBag = [...this.bag];

    for (let i = 0; i < count; i++) {
      if (tempBag.length === 0) {
        const newBag = [...STANDARD_PIECES];
        for (let j = newBag.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [newBag[j], newBag[k]] = [newBag[k], newBag[j]];
        }
        tempBag.push(...newBag);
      }
      result.push(tempBag.pop()!);
    }
    return result;
  }

  private createPiece(def: PieceDefinition): Piece {
    const matrixWidth = def.matrices[0][0].length;
    const startX = Math.floor((BOARD_WIDTH - matrixWidth) / 2);
    const piece = new Piece(def, startX, 0);

    // Assign bomb cells if in bomber mode
    if (this.assignBombs) {
      // O-piece has a 25% chance to become a mega bomb (all cells are bombs)
      if (def.name === 'O' && Math.random() < 0.25) {
        piece.isMegaBomb = true;
        const matrix = piece.getMatrix();
        for (let row = 0; row < matrix.length; row++) {
          for (let col = 0; col < matrix[row].length; col++) {
            if (matrix[row][col] === 1) {
              piece.bombCells.add(`${col},${row}`);
            }
          }
        }
      } else {
        const matrix = piece.getMatrix();
        for (let row = 0; row < matrix.length; row++) {
          for (let col = 0; col < matrix[row].length; col++) {
            if (matrix[row][col] === 1 && Math.random() < BOMB_PROBABILITY) {
              piece.bombCells.add(`${col},${row}`);
            }
          }
        }
      }
    }

    return piece;
  }

  reset(): void {
    this.bag = [];
    this.refillBag();
  }
}
