// Top-level layout : two fixed zones, no scroll bleed.
//
//   ┌──────────────┐ ← terminal top (FIXED)
//   │  Splash      │   logo + checks + lang picker (P3+ : mission control)
//   ├──────────────┤
//   │              │
//   │  empty space │   stays empty until P3+ (build phase)
//   │              │
//   ├──────────────┤
//   │  Welcome     │   header + (question/suggestions OR clipped transcript)
//   │              │   + prompt + footer
//   └──────────────┘ ← terminal bottom (FIXED)
//
// PgUp / PgDn / End are captured here at the App level so they work
// regardless of whether the prompt input has focus.

import { Box, useInput, useStdin } from 'ink'
import React from 'react'
import { useChatContext } from '../hooks/useChatContext.tsx'
import { useLanguage } from '../i18n/LanguageContext.tsx'
import { Splash } from './Splash.tsx'
import { Welcome } from './Welcome.tsx'

export function App(): React.JSX.Element {
  const { lang } = useLanguage()
  const { isRawModeSupported } = useStdin()
  const { scrollUp, scrollDown, scrollToBottom, pending } = useChatContext()
  const rows = process.stdout.rows ?? 30
  const cols = process.stdout.columns ?? 80
  const hasPending = pending !== null

  useInput(
    (_, key) => {
      if (key.pageUp) scrollUp()
      else if (key.pageDown) scrollDown()
      else if (key.ctrl && _ === 'e') scrollToBottom()
    },
    { isActive: isRawModeSupported && lang !== null },
  )

  // When a permission dialog is active, drop the fixed height so the box
  // can grow to fit the dialog without Ink clipping the bottom border.
  // The terminal scrolls naturally instead — the splash leaves the viewport
  // until the user answers, then the layout snaps back to its pinned form.
  return (
    <Box
      flexDirection="column"
      height={hasPending ? undefined : rows}
      width={cols}
    >
      <Splash />
      {!hasPending ? <Box flexGrow={1} /> : null}
      {lang ? <Welcome /> : null}
    </Box>
  )
}
