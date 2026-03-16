import { CHAIN_TEXTS_BOMBER, ANNIHILATION_TEXT, CLASSIC_LINE_TEXTS } from '@/lib/constants';

export class ChainTextResolver {
  // For Bomber/Gravity modes: based on chain count
  static getChainText(chainCount: number): string {
    if (chainCount >= 13) return ANNIHILATION_TEXT;
    if (chainCount >= 0 && chainCount < CHAIN_TEXTS_BOMBER.length) {
      return CHAIN_TEXTS_BOMBER[chainCount];
    }
    return '';
  }

  // For Classic mode: based on simultaneous lines cleared
  static getClassicText(linesCleared: number): string {
    return CLASSIC_LINE_TEXTS[linesCleared] || '';
  }

  // Get the visual tier (0-3) for effect intensity
  static getEffectTier(chainCount: number): number {
    if (chainCount >= 13) return 3; // ANNIHILATION
    if (chainCount >= 9) return 2;  // Demolition
    if (chainCount >= 5) return 1;  // Shatter
    return 0;                        // Crush
  }

  static getClassicEffectTier(linesCleared: number): number {
    if (linesCleared >= 6) return 3; // ANNIHILATION
    if (linesCleared >= 4) return 2; // Demolition
    if (linesCleared >= 3) return 1; // Shatter
    if (linesCleared >= 2) return 0; // Crush
    return -1; // no effect
  }
}
