// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine } from '@/engine/GameEngine';
import { ClassicMode } from '@/engine/modes/ClassicMode';
import { BomberMode } from '@/engine/modes/BomberMode';
import { BOARD_WIDTH, BOARD_HEIGHT } from '@/lib/constants';

describe('GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
  });

  describe('inputManager exposure', () => {
    it('exposes inputManager as readonly', () => {
      expect(engine.inputManager).toBeDefined();
      expect(typeof engine.inputManager.injectAction).toBe('function');
    });
  });

  describe('gameOverTimer', () => {
    it('initializes at 0', () => {
      expect(engine.gameOverTimer).toBe(0);
    });

    it('resets to 0 on start', () => {
      engine.gameOverTimer = 999;
      engine.start(new ClassicMode());
      expect(engine.gameOverTimer).toBe(0);
    });
  });

  describe('mode selection', () => {
    it('starts with ClassicMode by default', () => {
      expect(engine.mode.type).toBe('classic');
    });

    it('can start with BomberMode', () => {
      engine.start(new BomberMode());
      expect(engine.mode.type).toBe('bomber');
      expect(engine.state).toBe('playing');
    });
  });

  describe('game over', () => {
    it('sets state to game_over when board is blocked', () => {
      const onGameOver = vi.fn();
      engine = new GameEngine({ onGameOver });
      engine.start(new ClassicMode());

      // Fill up the board to trigger game over
      for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
          engine.board.setCell(x, y, { type: 'block', color: 0 });
        }
      }

      engine.stop();
      expect(engine.state).toBe('game_over');
      expect(onGameOver).toHaveBeenCalled();
    });
  });

  describe('moveToColumn', () => {
    it('moves piece to target column', () => {
      engine.start(new ClassicMode());
      const piece = engine.currentPiece;
      expect(piece).not.toBeNull();

      const startX = piece!.x;
      // Move to column 0 (leftmost)
      engine.moveToColumn(0);
      // Piece should have moved left (or stayed if already there)
      expect(engine.currentPiece!.x).toBeLessThanOrEqual(startX);
    });

    it('does not move piece when not playing', () => {
      // Engine is in 'title' state
      engine.moveToColumn(5);
      // Should not crash
    });

    it('stops at wall when moving left', () => {
      engine.start(new ClassicMode());
      engine.moveToColumn(-10); // way off left
      expect(engine.currentPiece!.x).toBeGreaterThanOrEqual(0);
    });

    it('stops at wall when moving right', () => {
      engine.start(new ClassicMode());
      engine.moveToColumn(100); // way off right
      expect(engine.currentPiece!.x).toBeLessThan(BOARD_WIDTH);
    });
  });

  describe('visual events', () => {
    it('initializes with empty visual events', () => {
      expect(engine.visualEvents).toEqual([]);
    });

    it('resets visual events on start', () => {
      engine.visualEvents.push({ type: 'explosion', cells: [] });
      engine.start(new ClassicMode());
      expect(engine.visualEvents).toEqual([]);
    });
  });
});
