const STORAGE_KEY = 'meteor-crush';

interface GameData {
  highScores: Record<string, number>; // mode -> personal best
  totalLinesCleared: number;
}

function load(): GameData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { highScores: {}, totalLinesCleared: 0 };
}

function save(data: GameData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
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

// --- Global high score (API) ---

const GLOBAL_API_BASE = '/api/highscore';

export async function getGlobalHighScore(mode: string): Promise<number> {
  try {
    const res = await fetch(`${GLOBAL_API_BASE}?mode=${mode}`);
    if (res.ok) {
      const data = await res.json();
      return data.score || 0;
    }
  } catch {}
  return 0;
}

export async function submitGlobalScore(mode: string, score: number): Promise<boolean> {
  try {
    const res = await fetch(GLOBAL_API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, score }),
    });
    return res.ok;
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
