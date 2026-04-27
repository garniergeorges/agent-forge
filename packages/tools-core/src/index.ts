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
  launchAgent,
  type DockerLaunchEvent,
  type DockerLaunchInput,
  type LaunchHandle,
} from './docker-launch.ts'

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
  type RuntimeFileWriteInput,
  type RuntimeFileWriteResult,
} from './runtime/file-write.ts'
