// MissionControl — fills the top zone whenever there is at least one
// builder action. Two display modes per card :
//
//   - compact (default for unfocused cards) : 1 terminal line, badge +
//     verb + target, kept together with a thin border.
//   - expanded (focused card, or any card whose status is 'running' so
//     a streaming output stays visible) : the full preview panel as
//     before.
//
// The panel itself is bounded : it accepts a panelHeight prop and
// renders only the slice of cards starting at scrollTop that fits
// within that height. Truncation is signalled by "↑ N above /
// ↓ N below" hints in the header.

import { Box, Text } from 'ink'
import React from 'react'
import type {
  Action,
  ActionStatus,
  RunAction,
  SkillAction,
  WriteAction,
} from '../actions/types.ts'
import { C } from '../theme/colors.ts'
import {
  type HighlightedLine,
  type Segment,
  highlightAgentRun,
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

// ── Compact row : single line for unfocused cards ─────────────────

function verbFor(action: Action): string {
  if (action.kind === 'write') return 'write'
  if (action.kind === 'run') return 'run'
  return 'skill'
}

function targetFor(action: Action): string {
  if (action.kind === 'write') return action.path
  if (action.kind === 'run') return action.agent
  return action.skill
}

function CompactRow({
  action,
  focused,
}: {
  action: Action
  focused: boolean
}): React.JSX.Element {
  return (
    <Box paddingX={1}>
      <FocusMarker focused={focused} />
      <StatusBadge status={action.status} />
      <Text color={C.grey} dimColor>{`  ${verbFor(action).padEnd(5, ' ')}  `}</Text>
      <Text color={C.white}>{targetFor(action)}</Text>
    </Box>
  )
}

// ── Expanded cards ────────────────────────────────────────────────

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
  const outputLines =
    action.output.length > 0 ? highlightAgentRun(action.output) : []
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

function SkillCard({
  action,
  focused,
}: {
  action: SkillAction
  focused: boolean
}): React.JSX.Element {
  return (
    <CardFrame status={action.status} focused={focused}>
      <Box>
        <FocusMarker focused={focused} />
        <StatusBadge status={action.status} />
        <Text color={C.grey} dimColor>{'  skill  '}</Text>
        <Text color={C.white}>{action.skill}</Text>
      </Box>
      <Box marginTop={1} paddingLeft={2}>
        <Text color={C.greyLight}>{action.description}</Text>
      </Box>
      {action.status === 'done' ? (
        <Box marginTop={1} paddingLeft={2}>
          <Text color={C.green}>{'  ✓ skill loaded into context'}</Text>
        </Box>
      ) : null}
      {action.status === 'failed' && action.error ? (
        <Box marginTop={1} paddingLeft={2}>
          <Text color={C.red}>{`  ✗ ${action.error}`}</Text>
        </Box>
      ) : null}
    </CardFrame>
  )
}

// ── Layout : how many lines does a card need ? ────────────────────

const COMPACT_HEIGHT = 1

function expandedHeight(action: Action): number {
  // Empirical estimate ; we don't try to be exact, we want a stable
  // upper bound so the panel can budget rows.
  if (action.kind === 'write') {
    // CardFrame border 2, header 1, marginTop 1, body up to 14, hint 1+1 = ~20
    return 20
  }
  if (action.kind === 'run') {
    // border 2, header 1, prompt label 1, prompt up to 6, output label 1, output up to 14, error 1 = ~26
    return 26
  }
  // skill : border 2, header 1, description ~1, loaded hint 1 = ~7
  return 7
}

function heightOf(
  action: Action,
  focused: boolean,
): number {
  if (focused) return expandedHeight(action)
  // Running cards stay expanded so a streaming agent run stays visible.
  if (action.status === 'running') return expandedHeight(action)
  return COMPACT_HEIGHT + 1 /* paddingY around row */
}

// ── Slicing : start at scrollTop, fit within panelHeight ──────────

type Slice = {
  visible: Action[]
  hiddenAbove: number
  hiddenBelow: number
}

function sliceForViewport({
  actions,
  focusedId,
  scrollTop,
  panelHeight,
}: {
  actions: Action[]
  focusedId: string | null
  scrollTop: number
  panelHeight: number
}): Slice {
  const start = Math.min(Math.max(0, scrollTop), Math.max(0, actions.length - 1))
  const visible: Action[] = []
  let used = 0
  for (let i = start; i < actions.length; i += 1) {
    const a = actions[i] as Action
    const h = heightOf(a, a.id === focusedId)
    if (used + h > panelHeight && visible.length > 0) break
    visible.push(a)
    used += h
    if (used >= panelHeight) break
  }
  return {
    visible,
    hiddenAbove: start,
    hiddenBelow: Math.max(0, actions.length - start - visible.length),
  }
}

export function MissionControl({
  actions,
  focusedId,
  scrollTop,
  panelHeight,
}: {
  actions: Action[]
  focusedId: string | null
  scrollTop: number
  panelHeight: number
}): React.JSX.Element {
  const cols = process.stdout.columns ?? 80
  // Reserve 2 rows for the header + truncation hints, the rest is body.
  const bodyHeight = Math.max(3, panelHeight - 2)
  const slice = sliceForViewport({
    actions,
    focusedId,
    scrollTop,
    panelHeight: bodyHeight,
  })

  return (
    <Box flexDirection="column" width={cols} paddingX={2} paddingY={1}>
      <Box>
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
            {'   [Enter] open detail  ·  [Tab/Shift+Tab] cycle  ·  [Esc] unfocus'}
          </Text>
        )}
      </Box>

      {slice.hiddenAbove > 0 ? (
        <Text color={C.grey} dimColor>
          {`  ↑ ${slice.hiddenAbove.toString()} action${slice.hiddenAbove === 1 ? '' : 's'} above`}
        </Text>
      ) : null}

      {slice.visible.map((a) => {
        const focused = a.id === focusedId
        const expand = focused || a.status === 'running'
        if (!expand) return <CompactRow key={a.id} action={a} focused={focused} />
        if (a.kind === 'write') return <WriteCard key={a.id} action={a} focused={focused} />
        if (a.kind === 'run') return <RunCard key={a.id} action={a} focused={focused} />
        return <SkillCard key={a.id} action={a} focused={focused} />
      })}

      {slice.hiddenBelow > 0 ? (
        <Text color={C.grey} dimColor>
          {`  ↓ ${slice.hiddenBelow.toString()} action${slice.hiddenBelow === 1 ? '' : 's'} below`}
        </Text>
      ) : null}
    </Box>
  )
}
