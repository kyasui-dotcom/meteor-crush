import { Board } from './Board';
import { Position } from './types';
import { BOMB_RADIUS_LARGE } from '@/lib/constants';

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
  /**
   * Explode a single bomb and return the result WITHOUT chaining.
   * Finds new bombs in the blast radius and returns them as triggeredBombs.
   * The caller is responsible for scheduling the next explosions.
   */
  static explodeOne(
    board: Board,
    bomb: Position,
    radius: number,
    alreadyDestroyed: Set<string>,
  ): SingleBombResult {
    const cell = board.getCell(bomb.x, bomb.y);
    const effectiveRadius = (cell.type === 'bomb' && cell.megaBomb) ? BOMB_RADIUS_LARGE : radius;

    const destroyed: Position[] = [];
    const triggeredBombs: Position[] = [];

    for (let dy = -effectiveRadius; dy <= effectiveRadius; dy++) {
      for (let dx = -effectiveRadius; dx <= effectiveRadius; dx++) {
        if (dx * dx + dy * dy > effectiveRadius * effectiveRadius) continue;

        const nx = bomb.x + dx;
        const ny = bomb.y + dy;
        const key = `${nx},${ny}`;

        if (alreadyDestroyed.has(key)) continue;
        if (!board.isInBounds(nx, ny)) continue;

        const ncell = board.getCell(nx, ny);
        if (ncell.type === 'empty') continue;

        // If it's another bomb (not the current one), queue for later
        if (ncell.type === 'bomb' && !(nx === bomb.x && ny === bomb.y)) {
          triggeredBombs.push({ x: nx, y: ny });
        }

        alreadyDestroyed.add(key);
        destroyed.push({ x: nx, y: ny });
        board.destroyCell(nx, ny);
      }
    }

    // Also destroy the bomb cell itself
    const bombKey = `${bomb.x},${bomb.y}`;
    if (!alreadyDestroyed.has(bombKey)) {
      alreadyDestroyed.add(bombKey);
      destroyed.push({ x: bomb.x, y: bomb.y });
      board.destroyCell(bomb.x, bomb.y);
    }

    return {
      center: bomb,
      radius: effectiveRadius,
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
      const bombKey = `${bomb.x},${bomb.y}`;

      if (exploded.has(bombKey)) continue;
      exploded.add(bombKey);
      chainBombCount++;

      const cell = board.getCell(bomb.x, bomb.y);
      const effectiveRadius = (cell.type === 'bomb' && cell.megaBomb) ? BOMB_RADIUS_LARGE : radius;
      blastCenters.push({ x: bomb.x, y: bomb.y, radius: effectiveRadius });

      for (let dy = -effectiveRadius; dy <= effectiveRadius; dy++) {
        for (let dx = -effectiveRadius; dx <= effectiveRadius; dx++) {
          if (dx * dx + dy * dy > effectiveRadius * effectiveRadius) continue;

          const nx = bomb.x + dx;
          const ny = bomb.y + dy;
          const key = `${nx},${ny}`;

          if (destroyed.has(key)) continue;
          if (!board.isInBounds(nx, ny)) continue;

          const ncell = board.getCell(nx, ny);
          if (ncell.type === 'empty') continue;

          if (ncell.type === 'bomb') {
            queue.push({ x: nx, y: ny });
          }

          destroyed.add(key);
          board.destroyCell(nx, ny);
        }
      }
    }

    const destroyedCells = Array.from(destroyed).map(k => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    });

    return { destroyedCells, chainBombCount, blastCenters };
  }

  /**
   * Find all bombs in the given rows.
   */
  static findBombsInRows(board: Board, rows: number[]): Position[] {
    const bombs: Position[] = [];
    for (const y of rows) {
      for (let x = 0; x < board.width; x++) {
        if (board.getCell(x, y).type === 'bomb') {
          bombs.push({ x, y });
        }
      }
    }
    return bombs;
  }
}
