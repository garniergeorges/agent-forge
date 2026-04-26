// Boot splash : centered ASCII logo, tagline, animated preflight checks,
// and (on first run) an inline language picker below the checks.
//
// Stays mounted as a session header — App.tsx renders Welcome BELOW it.
// Will be cleared in P3+ when the build phase replaces this view.
//
// Mirrors screenSplash() from demo-sprites/forge-mockup-v3.mjs.

import { Box, Text } from 'ink'
import React from 'react'
import { type Lang } from '../config/store.ts'
import { usePreflight } from '../hooks/usePreflight.ts'
import { useLanguage } from '../i18n/LanguageContext.tsx'
import { C } from '../theme/colors.ts'
import { LOGO_AGENT, LOGO_FORGE } from '../theme/logo.ts'
import { LanguagePicker } from './LanguagePicker.tsx'

const VERSION = '0.0.0'

export function Splash(): React.JSX.Element {
  const { checks, allDone } = usePreflight()
  const { lang, setLang } = useLanguage()

  const handlePick = (picked: Lang): void => {
    setLang(picked)
  }

  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      <Box flexDirection="column">
        {LOGO_AGENT.map((line, i) => (
          <Text key={`a-${i.toString()}`} color={C.orangeBright}>
            {line}
          </Text>
        ))}
        {LOGO_FORGE.map((line, i) => (
          <Text key={`f-${i.toString()}`} color={C.orange}>
            {line}
          </Text>
        ))}
      </Box>

      <Box flexDirection="column" alignItems="center" marginTop={2}>
        <Text color={C.greyLight}>
          Forge, run, and orchestrate sandboxed LLM agents
        </Text>
        <Text color={C.grey} dimColor>
          v{VERSION}  ·  by @garniergeorges  ·  Apache 2.0
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={2}>
        {checks.map((c) => {
          const symbol =
            c.status === 'ok' ? '✓' : c.status === 'fail' ? '✗' : '·'
          const symbolColor =
            c.status === 'ok' ? C.green : c.status === 'fail' ? C.red : C.grey
          const trail =
            c.status === 'pending' ? '' : c.status === 'running' ? '...' : ''
          return (
            <Box key={c.id}>
              <Text color={symbolColor}>{symbol}</Text>
              <Text color={C.grey} dimColor>
                {' '}
                {c.label}
                {trail}
              </Text>
            </Box>
          )
        })}
      </Box>

      {allDone && lang === null ? (
        <Box marginTop={2}>
          <LanguagePicker onPick={handlePick} />
        </Box>
      ) : null}
    </Box>
  )
}
