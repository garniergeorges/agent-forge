// Top-level layout : two zones, fixed sizes.
//
//   ┌──────────────┐ ← terminal top (FIXED)
//   │  Top zone    │   Splash (boot) OR MissionControl (when actions exist)
//   ├──────────────┤
//   │  empty       │   filler — shrinks/disappears when bottom grows
//   ├──────────────┤
//   │  Welcome     │   header + transcript + (confirm dialog OR prompt) + footer
//   └──────────────┘ ← terminal bottom (FIXED)
//
// PgUp / PgDn / Ctrl+E scroll the chat transcript inside Welcome.

import { Box, useInput, useStdin } from 'ink'
import React from 'react'
import { useChatContext } from '../hooks/useChatContext.tsx'
import { useLanguage } from '../i18n/LanguageContext.tsx'
import { MissionControl } from './MissionControl.tsx'
import { ProviderLogo } from './ProviderLogo.tsx'
import { Splash } from './Splash.tsx'
import { Welcome } from './Welcome.tsx'

export function App(): React.JSX.Element {
  const { lang } = useLanguage()
  const { isRawModeSupported } = useStdin()
  const { scrollUp, scrollDown, scrollToBottom, pending, state } = useChatContext()
  const rows = process.stdout.rows ?? 30
  const cols = process.stdout.columns ?? 80
  const hasPending = pending !== null
  const hasActions = state.actions.length > 0

  useInput(
    (_, key) => {
      if (key.pageUp) scrollUp()
      else if (key.pageDown) scrollDown()
      else if (key.ctrl && _ === 'e') scrollToBottom()
    },
    { isActive: isRawModeSupported && lang !== null },
  )

  return (
    <Box flexDirection="column" height={rows} width={cols}>
      <Box flexShrink={1} flexDirection="column" overflow="hidden">
        {hasActions ? <MissionControl actions={state.actions} /> : <Splash />}
      </Box>
      {/* Spacer pushes Welcome to the bottom AND parks the provider logo
          at the bottom-right of the top zone (just above the Welcome
          header). */}
      <Box
        flexGrow={1}
        flexShrink={1}
        flexDirection="column"
        justifyContent="flex-end"
        alignItems="flex-end"
        paddingRight={2}
      >
        <ProviderLogo />
      </Box>
      {lang ? (
        <Box flexShrink={0} flexDirection="column">
          <Welcome />
        </Box>
      ) : null}
    </Box>
  )
}
