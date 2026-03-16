import {
  INITIAL_DROP_INTERVAL, SOFT_DROP_INTERVAL, LEVEL_SPEED_FACTOR,
  LINES_PER_LEVEL, LOCK_DELAY, BOMB_RADIUS_MEDIUM,
} from '@/lib/constants';
import { Board } from './Board';
import { Piece } from './Piece';
import { PieceFactory } from './PieceFactory';
import { CollisionDetector } from './CollisionDetector';
import { LineClearResolver } from './LineClearResolver';
import { BombResolver } from './BombResolver';
import { ScoreCalculator } from './ScoreCalculator';
import { ChainTextResolver } from './ChainTextResolver';
import { InputManager } from './InputManager';
import { GameMode, LineClearEvent } from './modes/GameMode';
import { ClassicMode } from './modes/ClassicMode';
import { GameState, PieceDefinition, VisualEvent } from './types';

export interface GameCallbacks {
  onScoreChange?: (score: number) => void;
  onLevelChange?: (level: number) => void;
  onLinesChange?: (lines: number) => void;
  onGameOver?: (score: number) => void;
  onLineClear?: (event: LineClearEvent) => void;
  onPieceLock?: () => void;
}

export class GameEngine {
  board: Board;
  currentPiece: Piece | null = null;
  holdPiece: PieceDefinition | null = null;
  canHold: boolean = true;
  nextPieces: PieceDefinition[] = [];
  state: GameState = 'title';
  score: number = 0;
  level: number = 0;
  totalLinesCleared: number = 0;
  mode: GameMode;

  private pieceFactory: PieceFactory;
  readonly inputManager: InputManager;
  private dropTimer: number = 0;
  private lockTimer: number = 0;
  private isLocking: boolean = false;
  private callbacks: GameCallbacks;

  // Active chain text display
  activeChainText: string = '';
  chainTextTimer: number = 0;
  chainEffectTier: number = -1;

  // Visual events queue (consumed by renderer each frame)
  visualEvents: VisualEvent[] = [];

  // Game over animation timer (ms elapsed since game over)
  gameOverTimer: number = 0;

  // Chain resolution state (bomber mode async animation)
  private chainDelay: number = 0;
  private chainCount: number = 0;
  private totalChainLines: number = 0;
  private totalChainCells: number = 0;
  private static readonly CHAIN_STEP_DELAY = 500; // ms between chain steps

  // Sequential bomb explosion state
  private bombQueue: Position[] = [];
  private bombExplodedSet: Set<string> = new Set();
  private bombDestroyedSet: Set<string> = new Set();
  private bombExplosionDelay: number = 0;
  private static readonly BOMB_EXPLOSION_DELAY = 300; // ms between individual bomb blasts
  private isBombExploding: boolean = false;
  private pendingRowsClear: number[] = [];

  constructor(callbacks: GameCallbacks = {}) {
    this.board = new Board();
    this.pieceFactory = new PieceFactory();
    this.inputManager = new InputManager();
    this.mode = new ClassicMode();
    this.callbacks = callbacks;
  }

  start(mode?: GameMode): void {
    if (mode) this.mode = mode;
    this.board.reset();
    this.pieceFactory.reset();
    this.score = 0;
    this.level = 0;
    this.totalLinesCleared = 0;
    this.holdPiece = null;
    this.canHold = true;
    this.activeChainText = '';
    this.chainTextTimer = 0;
    this.chainEffectTier = -1;
    this.dropTimer = 0;
    this.lockTimer = 0;
    this.isLocking = false;
    this.visualEvents = [];
    this.gameOverTimer = 0;

    this.pieceFactory.assignBombs = this.mode.shouldIncludeBombs();
    this.updateNextPieces();
    this.spawnPiece();
    this.state = 'playing';
    this.inputManager.bind();
    this.inputManager.resetAll();
  }

  stop(): void {
    this.state = 'game_over';
    this.inputManager.unbind();
    this.callbacks.onGameOver?.(this.score);
  }

  pause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
    } else if (this.state === 'paused') {
      this.state = 'playing';
    }
  }

  destroy(): void {
    this.inputManager.unbind();
  }

  tick(deltaTime: number): void {
    // Chain text fade (runs in both playing and chain_resolving)
    if (this.chainTextTimer > 0) {
      this.chainTextTimer -= deltaTime;
      if (this.chainTextTimer <= 0) {
        this.activeChainText = '';
        this.chainEffectTier = -1;
      }
    }

    if (this.state === 'chain_resolving') {
      // Sequential bomb explosions
      if (this.isBombExploding) {
        this.bombExplosionDelay -= deltaTime;
        if (this.bombExplosionDelay <= 0) {
          this.explodeNextBomb();
        }
        return;
      }

      // Delay between chain steps (after all bombs in a step finish)
      this.chainDelay -= deltaTime;
      if (this.chainDelay <= 0) {
        this.executeBomberChainStep();
      }
      return;
    }

    if (this.state !== 'playing') return;

    this.inputManager.update(deltaTime);
    this.processInput(deltaTime);
    this.updateDrop(deltaTime);
  }

  private processInput(deltaTime: number): void {
    if (!this.currentPiece) return;

    // Pause
    if (this.inputManager.isJustPressed('pause')) {
      this.pause();
      return;
    }

    // Hold
    if (this.inputManager.isJustPressed('hold')) {
      this.holdCurrentPiece();
      return;
    }

    // Rotate
    if (this.inputManager.isJustPressed('rotateCW')) {
      this.rotatePiece(1);
    }
    if (this.inputManager.isJustPressed('rotateCCW')) {
      this.rotatePiece(-1);
    }

    // Hard drop
    if (this.inputManager.isJustPressed('hardDrop')) {
      this.hardDrop();
      return;
    }

    // Horizontal movement with DAS
    if (this.inputManager.isDASActive('left', deltaTime)) {
      this.movePiece(-1, 0);
    }
    if (this.inputManager.isDASActive('right', deltaTime)) {
      this.movePiece(1, 0);
    }

    // Soft drop
    if (this.inputManager.isPressed('down')) {
      this.dropTimer += deltaTime * 10; // accelerate drop
    }
  }

  private updateDrop(deltaTime: number): void {
    if (!this.currentPiece) return;

    // Check if piece is on ground
    const canMoveDown = CollisionDetector.canMove(this.board, this.currentPiece, 0, 1);

    if (canMoveDown) {
      this.isLocking = false;
      this.lockTimer = 0;

      const dropInterval = this.getDropInterval();
      this.dropTimer += deltaTime;

      if (this.dropTimer >= dropInterval) {
        this.dropTimer = 0;
        this.currentPiece.y += 1;

        // Soft drop score
        if (this.inputManager.isPressed('down')) {
          this.addScore(ScoreCalculator.getSoftDropScore(1));
        }
      }
    } else {
      // Piece can't move down - lock delay (incremented every frame)
      if (!this.isLocking) {
        this.isLocking = true;
        this.lockTimer = 0;
      }
      this.lockTimer += deltaTime;

      if (this.lockTimer >= LOCK_DELAY) {
        this.lockPiece();
      }
    }
  }

  private movePiece(dx: number, dy: number): boolean {
    if (!this.currentPiece) return false;
    if (CollisionDetector.canMove(this.board, this.currentPiece, dx, dy)) {
      this.currentPiece.x += dx;
      this.currentPiece.y += dy;
      // Reset lock delay on successful move
      if (this.isLocking) {
        this.lockTimer = 0;
      }
      return true;
    }
    return false;
  }

  private rotatePiece(direction: 1 | -1): void {
    if (!this.currentPiece) return;
    const rotated = CollisionDetector.canRotate(this.board, this.currentPiece, direction);
    if (rotated) {
      this.currentPiece = rotated;
      if (this.isLocking) {
        this.lockTimer = 0;
      }
    }
  }

  private hardDrop(): void {
    if (!this.currentPiece) return;
    const ghostY = CollisionDetector.getGhostY(this.board, this.currentPiece);
    const distance = ghostY - this.currentPiece.y;
    this.currentPiece.y = ghostY;
    this.addScore(ScoreCalculator.getHardDropScore(distance));
    this.lockPiece();
  }

  private lockPiece(): void {
    if (!this.currentPiece) return;

    const useBombs = this.mode.shouldIncludeBombs();

    // Place piece on board
    const matrix = this.currentPiece.getMatrix();
    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        if (matrix[row][col] === 1) {
          const bx = this.currentPiece.x + col;
          const by = this.currentPiece.y + row;
          const isBomb = useBombs && this.currentPiece.isBombAt(col, row);
          this.board.setCell(bx, by, {
            type: isBomb ? 'bomb' : 'block',
            color: isBomb ? 8 : this.currentPiece.definition.color,
            megaBomb: isBomb && this.currentPiece.isMegaBomb ? true : undefined,
          });
        }
      }
    }

    this.callbacks.onPieceLock?.();
    this.isLocking = false;
    this.lockTimer = 0;
    this.canHold = true;

    if (useBombs) {
      // Promote any 2x2 bomb clusters to mega bombs
      this.promoteBombClusters();
      // Async chain resolution - will call afterChainComplete() when done
      this.beginBomberChain();
      return;
    } else {
      this.resolveClassicLineClear();
    }

    // Check game over
    if (this.mode.isGameOver(this.board)) {
      this.stop();
      return;
    }

    // Spawn next piece
    this.spawnPiece();
  }

  /** Classic mode: simple line clear with no bomb logic */
  private resolveClassicLineClear(): void {
    const fullRows = this.board.getFullRows();
    if (fullRows.length === 0) return;

    // Emit line clear visual event BEFORE clearing
    this.visualEvents.push({ type: 'line_clear', rows: [...fullRows] });

    const result = LineClearResolver.resolve(this.board);
    if (result.linesCleared > 0) {
      const event = this.mode.onLineClear(result.linesCleared, this.level);
      this.addScore(event.score);
      this.totalLinesCleared += result.linesCleared;
      this.callbacks.onLinesChange?.(this.totalLinesCleared);

      if (event.text) {
        this.activeChainText = event.text;
        this.chainTextTimer = 2000;
        this.chainEffectTier = event.effectTier;
      }

      this.updateLevel();
      this.callbacks.onLineClear?.(event);
    }
  }

  /** Bomber mode: begin async chain resolution */
  private beginBomberChain(): void {
    const fullRows = this.board.getFullRows();
    if (fullRows.length === 0) {
      // No lines to clear, just proceed
      this.afterChainComplete();
      return;
    }

    // Initialize chain state
    this.chainCount = 0;
    this.totalChainLines = 0;
    this.totalChainCells = 0;
    this.state = 'chain_resolving';
    this.currentPiece = null; // hide piece during chain

    // Execute first step immediately
    this.doChainStep(fullRows);
  }

  /** Execute one chain step: clear rows → explode bombs sequentially → gravity */
  private doChainStep(fullRows: number[]): void {
    // Emit line clear visual event
    this.visualEvents.push({ type: 'line_clear', rows: [...fullRows] });

    // Find bombs in the full rows BEFORE clearing
    const bombsInRows = BombResolver.findBombsInRows(this.board, fullRows);

    // Save rows to clear after all bombs finish
    this.pendingRowsClear = fullRows;

    if (bombsInRows.length > 0) {
      // Start sequential bomb explosion
      this.bombQueue = [...bombsInRows];
      this.bombExplodedSet = new Set();
      this.bombDestroyedSet = new Set();
      this.isBombExploding = true;
      // Explode first bomb immediately
      this.explodeNextBomb();
    } else {
      // No bombs, just clear rows normally
      this.finishChainStep(fullRows);
    }
  }

  /** Explode the next bomb in the queue */
  private explodeNextBomb(): void {
    // Find next un-exploded bomb
    while (this.bombQueue.length > 0) {
      const bomb = this.bombQueue.shift()!;
      const bombKey = `${bomb.x},${bomb.y}`;

      if (this.bombExplodedSet.has(bombKey)) continue;
      this.bombExplodedSet.add(bombKey);

      // Check if the bomb cell still exists (might have been destroyed by a previous explosion)
      const cell = this.board.getCell(bomb.x, bomb.y);
      if (cell.type !== 'bomb') continue;

      // Explode this single bomb
      const result = BombResolver.explodeOne(
        this.board, bomb, BOMB_RADIUS_MEDIUM, this.bombDestroyedSet,
      );
      this.totalChainCells += result.destroyedCells.length;

      // Emit visual event for this single explosion
      this.visualEvents.push({
        type: 'explosion',
        cells: result.destroyedCells,
        chainCount: this.bombExplodedSet.size,
        blastCenters: [{ x: result.center.x, y: result.center.y, radius: result.radius }],
      });

      // Add triggered bombs to queue
      for (const tb of result.triggeredBombs) {
        const tbKey = `${tb.x},${tb.y}`;
        if (!this.bombExplodedSet.has(tbKey)) {
          this.bombQueue.push(tb);
        }
      }

      // Set delay before next bomb
      this.bombExplosionDelay = GameEngine.BOMB_EXPLOSION_DELAY;
      return; // Wait for delay before processing next
    }

    // All bombs processed, finish the chain step
    this.isBombExploding = false;
    this.finishChainStep(this.pendingRowsClear);
  }

  /** Finish a chain step after all bombs have exploded */
  private finishChainStep(fullRows: number[]): void {
    // Clear the full rows
    this.board.clearRows(fullRows);
    this.totalChainLines += fullRows.length;

    // Apply gravity
    this.board.applyGravity();

    this.chainCount++;

    // Show chain text for this step
    const text = this.chainCount > 1
      ? ChainTextResolver.getChainText(this.chainCount)
      : ChainTextResolver.getClassicText(fullRows.length);
    const tier = this.chainCount > 1
      ? ChainTextResolver.getEffectTier(this.chainCount)
      : ChainTextResolver.getClassicEffectTier(fullRows.length);
    if (text) {
      this.activeChainText = text;
      this.chainTextTimer = 2500;
      this.chainEffectTier = tier;
    }

    // Wait before checking for next chain step
    this.chainDelay = GameEngine.CHAIN_STEP_DELAY;
  }

  /** Called by tick() when chainDelay expires during chain_resolving */
  private executeBomberChainStep(): void {
    const fullRows = this.board.getFullRows();
    if (fullRows.length > 0 && this.chainCount < 50) {
      this.doChainStep(fullRows);
    } else {
      this.finalizeBomberChain();
    }
  }

  /** Finalize chain: apply score and return to playing */
  private finalizeBomberChain(): void {
    if (this.totalChainLines > 0 || this.totalChainCells > 0) {
      let score = 0;
      if (this.totalChainLines > 0) {
        score += ScoreCalculator.getLineClearScore(this.totalChainLines, this.level);
      }
      if (this.totalChainCells > 0) {
        score += ScoreCalculator.getBombScore(this.totalChainCells, this.chainCount, this.level);
      }
      this.addScore(score);

      if (this.totalChainLines > 0) {
        this.totalLinesCleared += this.totalChainLines;
        this.callbacks.onLinesChange?.(this.totalLinesCleared);
        this.updateLevel();
      }
    }

    this.afterChainComplete();
  }

  /** After chain (or no chain): check game over, spawn piece */
  private afterChainComplete(): void {
    if (this.mode.isGameOver(this.board)) {
      this.stop();
      return;
    }
    this.state = 'playing';
    this.spawnPiece();
  }

  /**
   * Gravity mode: apply column gravity → check lines → destroy cells → repeat.
   * Unlike classic mode, full rows have their cells destroyed (not spliced),
   * so blocks above fall down individually, potentially creating chains.
   */
  /** Scan the board for 2x2 bomb clusters and promote them to megaBomb */
  private promoteBombClusters(): void {
    for (let y = 0; y < BOARD_HEIGHT - 1; y++) {
      for (let x = 0; x < BOARD_WIDTH - 1; x++) {
        const c00 = this.board.getCell(x, y);
        const c10 = this.board.getCell(x + 1, y);
        const c01 = this.board.getCell(x, y + 1);
        const c11 = this.board.getCell(x + 1, y + 1);
        if (
          c00.type === 'bomb' && c10.type === 'bomb' &&
          c01.type === 'bomb' && c11.type === 'bomb'
        ) {
          // Promote all 4 to mega bomb
          if (!c00.megaBomb) this.board.setCell(x, y, { ...c00, megaBomb: true });
          if (!c10.megaBomb) this.board.setCell(x + 1, y, { ...c10, megaBomb: true });
          if (!c01.megaBomb) this.board.setCell(x, y + 1, { ...c01, megaBomb: true });
          if (!c11.megaBomb) this.board.setCell(x + 1, y + 1, { ...c11, megaBomb: true });
        }
      }
    }
  }

  private updateLevel(): void {
    const newLevel = Math.floor(this.totalLinesCleared / LINES_PER_LEVEL);
    if (newLevel > this.level) {
      this.level = newLevel;
      this.callbacks.onLevelChange?.(this.level);
    }
  }

  private holdCurrentPiece(): void {
    if (!this.currentPiece || !this.canHold) return;

    const currentDef = this.currentPiece.definition;

    if (this.holdPiece) {
      // Swap with held piece
      const heldDef = this.holdPiece;
      this.holdPiece = currentDef;
      this.currentPiece = this.pieceFactory['createPiece'](heldDef);
    } else {
      this.holdPiece = currentDef;
      this.spawnPiece();
    }

    this.canHold = false;
  }

  private spawnPiece(): void {
    this.currentPiece = this.pieceFactory.next();
    this.updateNextPieces();
    this.dropTimer = 0;

    // Check if spawn position is blocked
    if (!CollisionDetector.canPlace(this.board, this.currentPiece)) {
      this.stop();
    }
  }

  private updateNextPieces(): void {
    this.nextPieces = this.pieceFactory.peek(3);
  }

  private getDropInterval(): number {
    if (this.inputManager.isPressed('down')) {
      return SOFT_DROP_INTERVAL;
    }
    return INITIAL_DROP_INTERVAL * Math.pow(LEVEL_SPEED_FACTOR, this.level);
  }

  private addScore(points: number): void {
    this.score += points;
    this.callbacks.onScoreChange?.(this.score);
  }

  getGhostY(): number {
    if (!this.currentPiece) return 0;
    return CollisionDetector.getGhostY(this.board, this.currentPiece);
  }

  /** Move piece so its center aligns with the given board column */
  moveToColumn(targetColumn: number): void {
    if (!this.currentPiece || this.state !== 'playing') return;

    // Calculate piece center offset (half of piece width in its current matrix)
    const matrix = this.currentPiece.getMatrix();
    const pieceWidth = matrix[0]?.length || 0;
    const centerOffset = Math.floor(pieceWidth / 2);

    // Target x for the piece origin so its center is at targetColumn
    const targetX = targetColumn - centerOffset;
    const currentX = this.currentPiece.x;
    const delta = targetX - currentX;

    if (delta === 0) return;

    const direction = delta > 0 ? 1 : -1;
    const steps = Math.abs(delta);

    for (let i = 0; i < steps; i++) {
      if (!CollisionDetector.canMove(this.board, this.currentPiece, direction, 0)) break;
      this.currentPiece.x += direction;
      if (this.isLocking) {
        this.lockTimer = 0;
      }
    }
  }

  // Current drop speed (lower = faster)
  getSpeed(): number {
    return Math.round(INITIAL_DROP_INTERVAL * Math.pow(LEVEL_SPEED_FACTOR, this.level));
  }
}
