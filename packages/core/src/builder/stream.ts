// streamBuilder — call the builder LLM with the full message history and
// stream back text chunks as they arrive. Reads the provider config live
// so /provider and /model switches take effect on the next call.
//
// Note : we do NOT use Vercel AI SDK native tool-use because mlx_lm.server
// (our default local backend) does not implement OpenAI tool_calls. Instead
// the CLI parses fenced action blocks the builder emits in plain text. See
// packages/cli/src/builder-actions.ts.

import { streamText, type CoreMessage } from 'ai'
import { getLogger } from '../log/index.ts'
import { getBuilderModel } from './provider.ts'
import {
  type BuilderLang,
  type SkillCatalogEntry,
  getBuilderSystemPrompt,
} from './system-prompt.ts'

const log = getLogger('streamBuilder')

export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type StreamBuilderArgs = {
  messages: ChatMessage[]
  lang: BuilderLang
  // Catalog metadata advertised to the LLM in the system prompt.
  // Bodies are NOT included here — they land in the conversation only
  // after the LLM emits a forge:skill block.
  skills?: SkillCatalogEntry[]
}

export async function* streamBuilder({
  messages,
  lang,
  skills,
}: StreamBuilderArgs): AsyncGenerator<string, void, void> {
  const system = getBuilderSystemPrompt(lang, { skills })
  log.info('streamBuilder start', {
    lang,
    skillCount: skills?.length ?? 0,
    messageCount: messages.length,
    lastMessage: messages[messages.length - 1],
  })
  log.trace('streamBuilder system prompt', { system })

  const result = streamText({
    model: getBuilderModel(),
    system,
    messages: messages as CoreMessage[],
    // 512 leaves room for a full forge:write block (~300 tokens) plus a
    // short intro sentence. Override via FORGE_MAX_TOKENS if needed.
    maxTokens: Number(process.env.FORGE_MAX_TOKENS ?? '512'),
  })

  let acc = ''
  for await (const chunk of result.textStream) {
    acc += chunk
    yield chunk
  }
  log.info('streamBuilder done', { length: acc.length })
  log.debug('streamBuilder full reply', { reply: acc })
}
