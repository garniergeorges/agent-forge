// Smoke test for the Ink app : render <App />, assert the splash logo
// is visible. We do NOT exercise the streaming chat (would require mocking
// the LLM SDK and an interactive TextInput) — just the boot rendering.

import { describe, expect, test } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'
import { App } from '../src/components/App.tsx'
import { ChatProvider } from '../src/hooks/useChatContext.tsx'
import { LanguageProvider } from '../src/i18n/LanguageContext.tsx'

describe('<App />', () => {
  test('boots without crashing and shows the AGENT FORGE logo', () => {
    const { lastFrame, unmount } = render(
      <LanguageProvider>
        <ChatProvider>
          <App />
        </ChatProvider>
      </LanguageProvider>,
    )
    const frame = lastFrame() ?? ''
    // The splash ASCII logo is built from box-drawing characters, but the
    // word "AGENT FORGE" is also referenced in the header bar of the
    // welcome block, which is enough to assert the app rendered.
    expect(frame.length).toBeGreaterThan(0)
    expect(frame).toMatch(/Forge|AGENT|forge/i)
    unmount()
  })
})
