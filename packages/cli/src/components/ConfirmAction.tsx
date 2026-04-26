// System-level permission dialog. A modal Q/A widget rendered above the
// prompt whenever the builder requests a destructive action (file write,
// container launch, …). Suspends text input until the user picks an option.
//
// Style : framed (double orange border), distinct from the chat flow, with
// an explicit question, a metadata block, a preview, and three "button-
// like" choices.

import { Box, Text, useInput, useStdin } from 'ink'
import React, { useState } from 'react'
import type { Action } from '../actions/types.ts'
import { useLanguage } from '../i18n/LanguageContext.tsx'
import { C } from '../theme/colors.ts'

const PREVIEW_LINES = 6

type Strings = {
  title: string
  questionWrite: string
  questionRun: string
  typeLabel: string
  pathLabel: string
  agentLabel: string
  promptLabel: string
  sizeLabel: string
  approve: string
  decline: string
  expand: string
  collapse: string
  actionWrite: string
  actionRun: string
}

const STRINGS: Record<'en' | 'fr', Strings> = {
  en: {
    title: 'PERMISSION REQUIRED',
    questionWrite: 'Allow Agent Forge to write this file?',
    questionRun: 'Allow Agent Forge to launch this agent?',
    typeLabel: 'action',
    pathLabel: 'target',
    agentLabel: 'agent',
    promptLabel: 'prompt',
    sizeLabel: 'size',
    approve: 'Approve',
    decline: 'Decline',
    expand: 'Show full content',
    collapse: 'Collapse preview',
    actionWrite: 'create file',
    actionRun: 'launch agent',
  },
  fr: {
    title: 'AUTORISATION REQUISE',
    questionWrite: 'Autoriser Agent Forge à écrire ce fichier ?',
    questionRun: 'Autoriser Agent Forge à lancer cet agent ?',
    typeLabel: 'action',
    pathLabel: 'cible',
    agentLabel: 'agent',
    promptLabel: 'prompt',
    sizeLabel: 'taille',
    approve: 'Autoriser',
    decline: 'Refuser',
    expand: 'Afficher le contenu complet',
    collapse: "Réduire l’aperçu",
    actionWrite: 'créer un fichier',
    actionRun: 'lancer un agent',
  },
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
  action: Action
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

  const isWrite = action.kind === 'write'
  const previewSource = isWrite ? action.content : action.prompt
  const lines = previewSource.split('\n')
  const total = lines.length
  const shown = expanded ? lines : lines.slice(0, PREVIEW_LINES)
  const hidden = total - shown.length
  const sizeKb = (previewSource.length / 1024).toFixed(1)

  const labelKeys = isWrite
    ? [s.typeLabel, s.pathLabel, s.sizeLabel]
    : [s.typeLabel, s.agentLabel, s.promptLabel]
  const labelWidth = Math.max(...labelKeys.map((l) => l.length))
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
      {/* Title */}
      <Box>
        <Text color={C.orange} bold>
          {`▲ ${s.title}`}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text color={C.white}>{isWrite ? s.questionWrite : s.questionRun}</Text>
      </Box>

      {/* Metadata */}
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color={C.grey} dimColor>
            {`  ${pad(s.typeLabel)}  `}
          </Text>
          <Text color={C.greyLight}>
            {isWrite ? s.actionWrite : s.actionRun}
          </Text>
        </Box>
        {isWrite ? (
          <>
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
          </>
        ) : (
          <>
            <Box>
              <Text color={C.grey} dimColor>
                {`  ${pad(s.agentLabel)}  `}
              </Text>
              <Text color={C.white}>{action.agent}</Text>
            </Box>
            <Box>
              <Text color={C.grey} dimColor>
                {`  ${pad(s.promptLabel)}  `}
              </Text>
              <Text color={C.greyLight}>{`${total.toString()} lines · ${sizeKb} KB`}</Text>
            </Box>
          </>
        )}
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
