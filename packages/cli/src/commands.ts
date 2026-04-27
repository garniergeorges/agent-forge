// Slash command parser and runtime. Returns one or more system messages to
// display in the transcript, and may trigger side effects (clear, exit,
// language change, provider/model switch).

import {
  getCurrentBaseURL,
  getCurrentModelName,
  loadSkillCatalog,
  setProviderOverride,
} from '@agent-forge/core/builder'
import { currentLogPath, isLoggingEnabled } from '@agent-forge/core/log'
import {
  type ForgeConfig,
  type Lang,
  PROVIDER_PRESETS,
  type ProviderPreset,
  loadConfig,
  saveConfig,
} from './config/store.ts'
import { type StringKey, translate } from './i18n/strings.ts'
import { getCurrentSession, listSessions } from './session/store.ts'

export type CommandContext = {
  lang: Lang
  setLang: (lang: Lang) => void
  clearChat: () => void
  resetChat: () => void
  exit: () => void
}

export type CommandOutput = {
  // Lines to append to the transcript as system messages. Already translated.
  lines: string[]
}

const PROVIDER_VALUES: ProviderPreset[] = ['mlx', 'openai', 'anthropic', 'mistral']

function t(key: StringKey, lang: Lang): string {
  return translate(key, lang)
}

function helpLines(lang: Lang): string[] {
  return [
    t('cmdHelpHeader', lang),
    `  ${t('cmdHelpExit', lang)}`,
    `  ${t('cmdHelpClear', lang)}`,
    `  /reset              ${
      lang === 'fr' ? 'vide la vue ET le contexte LLM' : 'wipe view AND LLM context'
    }`,
    `  ${t('cmdHelpHelp', lang)}`,
    `  ${t('cmdHelpLang', lang)}`,
    `  ${t('cmdHelpModel', lang)}`,
    `  ${t('cmdHelpProvider', lang)}`,
    `  /session            ${
      lang === 'fr' ? 'affiche l’id de la session courante' : 'show the current session id'
    }`,
    `  /sessions           ${
      lang === 'fr' ? 'liste les sessions persistées' : 'list persisted sessions'
    }`,
    `  /skills             ${
      lang === 'fr'
        ? 'liste les skills disponibles'
        : 'list available skills'
    }`,
    `  /log                ${
      lang === 'fr'
        ? "affiche le chemin du fichier de log courant (FORGE_DEBUG=1 pour activer)"
        : 'show the current log file path (FORGE_DEBUG=1 to enable)'
    }`,
  ]
}

function applyProviderPreset(name: ProviderPreset): void {
  const preset = PROVIDER_PRESETS[name]
  setProviderOverride({
    baseURL: preset.baseURL,
    model: preset.defaultModel,
  })
  const cfg = loadConfig()
  const next: ForgeConfig = { ...cfg, provider: name, model: preset.defaultModel }
  saveConfig(next)
}

function applyModel(model: string): void {
  setProviderOverride({ model })
  const cfg = loadConfig()
  saveConfig({ ...cfg, model })
}

export function isCommand(input: string): boolean {
  return input.trimStart().startsWith('/')
}

export function runCommand(
  input: string,
  ctx: CommandContext,
): CommandOutput {
  const trimmed = input.trim()
  const [head, ...rest] = trimmed.split(/\s+/)
  const arg = rest.join(' ').trim()
  const lang = ctx.lang

  switch (head) {
    case '/help':
      return { lines: helpLines(lang) }

    case '/exit':
      ctx.exit()
      return { lines: [] }

    case '/clear':
      ctx.clearChat()
      return {
        lines: [
          lang === 'fr'
            ? 'vue effacée (le contexte LLM est conservé · /reset pour tout vider)'
            : 'view cleared (LLM context kept · /reset to wipe everything)',
        ],
      }

    case '/reset':
      ctx.resetChat()
      return {
        lines: [
          lang === 'fr'
            ? 'session réinitialisée (vue + contexte vidés)'
            : 'session reset (view + context wiped)',
        ],
      }

    case '/lang': {
      if (!arg) {
        return { lines: [`${t('cmdLangCurrent', lang)} : ${ctx.lang}`] }
      }
      if (arg !== 'en' && arg !== 'fr') {
        return { lines: [t('cmdLangInvalid', lang)] }
      }
      ctx.setLang(arg)
      return { lines: [`${t('cmdLangChanged', arg)} (${arg})`] }
    }

    case '/model': {
      if (!arg) {
        return { lines: [`${t('cmdModelCurrent', lang)} : ${getCurrentModelName()}`] }
      }
      applyModel(arg)
      return { lines: [`${t('cmdModelChanged', lang)} ${arg}`] }
    }

    case '/provider': {
      if (!arg) {
        const url = getCurrentBaseURL()
        return { lines: [`${t('cmdProviderCurrent', lang)} : ${url}`] }
      }
      if (!(PROVIDER_VALUES as string[]).includes(arg)) {
        return { lines: [t('cmdProviderInvalid', lang)] }
      }
      const preset = PROVIDER_PRESETS[arg as ProviderPreset]
      const lines: string[] = []
      if (preset.needsKey && !process.env.FORGE_API_KEY) {
        lines.push(t('cmdProviderNeedsKey', lang))
      }
      applyProviderPreset(arg as ProviderPreset)
      lines.push(`${t('cmdProviderChanged', lang)} → ${arg} (${preset.defaultModel})`)
      return { lines }
    }

    case '/session': {
      const s = getCurrentSession()
      return {
        lines: [
          `${lang === 'fr' ? 'session' : 'session'} : ${s.id}`,
          `  ${s.transcriptPath}`,
        ],
      }
    }

    case '/sessions': {
      const records = listSessions()
      if (records.length === 0) {
        return { lines: [lang === 'fr' ? '(aucune session)' : '(no sessions)'] }
      }
      const lines = [
        lang === 'fr'
          ? `${records.length.toString()} session(s) trouvée(s) :`
          : `${records.length.toString()} session(s) found :`,
      ]
      for (const r of records.slice(0, 10)) {
        lines.push(
          `  ${r.id.slice(0, 30)}${r.id.length > 30 ? '…' : ''}  ${r.turns.toString()} turns`,
        )
      }
      return { lines }
    }

    case '/log': {
      if (!isLoggingEnabled()) {
        return {
          lines: [
            lang === 'fr'
              ? 'logging désactivé — relance avec FORGE_DEBUG=1 (ou FORGE_LOG_FILE=/path)'
              : 'logging disabled — restart with FORGE_DEBUG=1 (or FORGE_LOG_FILE=/path)',
          ],
        }
      }
      const path = currentLogPath()
      return {
        lines: [
          lang === 'fr' ? `log courant : ${path ?? '?'}` : `current log : ${path ?? '?'}`,
        ],
      }
    }

    case '/skills': {
      const catalog = loadSkillCatalog()
      if (catalog.skills.length === 0) {
        return { lines: [lang === 'fr' ? '(aucune skill)' : '(no skills)'] }
      }
      const lines = [
        lang === 'fr'
          ? `${catalog.skills.length.toString()} skill(s) :`
          : `${catalog.skills.length.toString()} skill(s) :`,
      ]
      for (const s of catalog.skills) {
        const tag = s.source === 'builtin' ? '·built-in·' : '·user·'
        lines.push(`  ${s.name}  ${tag}  ${s.description}`)
      }
      return { lines }
    }

    default:
      return { lines: [t('cmdUnknown', lang)] }
  }
}
