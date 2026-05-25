import { BOMB_RADIUS_LARGE } from '@/lib/constants';
import { Board } from './Board';
import { BombKind, Position } from './types';

export interface SingleBombResult {
  center: Position;
  radius: number;
  destroyedCells: Position[];
  /** New bombs triggered by this explosion (for sequential chaining) */
  triggeredBombs: Position[];
}

export interface BombResult {
  destroyedCells: Position[];
  chainBombCount: number;
  blastCenters: { x: number; y: number; radius: number }[];
}

export class BombResolver {
  static getBombIdentityKey(board: Board, bomb: Position): string {
    const cell = board.getCell(bomb.x, bomb.y);
    if (
      cell.type === 'bomb' &&
      cell.megaBomb === true &&
      typeof cell.megaBombAnchorX === 'number' &&
      typeof cell.megaBombAnchorY === 'number'
    ) {
      return `mega:${cell.megaBombAnchorX},${cell.megaBombAnchorY}`;
    }
    return `${bomb.x},${bomb.y}`;
  }

  /**
   * Explode a single bomb and return the result WITHOUT chaining.
   * Finds new bombs in the blast shape and returns them as triggeredBombs.
   * The caller is responsible for scheduling the next explosions.
   */
  static explodeOne(
    board: Board,
    bomb: Position,
    radius: number,
    alreadyDestroyed: Set<string>,
  ): SingleBombResult {
    const cell = board.getCell(bomb.x, bomb.y);
    const sourceCells = BombResolver.getBombCluster(board, bomb);
    const isMegaBomb = cell.type === 'bomb' && cell.megaBomb === true && sourceCells.length === 4;
    const effectiveRadius = isMegaBomb ? BOMB_RADIUS_LARGE : radius;
    const bombKind = cell.type === 'bomb' ? (cell.bombKind ?? 'normal') : 'normal';
    const blastCells = BombResolver.getBlastCellsForSource(board, sourceCells, bombKind, effectiveRadius);
    const sourceKeys = new Set(sourceCells.map((entry) => `${entry.x},${entry.y}`));
    const center = BombResolver.getBlastCenter(sourceCells, bomb);

    const destroyed: Position[] = [];
    const triggeredBombs: Position[] = [];

    for (const target of blastCells) {
      const key = `${target.x},${target.y}`;
      if (alreadyDestroyed.has(key)) continue;

      const ncell = board.getCell(target.x, target.y);
      if (ncell.type === 'empty') continue;

      if (ncell.type === 'bomb' && !sourceKeys.has(key)) {
        triggeredBombs.push({ x: target.x, y: target.y });
        continue;
      }

      alreadyDestroyed.add(key);
      destroyed.push({ x: target.x, y: target.y });
      board.destroyCell(target.x, target.y);
    }

    return {
      center,
      radius: BombResolver.getBlastDisplayRadius(center, blastCells),
      destroyedCells: destroyed,
      triggeredBombs,
    };
  }

  /**
   * Resolve all bomb explosions at once (legacy, used for tests).
   */
  static resolve(board: Board, initialBombs: Position[], radius: number): BombResult {
    const destroyed = new Set<string>();
    const exploded = new Set<string>();
    const queue: Position[] = [...initialBombs];
    let chainBombCount = 0;
    const blastCenters: { x: number; y: number; radius: number }[] = [];

    while (queue.length > 0) {
      const bomb = queue.shift()!;
      const cell = board.getCell(bomb.x, bomb.y);
      if (cell.type !== 'bomb') continue;

      const bombKey = BombResolver.getBombIdentityKey(board, bomb);

      if (exploded.has(bombKey)) continue;
      exploded.add(bombKey);
      chainBombCount++;

      const result = BombResolver.explodeOne(board, bomb, radius, destroyed);
      blastCenters.push({
        x: result.center.x,
        y: result.center.y,
        radius: result.radius,
      });

      for (const target of result.triggeredBombs) {
        const triggerKey = BombResolver.getBombIdentityKey(board, target);
        if (exploded.has(triggerKey)) continue;
        queue.push(target);
      }
    }

    const destroyedCells = Array.from(destroyed).map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });

    return { destroyedCells, chainBombCount, blastCenters };
  }

  static findIgnitedBombs(board: Board): Position[] {
    const ignited: Position[] = [];
    const seen = new Set<string>();
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const cell = board.getCell(x, y);
        if (cell.type !== 'bomb') continue;
        if (!BombResolver.hasAdjacentFire(board, x, y)) continue;
        const key = BombResolver.getBombIdentityKey(board, { x, y });
        if (seen.has(key)) continue;
        seen.add(key);
        ignited.push({ x, y });
      }
    }
    return ignited;
  }

  private static hasAdjacentFire(board: Board, x: number, y: number): boolean {
    const neighbors = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const;

    return neighbors.some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (!board.isInBounds(nx, ny)) return false;
      return board.getCell(nx, ny).fire === true;
    });
  }

  private static getBombCluster(board: Board, bomb: Position): Position[] {
    const cell = board.getCell(bomb.x, bomb.y);
    if (
      cell.type !== 'bomb' ||
      cell.megaBomb !== true ||
      typeof cell.megaBombAnchorX !== 'number' ||
      typeof cell.megaBombAnchorY !== 'number'
    ) {
      return [bomb];
    }

    const anchorX = cell.megaBombAnchorX;
    const anchorY = cell.megaBombAnchorY;
    const cluster = [
      { x: anchorX, y: anchorY },
      { x: anchorX + 1, y: anchorY },
      { x: anchorX, y: anchorY + 1 },
      { x: anchorX + 1, y: anchorY + 1 },
    ];

    const valid = cluster.every((entry) => {
      const clusterCell = board.getCell(entry.x, entry.y);
      return (
        clusterCell.type === 'bomb' &&
        clusterCell.megaBomb === true &&
        clusterCell.megaBombAnchorX === anchorX &&
        clusterCell.megaBombAnchorY === anchorY
      );
    });

    return valid ? cluster : [bomb];
  }

  private static getBlastCenter(sourceCells: Position[], fallback: Position): Position {
    if (sourceCells.length !== 4) {
      return fallback;
    }

    const minX = Math.min(...sourceCells.map((cell) => cell.x));
    const minY = Math.min(...sourceCells.map((cell) => cell.y));
    return { x: minX + 0.5, y: minY + 0.5 };
  }

  private static getBlastCellsForSource(
    board: Board,
    sourceCells: Position[],
    bombKind: BombKind,
    radius: number,
  ): Position[] {
    if (sourceCells.length === 1) {
      return BombResolver.getBlastCells(board, sourceCells[0], bombKind, radius);
    }

    return BombResolver.uniquePositions(
      sourceCells.flatMap((cell) => BombResolver.getBlastCells(board, cell, bombKind, radius)),
    );
  }

  private static getBlastCells(
    board: Board,
    bomb: Position,
    bombKind: BombKind,
    radius: number,
  ): Position[] {
    const cells = new Map<string, Position>();
    const add = (x: number, y: number) => {
      if (!board.isInBounds(x, y)) return;
      cells.set(`${x},${y}`, { x, y });
    };

    add(bomb.x, bomb.y);

    if (bombKind === 'thunder') {
      const directions = [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const;
      for (const [dx, dy] of directions) {
        let step = 1;
        while (board.isInBounds(bomb.x + dx * step, bomb.y + dy * step)) {
          add(bomb.x + dx * step, bomb.y + dy * step);
          step++;
        }
      }
    } else if (bombKind === 'cluster') {
      const directions = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ] as const;
      for (const [dx, dy] of directions) {
        let step = 1;
        while (board.isInBounds(bomb.x + dx * step, bomb.y + dy * step)) {
          add(bomb.x + dx * step, bomb.y + dy * step);
          step++;
        }
      }
    } else {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) + Math.abs(dy) > radius) continue;
          add(bomb.x + dx, bomb.y + dy);
        }
      }
    }

    return [...cells.values()];
  }

  private static uniquePositions(cells: Position[]): Position[] {
    const seen = new Map<string, Position>();
    for (const cell of cells) {
      seen.set(`${cell.x},${cell.y}`, cell);
    }
    return [...seen.values()];
  }

  private static getBlastDisplayRadius(center: Position, cells: Position[]): number {
    return cells.reduce((maxDistance, cell) => (
      Math.max(maxDistance, Math.max(Math.abs(cell.x - center.x), Math.abs(cell.y - center.y)))
    ), 0);
  }
}
