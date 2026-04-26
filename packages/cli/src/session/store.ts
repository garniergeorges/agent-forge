// Session persistence : every turn (user, assistant, agent, system) is
// appended to ~/.agent-forge/sessions/<id>/transcript.jsonl as a single
// JSON line. Replayable and grep-friendly.
//
// We do NOT persist the streaming partial state — only finalized turns,
// once their content is committed.

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ChatTurn } from '../hooks/useChat.ts'

const SESSIONS_DIR = join(homedir(), '.agent-forge', 'sessions')

export type SessionRecord = {
  id: string
  startedAt: string // ISO
  turns: number
  lastTurnAt?: string
}

export type PersistedTurn = ChatTurn & { ts: string }

function newSessionId(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const rand = Math.random().toString(36).slice(2, 8)
  return `${ts}-${rand}`
}

export class Session {
  readonly id: string
  readonly dir: string
  readonly transcriptPath: string

  private constructor(id: string) {
    this.id = id
    this.dir = join(SESSIONS_DIR, id)
    this.transcriptPath = join(this.dir, 'transcript.jsonl')
  }

  static start(): Session {
    const session = new Session(newSessionId())
    mkdirSync(session.dir, { recursive: true })
    return session
  }

  static resume(id: string): Session {
    const session = new Session(id)
    if (!existsSync(session.transcriptPath)) {
      throw new Error(`session not found : ${id}`)
    }
    return session
  }

  appendTurn(turn: ChatTurn): void {
    const persisted: PersistedTurn = { ...turn, ts: new Date().toISOString() }
    appendFileSync(
      this.transcriptPath,
      `${JSON.stringify(persisted)}\n`,
      'utf8',
    )
  }

  loadTurns(): ChatTurn[] {
    if (!existsSync(this.transcriptPath)) return []
    const raw = readFileSync(this.transcriptPath, 'utf8')
    const out: ChatTurn[] = []
    for (const line of raw.split('\n')) {
      if (line.trim().length === 0) continue
      try {
        const parsed = JSON.parse(line) as PersistedTurn
        // Strip the ts before handing back to the chat state.
        const { ts: _ts, ...turn } = parsed
        void _ts
        out.push(turn)
      } catch {
        // Skip corrupted lines silently — better than crashing the whole resume.
      }
    }
    return out
  }
}

// Module-level singleton : the current session for this CLI process. Lazily
// instantiated on first access so tests and tools can stay quiet.
let CURRENT: Session | null = null

export function getCurrentSession(): Session {
  if (!CURRENT) CURRENT = Session.start()
  return CURRENT
}

export function setCurrentSession(s: Session): void {
  CURRENT = s
}

export function listSessions(): SessionRecord[] {
  if (!existsSync(SESSIONS_DIR)) return []
  const entries = readdirSync(SESSIONS_DIR)
  const records: SessionRecord[] = []
  for (const name of entries) {
    const dir = join(SESSIONS_DIR, name)
    const transcriptPath = join(dir, 'transcript.jsonl')
    if (!existsSync(transcriptPath)) continue
    let turns = 0
    let lastTurnAt: string | undefined
    try {
      const lines = readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean)
      turns = lines.length
      const last = lines[lines.length - 1]
      if (last) {
        const parsed = JSON.parse(last) as PersistedTurn
        lastTurnAt = parsed.ts
      }
    } catch {
      // ignore
    }
    let startedAt = name
    try {
      startedAt = statSync(dir).birthtime.toISOString()
    } catch {
      // fall back to the id
    }
    records.push({ id: name, startedAt, turns, lastTurnAt })
  }
  // Most recent first.
  records.sort((a, b) =>
    (b.lastTurnAt ?? b.startedAt).localeCompare(a.lastTurnAt ?? a.startedAt),
  )
  return records
}
