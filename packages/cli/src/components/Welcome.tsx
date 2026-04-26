// Bottom-pinned interactive zone (the "welcome" block).
//
// Contains, top to bottom :
//   - Header bar (▌▌ AGENT FORGE ▐▐ ...)
//   - Either the welcome content (question + suggestions) when the chat is
//     empty, or the scrollable transcript once the user has sent a message.
//   - Separator + prompt input
//   - Footer with keyboard hints
//
// The whole block stays glued to the bottom of the terminal. The splash
// above stays put. The chat content area inside this block has a fixed
// max height : older turns are clipped (visually) but kept in the LLM
// context.

import { Box, Text, useStdin } from 'ink'
import TextInput from 'ink-text-input'
import React, { useState } from 'react'
import { FORGE_MODEL } from '@agent-forge/core/builder'
import { useChatContext } from '../hooks/useChatContext.tsx'
import { useT } from '../i18n/LanguageContext.tsx'
import { C } from '../theme/colors.ts'
import { ChatViewport } from './ChatViewport.tsx'
import { Footer } from './Footer.tsx'
import { Header } from './Header.tsx'
import { WelcomeContent } from './WelcomeContent.tsx'

const CHAT_MAX_HEIGHT = 18 // lines reserved for the transcript inside the bottom block

function shortModel(name: string): string {
  const slash = name.lastIndexOf('/')
  return slash >= 0 ? name.slice(slash + 1) : name
}

export function Welcome(): React.JSX.Element {
  const t = useT()
  const { isRawModeSupported } = useStdin()
  const [input, setInput] = useState('')
  const { state, send, busy, scrollOffset } = useChatContext()

  const hasMessages = state.messages.length > 0 || state.streaming !== null

  const handleSubmit = (value: string): void => {
    const trimmed = value.trim()
    if (!trimmed || busy) return
    setInput('')
    void send(trimmed)
  }

  return (
    <Box flexDirection="column">
      <Header
        label={t('welcomeHeaderLabel')}
        info={`${t('welcomeHeaderInfo')} · model: ${shortModel(FORGE_MODEL)}`}
      />

      {hasMessages ? (
        <ChatViewport
          messages={state.messages}
          streaming={state.streaming}
          error={state.error}
          height={CHAT_MAX_HEIGHT}
          scrollOffset={scrollOffset}
        />
      ) : (
        <WelcomeContent />
      )}

      <Box flexDirection="column" marginTop={1}>
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
              placeholder={busy ? '' : t('welcomeInputPlaceholder')}
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
          hints={
            hasMessages
              ? [
                  { key: '[⏎]', label: t('welcomeHintSend') },
                  { key: '[PgUp/PgDn]', label: 'scroll' },
                  { key: '[Ctrl+E]', label: 'live' },
                  { key: '[Ctrl+C]', label: t('welcomeHintExit') },
                ]
              : [
                  { key: '[⏎]', label: t('welcomeHintSend') },
                  { key: '[/help]', label: t('welcomeHintCommands') },
                  { key: '[Ctrl+C]', label: t('welcomeHintExit') },
                ]
          }
          info={t('welcomeScreenInfo')}
        />
      </Box>
    </Box>
  )
}
