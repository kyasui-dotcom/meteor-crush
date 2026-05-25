import { Board } from '../Board';
import { ChainTextResolver } from '../ChainTextResolver';
import { ScoreCalculator } from '../ScoreCalculator';
import { PieceDefinition } from '../types';
import { GameMode, LineClearEvent } from './GameMode';
import { SupportWeightSpawner } from './SupportWeightSpawner';

export class ClassicMode implements GameMode {
  readonly type = 'classic' as const;
  private supportWeightSpawner = new SupportWeightSpawner();

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

  initializeBoard(): void {
    this.supportWeightSpawner.reset();
  }

  getSpawnOverride(board: Board, _stage: number, level: number): PieceDefinition | null {
    return this.supportWeightSpawner.getSpawnOverride(board, level);
  }
}
