// Mission Control card focus + scroll + detail view state.
//
// Focus :
//   - Tab from "no focus" → focus the LAST action (most recent).
//   - Tab again → walk forward (wraps).
//   - Shift+Tab → walk backward (wraps).
//   - Esc clears focus (keep card content visible, just unhighlight).
//   - When the focused action disappears, drop focus.
//
// Auto-focus :
//   - When a new action arrives and nothing is focused, auto-focus
//     the new one so the user immediately sees what the builder did.
//   - We track the last seen action ids in a ref to detect "new".
//
// Scroll :
//   - scrollTop is an action-INDEX offset. The Mission Control panel
//     slices `actions.slice(scrollTop, …)` to fit panelHeight.
//   - cycle / cycleBack adjust scrollTop when the focused index moves
//     out of the visible window. The visible window size depends on
//     the panel layout, which we don't know here ; we use a
//     conservative heuristic : keep the focused index >= scrollTop.
//   - scrollUp / scrollDown / scrollHome / scrollEnd let App expose
//     PgUp / PgDn / Home / End to the user when no card is focused.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Action } from '../actions/types.ts'

export type CardFocusApi = {
  focusedId: string | null
  detailOpen: boolean
  scrollTop: number
  cycle: () => void
  cycleBack: () => void
  open: () => void
  close: () => void
  clearFocus: () => void
  scrollUp: () => void
  scrollDown: () => void
  scrollHome: () => void
  scrollEnd: () => void
}

export function useCardFocus(actions: Action[]): CardFocusApi {
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)

  // Remember the previous action ids so we can detect new arrivals
  // without firing on every render (initial mount included).
  const prevIdsRef = useRef<Set<string>>(new Set())

  // Auto-focus the most recent action when one shows up and nothing
  // is focused yet. Also trims focus / scroll when actions vanish.
  useEffect(() => {
    const currentIds = new Set(actions.map((a) => a.id))
    // Find ids that weren't there last render — new arrivals.
    const newIds: string[] = []
    for (const a of actions) {
      if (!prevIdsRef.current.has(a.id)) newIds.push(a.id)
    }
    prevIdsRef.current = currentIds

    if (focusedId !== null && !currentIds.has(focusedId)) {
      setFocusedId(null)
      setDetailOpen(false)
    }

    // Auto-focus the latest new arrival, but only if nothing is
    // currently focused (don't steal focus mid-cycle).
    if (newIds.length > 0 && focusedId === null) {
      const last = newIds[newIds.length - 1]
      if (last !== undefined) setFocusedId(last)
    }

    // Keep scrollTop within bounds.
    setScrollTop((st) => Math.max(0, Math.min(st, Math.max(0, actions.length - 1))))
  }, [actions, focusedId])

  // Scroll-to-focus : whenever focusedId changes, make sure scrollTop
  // is at most the focused index (so the focused card is at or below
  // the panel's first visible slot). The panel itself caps scrollTop
  // upward when the focused card would fall below the bottom edge —
  // we don't know panelHeight here, so we keep a lower bound only.
  useEffect(() => {
    if (focusedId === null) return
    const idx = actions.findIndex((a) => a.id === focusedId)
    if (idx === -1) return
    setScrollTop((st) => (idx < st ? idx : st))
  }, [focusedId, actions])

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
      if (current === null) return actions[0]?.id ?? null
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

  const scrollUp = useCallback(() => {
    setScrollTop((st) => Math.max(0, st - 1))
  }, [])

  const scrollDown = useCallback(() => {
    setScrollTop((st) =>
      Math.min(Math.max(0, actions.length - 1), st + 1),
    )
  }, [actions.length])

  const scrollHome = useCallback(() => {
    setScrollTop(0)
  }, [])

  const scrollEnd = useCallback(() => {
    setScrollTop(Math.max(0, actions.length - 1))
  }, [actions.length])

  return {
    focusedId,
    detailOpen,
    scrollTop,
    cycle,
    cycleBack,
    open,
    close,
    clearFocus,
    scrollUp,
    scrollDown,
    scrollHome,
    scrollEnd,
  }
}
