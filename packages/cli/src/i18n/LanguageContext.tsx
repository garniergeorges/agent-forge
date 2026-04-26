// React context that exposes the current language and a setter.
// All UI components read from here via useT().

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { type Lang, loadConfig, saveConfig } from '../config/store.ts'
import { type StringKey, translate } from './strings.ts'

type LanguageContextValue = {
  lang: Lang | null // null until the user has picked one (first run)
  setLang: (lang: Lang) => void
  t: (key: StringKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [lang, setLangState] = useState<Lang | null>(() => {
    const cfg = loadConfig()
    return cfg.lang ?? null
  })

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    const cfg = loadConfig()
    saveConfig({ ...cfg, lang: next })
  }, [])

  const t = useCallback(
    (key: StringKey): string => translate(key, lang ?? 'en'),
    [lang],
  )

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, t }),
    [lang, setLang, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}

export function useT(): (key: StringKey) => string {
  return useLanguage().t
}
