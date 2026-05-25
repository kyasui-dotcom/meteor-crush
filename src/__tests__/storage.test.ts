// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getEasterEggProgress,
  isAdFreeActive,
  getSecretModeUnlocked,
  getShowRulesBeforeGame,
  registerEasterEgg,
  setSecretModeUnlocked,
  setShowRulesBeforeGame,
} from '@/lib/storage';

describe('storage preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('defaults to showing rule cards before the game starts', () => {
    expect(getShowRulesBeforeGame()).toBe(true);
  });

  it('persists the rule-card preference', () => {
    setShowRulesBeforeGame(false);
    expect(getShowRulesBeforeGame()).toBe(false);
  });

  it('defaults Purify to unlocked', () => {
    expect(getSecretModeUnlocked()).toBe(true);
  });

  it('keeps Purify unlocked even if older code tries to toggle it', () => {
    setSecretModeUnlocked(false);
    expect(getSecretModeUnlocked()).toBe(true);
  });

  it('migrates older save data without the rule-card flag', () => {
    localStorage.setItem('meteor-crush', JSON.stringify({
      highScores: {},
      totalLinesCleared: 0,
      playerName: 'Player',
      scoreHistory: {},
      continent: 'AS',
    }));

    expect(getShowRulesBeforeGame()).toBe(true);
    expect(getSecretModeUnlocked()).toBe(true);
    expect(getEasterEggProgress().foundCount).toBe(0);
    expect(getEasterEggProgress().totalCount).toBe(0);
  });

  it('ignores legacy easter egg registration now that the feature is removed', () => {
    const result = registerEasterEgg('open_rules', 1_000);

    expect(result.added).toBe(false);
    expect(result.rewardGranted).toBe(false);
    expect(result.foundCount).toBe(0);
    expect(result.totalCount).toBe(0);
  });

  it('never activates the removed ad-free easter egg reward', () => {
    expect(isAdFreeActive(Date.now())).toBe(false);
  });
});
