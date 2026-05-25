export type CellType = 'empty' | 'block' | 'bomb';
export type WeaponId = 'missile' | 'bomb' | 'tub' | 'pan' | 'katana' | 'sword' | 'spear';
export type BombKind = 'normal' | 'thunder' | 'cluster';

export interface ArmoryFragmentTag {
  weaponId: WeaponId;
  fragmentIndex: number;
}

export interface Cell {
  type: CellType;
  color: number; // index into BLOCK_COLORS
  megaBomb?: boolean; // legacy oversized-bomb flag kept for compatibility
  megaBombAnchorX?: number;
  megaBombAnchorY?: number;
  core?: boolean; // fixed objective cell used in Purify mode
  fire?: boolean; // ignition block used in Bomber mode
  bombKind?: BombKind;
  weaponId?: WeaponId;
  fragmentIndex?: number;
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

export type GameModeType = 'classic' | 'bomber' | 'purify' | 'armory';

export type RotationDirection = 1 | -1; // 1 = CW, -1 = CCW

export interface PieceDefinition {
  name: string;
  matrices: number[][][]; // [rotationState][row][col]
  color: number;
  cellColors?: number[][][]; // optional per-cell colors for multi-color pieces
  cellFragments?: (ArmoryFragmentTag | null)[][][];
  isComet: boolean;
  special?: 'rescueColony' | 'supportWeight';
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
  /** Weapon effect identity for ARMORY mode visuals */
  weaponId?: WeaponId;
  /** ARMORY match strength: 1 for normal, 2 for six-cell overdrive */
  power?: number;
  /** Optional effect lifetime for longer blast visuals */
  durationMs?: number;
}
