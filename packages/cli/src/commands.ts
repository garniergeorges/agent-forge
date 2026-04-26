// Slash command parser and runtime. Returns one or more system messages to
// display in the transcript, and may trigger side effects (clear, exit,
// language change, provider/model switch).

import {
  getCurrentBaseURL,
  getCurrentModelName,
  setProviderOverride,
} from '@agent-forge/core/builder'
import {
  type ForgeConfig,
  type Lang,
  PROVIDER_PRESETS,
  type ProviderPreset,
  loadConfig,
  saveConfig,
} from './config/store.ts'
import { type StringKey, translate } from './i18n/strings.ts'

export type CommandContext = {
  lang: Lang
  setLang: (lang: Lang) => void
  clearChat: () => void
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
    `  ${t('cmdHelpHelp', lang)}`,
    `  ${t('cmdHelpLang', lang)}`,
    `  ${t('cmdHelpModel', lang)}`,
    `  ${t('cmdHelpProvider', lang)}`,
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
      return { lines: [t('cmdCleared', lang)] }

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

    default:
      return { lines: [t('cmdUnknown', lang)] }
  }
}
