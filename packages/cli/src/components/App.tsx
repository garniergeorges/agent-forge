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
  const { scrollUp, scrollDown, scrollToBottom } = useChatContext()
  const rows = process.stdout.rows ?? 30

  useInput(
    (_, key) => {
      if (key.pageUp) scrollUp()
      else if (key.pageDown) scrollDown()
      // Ink does not expose End directly, but Ctrl+E is the conventional
      // alternative and works fine here.
      else if (key.ctrl && _ === 'e') scrollToBottom()
    },
    { isActive: isRawModeSupported && lang !== null },
  )

  return (
    <Box flexDirection="column" height={rows}>
      <Splash />
      <Box flexGrow={1} />
      {lang ? <Welcome /> : null}
    </Box>
  )
}
