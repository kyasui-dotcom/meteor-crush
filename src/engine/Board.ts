import { BOARD_WIDTH, BOARD_HEIGHT } from '@/lib/constants';
import { Cell, EMPTY_CELL, Position } from './types';

export class Board {
  readonly width = BOARD_WIDTH;
  readonly height = BOARD_HEIGHT;
  grid: Cell[][];

  constructor() {
    this.grid = this.createEmptyGrid();
  }

  private createEmptyGrid(): Cell[][] {
    return Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => ({ ...EMPTY_CELL }))
    );
  }

  reset(): void {
    this.grid = this.createEmptyGrid();
  }

  getCell(x: number, y: number): Cell {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return { type: 'block', color: -1 }; // out of bounds = solid
    }
    return this.grid[y][x];
  }

  setCell(x: number, y: number, cell: Cell): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.grid[y][x] = { ...cell };
    }
  }

  isEmpty(x: number, y: number): boolean {
    return this.getCell(x, y).type === 'empty';
  }

  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  isRowFull(y: number): boolean {
    for (let x = 0; x < this.width; x++) {
      if (this.grid[y][x].type === 'empty') return false;
    }
    return true;
  }

  getFullRows(): number[] {
    const rows: number[] = [];
    for (let y = 0; y < this.height; y++) {
      if (this.isRowFull(y)) rows.push(y);
    }
    return rows;
  }

  clearRow(y: number): void {
    // Remove the row and add empty row at top
    this.grid.splice(y, 1);
    this.grid.unshift(
      Array.from({ length: this.width }, () => ({ ...EMPTY_CELL }))
    );
  }

  clearRows(rows: number[]): void {
    // Sort descending so splice indices stay valid
    const sorted = [...rows].sort((a, b) => b - a);
    for (const y of sorted) {
      this.grid.splice(y, 1);
    }
    // Add empty rows at top in one batch
    for (let i = 0; i < sorted.length; i++) {
      this.grid.unshift(
        Array.from({ length: this.width }, () => ({ ...EMPTY_CELL }))
      );
    }
  }

  // Apply gravity: blocks fall to fill empty gaps below them
  applyGravity(): boolean {
    let moved = false;
    for (let x = 0; x < this.width; x++) {
      let writeY = this.height - 1;
      for (let readY = this.height - 1; readY >= 0; readY--) {
        const cell = this.grid[readY][x];
        if (cell.type === 'empty') continue;

        // Fixed cores pin each gravity segment in place.
        if (cell.core) {
          writeY = readY - 1;
          continue;
        }

        if (readY !== writeY) {
          this.grid[writeY][x] = { ...cell };
          this.grid[readY][x] = { ...EMPTY_CELL };
          moved = true;
        }
        writeY--;
      }
    }
    return moved;
  }

  // Check if the top hidden rows have any blocks (game over condition)
  isTopBlocked(): boolean {
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x].type !== 'empty') return true;
      }
    }
    return false;
  }

  // Get all bomb positions
  getBombPositions(): Position[] {
    const bombs: Position[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x].type === 'bomb') {
          bombs.push({ x, y });
        }
      }
    }
    return bombs;
  }

  // Destroy a cell (set to empty)
  destroyCell(x: number, y: number): void {
    if (this.isInBounds(x, y)) {
      this.grid[y][x] = { ...EMPTY_CELL };
    }
  }

  getCoreCount(): number {
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x].core) {
          count++;
        }
      }
    }
    return count;
  }
}
