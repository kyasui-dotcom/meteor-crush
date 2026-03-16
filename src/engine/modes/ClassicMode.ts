import { Board } from '../Board';
import { ChainTextResolver } from '../ChainTextResolver';
import { ScoreCalculator } from '../ScoreCalculator';
import { GameMode, LineClearEvent } from './GameMode';

export class ClassicMode implements GameMode {
  readonly type = 'classic' as const;

  shouldIncludeBombs(): boolean {
    return false;
  }

  hasFallingPieces(): boolean {
    return true;
  }

  onLineClear(linesCleared: number, level: number): LineClearEvent {
    return {
      linesCleared,
      score: ScoreCalculator.getLineClearScore(linesCleared, level),
      text: ChainTextResolver.getClassicText(linesCleared),
      effectTier: ChainTextResolver.getClassicEffectTier(linesCleared),
    };
  }

  isGameOver(board: Board): boolean {
    return board.isTopBlocked();
  }
}
