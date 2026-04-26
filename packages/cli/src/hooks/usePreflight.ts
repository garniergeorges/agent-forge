// Splash-screen preflight checks. Each check resolves to ok / fail with a label.
// Mirrors the visual rhythm of the mockup ("· checking docker daemon...").

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { useEffect, useState } from 'react'

export type CheckStatus = 'pending' | 'running' | 'ok' | 'fail'

export type Check = {
  id: string
  label: string
  status: CheckStatus
  detail?: string
}

const RUNTIME_BUNDLE = join(
  new URL('../../../runtime/dist', import.meta.url).pathname,
  'runtime.mjs',
)
const FORGE_BASE_URL =
  process.env.FORGE_BASE_URL ?? 'http://127.0.0.1:8080/v1'

async function checkDocker(): Promise<boolean> {
  return spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0
}

async function checkLLM(): Promise<boolean> {
  try {
    const url = new URL('models', FORGE_BASE_URL.endsWith('/') ? FORGE_BASE_URL : `${FORGE_BASE_URL}/`)
    const apiKey = process.env.FORGE_API_KEY
    const headers: Record<string, string> = {}
    // Cloud endpoints (Mistral, OpenAI, Anthropic, …) require auth even
    // on /models. Local endpoints (MLX server) accept anything or no header.
    if (apiKey && apiKey !== 'not-needed') {
      headers.Authorization = `Bearer ${apiKey}`
    }
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(2500),
    })
    return res.ok
  } catch {
    return false
  }
}

async function checkRuntime(): Promise<boolean> {
  return existsSync(RUNTIME_BUNDLE)
}

const DEFINITIONS: ReadonlyArray<{ id: string; label: string; run: () => Promise<boolean> }> = [
  { id: 'docker', label: 'checking docker daemon', run: checkDocker },
  { id: 'llm', label: `verifying llm endpoint (${new URL(FORGE_BASE_URL).host})`, run: checkLLM },
  { id: 'runtime', label: 'loading agent runtime bundle', run: checkRuntime },
]

const TICK_MS = 280

export function usePreflight(): { checks: Check[]; allDone: boolean; allOk: boolean } {
  const [checks, setChecks] = useState<Check[]>(() =>
    DEFINITIONS.map((d) => ({ id: d.id, label: d.label, status: 'pending' })),
  )

  useEffect(() => {
    let cancelled = false
    const run = async (): Promise<void> => {
      for (let i = 0; i < DEFINITIONS.length; i++) {
        if (cancelled) return
        setChecks((prev) =>
          prev.map((c, idx) => (idx === i ? { ...c, status: 'running' } : c)),
        )
        const def = DEFINITIONS[i]
        if (!def) continue
        const ok = await def.run().catch(() => false)
        if (cancelled) return
        // Pace the visual rhythm so the splash does not flash.
        await new Promise((r) => setTimeout(r, TICK_MS))
        setChecks((prev) =>
          prev.map((c, idx) => (idx === i ? { ...c, status: ok ? 'ok' : 'fail' } : c)),
        )
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const allDone = checks.every((c) => c.status === 'ok' || c.status === 'fail')
  const allOk = checks.every((c) => c.status === 'ok')
  return { checks, allDone, allOk }
}
