// Tiny, line-oriented syntax helpers for Mission Control and the
// CardDetail view. Goals :
//   - keep it dependency-free (regex only) ;
//   - cover the four shapes Agent Forge actually shows : YAML, plain
//     text, Markdown, and JSON-ish ;
//   - recognise fenced blocks inside Markdown so a forge:bash inside
//     an agent run reads as bash, not as prose.
//
// Each highlighter returns a list of HighlightedLine ; a
// HighlightedLine is a list of Segment ({text, color, dim?, bold?})
// that components render with Ink.

import { C } from '../theme/colors.ts'

export type Segment = {
  text: string
  color?: string
  dim?: boolean
  bold?: boolean
}

export type HighlightedLine = Segment[]

// ── YAML ─────────────────────────────────────────────────────────

const YAML_KEY_RE = /^(\s*)([A-Za-z_][\w-]*)(\s*:)(\s*)(.*)$/
const YAML_LIST_RE = /^(\s*)(-)(\s+)(.*)$/
const YAML_SEPARATOR_RE = /^---\s*$/
const YAML_COMMENT_RE = /^(\s*)(#.*)$/

function valueSegment(value: string): Segment {
  if (/^-?\d+(\.\d+)?$/.test(value)) return { text: value, color: C.greyLight }
  if (/^["'].*["']$/.test(value)) return { text: value, color: C.greyLight }
  if (/^(true|false|null|yes|no)$/i.test(value))
    return { text: value, color: C.orangeBright }
  return { text: value, color: C.white }
}

export function highlightYamlLine(line: string): HighlightedLine {
  if (line.length === 0) return [{ text: ' ' }]
  if (YAML_SEPARATOR_RE.test(line)) {
    return [{ text: line, color: C.grey, dim: true }]
  }
  const comment = line.match(YAML_COMMENT_RE)
  if (comment) {
    return [
      { text: comment[1] ?? '' },
      { text: comment[2] ?? '', color: C.grey, dim: true },
    ]
  }
  const list = line.match(YAML_LIST_RE)
  if (list) {
    return [
      { text: list[1] ?? '' },
      { text: list[2] ?? '', color: C.orange, bold: true },
      { text: list[3] ?? '' },
      { text: list[4] ?? '', color: C.white },
    ]
  }
  const kv = line.match(YAML_KEY_RE)
  if (kv) {
    const [, indent, key, colon, space, value] = kv
    const segs: HighlightedLine = [
      { text: indent ?? '' },
      { text: key ?? '', color: C.orange, bold: true },
      { text: colon ?? '', color: C.grey },
      { text: space ?? '' },
    ]
    if (value && value.length > 0) segs.push(valueSegment(value))
    return segs
  }
  if (/^#\s/.test(line)) {
    return [{ text: line, color: C.orangeBright, bold: true }]
  }
  return [{ text: line, color: C.greyLight }]
}

export function highlightYamlText(text: string): HighlightedLine[] {
  return text.split('\n').map(highlightYamlLine)
}

// ── Plain ────────────────────────────────────────────────────────

export function highlightPlain(text: string): HighlightedLine[] {
  return text
    .split('\n')
    .map((l) => [{ text: l.length > 0 ? l : ' ', color: C.greyLight }])
}

// ── JSON ─────────────────────────────────────────────────────────
//
// Tokeniser-light : single line at a time. We don't try to follow
// multi-line strings — agents rarely emit them. The aim is colour,
// not validation.

const JSON_TOKEN_RE = /"(?:[^"\\]|\\.)*"|true|false|null|-?\d+(?:\.\d+)?/g

function highlightJsonLine(line: string): HighlightedLine {
  if (line.length === 0) return [{ text: ' ' }]
  const segs: HighlightedLine = []
  let last = 0
  for (const m of line.matchAll(JSON_TOKEN_RE)) {
    const idx = m.index ?? 0
    if (idx > last) segs.push({ text: line.slice(last, idx), color: C.grey })
    const tok = m[0]
    if (tok.startsWith('"')) {
      // Heuristic : a quoted string immediately followed by ':' is a key,
      // colour as orange ; otherwise a value (greyLight).
      const after = line.slice(idx + tok.length).trimStart()
      if (after.startsWith(':')) {
        segs.push({ text: tok, color: C.orange, bold: true })
      } else {
        segs.push({ text: tok, color: C.greyLight })
      }
    } else if (tok === 'true' || tok === 'false' || tok === 'null') {
      segs.push({ text: tok, color: C.orangeBright })
    } else {
      segs.push({ text: tok, color: C.white })
    }
    last = idx + tok.length
  }
  if (last < line.length) segs.push({ text: line.slice(last), color: C.grey })
  return segs
}

// ── Markdown (with fenced blocks) ────────────────────────────────
//
// Recognises :
//   - ATX headings (#, ##, ...)
//   - Unordered list bullets (-, *, +)
//   - Ordered list bullets (1. 2. ...)
//   - Inline code spans (`...`)
//   - Bold (**...**) and emphasis (*...*) — colour only, no font
//   - Fenced code blocks ```lang ... ``` : the content is forwarded
//     to the matching highlighter (yaml/json/plain), and the fences
//     themselves render dim grey
//
// Special-case our own fence prefix `forge:*` : the body is JSON-ish,
// route it to the JSON highlighter.

const HEADING_RE = /^(#{1,6})\s+(.*)$/
const ULIST_RE = /^(\s*)([-*+])(\s+)(.*)$/
const OLIST_RE = /^(\s*)(\d+\.)(\s+)(.*)$/
const FENCE_OPEN_RE = /^```(\S*)\s*$/
const FENCE_CLOSE_RE = /^```\s*$/
const INLINE_CODE_RE = /`[^`]+`/g
const BOLD_RE = /\*\*[^*]+\*\*/g

function languageHighlighter(lang: string): (line: string) => HighlightedLine {
  const l = lang.toLowerCase()
  if (l === 'yaml' || l === 'yml') return highlightYamlLine
  if (l === 'json' || l.startsWith('forge:')) return highlightJsonLine
  if (l === 'bash' || l === 'sh' || l === 'shell') {
    return (line) => [{ text: line.length > 0 ? line : ' ', color: C.greyLight }]
  }
  // Default for unknown / TypeScript / etc. : neutral grey-light.
  return (line) => [{ text: line.length > 0 ? line : ' ', color: C.greyLight }]
}

// Apply inline code spans and bold to a Markdown prose line. Returns
// a list of segments. Order doesn't matter because the matched
// regions don't overlap in practice (we don't try to nest them).
function highlightInlineMarkdown(line: string): HighlightedLine {
  type Mark = { start: number; end: number; seg: Segment }
  const marks: Mark[] = []
  for (const m of line.matchAll(INLINE_CODE_RE)) {
    if (m.index === undefined) continue
    marks.push({
      start: m.index,
      end: m.index + m[0].length,
      seg: { text: m[0], color: C.orangeBright },
    })
  }
  for (const m of line.matchAll(BOLD_RE)) {
    if (m.index === undefined) continue
    // Skip if overlaps an existing inline-code mark.
    const overlap = marks.some(
      (e) =>
        !(e.end <= (m.index ?? 0) || e.start >= (m.index ?? 0) + m[0].length),
    )
    if (overlap) continue
    marks.push({
      start: m.index,
      end: m.index + m[0].length,
      seg: { text: m[0], color: C.white, bold: true },
    })
  }
  if (marks.length === 0) return [{ text: line, color: C.greyLight }]
  marks.sort((a, b) => a.start - b.start)
  const segs: HighlightedLine = []
  let cur = 0
  for (const mark of marks) {
    if (mark.start > cur) {
      segs.push({ text: line.slice(cur, mark.start), color: C.greyLight })
    }
    segs.push(mark.seg)
    cur = mark.end
  }
  if (cur < line.length) segs.push({ text: line.slice(cur), color: C.greyLight })
  return segs
}

export function highlightMarkdown(text: string): HighlightedLine[] {
  const out: HighlightedLine[] = []
  const lines = text.split('\n')
  let inFence = false
  let fenceLang = ''
  let fenceLine: ((line: string) => HighlightedLine) | null = null
  for (const raw of lines) {
    if (inFence) {
      if (FENCE_CLOSE_RE.test(raw)) {
        out.push([{ text: raw, color: C.grey, dim: true }])
        inFence = false
        fenceLang = ''
        fenceLine = null
        continue
      }
      out.push((fenceLine ?? highlightYamlLine)(raw))
      continue
    }
    const fenceOpen = raw.match(FENCE_OPEN_RE)
    if (fenceOpen) {
      inFence = true
      fenceLang = fenceOpen[1] ?? ''
      fenceLine = languageHighlighter(fenceLang)
      out.push([{ text: raw, color: C.grey, dim: true }])
      continue
    }
    if (raw.length === 0) {
      out.push([{ text: ' ' }])
      continue
    }
    const heading = raw.match(HEADING_RE)
    if (heading) {
      out.push([
        { text: heading[1] ?? '', color: C.orange, bold: true },
        { text: ' ' },
        { text: heading[2] ?? '', color: C.orangeBright, bold: true },
      ])
      continue
    }
    const ulist = raw.match(ULIST_RE)
    if (ulist) {
      out.push([
        { text: ulist[1] ?? '' },
        { text: ulist[2] ?? '', color: C.orange, bold: true },
        { text: ulist[3] ?? '' },
        ...highlightInlineMarkdown(ulist[4] ?? ''),
      ])
      continue
    }
    const olist = raw.match(OLIST_RE)
    if (olist) {
      out.push([
        { text: olist[1] ?? '' },
        { text: olist[2] ?? '', color: C.orange, bold: true },
        { text: olist[3] ?? '' },
        ...highlightInlineMarkdown(olist[4] ?? ''),
      ])
      continue
    }
    out.push(highlightInlineMarkdown(raw))
  }
  return out
}

// ── Mixed run output ─────────────────────────────────────────────
//
// What an agent produces during a multi-turn run is a mix of :
//   - prose
//   - fenced ```forge:bash / forge:write / forge:read / ... blocks
//   - injected [forge:tool] / [/forge:tool] markers framing the
//     result of the previous tool call (raw stdout, often shell-y)
//
// We treat the markers like another fence type : everything between
// [forge:tool] and [/forge:tool] is rendered with a dim, distinct
// colour so the user can tell tool output from the agent's narration.

const TOOL_OPEN_RE = /^\[forge:tool\]\s*$/
const TOOL_CLOSE_RE = /^\[\/forge:tool\]\s*$/

export function highlightAgentRun(text: string): HighlightedLine[] {
  const out: HighlightedLine[] = []
  const lines = text.split('\n')
  let inFence = false
  let fenceLine: ((line: string) => HighlightedLine) | null = null
  let inTool = false

  for (const raw of lines) {
    if (inFence) {
      if (FENCE_CLOSE_RE.test(raw)) {
        out.push([{ text: raw, color: C.grey, dim: true }])
        inFence = false
        fenceLine = null
        continue
      }
      out.push((fenceLine ?? highlightYamlLine)(raw))
      continue
    }
    if (inTool) {
      if (TOOL_CLOSE_RE.test(raw)) {
        out.push([{ text: raw, color: C.grey, dim: true }])
        inTool = false
        continue
      }
      // Tool output is opaque shell-ish content. Render as plain
      // greyLight so it stays readable but visually quieter than
      // the agent's prose / blocks.
      out.push([{ text: raw.length > 0 ? raw : ' ', color: C.grey }])
      continue
    }
    if (TOOL_OPEN_RE.test(raw)) {
      out.push([{ text: raw, color: C.grey, dim: true }])
      inTool = true
      continue
    }
    const fenceOpen = raw.match(FENCE_OPEN_RE)
    if (fenceOpen) {
      inFence = true
      fenceLine = languageHighlighter(fenceOpen[1] ?? '')
      out.push([{ text: raw, color: C.orange, bold: true }])
      continue
    }
    if (raw.length === 0) {
      out.push([{ text: ' ' }])
      continue
    }
    out.push(highlightInlineMarkdown(raw))
  }
  return out
}
