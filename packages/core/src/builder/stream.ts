// streamBuilder — call the builder LLM with the full message history and
// stream back text chunks as they arrive. Reads the provider config live
// so /provider and /model switches take effect on the next call.
//
// Note : we do NOT use Vercel AI SDK native tool-use because mlx_lm.server
// (our default local backend) does not implement OpenAI tool_calls. Instead
// the CLI parses fenced action blocks the builder emits in plain text. See
// packages/cli/src/builder-actions.ts.

import { streamText } from 'ai'
import { getBuilderModel } from './provider.ts'
import { type BuilderLang, getBuilderSystemPrompt } from './system-prompt.ts'

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type StreamBuilderArgs = {
  messages: ChatMessage[]
  lang: BuilderLang
}

export async function* streamBuilder({
  messages,
  lang,
}: StreamBuilderArgs): AsyncGenerator<string, void, void> {
  const result = streamText({
    model: getBuilderModel(),
    system: getBuilderSystemPrompt(lang),
    messages,
    // 512 leaves room for a full forge:write block (~300 tokens) plus a
    // short intro sentence. Override via FORGE_MAX_TOKENS if needed.
    maxTokens: Number(process.env.FORGE_MAX_TOKENS ?? '512'),
  })

  for await (const chunk of result.textStream) {
    yield chunk
  }
}
