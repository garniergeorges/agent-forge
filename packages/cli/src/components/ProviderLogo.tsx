// Tiny pixel-art logo for the active LLM provider.
//
// Uses half-blocks (▀) to pack two pixel-rows per terminal line: the
// glyph's top half takes the foreground color, the bottom half takes the
// background color. A 5-row sprite renders in 3 terminal lines (last
// half-row is just empty bottom). One terminal cell per logical pixel
// (single ▀) — the sprite reads narrower so it doesn't look stretched.

import { Box, Text } from 'ink'
import React from 'react'
import { getCurrentBaseURL } from '@agent-forge/core/builder'
import { C } from '../theme/colors.ts'

type Pixel = string | null
type Sprite = Pixel[][]

const Y1 = '#ffd800'
const Y2 = '#ffaf00'
const O1 = '#ff8205'
const R1 = '#fa500f'
const R2 = '#e10500'

// 7 columns × 5 rows. Direct transcription of the official Mistral logo
// SVG (Wikimedia 2025).
//
// col:    0   1   2   3   4   5   6
// row 0:  .   Y   .   .   .   Y   .
// row 1:  .   Y2  Y2  .   Y2  Y2  .
// row 2:  .   O   O   O   O   O   .
// row 3:  .   R1  .   R1  .   R1  .
// row 4:  R2  R2  R2  .   R2  R2  R2
const MISTRAL: Sprite = [
  [null, Y1, null, null, null, Y1, null],
  [null, Y2, Y2, null, Y2, Y2, null],
  [null, O1, O1, O1, O1, O1, null],
  [null, R1, null, R1, null, R1, null],
  [R2, R2, R2, null, R2, R2, R2],
]

function HalfRow({ top, bot }: { top: Pixel[]; bot: Pixel[] }): React.JSX.Element {
  // Each cell here represents TWO stacked logical pixels. Three cases:
  //   - both transparent → render two spaces (terminal background shows)
  //   - only top filled  → ▀▀ in top color (bottom half = transparent)
  //   - only bot filled  → ▄▄ in bot color (top half = transparent)
  //   - both filled      → ▀▀ with foreground=top and backgroundColor=bot
  return (
    <Box>
      {top.map((tColor, i) => {
        const bColor = bot[i] ?? null
        if (tColor && bColor) {
          return (
            <Text key={`p-${i.toString()}`} color={tColor} backgroundColor={bColor}>
              ▀
            </Text>
          )
        }
        if (tColor) {
          return (
            <Text key={`p-${i.toString()}`} color={tColor}>
              ▀
            </Text>
          )
        }
        if (bColor) {
          return (
            <Text key={`p-${i.toString()}`} color={bColor}>
              ▄
            </Text>
          )
        }
        return <Text key={`p-${i.toString()}`}> </Text>
      })}
    </Box>
  )
}

function detectProvider(): 'mistral' | 'openai' | 'anthropic' | 'mlx' | 'unknown' {
  const url = getCurrentBaseURL().toLowerCase()
  if (url.includes('mistral.ai')) return 'mistral'
  if (url.includes('openai.com')) return 'openai'
  if (url.includes('anthropic.com')) return 'anthropic'
  if (url.includes('127.0.0.1') || url.includes('localhost')) return 'mlx'
  return 'unknown'
}

export function ProviderLogo(): React.JSX.Element {
  const provider = detectProvider()
  if (provider === 'mistral') {
    // Pair rows: (0,1), (2,3), (4,empty). 5 pixel-rows → 3 terminal lines.
    const empty: Pixel[] = MISTRAL[0]?.map(() => null) ?? []
    const pairs: Array<[Pixel[], Pixel[]]> = [
      [MISTRAL[0] ?? empty, MISTRAL[1] ?? empty],
      [MISTRAL[2] ?? empty, MISTRAL[3] ?? empty],
      [MISTRAL[4] ?? empty, empty],
    ]
    return (
      <Box flexDirection="column">
        {pairs.map(([top, bot], i) => (
          <HalfRow key={`r-${i.toString()}`} top={top} bot={bot} />
        ))}
      </Box>
    )
  }
  return (
    <Box>
      <Text color={C.grey} dimColor>
        {provider}
      </Text>
    </Box>
  )
}
