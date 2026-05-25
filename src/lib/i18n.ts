export type Lang = 'ja' | 'en';

export const LANGUAGE_STORAGE_KEY = 'meteor-crush-lang';
export const DEFAULT_LANG: Lang = 'en';

export const messages = {
  ja: {
    modeClassicDesc: '独自フラグメントでラインを削る基本モード',
    modeBomberDesc: '✸ fire で爆弾を引火！',
    modeArmoryDesc: '⚒ 2x2/6マス武器と1マス連鎖！',
    modePurifyDesc: '◎ 4連ライン整理とコア包囲浄化！',
    gameOver: 'GAME OVER',
    score: (n: string) => `${n} 点`,
    newHighScore: 'ハイスコア更新！',
    hiScore: (n: string) => `ハイスコア: ${n}`,
    start: 'START',
    retry: 'RETRY',
    backToTitle: 'タイトルへ',
    controls: '←→: 移動 | ↑/W: 回転 | Space: ドロップ | Shift: ホールド',
    ranking: 'ランキング',
    myRecords: 'じぶん',
    regional: '地域',
    world: 'せかい',
    noData: 'データなし',
    enterName: '名前を入力',
    namePlaceholder: '12文字まで',
    submit: '送信',
    rank: '順位',
    name: '名前',
    scoreLabel: 'スコア',
    date: '日付',
    level: 'LV',
    close: '閉じる',
    howToPlay: 'ルール',
    settings: '設定',
    showRulesBeforeGame: '開始前にルールを表示',
    showRulesBeforeGameDesc: '各モード開始前にルールカードを表示します',
    easterEggs: 'イースターエッグ',
    easterEggProgress: (found: string, total: string) => `${found} / ${total} 発見`,
    easterEggHint: '20個すべて見つけると、72時間広告が停止します。',
    easterEggListTitle: '発見ログ',
    easterEggListHint: '見つけたシークレットはここで確認できます。',
    easterEggStatusFound: 'FOUND',
    easterEggStatusHidden: 'HIDDEN',
    easterEggHiddenTitle: '未発見のシグナル',
    easterEggHiddenDesc: 'まだ何が起こるか分かっていません。',
    adFreeRewardActive: '広告オフ報酬中',
    adFreeRewardInactive: '報酬未発動',
    adFreeRewardRemaining: (remaining: string) => `残り ${remaining}`,
    easterEggFound: (found: string, total: string) => `SECRET ${found}/${total}`,
    easterEggRewardUnlocked: 'ALL SECRET FOUND - ADS OFF FOR 72H',
    on: 'ON',
    off: 'OFF',
    secretUnlocked: 'SECRET MODE UNLOCKED',
    language: '言語',
    languageJa: '日本語',
    languageEn: 'English',
  },
  en: {
    modeClassicDesc: 'Stack original meteor fragments',
    modeBomberDesc: '✸ Ignite bombs with fire blocks!',
    modeArmoryDesc: '⚒ 2x2 weapons, 6-cell overdrives, 1-cell chains!',
    modePurifyDesc: '◎ Clear 4-lines, then cleanse cores with clusters!',
    gameOver: 'GAME OVER',
    score: (n: string) => `Score: ${n}`,
    newHighScore: 'NEW HIGH SCORE!',
    hiScore: (n: string) => `Hi-Score: ${n}`,
    start: 'START',
    retry: 'RETRY',
    backToTitle: 'TITLE',
    controls: '←→: Move | ↑/W: Rotate | Space: Drop | Shift: Hold',
    ranking: 'RANKING',
    myRecords: 'MY',
    regional: 'REGION',
    world: 'WORLD',
    noData: 'No data',
    enterName: 'Enter name',
    namePlaceholder: 'Max 12 chars',
    submit: 'Submit',
    rank: '#',
    name: 'Name',
    scoreLabel: 'Score',
    date: 'Date',
    level: 'LV',
    close: 'Close',
    howToPlay: 'RULES',
    settings: 'SETTINGS',
    showRulesBeforeGame: 'Show Rule Card Before Start',
    showRulesBeforeGameDesc: 'Display the rule card before each run begins',
    easterEggs: 'EASTER EGGS',
    easterEggProgress: (found: string, total: string) => `${found} / ${total} found`,
    easterEggHint: 'Find all 20 secrets to disable ads for 72 hours.',
    easterEggListTitle: 'DISCOVERY LOG',
    easterEggListHint: 'All found secrets are listed here.',
    easterEggStatusFound: 'FOUND',
    easterEggStatusHidden: 'HIDDEN',
    easterEggHiddenTitle: 'Undiscovered Signal',
    easterEggHiddenDesc: 'Its trigger has not been found yet.',
    adFreeRewardActive: 'Ad-Free Reward Active',
    adFreeRewardInactive: 'Reward Inactive',
    adFreeRewardRemaining: (remaining: string) => `${remaining} left`,
    easterEggFound: (found: string, total: string) => `SECRET ${found}/${total}`,
    easterEggRewardUnlocked: 'ALL SECRET FOUND - ADS OFF FOR 72H',
    on: 'ON',
    off: 'OFF',
    secretUnlocked: 'SECRET MODE UNLOCKED',
    language: 'Language',
    languageJa: '日本語',
    languageEn: 'English',
  },
} as const;

export type MessageSet = (typeof messages)[Lang];

export const CONTINENT_NAMES: Record<string, { ja: string; en: string }> = {
  AF: { ja: 'アフリカ', en: 'AFRICA' },
  AN: { ja: '南極', en: 'ANTARCTICA' },
  AS: { ja: 'アジア', en: 'ASIA' },
  EU: { ja: 'ヨーロッパ', en: 'EUROPE' },
  NA: { ja: '北アメリカ', en: 'N. AMERICA' },
  SA: { ja: '南アメリカ', en: 'S. AMERICA' },
  OC: { ja: 'オセアニア', en: 'OCEANIA' },
  XX: { ja: '不明', en: 'UNKNOWN' },
};

export function isLang(value: unknown): value is Lang {
  return value === 'ja' || value === 'en';
}

export function detectBrowserLang(): Lang {
  if (typeof navigator === 'undefined') return DEFAULT_LANG;
  const browserLang = navigator.language || '';
  if (browserLang.startsWith('ja')) return 'ja';
  return 'en';
}

export function getStoredLang(): Lang | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isLang(value) ? value : null;
}

export function getInitialLang(): Lang {
  return getStoredLang() ?? detectBrowserLang();
}

export function setStoredLang(lang: Lang) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

export function getMessages(lang: Lang): MessageSet {
  return messages[lang];
}

export function getContinentName(code: string, lang: Lang): string {
  const entry = CONTINENT_NAMES[code] || CONTINENT_NAMES.XX;
  return entry[lang];
}
