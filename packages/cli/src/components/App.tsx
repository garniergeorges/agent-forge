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
// Tab / Shift+Tab cycle focus through Mission Control cards (only when
// the prompt input is empty so it doesn't fight TextInput). Enter on a
// focused card opens a full-screen CardDetail view ; Esc closes it.

import { Box, useInput, useStdin } from 'ink'
import React from 'react'
import { useChatContext } from '../hooks/useChatContext.tsx'
import { useCardFocus } from '../hooks/useCardFocus.ts'
import { useLanguage } from '../i18n/LanguageContext.tsx'
import { CardDetail } from './CardDetail.tsx'
import { MissionControl } from './MissionControl.tsx'
import { ProviderLogo } from './ProviderLogo.tsx'
import { Splash } from './Splash.tsx'
import { Welcome } from './Welcome.tsx'

export function App(): React.JSX.Element {
  const { lang } = useLanguage()
  const { isRawModeSupported } = useStdin()
  const { scrollUp, scrollDown, scrollToBottom, pending, state, promptDraft } =
    useChatContext()
  const focus = useCardFocus(state.actions)
  const rows = process.stdout.rows ?? 30
  const cols = process.stdout.columns ?? 80
  const hasPending = pending !== null
  const hasActions = state.actions.length > 0
  const promptIsEmpty = promptDraft.length === 0

  // Tab/Enter is only meaningful when there are actions, the prompt is
  // empty (so TextInput doesn't lose its keystrokes), and no permission
  // dialog is showing.
  const cardKeysActive =
    isRawModeSupported &&
    lang !== null &&
    !focus.detailOpen &&
    !hasPending &&
    hasActions &&
    promptIsEmpty

  useInput(
    (input, key) => {
      if (key.pageUp) scrollUp()
      else if (key.pageDown) scrollDown()
      else if (key.ctrl && input === 'e') scrollToBottom()
      else if (cardKeysActive && key.tab && key.shift) focus.cycleBack()
      else if (cardKeysActive && key.tab) focus.cycle()
      else if (cardKeysActive && key.return) focus.open()
      // Esc clears the card focus (only when something is focused and
      // the prompt is empty, so we never swallow an Esc the user meant
      // for cancelling input).
      else if (
        key.escape &&
        promptIsEmpty &&
        !hasPending &&
        focus.focusedId !== null
      ) {
        focus.clearFocus()
      }
    },
    { isActive: isRawModeSupported && lang !== null && !focus.detailOpen },
  )

  // Detail view : modal full-screen replacement.
  if (focus.detailOpen && focus.focusedId !== null) {
    const action = state.actions.find((a) => a.id === focus.focusedId)
    if (action) {
      return <CardDetail action={action} onClose={focus.close} />
    }
  }

  return (
    <Box flexDirection="column" height={rows} width={cols}>
      <Box flexShrink={1} flexDirection="column" overflow="hidden">
        {hasActions ? (
          <MissionControl actions={state.actions} focusedId={focus.focusedId} />
        ) : (
          <Splash />
        )}
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
