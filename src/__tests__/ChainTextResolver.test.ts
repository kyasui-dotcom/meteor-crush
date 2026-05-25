import { describe, expect, it } from 'vitest';
import { ChainTextResolver } from '@/engine/ChainTextResolver';

describe('ChainTextResolver', () => {
  it('returns the bomber-style chain presentation for shared chain calls', () => {
    expect(ChainTextResolver.getChainPresentation(2)).toEqual({
      text: 'Double Crush',
      tier: 0,
    });
    expect(ChainTextResolver.getChainPresentation(3)).toEqual({
      text: 'Triple Crush',
      tier: 0,
    });
  });

  it('uses the single-action text until the chain count exceeds one', () => {
    expect(ChainTextResolver.getSingleOrChainPresentation(1, 'BOMB BURST', 1)).toEqual({
      text: 'BOMB BURST',
      tier: 1,
    });
    expect(ChainTextResolver.getSingleOrChainPresentation(3, 'BOMB BURST', 1)).toEqual({
      text: 'Triple Crush',
      tier: 0,
    });
  });
});
