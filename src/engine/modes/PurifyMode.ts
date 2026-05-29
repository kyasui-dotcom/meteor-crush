import { BOARD_HEIGHT, BOARD_WIDTH, HIDDEN_ROWS } from '@/lib/constants';
import { Board } from '../Board';
import { PieceDefinition } from '../types';
import { GameMode, LineClearEvent } from './GameMode';

const PURIFY_COLORS = [1, 2, 4, 5];
const RESCUE_COLONY_COLOR = 9;
const PURIFY_TRIAD_BASE = [
  [1, 0, 0],
  [1, 1, 0],
  [0, 0, 0],
] as const;
const RESCUE_COLONY_MATRICES = [
  [[1, 1, 1], [1, 1, 1]],
  [[1, 1, 1], [1, 1, 1]],
  [[1, 1, 1], [1, 1, 1]],
  [[1, 1, 1], [1, 1, 1]],
] as const;

function cloneMatrix(matrix: readonly (readonly number[])[]): number[][] {
  return matrix.map((row) => [...row]);
}

function rotateSquareMatrix(matrix: number[][]): number[][] {
  const size = matrix.length;
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => matrix[size - 1 - col]?.[row] ?? -1)
  );
}

function createRotations(baseMatrix: readonly (readonly number[])[]): number[][][] {
  const rotations = [cloneMatrix(baseMatrix)];
  while (rotations.length < 4) {
    rotations.push(rotateSquareMatrix(rotations[rotations.length - 1]));
  }
  return rotations;
}

function createPurifyPiece(colors: [number, number, number]): PieceDefinition {
  const [edgeColor, spineColor, tipColor] = colors;
  const baseColorGrid = [
    [edgeColor, -1, -1],
    [spineColor, tipColor, -1],
    [-1, -1, -1],
  ] as const;

  return {
    name: `Triad-${edgeColor}-${spineColor}-${tipColor}`,
    color: edgeColor,
    isComet: false,
    matrices: createRotations(PURIFY_TRIAD_BASE),
    cellColors: createRotations(baseColorGrid),
  };
}

export const PURIFY_RESCUE_COLONY: PieceDefinition = {
  name: 'RescueColony',
  color: RESCUE_COLONY_COLOR,
  isComet: false,
  special: 'rescueColony',
  matrices: RESCUE_COLONY_MATRICES.map((matrix) => matrix.map((row) => [...row])),
  cellColors: RESCUE_COLONY_MATRICES.map((matrix) =>
    matrix.map((row) => row.map((cell) => (cell === 1 ? RESCUE_COLONY_COLOR : -1)))
  ),
};

const PURIFY_PIECES = PURIFY_COLORS.flatMap((topColor) =>
  [
    createPurifyPiece([topColor, topColor, topColor]),
    ...PURIFY_COLORS
      .filter((accentColor) => accentColor !== topColor)
      .map((accentColor) => createPurifyPiece([topColor, topColor, accentColor])),
  ]
);

export class PurifyMode implements GameMode {
  readonly type = 'purify' as const;
  private piecesSinceColony = 0;
  private colonyUsedThisStage = false;

  shouldIncludeBombs(): boolean {
    return false;
  }

  hasFallingPieces(): boolean {
    return true;
  }

  onLineClear(_linesCleared: number, _level: number): LineClearEvent {
    return {
      linesCleared: 0,
      score: 0,
      text: '',
      effectTier: 0,
    };
  }

  isGameOver(board: Board): boolean {
    return board.isTopBlocked();
  }

  initializeBoard(board: Board, stage: number): void {
    this.piecesSinceColony = 0;
    this.colonyUsedThisStage = false;

    const coreCount = Math.min(14, 8 + Math.max(0, stage - 1));
    let placed = 0;
    let attempts = 0;

    while (placed < coreCount && attempts < 600) {
      attempts++;
      const x = Math.floor(Math.random() * BOARD_WIDTH);
      const y = HIDDEN_ROWS + 8 + Math.floor(Math.random() * (BOARD_HEIGHT - HIDDEN_ROWS - 8));
      if (!board.isEmpty(x, y)) continue;

      const color = this.pickCoreColor(board, x, y, stage);
      board.setCell(x, y, {
        type: 'block',
        color,
        core: true,
      });
      placed++;
    }
  }

  getPieceSet(): PieceDefinition[] {
    return PURIFY_PIECES;
  }

  getSpawnOverride(board: Board, stage: number, level: number): PieceDefinition | null {
    this.piecesSinceColony += 1;

    if (this.colonyUsedThisStage || this.piecesSinceColony < 6) {
      return null;
    }

    const stackPressure = this.getStackPressure(board);
    const corePressure = Math.min(1, board.getCoreCount() / 12);
    const stagePressure = Math.min(0.15, Math.max(0, stage - 1) * 0.03);
    const elapsedPressure = Math.min(0.24, (this.piecesSinceColony - 5) * 0.03);
    let chance = 0.02 + elapsedPressure + stackPressure * 0.34 + corePressure * 0.08 + stagePressure;

    if (level >= 4) {
      chance += 0.06;
    }
    if (stackPressure >= 0.7) {
      chance += 0.25;
    }

    if (Math.random() < Math.min(0.85, chance)) {
      this.piecesSinceColony = 0;
      this.colonyUsedThisStage = true;
      return PURIFY_RESCUE_COLONY;
    }

    return null;
  }

  allowComets(): boolean {
    return false;
  }

  private getStackPressure(board: Board): number {
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        if (board.getCell(x, y).type !== 'empty') {
          const occupiedHeight = board.height - y;
          const visibleHeight = BOARD_HEIGHT - HIDDEN_ROWS;
          return Math.min(1, occupiedHeight / visibleHeight);
        }
      }
    }
    return 0;
  }

  private pickCoreColor(board: Board, x: number, y: number, stage: number): number {
    const availableColors = PURIFY_COLORS.slice(0, Math.min(PURIFY_COLORS.length, 3 + Math.floor(stage / 3)));

    const shuffled = [...availableColors].sort(() => Math.random() - 0.5);
    for (const color of shuffled) {
      if (!this.formsCrowdedCluster(board, x, y, color)) {
        return color;
      }
    }
    return shuffled[0] ?? 0;
  }

  private formsCrowdedCluster(board: Board, x: number, y: number, color: number): boolean {
    let neighbors = 0;
    const checks = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const;

    for (const [dx, dy] of checks) {
      const cell = board.getCell(x + dx, y + dy);
      if (cell.type !== 'empty' && cell.color === color) {
        neighbors++;
      }
    }

    return neighbors >= 2;
  }
}
