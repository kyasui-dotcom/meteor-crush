import { Board } from './Board';
import { Position } from './types';

export interface CoreMatchResult {
  clearedCells: Position[];
  clearedCoreCount: number;
}

export class CoreMatchResolver {
  static resolve(board: Board, minimumClusterSize: number = 5, minimumLineSize: number = 4): CoreMatchResult {
    const toClear = new Map<string, Position>();
    let clearedCoreCount = 0;
    const visited = new Set<string>();

    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;

        const cell = board.getCell(x, y);
        if (cell.type === 'empty') continue;

        const cluster = this.collectCluster(board, { x, y }, cell.color, visited);
        const coreCountInCluster = cluster.reduce((count, pos) => (
          board.getCell(pos.x, pos.y).core ? count + 1 : count
        ), 0);

        if (coreCountInCluster > 0 && cluster.length >= minimumClusterSize) {
          for (const pos of cluster) {
            toClear.set(`${pos.x},${pos.y}`, pos);
          }
        }
      }
    }

    this.collectStraightLines(board, minimumLineSize, toClear);

    const clearedCells = [...toClear.values()];
    for (const pos of clearedCells) {
      if (board.getCell(pos.x, pos.y).core) {
        clearedCoreCount++;
      }
      board.destroyCell(pos.x, pos.y);
    }

    return { clearedCells, clearedCoreCount };
  }

  private static collectStraightLines(
    board: Board,
    minimumLineSize: number,
    toClear: Map<string, Position>,
  ): void {
    for (let y = 0; y < board.height; y++) {
      let x = 0;
      while (x < board.width) {
        const cell = board.getCell(x, y);
        if (cell.type === 'empty' || cell.core) {
          x++;
          continue;
        }

        const run: Position[] = [{ x, y }];
        let nextX = x + 1;
        while (nextX < board.width) {
          const nextCell = board.getCell(nextX, y);
          if (nextCell.type === 'empty' || nextCell.core || nextCell.color !== cell.color) {
            break;
          }
          run.push({ x: nextX, y });
          nextX++;
        }

        if (run.length >= minimumLineSize) {
          for (const pos of run) {
            toClear.set(`${pos.x},${pos.y}`, pos);
          }
        }
        x = nextX;
      }
    }

    for (let x = 0; x < board.width; x++) {
      let y = 0;
      while (y < board.height) {
        const cell = board.getCell(x, y);
        if (cell.type === 'empty' || cell.core) {
          y++;
          continue;
        }

        const run: Position[] = [{ x, y }];
        let nextY = y + 1;
        while (nextY < board.height) {
          const nextCell = board.getCell(x, nextY);
          if (nextCell.type === 'empty' || nextCell.core || nextCell.color !== cell.color) {
            break;
          }
          run.push({ x, y: nextY });
          nextY++;
        }

        if (run.length >= minimumLineSize) {
          for (const pos of run) {
            toClear.set(`${pos.x},${pos.y}`, pos);
          }
        }
        y = nextY;
      }
    }
  }

  private static collectCluster(
    board: Board,
    start: Position,
    color: number,
    visited: Set<string>,
  ): Position[] {
    const queue = [start];
    const cluster: Position[] = [];
    const queued = new Set<string>([`${start.x},${start.y}`]);

    while (queue.length > 0) {
      const pos = queue.shift()!;
      const key = `${pos.x},${pos.y}`;
      if (visited.has(key)) continue;

      const cell = board.getCell(pos.x, pos.y);
      if (cell.type === 'empty' || cell.color !== color) continue;

      visited.add(key);
      cluster.push(pos);

      const neighbors = [
        { x: pos.x + 1, y: pos.y },
        { x: pos.x - 1, y: pos.y },
        { x: pos.x, y: pos.y + 1 },
        { x: pos.x, y: pos.y - 1 },
      ];

      for (const next of neighbors) {
        if (next.x < 0 || next.x >= board.width || next.y < 0 || next.y >= board.height) {
          continue;
        }
        const nextKey = `${next.x},${next.y}`;
        const nextCell = board.getCell(next.x, next.y);
        if (
          !visited.has(nextKey) &&
          !queued.has(nextKey) &&
          nextCell.type !== 'empty' &&
          nextCell.color === color
        ) {
          queued.add(nextKey);
          queue.push(next);
        }
      }
    }

    return cluster;
  }
}
