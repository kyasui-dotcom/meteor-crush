'use client';

import { useI18n } from '@/components/i18n/LanguageProvider';

type SelectedMode = 'classic' | 'bomber' | 'armory' | 'purify';

interface RuleSheetProps {
  mode: SelectedMode;
  onStart: () => void;
  onClose: () => void;
}

type RuleCopy = {
  title: string;
  subtitle: string;
  cards: { title: string; lines: string[] }[];
  previewTitle: string;
  previewCaption: string;
  legend: { label: string; symbol: string }[];
};

const SHEET_COPY: Record<'ja' | 'en', Record<SelectedMode, RuleCopy> & {
  headerTag: string;
  start: string;
  close: string;
  settingsHint: string;
  controlsTitle: string;
  controlsDesktop: string;
  controlsTouch: string;
  controlsTouchNote: string;
}> = {
  ja: {
    headerTag: 'ルールカード',
    start: 'このルールで開始',
    close: '戻る',
    settingsHint: 'この表示は設定でオフにできます。',
    controlsTitle: '操作',
    controlsDesktop: 'キーボード: ← → 移動 / ↑ 回転 / Space ハードドロップ / Shift ホールド',
    controlsTouch: 'スマホ: 左右キーで移動 / ROTで回転 / DROPで即落下 / DOWNを押している間は高速落下 / HOLDで保持',
    controlsTouchNote: '盤面タップでも回転、長押しでもHOLDできます。スワイプでは動かず、触った場所への位置移動もしません。',
    classic: {
      title: 'CLASSIC',
      subtitle: '独自シルエットの流星フラグメントで横一列をそろえる、いちばん基本のモード。',
      cards: [
        {
          title: 'MISSION',
          lines: [
            '横一列がすべて埋まると、そのラインが消えます。',
            '上まで積み上がる前に、できるだけ長く生き残ってください。',
          ],
        },
        {
          title: 'FLOW',
          lines: [
            '一度に多くのラインを消すほど高得点です。',
            'ホールドを使うと、欲しい形を後に回せます。',
          ],
        },
        {
          title: 'SPECIAL',
          lines: [
            '通常ピースは標準7種ではなく、Meteor Crush 独自のフラグメントです。',
            'たまに 6 マスのコメットが出現します。',
            '盤面が苦しいときは、着地した 3x2 のおもりが触れた3列を列ごと下へ圧縮します。',
            'ハードドロップでも少しずつ点が入ります。',
          ],
        },
      ],
      previewTitle: 'LINE CLEAR',
      previewCaption: '横一列を完成させると、その列がまとめて消えます。',
      legend: [
        { label: '通常ブロック', symbol: 'a' },
        { label: '完成ライン', symbol: 'h' },
        { label: 'コメット', symbol: 'm' },
      ],
    },
    bomber: {
      title: 'BOMBER',
      subtitle: '火ブロックで通常爆弾・サンダー爆弾・クラスター爆弾を引火させ、連鎖で盤面を崩すモード。',
      cards: [
        {
          title: 'MISSION',
          lines: [
            '列をそろえても何も起きません。火ブロックの上下左右に爆弾を触れさせると引火します。',
            '爆風で空いた穴に上のブロックが落ちて、次の引火や巻き込みにつながります。',
          ],
        },
        {
          title: 'FLOW',
          lines: [
            '通常爆弾は近距離爆風、サンダー爆弾は X 字、クラスター爆弾は十字に爆発します。',
            'サンダー爆弾とクラスター爆弾の爆風は、その方向の画面端まで走ります。',
            '爆発が別の爆弾に当たると、そのまま連鎖起爆します。',
            '同じ種類の爆弾を 2x2 で固めると大型爆弾になり、より広い範囲を巻き込みます。',
          ],
        },
        {
          title: 'SPECIAL',
          lines: [
            '狙うのは行ではなく、fire と bomb の接触です。火種はかなり少なめです。',
            'BOMBER ではアンカーは出現しません。',
            '連鎖が深いほどスコアも一気に伸びます。',
          ],
        },
      ],
      previewTitle: 'IGNITION CHAIN',
      previewCaption: '火ブロックに触れた爆弾だけが起爆。通常爆弾は近距離、サンダーとクラスターは端まで届きます。',
      legend: [
        { label: '火ブロック', symbol: 'f' },
        { label: '通常爆弾', symbol: 'n' },
        { label: 'サンダー爆弾', symbol: 'x' },
        { label: 'クラスター爆弾', symbol: 'q' },
        { label: '爆風', symbol: 'h' },
      ],
    },
    armory: {
      title: 'ARMORY',
      subtitle: 'かなり少ない武器プレートを組み、攻撃で別武器を巻き込んで連鎖させる第4モード。',
      cards: [
        {
          title: 'MISSION',
          lines: [
            '落ちてくる大半は発動しないジャンク片で、武器プレートはかなり少なめです。',
            '同じ武器を 2x2 の正方形でそろえると、その武器が発動します。',
            '同じ武器を 2x3 または 3x2 の6マスでそろえると、OVERDRIVE としてより強く発動します。',
            '発動した武器の攻撃が別の武器マスに当たると、1マスだけでもその武器が連鎖発動します。',
          ],
        },
        {
          title: 'FLOW',
          lines: [
            '狙うのは「同じアイコンの 2x2」ですが、6マスまで伸ばすと攻撃範囲と演出が一段強くなります。',
            '刀から爆弾、爆弾からフライパンのように、攻撃範囲に入った武器を拾って連鎖を伸ばします。',
          ],
        },
        {
          title: 'SPECIAL',
          lines: [
            '各マスは断片ではなくフルアイコンなので、落ちてきた瞬間に武器の種類を読み取れます。',
            'ジャンク片は武器発動に数えられず、武器の攻撃で巻き込んで処理するのが基本です。',
            '完成した 2x2 は消えるだけでなく、武器に応じた攻撃演出が走ります。',
            'ARMORY では WEAPONS が進行指標になり、武器発動数でスピードが上がります。',
          ],
        },
      ],
      previewTitle: '2x2 / 6-CELL TRIGGER',
      previewCaption: '2x2で通常発動、2x3/3x2の6マスでOVERDRIVE。攻撃が別武器に当たると1マスでも連鎖発動します。',
      legend: [
        { label: '武器プレート', symbol: 'b' },
        { label: 'ジャンク片', symbol: 't' },
        { label: '発動武器', symbol: 'r' },
        { label: '攻撃範囲', symbol: 'h' },
        { label: '別武器プレート', symbol: 'p' },
      ],
    },
    purify: {
      title: 'PURIFY',
      subtitle: '3セルのシャードと、たまに落ちる救援コロニーで汚染コアを同色クラスターに取り込んで浄化するモード。',
      cards: [
        {
          title: 'MISSION',
          lines: [
            '落ちてくるのは 3セルの折れたシャードで、単色のときも先端だけ別色のときもあります。',
            '光るリング付きのコアを、同じ色のブロック5マス以上のクラスターに含めると、その塊ごと消せます。',
            'コアがなくても、同じ色を横か縦に4つ以上まっすぐ並べると通常隕石だけ消せます。',
            'すべてのコアを消すと次のエリアへ進みます。',
          ],
        },
        {
          title: 'FLOW',
          lines: [
            '一直線ではなく、上下左右につながった同色クラスターで判定します。',
            '盤面整理は 4連ライン、コア処理は 5+ クラスター包囲、と役割が分かれています。',
            'コアは固定されたままで、通常ブロックだけが落下して連鎖します。',
          ],
        },
        {
          title: 'SPECIAL',
          lines: [
            'PURIFY ではスワイプは使わず、左右・ROT・DROP・DOWN・HOLD のボタン操作が中心です。',
            '危ない盤面では救援コロニーが落ちてきて、着地地点の広範囲をまとめて浄化します。',
            '連鎖しながら複数コアを巻き込むと、一気に高得点になります。',
          ],
        },
      ],
      previewTitle: 'CORE PURGE',
      previewCaption: '同色4連で通常隕石を整理しつつ、光るコアは同色5マス以上のクラスターに巻き込むと消せます。',
      legend: [
        { label: '通常ブロック', symbol: 'a' },
        { label: '汚染コア', symbol: 'c' },
        { label: '救援コロニー', symbol: 'u' },
        { label: '浄化クラスター', symbol: 'h' },
      ],
    },
  },
  en: {
    headerTag: 'HOW TO PLAY',
    start: 'Start With This Rule Card',
    close: 'Back',
    settingsHint: 'You can disable this screen in Settings.',
    controlsTitle: 'Controls',
    controlsDesktop: 'Keyboard: Left / Right move, Up rotate, Space hard drop, Shift hold',
    controlsTouch: 'Mobile: Left / Right for movement, ROT to rotate, DROP for hard drop, hold DOWN for soft drop, HOLD to store a piece',
    controlsTouchNote: 'Tapping the board still rotates and long-press still holds, but swipes do nothing and touching a spot on the board no longer moves the piece there.',
    classic: {
      title: 'CLASSIC',
      subtitle: 'The core mode: use original meteor-fragment silhouettes to complete horizontal lines and survive.',
      cards: [
        {
          title: 'MISSION',
          lines: [
            'A full horizontal row clears immediately.',
            'Stay alive as long as possible before the stack reaches the top.',
          ],
        },
        {
          title: 'FLOW',
          lines: [
            'Clearing more rows at once gives bigger points.',
            'Use HOLD to save a piece for a better moment.',
          ],
        },
        {
          title: 'SPECIAL',
          lines: [
            'The regular roster is a Meteor Crush fragment set, not the standard seven-piece pack.',
            'A rare 6-cell comet piece can appear.',
            'When the stack gets rough, an occasional 3x2 ballast weight compresses the three touched columns downward as a whole.',
            'Hard drops add a small score bonus.',
          ],
        },
      ],
      previewTitle: 'LINE CLEAR',
      previewCaption: 'Complete a horizontal row to wipe that line away.',
      legend: [
        { label: 'Meteor block', symbol: 'a' },
        { label: 'Full line', symbol: 'h' },
        { label: 'Comet', symbol: 'm' },
      ],
    },
    bomber: {
      title: 'BOMBER',
      subtitle: 'Ignite normal, thunder, and cluster bombs with fire blocks, then collapse the stack through chained blasts.',
      cards: [
        {
          title: 'MISSION',
          lines: [
            'Rows do nothing here. A bomb only ignites when it touches a fire block on one of its four sides.',
            'Destroyed cells open gaps, then falling blocks can set up the next ignition or blast hit.',
          ],
        },
        {
          title: 'FLOW',
          lines: [
            'Normal bombs burst in a short local radius, while thunder bombs explode in an X pattern and cluster bombs explode in a plus pattern.',
            'Thunder and cluster blasts keep extending in their directions until they hit the board edge.',
            'If an explosion hits another bomb, it ignites immediately and keeps the chain going.',
            'A 2x2 block of the same bomb type fuses into a larger bomb with a wider blast.',
          ],
        },
        {
          title: 'SPECIAL',
          lines: [
            'You are aiming for fire-plus-bomb contact, not completed rows, and fire blocks are intentionally much rarer now.',
            'Anchor rescue pieces never appear in BOMBER.',
            'Deeper chains sharply increase your score.',
          ],
        },
      ],
      previewTitle: 'IGNITION CHAIN',
      previewCaption: 'Only bombs touching fire blocks ignite. Normal bombs stay local, while thunder and cluster blasts reach the board edge.',
      legend: [
        { label: 'Fire block', symbol: 'f' },
        { label: 'Normal bomb', symbol: 'n' },
        { label: 'Thunder bomb', symbol: 'x' },
        { label: 'Cluster bomb', symbol: 'q' },
        { label: 'Blast path', symbol: 'h' },
      ],
    },
    armory: {
      title: 'ARMORY',
      subtitle: 'A fourth mode where scarce weapon plates chain through attacks that hit other weapon cells.',
      cards: [
        {
          title: 'MISSION',
          lines: [
            'Most falling pieces are inert junk now, and weapon plates are intentionally much rarer.',
            'Match the same weapon in a 2x2 square to trigger that attack.',
            'Build a 2x3 or 3x2 six-cell weapon slab to fire that weapon in OVERDRIVE.',
            'If a weapon attack hits another weapon cell, that one cell is enough to chain-trigger its weapon.',
          ],
        },
        {
          title: 'FLOW',
          lines: [
            'You still aim for a clean 2x2 of the same icon, but stretching to six cells upgrades the range and visual force.',
            'Use attack paths to pick up other weapons, like katana into bomb into frying pan.',
          ],
        },
        {
          title: 'SPECIAL',
          lines: [
            'Each cell shows a full weapon icon, so you can read the target weapon immediately.',
            'Junk scraps never count toward a trigger, so weapon attacks are your main way to carve them back out of the stack.',
            'Completed 2x2 matches do not just vanish. They launch a weapon-specific attack effect through the stack.',
            'In ARMORY, WEAPONS is the main progress stat and weapon triggers drive the level curve.',
          ],
        },
      ],
      previewTitle: '2x2 / 6-CELL TRIGGER',
      previewCaption: 'A 2x2 fires normally, while a 2x3 or 3x2 fires in OVERDRIVE. Any weapon cell hit by an attack can chain-fire next.',
      legend: [
        { label: 'Weapon plate', symbol: 'b' },
        { label: 'Junk scrap', symbol: 't' },
        { label: 'Triggered weapon', symbol: 'r' },
        { label: 'Attack zone', symbol: 'h' },
        { label: 'Other weapon', symbol: 'p' },
      ],
    },
    purify: {
      title: 'PURIFY',
      subtitle: 'A dedicated mode where triad shards and rescue colonies cleanse fixed cores by absorbing them into same-color clusters.',
      cards: [
        {
          title: 'MISSION',
          lines: [
            'Each falling piece is a 3-cell bent shard, sometimes mono-color and sometimes with an accent tip.',
            'Glowing ring cores are cleared when they sit inside a connected cluster of 5 or more cells of the same color.',
            'Even without a core, straight horizontal or vertical lines of 4+ matching cells clear normal meteor blocks.',
            'Remove every core to purify the area and begin the next round.',
          ],
        },
        {
          title: 'FLOW',
          lines: [
            'Checks are based on connected clusters, not straight rows or columns.',
            'Use 4-cell straight lines to tidy the stack, then build 5+ connected clusters when you need to absorb a core.',
            'Cores stay fixed in place while normal blocks fall around them to create chains.',
          ],
        },
        {
          title: 'SPECIAL',
          lines: [
            'PURIFY uses buttons for movement and drop. Swipes are disabled on purpose.',
            'If the stack gets dangerous, a rescue colony can drop in and purge a wide impact zone on landing.',
            'Chain clears that absorb multiple cores quickly ramp the score.',
          ],
        },
      ],
      previewTitle: 'CORE PURGE',
      previewCaption: 'Use straight 4-cell lines to tidy normal blocks, then wrap the glowing core inside a 5+ same-color cluster to purge it.',
      legend: [
        { label: 'Meteor block', symbol: 'a' },
        { label: 'Corruption core', symbol: 'c' },
        { label: 'Rescue colony', symbol: 'u' },
        { label: 'Purify cluster', symbol: 'h' },
      ],
    },
  },
};

const CLASSIC_PREVIEW = [
  '........',
  '..aaa...',
  '..a.....',
  '....oo..',
  '.vvv....',
  '...jjj..',
  'hhhhhhhh',
  '..m.....',
];

const BOMBER_PREVIEW = [
  '........',
  '..h.h...',
  '...x....',
  '..hnfh..',
  '...q....',
  '..hhh...',
  '...h....',
  '........',
  '........',
];

const ARMORY_PREVIEW = [
  '........',
  '.ttbb...',
  '.trrtt..',
  '..rr....',
  '.hhhhhh.',
  '.hhhhhh.',
  '.hhhhhh.',
  '...p....',
  '........',
];

const PURIFY_PREVIEW = [
  '........',
  '..uuu...',
  '..uuu...',
  '........',
  '...hh...',
  '..hch...',
  '...hh...',
  '....c...',
  '........',
];

function getTheme(mode: SelectedMode) {
  if (mode === 'bomber') {
    return {
      accent: '#ff6a4d',
      accentSoft: 'rgba(255,106,77,0.2)',
      edge: 'rgba(255,106,77,0.55)',
      panel: 'rgba(30,12,12,0.95)',
      preview: BOMBER_PREVIEW,
    };
  }

  if (mode === 'armory') {
    return {
      accent: '#ffb45d',
      accentSoft: 'rgba(255,180,93,0.2)',
      edge: 'rgba(255,180,93,0.5)',
      panel: 'rgba(32,20,12,0.95)',
      preview: ARMORY_PREVIEW,
    };
  }

  if (mode === 'purify') {
    return {
      accent: '#9be07a',
      accentSoft: 'rgba(155,224,122,0.2)',
      edge: 'rgba(155,224,122,0.5)',
      panel: 'rgba(15,28,16,0.95)',
      preview: PURIFY_PREVIEW,
    };
  }

  return {
    accent: '#5ec4c4',
    accentSoft: 'rgba(94,196,196,0.18)',
    edge: 'rgba(94,196,196,0.45)',
    panel: 'rgba(12,18,28,0.95)',
    preview: CLASSIC_PREVIEW,
  };
}

function getCellTone(symbol: string): { background: string; border: string; glow?: string; bombDot?: string } {
  switch (symbol) {
    case 'a':
      return { background: '#4fd8ff', border: '#9ae9ff' };
    case 'o':
      return { background: '#c4a840', border: '#e4d070' };
    case 'n':
      return {
        background: 'radial-gradient(circle at 50% 40%, #ffc18a 0%, #e77f3a 56%, #7a3310 100%)',
        border: '#ffe0bf',
        glow: '0 0 12px rgba(255,154,90,0.5)',
        bombDot: '#24040c',
      };
    case 'j':
      return { background: '#2f63ff', border: '#8aaeff' };
    case 'v':
      return { background: '#84d63b', border: '#c3f38f' };
    case 'z':
      return { background: '#c44040', border: '#ef7676' };
    case 'm':
      return {
        background: '#ff8830',
        border: '#ffc078',
        glow: '0 0 14px rgba(255,136,48,0.45)',
      };
    case 'x':
      return {
        background: 'radial-gradient(circle at 50% 40%, #b8d4ff 0%, #5f85d9 56%, #162750 100%)',
        border: '#dbe8ff',
        glow: '0 0 12px rgba(126,170,255,0.52)',
        bombDot: '#1a0208',
      };
    case 'q':
      return {
        background: 'radial-gradient(circle at 50% 40%, #ffe39d 0%, #f1ba48 55%, #8f5312 100%)',
        border: '#fff1b8',
        glow: '0 0 16px rgba(255,190,86,0.56)',
        bombDot: '#24040c',
      };
    case 'f':
      return {
        background: 'linear-gradient(180deg, #fff1ab 0%, #ffad45 44%, #d84d1f 100%)',
        border: '#ffe9b7',
        glow: '0 0 14px rgba(255,155,65,0.52)',
      };
    case 'h':
      return {
        background: '#f3f1d0',
        border: '#fff9bc',
        glow: '0 0 10px rgba(255,249,188,0.45)',
      };
    case 'c':
      return {
        background: 'radial-gradient(circle at 50% 50%, #f6f0b2 0%, #82c96a 35%, #1b3a1d 100%)',
        border: '#eff8c1',
        glow: '0 0 12px rgba(155,224,122,0.55)',
        bombDot: '#fdf6cf',
      };
    case 'u':
      return {
        background: 'linear-gradient(180deg, #e5f6ff 0%, #b9d8ee 48%, #6f96b4 100%)',
        border: '#f2fbff',
        glow: '0 0 12px rgba(186,226,255,0.48)',
        bombDot: '#244968',
      };
    case 'r':
      return {
        background: 'linear-gradient(180deg, #a8cfff 0%, #4e86d9 100%)',
        border: '#e2efff',
        glow: '0 0 12px rgba(122,184,255,0.48)',
      };
    case 'b':
      return {
        background: 'linear-gradient(180deg, #ffb073 0%, #e36f34 100%)',
        border: '#ffd7b8',
        glow: '0 0 12px rgba(255,154,90,0.46)',
      };
    case 't':
      return {
        background: 'linear-gradient(180deg, #eff4fb 0%, #9fb1c5 100%)',
        border: '#ffffff',
        glow: '0 0 10px rgba(184,196,212,0.48)',
      };
    case 'p':
      return {
        background: 'linear-gradient(180deg, #f8d57c 0%, #bc8330 100%)',
        border: '#fff0ba',
        glow: '0 0 10px rgba(242,189,84,0.42)',
      };
    default:
      return {
        background: 'rgba(255,255,255,0.04)',
        border: 'rgba(255,255,255,0.08)',
      };
  }
}

function renderCellCue(symbol: string, compact = false) {
  if (symbol === 'j') {
    return (
      <>
        <div
          style={{
            position: 'absolute',
            width: compact ? '42%' : '46%',
            height: compact ? '42%' : '46%',
            background: 'rgba(255,255,255,0.58)',
            clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: compact ? '9%' : '10%',
            height: compact ? '38%' : '42%',
            borderRadius: '999px',
            background: 'rgba(8,22,70,0.7)',
          }}
        />
      </>
    );
  }

  if (symbol === 'v') {
    return (
      <>
        <div
          style={{
            position: 'absolute',
            width: compact ? '48%' : '54%',
            height: compact ? '11%' : '12%',
            borderRadius: '999px',
            background: 'rgba(18,32,12,0.78)',
            transform: 'rotate(42deg)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: compact ? '26%' : '30%',
            height: compact ? '7%' : '8%',
            borderRadius: '999px',
            background: 'rgba(255,248,210,0.42)',
            transform: 'translate(24%, 48%) rotate(-34deg)',
          }}
        />
      </>
    );
  }

  if (symbol === 'u') {
    return (
      <>
        <div
          style={{
            position: 'absolute',
            width: compact ? '56%' : '60%',
            height: compact ? '38%' : '42%',
            borderRadius: compact ? '5px' : '6px',
            border: '1px solid rgba(36,73,104,0.78)',
            background: 'rgba(75,128,176,0.78)',
          }}
        />
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              width: compact ? '6%' : '7%',
              height: compact ? '6%' : '7%',
              borderRadius: '1px',
              background: 'rgba(255,252,222,0.96)',
              transform: `translate(${(-14 + index * 12)}px, -2px)`,
            }}
          />
        ))}
      </>
    );
  }

  if (symbol === 'f') {
    return (
      <>
        <div
          style={{
            position: 'absolute',
            width: compact ? '38%' : '42%',
            height: compact ? '54%' : '58%',
            background: 'rgba(255,120,40,0.9)',
            clipPath: 'polygon(50% 0%, 85% 35%, 68% 100%, 32% 100%, 15% 35%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: compact ? '20%' : '24%',
            height: compact ? '30%' : '34%',
            background: 'rgba(255,246,214,0.92)',
            clipPath: 'polygon(50% 0%, 78% 42%, 60% 100%, 40% 100%, 22% 42%)',
          }}
        />
      </>
    );
  }

  if (symbol === 'x' || symbol === 'q') {
    return (
      <div
        style={{
          position: 'absolute',
          width: compact ? '48%' : '52%',
          height: compact ? '48%' : '52%',
          display: 'grid',
          placeItems: 'center',
          color: symbol === 'x' ? 'rgba(216,232,255,0.95)' : 'rgba(255,244,188,0.95)',
          fontWeight: 'bold',
          fontSize: compact ? '9px' : '12px',
          lineHeight: 1,
        }}
      >
        {symbol === 'x' ? 'X' : '+'}
      </div>
    );
  }

  return null;
}

function renderPreviewCell(symbol: string, index: number) {
  const tone = getCellTone(symbol);
  const isBomb = symbol === 'n' || symbol === 'x' || symbol === 'q';
  const isCore = symbol === 'c';

  return (
    <div
      key={index}
      style={{
        aspectRatio: '1 / 1',
        borderRadius: '6px',
        border: `1px solid ${tone.border}`,
        background: tone.background,
        boxShadow: tone.glow ?? 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {isBomb && (
        <div style={{
          width: symbol === 'q' ? '44%' : symbol === 'n' ? '38%' : '36%',
          height: symbol === 'q' ? '44%' : symbol === 'n' ? '38%' : '36%',
          borderRadius: '999px',
          background: tone.bombDot,
        }}
        />
      )}
      {isCore && (
        <>
          <div style={{
            width: '48%',
            height: '48%',
            borderRadius: '999px',
            border: '2px solid rgba(255,248,196,0.95)',
            boxShadow: '0 0 8px rgba(255,248,196,0.45)',
          }}
          />
          <div style={{
            position: 'absolute',
            width: '12%',
            height: '12%',
            borderRadius: '999px',
            background: tone.bombDot,
          }}
          />
        </>
      )}
      {renderCellCue(symbol)}
    </div>
  );
}

function renderLegendSwatch(symbol: string) {
  const tone = getCellTone(symbol);
  const isBomb = symbol === 'n' || symbol === 'x' || symbol === 'q';
  const isCore = symbol === 'c';

  return (
    <div style={{
      width: '20px',
      height: '20px',
      borderRadius: '6px',
      border: `1px solid ${tone.border}`,
      background: tone.background,
      boxShadow: tone.glow ?? 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 auto',
      position: 'relative',
    }}
    >
      {isBomb && (
        <div style={{
          width: symbol === 'q' ? '10px' : '8px',
          height: symbol === 'q' ? '10px' : '8px',
          borderRadius: '999px',
          background: tone.bombDot,
        }}
        />
      )}
      {isCore && (
        <div style={{
          width: '10px',
          height: '10px',
          borderRadius: '999px',
          border: '2px solid rgba(255,248,196,0.95)',
          boxSizing: 'border-box',
        }}
        />
      )}
      {renderCellCue(symbol, true)}
    </div>
  );
}

export default function RuleSheet({ mode, onStart, onClose }: RuleSheetProps) {
  const { lang } = useI18n();
  const language = lang === 'ja' ? 'ja' : 'en';
  const copy = SHEET_COPY[language];
  const sheet = copy[mode];
  const theme = getTheme(mode);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(8,10,20,0.96)',
      zIndex: 20,
      overflowY: 'auto',
      padding: 'calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))',
      boxSizing: 'border-box',
    }}>
      <div style={{
        maxWidth: '940px',
        margin: '0 auto',
        background: `linear-gradient(180deg, ${theme.panel} 0%, rgba(10,12,20,0.98) 100%)`,
        border: `1px solid ${theme.edge}`,
        borderRadius: '24px',
        boxShadow: `0 18px 48px ${theme.accentSoft}`,
        color: '#fff',
        fontFamily: 'monospace',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '24px 24px 18px',
          borderBottom: `1px solid ${theme.edge}`,
          background: `radial-gradient(circle at top right, ${theme.accentSoft} 0%, rgba(0,0,0,0) 48%)`,
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '6px 12px',
            borderRadius: '999px',
            background: theme.accentSoft,
            color: theme.accent,
            fontSize: '12px',
            fontWeight: 'bold',
            letterSpacing: '1px',
          }}>
            {copy.headerTag}
          </div>
          <h2 style={{
            margin: '14px 0 8px',
            fontSize: 'clamp(30px, 6vw, 46px)',
            lineHeight: 0.94,
            color: theme.accent,
            textShadow: `0 0 26px ${theme.accentSoft}`,
          }}>
            {sheet.title}
          </h2>
          <p style={{
            margin: 0,
            maxWidth: '580px',
            fontSize: '15px',
            lineHeight: 1.6,
            color: '#d3dbef',
          }}>
            {sheet.subtitle}
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '18px',
          padding: '20px 24px 0',
          alignItems: 'start',
        }}>
          <div style={{ display: 'grid', gap: '14px' }}>
            {sheet.cards.map((card) => (
              <section
                key={card.title}
                style={{
                  padding: '16px 18px',
                  borderRadius: '18px',
                  border: `1px solid ${theme.edge}`,
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <h3 style={{ margin: '0 0 10px', color: theme.accent, fontSize: '15px' }}>{card.title}</h3>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {card.lines.map((line) => (
                    <p key={line} style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#d6dced' }}>
                      {line}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section style={{
            padding: '18px',
            borderRadius: '18px',
            border: `1px solid ${theme.edge}`,
            background: 'rgba(255,255,255,0.03)',
            display: 'grid',
            gap: '16px',
          }}>
            <div>
              <h3 style={{ margin: '0 0 8px', color: theme.accent, fontSize: '15px' }}>{sheet.previewTitle}</h3>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#d6dced' }}>{sheet.previewCaption}</p>
            </div>

            <div style={{
              padding: '14px',
              borderRadius: '18px',
              background: 'linear-gradient(180deg, rgba(10,14,22,0.96) 0%, rgba(16,20,30,0.9) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
                gap: '6px',
              }}>
                {theme.preview.flatMap((row, rowIndex) => (
                  row.split('').map((symbol, cellIndex) => renderPreviewCell(symbol, rowIndex * 8 + cellIndex))
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              {sheet.legend.map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#d6dced' }}>
                  {renderLegendSwatch(item.symbol)}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div style={{
          margin: '20px 24px 0',
          padding: '16px 18px',
          borderRadius: '18px',
          border: `1px solid ${theme.edge}`,
          background: 'rgba(255,255,255,0.03)',
        }}>
          <h3 style={{ margin: '0 0 10px', color: theme.accent, fontSize: '15px' }}>{copy.controlsTitle}</h3>
          <div style={{ display: 'grid', gap: '8px' }}>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#d6dced' }}>{copy.controlsDesktop}</p>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#d6dced' }}>{copy.controlsTouch}</p>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#9aa6c4' }}>{copy.controlsTouchNote}</p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px 24px',
        }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#8f9ab4' }}>{copy.settingsHint}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '12px 20px',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'transparent',
                color: '#d6dced',
                fontFamily: 'monospace',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {copy.close}
            </button>
            <button
              onClick={onStart}
              style={{
                padding: '14px 22px',
                borderRadius: '14px',
                border: 'none',
                background: theme.accent,
                color: '#0b1018',
                boxShadow: `0 0 18px ${theme.accentSoft}`,
                fontFamily: 'monospace',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {copy.start}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
