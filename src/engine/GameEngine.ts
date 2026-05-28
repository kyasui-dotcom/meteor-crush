import {
  INITIAL_DROP_INTERVAL, SOFT_DROP_INTERVAL, LEVEL_SPEED_FACTOR,
  LINES_PER_LEVEL, LOCK_DELAY, BOMB_RADIUS_MEDIUM,
  BOARD_WIDTH, BOARD_HEIGHT,
} from '@/lib/constants';
import { Board } from './Board';
import { Piece } from './Piece';
import { PieceFactory } from './PieceFactory';
import { CollisionDetector } from './CollisionDetector';
import { LineClearResolver } from './LineClearResolver';
import { BombResolver } from './BombResolver';
import { ArmoryResolver } from './ArmoryResolver';
import { CoreMatchResolver } from './CoreMatchResolver';
import { ScoreCalculator } from './ScoreCalculator';
import { ChainTextResolver } from './ChainTextResolver';
import { InputManager } from './InputManager';
import { GameMode, LineClearEvent } from './modes/GameMode';
import { ClassicMode } from './modes/ClassicMode';
import { GameState, PieceDefinition, Position, VisualEvent } from './types';

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
  private purifyStage: number = 1;

  constructor(callbacks: GameCallbacks = {}) {
    this.board = new Board();
    this.pieceFactory = new PieceFactory();
    this.inputManager = new InputManager();
    this.mode = new ClassicMode();
    this.callbacks = callbacks;
  }

  start(mode?: GameMode): void {
    if (mode) this.mode = mode;
    this.state = 'playing';
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
    this.purifyStage = 1;

    this.pieceFactory.configure({
      pieceSet: this.mode.getPieceSet?.(),
      allowComets: this.mode.allowComets?.(),
    });
    this.pieceFactory.assignBombs = this.mode.shouldIncludeBombs();
    this.mode.initializeBoard?.(this.board, this.purifyStage);
    this.updateNextPieces();
    this.spawnPiece();
    if (this.state !== 'playing') {
      this.inputManager.resetAll();
      return;
    }
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
    const lockedPiece = this.currentPiece;
    const occupiedCells = lockedPiece.getOccupiedCells();
    if (occupiedCells.some((cell) => !this.board.isInBounds(cell.x, cell.y))) {
      this.currentPiece = null;
      this.stop();
      return;
    }
    const lockedCells: Position[] = [];

    // Place piece on board
    const matrix = lockedPiece.getMatrix();
    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        if (matrix[row][col] === 1) {
          const bx = lockedPiece.x + col;
          const by = lockedPiece.y + row;
          const isBomb = useBombs && lockedPiece.isBombAt(col, row);
          const isFire = useBombs && lockedPiece.isFireAt(col, row);
          const bombKind = isBomb ? lockedPiece.getBombKindAt(col, row) : null;
          const fragment = lockedPiece.getArmoryFragmentAt(col, row);
          lockedCells.push({ x: bx, y: by });
          this.board.setCell(bx, by, {
            type: isBomb ? 'bomb' : 'block',
            color: isBomb
              ? bombKind === 'thunder'
                ? 16
                : bombKind === 'cluster'
                  ? 17
                  : 8
              : isFire
                ? 15
                : lockedPiece.getColorAt(col, row),
            megaBomb: undefined,
            megaBombAnchorX: undefined,
            megaBombAnchorY: undefined,
            fire: isFire ? true : undefined,
            bombKind: bombKind ?? undefined,
            weaponId: fragment?.weaponId,
            fragmentIndex: fragment?.fragmentIndex,
          });
        }
      }
    }
    this.currentPiece = null;

    if (lockedPiece.definition.special === 'supportWeight') {
      const compressedCells = this.applySupportWeight(lockedPiece);
      lockedCells.push(...compressedCells);

      if (compressedCells.length > 0) {
        this.activeChainText = 'ANCHOR DROP';
        this.chainTextTimer = 1800;
        this.chainEffectTier = 1;
      }
    }

    this.callbacks.onPieceLock?.();
    this.isLocking = false;
    this.lockTimer = 0;
    this.canHold = true;

    if (useBombs) {
      this.refreshMegaBombs();
      // Async ignition / chain resolution - will call afterChainComplete() when done
      this.beginBomberChain();
      return;
    } else if (this.mode.type === 'armory') {
      this.resolveArmoryMatches();
      return;
    } else if (this.mode.type === 'purify') {
      if (lockedPiece.definition.special === 'rescueColony') {
        this.resolvePurifyRescueColony(lockedCells);
      } else {
        this.resolvePurifyMatches();
      }
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

  private resolveArmoryMatches(): void {
    let chainCount = 0;

    while (true) {
      const result = ArmoryResolver.resolve(this.board);
      if (result.weapons.length === 0) break;

      chainCount++;

      for (const weapon of result.weapons) {
        this.visualEvents.push({
          type: 'explosion',
          cells: weapon.effectCells,
          chainCount,
          blastCenters: weapon.blastCenters,
          weaponId: weapon.weaponId,
          power: weapon.power,
          durationMs: weapon.power > 1 ? 1200 : undefined,
        });
      }

      const armoryChainCount = Math.max(chainCount, result.weapons.length);
      this.addScore(ScoreCalculator.getArmoryScore(
        result.weapons.length,
        result.destroyedCells.length,
        armoryChainCount,
        this.level,
      ));

      this.totalLinesCleared += result.weapons.length;
      this.callbacks.onLinesChange?.(this.totalLinesCleared);
      this.updateLevel();

      const { text, tier } = ChainTextResolver.getSingleOrChainPresentation(
        Math.max(chainCount, result.weapons.length),
        result.weapons[0]?.activationText ?? '',
        1,
      );
      this.activeChainText = text;
      this.chainTextTimer = 2300;
      this.chainEffectTier = tier;

      this.board.applyGravity();
    }

    if (this.mode.isGameOver(this.board)) {
      this.stop();
      return;
    }

    this.spawnPiece();
  }

  private resolvePurifyMatches(): void {
    let chainCount = 0;

    while (true) {
      const result = CoreMatchResolver.resolve(this.board);
      if (result.clearedCells.length === 0) break;

      chainCount++;
      this.visualEvents.push({
        type: 'explosion',
        cells: result.clearedCells,
        chainCount,
      });

      const score = ScoreCalculator.getPurifyScore(
        result.clearedCells.length,
        result.clearedCoreCount,
        chainCount,
        this.level,
      );
      this.addScore(score);

      const equivalentLines = Math.max(1, Math.floor(result.clearedCells.length / 5));
      this.totalLinesCleared += equivalentLines;
      this.callbacks.onLinesChange?.(this.totalLinesCleared);
      this.updateLevel();

      const { text, tier } = ChainTextResolver.getSingleOrChainPresentation(
        chainCount,
        result.clearedCoreCount > 0 ? 'Purify' : 'Crush',
        result.clearedCoreCount > 0 ? 2 : 1,
      );
      this.activeChainText = text;
      this.chainEffectTier = tier;
      this.chainTextTimer = 2200;

      this.board.applyGravity();
    }

    if (this.board.getCoreCount() === 0) {
      this.handlePurifyBoardClear();
    }

    if (this.mode.isGameOver(this.board)) {
      this.stop();
      return;
    }

    this.spawnPiece();
  }

  private resolvePurifyRescueColony(colonyCells: Position[]): void {
    const impact = this.collectRescueColonyTargets(colonyCells);

    if (impact.clearedCells.length > 0) {
      this.visualEvents.push({
        type: 'explosion',
        cells: impact.clearedCells,
        chainCount: 4,
      });

      this.addScore(ScoreCalculator.getRescueColonyScore(
        impact.clearedCells.length,
        impact.clearedCoreCount,
        this.level,
      ));

      const equivalentLines = Math.max(2, Math.floor(impact.clearedCells.length / 6));
      this.totalLinesCleared += equivalentLines;
      this.callbacks.onLinesChange?.(this.totalLinesCleared);
      this.updateLevel();

      this.activeChainText = impact.clearedCoreCount > 0 ? 'RESCUE COLONY' : 'COLONY DROP';
      this.chainTextTimer = 2400;
      this.chainEffectTier = 3;
    }

    this.board.applyGravity();
    this.resolvePurifyMatches();
  }

  private collectRescueColonyTargets(colonyCells: Position[]): { clearedCells: Position[]; clearedCoreCount: number } {
    if (colonyCells.length === 0) {
      return { clearedCells: [], clearedCoreCount: 0 };
    }

    const xs = colonyCells.map((cell) => cell.x);
    const ys = colonyCells.map((cell) => cell.y);
    const minX = Math.max(0, Math.min(...xs) - 2);
    const maxX = Math.min(BOARD_WIDTH - 1, Math.max(...xs) + 2);
    const minY = Math.max(0, Math.min(...ys) - 2);
    const maxY = Math.min(BOARD_HEIGHT - 1, Math.max(...ys) + 2);

    const clearedCells: Position[] = [];
    let clearedCoreCount = 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cell = this.board.getCell(x, y);
        if (cell.type === 'empty') continue;

        if (cell.core) {
          clearedCoreCount++;
        }

        clearedCells.push({ x, y });
        this.board.destroyCell(x, y);
      }
    }

    return { clearedCells, clearedCoreCount };
  }

  private applySupportWeight(lockedPiece: Piece): Position[] {
    const occupiedCells = lockedPiece.getOccupiedCells();
    const affectedColumns = new Map<number, Set<number>>();
    for (const cell of occupiedCells) {
      const ys = affectedColumns.get(cell.x) ?? new Set<number>();
      ys.add(cell.y);
      affectedColumns.set(cell.x, ys);
    }

    const compressedCells: Position[] = [];
    for (const [x, lockedYs] of affectedColumns) {
      const settledCells: { y: number; cell: ReturnType<Board['getCell']> }[] = [];
      for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
        const cell = this.board.getCell(x, y);
        if (cell.type === 'empty') continue;
        if (lockedYs.has(y)) continue;
        settledCells.push({ y, cell: { ...cell } });
      }

      for (let y = 0; y < BOARD_HEIGHT; y++) {
        this.board.destroyCell(x, y);
      }

      for (const y of lockedYs) {
        this.board.setCell(x, y, {
          type: 'block',
          color: lockedPiece.definition.color,
        });
      }

      const availableYs: number[] = [];
      for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
        if (!lockedYs.has(y)) {
          availableYs.push(y);
        }
      }

      let writeIndex = 0;
      for (const entry of settledCells) {
        const writeY = availableYs[writeIndex++];
        if (typeof writeY !== 'number') {
          break;
        }
        this.board.setCell(x, writeY, entry.cell);
        if (entry.y !== writeY) {
          compressedCells.push({ x, y: writeY });
        }
      }
    }

    return compressedCells;
  }

  private handlePurifyBoardClear(): void {
    this.addScore(ScoreCalculator.getPurifyWaveBonus(this.purifyStage));
    this.totalLinesCleared += 2;
    this.callbacks.onLinesChange?.(this.totalLinesCleared);
    this.updateLevel();
    this.purifyStage += 1;
    this.board.reset();
    this.mode.initializeBoard?.(this.board, this.purifyStage);
    this.activeChainText = 'AREA PURIFIED';
    this.chainTextTimer = 2600;
    this.chainEffectTier = 3;
  }

  /** Bomber mode: begin async chain resolution (bombs only — no line clearing) */
  private beginBomberChain(): void {
    this.refreshMegaBombs();
    const ignitedBombs = BombResolver.findIgnitedBombs(this.board);

    if (ignitedBombs.length === 0) {
      // No bomb is touching fire → nothing to ignite, just proceed
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
    this.doChainStep(ignitedBombs);
  }

  /** Execute one chain step: ignite all bombs currently touching fire, then resolve chained blasts */
  private doChainStep(ignitedBombs: Position[]): void {
    // Start sequential bomb explosion
    this.bombQueue = [...ignitedBombs];
    this.bombExplodedSet = new Set();
    this.bombDestroyedSet = new Set();
    this.isBombExploding = true;
    // Explode first bomb immediately
    this.explodeNextBomb();
  }

  /** Explode the next bomb in the queue */
  private explodeNextBomb(): void {
    // Find next un-exploded bomb
    while (this.bombQueue.length > 0) {
      const bomb = this.bombQueue.shift()!;
      const cell = this.board.getCell(bomb.x, bomb.y);
      if (cell.type !== 'bomb') continue;

      const bombKey = BombResolver.getBombIdentityKey(this.board, bomb);
      if (this.bombExplodedSet.has(bombKey)) continue;
      this.bombExplodedSet.add(bombKey);

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
        durationMs: 1000,
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
    this.finishChainStep();
  }

  /** Finish a chain step after all bombs have exploded */
  private finishChainStep(): void {
    // Apply gravity so blocks above destroyed cells fall down
    this.board.applyGravity();
    this.refreshMegaBombs();

    this.chainCount++;

    // Show chain text for this step
    const { text, tier } = ChainTextResolver.getChainPresentation(this.chainCount);
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
    // After gravity, check if any bombs are now touching fire blocks
    const ignitedBombs = BombResolver.findIgnitedBombs(this.board);

    if (ignitedBombs.length > 0 && this.chainCount < 50) {
      this.doChainStep(ignitedBombs);
    } else {
      this.finalizeBomberChain();
    }
  }

  /** Finalize chain: apply bomb score and return to playing */
  private finalizeBomberChain(): void {
    if (this.totalChainCells > 0) {
      const score = ScoreCalculator.getBombScore(this.totalChainCells, this.chainCount, this.level);
      this.addScore(score);

      // Count destroyed cells as "lines" for level progression
      const equivalentLines = Math.floor(this.totalChainCells / BOARD_WIDTH);
      if (equivalentLines > 0) {
        this.totalLinesCleared += equivalentLines;
        this.callbacks.onLinesChange?.(this.totalLinesCleared);
        this.updateLevel();
      }
    }

    this.afterChainComplete();
  }

  private refreshMegaBombs(): void {
    const claimed = new Set<string>();

    for (let y = 0; y < BOARD_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const cell = this.board.getCell(x, y);
        if (cell.type !== 'bomb' || (cell.megaBomb !== true && typeof cell.megaBombAnchorX !== 'number' && typeof cell.megaBombAnchorY !== 'number')) {
          continue;
        }

        this.board.setCell(x, y, {
          ...cell,
          megaBomb: undefined,
          megaBombAnchorX: undefined,
          megaBombAnchorY: undefined,
        });
      }
    }

    for (let y = 0; y < BOARD_HEIGHT - 1; y++) {
      for (let x = 0; x < BOARD_WIDTH - 1; x++) {
        const cluster = [
          { x, y },
          { x: x + 1, y },
          { x, y: y + 1 },
          { x: x + 1, y: y + 1 },
        ];

        if (cluster.some((entry) => claimed.has(`${entry.x},${entry.y}`))) {
          continue;
        }

        const cells = cluster.map((entry) => this.board.getCell(entry.x, entry.y));
        if (cells.some((cell) => cell.type !== 'bomb')) {
          continue;
        }

        const bombKind = cells[0].bombKind ?? 'normal';
        if (cells.some((cell) => (cell.bombKind ?? 'normal') !== bombKind)) {
          continue;
        }

        for (const entry of cluster) {
          claimed.add(`${entry.x},${entry.y}`);
          const cell = this.board.getCell(entry.x, entry.y);
          this.board.setCell(entry.x, entry.y, {
            ...cell,
            megaBomb: true,
            megaBombAnchorX: x,
            megaBombAnchorY: y,
          });
        }
      }
    }
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
      this.activateSpawnedPiece(this.pieceFactory.createPieceFromDefinition(heldDef));
    } else {
      this.holdPiece = currentDef;
      this.spawnPiece();
    }

    this.canHold = false;
  }

  private spawnPiece(): void {
    const override = this.mode.getSpawnOverride?.(this.board, this.purifyStage, this.level) ?? null;
    const nextPiece = override
      ? this.pieceFactory.createPieceFromDefinition(override)
      : this.pieceFactory.next();
    this.updateNextPieces();
    this.activateSpawnedPiece(nextPiece);
  }

  private activateSpawnedPiece(piece: Piece): void {
    this.currentPiece = piece;
    this.dropTimer = 0;
    this.lockTimer = 0;
    this.isLocking = false;

    if (!CollisionDetector.canPlace(this.board, piece)) {
      this.currentPiece = null;
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

  getRemainingCoreCount(): number {
    return this.mode.type === 'purify' ? this.board.getCoreCount() : 0;
  }

  getArmoryWeaponCount(): number {
    return this.mode.type === 'armory' ? this.totalLinesCleared : 0;
  }
}
