import { Board } from './Board';
import { Piece } from './Piece';

export class CollisionDetector {
  static canPlace(board: Board, piece: Piece): boolean {
    const cells = piece.getOccupiedCells();
    for (const cell of cells) {
      if (cell.x < 0 || cell.x >= board.width) return false;
      if (cell.y >= board.height) return false;
      // Allow cells above the board (y < 0)
      if (cell.y < 0) continue;
      if (!board.isEmpty(cell.x, cell.y)) return false;
    }
    return true;
  }

  static canMove(board: Board, piece: Piece, dx: number, dy: number): boolean {
    const moved = piece.clone();
    moved.x += dx;
    moved.y += dy;
    return CollisionDetector.canPlace(board, moved);
  }

  static canRotate(board: Board, piece: Piece, direction: 1 | -1): Piece | null {
    const rotated = piece.getRotated(direction);

    // Try basic rotation
    if (CollisionDetector.canPlace(board, rotated)) {
      return rotated;
    }

    // Wall kick attempts: try offsets
    const kicks = CollisionDetector.getWallKicks(piece, direction);
    for (const [dx, dy] of kicks) {
      const kicked = rotated.clone();
      kicked.x += dx;
      kicked.y += dy;
      if (CollisionDetector.canPlace(board, kicked)) {
        return kicked;
      }
    }

    return null; // rotation not possible
  }

  // SRS wall kick data (simplified)
  private static getWallKicks(piece: Piece, direction: 1 | -1): [number, number][] {
    if (piece.definition.name === 'O') return [];

    if (piece.definition.isComet) {
      // Comet: wider kicks needed
      return [
        [-1, 0], [1, 0], [-2, 0], [2, 0], [-3, 0], [3, 0],
        [0, -1], [0, 1], [0, -2], [0, 2],
      ];
    }

    if (piece.definition.name === 'I') {
      // I-piece needs wider kicks
      return [
        [-1, 0], [1, 0], [-2, 0], [2, 0],
        [0, -1], [0, 1], [-1, -1], [1, -1],
        [-2, 1], [2, 1],
      ];
    }

    // Standard SRS kicks for TSZJL
    return [
      [-1, 0], [1, 0],
      [0, -1],
      [-1, -1], [1, -1],
      [0, -2],
    ];
  }

  // Get the ghost piece position (where the piece would land)
  static getGhostY(board: Board, piece: Piece): number {
    let ghostY = piece.y;
    while (true) {
      const test = piece.clone();
      test.y = ghostY + 1;
      if (!CollisionDetector.canPlace(board, test)) break;
      ghostY++;
    }
    return ghostY;
  }
}
