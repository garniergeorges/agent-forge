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
