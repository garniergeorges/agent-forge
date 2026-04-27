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
// Scroll responsibilities :
//   - Welcome's chat transcript : PgUp/PgDn/Ctrl+E when no card is focused
//     AND no Mission Control scroll is needed.
//   - Mission Control panel : PgUp/PgDn when focus is inside the panel
//     (or, more simply, when there are more actions than fit and the
//     prompt is empty).
//   - Tab/Shift+Tab cycle the focused card. Enter opens the detail
//     view. Esc unfocuses. The detail view is a full-screen modal.

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

// Keep Welcome's bottom block (header + transcript + prompt + footer)
// at this minimum height ; everything above goes to Mission Control.
const WELCOME_MIN_HEIGHT = 12
// Reserve a few rows above Welcome for the spacer + provider logo.
const SPACER_HEIGHT = 4

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

  // Mission Control gets whatever is left after Welcome and the
  // spacer/logo claim their slots. Floor at 6 so the panel never
  // collapses below "header + 1 card line + truncation hints".
  const panelHeight = Math.max(
    6,
    rows - WELCOME_MIN_HEIGHT - SPACER_HEIGHT,
  )

  const cardKeysActive =
    isRawModeSupported &&
    lang !== null &&
    !focus.detailOpen &&
    !hasPending &&
    hasActions &&
    promptIsEmpty

  useInput(
    (input, key) => {
      // PgUp/PgDn : when a card is focused OR there's nothing in the
      // prompt and we have actions, scroll Mission Control. Otherwise
      // scroll the chat transcript (legacy behaviour).
      if (key.pageUp) {
        if (cardKeysActive || focus.focusedId !== null) focus.scrollUp()
        else scrollUp()
        return
      }
      if (key.pageDown) {
        if (cardKeysActive || focus.focusedId !== null) focus.scrollDown()
        else scrollDown()
        return
      }
      if (key.ctrl && input === 'e') {
        scrollToBottom()
        return
      }
      if (cardKeysActive && key.tab && key.shift) focus.cycleBack()
      else if (cardKeysActive && key.tab) focus.cycle()
      else if (cardKeysActive && key.return) focus.open()
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
          <MissionControl
            actions={state.actions}
            focusedId={focus.focusedId}
            scrollTop={focus.scrollTop}
            panelHeight={panelHeight}
          />
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
