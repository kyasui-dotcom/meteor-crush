import { Board } from './Board';

export interface LineClearResult {
  clearedRows: number[];
  linesCleared: number;
}

export class LineClearResolver {
  static resolve(board: Board): LineClearResult {
    const fullRows = board.getFullRows();
    if (fullRows.length === 0) {
      return { clearedRows: [], linesCleared: 0 };
    }

    board.clearRows(fullRows);

    return {
      clearedRows: fullRows,
      linesCleared: fullRows.length,
    };
  }
}
