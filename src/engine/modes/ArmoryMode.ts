import { Board } from '../Board';
import { ARMORY_PIECES } from '../ArmoryData';
import { PieceDefinition } from '../types';
import { GameMode, LineClearEvent } from './GameMode';

export class ArmoryMode implements GameMode {
  readonly type = 'armory' as const;

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

  getPieceSet(): PieceDefinition[] {
    return ARMORY_PIECES;
  }

  allowComets(): boolean {
    return false;
  }
}
