export interface Env {
  DB: D1Database;
}

const EASTER_EGG_IDS = [
  'open_rules',
  'open_settings',
  'open_ranking_title',
  'switch_ranking_regional',
  'switch_ranking_world',
  'close_ranking',
  'toggle_rule_cards',
  'start_from_rules',
  'close_rules',
  'start_classic',
  'start_bomber',
  'purify_unlocked',
  'start_purify',
  'submit_name',
  'open_ranking_game_over',
  'retry_from_game_over',
  'return_to_title',
  'tetris_clear',
  'bomber_blast',
  'purify_wave',
] as const;

type EasterEggId = typeof EASTER_EGG_IDS[number];

const TOTAL_EASTER_EGGS = EASTER_EGG_IDS.length;
const AD_FREE_REWARD_MS = 72 * 60 * 60 * 1000;
const EASTER_EGG_SET = new Set<string>(EASTER_EGG_IDS);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function normalizeProfileName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim().slice(0, 12);
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === 'anonymous') return null;
  return trimmed;
}

function getNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeEggs(value: unknown): EasterEggId[] {
  if (!Array.isArray(value)) return [];
  const found = new Set<EasterEggId>();
  for (const entry of value) {
    if (typeof entry === 'string' && EASTER_EGG_SET.has(entry)) {
      found.add(entry as EasterEggId);
    }
  }
  return [...found];
}

function parseEggsJson(value: unknown): EasterEggId[] {
  if (typeof value !== 'string') return [];
  try {
    return normalizeEggs(JSON.parse(value));
  } catch {
    return [];
  }
}

function buildPlayerProgress(
  foundIds: EasterEggId[],
  adFreeUntil: number | null,
  secretModeUnlocked: boolean,
) {
  return {
    foundIds,
    foundCount: foundIds.length,
    totalCount: TOTAL_EASTER_EGGS,
    adFreeUntil,
    adFreeActive: typeof adFreeUntil === 'number' && adFreeUntil > Date.now(),
    secretModeUnlocked,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // --- GET /info --- returns caller's continent
    if (path === '/info' && request.method === 'GET') {
      const cf = (request as any).cf;
      const continent = cf?.continent || 'XX';
      const country = cf?.country || 'XX';
      return json({ continent, country });
    }

    if (path === '/player-progress' && request.method === 'GET') {
      const displayName = normalizeProfileName(url.searchParams.get('name'));
      if (!displayName) {
        return json({ error: 'Invalid name' }, 400);
      }

      const row = await env.DB.prepare(
        'SELECT easter_eggs_json, secret_mode_unlocked, ad_free_until FROM player_progress WHERE name_key = ?'
      ).bind(getNameKey(displayName)).first<{
        easter_eggs_json: string;
        secret_mode_unlocked: number;
        ad_free_until: number | null;
      }>();

      const foundIds = row ? parseEggsJson(row.easter_eggs_json) : [];
      const secretModeUnlocked = row ? row.secret_mode_unlocked === 1 : false;
      const adFreeUntil = row?.ad_free_until ?? null;
      return json(buildPlayerProgress(foundIds, adFreeUntil, secretModeUnlocked));
    }

    if (path === '/player-progress' && request.method === 'POST') {
      try {
        const body = await request.json() as {
          name?: string;
          easterEggsFound?: unknown;
          secretModeUnlocked?: boolean;
        };

        const displayName = normalizeProfileName(body.name);
        if (!displayName) {
          return json({ error: 'Invalid name' }, 400);
        }

        const nameKey = getNameKey(displayName);
        const incomingEggs = normalizeEggs(body.easterEggsFound);
        const incomingSecretModeUnlocked = body.secretModeUnlocked === true;

        const existing = await env.DB.prepare(
          'SELECT easter_eggs_json, secret_mode_unlocked, ad_free_until FROM player_progress WHERE name_key = ?'
        ).bind(nameKey).first<{
          easter_eggs_json: string;
          secret_mode_unlocked: number;
          ad_free_until: number | null;
        }>();

        const mergedEggs = new Set<EasterEggId>(existing ? parseEggsJson(existing.easter_eggs_json) : []);
        for (const id of incomingEggs) {
          mergedEggs.add(id);
        }

        const foundIds = [...mergedEggs];
        const secretModeUnlocked = incomingSecretModeUnlocked || (existing?.secret_mode_unlocked === 1) || foundIds.includes('purify_unlocked');
        let adFreeUntil = existing?.ad_free_until ?? null;

        if (adFreeUntil === null && foundIds.length === TOTAL_EASTER_EGGS) {
          adFreeUntil = Date.now() + AD_FREE_REWARD_MS;
        }

        await env.DB.prepare(
          `INSERT INTO player_progress (name_key, display_name, easter_eggs_json, secret_mode_unlocked, ad_free_until, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(name_key) DO UPDATE SET
             display_name = excluded.display_name,
             easter_eggs_json = excluded.easter_eggs_json,
             secret_mode_unlocked = excluded.secret_mode_unlocked,
             ad_free_until = COALESCE(player_progress.ad_free_until, excluded.ad_free_until),
             updated_at = datetime('now')`
        ).bind(
          nameKey,
          displayName,
          JSON.stringify(foundIds),
          secretModeUnlocked ? 1 : 0,
          adFreeUntil,
        ).run();

        return json(buildPlayerProgress(foundIds, adFreeUntil, secretModeUnlocked));
      } catch {
        return json({ error: 'Invalid request' }, 400);
      }
    }

    // --- GET /highscore --- single top score for HUD display
    if (path === '/highscore' && request.method === 'GET') {
      const mode = url.searchParams.get('mode') || 'classic';
      const row = await env.DB.prepare(
        'SELECT score FROM scores WHERE mode = ? ORDER BY score DESC LIMIT 1'
      ).bind(mode).first<{ score: number }>();
      return json({ score: row?.score || 0 });
    }

    // --- GET /ranking --- leaderboard
    if (path === '/ranking' && request.method === 'GET') {
      const mode = url.searchParams.get('mode') || 'classic';
      const region = url.searchParams.get('region') || 'world';
      const limit = Math.min(50, parseInt(url.searchParams.get('limit') || '20'));

      let query: string;
      let params: unknown[];

      if (region === 'world') {
        query = 'SELECT name, score, continent, created_at FROM scores WHERE mode = ? ORDER BY score DESC LIMIT ?';
        params = [mode, limit];
      } else if (region === 'continent') {
        // Use caller's continent
        const cf = (request as any).cf;
        const continent = cf?.continent || 'XX';
        query = 'SELECT name, score, continent, created_at FROM scores WHERE mode = ? AND continent = ? ORDER BY score DESC LIMIT ?';
        params = [mode, continent, limit];
      } else {
        // Specific continent code passed
        query = 'SELECT name, score, continent, created_at FROM scores WHERE mode = ? AND continent = ? ORDER BY score DESC LIMIT ?';
        params = [mode, region, limit];
      }

      const { results } = await env.DB.prepare(query).bind(...params).all();

      // Also return caller's continent so frontend knows what tab to label
      const cf = (request as any).cf;
      const callerContinent = cf?.continent || 'XX';

      return json({ rankings: results || [], callerContinent });
    }

    // --- POST /score --- submit a new score
    if (path === '/score' && request.method === 'POST') {
      try {
        const body = await request.json() as { mode?: string; name?: string; score?: number };
        const mode = body.mode || 'classic';
        const name = (body.name || 'Anonymous').slice(0, 12);
        const score = body.score || 0;

        if (score <= 0) {
          return json({ error: 'Invalid score' }, 400);
        }

        const cf = (request as any).cf;
        const continent = cf?.continent || 'XX';

        await env.DB.prepare(
          'INSERT INTO scores (mode, name, score, continent) VALUES (?, ?, ?, ?)'
        ).bind(mode, name, score, continent).run();

        return json({ ok: true, continent });
      } catch (e) {
        return json({ error: 'Invalid request' }, 400);
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};
