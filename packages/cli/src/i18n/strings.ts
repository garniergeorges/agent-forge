// All UI strings live here. Add a key in both EN and FR at the same time.
// Keep keys descriptive (welcomeTitle, not w1) so we can grep for usage.

import type { Lang } from '../config/store.ts'

export type StringKey =
  | 'splashTagline'
  | 'splashCheckDocker'
  | 'splashCheckLLM'
  | 'splashCheckRuntime'
  | 'langPickerTitleEN'
  | 'langPickerTitleFR'
  | 'langPickerHintNavigate'
  | 'langPickerHintSelect'
  | 'langPickerHintExit'
  | 'langPickerScreenInfo'
  | 'welcomeHeaderLabel'
  | 'welcomeHeaderInfo'
  | 'welcomeTitle'
  | 'welcomeSubtitle'
  | 'welcomeSuggestion1'
  | 'welcomeSuggestion2'
  | 'welcomeSuggestion3'
  | 'welcomeSuggestion4'
  | 'welcomeInputPlaceholder'
  | 'welcomeHintSend'
  | 'welcomeHintCommands'
  | 'welcomeHintExit'
  | 'welcomeScreenInfo'
  | 'welcomeRawModeDisabled'

const TABLE: Record<StringKey, Record<Lang, string>> = {
  splashTagline: {
    en: 'Forge, run, and orchestrate sandboxed LLM agents',
    fr: "Forgez, lancez et orchestrez des agents LLM en sandbox",
  },
  splashCheckDocker: {
    en: 'checking docker daemon',
    fr: 'vérification du daemon docker',
  },
  splashCheckLLM: {
    en: 'verifying llm endpoint',
    fr: "vérification de l'endpoint llm",
  },
  splashCheckRuntime: {
    en: 'loading agent runtime bundle',
    fr: 'chargement du bundle runtime',
  },
  langPickerTitleEN: {
    en: 'Choose your language',
    fr: 'Choose your language',
  },
  langPickerTitleFR: {
    en: 'Choisissez votre langue',
    fr: 'Choisissez votre langue',
  },
  langPickerHintNavigate: {
    en: 'navigate',
    fr: 'navigate',
  },
  langPickerHintSelect: {
    en: 'select',
    fr: 'select',
  },
  langPickerHintExit: {
    en: 'exit',
    fr: 'exit',
  },
  langPickerScreenInfo: {
    en: 'first run · language',
    fr: 'first run · language',
  },
  welcomeHeaderLabel: {
    en: 'welcome · new session',
    fr: 'accueil · nouvelle session',
  },
  welcomeHeaderInfo: {
    en: 'session: new',
    fr: 'session : nouvelle',
  },
  welcomeTitle: {
    en: 'What do you want to build today?',
    fr: "Que voulez-vous construire aujourd'hui ?",
  },
  welcomeSubtitle: {
    en: "Describe your project — I'll design and run a team of agents.",
    fr: "Décrivez votre projet — je conçois et lance une équipe d'agents.",
  },
  welcomeSuggestion1: {
    en: '▸  Build a Next.js + Laravel app with shadcn/ui and Sanctum auth',
    fr: '▸  Construire une app Next.js + Laravel avec shadcn/ui et Sanctum',
  },
  welcomeSuggestion2: {
    en: '▸  Audit this repository for security vulnerabilities',
    fr: '▸  Auditer ce dépôt à la recherche de vulnérabilités',
  },
  welcomeSuggestion3: {
    en: '▸  Migrate the codebase from JavaScript to TypeScript',
    fr: '▸  Migrer le codebase de JavaScript vers TypeScript',
  },
  welcomeSuggestion4: {
    en: '▸  Generate a weekly intelligence digest from RSS feeds',
    fr: "▸  Générer un digest hebdomadaire d'intelligence depuis des flux RSS",
  },
  welcomeInputPlaceholder: {
    en: 'Describe what you want to build...',
    fr: 'Décrivez ce que vous voulez construire...',
  },
  welcomeHintSend: {
    en: 'send',
    fr: 'envoyer',
  },
  welcomeHintCommands: {
    en: 'commands',
    fr: 'commandes',
  },
  welcomeHintExit: {
    en: 'exit',
    fr: 'quitter',
  },
  welcomeScreenInfo: {
    en: 'screen 1/1 · welcome',
    fr: 'écran 1/1 · accueil',
  },
  welcomeRawModeDisabled: {
    en: '(input disabled : terminal does not support raw mode)',
    fr: "(saisie désactivée : le terminal ne supporte pas le mode raw)",
  },
}

export function translate(key: StringKey, lang: Lang): string {
  const entry = TABLE[key]
  return entry[lang]
}
