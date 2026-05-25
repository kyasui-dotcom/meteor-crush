import {
  SCORE_SINGLE, SCORE_DOUBLE, SCORE_TRIPLE, SCORE_QUAD,
  SCORE_PENTA, SCORE_HEXA, SCORE_SOFT_DROP, SCORE_HARD_DROP,
} from '@/lib/constants';

export class ScoreCalculator {
  static getLineClearScore(linesCleared: number, level: number): number {
    let base: number;
    switch (linesCleared) {
      case 1: base = SCORE_SINGLE; break;
      case 2: base = SCORE_DOUBLE; break;
      case 3: base = SCORE_TRIPLE; break;
      case 4: base = SCORE_QUAD; break;
      case 5: base = SCORE_PENTA; break;
      case 6: base = SCORE_HEXA; break;
      default: base = linesCleared * 200; break;
    }
    return base * (level + 1);
  }

  static getSoftDropScore(cells: number): number {
    return cells * SCORE_SOFT_DROP;
  }

  static getHardDropScore(cells: number): number {
    return cells * SCORE_HARD_DROP;
  }

  static getChainMultiplier(chainCount: number): number {
    if (chainCount <= 1) return 1;
    return 2 ** (chainCount - 1);
  }

  static getBombScore(destroyedCells: number, chainCount: number, level: number): number {
    const base = destroyedCells * 50;
    const multiplier = ScoreCalculator.getChainMultiplier(chainCount);
    return base * multiplier * (level + 1);
  }

  static getPurifyScore(destroyedCells: number, clearedCores: number, chainCount: number, level: number): number {
    const base = destroyedCells * 45 + clearedCores * 180;
    const multiplier = ScoreCalculator.getChainMultiplier(chainCount);
    return base * multiplier * (level + 1);
  }

  static getRescueColonyScore(destroyedCells: number, clearedCores: number, level: number): number {
    const base = 600 + destroyedCells * 55 + clearedCores * 260;
    return base * (level + 1);
  }

  static getPurifyWaveBonus(stage: number): number {
    return 1000 + Math.max(0, stage - 1) * 250;
  }

  static getArmoryScore(triggeredWeapons: number, destroyedCells: number, chainCount: number, level: number): number {
    const base = triggeredWeapons * 320 + destroyedCells * 38;
    const multiplier = ScoreCalculator.getChainMultiplier(chainCount);
    return base * multiplier * (level + 1);
  }
}
