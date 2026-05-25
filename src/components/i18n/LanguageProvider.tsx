'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  type Lang,
  DEFAULT_LANG,
  getContinentName as getLocalizedContinentName,
  getInitialLang,
  getMessages,
  setStoredLang,
} from '@/lib/i18n';

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: ReturnType<typeof getMessages>;
  getContinentName: (code: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    setLangState(getInitialLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<LanguageContextValue>(() => ({
    lang,
    setLang: (nextLang: Lang) => {
      setLangState(nextLang);
      setStoredLang(nextLang);
    },
    t: getMessages(lang),
    getContinentName: (code: string) => getLocalizedContinentName(code, lang),
  }), [lang]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useI18n must be used inside LanguageProvider');
  }
  return context;
}
