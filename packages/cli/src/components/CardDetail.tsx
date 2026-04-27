// Full-screen detail view for a single Mission Control action.
//
// Mounted by App when useCardFocus reports detailOpen=true. Replaces
// both Mission Control AND Welcome — the user gets the entire screen
// to read the full content of the action they pressed Enter on.
//
// Scrolls line-by-line with PgUp / PgDn / arrow up/down. Esc closes.

import { Box, Text, useInput } from 'ink'
import React, { useState } from 'react'
import type { Action, ActionStatus } from '../actions/types.ts'
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

function buildLines(action: Action): HighlightedLine[] {
  if (action.kind === 'write') {
    return highlightYamlText(action.content)
  }
  if (action.kind === 'skill') {
    const out: HighlightedLine[] = []
    out.push([{ text: '── description ──', color: C.grey, dim: true }])
    out.push(...highlightPlain(action.description))
    out.push([{ text: '' }])
    out.push([{ text: '── instructions injected into context ──', color: C.grey, dim: true }])
    if (action.body && action.body.length > 0) {
      out.push(...highlightPlain(action.body))
    } else {
      out.push([{ text: '(skill body not loaded yet)', color: C.grey, dim: true }])
    }
    if (action.status === 'failed' && action.error) {
      out.push([{ text: '' }])
      out.push([{ text: `✗ ${action.error}`, color: C.red }])
    }
    return out
  }
  // run : prompt then output
  const out: HighlightedLine[] = []
  out.push([{ text: '── prompt ──', color: C.grey, dim: true }])
  out.push(...highlightPlain(action.prompt))
  out.push([{ text: '' }])
  out.push([{ text: '── output ──', color: C.grey, dim: true }])
  if (action.output.length > 0) {
    out.push(...highlightPlain(action.output))
  } else {
    out.push([{ text: '(empty)', color: C.grey, dim: true }])
  }
  if (action.status === 'failed' && action.error) {
    out.push([{ text: '' }])
    out.push([{ text: `✗ ${action.error}`, color: C.red }])
  }
  return out
}

function headerFor(action: Action): string {
  if (action.kind === 'write') return `write  ${action.path}`
  if (action.kind === 'skill') return `skill  ${action.skill}`
  return `run  ${action.agent}`
}

export function CardDetail({
  action,
  onClose,
}: {
  action: Action
  onClose: () => void
}): React.JSX.Element {
  const rows = process.stdout.rows ?? 30
  const cols = process.stdout.columns ?? 80
  const lines = buildLines(action)

  // Reserve : 2 rows for the title bar, 2 rows for the footer hint, 1
  // separator. Body gets the rest.
  const bodyHeight = Math.max(5, rows - 5)
  const [offset, setOffset] = useState(0)
  const maxOffset = Math.max(0, lines.length - bodyHeight)

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onClose()
      return
    }
    if (key.pageUp) setOffset((o) => Math.max(0, o - bodyHeight))
    else if (key.pageDown) setOffset((o) => Math.min(maxOffset, o + bodyHeight))
    else if (key.upArrow) setOffset((o) => Math.max(0, o - 1))
    else if (key.downArrow) setOffset((o) => Math.min(maxOffset, o + 1))
    else if (input === 'g') setOffset(0)
    else if (input === 'G') setOffset(maxOffset)
  })

  const visible = lines.slice(offset, offset + bodyHeight)
  const totalLines = lines.length
  const lastShown = Math.min(totalLines, offset + bodyHeight)

  return (
    <Box flexDirection="column" height={rows} width={cols}>
      {/* Title bar */}
      <Box paddingX={2}>
        <Text color={STATUS_COLOR[action.status]} bold>
          {`[${STATUS_LABEL[action.status]}]`}
        </Text>
        <Text color={C.grey} dimColor>
          {'  detail  '}
        </Text>
        <Text color={C.white}>{headerFor(action)}</Text>
      </Box>
      <Text color={C.grey} dimColor>
        {'─'.repeat(cols)}
      </Text>

      {/* Body */}
      <Box flexDirection="column" paddingX={2} height={bodyHeight}>
        {visible.map((segments: HighlightedLine, i: number) => {
          const lineNo = offset + i + 1
          return (
            <Box key={`l-${(offset + i).toString()}`}>
              <Text color={C.grey} dimColor>
                {`${lineNo.toString().padStart(4, ' ')}  `}
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
          )
        })}
      </Box>

      {/* Footer */}
      <Text color={C.grey} dimColor>
        {'─'.repeat(cols)}
      </Text>
      <Box paddingX={2} justifyContent="space-between">
        <Box>
          <Text color={C.grey} dimColor>
            {`lines ${(offset + 1).toString()}..${lastShown.toString()} of ${totalLines.toString()}`}
          </Text>
        </Box>
        <Box>
          <Text color={C.grey} dimColor>
            {'[↑↓ / PgUp/PgDn] scroll  [g/G] top/bottom  [Esc / q] close'}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
