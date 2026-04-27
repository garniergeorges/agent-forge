// System-level permission dialog. A modal Q/A widget rendered above the
// prompt whenever the builder requests a destructive action (file write,
// container launch, …). Suspends text input until the user picks an option.
//
// Style : framed (double orange border), distinct from the chat flow, with
// an explicit question, a metadata block, a preview, and three "button-
// like" choices.
//
// P5 : when a write action concerns an AGENT.md whose sandbox section
// relaxes the strict defaults (network=bridge, readOnlyRoot=false,
// elevated resources), we surface a list of warnings between the
// metadata and the preview so the user notices before approving.

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Box, Text, useInput, useStdin } from 'ink'
import React, { useState } from 'react'
import {
  type AppliedSandboxConfig,
  SANDBOX_DEFAULTS,
  applySandboxDefaults,
  parseAgentMd,
} from '@agent-forge/core/types'
import type { Action } from '../actions/types.ts'
import { useLanguage } from '../i18n/LanguageContext.tsx'
import { C } from '../theme/colors.ts'

const PREVIEW_LINES = 6

type SandboxWarning = {
  field: string
  detail: string
}

function diffAgainstDefaults(
  cfg: AppliedSandboxConfig,
  lang: 'en' | 'fr',
): SandboxWarning[] {
  const t = lang === 'fr'
  const out: SandboxWarning[] = []
  if (cfg.network !== SANDBOX_DEFAULTS.network) {
    out.push({
      field: 'network',
      detail: t
        ? `réseau ouvert (${cfg.network}) — l'agent pourra accéder à internet`
        : `network open (${cfg.network}) — agent will have internet access`,
    })
  }
  if (cfg.readOnlyRoot !== SANDBOX_DEFAULTS.readOnlyRoot) {
    out.push({
      field: 'readOnlyRoot',
      detail: t
        ? "racine en écriture — l'agent peut modifier le système de fichiers de l'image"
        : 'writable root — agent can mutate the image filesystem',
    })
  }
  if (cfg.user !== SANDBOX_DEFAULTS.user) {
    out.push({
      field: 'user',
      detail: t
        ? `utilisateur "${cfg.user}" au lieu de "${SANDBOX_DEFAULTS.user}"`
        : `user "${cfg.user}" instead of "${SANDBOX_DEFAULTS.user}"`,
    })
  }
  if (cfg.memory !== SANDBOX_DEFAULTS.memory) {
    out.push({
      field: 'memory',
      detail: t
        ? `mémoire ${cfg.memory} (défaut ${SANDBOX_DEFAULTS.memory})`
        : `memory ${cfg.memory} (default ${SANDBOX_DEFAULTS.memory})`,
    })
  }
  if (cfg.cpus !== SANDBOX_DEFAULTS.cpus) {
    out.push({
      field: 'cpus',
      detail: t
        ? `CPU ${cfg.cpus} (défaut ${SANDBOX_DEFAULTS.cpus.toString()})`
        : `cpus ${cfg.cpus.toString()} (default ${SANDBOX_DEFAULTS.cpus.toString()})`,
    })
  }
  if (cfg.pidsLimit !== SANDBOX_DEFAULTS.pidsLimit) {
    out.push({
      field: 'pidsLimit',
      detail: t
        ? `pids ${cfg.pidsLimit.toString()} (défaut ${SANDBOX_DEFAULTS.pidsLimit.toString()})`
        : `pids ${cfg.pidsLimit.toString()} (default ${SANDBOX_DEFAULTS.pidsLimit.toString()})`,
    })
  }
  return out
}

// Resolve the sandbox config from whichever source the action carries :
// - write action targeting an AGENT.md → parse the proposed content
//   directly (the file may not exist on disk yet)
// - run action → read the persisted AGENT.md from ~/.agent-forge
// Returns null if no AGENT.md is involved or parsing fails.
function sandboxFor(action: Action): AppliedSandboxConfig | null {
  try {
    if (action.kind === 'write' && action.path.endsWith('AGENT.md')) {
      const parsed = parseAgentMd(action.content)
      return applySandboxDefaults(parsed.meta.sandbox)
    }
    if (action.kind === 'run') {
      const path = join(
        homedir(),
        '.agent-forge',
        'agents',
        action.agent,
        'AGENT.md',
      )
      if (!existsSync(path)) return null
      const parsed = parseAgentMd(readFileSync(path, 'utf8'))
      return applySandboxDefaults(parsed.meta.sandbox)
    }
  } catch {
    return null
  }
  return null
}

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
  warningHeader: string
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
    warningHeader: 'Sandbox relaxations applied to this agent :',
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
    warningHeader: 'Relaxations sandbox appliquées à cet agent :',
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

      {/* Sandbox warnings : surface every relaxation vs the strict
          defaults so the user can spot e.g. network=bridge before
          approving. Only renders when at least one relaxation is
          declared in the AGENT.md sandbox section. */}
      {(() => {
        const cfg = sandboxFor(action)
        if (!cfg) return null
        const warnings = diffAgainstDefaults(cfg, lang ?? 'en')
        if (warnings.length === 0) return null
        return (
          <Box flexDirection="column" marginTop={1}>
            <Text color={C.red} bold>
              {`  ▲ ${s.warningHeader}`}
            </Text>
            {warnings.map((w) => (
              <Box key={w.field}>
                <Text color={C.red}>{`    · ${w.field}`}</Text>
                <Text color={C.greyLight}>{` — ${w.detail}`}</Text>
              </Box>
            ))}
          </Box>
        )
      })()}

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
