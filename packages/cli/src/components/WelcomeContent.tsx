// Empty-state content for the chat zone : question + suggestions.
// Shown only before the user sends their first message. Sits inside the
// bottom Welcome block (NOT centered in the middle of the screen).

import { Box, Text } from 'ink'
import React from 'react'
import { useT } from '../i18n/LanguageContext.tsx'
import { C } from '../theme/colors.ts'

export function WelcomeContent(): React.JSX.Element {
  const t = useT()
  return (
    <Box flexDirection="column" alignItems="center" marginTop={1}>
      <Text color={C.orange} bold>
        {t('welcomeTitle')}
      </Text>
      <Box marginTop={1}>
        <Text color={C.greyLight}>{t('welcomeSubtitle')}</Text>
      </Box>
      <Box flexDirection="column" marginTop={2}>
        <Text color={C.greyLight} dimColor>
          {t('welcomeSuggestion1')}
        </Text>
        <Text color={C.greyLight} dimColor>
          {t('welcomeSuggestion2')}
        </Text>
        <Text color={C.greyLight} dimColor>
          {t('welcomeSuggestion3')}
        </Text>
        <Text color={C.greyLight} dimColor>
          {t('welcomeSuggestion4')}
        </Text>
      </Box>
    </Box>
  )
}
