// Scrollable chat viewport. Rendered at a fixed height.
//
// Approach : flatten the whole transcript into a list of visual lines, then
// take a window of those lines according to scrollOffset. This way scrolling
// is line-by-line and never skips parts of a message.

import { Box, Text } from 'ink'
import React from 'react'
import type { ChatTurn } from '../hooks/useChat.ts'
import { C } from '../theme/colors.ts'

const PREFIX_WIDTH = 3 // " ❯ " or " ▸ "
const CONTINUATION = '   ' // 3 spaces, aligns with prefix

type VisualLine = {
  key: string
  prefix: string // displayed prefix (only on first line of a turn)
  prefixColor: string
  text: string
  textColor: string
  isContinuation: boolean
}

function wrap(content: string, usable: number): string[] {
  const out: string[] = []
  for (const raw of content.split('\n')) {
    if (raw.length === 0) {
      out.push('')
      continue
    }
    for (let i = 0; i < raw.length; i += usable) {
      out.push(raw.slice(i, i + usable))
    }
  }
  return out
}

function turnToLines(turn: ChatTurn, columns: number): VisualLine[] {
  const usable = Math.max(20, columns - PREFIX_WIDTH - 2)
  const wrapped = wrap(turn.content, usable)
  let prefix: string
  let prefixColor: string
  let textColor: string
  if (turn.role === 'user') {
    prefix = ' ❯ '
    prefixColor = C.grey
    textColor = C.greyLight
  } else if (turn.role === 'assistant') {
    prefix = ' ▸ '
    prefixColor = C.orange
    textColor = C.white
  } else {
    prefix = ' · '
    prefixColor = C.grey
    textColor = C.grey
  }
  return wrapped.map((line, i) => ({
    key: `${turn.id}-${i.toString()}`,
    prefix: i === 0 ? prefix : CONTINUATION,
    prefixColor,
    text: line,
    textColor,
    isContinuation: i > 0,
  }))
}

function blankLine(key: string): VisualLine {
  return {
    key,
    prefix: '   ',
    prefixColor: C.grey,
    text: '',
    textColor: C.grey,
    isContinuation: false,
  }
}

export function ChatViewport({
  messages,
  streaming,
  error,
  height,
  scrollOffset,
}: {
  messages: ChatTurn[]
  streaming: ChatTurn | null
  error: string | null
  height: number
  scrollOffset: number
}): React.JSX.Element {
  const columns = process.stdout.columns ?? 80
  const items: ChatTurn[] = streaming ? [...messages, streaming] : messages

  // Flatten : turn → lines, with a blank separator between turns.
  const allLines: VisualLine[] = []
  items.forEach((it, idx) => {
    if (idx > 0) allLines.push(blankLine(`gap-${it.id}`))
    allLines.push(...turnToLines(it, columns))
  })

  const errorLines = error ? 1 : 0
  const scrolled = scrollOffset > 0
  const indicatorLines = scrolled ? 1 : 0
  const availableLines = Math.max(1, height - errorLines - indicatorLines)

  // Window : take `availableLines` ending at (totalLines - scrollOffset).
  const total = allLines.length
  const end = Math.max(availableLines, total - scrollOffset)
  const start = Math.max(0, end - availableLines)
  const visible = allLines.slice(start, end)

  return (
    <Box flexDirection="column" height={height} overflow="hidden" paddingX={1}>
      {visible.map((l) => (
        <Box key={l.key} flexShrink={0}>
          <Text color={l.prefixColor} dimColor={l.isContinuation}>
            {l.prefix}
          </Text>
          <Text color={l.textColor}>{l.text}</Text>
        </Box>
      ))}
      {error ? <Text color={C.red}>{` ✗ ${error}`}</Text> : null}
      {scrolled ? (
        <Text color={C.grey} dimColor>
          {`  … scrolled up · PgDn to scroll down · Ctrl+E to return live`}
        </Text>
      ) : null}
    </Box>
  )
}
