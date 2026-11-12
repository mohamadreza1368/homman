import { create } from 'zustand';

type InterfaceLanguage = 'en' | 'fa';
type LanguageState = { language: InterfaceLanguage; setLanguage: (language: InterfaceLanguage) => void };

function initialLanguage(): InterfaceLanguage {
  try { return localStorage.getItem('anatria-interface-language') === 'fa' ? 'fa' : 'en'; }
  catch { return 'en'; }
}

export const useInterfaceLanguage = create<LanguageState>((set) => ({
  language: initialLanguage(),
  setLanguage: (language) => {
    try { localStorage.setItem('anatria-interface-language', language); } catch { /* Session-only preference. */ }
    set({ language });
  },
}));
