// @agent-forge/tools-core — entry point
//
// Native tools exposed to the builder (host) and, later, to runtime agents
// (container). Each tool is a Vercel AI SDK-compatible spec : Zod schema +
// async execute().

export {
  FORGE_HOME,
  FileWriteInputSchema,
  FileWriteToolSpec,
  executeFileWrite,
  resolveSafePath,
  type FileWriteInput,
  type FileWriteResult,
} from './file-write.ts'

export {
  DockerLaunchInputSchema,
  hardeningFlags,
  launchAgent,
  resolveSandboxFromAgentMd,
  type DockerLaunchEvent,
  type DockerLaunchInput,
  type LaunchHandle,
} from './docker-launch.ts'

export {
  startLlmProxy,
  type LlmProxyHandle,
  type LlmProxyOptions,
} from './llm-proxy.ts'

export {
  detectSandboxNetworkProfile,
  type SandboxNetworkProfile,
} from './sandbox-network.ts'

// Runtime-side tools — used INSIDE the agent's container, sandboxed to
// /workspace. Distinct from the host-side FileWrite above.
export {
  BashInputSchema,
  WORKSPACE_DIR,
  executeBash,
  type BashInput,
  type BashResult,
} from './runtime/bash.ts'

export {
  RuntimeFileWriteInputSchema,
  executeRuntimeFileWrite,
  resolveSandboxedPath,
  type RuntimeFileWriteInput,
  type RuntimeFileWriteResult,
} from './runtime/file-write.ts'

export {
  RuntimeFileReadInputSchema,
  executeRuntimeFileRead,
  type RuntimeFileReadInput,
  type RuntimeFileReadResult,
} from './runtime/file-read.ts'

export {
  RuntimeFileEditInputSchema,
  executeRuntimeFileEdit,
  type RuntimeFileEditInput,
  type RuntimeFileEditResult,
} from './runtime/file-edit.ts'

export {
  RuntimeGlobInputSchema,
  executeRuntimeGlob,
  type RuntimeGlobInput,
  type RuntimeGlobResult,
} from './runtime/glob.ts'

export {
  RuntimeGrepInputSchema,
  executeRuntimeGrep,
  type GrepHit,
  type RuntimeGrepInput,
  type RuntimeGrepResult,
} from './runtime/grep.ts'
