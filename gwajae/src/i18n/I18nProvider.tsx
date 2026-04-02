import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { I18nContext } from './I18nContext'
import translations, { type Locale } from './translations'

const STORAGE_KEY = 'gwajae-locale'

function getInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'ko' || stored === 'en') return stored
  return 'ko'
}

export function I18nProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, setLocaleRaw] = useState<Locale>(getInitialLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleRaw(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const value = useMemo(
    () => ({ locale, setLocale, t: translations[locale] }),
    [locale, setLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
