import { createContext } from 'react'
import type { Locale, TranslationKeys } from './translations'
import translations from './translations'

export interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: TranslationKeys
}

export const I18nContext = createContext<I18nContextValue>({
  locale: 'ko',
  setLocale: () => {},
  t: translations.ko,
})
