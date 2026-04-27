// MissionControl — fills the top zone whenever there is at least one
// builder action (write or run). Replaces the splash screen for the rest
// of the session.
//
// Each action gets a card with :
//   - a status badge (proposed / running / done / failed)
//   - the target (file path or agent name)
//   - a syntax-highlighted preview of the content (YAML for AGENT.md,
//     plain for prompts) or the streaming agent output

import { Box, Text } from 'ink'
import React from 'react'
import type { Action, ActionStatus, RunAction, WriteAction } from '../actions/types.ts'
import { C } from '../theme/colors.ts'
import {
  type HighlightedLine,
  type Segment,
  highlightPlain,
  highlightYamlText,
} from './syntax.ts'

const STATUS_LABEL: Record<ActionStatus, string> = {
  proposed: 'PROPOSED',
  approved: 'APPROVED',
  running: 'RUNNING',
  done: 'DONE',
  failed: 'FAILED',
  declined: 'DECLINED',
}

const STATUS_COLOR: Record<ActionStatus, string> = {
  proposed: C.orange,
  approved: C.orangeBright,
  running: C.yellow,
  done: C.green,
  failed: C.red,
  declined: C.grey,
}

function HighlightedBlock({
  lines,
  maxLines = 12,
}: {
  lines: HighlightedLine[]
  maxLines?: number
}): React.JSX.Element {
  const shown = lines.slice(0, maxLines)
  const hidden = lines.length - shown.length
  return (
    <Box flexDirection="column" paddingLeft={2}>
      {shown.map((segments, i) => (
        <Box key={`l-${i.toString()}`}>
          <Text color={C.grey} dimColor>
            {`${(i + 1).toString().padStart(3, ' ')}  `}
          </Text>
          {segments.map((seg: Segment, j: number) => (
            <Text
              key={`s-${i.toString()}-${j.toString()}`}
              color={seg.color}
              dimColor={seg.dim}
              bold={seg.bold}
            >
              {seg.text}
            </Text>
          ))}
        </Box>
      ))}
      {hidden > 0 ? (
        <Text color={C.grey} dimColor>
          {`     … ${hidden.toString()} more line${hidden === 1 ? '' : 's'} hidden`}
        </Text>
      ) : null}
    </Box>
  )
}

function StatusBadge({ status }: { status: ActionStatus }): React.JSX.Element {
  return (
    <Box>
      <Text color={STATUS_COLOR[status]} bold>
        {`[${STATUS_LABEL[status]}]`}
      </Text>
    </Box>
  )
}

function borderColorFor(status: ActionStatus, focused: boolean): string {
  if (focused) return C.orangeBright
  if (status === 'done') return C.green
  if (status === 'failed') return C.red
  if (status === 'declined') return C.grey
  // proposed / approved / running
  return C.orange
}

function CardFrame({
  status,
  focused,
  children,
}: {
  status: ActionStatus
  focused: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Box
      flexDirection="column"
      borderStyle={focused ? 'double' : 'round'}
      borderColor={borderColorFor(status, focused)}
      paddingX={2}
      paddingY={0}
      marginBottom={1}
      alignSelf="stretch"
    >
      {children}
    </Box>
  )
}

function FocusMarker({ focused }: { focused: boolean }): React.JSX.Element {
  return (
    <Text color={C.orangeBright} bold>
      {focused ? '▸ ' : '  '}
    </Text>
  )
}

function WriteCard({
  action,
  focused,
}: {
  action: WriteAction
  focused: boolean
}): React.JSX.Element {
  const lines = highlightYamlText(action.content)
  return (
    <CardFrame status={action.status} focused={focused}>
      <Box>
        <FocusMarker focused={focused} />
        <StatusBadge status={action.status} />
        <Text color={C.grey} dimColor>{'  write  '}</Text>
        <Text color={C.white}>{action.path}</Text>
      </Box>
      <Box marginTop={1}>
        <HighlightedBlock lines={lines} maxLines={14} />
      </Box>
      {action.status === 'done' && action.result && 'absolutePath' in action.result ? (
        <Box marginTop={1} paddingLeft={2}>
          <Text color={C.green}>{`  ✓ written ${action.result.absolutePath}`}</Text>
        </Box>
      ) : null}
      {action.status === 'failed' && action.result && 'error' in action.result ? (
        <Box marginTop={1} paddingLeft={2}>
          <Text color={C.red}>{`  ✗ ${action.result.error}`}</Text>
        </Box>
      ) : null}
    </CardFrame>
  )
}

function RunCard({
  action,
  focused,
}: {
  action: RunAction
  focused: boolean
}): React.JSX.Element {
  const promptLines = highlightPlain(action.prompt)
  const outputLines = action.output.length > 0 ? highlightPlain(action.output) : []
  return (
    <CardFrame status={action.status} focused={focused}>
      <Box>
        <FocusMarker focused={focused} />
        <StatusBadge status={action.status} />
        <Text color={C.grey} dimColor>{'  run  '}</Text>
        <Text color={C.white}>{action.agent}</Text>
      </Box>
      <Box marginTop={1} paddingLeft={2}>
        <Text color={C.grey} dimColor>{'prompt'}</Text>
      </Box>
      <HighlightedBlock lines={promptLines} maxLines={6} />
      {outputLines.length > 0 ? (
        <>
          <Box marginTop={1} paddingLeft={2}>
            <Text color={C.grey} dimColor>{'output'}</Text>
          </Box>
          <HighlightedBlock lines={outputLines} maxLines={14} />
        </>
      ) : null}
      {action.status === 'failed' && action.error ? (
        <Box marginTop={1} paddingLeft={2}>
          <Text color={C.red}>{`  ✗ ${action.error}`}</Text>
        </Box>
      ) : null}
    </CardFrame>
  )
}

export function MissionControl({
  actions,
  focusedId,
}: {
  actions: Action[]
  focusedId: string | null
}): React.JSX.Element {
  const cols = process.stdout.columns ?? 80
  return (
    <Box
      flexDirection="column"
      width={cols}
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color={C.orange} bold>
          {' ▌▌ MISSION CONTROL ▐▐ '}
        </Text>
        <Text color={C.grey} dimColor>
          {`  ${actions.length.toString()} action${actions.length === 1 ? '' : 's'}`}
        </Text>
        {focusedId === null ? (
          <Text color={C.grey} dimColor>
            {'   [Tab] focus a card  ·  [Enter] open detail'}
          </Text>
        ) : (
          <Text color={C.grey} dimColor>
            {'   [Enter] open detail  ·  [Tab/Shift+Tab] cycle'}
          </Text>
        )}
      </Box>
      {actions.map((a) => {
        const focused = a.id === focusedId
        return a.kind === 'write' ? (
          <WriteCard key={a.id} action={a} focused={focused} />
        ) : (
          <RunCard key={a.id} action={a} focused={focused} />
        )
      })}
    </Box>
  )
}
