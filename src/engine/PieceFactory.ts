import {
  BOARD_WIDTH,
  CLUSTER_BOMB_PROBABILITY,
  COMET_PROBABILITY,
  FIRE_BLOCK_PROBABILITY,
  NORMAL_BOMB_PROBABILITY,
  THUNDER_BOMB_PROBABILITY,
} from '@/lib/constants';
import { Piece, STANDARD_PIECES } from './Piece';
import { PieceDefinition } from './types';

// Comet piece definition imported separately
import { ALL_PIECES } from './Piece';
const COMET_PIECE = ALL_PIECES[ALL_PIECES.length - 1];

export class PieceFactory {
  private bag: PieceDefinition[] = [];
  /** Pre-built queue of upcoming piece definitions (includes comets) */
  private queue: PieceDefinition[] = [];
  private pieceSet: PieceDefinition[] = [...STANDARD_PIECES];
  private allowComets: boolean = true;
  /** Whether to assign bomb cells to new pieces */
  assignBombs: boolean = false;

  constructor() {
    this.refillBag();
    this.fillQueue();
  }

  private refillBag(): void {
    this.bag = [...this.pieceSet];
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
  }

  /** Ensure the queue has at least `min` pieces ready */
  private fillQueue(min: number = 5): void {
    while (this.queue.length < min) {
      // Small chance of comet instead of next bag piece
      if (this.allowComets && Math.random() < COMET_PROBABILITY) {
        this.queue.push(COMET_PIECE);
      } else {
        if (this.bag.length === 0) {
          this.refillBag();
        }
        this.queue.push(this.bag.pop()!);
      }
    }
  }

  next(): Piece {
    this.fillQueue();
    const def = this.queue.shift()!;
    this.fillQueue();
    return this.createPieceFromDefinition(def);
  }

  peek(count: number): PieceDefinition[] {
    this.fillQueue(count);
    return this.queue.slice(0, count);
  }

  createPieceFromDefinition(def: PieceDefinition): Piece {
    const matrixWidth = def.matrices[0][0].length;
    const startX = Math.floor((BOARD_WIDTH - matrixWidth) / 2);
    const piece = new Piece(def, startX, 0);

    // Assign bomber payload cells if in bomber mode.
    if (this.assignBombs && def.special !== 'supportWeight') {
      const matrix = piece.getMatrix();
      for (let row = 0; row < matrix.length; row++) {
        for (let col = 0; col < matrix[row].length; col++) {
          if (matrix[row][col] !== 1) continue;

          const roll = Math.random();
          const key = `${col},${row}`;
          if (roll < FIRE_BLOCK_PROBABILITY) {
            piece.fireCells.add(key);
            continue;
          }

          if (roll < FIRE_BLOCK_PROBABILITY + NORMAL_BOMB_PROBABILITY) {
            piece.bombCells.add(key);
            piece.bombKinds.set(key, 'normal');
            continue;
          }

          if (roll < FIRE_BLOCK_PROBABILITY + NORMAL_BOMB_PROBABILITY + THUNDER_BOMB_PROBABILITY) {
            piece.bombCells.add(key);
            piece.bombKinds.set(key, 'thunder');
            continue;
          }

          if (roll < FIRE_BLOCK_PROBABILITY + NORMAL_BOMB_PROBABILITY + THUNDER_BOMB_PROBABILITY + CLUSTER_BOMB_PROBABILITY) {
            piece.bombCells.add(key);
            piece.bombKinds.set(key, 'cluster');
          }
        }
      }
    }

    return piece;
  }

  reset(): void {
    this.bag = [];
    this.queue = [];
    this.refillBag();
    this.fillQueue();
  }

  configure(options: { pieceSet?: PieceDefinition[]; allowComets?: boolean }): void {
    if (options.pieceSet && options.pieceSet.length > 0) {
      this.pieceSet = [...options.pieceSet];
    } else {
      this.pieceSet = [...STANDARD_PIECES];
    }
    this.allowComets = options.allowComets ?? true;
    this.reset();
  }
}
