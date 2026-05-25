import { BOARD_HEIGHT, HIDDEN_ROWS } from '@/lib/constants';
import { Board } from '../Board';
import { SUPPORT_WEIGHT_PIECE } from '../Piece';
import { PieceDefinition } from '../types';

type BoardPressure = {
  stackHeight: number;
  holes: number;
  roughness: number;
};

export class SupportWeightSpawner {
  private piecesSinceWeight = 0;

  reset(): void {
    this.piecesSinceWeight = 0;
  }

  getSpawnOverride(board: Board, level: number): PieceDefinition | null {
    this.piecesSinceWeight += 1;

    if (this.piecesSinceWeight < 6) {
      return null;
    }

    const pressure = this.getBoardPressure(board);
    if (pressure.stackHeight < 6 && pressure.holes < 4) {
      return null;
    }

    const elapsedPressure = Math.min(0.24, (this.piecesSinceWeight - 5) * 0.03);
    const stackPressure = Math.min(0.24, Math.max(0, pressure.stackHeight - 6) * 0.03);
    const holePressure = Math.min(0.24, pressure.holes * 0.025);
    const roughnessPressure = Math.min(0.14, pressure.roughness * 0.015);

    let chance = 0.04 + elapsedPressure + stackPressure + holePressure + roughnessPressure;

    if (level >= 4) {
      chance += 0.05;
    }
    if (pressure.stackHeight >= 11 || pressure.holes >= 9) {
      chance += 0.25;
    }
    if (this.piecesSinceWeight >= 12 && (pressure.stackHeight >= 6 || pressure.holes >= 4)) {
      chance = 1;
    }

    if (Math.random() < Math.min(0.9, chance)) {
      this.piecesSinceWeight = 0;
      return SUPPORT_WEIGHT_PIECE;
    }

    return null;
  }

  private getBoardPressure(board: Board): BoardPressure {
    const columnHeights: number[] = [];
    let holes = 0;
    let minOccupiedY = board.height;

    for (let x = 0; x < board.width; x++) {
      let topCellY = board.height;
      let seenFilledCell = false;

      for (let y = 0; y < board.height; y++) {
        const cell = board.getCell(x, y);
        if (cell.type !== 'empty') {
          if (!seenFilledCell) {
            topCellY = y;
            seenFilledCell = true;
          }
          minOccupiedY = Math.min(minOccupiedY, y);
        } else if (seenFilledCell && y >= HIDDEN_ROWS) {
          holes++;
        }
      }

      columnHeights.push(topCellY === board.height ? 0 : board.height - topCellY);
    }

    let roughness = 0;
    for (let i = 1; i < columnHeights.length; i++) {
      roughness += Math.abs(columnHeights[i] - columnHeights[i - 1]);
    }

    return {
      stackHeight: minOccupiedY === board.height ? 0 : BOARD_HEIGHT - minOccupiedY,
      holes,
      roughness,
    };
  }
}
