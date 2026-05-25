// Board dimensions
export const BOARD_WIDTH = 12;
export const BOARD_HEIGHT = 22;
export const VISIBLE_HEIGHT = 20;
export const HIDDEN_ROWS = 2;

// Cell size in pixels (base, scaled by renderer)
export const CELL_SIZE = 30;

// Game speed
export const INITIAL_DROP_INTERVAL = 1000; // ms
export const MIN_DROP_INTERVAL = 50;
export const SOFT_DROP_INTERVAL = 50;
export const LEVEL_SPEED_FACTOR = 0.85; // multiply interval per level
export const LINES_PER_LEVEL = 10;

// Input
export const DAS_DELAY = 170; // ms before auto-repeat
export const DAS_REPEAT_RATE = 50; // ms between auto-repeats
export const LOCK_DELAY = 500; // ms before piece locks after landing

// Scoring
export const SCORE_SINGLE = 100;
export const SCORE_DOUBLE = 300;
export const SCORE_TRIPLE = 500;
export const SCORE_QUAD = 800;
export const SCORE_PENTA = 1200;
export const SCORE_HEXA = 2000; // 6-line clear with comet
export const SCORE_SOFT_DROP = 1; // per cell
export const SCORE_HARD_DROP = 2; // per cell

// Comet (6-block piece)
export const COMET_PROBABILITY = 0.05; // 5% chance

// Bomber mode payload mix
export const FIRE_BLOCK_PROBABILITY = 0.03;
export const NORMAL_BOMB_PROBABILITY = 0.05;
export const THUNDER_BOMB_PROBABILITY = 0.05;
export const CLUSTER_BOMB_PROBABILITY = 0.05;
export const BOMB_RADIUS_SMALL = 1;
export const BOMB_RADIUS_MEDIUM = 2;
export const BOMB_RADIUS_LARGE = 3;
export const BOMB_RADIUS_GIANT = 5; // ad reward

// Colors for block types (meteor/mineral palette)
export const BLOCK_COLORS = [
  '#4fd8ff', // I - bright cyan mineral
  '#c4a840', // O - golden ore
  '#8855bb', // T - amethyst
  '#84d63b', // S - bright jade
  '#c44040', // Z - garnet
  '#2f63ff', // J - vivid sapphire
  '#b87830', // L - copper
  '#ff8830', // Comet - blazing orange
  '#ff2244', // Bomb - molten red
  '#d7f2ff', // Rescue colony - support alloy
  '#7f879a', // Support weight - steel ballast
  '#7ab8ff', // Armory missile - sky alloy
  '#ff9a5a', // Armory bomb - ignited shell
  '#b8c4d4', // Armory tub - silver basin
  '#f2bd54', // Armory pan - brass sweep
  '#ffb347', // Fire block - open flame
  '#8db8ff', // Thunder bomb - electric shell
  '#ffd66f', // Cluster bomb - scatter charge
  '#ff8fcf', // Armory katana - neon silk steel
  '#d8e6ff', // Armory sword - bright forged steel
  '#7be3b1', // Armory spear - jade shaft
];

// Chain text
export const CHAIN_TEXTS_BOMBER = [
  '', // 0
  'Crush',
  'Double Crush',
  'Triple Crush',
  'Ultra Crush!',
  'Shatter',
  'Double Shatter',
  'Triple Shatter',
  'Ultra Shatter!!',
  'Demolition',
  'Double Demolition',
  'Triple Demolition',
  'Ultra Demolition!!!',
] as const;

export const ANNIHILATION_TEXT = 'ANNIHILATION!!!!';

// Classic mode line-clear text
export const CLASSIC_LINE_TEXTS: Record<number, string> = {
  2: 'Crush',
  3: 'Shatter',
  4: 'Demolition',
  5: 'Demolition',
  6: 'ANNIHILATION!!!!',
};
