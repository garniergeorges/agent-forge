// Top-level layout : permanent two-zone screen.
//   - Splash on top : logo, checks, language picker (first run).
//     Stays visible as a session header — will be cleared later (P3+) when
//     the build phase begins (mission control replaces this view).
//   - Welcome PINNED to the bottom of the terminal : header, question,
//     suggestions, prompt, footer. The middle is empty space (will host the
//     transcript / build progress in P2.2+ / P3+).

import { Box } from 'ink'
import React from 'react'
import { useLanguage } from '../i18n/LanguageContext.tsx'
import { Splash } from './Splash.tsx'
import { Welcome } from './Welcome.tsx'

export function App(): React.JSX.Element {
  const { lang } = useLanguage()
  const rows = process.stdout.rows ?? 30

  return (
    <Box flexDirection="column" height={rows}>
      <Splash />
      <Box flexGrow={1} />
      {lang ? (
        <Welcome
          onSubmit={(prompt) => {
            // P2.2 will route this to the LLM. For P2.1 we just echo to
            // stderr so we can confirm the input pipeline works end-to-end.
            process.stderr.write(`[echo] ${prompt}\n`)
          }}
        />
      ) : null}
    </Box>
  )
}
