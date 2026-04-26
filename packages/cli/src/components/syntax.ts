// Tiny, line-oriented syntax helpers for the MissionControl preview.
// Returns segments {text, color, dim?} that components can render with Ink.
// We deliberately avoid a real parser : agents emit small YAML / plain text
// blocks, a handful of regexes is enough.

import { C } from '../theme/colors.ts'

export type Segment = { text: string; color?: string; dim?: boolean; bold?: boolean }

export type HighlightedLine = Segment[]

const YAML_KEY_RE = /^(\s*)([A-Za-z_][\w-]*)(\s*:)(\s*)(.*)$/
const YAML_LIST_RE = /^(\s*)(-)(\s+)(.*)$/
const YAML_SEPARATOR_RE = /^---\s*$/
const YAML_COMMENT_RE = /^(\s*)(#.*)$/

function valueSegment(value: string): Segment {
  // Numbers
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return { text: value, color: C.greyLight }
  }
  // Quoted string
  if (/^["'].*["']$/.test(value)) {
    return { text: value, color: C.greyLight }
  }
  // Booleans / null
  if (/^(true|false|null|yes|no)$/i.test(value)) {
    return { text: value, color: C.orangeBright }
  }
  // Bare value
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
    if (value && value.length > 0) {
      segs.push(valueSegment(value))
    }
    return segs
  }
  // Markdown header inside body
  if (/^#\s/.test(line)) {
    return [{ text: line, color: C.orangeBright, bold: true }]
  }
  return [{ text: line, color: C.greyLight }]
}

export function highlightYamlText(text: string): HighlightedLine[] {
  return text.split('\n').map(highlightYamlLine)
}

export function highlightPlain(text: string): HighlightedLine[] {
  return text
    .split('\n')
    .map((l) => [{ text: l.length > 0 ? l : ' ', color: C.greyLight }])
}
