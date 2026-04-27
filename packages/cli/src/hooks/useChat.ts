// Conversation state and streaming wiring for the CLI.
//
// Two parallel surfaces are kept here :
//   - `messages` : prose only (user, assistant, slash command output).
//                  Renders in the bottom Welcome block.
//   - `actions`  : structured actions the builder requested (write/run) with
//                  their lifecycle (proposed → approved → running → done|failed).
//                  Renders in the top MissionControl panel.
//
// Builder code blocks (```forge:*) are extracted into actions and STRIPPED
// from the assistant's textual reply before that reply lands in `messages`.

import { type ChatMessage, streamBuilder } from '@agent-forge/core/builder'
import { launchAgent } from '@agent-forge/tools-core'
import { useCallback, useRef, useState } from 'react'
import {
  type Action,
  type RunAction,
  type WriteAction,
  nextActionId,
} from '../actions/types.ts'
import {
  type ParsedAction,
  executeAction,
  findActionBlocks,
  stripActionBlocks,
} from '../builder-actions.ts'
import type { Lang } from '../config/store.ts'
import { getCurrentSession } from '../session/store.ts'

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
  actions: Action[]
}

const SCROLL_STEP = 4

let counter = 0
const nextId = (): string => {
  counter += 1
  return `m${counter.toString()}`
}

function persist(turn: ChatTurn): void {
  try {
    getCurrentSession().appendTurn(turn)
  } catch {
    // ignore
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function actionFromParsed(parsed: ParsedAction): Action {
  if (parsed.kind === 'write') {
    return {
      id: nextActionId(),
      kind: 'write',
      status: 'proposed',
      path: parsed.path,
      content: parsed.content,
      createdAt: nowIso(),
    }
  }
  return {
    id: nextActionId(),
    kind: 'run',
    status: 'proposed',
    agent: parsed.agent,
    prompt: parsed.prompt,
    createdAt: nowIso(),
    output: '',
  }
}

function parsedFromAction(action: Action): ParsedAction {
  if (action.kind === 'write') {
    return {
      kind: 'write',
      path: action.path,
      content: action.content,
      raw: '',
    }
  }
  return {
    kind: 'run',
    agent: action.agent,
    prompt: action.prompt,
    raw: '',
  }
}

export function useChat(lang: Lang): {
  state: ChatState
  send: (prompt: string) => Promise<void>
  addSystemMessage: (text: string) => void
  clear: () => void
  reset: () => void
  busy: boolean
  scrollOffset: number
  scrollUp: () => void
  scrollDown: () => void
  scrollToBottom: () => void
  pending: Action | null
  approvePending: () => void
  declinePending: () => void
  promptDraft: string
  setPromptDraft: (value: string) => void
} {
  const [state, setState] = useState<ChatState>({
    messages: [],
    streaming: null,
    error: null,
    actions: [],
  })
  const [busy, setBusy] = useState(false)
  const [scrollOffset, setScrollOffset] = useState(0)
  // Lifted out of Welcome so App can know when the input is empty (and
  // thus capture Tab for Mission Control focus without stealing keys
  // from the prompt).
  const [promptDraft, setPromptDraftState] = useState('')
  const setPromptDraft = useCallback((value: string) => {
    setPromptDraftState(value)
  }, [])
  // Buffer des messages cachés mais toujours envoyés au LLM dans `send`.
  // `/clear` y déplace les messages visibles (vue vide, contexte préservé) ;
  // `/reset` le purge. Stocké en ref pour ne pas redéclencher de rendu.
  const hiddenHistoryRef = useRef<ChatTurn[]>([])

  const scrollUp = useCallback(() => setScrollOffset((o) => o + SCROLL_STEP), [])
  const scrollDown = useCallback(
    () => setScrollOffset((o) => Math.max(0, o - SCROLL_STEP)),
    [],
  )
  const scrollToBottom = useCallback(() => setScrollOffset(0), [])

  const addSystemMessage = useCallback((text: string) => {
    const sysTurn: ChatTurn = { id: nextId(), role: 'system', content: text }
    setScrollOffset(0)
    persist(sysTurn)
    setState((prev) => ({ ...prev, messages: [...prev.messages, sysTurn] }))
  }, [])

  // /clear : vide uniquement la vue (transcript + actions). Les messages
  // visibles sont déplacés dans hiddenHistoryRef pour rester dans le contexte
  // LLM aux prochains tours.
  const clear = useCallback(() => {
    setScrollOffset(0)
    setState((prev) => {
      hiddenHistoryRef.current = [...hiddenHistoryRef.current, ...prev.messages]
      return { messages: [], streaming: null, error: null, actions: [] }
    })
  }, [])

  // /reset : vide vue ET contexte LLM. Comme un redémarrage de session.
  const reset = useCallback(() => {
    setScrollOffset(0)
    hiddenHistoryRef.current = []
    setState({ messages: [], streaming: null, error: null, actions: [] })
  }, [])

  const updateAction = useCallback(
    (id: string, patch: Partial<Action>): void => {
      setState((prev) => ({
        ...prev,
        actions: prev.actions.map((a) =>
          a.id === id ? ({ ...a, ...patch } as Action) : a,
        ),
      }))
    },
    [],
  )

  const runAgentAction = useCallback(
    async (action: RunAction): Promise<void> => {
      updateAction(action.id, { status: 'running' })
      const handle = launchAgent({ agent: action.agent, prompt: action.prompt })
      let acc = ''
      let finalCode = -1
      let stderrOut = ''
      try {
        for await (const evt of handle.events) {
          if (evt.type === 'chunk') {
            acc += evt.text
            updateAction(action.id, { output: acc })
          } else if (evt.type === 'stderr') {
            stderrOut += evt.text
          } else if (evt.type === 'done') {
            finalCode = evt.exitCode
          } else if (evt.type === 'error') {
            updateAction(action.id, {
              status: 'failed',
              error: evt.error,
              finishedAt: nowIso(),
            })
            return
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        updateAction(action.id, {
          status: 'failed',
          error: msg,
          finishedAt: nowIso(),
        })
        return
      }
      updateAction(action.id, {
        status: finalCode === 0 ? 'done' : 'failed',
        output: acc.trim(),
        exitCode: finalCode,
        error:
          finalCode === 0
            ? undefined
            : `exit ${finalCode.toString()}${stderrOut ? ` : ${stderrOut.split('\n').pop() ?? ''}` : ''}`,
        finishedAt: nowIso(),
      })
    },
    [updateAction],
  )

  const headPending = (state.actions.find((a) => a.status === 'proposed') ??
    null) as Action | null

  const approvePending = useCallback(() => {
    const head = state.actions.find((a) => a.status === 'proposed')
    if (!head) return
    if (head.kind === 'write') {
      const parsed = parsedFromAction(head)
      const exec = executeAction(parsed, { overwrite: true })
      if (exec.kind === 'write' && exec.result.ok) {
        updateAction(head.id, {
          status: 'done',
          result: { absolutePath: exec.result.absolutePath },
          finishedAt: nowIso(),
        })
      } else {
        updateAction(head.id, {
          status: 'failed',
          result:
            exec.kind === 'write' && !exec.result.ok
              ? { error: exec.result.error }
              : { error: 'unknown error' },
          finishedAt: nowIso(),
        })
      }
    } else {
      updateAction(head.id, { status: 'approved' })
      void runAgentAction(head as RunAction)
    }
  }, [state.actions, runAgentAction, updateAction])

  const declinePending = useCallback(() => {
    const head = state.actions.find((a) => a.status === 'proposed')
    if (!head) return
    updateAction(head.id, { status: 'declined', finishedAt: nowIso() })
  }, [state.actions, updateAction])

  const send = useCallback(
    async (prompt: string): Promise<void> => {
      const userTurn: ChatTurn = { id: nextId(), role: 'user', content: prompt }
      const assistantTurn: ChatTurn = {
        id: nextId(),
        role: 'assistant',
        content: '',
      }

      setScrollOffset(0)
      persist(userTurn)
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userTurn],
        streaming: assistantTurn,
        error: null,
      }))
      setBusy(true)

      try {
        const history: ChatMessage[] = [
          ...hiddenHistoryRef.current
            .filter((m) => m.role !== 'system')
            .map(({ role, content }) => ({
              role: role as 'user' | 'assistant',
              content,
            })),
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

        // Extract any forge:* blocks BEFORE persisting the assistant text.
        const blocks = findActionBlocks(acc)
        const parseErrors: ChatTurn[] = []
        const newActions: Action[] = []
        for (const block of blocks) {
          if (!block.ok) {
            parseErrors.push({
              id: nextId(),
              role: 'system',
              content: `✗ action skipped : ${block.error}`,
            })
          } else {
            newActions.push(actionFromParsed(block.action))
          }
        }
        const proseOnly = stripActionBlocks(acc)
        const finalAssistant: ChatTurn = {
          ...assistantTurn,
          content: proseOnly,
        }
        persist(finalAssistant)
        for (const e of parseErrors) persist(e)
        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            ...(proseOnly.length > 0 ? [finalAssistant] : []),
            ...parseErrors,
          ],
          streaming: null,
          error: null,
          actions: [...prev.actions, ...newActions],
        }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setState((prev) => ({
          ...prev,
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
    reset,
    busy,
    scrollOffset,
    scrollUp,
    scrollDown,
    scrollToBottom,
    pending: headPending,
    approvePending,
    declinePending,
    promptDraft,
    setPromptDraft,
  }
}
