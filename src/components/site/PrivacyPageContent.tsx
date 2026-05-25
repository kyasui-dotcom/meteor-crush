'use client';

import Link from 'next/link';
import LanguagePicker from '@/components/i18n/LanguagePicker';
import { useI18n } from '@/components/i18n/LanguageProvider';

const cardStyle: React.CSSProperties = {
  borderRadius: '24px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'linear-gradient(180deg, rgba(18,24,46,0.9) 0%, rgba(10,14,28,0.94) 100%)',
  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.32)',
  padding: '24px',
  display: 'grid',
  gap: '14px',
};

const paragraphStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '14px',
  lineHeight: 1.9,
  color: '#c9d2ea',
};

const bulletListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: '20px',
  display: 'grid',
  gap: '10px',
  color: '#dce6ff',
  fontSize: '14px',
  lineHeight: 1.8,
};

const copy = {
  ja: {
    title: 'プライバシーポリシー',
    intro: 'このプライバシーポリシーは、Meteor Crush の Android 版および Web 版における情報の取扱いについて説明するものです。',
    updated: '最終更新日',
    back: 'ゲームへ戻る',
    sections: [
      {
        title: '1. 取得する情報',
        intro: '本アプリでは、ゲーム体験の提供、ランキング表示、広告配信、設定保存のために次の情報を取り扱います。',
        items: [
          '端末内に保存される情報: プレイヤー名、高スコア、スコア履歴、設定、隠し要素の進捗、広告オフ報酬の有効期限',
          'オンライン機能利用時に送信される情報: プレイヤー名、ゲームモード、スコア、イースターエッグ進捗、隠しモード解放状況',
          'ランキングや地域表示のために利用される情報: 大陸コードなどのおおまかな地域情報',
          '広告配信のために広告配信事業者が取得する情報: 広告 ID、端末情報、利用状況など',
        ],
      },
      {
        title: '2. 情報の利用目的',
        items: [
          'スコア、設定、進捗を保存し、次回起動時に引き継ぐため',
          'オンラインランキングの表示とスコア登録のため',
          'イースターエッグ進捗や隠しモード解放状況をサーバー同期するため',
          '広告を表示し、アプリ運営を継続するため',
          '不正利用の抑止、障害対応、サービス改善のため',
        ],
      },
      {
        title: '3. 外部サービス',
        intro: '本アプリは、次の外部サービスまたは同等の基盤を利用する場合があります。',
        items: [
          'Google AdMob / AdSense: 広告の配信',
          'ランキング API / ホスティング基盤: スコア送信、地域別ランキング、進捗同期',
        ],
        outro: 'Google による情報の取扱いについては、Google のポリシーもあわせてご確認ください。',
      },
      {
        title: '4. 保存期間と管理',
        items: [
          '端末内のデータは、アプリのデータ削除やアンインストールを行うまで保持されます',
          'サーバーに送信したランキング情報や進捗情報は、サービス運営に必要な範囲で保持されます',
          'プレイヤー名に Anonymous を使用している場合、一部の同期機能は利用されません',
        ],
      },
      {
        title: '5. ユーザーができること',
        items: [
          '端末内の保存データは、ブラウザのサイトデータ削除やアプリのデータ削除で消去できます',
          'ランキングや進捗同期を避けたい場合は、プレイヤー名を未設定または Anonymous のまま利用できます',
          'サーバー側データの修正や削除を希望する場合は、配布ストアの開発者連絡先からお問い合わせください',
        ],
      },
      {
        title: '6. お子様の利用について',
        body: '本アプリは一般向けのゲームとして提供されています。広告配信や外部サービス利用に関しては、各事業者のポリシーも適用されます。',
      },
      {
        title: '7. 改定',
        body: '本ポリシーは、機能追加や法令対応などに応じて改定することがあります。重要な変更がある場合は、アプリ配布ページまたは公開ページ上で告知します。',
      },
      {
        title: '8. お問い合わせ',
        body: '本ポリシーに関するお問い合わせは、アプリ配布ストアに表示されている開発者連絡先をご利用ください。',
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    intro: 'This Privacy Policy explains how information is handled in the Android and web versions of Meteor Crush.',
    updated: 'Last updated',
    back: 'Back to Game',
    sections: [
      {
        title: '1. Information We Handle',
        intro: 'The app uses the following information to provide gameplay, rankings, ads, and saved settings.',
        items: [
          'Data stored on the device: player name, high scores, score history, settings, secret progress, and ad-free reward expiration',
          'Data sent when online features are used: player name, game mode, score, easter egg progress, and secret-mode unlock status',
          'Data used for rankings and region display: broad regional information such as continent code',
          'Data collected by advertising providers for ad delivery: advertising ID, device data, and usage information',
        ],
      },
      {
        title: '2. How We Use Information',
        items: [
          'To save scores, settings, and progress between sessions',
          'To show online rankings and submit scores',
          'To sync easter egg progress and secret-mode unlocks',
          'To display ads and support ongoing operation of the app',
          'To prevent abuse, investigate issues, and improve the service',
        ],
      },
      {
        title: '3. External Services',
        intro: 'The app may use the following services or equivalent infrastructure.',
        items: [
          'Google AdMob / AdSense: ad delivery',
          'Ranking API / hosting infrastructure: score submission, regional rankings, and progress sync',
        ],
        outro: 'For more details about how Google handles information, please also review Google’s own policy.',
      },
      {
        title: '4. Retention and Management',
        items: [
          'Local data remains until the app data is cleared or the app is uninstalled',
          'Ranking and progress data sent to the server may be retained as needed for service operations',
          'If the player name is Anonymous, some sync features are not available',
        ],
      },
      {
        title: '5. Your Choices',
        items: [
          'Local saved data can be removed by clearing browser site data or app data',
          'If you want to avoid ranking submission or progress sync, you can leave the player name empty or Anonymous',
          'If you want server-side data corrected or deleted, please contact the developer contact listed on the store page',
        ],
      },
      {
        title: '6. Children',
        body: 'This app is offered as a general audience game. Advertising and external service providers may apply their own policies as well.',
      },
      {
        title: '7. Changes',
        body: 'This policy may be updated as features change or legal requirements evolve. Important changes may be announced on the app listing or public website.',
      },
      {
        title: '8. Contact',
        body: 'For questions about this policy, please use the developer contact information shown on the app distribution store.',
      },
    ],
  },
} as const;

export default function PrivacyPageContent() {
  const { lang } = useI18n();
  const content = copy[lang];

  return (
    <main
      style={{
        minHeight: '100dvh',
        overflowY: 'auto',
        background: [
          'radial-gradient(circle at top, rgba(94,196,196,0.18), transparent 32%)',
          'radial-gradient(circle at 80% 18%, rgba(255,136,0,0.16), transparent 24%)',
          'linear-gradient(180deg, #060814 0%, #0a0f1f 48%, #05070f 100%)',
        ].join(','),
        color: '#f5f7ff',
        padding: 'clamp(24px, 5vw, 56px)',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ width: 'min(100%, 980px)', margin: '0 auto', display: 'grid', gap: '20px' }}>
        <section
          style={{
            ...cardStyle,
            padding: '32px',
            background: 'linear-gradient(135deg, rgba(18,30,58,0.96) 0%, rgba(10,14,28,0.98) 62%, rgba(255,136,0,0.16) 140%)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: '12px' }}>
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
                METEOR CRUSH
              </span>
              <h1 style={{ margin: 0, fontSize: 'clamp(34px, 6vw, 56px)', lineHeight: 1.05 }}>
                {content.title}
              </h1>
              <p style={{ ...paragraphStyle, maxWidth: '720px', fontSize: '15px' }}>
                {content.intro}{' '}
                {content.updated} <strong style={{ color: '#fff' }}>2026-03-22</strong>
              </p>
            </div>
            <div style={{ display: 'grid', gap: '12px', justifyItems: 'end' }}>
              <LanguagePicker compact />
              <Link
                href="/game"
                style={{
                  alignSelf: 'flex-start',
                  textDecoration: 'none',
                  padding: '12px 18px',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#fff',
                  background: 'rgba(255,255,255,0.06)',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                }}
              >
                {content.back}
              </Link>
            </div>
          </div>
        </section>

        {content.sections.map((section) => (
          <section key={section.title} style={cardStyle}>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#ffd36c' }}>{section.title}</h2>
            {'intro' in section && section.intro && <p style={paragraphStyle}>{section.intro}</p>}
            {'items' in section && section.items && <ul style={bulletListStyle}>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
            {'body' in section && section.body && <p style={paragraphStyle}>{section.body}</p>}
            {'outro' in section && section.outro && <p style={paragraphStyle}>{section.outro}</p>}
            {section.title.includes('External') || section.title.includes('外部') ? (
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#8ceaea', textDecoration: 'underline', width: 'fit-content' }}
              >
                https://policies.google.com/privacy
              </a>
            ) : null}
          </section>
        ))}
      </div>
    </main>
  );
}
