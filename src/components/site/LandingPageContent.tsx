'use client';

import Link from 'next/link';
import LanguagePicker from '@/components/i18n/LanguagePicker';
import { useI18n } from '@/components/i18n/LanguageProvider';
import { OG_IMAGE_PATH, SITE_NAME, SITE_URL } from '@/lib/seo';

const shellStyle: React.CSSProperties = {
  minHeight: '100dvh',
  overflowY: 'auto',
  background: [
    'radial-gradient(circle at top, rgba(94,196,196,0.18), transparent 34%)',
    'radial-gradient(circle at 82% 16%, rgba(255,136,0,0.18), transparent 26%)',
    'linear-gradient(180deg, #050712 0%, #0a0f1f 45%, #060814 100%)',
  ].join(','),
  color: '#f5f7ff',
  padding: 'clamp(24px, 5vw, 56px)',
  fontFamily: 'monospace',
};

const cardStyle: React.CSSProperties = {
  borderRadius: '24px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'linear-gradient(180deg, rgba(18,24,46,0.9) 0%, rgba(10,14,28,0.94) 100%)',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.32)',
  padding: '24px',
};

const modeCardStyle: React.CSSProperties = {
  ...cardStyle,
  display: 'grid',
  gap: '10px',
  minHeight: '100%',
};

const linkStyle: React.CSSProperties = {
  textDecoration: 'none',
  padding: '14px 20px',
  borderRadius: '14px',
  fontWeight: 'bold',
  letterSpacing: '0.02em',
};

const copy = {
  ja: {
    tag: 'ブラウザで遊べる落ちものパズル',
    title: 'Meteor Crush',
    lead: '隕石フラグメントを積み、爆破し、浄化し、武器を組み上げる。Meteor Crush はブラウザですぐ遊べる宇宙系の落ちものパズルゲームです。独自シルエットのライン消し、火種を絞った通常爆弾・サンダー爆弾・クラスター爆弾の連鎖、希少武器をつなぐ 7武器 ARMORY、コア包囲型の PURIFY を収録しています。',
    play: 'ゲームを始める',
    privacy: 'プライバシーポリシー',
    chips: ['ブラウザですぐ遊べる', 'タッチ操作対応', 'CLASSIC / BOMBER / ARMORY / PURIFY', '基本プレイ無料'],
    modesTitle: 'ゲームモード',
    classicTitle: 'CLASSIC',
    classicBody: '独自シルエットの流星フラグメントで横一列をそろえる基本モード。テンポよく積みながら、ハイスコア更新を狙います。',
    bomberTitle: 'BOMBER',
    bomberBody: '少ない火ブロックで通常爆弾・サンダー爆弾・クラスター爆弾を引火させ、2x2 の大型爆弾も絡めながら画面端まで走る爆風で連鎖を伸ばすモードです。',
    armoryTitle: 'ARMORY',
    armoryBody: 'かなり少ない武器プレートを 2x2 で発動し、2x3/3x2 の6マスなら OVERDRIVE。攻撃が別の武器マスに当たると1マスでも連鎖発動します。',
    purifyTitle: 'PURIFY',
    purifyBody: '3セルのシャードと救援コロニーを使い、同色4連ラインで隕石を整理しながら、固定された汚染コアを5+クラスターに巻き込んで浄化するモードです。',
    whyTitle: 'Meteor Crush の特徴',
    whyItems: [
      '短時間でも遊びやすい、スピード感のあるアーケードパズル。',
      'モードごとに、積み方・爆破・武器プレート攻撃・浄化で異なる攻略感がある。',
      'ランキングやモードごとの攻略差で、繰り返し遊びやすい。',
    ],
  },
  en: {
    tag: 'Browser Falling-Block Puzzle',
    title: 'Meteor Crush',
    lead: 'Stack, blast, purify, and assemble improvised weapons. Meteor Crush is a fast space-themed puzzle you can play instantly in your browser, with original line-clear silhouettes, rarer-fire bomb chains, scarce-weapon ARMORY chains, and the PURIFY core-cluster challenge.',
    play: 'Play Now',
    privacy: 'Privacy Policy',
    chips: ['Browser playable', 'Touch controls', 'Classic / Bomber / Armory / Purify', 'Free to play'],
    modesTitle: 'Game Modes',
    classicTitle: 'CLASSIC',
    classicBody: 'The core mode built around original meteor-fragment silhouettes. Clear lines, stabilize the stack, and push your score as high as possible.',
    bomberTitle: 'BOMBER',
    bomberBody: 'Use much rarer fire blocks to ignite normal, thunder, and cluster bombs, then build 2x2 larger bombs and edge-to-edge chains through gravity.',
    armoryTitle: 'ARMORY',
    armoryBody: 'Trigger scarce weapon plates with 2x2 matches, upgrade 2x3 or 3x2 slabs into OVERDRIVE, and chain any weapon cell hit by another attack.',
    purifyTitle: 'PURIFY',
    purifyBody: 'Use triad shards and rescue colonies to clear 4-cell lines for cleanup, then absorb fixed corruption cores into 5+ same-color clusters.',
    whyTitle: 'Why Play Meteor Crush?',
    whyItems: [
      'Fast arcade puzzle action that feels good in short sessions.',
      'Distinct game modes built around stacking, explosions, weapon-plate attacks, and purification.',
      'Rankings and distinct mode identities that reward repeat play.',
    ],
  },
} as const;

export default function LandingPageContent() {
  const { lang } = useI18n();
  const content = copy[lang];
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: SITE_NAME,
    url: SITE_URL,
    image: `${SITE_URL}${OG_IMAGE_PATH}`,
    description: content.lead,
    applicationCategory: 'Game',
    genre: ['Puzzle', 'Arcade'],
    operatingSystem: 'Web Browser, Android',
    inLanguage: lang,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  };

  return (
    <main style={shellStyle}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div style={{ width: 'min(100%, 1080px)', margin: '0 auto', display: 'grid', gap: '24px' }}>
        <section
          style={{
            ...cardStyle,
            padding: 'clamp(28px, 5vw, 44px)',
            display: 'grid',
            gap: '18px',
            background: 'linear-gradient(135deg, rgba(18,30,58,0.96) 0%, rgba(10,14,28,0.98) 62%, rgba(255,136,0,0.18) 140%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', alignItems: 'start' }}>
            <span
              style={{
                display: 'inline-flex',
                width: 'fit-content',
                padding: '6px 12px',
                borderRadius: '999px',
                background: 'rgba(94,196,196,0.14)',
                color: '#88f0f0',
                fontSize: '12px',
                letterSpacing: '0.08em',
              }}
            >
              {content.tag}
            </span>
            <LanguagePicker compact />
          </div>
          <div style={{ display: 'grid', gap: '14px' }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(36px, 7vw, 68px)', lineHeight: 0.98 }}>
              {content.title}
            </h1>
            <p style={{ margin: 0, fontSize: 'clamp(16px, 2.2vw, 20px)', color: '#d7def2', lineHeight: 1.8, maxWidth: '760px' }}>
              {content.lead}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              href="/game"
              style={{
                ...linkStyle,
                color: '#08101f',
                background: 'linear-gradient(90deg, #5ec4c4 0%, #9bf0f0 100%)',
              }}
            >
              {content.play}
            </Link>
            <Link
              href="/privacy"
              style={{
                ...linkStyle,
                color: '#f5f7ff',
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              {content.privacy}
            </Link>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {content.chips.map((label) => (
              <span
                key={label}
                style={{
                  padding: '8px 12px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#d7def2',
                  fontSize: '12px',
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </section>

        <section style={{ display: 'grid', gap: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '28px', color: '#ffd36c' }}>{content.modesTitle}</h2>
          <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <article style={modeCardStyle}>
              <strong style={{ fontSize: '20px', color: '#7be8e8' }}>{content.classicTitle}</strong>
              <p style={{ margin: 0, color: '#d7def2', lineHeight: 1.8 }}>{content.classicBody}</p>
            </article>
            <article style={modeCardStyle}>
              <strong style={{ fontSize: '20px', color: '#ffb347' }}>{content.bomberTitle}</strong>
              <p style={{ margin: 0, color: '#d7def2', lineHeight: 1.8 }}>{content.bomberBody}</p>
            </article>
            <article style={modeCardStyle}>
              <strong style={{ fontSize: '20px', color: '#ffcb7a' }}>{content.armoryTitle}</strong>
              <p style={{ margin: 0, color: '#d7def2', lineHeight: 1.8 }}>{content.armoryBody}</p>
            </article>
            <article style={modeCardStyle}>
              <strong style={{ fontSize: '20px', color: '#ffd36c' }}>{content.purifyTitle}</strong>
              <p style={{ margin: 0, color: '#d7def2', lineHeight: 1.8 }}>{content.purifyBody}</p>
            </article>
          </div>
        </section>

        <section style={{ ...cardStyle, display: 'grid', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '28px', color: '#ffd36c' }}>{content.whyTitle}</h2>
          <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '10px', color: '#dce6ff', lineHeight: 1.8 }}>
            {content.whyItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
