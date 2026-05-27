// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine } from '@/engine/GameEngine';
import { Piece, STANDARD_PIECES, SUPPORT_WEIGHT_PIECE } from '@/engine/Piece';
import { ClassicMode } from '@/engine/modes/ClassicMode';
import { BomberMode } from '@/engine/modes/BomberMode';
import { ArmoryMode } from '@/engine/modes/ArmoryMode';
import { ARMORY_PIECES } from '@/engine/ArmoryData';
import { PURIFY_RESCUE_COLONY, PurifyMode } from '@/engine/modes/PurifyMode';
import { BOARD_WIDTH, BOARD_HEIGHT } from '@/lib/constants';

describe('GameEngine', () => {
  let engine: GameEngine;

  function countFilledCells(): number {
    let filledCells = 0;
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (engine.board.getCell(x, y).type !== 'empty') {
          filledCells++;
        }
      }
    }
    return filledCells;
  }

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

    it('ignites bomber chains from fire and bomb contact without requiring a full row', () => {
      engine.start(new BomberMode());
      engine.board.reset();

      engine.board.setCell(4, 12, { type: 'bomb', color: 16, bombKind: 'thunder' });
      engine.board.setCell(3, 12, { type: 'block', color: 15, fire: true });
      engine.board.setCell(2, 10, { type: 'block', color: 0 });
      engine.board.setCell(6, 10, { type: 'block', color: 1 });
      engine.board.setCell(6, 14, { type: 'bomb', color: 17, bombKind: 'cluster' });
      engine.board.setCell(8, 14, { type: 'block', color: 2 });

      (engine as unknown as { beginBomberChain: () => void }).beginBomberChain();
      for (let i = 0; i < 20 && engine.state === 'chain_resolving'; i++) {
        engine.tick(500);
      }

      expect(engine.score).toBeGreaterThan(0);
      expect(engine.board.getCell(2, 10).type).toBe('empty');
      expect(engine.board.getCell(8, 14).type).toBe('empty');
    });

    it('does not ignite bomber bombs just because a row is full', () => {
      engine.start(new BomberMode());
      engine.board.reset();

      const row = BOARD_HEIGHT - 1;
      for (let x = 0; x < BOARD_WIDTH; x++) {
        engine.board.setCell(x, row, { type: 'block', color: 0 });
      }
      engine.board.setCell(5, row, { type: 'bomb', color: 16, bombKind: 'thunder' });

      (engine as unknown as { beginBomberChain: () => void }).beginBomberChain();

      expect(engine.state).toBe('playing');
      expect(engine.board.getCell(5, row).type).toBe('bomb');
    });

    it('fuses a 2x2 cluster of same-kind bomber bombs into a mega bomb', () => {
      engine.start(new BomberMode());
      engine.board.reset();

      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          engine.board.setCell(4 + col, 12 + row, {
            type: 'bomb',
            color: 8,
            bombKind: 'normal',
          });
        }
      }

      (engine as unknown as { refreshMegaBombs: () => void }).refreshMegaBombs();

      expect(engine.board.getCell(4, 12).megaBomb).toBe(true);
      expect(engine.board.getCell(5, 12).megaBomb).toBe(true);
      expect(engine.board.getCell(4, 13).megaBombAnchorX).toBe(4);
      expect(engine.board.getCell(5, 13).megaBombAnchorY).toBe(12);
    });

    it('can start with PurifyMode and seeds cores', () => {
      engine.start(new PurifyMode());
      expect(engine.mode.type).toBe('purify');
      expect(engine.state).toBe('playing');
      expect(engine.getRemainingCoreCount()).toBeGreaterThan(0);
      expect(engine.currentPiece?.getOccupiedCells()).toHaveLength(3);
    });

    it('can start with ArmoryMode and spawns pieces from the expanded armory pool', () => {
      engine.start(new ArmoryMode());
      expect(engine.mode.type).toBe('armory');
      expect(engine.state).toBe('playing');
      const firstCell = engine.currentPiece?.getOccupiedCells()[0];
      expect(firstCell).toBeDefined();
      expect(ARMORY_PIECES.some((piece) => piece.name === engine.currentPiece?.definition.name)).toBe(true);
    });

    it('rescue colony purges a wide area in purify mode', () => {
      engine.start(new PurifyMode());
      engine.board.reset();

      engine.board.setCell(3, 14, { type: 'block', color: 1 });
      engine.board.setCell(4, 15, { type: 'block', color: 1, core: true });
      engine.board.setCell(8, 17, { type: 'block', color: 5, core: true });
      engine.board.setCell(10, 18, { type: 'block', color: 2, core: true });

      engine.currentPiece = new Piece(PURIFY_RESCUE_COLONY, 4, 14);
      engine['lockPiece']();

      expect(engine.board.getCell(4, 15).type).toBe('empty');
      expect(engine.board.getCell(8, 17).type).toBe('empty');
      expect(engine.board.getCell(10, 18).core).toBe(true);
      expect(engine.getRemainingCoreCount()).toBe(1);
      expect(engine.score).toBeGreaterThan(0);
      expect(engine.visualEvents.some((event) => event.type === 'explosion')).toBe(true);
      expect(engine.activeChainText).toBe('RESCUE COLONY');
    });

    it('resolves a straight purify line as a non-core crush', () => {
      engine.start(new PurifyMode());
      engine.board.reset();

      engine.board.setCell(3, 13, { type: 'block', color: 1 });
      engine.board.setCell(4, 13, { type: 'block', color: 1 });
      engine.board.setCell(5, 13, { type: 'block', color: 1 });
      engine.board.setCell(6, 13, { type: 'block', color: 1 });
      engine.board.setCell(10, 17, { type: 'block', color: 2, core: true });

      engine['resolvePurifyMatches']();

      expect(engine.board.getCell(3, 13).type).toBe('empty');
      expect(engine.score).toBeGreaterThan(0);
      expect(engine.activeChainText).toBe('Crush');
      expect(engine.visualEvents.some((event) => event.type === 'explosion')).toBe(true);
    });

    it('support weight keeps its landed plate intact while compressing covered columns downward', () => {
      engine.start(new ClassicMode());
      engine.board.reset();

      engine.board.setCell(4, 3, { type: 'block', color: 0 });
      engine.board.setCell(4, 18, { type: 'block', color: 1 });
      engine.board.setCell(5, 17, { type: 'block', color: 2 });
      engine.board.setCell(6, 15, { type: 'block', color: 3 });

      engine.currentPiece = new Piece(SUPPORT_WEIGHT_PIECE, 4, 13);
      engine['lockPiece']();

      expect(engine.board.getCell(4, 3).type).toBe('empty');
      expect(engine.board.getCell(4, 13).color).toBe(SUPPORT_WEIGHT_PIECE.color);
      expect(engine.board.getCell(4, 14).color).toBe(SUPPORT_WEIGHT_PIECE.color);
      expect(engine.board.getCell(4, 20).color).toBe(0);
      expect(engine.board.getCell(4, 21).color).toBe(1);
      expect(engine.board.getCell(6, 15).type).toBe('empty');
      expect(engine.board.getCell(5, 13).color).toBe(SUPPORT_WEIGHT_PIECE.color);
      expect(engine.board.getCell(5, 14).color).toBe(SUPPORT_WEIGHT_PIECE.color);
      expect(engine.board.getCell(5, 21).color).toBe(2);
      expect(engine.board.getCell(6, 13).color).toBe(SUPPORT_WEIGHT_PIECE.color);
      expect(engine.board.getCell(6, 14).color).toBe(SUPPORT_WEIGHT_PIECE.color);
      expect(engine.board.getCell(6, 21).color).toBe(3);
      expect(engine.activeChainText).toBe('ANCHOR DROP');
    });

    it('ends the run instead of partially locking a piece above the top of the board', () => {
      engine.start(new ClassicMode());
      engine.board.reset();

      const novaPiece = STANDARD_PIECES.find((piece) => piece.name === 'Nova');
      expect(novaPiece).toBeDefined();
      engine.currentPiece = new Piece(novaPiece!, 4, -1);

      engine['lockPiece']();

      expect(engine.state).toBe('game_over');
      expect(engine.currentPiece).toBeNull();
      expect(countFilledCells()).toBe(0);
    });

    it('ends the run instead of partially locking a piece outside the side wall', () => {
      engine.start(new ClassicMode());
      engine.board.reset();

      const sparkPiece = STANDARD_PIECES.find((piece) => piece.name === 'Spark');
      expect(sparkPiece).toBeDefined();
      engine.currentPiece = new Piece(sparkPiece!, -2, 3);

      engine['lockPiece']();

      expect(engine.state).toBe('game_over');
      expect(engine.currentPiece).toBeNull();
      expect(countFilledCells()).toBe(0);
    });

    it('tops out when a held piece cannot be re-entered safely', () => {
      engine.start(new ClassicMode());
      engine.board.reset();

      const heldDef = engine.currentPiece?.definition;
      const heldSpawnX = engine.currentPiece?.x ?? 0;
      const swapDef = STANDARD_PIECES.find((piece) => piece.name === 'Spark');
      expect(heldDef).toBeDefined();
      expect(swapDef).toBeDefined();

      engine.holdPiece = heldDef!;
      engine.currentPiece = new Piece(swapDef!, 4, 0);
      engine.canHold = true;

      const blockedCells = new Piece(heldDef!, heldSpawnX, 0).getOccupiedCells();
      expect(blockedCells.length).toBeGreaterThan(0);
      for (const cell of blockedCells) {
        if (cell.y >= 0) {
          engine.board.setCell(cell.x, cell.y, { type: 'block', color: 0 });
        }
      }

      engine['holdCurrentPiece']();

      expect(engine.state).toBe('game_over');
      expect(engine.currentPiece).toBeNull();
    });

    it('clears the active piece after a legal top-out lock so the game-over board is not double-drawn', () => {
      engine.start(new ClassicMode());
      engine.board.reset();

      engine.board.setCell(11, 0, { type: 'block', color: 0 });

      const bendPiece = STANDARD_PIECES.find((piece) => piece.name === 'Bend');
      expect(bendPiece).toBeDefined();
      engine.currentPiece = new Piece(bendPiece!, 0, 0);

      engine['lockPiece']();

      expect(engine.state).toBe('game_over');
      expect(engine.currentPiece).toBeNull();
      expect(countFilledCells()).toBe(4);
    });

    it('bomber mode does not request support-weight rescue pieces', () => {
      const mode = new BomberMode();
      engine.start(mode);
      engine.board.reset();

      expect(mode.getSpawnOverride?.(engine.board, 0, 20) ?? null).toBeNull();
    });

    it('resolves a completed armory weapon and destroys its attack area', () => {
      engine.start(new ArmoryMode());
      engine.board.reset();

      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          engine.board.setCell(4 + col, 12 + row, {
            type: 'block',
            color: 12,
            weaponId: 'bomb',
            fragmentIndex: row * 2 + col,
          });
        }
      }
      engine.board.setCell(3, 12, { type: 'block', color: 0 });

      engine['resolveArmoryMatches']();

      expect(engine.score).toBeGreaterThan(0);
      expect(engine.totalLinesCleared).toBe(1);
      expect(engine.board.getCell(3, 12).type).toBe('empty');
      expect(engine.activeChainText).toBe('BOMB BURST');
      expect(engine.currentPiece).not.toBeNull();
    });

    it('uses the shared chain call text for armory weapon chains', () => {
      engine.start(new ArmoryMode());
      engine.board.reset();

      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          engine.board.setCell(4 + col, 13 + row, {
            type: 'block',
            color: 14,
            weaponId: 'pan',
            fragmentIndex: row * 2 + col,
          });
        }
      }
      engine.board.setCell(1, 12, {
        type: 'block',
        color: 12,
        weaponId: 'bomb',
        fragmentIndex: 0,
      });

      engine['resolveArmoryMatches']();

      expect(engine.totalLinesCleared).toBe(2);
      expect(engine.activeChainText).toBe('Double Crush');
      expect(engine.score).toBe(1660);
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
      expect(engine.currentPiece!.getOccupiedCells().every((cell) => cell.x >= 0)).toBe(true);
    });

    it('stops at wall when moving right', () => {
      engine.start(new ClassicMode());
      engine.moveToColumn(100); // way off right
      expect(engine.currentPiece!.getOccupiedCells().every((cell) => cell.x < BOARD_WIDTH)).toBe(true);
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
