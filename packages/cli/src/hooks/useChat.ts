// Conversation state and streaming wiring for the CLI.
//
// Holds the message history (incl. system messages from slash commands and
// action executions), calls streamBuilder, appends chunks live. After
// streaming, parses any forge:write blocks the builder emitted and queues
// them for user confirmation (the UI displays a y/n/d dialog ; nothing is
// written before the user approves).

import { type ChatMessage, streamBuilder } from '@agent-forge/core/builder'
import { useCallback, useState } from 'react'
import {
  type ParsedAction,
  executeAction,
  findActionBlocks,
} from '../builder-actions.ts'
import type { Lang } from '../config/store.ts'

export type TurnRole = 'user' | 'assistant' | 'system'

export type ChatTurn = {
  id: string
  role: TurnRole
  content: string
}

export type ChatState = {
  messages: ChatTurn[]
  streaming: ChatTurn | null
  error: string | null
}

const SCROLL_STEP = 4

let counter = 0
const nextId = (): string => {
  counter += 1
  return `m${counter.toString()}`
}

export type PendingAction = ParsedAction

export function useChat(lang: Lang): {
  state: ChatState
  send: (prompt: string) => Promise<void>
  addSystemMessage: (text: string) => void
  clear: () => void
  busy: boolean
  scrollOffset: number
  scrollUp: () => void
  scrollDown: () => void
  scrollToBottom: () => void
  pending: PendingAction | null
  approvePending: () => void
  declinePending: () => void
} {
  const [state, setState] = useState<ChatState>({
    messages: [],
    streaming: null,
    error: null,
  })
  const [busy, setBusy] = useState(false)
  const [scrollOffset, setScrollOffset] = useState(0)
  // Queue of actions awaiting user confirmation. We process one at a time ;
  // `pending` exposes the head of the queue to the UI.
  const [queue, setQueue] = useState<PendingAction[]>([])

  const scrollUp = useCallback(() => {
    setScrollOffset((o) => o + SCROLL_STEP)
  }, [])

  const scrollDown = useCallback(() => {
    setScrollOffset((o) => Math.max(0, o - SCROLL_STEP))
  }, [])

  const scrollToBottom = useCallback(() => {
    setScrollOffset(0)
  }, [])

  const addSystemMessage = useCallback((text: string) => {
    const sysTurn: ChatTurn = { id: nextId(), role: 'system', content: text }
    setScrollOffset(0)
    setState((prev) => ({ ...prev, messages: [...prev.messages, sysTurn] }))
  }, [])

  const clear = useCallback(() => {
    setScrollOffset(0)
    setQueue([])
    setState({ messages: [], streaming: null, error: null })
  }, [])

  const approvePending = useCallback(() => {
    setQueue((q) => {
      const [head, ...rest] = q
      if (!head) return q
      // The user just confirmed via the dialog — that is explicit consent
      // to overwrite an existing file at the same path.
      const exec = executeAction(head, { overwrite: true })
      const sys: ChatTurn = exec.result.ok
        ? {
            id: nextId(),
            role: 'system',
            content: `✓ written ${exec.result.absolutePath}`,
          }
        : {
            id: nextId(),
            role: 'system',
            content: `✗ fileWrite failed : ${exec.result.error}`,
          }
      setState((prev) => ({ ...prev, messages: [...prev.messages, sys] }))
      return rest
    })
  }, [])

  const declinePending = useCallback(() => {
    setQueue((q) => {
      const [head, ...rest] = q
      if (!head) return q
      const sys: ChatTurn = {
        id: nextId(),
        role: 'system',
        content: `× declined : ${head.path}`,
      }
      setState((prev) => ({ ...prev, messages: [...prev.messages, sys] }))
      return rest
    })
  }, [])

  const send = useCallback(
    async (prompt: string): Promise<void> => {
      const userTurn: ChatTurn = { id: nextId(), role: 'user', content: prompt }
      const assistantTurn: ChatTurn = {
        id: nextId(),
        role: 'assistant',
        content: '',
      }

      setScrollOffset(0)
      setState((prev) => ({
        messages: [...prev.messages, userTurn],
        streaming: assistantTurn,
        error: null,
      }))
      setBusy(true)

      try {
        const history: ChatMessage[] = [
          ...state.messages
            .filter((m) => m.role !== 'system')
            .map(({ role, content }) => ({
              role: role as 'user' | 'assistant',
              content,
            })),
          { role: 'user', content: prompt },
        ]

        let acc = ''
        for await (const chunk of streamBuilder({ messages: history, lang })) {
          acc += chunk
          setState((prev) =>
            prev.streaming
              ? { ...prev, streaming: { ...prev.streaming, content: acc } }
              : prev,
          )
        }

        // Commit the assistant turn.
        setState((prev) => ({
          messages: [...prev.messages, { ...assistantTurn, content: acc }],
          streaming: null,
          error: null,
        }))

        // Parse forge:write blocks. Malformed blocks are reported immediately
        // as system messages ; well-formed blocks go to the confirmation queue.
        const blocks = findActionBlocks(acc)
        const sysLines: ChatTurn[] = []
        const newPending: PendingAction[] = []
        for (const block of blocks) {
          if (!block.ok) {
            sysLines.push({
              id: nextId(),
              role: 'system',
              content: `✗ action skipped : ${block.error}`,
            })
          } else {
            newPending.push(block.action)
          }
        }
        if (sysLines.length > 0) {
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, ...sysLines],
          }))
        }
        if (newPending.length > 0) {
          setQueue((q) => [...q, ...newPending])
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setState((prev) => ({
          messages: prev.messages,
          streaming: null,
          error: msg,
        }))
      } finally {
        setBusy(false)
      }
    },
    [state.messages, lang],
  )

  return {
    state,
    send,
    addSystemMessage,
    clear,
    busy,
    scrollOffset,
    scrollUp,
    scrollDown,
    scrollToBottom,
    pending: queue[0] ?? null,
    approvePending,
    declinePending,
  }
}
