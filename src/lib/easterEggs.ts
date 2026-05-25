export const EASTER_EGG_IDS = [
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

export type EasterEggId = typeof EASTER_EGG_IDS[number];

type EasterEggLocaleText = {
  ja: string;
  en: string;
};

export interface EasterEggCatalogEntry {
  id: EasterEggId;
  title: string;
  description: string;
}

export const TOTAL_EASTER_EGGS = EASTER_EGG_IDS.length;
export const AD_FREE_REWARD_MS = 72 * 60 * 60 * 1000;

const EASTER_EGG_SET = new Set<string>(EASTER_EGG_IDS);
const EASTER_EGG_TEXT: Record<EasterEggId, { title: EasterEggLocaleText; description: EasterEggLocaleText }> = {
  open_rules: {
    title: { ja: 'ルールカード閲覧', en: 'Rule Card Viewer' },
    description: { ja: '開始前のルールカードを開いた。', en: 'Opened the pre-run rule card.' },
  },
  open_settings: {
    title: { ja: '設定メニュー', en: 'Settings Menu' },
    description: { ja: '設定画面を開いた。', en: 'Opened the settings panel.' },
  },
  open_ranking_title: {
    title: { ja: 'タイトルからランキング', en: 'Title Ranking' },
    description: { ja: 'タイトル画面からランキングへ入った。', en: 'Opened ranking from the title screen.' },
  },
  switch_ranking_regional: {
    title: { ja: '地域タブ切替', en: 'Regional Switch' },
    description: { ja: 'ランキングを地域表示に切り替えた。', en: 'Switched ranking to the regional tab.' },
  },
  switch_ranking_world: {
    title: { ja: '世界タブ切替', en: 'World Switch' },
    description: { ja: 'ランキングを世界表示に切り替えた。', en: 'Switched ranking to the world tab.' },
  },
  close_ranking: {
    title: { ja: 'ランキング離脱', en: 'Ranking Exit' },
    description: { ja: 'ランキング画面を閉じた。', en: 'Closed the ranking screen.' },
  },
  toggle_rule_cards: {
    title: { ja: 'ルール表示切替', en: 'Rule Toggle' },
    description: { ja: '開始前ルールカードの表示設定を切り替えた。', en: 'Changed the pre-run rule card setting.' },
  },
  start_from_rules: {
    title: { ja: 'ルールから出撃', en: 'Launch From Rules' },
    description: { ja: 'ルールカードからそのままゲームを開始した。', en: 'Started a run directly from the rule card.' },
  },
  close_rules: {
    title: { ja: 'ルールカード閉鎖', en: 'Rule Card Exit' },
    description: { ja: 'ルールカードを閉じて戻った。', en: 'Closed the rule card and backed out.' },
  },
  start_classic: {
    title: { ja: 'CLASSIC出撃', en: 'Classic Sortie' },
    description: { ja: 'CLASSIC モードを開始した。', en: 'Started a CLASSIC run.' },
  },
  start_bomber: {
    title: { ja: 'BOMBER出撃', en: 'Bomber Sortie' },
    description: { ja: 'BOMBER モードを開始した。', en: 'Started a BOMBER run.' },
  },
  purify_unlocked: {
    title: { ja: 'PURIFY解放', en: 'Purify Unlock' },
    description: { ja: '隠しモード PURIFY を解放した。', en: 'Unlocked the hidden PURIFY mode.' },
  },
  start_purify: {
    title: { ja: 'PURIFY出撃', en: 'Purify Sortie' },
    description: { ja: 'PURIFY モードを開始した。', en: 'Started a PURIFY run.' },
  },
  submit_name: {
    title: { ja: 'ネーム送信', en: 'Name Submission' },
    description: { ja: 'プレイヤー名を送信した。', en: 'Submitted a player name.' },
  },
  open_ranking_game_over: {
    title: { ja: 'ゲームオーバーからランキング', en: 'Game Over Ranking' },
    description: { ja: 'ゲームオーバー画面からランキングへ入った。', en: 'Opened ranking from the game over screen.' },
  },
  retry_from_game_over: {
    title: { ja: '即時リトライ', en: 'Instant Retry' },
    description: { ja: 'ゲームオーバー後にそのまま再挑戦した。', en: 'Retried immediately after game over.' },
  },
  return_to_title: {
    title: { ja: 'タイトル帰還', en: 'Return To Title' },
    description: { ja: 'ゲームオーバー画面からタイトルへ戻った。', en: 'Returned to the title screen from game over.' },
  },
  tetris_clear: {
    title: { ja: '4ライン消去', en: 'Four-Line Clear' },
    description: { ja: '一度に4ラインを消した。', en: 'Cleared four lines at once.' },
  },
  bomber_blast: {
    title: { ja: '爆弾起爆', en: 'Bomb Detonation' },
    description: { ja: 'BOMBER で爆弾の爆発を起こした。', en: 'Triggered a bomb blast in BOMBER.' },
  },
  purify_wave: {
    title: { ja: 'エリア浄化', en: 'Area Purified' },
    description: { ja: 'PURIFY で1エリアを浄化した。', en: 'Purified a full PURIFY area.' },
  },
};

export function isEasterEggId(value: string): value is EasterEggId {
  return EASTER_EGG_SET.has(value);
}

export function getEasterEggCatalog(language: 'ja' | 'en'): EasterEggCatalogEntry[] {
  return EASTER_EGG_IDS.map((id) => ({
    id,
    title: EASTER_EGG_TEXT[id].title[language],
    description: EASTER_EGG_TEXT[id].description[language],
  }));
}

export function getEasterEggEntry(id: EasterEggId, language: 'ja' | 'en'): EasterEggCatalogEntry {
  const entry = EASTER_EGG_TEXT[id];
  return {
    id,
    title: entry.title[language],
    description: entry.description[language],
  };
}
