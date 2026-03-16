export type CellType = 'empty' | 'block' | 'bomb';

export interface Cell {
  type: CellType;
  color: number; // index into BLOCK_COLORS
  megaBomb?: boolean; // part of a 2x2 mega bomb
}

export const EMPTY_CELL: Cell = { type: 'empty', color: -1 };

export interface Position {
  x: number;
  y: number;
}

export type GameState =
  | 'title'
  | 'mode_select'
  | 'playing'
  | 'paused'
  | 'chain_resolving'
  | 'game_over';

export type GameModeType = 'classic' | 'bomber';

export type RotationDirection = 1 | -1; // 1 = CW, -1 = CCW

export interface PieceDefinition {
  name: string;
  matrices: number[][][]; // [rotationState][row][col]
  color: number;
  isComet: boolean;
}

export interface GameEvent {
  type: 'line_clear' | 'bomb_explode' | 'chain' | 'piece_lock' | 'game_over' | 'level_up';
  data?: Record<string, unknown>;
}

export interface ChainStep {
  chainNumber: number;
  destroyedCells: Position[];
  text: string;
}

export type InputAction =
  | 'left'
  | 'right'
  | 'down'
  | 'rotateCW'
  | 'rotateCCW'
  | 'hardDrop'
  | 'hold'
  | 'pause';

/** Visual events emitted by the engine for the renderer to animate */
export interface VisualEvent {
  type: 'explosion' | 'line_clear';
  /** Board cell coordinates of destroyed cells (for explosions) */
  cells?: Position[];
  /** Board row indices that were cleared */
  rows?: number[];
  /** Color indices of destroyed cells */
  colors?: number[];
  /** Chain count (for intensity scaling) */
  chainCount?: number;
  /** Bomb center positions with their blast radius (for blast ring effect) */
  blastCenters?: { x: number; y: number; radius: number }[];
}
