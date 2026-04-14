import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lang, T } from './i18n';

const LANG_KEY = 'app_language';

interface LanguageContextValue {
  lang: Lang;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'zh',
  toggleLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('zh');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(v => {
      if (v === 'zh' || v === 'fr') setLang(v);
    });
  }, []);

  const toggleLang = () => {
    const next: Lang = lang === 'zh' ? 'fr' : 'zh';
    setLang(next);
    AsyncStorage.setItem(LANG_KEY, next);
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Returns current lang + toggle function */
export function useLanguage() {
  return useContext(LanguageContext);
}

/** Returns the translation dict for the current language */
export function useT() {
  const { lang } = useContext(LanguageContext);
  return T[lang];
}
