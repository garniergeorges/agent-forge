// Conversation state and streaming wiring for the CLI.
// Holds the message history, calls streamBuilder, appends chunks live.
// Also owns the scroll offset for the chat viewport.

import { type ChatMessage, streamBuilder } from '@agent-forge/core/builder'
import { useCallback, useState } from 'react'
import type { Lang } from '../config/store.ts'

export type ChatTurn = ChatMessage & { id: string }

export type ChatState = {
  messages: ChatTurn[]
  streaming: ChatTurn | null // assistant message currently being typed, or null
  error: string | null
}

const SCROLL_STEP = 4 // visual lines moved per PgUp / PgDn press

let counter = 0
const nextId = (): string => {
  counter += 1
  return `m${counter.toString()}`
}

export function useChat(lang: Lang): {
  state: ChatState
  send: (prompt: string) => Promise<void>
  busy: boolean
  scrollOffset: number
  scrollUp: () => void
  scrollDown: () => void
  scrollToBottom: () => void
} {
  const [state, setState] = useState<ChatState>({
    messages: [],
    streaming: null,
    error: null,
  })
  const [busy, setBusy] = useState(false)
  // 0 = pinned to the bottom (live). >0 = scrolled up by that many lines.
  const [scrollOffset, setScrollOffset] = useState(0)

  const scrollUp = useCallback(() => {
    setScrollOffset((o) => o + SCROLL_STEP)
  }, [])

  const scrollDown = useCallback(() => {
    setScrollOffset((o) => Math.max(0, o - SCROLL_STEP))
  }, [])

  const scrollToBottom = useCallback(() => {
    setScrollOffset(0)
  }, [])

  const send = useCallback(
    async (prompt: string): Promise<void> => {
      const userTurn: ChatTurn = { id: nextId(), role: 'user', content: prompt }
      const assistantTurn: ChatTurn = { id: nextId(), role: 'assistant', content: '' }

      // A new turn means we want to see the response : auto-jump back to live.
      setScrollOffset(0)
      setState((prev) => ({
        messages: [...prev.messages, userTurn],
        streaming: assistantTurn,
        error: null,
      }))
      setBusy(true)

      try {
        // Snapshot history (without the empty assistant turn) for the API call.
        const history: ChatMessage[] = [
          ...state.messages.map(({ role, content }) => ({ role, content })),
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

        setState((prev) => ({
          messages: [...prev.messages, { ...assistantTurn, content: acc }],
          streaming: null,
          error: null,
        }))
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

  return { state, send, busy, scrollOffset, scrollUp, scrollDown, scrollToBottom }
}
