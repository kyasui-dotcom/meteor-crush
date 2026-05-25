// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getContinentName,
  getInitialLang,
  getMessages,
  getStoredLang,
  isLang,
  LANGUAGE_STORAGE_KEY,
  setStoredLang,
} from '@/lib/i18n';

describe('i18n helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and reads the selected language', () => {
    setStoredLang('ja');
    expect(getStoredLang()).toBe('ja');
    expect(getInitialLang()).toBe('ja');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    expect(getStoredLang()).toBeNull();
  });

  it('returns translated continent labels', () => {
    expect(getContinentName('AS', 'ja')).toBe('アジア');
    expect(getContinentName('AS', 'en')).toBe('ASIA');
  });

  it('exposes language-specific message sets', () => {
    expect(getMessages('ja').language).toBe('言語');
    expect(getMessages('en').language).toBe('Language');
    expect(isLang('ja')).toBe(true);
    expect(isLang('en')).toBe(true);
    expect(isLang('fr')).toBe(false);
  });
});
