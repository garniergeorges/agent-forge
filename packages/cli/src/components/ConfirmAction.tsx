// System-level permission dialog. A modal Q/A widget rendered above the
// prompt whenever the builder requests a destructive action (file write,
// container launch, …). Suspends text input until the user picks an option.
//
// Style : framed, distinct from the chat flow, with an explicit question,
// a metadata block, a preview, and three "button-like" choices.

import { Box, Text, useInput, useStdin } from 'ink'
import React, { useState } from 'react'
import type { PendingAction } from '../hooks/useChat.ts'
import { useLanguage } from '../i18n/LanguageContext.tsx'
import { C } from '../theme/colors.ts'

const PREVIEW_LINES = 6

type Strings = {
  title: string
  question: string
  typeLabel: string
  pathLabel: string
  sizeLabel: string
  approve: string
  decline: string
  expand: string
  collapse: string
}

const STRINGS: Record<'en' | 'fr', Strings> = {
  en: {
    title: 'PERMISSION REQUIRED',
    question: 'Allow Agent Forge to perform this action?',
    typeLabel: 'action',
    pathLabel: 'target',
    sizeLabel: 'size',
    approve: 'Approve',
    decline: 'Decline',
    expand: 'Show full content',
    collapse: 'Collapse preview',
  },
  fr: {
    title: 'AUTORISATION REQUISE',
    question: 'Autoriser Agent Forge à exécuter cette action ?',
    typeLabel: 'action',
    pathLabel: 'cible',
    sizeLabel: 'taille',
    approve: 'Autoriser',
    decline: 'Refuser',
    expand: 'Afficher le contenu complet',
    collapse: 'Réduire l’aperçu',
  },
}

function actionType(action: PendingAction): string {
  if (action.path.endsWith('AGENT.md')) return 'create agent'
  return 'write file'
}

function Button({
  hotkey,
  label,
  color,
}: {
  hotkey: string
  label: string
  color: string
}): React.JSX.Element {
  return (
    <Box borderStyle="round" borderColor={color} paddingX={1} marginRight={2}>
      <Text color={color} bold>
        {hotkey}
      </Text>
      <Text color={C.greyLight}>{` · ${label}`}</Text>
    </Box>
  )
}

export function ConfirmAction({
  action,
  onApprove,
  onDecline,
}: {
  action: PendingAction
  onApprove: () => void
  onDecline: () => void
}): React.JSX.Element {
  const { lang } = useLanguage()
  const s = STRINGS[lang ?? 'en']
  const { isRawModeSupported } = useStdin()
  const [expanded, setExpanded] = useState(false)

  useInput(
    (input, key) => {
      if (input === 'y' || input === 'Y' || key.return) onApprove()
      else if (input === 'n' || input === 'N' || key.escape) onDecline()
      else if (input === 'd' || input === 'D') setExpanded((e) => !e)
    },
    { isActive: isRawModeSupported },
  )

  const lines = action.content.split('\n')
  const total = lines.length
  const shown = expanded ? lines : lines.slice(0, PREVIEW_LINES)
  const hidden = total - shown.length
  const sizeKb = (action.content.length / 1024).toFixed(1)

  const labelWidth = Math.max(
    s.typeLabel.length,
    s.pathLabel.length,
    s.sizeLabel.length,
  )
  const pad = (label: string): string => label.padEnd(labelWidth, ' ')

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={C.orange}
      paddingX={2}
      paddingY={0}
      marginTop={1}
      alignSelf="stretch"
      flexShrink={0}
    >
      {/* Title bar */}
      <Box>
        <Text color={C.orange} bold>
          {`▲ ${s.title}`}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={C.white}>{s.question}</Text>
      </Box>

      {/* Metadata table */}
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color={C.grey} dimColor>
            {`  ${pad(s.typeLabel)}  `}
          </Text>
          <Text color={C.greyLight}>{actionType(action)}</Text>
        </Box>
        <Box>
          <Text color={C.grey} dimColor>
            {`  ${pad(s.pathLabel)}  `}
          </Text>
          <Text color={C.white}>{action.path}</Text>
        </Box>
        <Box>
          <Text color={C.grey} dimColor>
            {`  ${pad(s.sizeLabel)}  `}
          </Text>
          <Text color={C.greyLight}>{`${total.toString()} lines · ${sizeKb} KB`}</Text>
        </Box>
      </Box>

      {/* Preview */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={C.grey} dimColor>
          {'  ─── preview ───────────────────────────────'}
        </Text>
        <Box flexDirection="column" paddingLeft={2}>
          {shown.map((line, i) => (
            <Box key={`p-${i.toString()}`}>
              <Text color={C.grey} dimColor>
                {`${(i + 1).toString().padStart(3, ' ')}  `}
              </Text>
              <Text color={C.greyLight}>{line.length > 0 ? line : ' '}</Text>
            </Box>
          ))}
          {hidden > 0 ? (
            <Text color={C.grey} dimColor>
              {`     … ${hidden.toString()} more line${hidden === 1 ? '' : 's'} hidden`}
            </Text>
          ) : null}
        </Box>
      </Box>

      {/* Buttons */}
      <Box marginTop={1}>
        <Button hotkey="Y" label={s.approve} color={C.green} />
        <Button hotkey="N" label={s.decline} color={C.red} />
        <Button
          hotkey="D"
          label={expanded ? s.collapse : s.expand}
          color={C.orange}
        />
      </Box>
    </Box>
  )
}
