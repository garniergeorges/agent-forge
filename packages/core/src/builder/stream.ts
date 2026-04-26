// streamBuilder — call the builder LLM with the full message history and
// stream back text chunks as they arrive. Reads the provider config live
// so /provider and /model switches take effect on the next call.

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
  })

  for await (const chunk of result.textStream) {
    yield chunk
  }
}
