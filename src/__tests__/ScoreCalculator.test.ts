import { describe, expect, it } from 'vitest';
import { ScoreCalculator } from '@/engine/ScoreCalculator';

describe('ScoreCalculator', () => {
  it('doubles the score multiplier for each chain step', () => {
    expect(ScoreCalculator.getChainMultiplier(0)).toBe(1);
    expect(ScoreCalculator.getChainMultiplier(1)).toBe(1);
    expect(ScoreCalculator.getChainMultiplier(2)).toBe(2);
    expect(ScoreCalculator.getChainMultiplier(3)).toBe(4);
    expect(ScoreCalculator.getChainMultiplier(4)).toBe(8);
    expect(ScoreCalculator.getChainMultiplier(5)).toBe(16);
  });

  it('applies doubled chain multipliers to bomber, purify, and armory scoring', () => {
    expect(ScoreCalculator.getBombScore(3, 1, 0)).toBe(150);
    expect(ScoreCalculator.getBombScore(3, 2, 0)).toBe(300);
    expect(ScoreCalculator.getBombScore(3, 3, 0)).toBe(600);

    expect(ScoreCalculator.getPurifyScore(10, 1, 1, 0)).toBe(630);
    expect(ScoreCalculator.getPurifyScore(10, 1, 2, 0)).toBe(1260);
    expect(ScoreCalculator.getPurifyScore(10, 1, 3, 0)).toBe(2520);

    expect(ScoreCalculator.getArmoryScore(2, 5, 1, 0)).toBe(830);
    expect(ScoreCalculator.getArmoryScore(2, 5, 2, 0)).toBe(1660);
    expect(ScoreCalculator.getArmoryScore(2, 5, 3, 0)).toBe(3320);
  });
});
