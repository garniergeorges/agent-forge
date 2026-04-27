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

import {
  type ChatMessage,
  loadSkillCatalog,
  matchSkillForMessage,
  runScaffoldAndRun,
  streamBuilder,
} from '@agent-forge/core/builder'
import { launchAgent } from '@agent-forge/tools-core'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  type Action,
  type RunAction,
  type SkillAction,
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

function actionFromParsed(
  parsed: ParsedAction,
  skillDescriptionFor: (name: string) => string,
): Action {
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
  if (parsed.kind === 'run') {
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
  // skill : auto-running, the executor resolves the body synchronously.
  return {
    id: nextActionId(),
    kind: 'skill',
    status: 'running',
    skill: parsed.skill,
    description: skillDescriptionFor(parsed.skill),
    createdAt: nowIso(),
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
  if (action.kind === 'run') {
    return {
      kind: 'run',
      agent: action.agent,
      prompt: action.prompt,
      raw: '',
    }
  }
  return {
    kind: 'skill',
    skill: action.skill,
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
  // Skill catalog : loaded once at hook init, kept in a memo so callbacks
  // get a stable reference. Built-ins ship with the package ; users can
  // drop SKILL.md into ~/.agent-forge/skills/ to extend.
  const skillCatalog = useMemo(() => loadSkillCatalog(), [])
  const skillEntries = useMemo(
    () =>
      skillCatalog.skills.map((s) => ({
        name: s.name,
        description: s.description,
        triggers: s.triggers,
      })),
    [skillCatalog],
  )
  const resolveSkillBody = useCallback(
    (name: string): string | null => skillCatalog.byName.get(name)?.body ?? null,
    [skillCatalog],
  )
  const skillDescriptionFor = useCallback(
    (name: string): string =>
      skillCatalog.byName.get(name)?.description ?? '(unknown skill)',
    [skillCatalog],
  )
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

      // Server-side skill matching : if a trigger phrase appears in the
      // user message, dispatch to the dedicated runner instead of the
      // generic streaming flow. The runner makes two narrow LLM calls
      // (one per artefact) so small models keep the AGENT.md and the
      // run prompt cleanly separated.
      const matched = matchSkillForMessage(prompt, skillCatalog.skills)
      if (matched && matched.name === 'scaffold-and-run') {
        const skillCard: SkillAction = {
          id: nextActionId(),
          kind: 'skill',
          status: 'running',
          skill: matched.name,
          description: matched.description,
          createdAt: nowIso(),
        }
        setState((prev) => ({
          ...prev,
          streaming: null,
          actions: [...prev.actions, skillCard],
        }))
        try {
          const result = await runScaffoldAndRun({
            userMessage: prompt,
            lang,
          })
          if (!result) {
            updateAction(skillCard.id, {
              status: 'failed',
              error: 'skill runner produced no usable output',
              finishedAt: nowIso(),
            })
            setBusy(false)
            return
          }
          // Mark the skill as done and surface a write + run pair as
          // proposed cards. The user approves them in order via the
          // permission dialog.
          updateAction(skillCard.id, {
            status: 'done',
            body: matched.body,
            finishedAt: nowIso(),
          })
          const writeCard: WriteAction = {
            id: nextActionId(),
            kind: 'write',
            status: 'proposed',
            path: `agents/${result.agentName}/AGENT.md`,
            content: result.agentMdContent,
            createdAt: nowIso(),
          }
          const runCard: RunAction = {
            id: nextActionId(),
            kind: 'run',
            status: 'proposed',
            agent: result.agentName,
            prompt: result.runPrompt,
            createdAt: nowIso(),
            output: '',
          }
          // Final assistant turn : one short prose sentence so the user
          // sees in the conversation that the skill fired.
          const proseTurn: ChatTurn = {
            id: nextId(),
            role: 'assistant',
            content:
              lang === 'fr'
                ? `Je charge la skill ${matched.name} : un AGENT.md à approuver, puis l'exécution.`
                : `Loading skill ${matched.name} : one AGENT.md to approve, then the run.`,
          }
          persist(proseTurn)
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, proseTurn],
            actions: [...prev.actions, writeCard, runCard],
          }))
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          updateAction(skillCard.id, {
            status: 'failed',
            error: msg,
            finishedAt: nowIso(),
          })
          setState((prev) => ({ ...prev, error: msg }))
        } finally {
          setBusy(false)
        }
        return
      }

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
        for await (const chunk of streamBuilder({
          messages: history,
          lang,
          skills: skillEntries,
        })) {
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
        // Skill bodies executed inline get appended to the assistant turn
        // as a system message so the next builder turn sees the full
        // instructions.
        const skillSystemTurns: ChatTurn[] = []
        for (const block of blocks) {
          if (!block.ok) {
            parseErrors.push({
              id: nextId(),
              role: 'system',
              content: `✗ action skipped : ${block.error}`,
            })
            continue
          }
          const action = actionFromParsed(block.action, skillDescriptionFor)
          if (action.kind === 'skill') {
            // Resolve synchronously and finalise the card state in the
            // same render — skills are local, free, never partial.
            const exec = executeAction(block.action, {
              resolveSkill: resolveSkillBody,
            })
            if (exec.kind === 'skill' && exec.result.ok) {
              const finalised: SkillAction = {
                ...action,
                status: 'done',
                body: exec.result.body,
                finishedAt: nowIso(),
              }
              newActions.push(finalised)
              skillSystemTurns.push({
                id: nextId(),
                role: 'system',
                content: `[skill:${action.skill}] ${exec.result.body}`,
              })
            } else {
              const err =
                exec.kind === 'skill' && !exec.result.ok
                  ? exec.result.error
                  : 'unknown error'
              newActions.push({
                ...action,
                status: 'failed',
                error: err,
                finishedAt: nowIso(),
              })
            }
          } else {
            newActions.push(action)
          }
        }
        const proseOnly = stripActionBlocks(acc)
        const finalAssistant: ChatTurn = {
          ...assistantTurn,
          content: proseOnly,
        }
        persist(finalAssistant)
        for (const e of parseErrors) persist(e)
        for (const s of skillSystemTurns) persist(s)
        setState((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            ...(proseOnly.length > 0 ? [finalAssistant] : []),
            ...parseErrors,
            ...skillSystemTurns,
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
    [state.messages, lang, skillCatalog, skillEntries, updateAction],
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
