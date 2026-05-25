import { EasterEggId, isEasterEggId } from './easterEggs';

const STORAGE_KEY = 'meteor-crush';

const API_BASE = 'https://meteor-crush-ranking.yasuikunihiro.workers.dev';

interface ScoreRecord {
  score: number;
  level: number;
  lines: number;
  date: string; // ISO string
}

interface GameData {
  highScores: Record<string, number>; // mode -> personal best
  totalLinesCleared: number;
  playerName: string;
  scoreHistory: Record<string, ScoreRecord[]>; // mode -> history
  continent: string; // cached continent code
  showRulesBeforeGame: boolean;
  secretModeUnlocked: boolean;
  easterEggsFound: EasterEggId[];
  adFreeUntil: number | null;
}

export interface EasterEggProgress {
  foundIds: EasterEggId[];
  foundCount: number;
  totalCount: number;
  adFreeUntil: number | null;
  adFreeActive: boolean;
}

export interface EasterEggRegisterResult extends EasterEggProgress {
  added: boolean;
  rewardGranted: boolean;
}

export interface SyncedEasterEggProgress extends EasterEggProgress {
  secretModeUnlocked: boolean;
}

function normalizeEasterEggs(value: unknown): EasterEggId[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<EasterEggId>();
  for (const entry of value) {
    if (typeof entry === 'string' && isEasterEggId(entry)) {
      unique.add(entry);
    }
  }
  return [...unique];
}

function load(): GameData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // Migrate old format
      if (!data.playerName) data.playerName = '';
      if (!data.scoreHistory) data.scoreHistory = {};
      if (!data.continent) data.continent = '';
      if (typeof data.showRulesBeforeGame !== 'boolean') data.showRulesBeforeGame = true;
      if (typeof data.secretModeUnlocked !== 'boolean') data.secretModeUnlocked = false;
      data.easterEggsFound = normalizeEasterEggs(data.easterEggsFound);
      data.adFreeUntil = typeof data.adFreeUntil === 'number' && Number.isFinite(data.adFreeUntil)
        ? data.adFreeUntil
        : null;
      return data;
    }
  } catch {}
  return {
    highScores: {},
    totalLinesCleared: 0,
    playerName: '',
    scoreHistory: {},
    continent: '',
    showRulesBeforeGame: true,
    secretModeUnlocked: false,
    easterEggsFound: [],
    adFreeUntil: null,
  };
}

function save(data: GameData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function getSyncableProfileName(name: string): string | null {
  const trimmed = name.trim().slice(0, 12);
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === 'anonymous') return null;
  return trimmed;
}

function applySyncedProgress(sync: SyncedEasterEggProgress): void {
  const data = load();
  data.easterEggsFound = sync.foundIds;
  data.adFreeUntil = sync.adFreeUntil;
  if (sync.secretModeUnlocked) {
    data.secretModeUnlocked = true;
  }
  save(data);
}

// --- Player Name ---

export function getPlayerName(): string {
  return load().playerName;
}

export function setPlayerName(name: string): void {
  const data = load();
  data.playerName = name.slice(0, 12);
  save(data);
}

// --- Preferences ---

export function getShowRulesBeforeGame(): boolean {
  return load().showRulesBeforeGame;
}

export function setShowRulesBeforeGame(show: boolean): void {
  const data = load();
  data.showRulesBeforeGame = show;
  save(data);
}

export function getSecretModeUnlocked(): boolean {
  return true;
}

export function setSecretModeUnlocked(unlocked: boolean): void {
  const data = load();
  data.secretModeUnlocked = true;
  save(data);
}

export function getEasterEggProgress(nowMs: number = Date.now()): EasterEggProgress {
  return {
    foundIds: [],
    foundCount: 0,
    totalCount: 0,
    adFreeUntil: null,
    adFreeActive: false,
  };
}

export function registerEasterEgg(id: EasterEggId, nowMs: number = Date.now()): EasterEggRegisterResult {
  return {
    ...getEasterEggProgress(nowMs),
    added: false,
    rewardGranted: false,
  };
}

export function isAdFreeActive(nowMs: number = Date.now()): boolean {
  return false;
}

export async function syncEasterEggProgress(name: string = getPlayerName()): Promise<SyncedEasterEggProgress | null> {
  return {
    ...getEasterEggProgress(),
    secretModeUnlocked: true,
  };
}

// --- Personal high score (localStorage) ---

export function getHighScore(mode: string): number {
  return load().highScores[mode] || 0;
}

export function setHighScore(mode: string, score: number): boolean {
  const data = load();
  const prev = data.highScores[mode] || 0;
  if (score > prev) {
    data.highScores[mode] = score;
    save(data);
    return true;
  }
  return false;
}

// --- Score History (for local ranking) ---

export function addScoreHistory(mode: string, record: Omit<ScoreRecord, 'date'>): void {
  const data = load();
  if (!data.scoreHistory[mode]) data.scoreHistory[mode] = [];
  data.scoreHistory[mode].push({
    ...record,
    date: new Date().toISOString(),
  });
  // Keep top 100 only
  data.scoreHistory[mode].sort((a, b) => b.score - a.score);
  if (data.scoreHistory[mode].length > 100) {
    data.scoreHistory[mode] = data.scoreHistory[mode].slice(0, 100);
  }
  save(data);
}

export function getLocalRanking(mode: string): ScoreRecord[] {
  const data = load();
  const history = data.scoreHistory[mode] || [];
  return history.slice(0, 20);
}

// --- Continent cache ---

export function getCachedContinent(): string {
  return load().continent;
}

function setCachedContinent(continent: string): void {
  const data = load();
  data.continent = continent;
  save(data);
}

// --- Global API ---

export async function getPlayerContinent(): Promise<string> {
  const cached = getCachedContinent();
  if (cached) return cached;
  try {
    const res = await fetch(`${API_BASE}/info`);
    if (res.ok) {
      const data = await res.json() as { continent: string };
      setCachedContinent(data.continent);
      return data.continent;
    }
  } catch {}
  return 'XX';
}

export async function getGlobalHighScore(mode: string): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/highscore?mode=${mode}`);
    if (res.ok) {
      const data = await res.json() as { score: number };
      return data.score || 0;
    }
  } catch {}
  return 0;
}

export interface RankingEntry {
  name: string;
  score: number;
  continent: string;
  created_at: string;
}

export async function getGlobalRanking(mode: string, region: string = 'world'): Promise<{ rankings: RankingEntry[]; callerContinent: string }> {
  try {
    const res = await fetch(`${API_BASE}/ranking?mode=${mode}&region=${region}&limit=20`);
    if (res.ok) {
      return await res.json() as { rankings: RankingEntry[]; callerContinent: string };
    }
  } catch {}
  return { rankings: [], callerContinent: getCachedContinent() || 'XX' };
}

export async function submitGlobalScore(mode: string, score: number): Promise<boolean> {
  const name = getPlayerName() || 'Anonymous';
  try {
    const res = await fetch(`${API_BASE}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, name, score }),
    });
    if (res.ok) {
      const data = await res.json() as { continent?: string };
      if (data.continent) setCachedContinent(data.continent);
      return true;
    }
  } catch {}
  return false;
}

// --- Total lines ---

export function getTotalLines(): number {
  return load().totalLinesCleared;
}

export function addTotalLines(lines: number): number {
  const data = load();
  data.totalLinesCleared += lines;
  save(data);
  return data.totalLinesCleared;
}
