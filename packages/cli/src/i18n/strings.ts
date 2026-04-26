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
  | 'cmdHelpHeader'
  | 'cmdHelpExit'
  | 'cmdHelpClear'
  | 'cmdHelpHelp'
  | 'cmdHelpLang'
  | 'cmdHelpModel'
  | 'cmdHelpProvider'
  | 'cmdLangChanged'
  | 'cmdLangCurrent'
  | 'cmdLangInvalid'
  | 'cmdModelChanged'
  | 'cmdModelCurrent'
  | 'cmdModelMissing'
  | 'cmdProviderChanged'
  | 'cmdProviderCurrent'
  | 'cmdProviderInvalid'
  | 'cmdProviderNeedsKey'
  | 'cmdUnknown'
  | 'cmdCleared'

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
  cmdHelpHeader: {
    en: 'Available commands :',
    fr: 'Commandes disponibles :',
  },
  cmdHelpExit: {
    en: '/exit               close the session',
    fr: '/exit               ferme la session',
  },
  cmdHelpClear: {
    en: '/clear              clear the conversation',
    fr: '/clear              vide la conversation',
  },
  cmdHelpHelp: {
    en: '/help               show this list',
    fr: '/help               affiche cette liste',
  },
  cmdHelpLang: {
    en: '/lang [en|fr]       show or change the UI language',
    fr: '/lang [en|fr]       affiche ou change la langue',
  },
  cmdHelpModel: {
    en: '/model [<name>]     show or change the LLM model',
    fr: '/model [<name>]     affiche ou change le modèle LLM',
  },
  cmdHelpProvider: {
    en: '/provider [mlx|openai|anthropic|mistral]   show or switch the provider',
    fr: '/provider [mlx|openai|anthropic|mistral]   affiche ou change le provider',
  },
  cmdLangChanged: {
    en: 'Language changed.',
    fr: 'Langue changée.',
  },
  cmdLangCurrent: {
    en: 'Current language',
    fr: 'Langue courante',
  },
  cmdLangInvalid: {
    en: 'Unknown language. Use : en, fr.',
    fr: 'Langue inconnue. Utilisez : en, fr.',
  },
  cmdModelChanged: {
    en: 'Model changed for this session.',
    fr: 'Modèle changé pour cette session.',
  },
  cmdModelCurrent: {
    en: 'Current model',
    fr: 'Modèle courant',
  },
  cmdModelMissing: {
    en: 'Usage : /model <name>',
    fr: 'Usage : /model <nom>',
  },
  cmdProviderChanged: {
    en: 'Provider switched.',
    fr: 'Provider changé.',
  },
  cmdProviderCurrent: {
    en: 'Current provider',
    fr: 'Provider courant',
  },
  cmdProviderInvalid: {
    en: 'Unknown provider. Use : mlx, openai, anthropic, mistral.',
    fr: 'Provider inconnu. Utilisez : mlx, openai, anthropic, mistral.',
  },
  cmdProviderNeedsKey: {
    en: 'This provider needs FORGE_API_KEY to be set in your environment.',
    fr: 'Ce provider nécessite la variable FORGE_API_KEY dans votre environnement.',
  },
  cmdUnknown: {
    en: 'Unknown command. Type /help for the list.',
    fr: 'Commande inconnue. Tapez /help pour la liste.',
  },
  cmdCleared: {
    en: 'Conversation cleared.',
    fr: 'Conversation vidée.',
  },
}

export function translate(key: StringKey, lang: Lang): string {
  const entry = TABLE[key]
  return entry[lang]
}
