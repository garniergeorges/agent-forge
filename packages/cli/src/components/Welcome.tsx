// Welcome screen: header, big question, suggestions, prompt, footer.
// Mirrors screenWelcome() from demo-sprites/forge-mockup-v3.mjs.

import { Box, Text, useStdin } from 'ink'
import TextInput from 'ink-text-input'
import React, { useState } from 'react'
import { useT } from '../i18n/LanguageContext.tsx'
import { C } from '../theme/colors.ts'
import { Footer } from './Footer.tsx'
import { Header } from './Header.tsx'

const FORGE_MODEL =
  process.env.FORGE_MODEL ?? 'mlx-community/Llama-3.2-3B-Instruct-4bit'

function shortModel(name: string): string {
  // "mlx-community/Llama-3.2-3B-Instruct-4bit" → "Llama-3.2-3B-Instruct-4bit"
  const slash = name.lastIndexOf('/')
  return slash >= 0 ? name.slice(slash + 1) : name
}

export function Welcome({
  onSubmit,
}: {
  onSubmit: (prompt: string) => void
}): React.JSX.Element {
  const t = useT()
  const { isRawModeSupported } = useStdin()
  const [input, setInput] = useState('')

  const handleSubmit = (value: string): void => {
    const trimmed = value.trim()
    if (!trimmed) return
    setInput('')
    onSubmit(trimmed)
  }

  return (
    <Box flexDirection="column">
      <Header
        label={t('welcomeHeaderLabel')}
        info={`${t('welcomeHeaderInfo')} · model: ${shortModel(FORGE_MODEL)}`}
      />

      <Box flexDirection="column" alignItems="center" marginTop={2}>
        <Text color={C.orange} bold>
          {t('welcomeTitle')}
        </Text>
        <Box marginTop={1}>
          <Text color={C.greyLight}>{t('welcomeSubtitle')}</Text>
        </Box>

        <Box flexDirection="column" marginTop={2}>
          <Text color={C.greyLight} dimColor>
            {t('welcomeSuggestion1')}
          </Text>
          <Text color={C.greyLight} dimColor>
            {t('welcomeSuggestion2')}
          </Text>
          <Text color={C.greyLight} dimColor>
            {t('welcomeSuggestion3')}
          </Text>
          <Text color={C.greyLight} dimColor>
            {t('welcomeSuggestion4')}
          </Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginTop={2}>
        <Text color={C.grey} dimColor>
          {' '}
          {'─'.repeat(Math.max(0, (process.stdout.columns ?? 80) - 2))}
        </Text>
        <Box>
          <Text color={C.orange}>{' ❯ '}</Text>
          {isRawModeSupported ? (
            <TextInput
              value={input}
              onChange={setInput}
              onSubmit={handleSubmit}
              placeholder={t('welcomeInputPlaceholder')}
            />
          ) : (
            <Text color={C.grey} dimColor>
              {t('welcomeRawModeDisabled')}
            </Text>
          )}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Footer
          hints={[
            { key: '[⏎]', label: t('welcomeHintSend') },
            { key: '[/help]', label: t('welcomeHintCommands') },
            { key: '[Ctrl+C]', label: t('welcomeHintExit') },
          ]}
          info={t('welcomeScreenInfo')}
        />
      </Box>
    </Box>
  )
}
