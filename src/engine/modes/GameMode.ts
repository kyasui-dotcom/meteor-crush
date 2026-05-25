import { Board } from '../Board';
import { GameModeType, PieceDefinition } from '../types';

export interface LineClearEvent {
  linesCleared: number;
  score: number;
  text: string;
  effectTier: number;
}

export interface GameMode {
  readonly type: GameModeType;

  shouldIncludeBombs(): boolean;
  hasFallingPieces(): boolean;

  onLineClear(linesCleared: number, level: number): LineClearEvent;
  isGameOver(board: Board): boolean;
  initializeBoard?(board: Board, stage: number): void;
  getPieceSet?(): PieceDefinition[];
  getSpawnOverride?(board: Board, stage: number, level: number): PieceDefinition | null;
  allowComets?(): boolean;
}
