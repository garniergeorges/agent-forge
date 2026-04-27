// Mission Control card focus + detail view state.
//
// Kept separate from useChat so the chat hook stays focused on
// conversation/action state. Exposes :
//   - focusedId : id of the action currently highlighted (or null)
//   - detailOpen : whether the full-screen detail panel is mounted
//   - cycle / cycleBack / open / close : the actions wired to Tab keys
//
// Behaviour :
//   - Tab from "no focus" → focus the LAST action (most recent on top
//     of Mission Control reads as bottom of the list, so we land on
//     what the user just saw).
//   - Tab again → walk forward; wraps around.
//   - Shift+Tab → walk backward; wraps around.
//   - When the focused action disappears (cleared, etc.), focus resets.

import { useCallback, useEffect, useState } from 'react'
import type { Action } from '../actions/types.ts'

export type CardFocusApi = {
  focusedId: string | null
  detailOpen: boolean
  cycle: () => void
  cycleBack: () => void
  open: () => void
  close: () => void
  clearFocus: () => void
}

export function useCardFocus(actions: Action[]): CardFocusApi {
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // If the focused action disappears (e.g. /clear), drop focus and the
  // detail panel together so we never display a stale card.
  useEffect(() => {
    if (focusedId === null) return
    const stillThere = actions.some((a) => a.id === focusedId)
    if (!stillThere) {
      setFocusedId(null)
      setDetailOpen(false)
    }
  }, [actions, focusedId])

  const cycle = useCallback(() => {
    if (actions.length === 0) return
    setFocusedId((current) => {
      if (current === null) {
        return actions[actions.length - 1]?.id ?? null
      }
      const idx = actions.findIndex((a) => a.id === current)
      if (idx === -1) return actions[actions.length - 1]?.id ?? null
      const next = (idx + 1) % actions.length
      return actions[next]?.id ?? null
    })
  }, [actions])

  const cycleBack = useCallback(() => {
    if (actions.length === 0) return
    setFocusedId((current) => {
      if (current === null) {
        return actions[0]?.id ?? null
      }
      const idx = actions.findIndex((a) => a.id === current)
      if (idx === -1) return actions[0]?.id ?? null
      const prev = (idx - 1 + actions.length) % actions.length
      return actions[prev]?.id ?? null
    })
  }, [actions])

  const open = useCallback(() => {
    if (focusedId !== null) setDetailOpen(true)
  }, [focusedId])

  const close = useCallback(() => {
    setDetailOpen(false)
  }, [])

  const clearFocus = useCallback(() => {
    setFocusedId(null)
    setDetailOpen(false)
  }, [])

  return { focusedId, detailOpen, cycle, cycleBack, open, close, clearFocus }
}
