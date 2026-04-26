// @agent-forge/cli — entry point
//
// Conversational REPL for Agent Forge. The user dialogues with the builder
// LLM, which will eventually design and orchestrate other agents.

import { render } from 'ink'
import React from 'react'
import { App } from './components/App.tsx'
import { LanguageProvider } from './i18n/LanguageContext.tsx'

render(
  <LanguageProvider>
    <App />
  </LanguageProvider>,
)
