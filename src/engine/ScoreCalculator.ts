import {
  SCORE_SINGLE, SCORE_DOUBLE, SCORE_TRIPLE, SCORE_QUAD,
  SCORE_PENTA, SCORE_HEXA, SCORE_SOFT_DROP, SCORE_HARD_DROP,
  CHAIN_MULTIPLIERS,
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
    if (chainCount >= CHAIN_MULTIPLIERS.length) {
      return CHAIN_MULTIPLIERS[CHAIN_MULTIPLIERS.length - 1];
    }
    return CHAIN_MULTIPLIERS[chainCount];
  }

  static getBombScore(destroyedCells: number, chainCount: number, level: number): number {
    const base = destroyedCells * 50;
    const multiplier = ScoreCalculator.getChainMultiplier(chainCount);
    return base * multiplier * (level + 1);
  }
}
