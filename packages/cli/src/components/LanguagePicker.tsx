// Inline language picker block — designed to be embedded inside Splash, NOT
// rendered as its own full screen. Bilingual (EN + FR) since we do not yet
// know which language the user wants. Selection is persisted by the parent.

import { Box, Text, useInput, useStdin } from 'ink'
import React, { useState } from 'react'
import { type Lang } from '../config/store.ts'
import { useT } from '../i18n/LanguageContext.tsx'
import { C } from '../theme/colors.ts'

const OPTIONS: ReadonlyArray<{ lang: Lang; label: string }> = [
  { lang: 'en', label: 'English' },
  { lang: 'fr', label: 'Français' },
]

export function LanguagePicker({
  onPick,
}: {
  onPick: (lang: Lang) => void
}): React.JSX.Element {
  const t = useT()
  const { isRawModeSupported } = useStdin()
  const [index, setIndex] = useState(0)

  useInput(
    (input, key) => {
      if (key.leftArrow) {
        setIndex((i) => (i - 1 + OPTIONS.length) % OPTIONS.length)
      } else if (key.rightArrow) {
        setIndex((i) => (i + 1) % OPTIONS.length)
      } else if (input === 'e' || input === 'E') {
        setIndex(0)
      } else if (input === 'f' || input === 'F') {
        setIndex(1)
      } else if (key.return) {
        const picked = OPTIONS[index]
        if (picked) onPick(picked.lang)
      }
    },
    { isActive: isRawModeSupported },
  )

  return (
    <Box flexDirection="column" alignItems="center">
      <Box flexDirection="column" alignItems="center">
        <Text color={C.orange} bold>
          {t('langPickerTitleEN')}
        </Text>
        <Text color={C.orange} bold>
          {t('langPickerTitleFR')}
        </Text>
      </Box>

      <Box marginTop={2}>
        {OPTIONS.map((opt, i) => {
          const selected = i === index
          return (
            <Box key={opt.lang} marginX={2}>
              <Text color={selected ? C.orange : C.grey}>
                {selected ? '▸ ' : '  '}
              </Text>
              <Text color={selected ? C.white : C.greyLight} bold={selected}>
                {opt.label}
              </Text>
            </Box>
          )
        })}
      </Box>

      <Box marginTop={2}>
        <Text color={C.grey} dimColor>
          [←→] {t('langPickerHintNavigate')}   [E/F] shortcut   [⏎]{' '}
          {t('langPickerHintSelect')}
        </Text>
      </Box>
    </Box>
  )
}
