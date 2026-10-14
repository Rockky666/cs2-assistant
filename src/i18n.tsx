import { createContext, useContext } from 'react';
import type { Language } from './model';
import { translator } from './messages';
export const LanguageContext = createContext<Language>('ru');
export function useI18n() {
  const language = useContext(LanguageContext);
  return { language, t: translator(language) };
}
