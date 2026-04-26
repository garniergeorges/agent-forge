// Agent Forge — palette
// Ported from demo-sprites/forge-mockup-v3.mjs (visual identity validated).
// Background is NEVER forced — we always respect the user's terminal background.

export type RGB = readonly [number, number, number]

export const ORANGE: RGB = [255, 140, 30]
export const ORANGE_DIM: RGB = [160, 80, 20]
export const ORANGE_BRIGHT: RGB = [255, 200, 80]
export const YELLOW: RGB = [240, 220, 80]
export const RED: RGB = [240, 80, 80]
export const GREEN: RGB = [80, 200, 120]
export const BLUE: RGB = [100, 160, 240]
export const GREY: RGB = [120, 120, 130]
export const GREY_LIGHT: RGB = [180, 180, 190]
export const WHITE: RGB = [240, 240, 245]

// Ink expects color as a string. Hex is the most portable form.
const toHex = ([r, g, b]: RGB): string =>
  `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`

export const C = {
  orange: toHex(ORANGE),
  orangeDim: toHex(ORANGE_DIM),
  orangeBright: toHex(ORANGE_BRIGHT),
  yellow: toHex(YELLOW),
  red: toHex(RED),
  green: toHex(GREEN),
  blue: toHex(BLUE),
  grey: toHex(GREY),
  greyLight: toHex(GREY_LIGHT),
  white: toHex(WHITE),
}
