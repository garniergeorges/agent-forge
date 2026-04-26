// Bottom bar: keyboard hints on the left, screen info on the right.
// Mirrors drawFooter() from demo-sprites/forge-mockup-v3.mjs.

import { Box, Text } from 'ink'
import React from 'react'
import { C } from '../theme/colors.ts'

export type Hint = { key: string; label: string }

export function Footer({
  hints,
  info,
}: {
  hints: Hint[]
  info?: string
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Text color={C.grey} dimColor>
        {'─'.repeat(process.stdout.columns ?? 80)}
      </Text>
      <Box justifyContent="space-between" width="100%">
        <Box>
          {hints.map((h, i) => (
            <Box key={h.key}>
              {i > 0 ? <Text>{'   '}</Text> : null}
              <Text color={C.grey} dimColor>
                {h.key}
              </Text>
              <Text> </Text>
              <Text color={C.greyLight}>{h.label}</Text>
            </Box>
          ))}
        </Box>
        {info ? (
          <Text color={C.grey} dimColor>
            {info}
          </Text>
        ) : null}
      </Box>
    </Box>
  )
}
