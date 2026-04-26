// React context wrapping useChat so App, ChatViewport and PromptBar share
// the same chat state without prop drilling.

import React, { createContext, useContext } from 'react'
import { useLanguage } from '../i18n/LanguageContext.tsx'
import { useChat } from './useChat.ts'

type ChatContextValue = ReturnType<typeof useChat>

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({
  children,
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const { lang } = useLanguage()
  const value = useChat(lang ?? 'en')
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider')
  return ctx
}
