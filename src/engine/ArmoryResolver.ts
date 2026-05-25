import { BOARD_HEIGHT, BOARD_WIDTH } from '@/lib/constants';
import { ARMORY_WEAPONS, getArmoryWeapon } from './ArmoryData';
import { Board } from './Board';
import { Position, WeaponId } from './types';

export interface ArmoryResolvedWeapon {
  weaponId: WeaponId;
  label: string;
  activationText: string;
  origin: Position;
  power: number;
  matchedCells: Position[];
  effectCells: Position[];
  destroyedCells: Position[];
  blastCenters?: { x: number; y: number; radius: number }[];
}

export interface ArmoryResolveResult {
  weapons: ArmoryResolvedWeapon[];
  destroyedCells: Position[];
}

interface ArmoryMatch {
  weaponId: WeaponId;
  origin: Position;
  power: number;
  matchedCells: Position[];
  triggerType: 'plate' | 'overdrive' | 'chain';
}

const MATCH_PATTERNS = [
  { width: 3, height: 2, power: 2 },
  { width: 2, height: 3, power: 2 },
  { width: 2, height: 2, power: 1 },
] as const;

export class ArmoryResolver {
  private static readonly MAX_CHAINED_WEAPONS = 50;

  static resolve(board: Board): ArmoryResolveResult {
    const matches = ArmoryResolver.findMatches(board);
    if (matches.length === 0) {
      return { weapons: [], destroyedCells: [] };
    }

    const queue = [...matches];
    const activatedCellKeys = new Set<string>();
    for (const match of matches) {
      for (const cell of match.matchedCells) {
        activatedCellKeys.add(`${cell.x},${cell.y}`);
      }
    }

    const destroyedMap = new Map<string, Position>();
    const resolvedWeapons: ArmoryResolvedWeapon[] = [];

    while (queue.length > 0 && resolvedWeapons.length < ArmoryResolver.MAX_CHAINED_WEAPONS) {
      const match = queue.shift()!;
      const effectCells = ArmoryResolver.getEffectCells(match.weaponId, match.origin, match.power);
      const combinedCells = ArmoryResolver.uniquePositions([...match.matchedCells, ...effectCells]);
      const destroyedCells = combinedCells.filter((cell) => board.getCell(cell.x, cell.y).type !== 'empty');

      for (const cell of destroyedCells) {
        destroyedMap.set(`${cell.x},${cell.y}`, cell);
      }

      for (const cell of effectCells) {
        const boardCell = board.getCell(cell.x, cell.y);
        if (boardCell.type === 'empty' || !boardCell.weaponId) {
          continue;
        }

        const cellKey = `${cell.x},${cell.y}`;
        if (activatedCellKeys.has(cellKey)) {
          continue;
        }

        activatedCellKeys.add(cellKey);
        queue.push({
          weaponId: boardCell.weaponId,
          origin: { x: cell.x, y: cell.y },
          power: 1,
          matchedCells: [{ x: cell.x, y: cell.y }],
          triggerType: 'chain',
        });
      }

      const weapon = getArmoryWeapon(match.weaponId);
      const center = ArmoryResolver.getCenterCell(match.matchedCells);
      resolvedWeapons.push({
        weaponId: match.weaponId,
        label: weapon.label,
        activationText: match.power > 1 ? `${weapon.label} OVERDRIVE` : weapon.activationText,
        origin: match.origin,
        power: match.power,
        matchedCells: match.matchedCells,
        effectCells: combinedCells,
        destroyedCells,
        blastCenters: match.weaponId === 'bomb'
          ? [{ x: center.x, y: center.y, radius: match.power > 1 ? 3.2 : 2.2 }]
          : undefined,
      });
    }

    for (const cell of destroyedMap.values()) {
      board.destroyCell(cell.x, cell.y);
    }

    return {
      weapons: resolvedWeapons,
      destroyedCells: [...destroyedMap.values()],
    };
  }

  private static findMatches(board: Board): ArmoryMatch[] {
    const matches: ArmoryMatch[] = [];
    const weaponIds: WeaponId[] = ARMORY_WEAPONS.map((weapon) => weapon.id);
    const consumedCells = new Set<string>();

    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        let match: ArmoryMatch | null = null;

        for (const pattern of MATCH_PATTERNS) {
          for (const weaponId of weaponIds) {
            const matchedCells = ArmoryResolver.matchPattern(
              board,
              weaponId,
              x,
              y,
              pattern.width,
              pattern.height,
              consumedCells,
            );
            if (!matchedCells) {
              continue;
            }

            match = {
              weaponId,
              origin: { x, y },
              power: pattern.power,
              matchedCells,
              triggerType: pattern.power > 1 ? 'overdrive' : 'plate',
            };
            break;
          }

          if (match) {
            break;
          }
        }

        if (match) {
          matches.push(match);
          for (const cell of match.matchedCells) {
            consumedCells.add(`${cell.x},${cell.y}`);
          }
        }
      }
    }

    return matches;
  }

  private static matchPattern(
    board: Board,
    weaponId: WeaponId,
    originX: number,
    originY: number,
    width: number,
    height: number,
    consumedCells: Set<string>,
  ): Position[] | null {
    const matchedCells: Position[] = [];

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const x = originX + col;
        const y = originY + row;
        if (!board.isInBounds(x, y)) {
          return null;
        }

        const cellKey = `${x},${y}`;
        if (consumedCells.has(cellKey)) {
          return null;
        }

        const cell = board.getCell(x, y);
        if (cell.type === 'empty' || cell.weaponId !== weaponId) {
          return null;
        }

        matchedCells.push({ x, y });
      }
    }

    return matchedCells;
  }

  private static getEffectCells(weaponId: WeaponId, origin: Position, power: number): Position[] {
    const cells: Position[] = [];
    const overdrive = power > 1;

    if (weaponId === 'missile') {
      for (let y = 0; y <= origin.y + 1; y++) {
        for (let x = origin.x - (overdrive ? 2 : 1); x <= origin.x + (overdrive ? 2 : 1); x++) {
          cells.push({ x, y });
        }
      }
      return ArmoryResolver.uniquePositions(cells);
    }

    if (weaponId === 'bomb') {
      for (let y = origin.y - (overdrive ? 2 : 1); y <= origin.y + (overdrive ? 4 : 3); y++) {
        for (let x = origin.x - (overdrive ? 2 : 1); x <= origin.x + (overdrive ? 4 : 3); x++) {
          if (!ArmoryResolver.isInBounds(x, y)) continue;
          cells.push({ x, y });
        }
      }
      return ArmoryResolver.uniquePositions(cells);
    }

    if (weaponId === 'tub') {
      for (let y = Math.max(0, origin.y - (overdrive ? 3 : 2)); y <= origin.y + 1; y++) {
        for (let x = origin.x - (overdrive ? 2 : 1); x <= origin.x + (overdrive ? 4 : 3); x++) {
          if (ArmoryResolver.isInBounds(x, y)) {
            cells.push({ x, y });
          }
        }
      }
      return ArmoryResolver.uniquePositions(cells);
    }

    if (weaponId === 'katana') {
      const slashOffsets = overdrive ? [-2, -1, 0, 1, 2] : [-1, 0, 1];
      for (let x = 0; x < BOARD_WIDTH; x++) {
        for (const offset of slashOffsets) {
          const slashY = origin.y + offset + (origin.x - x);
          if (ArmoryResolver.isInBounds(x, slashY)) {
            cells.push({ x, y: slashY });
          }
        }
      }
      return ArmoryResolver.uniquePositions(cells);
    }

    if (weaponId === 'sword') {
      for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = origin.x - (overdrive ? 1 : 0); x <= origin.x + (overdrive ? 2 : 1); x++) {
          if (ArmoryResolver.isInBounds(x, y)) {
            cells.push({ x, y });
          }
        }
      }
      return ArmoryResolver.uniquePositions(cells);
    }

    if (weaponId === 'spear') {
      for (let x = origin.x; x < BOARD_WIDTH; x++) {
        for (let y = origin.y - (overdrive ? 1 : 0); y <= origin.y + (overdrive ? 2 : 1); y++) {
          if (ArmoryResolver.isInBounds(x, y)) {
            cells.push({ x, y });
          }
        }
      }
      return ArmoryResolver.uniquePositions(cells);
    }

    for (let y = origin.y - (overdrive ? 2 : 1); y <= origin.y + (overdrive ? 2 : 1); y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        if (ArmoryResolver.isInBounds(x, y)) {
          cells.push({ x, y });
        }
      }
    }
    return ArmoryResolver.uniquePositions(cells);
  }

  private static getCenterCell(cells: Position[]): Position {
    const minX = Math.min(...cells.map((cell) => cell.x));
    const maxX = Math.max(...cells.map((cell) => cell.x));
    const minY = Math.min(...cells.map((cell) => cell.y));
    const maxY = Math.max(...cells.map((cell) => cell.y));
    return {
      x: Math.round((minX + maxX) / 2),
      y: Math.round((minY + maxY) / 2),
    };
  }

  private static uniquePositions(cells: Position[]): Position[] {
    const seen = new Set<string>();
    const unique: Position[] = [];
    for (const cell of cells) {
      if (!ArmoryResolver.isInBounds(cell.x, cell.y)) continue;
      const key = `${cell.x},${cell.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(cell);
    }
    return unique;
  }

  private static isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT;
  }
}
