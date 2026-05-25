CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Anonymous',
  score INTEGER NOT NULL,
  continent TEXT NOT NULL DEFAULT 'XX',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_mode_score ON scores(mode, score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_mode_continent_score ON scores(mode, continent, score DESC);

CREATE TABLE IF NOT EXISTS player_progress (
  name_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  easter_eggs_json TEXT NOT NULL DEFAULT '[]',
  secret_mode_unlocked INTEGER NOT NULL DEFAULT 0,
  ad_free_until INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_player_progress_updated_at ON player_progress(updated_at DESC);
