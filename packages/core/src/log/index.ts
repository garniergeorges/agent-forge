// Structured file logger.
//
// Why a custom mini-logger and not pino/winston :
//   - We MUST never write to stdout : the Ink TUI owns it. A stray
//     console.log corrupts the rendering.
//   - We need it to work the same way in three places : the CLI host
//     process, the runtime inside the container, and the tools-core
//     helpers — which means no React-y dependency.
//   - JSON lines so the log is grep-able and machine-readable later.
//
// Activation :
//   - FORGE_DEBUG=1                 → logs at level >= debug
//   - FORGE_DEBUG=info|debug|trace  → explicit threshold
//   - FORGE_LOG_FILE=/path/to/log   → override the default file
//   - default file : ~/.agent-forge/logs/forge-<pid>-<iso>.log
//
// When neither FORGE_DEBUG nor FORGE_LOG_FILE is set, the logger is a
// no-op : zero file IO, zero overhead.

import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
}

type LoggerState = {
  enabled: boolean
  threshold: number
  filePath: string | null
  // Resolved at first use, then memoised. Null while disabled.
}

let state: LoggerState | null = null

function resolveState(): LoggerState {
  if (state !== null) return state

  const envDebug = process.env.FORGE_DEBUG ?? ''
  const envFile = process.env.FORGE_LOG_FILE ?? ''
  const enabled = envDebug.length > 0 || envFile.length > 0

  if (!enabled) {
    state = { enabled: false, threshold: Number.MAX_SAFE_INTEGER, filePath: null }
    return state
  }

  let threshold = LEVEL_ORDER.debug
  const lower = envDebug.toLowerCase()
  if (lower in LEVEL_ORDER) {
    threshold = LEVEL_ORDER[lower as LogLevel]
  } else if (envDebug === '0' || envDebug === 'false') {
    // Explicit off : someone set FORGE_DEBUG=0 to override an upstream
    // setting. Honour it unless FORGE_LOG_FILE is also set.
    if (envFile.length === 0) {
      state = {
        enabled: false,
        threshold: Number.MAX_SAFE_INTEGER,
        filePath: null,
      }
      return state
    }
  }

  let filePath: string
  if (envFile.length > 0) {
    filePath = envFile
  } else {
    const dir = join(homedir(), '.agent-forge', 'logs')
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    filePath = join(dir, `forge-${process.pid.toString()}-${ts}.log`)
  }

  try {
    mkdirSync(dirname(filePath), { recursive: true })
  } catch {
    // Directory creation failed ; disable logging silently rather
    // than crash the host process.
    state = { enabled: false, threshold: Number.MAX_SAFE_INTEGER, filePath: null }
    return state
  }

  state = { enabled: true, threshold, filePath }
  return state
}

function write(level: LogLevel, source: string, msg: string, data?: unknown): void {
  const s = resolveState()
  if (!s.enabled || s.filePath === null) return
  if (LEVEL_ORDER[level] < s.threshold) return

  const entry = {
    t: new Date().toISOString(),
    level,
    source,
    msg,
    ...(data !== undefined ? { data: safeStringify(data) } : {}),
    pid: process.pid,
  }
  try {
    appendFileSync(s.filePath, `${JSON.stringify(entry)}\n`, 'utf8')
  } catch {
    // Never throw out of the logger — we'd rather lose a line than
    // crash the host.
  }
}

// Stringify with a circular guard so passing complex objects (like
// docker spawn args, LLM responses) doesn't blow up.
function safeStringify(value: unknown): unknown {
  try {
    JSON.stringify(value)
    return value
  } catch {
    const seen = new WeakSet<object>()
    return JSON.parse(
      JSON.stringify(value, (_k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[circular]'
          seen.add(v)
        }
        return v
      }),
    )
  }
}

/**
 * Get a logger bound to a source label. Use one per module so log
 * lines self-identify (`useChat`, `dockerLaunch`, `skillRunner`,
 * `runtime`, …).
 */
export function getLogger(source: string): {
  trace: (msg: string, data?: unknown) => void
  debug: (msg: string, data?: unknown) => void
  info: (msg: string, data?: unknown) => void
  warn: (msg: string, data?: unknown) => void
  error: (msg: string, data?: unknown) => void
} {
  return {
    trace: (msg, data) => write('trace', source, msg, data),
    debug: (msg, data) => write('debug', source, msg, data),
    info: (msg, data) => write('info', source, msg, data),
    warn: (msg, data) => write('warn', source, msg, data),
    error: (msg, data) => write('error', source, msg, data),
  }
}

/**
 * Path of the currently active log file, or null if logging is off.
 * Used by the `/log` slash command to tell the user where to look.
 */
export function currentLogPath(): string | null {
  const s = resolveState()
  return s.enabled ? s.filePath : null
}

/**
 * True when at least one logging trigger is active. Cheap to call.
 */
export function isLoggingEnabled(): boolean {
  return resolveState().enabled
}

/**
 * Test-only : reset the memoised state. Don't call from production.
 */
export function _resetLoggerStateForTests(): void {
  state = null
}
