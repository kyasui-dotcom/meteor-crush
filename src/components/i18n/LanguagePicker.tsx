'use client';

import { type CSSProperties } from 'react';
import { type Lang } from '@/lib/i18n';
import { useI18n } from './LanguageProvider';

type LanguagePickerProps = {
  compact?: boolean;
};

const optionLabels: Record<Lang, string> = {
  ja: '日本語',
  en: 'English',
};

export default function LanguagePicker({ compact = false }: LanguagePickerProps) {
  const { lang, setLang, t } = useI18n();

  const wrapperStyle: CSSProperties = compact
    ? { display: 'inline-flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }
    : { display: 'grid', gap: '10px' };

  return (
    <div style={wrapperStyle}>
      <span style={{ fontSize: compact ? '12px' : '13px', color: '#cfd8ef', fontWeight: 700 }}>
        {t.language}
      </span>
      <div style={{ display: 'inline-flex', gap: '8px', flexWrap: 'wrap' }}>
        {(['ja', 'en'] as Lang[]).map((option) => {
          const active = option === lang;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setLang(option)}
              style={{
                padding: compact ? '8px 12px' : '10px 14px',
                borderRadius: '999px',
                border: `1px solid ${active ? '#5ec4c4' : 'rgba(255,255,255,0.14)'}`,
                background: active ? 'rgba(94,196,196,0.16)' : 'rgba(255,255,255,0.04)',
                color: active ? '#89f0f0' : '#d6dced',
                fontFamily: 'monospace',
                fontSize: compact ? '12px' : '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {optionLabels[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
