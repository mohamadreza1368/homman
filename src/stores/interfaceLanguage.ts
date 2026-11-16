import { create } from 'zustand';

type InterfaceLanguage = 'en' | 'fa';
type LanguageState = { language: InterfaceLanguage; setLanguage: (language: InterfaceLanguage) => void };

function initialLanguage(): InterfaceLanguage {
  try {
    const saved = localStorage.getItem('hoomaan-interface-language');
    if (saved === 'en' || saved === 'fa') return saved;
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 'en' : 'fa';
  }
  catch { return 'fa'; }
}

export const useInterfaceLanguage = create<LanguageState>((set) => ({
  language: initialLanguage(),
  setLanguage: (language) => {
    try { localStorage.setItem('hoomaan-interface-language', language); } catch { /* Session-only preference. */ }
    set({ language });
  },
}));
