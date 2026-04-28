// Verify that the AGENT.md sandbox section is correctly translated
// into docker run flags. Pure unit test : no container is spawned.
//
// We deliberately avoid running real escape attempts (write outside
// /workspace, fork bomb, apt install) here — those are integration
// tests that require Docker on the CI host and a built image. They
// belong in a separate suite gated on the docker daemon.

import { describe, expect, test } from 'bun:test'
import { applySandboxDefaults } from '../../core/src/types/agent-md.ts'
import { hardeningFlags } from '../src/docker-launch.ts'

describe('hardeningFlags — strict defaults', () => {
  const cfg = applySandboxDefaults({ image: 'agent-forge/base:latest' })
  const flags = hardeningFlags(cfg)

  test('drops every Linux capability', () => {
    expect(flags).toContain('--cap-drop=ALL')
  })

  test('forbids privilege escalation', () => {
    expect(flags).toContain('--security-opt=no-new-privileges')
  })

  test('disables network', () => {
    expect(flags).toContain('--network=none')
  })

  test('runs as the non-root agent user', () => {
    expect(flags).toContain('--user=agent')
  })

  test('caps memory at 512m', () => {
    expect(flags).toContain('--memory=512m')
  })

  test('caps cpu at 1', () => {
    expect(flags).toContain('--cpus=1')
  })

  test('caps pids at 128', () => {
    expect(flags).toContain('--pids-limit=128')
  })

  test('mounts root FS read-only with a tmpfs over /tmp', () => {
    expect(flags).toContain('--read-only')
    const tmpfs = flags.find((f) => f.startsWith('--tmpfs=/tmp'))
    expect(tmpfs).toBeDefined()
  })
})

describe('hardeningFlags — relaxations from AGENT.md', () => {
  test('network=bridge is reflected in the flag', () => {
    const cfg = applySandboxDefaults({
      image: 'agent-forge/base:latest',
      network: 'bridge',
    })
    expect(hardeningFlags(cfg)).toContain('--network=bridge')
    expect(hardeningFlags(cfg)).not.toContain('--network=none')
  })

  test('readOnlyRoot=false drops --read-only entirely', () => {
    const cfg = applySandboxDefaults({
      image: 'agent-forge/base:latest',
      readOnlyRoot: false,
    })
    const flags = hardeningFlags(cfg)
    expect(flags).not.toContain('--read-only')
    expect(flags.some((f) => f.startsWith('--tmpfs=/tmp'))).toBe(false)
  })

  test('custom resources override the defaults', () => {
    const cfg = applySandboxDefaults({
      image: 'agent-forge/base:latest',
      resources: { memory: '2g', cpus: 4, pidsLimit: 512 },
    })
    const flags = hardeningFlags(cfg)
    expect(flags).toContain('--memory=2g')
    expect(flags).toContain('--cpus=4')
    expect(flags).toContain('--pids-limit=512')
  })

  test('custom user is forwarded', () => {
    const cfg = applySandboxDefaults({
      image: 'agent-forge/base:latest',
      user: 'root',
    })
    expect(hardeningFlags(cfg)).toContain('--user=root')
  })
})

describe('hardeningFlags — bridge fallback profile', () => {
  test('upgrades network=none to bridge when profile=bridge', () => {
    // AGENT.md asks for none (the strict default), but the host
    // can't expose a UDS bind-mount → fallback bridge is applied.
    const cfg = applySandboxDefaults({ image: 'agent-forge/base:latest' })
    const flags = hardeningFlags(cfg, 'bridge')
    expect(flags).toContain('--network=bridge')
    expect(flags).not.toContain('--network=none')
  })

  test('keeps explicit bridge under bridge profile', () => {
    const cfg = applySandboxDefaults({
      image: 'agent-forge/base:latest',
      network: 'bridge',
    })
    const flags = hardeningFlags(cfg, 'bridge')
    expect(flags).toContain('--network=bridge')
  })

  test('keeps explicit bridge under proxy profile too', () => {
    // The author has explicitly opted into bridge ; we don't
    // downgrade to none just because the proxy is available.
    const cfg = applySandboxDefaults({
      image: 'agent-forge/base:latest',
      network: 'bridge',
    })
    const flags = hardeningFlags(cfg, 'proxy')
    expect(flags).toContain('--network=bridge')
  })
})

describe('hardeningFlags — invariants', () => {
  test('cap-drop and no-new-privileges are ALWAYS present', () => {
    // Even with the most permissive AGENT.md, these two stay on : we
    // never want an agent to gain caps or escalate privileges.
    const cfg = applySandboxDefaults({
      image: 'agent-forge/base:latest',
      network: 'bridge',
      readOnlyRoot: false,
      user: 'root',
      resources: { memory: '8g', cpus: 4, pidsLimit: 1024 },
    })
    const flags = hardeningFlags(cfg)
    expect(flags).toContain('--cap-drop=ALL')
    expect(flags).toContain('--security-opt=no-new-privileges')
  })
})
