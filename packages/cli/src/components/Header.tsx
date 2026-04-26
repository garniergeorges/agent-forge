// Top bar: "▌▌ AGENT FORGE ▐▐" left, optional center label, optional right info.
// Mirrors drawHeader() from demo-sprites/forge-mockup-v3.mjs.

import { Box, Text } from 'ink'
import React from 'react'
import { C } from '../theme/colors.ts'

const VERSION = '0.0.0'

export function Header({
  label,
  info,
}: {
  label?: string
  info?: string
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between" width="100%">
        <Box>
          <Text color={C.orange} bold>
            {' ▌▌ AGENT FORGE ▐▐ '}
          </Text>
          <Text color={C.grey} dimColor>
            v{VERSION}
          </Text>
          {label ? (
            <Text color={C.greyLight}>{`  ${label}`}</Text>
          ) : null}
        </Box>
        {info ? (
          <Text color={C.grey} dimColor>
            {info}
          </Text>
        ) : null}
      </Box>
      <Text color={C.grey} dimColor>
        {'─'.repeat(process.stdout.columns ?? 80)}
      </Text>
    </Box>
  )
}
