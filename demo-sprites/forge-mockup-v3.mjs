// Agent Forge — Mockup v3
// Ne force PAS de fond, on respecte le fond natif du terminal de l'utilisateur.
// Seules les couleurs de TEXTE sont definies. Pour les sprites, le "fond" du
// pixel vide utilise une couleur tres proche de zero (tres sombre) ou
// idealement on utilise des half-blocks transparents.

import { ROBOTS, SPRITE_W, SPRITE_H } from './sprites-clean.mjs'
import readline from 'readline'

// ═══ Palette TEXTE uniquement ══════════════════════════════════════
const ORANGE        = [255, 140, 30]
const ORANGE_DIM    = [160, 80, 20]
const ORANGE_BRIGHT = [255, 200, 80]
const YELLOW        = [240, 220, 80]
const RED           = [240, 80, 80]
const GREEN         = [80, 200, 120]
const BLUE          = [100, 160, 240]
const GREY          = [120, 120, 130]
const GREY_LIGHT    = [180, 180, 190]
const WHITE         = [240, 240, 245]

const RESET = '\x1b[0m'
const fg = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`
const bgc = (r, g, b) => `\x1b[48;2;${r};${g};${b}m`
const dim = '\x1b[2m'
const bold = '\x1b[1m'

// PAS de constante BG ! On ne force JAMAIS de fond.
const FG_O = fg(ORANGE[0], ORANGE[1], ORANGE[2])
const FG_OB = fg(ORANGE_BRIGHT[0], ORANGE_BRIGHT[1], ORANGE_BRIGHT[2])
const FG_OD = fg(ORANGE_DIM[0], ORANGE_DIM[1], ORANGE_DIM[2])
const FG_G = fg(GREY[0], GREY[1], GREY[2])
const FG_GL = fg(GREY_LIGHT[0], GREY_LIGHT[1], GREY_LIGHT[2])
const FG_W = fg(WHITE[0], WHITE[1], WHITE[2])
const FG_GR = fg(GREEN[0], GREEN[1], GREEN[2])
const FG_R = fg(RED[0], RED[1], RED[2])
const FG_B = fg(BLUE[0], BLUE[1], BLUE[2])
const FG_Y = fg(YELLOW[0], YELLOW[1], YELLOW[2])

// ═══ Helpers terminal ═══════════════════════════════════════════════
const out = s => process.stdout.write(s)
const cls = () => out('\x1b[2J\x1b[H')
const home = () => out('\x1b[H')
const hide = () => out('\x1b[?25l')
const show = () => out('\x1b[?25h')
const moveTo = (r, c) => out(`\x1b[${r};${c}H`)
const eraseLine = () => out('\x1b[2K') // efface la ligne courante
const sleep = ms => new Promise(r => setTimeout(r, ms))

const W = () => process.stdout.columns ?? 120
const H = () => process.stdout.rows ?? 40

const visibleLen = s => s.replace(/\x1b\[[0-9;]*m/g, '').length

// Ecrit a une position absolue, en effaçant d'abord la ligne pour
// preserver le fond natif du terminal.
function writeLine(row, col, text) {
  moveTo(row, col)
  out(text + RESET)
}

function writeFullLine(row, text, align = 'left') {
  const w = W()
  const len = visibleLen(text)
  let prefix = ''
  if (align === 'center') prefix = ' '.repeat(Math.max(0, Math.floor((w - len) / 2)))
  if (align === 'right')  prefix = ' '.repeat(Math.max(0, w - len))
  moveTo(row, 1)
  eraseLine()  // utilise le fond natif du terminal
  out(prefix + text + RESET)
}

function writeSeparator(row) {
  writeFullLine(row, FG_G + dim + '─'.repeat(W()) + RESET)
}

// Au debut de chaque ecran : on efface tout, on laisse le fond natif
function clearAll() {
  cls()
}

// ═══ Sprite rendering ═══════════════════════════════════════════════
function colorForState(state) {
  switch (state) {
    case 'idle':     return ORANGE_DIM
    case 'thinking': return YELLOW
    case 'working':  return ORANGE
    case 'tool_use': return ORANGE_BRIGHT
    case 'error':    return RED
    case 'done':     return GREEN
    default:         return ORANGE
  }
}

// Rend un sprite. Les pixels "vides" sont des espaces SANS background
// → ils prennent le fond natif du terminal. Les pixels "encres" sont
// des half-blocks colores avec un background egal au pixel du dessous.
//
// scaleX  : nombre de caracteres par pixel logique en largeur (1, 2, 3...)
// scaleY  : nombre de "lignes-pixel" par pixel logique en hauteur
//           - scaleY = 1 (defaut) : chaque pixel = 1/2 ligne terminal (half-blocks)
//           - scaleY = 2          : chaque pixel = 1 ligne terminal entiere
//           - scaleY = 3          : chaque pixel = 1.5 ligne terminal (etc.)
// Pour preserver des proportions carrees a l'ecran (cellules ~2:1) :
//   scaleX = 1, scaleY = 1  → sprite 1× (compact)
//   scaleX = 2, scaleY = 2  → sprite 2× (gros, mais carre)
function renderSpriteLines(bits, color, scaleX = 1, scaleY = 1) {
  // Si scaleY > 1, on duplique chaque pixel logique scaleY fois en hauteur
  // AVANT de rendre via half-blocks.
  let scaledBits = bits
  if (scaleY > 1) {
    scaledBits = []
    for (const row of bits) {
      for (let k = 0; k < scaleY; k++) {
        scaledBits.push(row)
      }
    }
  }

  const lines = []
  for (let y = 0; y < scaledBits.length; y += 2) {
    let line = ''
    const top = scaledBits[y]
    const bot = scaledBits[y + 1] ?? new Array(top.length).fill(0)
    for (let x = 0; x < top.length; x++) {
      const tFilled = top[x]
      const bFilled = bot[x]

      if (!tFilled && !bFilled) {
        line += ' '.repeat(scaleX)
      } else if (tFilled && bFilled) {
        line += fg(color[0], color[1], color[2]) +
                bgc(color[0], color[1], color[2]) +
                '▀'.repeat(scaleX) + RESET
      } else if (tFilled && !bFilled) {
        line += fg(color[0], color[1], color[2]) +
                '▀'.repeat(scaleX) + RESET
      } else {
        line += fg(color[0], color[1], color[2]) +
                '▄'.repeat(scaleX) + RESET
      }
    }
    lines.push(line)
  }
  return lines
}

// ═══ Header & Footer ════════════════════════════════════════════════
function drawHeader(label = '', extra = '') {
  const w = W()
  const left = `${FG_O}${bold} ▌▌ AGENT FORGE ▐▐ ${RESET}` +
               `${FG_G}${dim} v0.1.0-mockup${RESET}`
  const right = extra ? `${FG_G}${dim}${extra}${RESET}` : ''
  const center = label ? `${FG_GL}${label}${RESET}` : ''

  const leftLen = visibleLen(left)
  const centerLen = visibleLen(center)
  const rightLen = visibleLen(right)
  const padL = Math.max(0, Math.floor((w - leftLen - centerLen - rightLen) / 2))
  const padR = Math.max(0, w - leftLen - centerLen - rightLen - padL)

  writeFullLine(1, left + ' '.repeat(padL) + center + ' '.repeat(padR) + right)
  writeSeparator(2)
}

function drawFooter(hints, currentScreenInfo = '') {
  const h = H()
  const w = W()
  writeSeparator(h - 1)
  const text = ' ' + hints.map(x => `${FG_G}${dim}${x.key}${RESET} ${FG_GL}${x.label}${RESET}`).join('   ')
  const right = currentScreenInfo
    ? `${FG_G}${dim}${currentScreenInfo}${RESET} `
    : ''
  const lenT = visibleLen(text)
  const lenR = visibleLen(right)
  const padMiddle = Math.max(1, w - lenT - lenR)
  writeFullLine(h, text + ' '.repeat(padMiddle) + right)
}

// ═══════════════════════════════════════════════════════════════════
// ECRAN 1 — Splash
// ═══════════════════════════════════════════════════════════════════
const LOGO_AGENT = [
  '   █████╗  ██████╗ ███████╗███╗   ██╗████████╗',
  '  ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝',
  '  ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ',
  '  ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ',
  '  ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ',
  '  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ',
]
const LOGO_FORGE = [
  '  ███████╗ ██████╗ ██████╗  ██████╗ ███████╗',
  '  ██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝',
  '  █████╗  ██║   ██║██████╔╝██║  ███╗█████╗  ',
  '  ██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  ',
  '  ██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗',
  '  ╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝',
]

async function screenSplash() {
  clearAll()

  const h = H()
  const totalH = LOGO_AGENT.length + LOGO_FORGE.length + 8
  const startRow = Math.max(2, Math.floor((h - totalH) / 2))

  for (let i = 0; i < LOGO_AGENT.length; i++) {
    writeFullLine(startRow + i, FG_OB + LOGO_AGENT[i], 'center')
  }
  for (let i = 0; i < LOGO_FORGE.length; i++) {
    writeFullLine(startRow + LOGO_AGENT.length + i, FG_O + LOGO_FORGE[i], 'center')
  }

  const tagRow = startRow + LOGO_AGENT.length + LOGO_FORGE.length + 1
  writeFullLine(tagRow, FG_GL + 'Forge, run, and orchestrate sandboxed LLM agents', 'center')
  writeFullLine(tagRow + 1, FG_G + dim + 'v0.1.0  ·  by @garniergeorges  ·  Apache 2.0' + RESET, 'center')

  const checks = [
    'checking docker daemon',
    'verifying API key (Anthropic)',
    'loading builder skills (12)',
    'connecting to claude-presence',
    'scanning ~/.agent-forge/ (3 teams)',
  ]
  for (let i = 0; i < checks.length; i++) {
    writeFullLine(tagRow + 3 + i,
      FG_G + dim + '· ' + checks[i] + '...' + RESET, 'center')
    await sleep(280)
    writeFullLine(tagRow + 3 + i,
      FG_G + dim + FG_GR + '✓' + RESET + FG_G + dim + ' ' + checks[i] + RESET, 'center')
  }

  drawFooter([
    { key: '[SPACE]', label: 'next screen' },
    { key: '[Ctrl+C]', label: 'exit' },
  ], 'screen 1/7 · splash')

  await waitForSpace()
}

// ═══════════════════════════════════════════════════════════════════
// ECRAN 2 — Welcome
// ═══════════════════════════════════════════════════════════════════
async function screenWelcome() {
  clearAll()
  drawHeader('welcome · new session', 'session: new · model: sonnet-4-6 · cwd: ~/projects')

  const w = W(), h = H()
  const midY = Math.floor(h / 2) - 6

  writeFullLine(midY,     FG_O + bold + 'What do you want to build today?' + RESET, 'center')
  writeFullLine(midY + 2, FG_GL + 'Describe your project — I\'ll design and run a team of agents.' + RESET, 'center')

  const suggestions = [
    '▸  Build a Next.js + Laravel app with shadcn/ui and Sanctum auth',
    '▸  Audit this repository for security vulnerabilities',
    '▸  Migrate the codebase from JavaScript to TypeScript',
    '▸  Generate a weekly intelligence digest from RSS feeds',
  ]
  for (let i = 0; i < suggestions.length; i++) {
    writeFullLine(midY + 5 + i, FG_GL + dim + suggestions[i] + RESET, 'center')
  }

  const promptY = h - 5
  writeFullLine(promptY, FG_G + dim + ' ' + '─'.repeat(Math.max(0, w - 2)) + RESET)
  writeFullLine(promptY + 1, FG_O + ' ❯ ' + RESET + FG_W + 'Build a Next.js + Laravel app, with a QA agent supervising' + RESET + FG_O + '▌' + RESET)

  drawFooter([
    { key: '[⏎]', label: 'send' },
    { key: '[/help]', label: 'commands' },
    { key: '[/teams]', label: 'list teams' },
    { key: '[SPACE]', label: 'next' },
    { key: '[Ctrl+C]', label: 'exit' },
  ], 'screen 2/7 · welcome')

  await waitForSpace()
}

// ═══════════════════════════════════════════════════════════════════
// ECRAN 3 — Chat
// ═══════════════════════════════════════════════════════════════════
async function screenChat() {
  clearAll()
  drawHeader('chat · designing team', 'session: new · model: sonnet-4-6')

  let row = 4

  writeFullLine(row++, FG_G + dim + ' ❯ ' + RESET + FG_GL + 'Build a Next.js + Laravel app, with a QA agent supervising' + RESET)
  row++
  writeFullLine(row++, FG_G + dim + ' · thinking ▮▮▮' + RESET)
  row++
  writeFullLine(row++, FG_O + ' ▸ ' + RESET + FG_W + 'Got it. Let me design this team.' + RESET)
  row++

  const skills = [
    'skill: recognize-stack       → detected: Next.js + Laravel + MySQL',
    'skill: compose-team          → 3 agents (backend, frontend, qa)',
    'skill: configure-sandbox     → image agent-forge/fullstack:latest',
    'skill: select-mcp-servers    → context7, shadcn-ui, laravel-helper',
  ]
  for (const s of skills) {
    writeFullLine(row++, FG_G + dim + '   · ' + s + RESET)
  }
  row++

  writeFullLine(row++, FG_O + ' ▸ ' + RESET + FG_W + 'Here\'s how the team would be organized:' + RESET)
  row++

  // ── Schema genere par le builder : graphe de coordination ──────
  writeFullLine(row++, FG_G + dim + '   ▸ generating diagram...' + RESET)
  row++
  // Ce schema est genere DYNAMIQUEMENT par le builder LLM en fonction
  // du contexte (ici : team hierarchique avec 1 coordinateur et 2 workers).
  const teamDiagram = [
    `   ${FG_G}┌─ team topology ${'─'.repeat(40)}┐${RESET}`,
    `   ${FG_G}│${RESET}                                                       ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}                  ${FG_W}${bold}qa${RESET} ${FG_G}${dim}(coordinator)${RESET}                    ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}                   ${FG_O}┃${RESET}                                  ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}            ${FG_O}┏━━━━━━┻━━━━━━┓${RESET}                          ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}            ${FG_O}▼${RESET}             ${FG_O}▼${RESET}                          ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}         ${FG_W}${bold}backend${RESET}        ${FG_W}${bold}frontend${RESET}    ${FG_G}${dim}(workers)${RESET}      ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}            ${FG_GL}\\${RESET}             ${FG_GL}/${RESET}                            ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}             ${FG_GL}\\___________/${RESET}                             ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}        ${FG_GR}/workspace/${RESET} ${FG_G}${dim}(shared filesystem)${RESET}             ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}                                                       ${FG_G}│${RESET}`,
    `   ${FG_G}└─${'─'.repeat(54)}┘${RESET}`,
  ]
  for (const line of teamDiagram) writeFullLine(row++, line)
  row++

  writeFullLine(row++, FG_O + ' ▸ ' + RESET + FG_W + 'And how it runs in a sandboxed container:' + RESET)
  row++
  const sandboxDiagram = [
    `   ${FG_G}┌─ docker sandbox : agent-forge/fullstack ${'─'.repeat(15)}┐${RESET}`,
    `   ${FG_G}│${RESET}                                                       ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}    ${FG_W}[backend]${RESET}    ${FG_W}[frontend]${RESET}    ${FG_W}[qa]${RESET}                ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}        ${FG_O}│${RESET}            ${FG_O}│${RESET}            ${FG_O}│${RESET}                ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}        ${FG_O}└─────${RESET} ${FG_GR}/workspace/${RESET} ${FG_O}─────┘${RESET}                ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}                                                       ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}    ${FG_G}${dim}network ▸${RESET} ${FG_B}allowlist${RESET} ${FG_G}${dim}(github, npm, packagist)${RESET}     ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}    ${FG_G}${dim}memory  ▸${RESET} ${FG_W}4 GB${RESET}    ${FG_G}${dim}cpus ▸${RESET} ${FG_W}4${RESET}    ${FG_G}${dim}timeout ▸${RESET} ${FG_W}4h${RESET}     ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}    ${FG_G}${dim}coordination ▸${RESET} ${FG_Y}claude-presence MCP${RESET}                ${FG_G}│${RESET}`,
    `   ${FG_G}│${RESET}                                                       ${FG_G}│${RESET}`,
    `   ${FG_G}└─${'─'.repeat(54)}┘${RESET}`,
  ]
  for (const line of sandboxDiagram) writeFullLine(row++, line)
  row++

  writeFullLine(row++, FG_O + ' ▸ ' + RESET + FG_W + 'Shall I proceed?' + RESET)
  row++
  writeFullLine(row++, FG_G + dim + ' ❯ ' + RESET + FG_GL + 'Yes, go ahead' + RESET)
  row++

  const actions = [
    { ok: true,  text: '.agent-forge/teams/nextjs-laravel/ created (4 files)' },
    { ok: true,  text: 'docker container af-team-nextjs-laravel started' },
    { ok: true,  text: '3 agents booted, claude-presence connected' },
  ]
  for (const a of actions) {
    const symbol = a.ok ? FG_GR + '✓' : FG_G + dim + '·'
    writeFullLine(row++, ` ${symbol} ${RESET}${FG_GL}${a.text}${RESET}`)
  }

  drawFooter([
    { key: '[SPACE]', label: 'next' },
    { key: '[B]', label: 'back' },
    { key: '[Ctrl+C]', label: 'exit' },
  ], 'screen 3/7 · chat')

  await waitForSpace()
}

// ═══════════════════════════════════════════════════════════════════
// ECRAN 4 — Mission Control
// ═══════════════════════════════════════════════════════════════════
const SIM = {
  tick: 0,
  agents: [
    { name: 'backend',  robotIdx: 0, state: 'idle', progress: 0, currentTool: '—', tokens: 0 },
    { name: 'frontend', robotIdx: 1, state: 'idle', progress: 0, currentTool: '—', tokens: 0 },
    { name: 'qa',       robotIdx: 2, state: 'idle', progress: 0, currentTool: '—', tokens: 0 },
  ],
  bus: [],
  files: [],
}

const TIMELINE = {
  backend: [
    { state: 'idle',     tool: 'waiting for spec',      duration: 4, tokens: 80 },
    { state: 'thinking', tool: 'reading api spec',       duration: 2, tokens: 380 },
    { state: 'tool_use', tool: 'Bash(composer init)',    duration: 2, tokens: 620 },
    { state: 'working',  tool: 'FileWrite User.php',     duration: 3, tokens: 1100 },
    { state: 'tool_use', tool: 'Bash(php artisan)',      duration: 2, tokens: 1400 },
    { state: 'working',  tool: 'FileEdit routes/api',    duration: 2, tokens: 1700 },
    { state: 'tool_use', tool: 'Bash(php artisan test)', duration: 2, tokens: 2000 },
    { state: 'done',     tool: '✓ API ready',             duration: 999, tokens: 2050 },
  ],
  frontend: [
    { state: 'idle',     tool: 'waiting for spec',      duration: 5, tokens: 60 },
    { state: 'thinking', tool: 'reading api spec',       duration: 2, tokens: 320 },
    { state: 'tool_use', tool: 'Bash(pnpm install)',     duration: 3, tokens: 680 },
    { state: 'tool_use', tool: 'mcp__shadcn-ui',         duration: 2, tokens: 950 },
    { state: 'working',  tool: 'FileWrite app/page.tsx', duration: 3, tokens: 1450 },
    { state: 'working',  tool: 'FileEdit components/',   duration: 2, tokens: 1750 },
    { state: 'tool_use', tool: 'Bash(pnpm build)',       duration: 2, tokens: 1900 },
    { state: 'done',     tool: '✓ UI ready',              duration: 999, tokens: 1950 },
  ],
  qa: [
    { state: 'thinking', tool: 'planning workflow',      duration: 2, tokens: 280 },
    { state: 'tool_use', tool: 'FileWrite api-spec.yaml',duration: 3, tokens: 850 },
    { state: 'working',  tool: 'observing backend',      duration: 4, tokens: 1400 },
    { state: 'working',  tool: 'observing frontend',     duration: 4, tokens: 1900 },
    { state: 'tool_use', tool: 'Bash(npm run e2e)',      duration: 2, tokens: 2200 },
    { state: 'working',  tool: 'FileWrite report.md',    duration: 1, tokens: 2350 },
    { state: 'done',     tool: '✓ tests green',           duration: 999, tokens: 2400 },
  ],
}

const BUS_EVENTS = [
  { tick: 2,  from: 'qa',       to: null,       body: 'designing API spec, hold on' },
  { tick: 5,  from: 'qa',       to: 'backend',  body: 'spec v1 ready at /docs/api-spec.yaml' },
  { tick: 6,  from: 'qa',       to: 'frontend', body: 'spec ready, you can start' },
  { tick: 9,  from: 'backend',  to: null,       body: 'claim file:/docs/api-spec.yaml' },
  { tick: 11, from: 'backend',  to: null,       body: 'release file:/docs/api-spec.yaml' },
  { tick: 13, from: 'frontend', to: 'backend',  body: 'need User type from backend' },
  { tick: 14, from: 'backend',  to: 'frontend', body: '✓ exported in /types/api.ts' },
  { tick: 17, from: 'qa',       to: null,       body: 'running integration tests' },
  { tick: 19, from: 'qa',       to: null,       body: '✓ all tests passing (24 specs)' },
]

const FILES_EVENTS = [
  { tick: 6,  path: 'docs/api-spec.yaml',                     size: '2.1 KB' },
  { tick: 8,  path: 'backend/composer.json',                  size: '0.8 KB' },
  { tick: 10, path: 'backend/app/Models/User.php',            size: '1.2 KB' },
  { tick: 11, path: 'backend/database/migrations/0001.php',   size: '0.9 KB' },
  { tick: 12, path: 'backend/routes/api.php',                 size: '1.4 KB' },
  { tick: 14, path: 'frontend/package.json',                  size: '1.1 KB' },
  { tick: 15, path: 'frontend/types/api.ts',                  size: '0.6 KB' },
  { tick: 16, path: 'frontend/app/page.tsx',                  size: '2.3 KB' },
  { tick: 17, path: 'frontend/components/UserForm.tsx',       size: '1.8 KB' },
  { tick: 19, path: 'reports/qa.md',                          size: '3.4 KB' },
]

function tickSim() {
  SIM.tick++
  const t = SIM.tick
  for (const a of SIM.agents) {
    const tl = TIMELINE[a.name]
    let elapsed = 0, idx = 0
    for (let i = 0; i < tl.length; i++) {
      if (t < elapsed + tl[i].duration) { idx = i; break }
      elapsed += tl[i].duration
      idx = i
    }
    const ph = tl[idx]
    a.state = ph.state
    a.currentTool = ph.tool
    a.tokens = ph.tokens
    const total = tl.filter(p => p.duration < 999).reduce((s, p) => s + p.duration, 0)
    let done = 0
    for (let i = 0; i < idx; i++) done += tl[i].duration
    if (ph.duration < 999) done += Math.min(t - elapsed, ph.duration)
    else done = total
    a.progress = Math.min(100, Math.round((done / total) * 100))
  }
  for (const m of BUS_EVENTS) if (m.tick === t) SIM.bus.push({ ...m, ts: t })
  for (const f of FILES_EVENTS) if (f.tick === t) SIM.files.push({ ...f, ts: t })
}

function progressBar(pct, width) {
  const filled = Math.round((pct / 100) * width)
  return FG_O + '▓'.repeat(filled) + FG_G + dim + '░'.repeat(Math.max(0, width - filled)) + RESET
}

function drawDashboard() {
  clearAll()

  const w = W(), h = H()
  const allDone = SIM.agents.every(a => a.state === 'done')

  drawHeader(`mission control · nextjs-laravel${allDone ? ' ✓' : ''}`,
             `tick: ${SIM.tick}s · sandbox: af-team-nextjs-laravel`)

  const totalTok = SIM.agents.reduce((s, a) => s + a.tokens, 0)
  const cost = (totalTok * 3 / 1e6).toFixed(3)
  const stats =
    `  ${FG_G}${dim}team:${RESET} ${FG_W}nextjs-laravel${RESET}` +
    `   ${FG_G}${dim}elapsed:${RESET} ${FG_W}${String(SIM.tick).padStart(2)}s${RESET}` +
    `   ${FG_G}${dim}agents:${RESET} ${FG_W}${SIM.agents.length}${RESET}` +
    `   ${FG_G}${dim}tokens:${RESET} ${FG_W}${totalTok.toLocaleString()}${RESET}` +
    `   ${FG_G}${dim}est cost:${RESET} ${FG_GR}$${cost}${RESET}` +
    `   ${FG_G}${dim}network:${RESET} ${FG_B}allowlist${RESET}`
  writeFullLine(3, stats)
  writeSeparator(4)

  const treeW = Math.min(36, Math.max(20, Math.floor(w * 0.28)))
  const leftW = w - treeW - 2

  // Sprites
  const sprites = SIM.agents.map(a => renderSpriteLines(ROBOTS[a.robotIdx], colorForState(a.state)))
  const spriteH = sprites[0].length
  const cellW = SPRITE_W
  const GAP = 6
  const startY = 6

  for (let y = 0; y < spriteH; y++) {
    let line = '  '
    for (let i = 0; i < sprites.length; i++) {
      line += sprites[i][y] ?? ''
      if (i < sprites.length - 1) line += ' '.repeat(GAP)
    }
    moveTo(startY + y, 1)
    eraseLine()
    out(line)
  }

  // Infos sous chaque sprite
  const infoY = startY + spriteH + 1
  const labels = []
  const states = []
  const progs = []
  const tools = []
  const tokens = []
  for (const a of SIM.agents) {
    const sc = colorForState(a.state)
    labels.push(FG_W + bold + a.name + RESET)
    states.push(fg(sc[0], sc[1], sc[2]) + a.state + RESET)
    progs.push(progressBar(a.progress, cellW - 5) + ' ' + FG_G + dim + String(a.progress).padStart(3) + '%' + RESET)
    tools.push(FG_GL + dim + (a.currentTool || '—').slice(0, cellW) + RESET)
    tokens.push(FG_G + dim + a.tokens.toLocaleString() + ' tok' + RESET)
  }

  function joinCells(items) {
    let line = '  '
    for (let i = 0; i < items.length; i++) {
      const len = visibleLen(items[i])
      line += items[i] + ' '.repeat(Math.max(0, cellW - len))
      if (i < items.length - 1) line += ' '.repeat(GAP)
    }
    return line
  }

  const allInfoLines = [labels, states, progs, tools, tokens]
  for (let i = 0; i < 5; i++) {
    moveTo(infoY + i, 1)
    eraseLine()
    out(joinCells(allInfoLines[i]))
  }

  // Bus
  const busY = infoY + 7
  moveTo(busY, 1)
  eraseLine()
  out(`  ${FG_O}●${RESET} ${FG_W}claude-presence bus${RESET} ${FG_G}${dim}` + '─'.repeat(Math.max(0, leftW - 30)) + RESET)

  const recent = SIM.bus.slice(-7)
  for (let i = 0; i < 7; i++) {
    moveTo(busY + 1 + i, 1)
    eraseLine()
    if (recent[i]) {
      const m = recent[i]
      const arrow = m.to ? `${m.from} → ${m.to}` : `${m.from} → all`
      out(`  ${FG_G}${dim}[${String(m.ts).padStart(2)}s]${RESET}  ${FG_O}${arrow.padEnd(22)}${RESET}  ${FG_GL}${m.body}${RESET}`)
    }
  }

  // Workspace tree a droite
  const treeX = leftW + 2
  moveTo(startY - 1, treeX)
  out(`${FG_O}●${RESET} ${FG_W}workspace${RESET}  ${FG_G}${dim}./workspace/${RESET}`)
  moveTo(startY, treeX)
  out(FG_G + dim + '─'.repeat(Math.max(0, treeW - 2)) + RESET)

  const groups = {}
  for (const f of SIM.files) {
    const dir = f.path.split('/')[0]
    if (!groups[dir]) groups[dir] = []
    groups[dir].push(f)
  }

  let trow = startY + 1
  const maxRow = h - 3
  for (const [dir, files] of Object.entries(groups)) {
    if (trow >= maxRow) break
    moveTo(trow++, treeX)
    out(FG_B + '▸ ' + dir + '/' + RESET)
    for (const f of files) {
      if (trow >= maxRow) break
      const fname = f.path.split('/').slice(1).join('/')
      const truncated = fname.length > treeW - 12 ? fname.slice(0, treeW - 13) + '…' : fname
      moveTo(trow++, treeX)
      out(`  ${FG_GR}+${RESET} ${FG_W}${truncated}${RESET} ${FG_G}${dim}${f.size}${RESET}`)
    }
  }
  if (Object.keys(groups).length === 0) {
    moveTo(trow, treeX)
    out(FG_G + dim + '  (no files yet)' + RESET)
  }

  drawFooter([
    { key: '[c]', label: 'chat' },
    { key: '[Tab]', label: 'cycle' },
    { key: '[Enter]', label: 'focus' },
    { key: '[h]', label: 'hangar' },
    { key: '[k]', label: 'kill' },
    { key: '[SPACE]', label: 'next' },
    { key: '[Ctrl+C]', label: 'quit' },
  ], 'screen 4/7 · mission control')
}

async function screenDashboard() {
  while (SIM.tick < 22) {
    tickSim()
    drawDashboard()
    if (await sleepOrSpace(700)) return
  }
  drawDashboard()
  await waitForSpace()
}

// ═══════════════════════════════════════════════════════════════════
// ECRAN 5 — Focus Agent
// ═══════════════════════════════════════════════════════════════════
async function screenFocus() {
  clearAll()
  drawHeader('focus · qa-supervisor', 'session: team-001')

  const w = W(), h = H()
  const leftW = Math.floor(w * 0.45)
  const rightW = w - leftW - 1

  const a = SIM.agents[2]
  const big = renderSpriteLines(ROBOTS[a.robotIdx], colorForState('done'), 2, 2)
  const startY = 4
  for (let y = 0; y < big.length; y++) {
    moveTo(startY + y, 4)
    out(big[y])
  }

  const infoY = startY + big.length + 2
  const infoLines = [
    `${FG_W}${bold}qa-supervisor${RESET}`,
    `${FG_G}role:${RESET}   ${FG_GL}coordinator${RESET}`,
    `${FG_G}model:${RESET}  ${FG_W}claude-opus-4-7${RESET}`,
    `${FG_G}state:${RESET}  ${FG_GR}done ✓${RESET}`,
    `${FG_G}turns:${RESET}  ${FG_W}18 / 200${RESET}`,
    `${FG_G}tokens:${RESET} ${FG_W}2,400${RESET} ${FG_G}${dim}(in: 2.1k · out: 0.3k)${RESET}`,
    ``,
    `${FG_G}skills:${RESET} ${FG_GL}test-strategy · code-review · team-coordination${RESET}`,
  ]
  for (let i = 0; i < infoLines.length; i++) {
    moveTo(infoY + i, 4)
    out(infoLines[i])
  }

  // ── Bar chart vertical : usage des tools (genere par le builder) ──
  const chartY = infoY + infoLines.length + 1
  const tools = [
    { name: 'FileR',   count: 12 },
    { name: 'SendMsg', count:  8 },
    { name: 'Bash',    count:  4 },
    { name: 'FileW',   count:  3 },
    { name: 'FileE',   count:  2 },
  ]
  const maxCount = Math.max(...tools.map(t => t.count))
  const chartHeight = 6 // lignes de hauteur max
  const barW = 5  // largeur d'une barre + espace

  moveTo(chartY, 4)
  out(`${FG_GL}${bold}tools usage${RESET} ${FG_G}${dim}─ generated by builder ─${RESET}`)

  for (let h = chartHeight; h >= 1; h--) {
    moveTo(chartY + 1 + (chartHeight - h), 4)
    let line = ''
    for (const t of tools) {
      const filled = Math.round((t.count / maxCount) * chartHeight)
      const cell = filled >= h ? `${FG_O}████${RESET}` : '    '
      line += cell + ' '
    }
    out(line)
  }
  // Ligne de base + valeurs + noms
  moveTo(chartY + 1 + chartHeight, 4)
  out(tools.map(t => `${FG_G}${dim}────${RESET}`).join(' '))
  moveTo(chartY + 2 + chartHeight, 4)
  out(tools.map(t => `${FG_W}${String(t.count).padStart(2)}× ${RESET}`).join(' '))
  moveTo(chartY + 3 + chartHeight, 4)
  out(tools.map(t => `${FG_G}${dim}${t.name.padEnd(4)}${RESET}`).join(' '))

  const trxX = leftW + 2
  moveTo(3, trxX)
  out(`${FG_O}●${RESET} ${FG_W}live transcript${RESET} ${FG_G}${dim}` + '─'.repeat(Math.max(0, rightW - 20)) + RESET)

  const transcript = [
    { type: 'user',      text: '(initial team prompt)' },
    { type: 'assistant', text: 'Starting QA workflow. I\'ll first design the API spec.' },
    { type: 'tool',      text: 'FileWrite docs/api-spec.yaml (2.1 KB)' },
    { type: 'tool',      text: 'broadcast → all: "spec v1 ready"' },
    { type: 'assistant', text: 'Now monitoring backend and frontend progress.' },
    { type: 'tool',      text: 'FileRead backend/routes/api.php' },
    { type: 'tool',      text: 'FileRead frontend/app/page.tsx' },
    { type: 'assistant', text: 'Both implementations match the spec. Running e2e tests.' },
    { type: 'tool',      text: 'Bash(npm run test:e2e) → 24 passed, 0 failed' },
    { type: 'tool',      text: 'FileWrite reports/qa.md (3.4 KB)' },
    { type: 'assistant', text: 'All tests pass. Mission complete. ✓' },
  ]
  for (let i = 0; i < transcript.length; i++) {
    moveTo(4 + i, trxX)
    const t = transcript[i]
    let prefix = '   '
    let color = FG_W
    if (t.type === 'user')      { prefix = ' ❯ '; color = FG_GL }
    if (t.type === 'assistant') { prefix = ' ▸ '; color = FG_W }
    if (t.type === 'tool')      { prefix = ' · '; color = FG_B }
    const text = t.text.slice(0, rightW - 5)
    out((t.type === 'user' ? FG_G : (t.type === 'tool' ? FG_B : FG_O)) + prefix + RESET + color + text + RESET)
  }

  drawFooter([
    { key: '[Esc]', label: 'back to dashboard' },
    { key: '[t]', label: 'full transcript' },
    { key: '[m]', label: 'memory' },
    { key: '[SPACE]', label: 'next' },
    { key: '[Ctrl+C]', label: 'exit' },
  ], 'screen 5/7 · focus')

  await waitForSpace()
}

// ═══════════════════════════════════════════════════════════════════
// ECRAN 6 — Hangar
// ═══════════════════════════════════════════════════════════════════
async function screenHangar() {
  clearAll()
  drawHeader('hangar · agent gallery', '5 agents · 3 teams archived')

  const w = W(), h = H()
  const states = ['done', 'working', 'thinking', 'tool_use', 'idle']
  const sprites = ROBOTS.map((bits, i) => renderSpriteLines(bits, colorForState(states[i]), 2, 2))
  const labels = ['backend', 'frontend', 'qa', 'devops', 'data']

  const spriteH = sprites[0].length
  const cellW = SPRITE_W * 2
  const GAP = 6
  const totalW = sprites.length * cellW + (sprites.length - 1) * GAP
  const startX = Math.max(2, Math.floor((w - totalW) / 2))
  const startY = Math.max(5, Math.floor((h - spriteH - 8) / 2))

  for (let y = 0; y < spriteH; y++) {
    moveTo(startY + y, startX)
    let line = ''
    for (let i = 0; i < sprites.length; i++) {
      line += sprites[i][y] ?? ''
      if (i < sprites.length - 1) line += ' '.repeat(GAP)
    }
    out(line)
  }

  const labelY = startY + spriteH + 1
  let labelLine = ''
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]
    const padded = ' '.repeat(Math.max(0, Math.floor((cellW - label.length) / 2))) + label
    labelLine += FG_W + bold + padded.padEnd(cellW) + RESET
    if (i < labels.length - 1) labelLine += ' '.repeat(GAP)
  }
  moveTo(labelY, startX)
  out(labelLine)

  const stateY = labelY + 1
  let stateLine = ''
  for (let i = 0; i < states.length; i++) {
    const sc = colorForState(states[i])
    const padded = ' '.repeat(Math.max(0, Math.floor((cellW - states[i].length) / 2))) + states[i]
    stateLine += fg(sc[0], sc[1], sc[2]) + padded.padEnd(cellW) + RESET
    if (i < states.length - 1) stateLine += ' '.repeat(GAP)
  }
  moveTo(stateY, startX)
  out(stateLine)

  writeFullLine(stateY + 3, FG_GL + '— Hangar — agent gallery —' + RESET, 'center')
  writeFullLine(stateY + 4, FG_G + dim + '5 agents available · 0 active · 3 teams archived' + RESET, 'center')

  drawFooter([
    { key: '[Esc]', label: 'back' },
    { key: '[Enter]', label: 'select agent' },
    { key: '[SPACE]', label: 'next' },
    { key: '[Ctrl+C]', label: 'exit' },
  ], 'screen 6/7 · hangar')

  await waitForSpace()
}

// ═══════════════════════════════════════════════════════════════════
// ECRAN 7 — Completion
// ═══════════════════════════════════════════════════════════════════
async function screenCompletion() {
  clearAll()
  drawHeader('team completed ✓', 'session: team-001 · duration: 22s')

  let row = 4
  writeFullLine(row++, FG_GR + bold + '✓ Mission complete' + RESET, 'center')
  writeFullLine(row++, FG_GL + 'Team nextjs-laravel finished successfully' + RESET, 'center')
  row++

  // ── Timeline horizontale des phases (genere par le builder) ──
  writeFullLine(row++, FG_GL + bold + 'mission timeline' + RESET + ' ' + FG_G + dim + '─ generated by builder ─' + RESET, 'center')
  row++
  const timelineLines = [
    `${FG_G}${dim}0s${RESET}   ${FG_G}${dim}5s${RESET}    ${FG_G}${dim}10s${RESET}   ${FG_G}${dim}15s${RESET}   ${FG_G}${dim}20s${RESET}   ${FG_G}${dim}22s${RESET}`,
    `${FG_O}┃${RESET}    ${FG_O}┃${RESET}     ${FG_O}┃${RESET}     ${FG_O}┃${RESET}     ${FG_O}┃${RESET}     ${FG_GR}┃${RESET}`,
    `${FG_Y}╾━━━━╼${RESET}${FG_O}╾━━━━━━━━━━━━━━━━━━━━━━╼${RESET}${FG_GR}━━╼${RESET}  ${FG_W}${bold}qa${RESET}  ${FG_G}${dim}plan → observe → tests${RESET}`,
    `     ${FG_OD}╾━━━━╼${RESET}${FG_O}╾━━━━━━━━━━━━━━━━╼${RESET}${FG_GR}━━╼${RESET}      ${FG_W}${bold}backend${RESET} ${FG_G}${dim}wait → code → test${RESET}`,
    `      ${FG_OD}╾━━━━━╼${RESET}${FG_O}╾━━━━━━━━━━━━━━━╼${RESET}${FG_GR}━━╼${RESET}      ${FG_W}${bold}frontend${RESET} ${FG_G}${dim}wait → build → polish${RESET}`,
  ]
  for (const line of timelineLines) writeFullLine(row++, line, 'center')
  row++

  const w = W()
  const colW = Math.floor(w / 2)

  // ── Colonne gauche : stats numeriques ──
  const stats = [
    { label: 'duration',         value: '22s' },
    { label: 'agents',           value: '3 (all done)' },
    { label: 'turns total',      value: '54' },
    { label: 'tokens',           value: '6,400 (in 5.2k · out 1.2k)' },
    { label: 'cost estimate',    value: '$0.019' },
    { label: 'tests passed',     value: '24 / 24 ✓' },
  ]
  const statsStartY = row
  writeLine(row, 4, FG_GL + bold + 'metrics' + RESET)
  for (let i = 0; i < stats.length; i++) {
    writeLine(row + 1 + i, 4, FG_G + stats[i].label.padEnd(16) + RESET + FG_W + stats[i].value + RESET)
  }

  // ── Colonne droite : arbre des artefacts ──
  writeLine(row, colW + 4, FG_GL + bold + 'artifacts produced' + RESET)
  const tree = [
    `${FG_B}▸ workspace/${RESET}`,
    `  ${FG_B}├─ docs/${RESET}`,
    `  ${FG_GR}│   └─ + api-spec.yaml${RESET}        ${FG_G}${dim}2.1 KB${RESET}`,
    `  ${FG_B}├─ backend/${RESET}                  ${FG_G}${dim}5 files · 5.4 KB${RESET}`,
    `  ${FG_B}├─ frontend/${RESET}                 ${FG_G}${dim}4 files · 5.7 KB${RESET}`,
    `  ${FG_B}└─ reports/${RESET}`,
    `      ${FG_GR}└─ + qa.md${RESET}                ${FG_G}${dim}3.4 KB${RESET}`,
  ]
  for (let i = 0; i < tree.length; i++) {
    writeLine(row + 1 + i, colW + 4, tree[i])
  }

  // ── Suggestions en bas ──
  row = statsStartY + Math.max(stats.length, tree.length) + 3
  writeFullLine(row++, FG_GL + 'What\'s next?' + RESET, 'center')
  row++

  const sugg = [
    `${FG_O}▸${RESET} ${FG_W}forge open ./workspace${RESET}        ${FG_G}${dim}# review the produced code${RESET}`,
    `${FG_O}▸${RESET} ${FG_W}forge replay nextjs-laravel${RESET}   ${FG_G}${dim}# re-run with adjustments${RESET}`,
    `${FG_O}▸${RESET} ${FG_W}forge clone nextjs-laravel mvp${RESET}${FG_G}${dim}  # duplicate as new team${RESET}`,
    `${FG_O}▸${RESET} ${FG_W}forge new${RESET}                      ${FG_G}${dim}# start a fresh project${RESET}`,
  ]
  for (let i = 0; i < sugg.length; i++) {
    writeFullLine(row + i, sugg[i], 'center')
  }

  drawFooter([
    { key: '[B]', label: 'previous' },
    { key: '[R]', label: 'restart demo' },
    { key: '[Ctrl+C]', label: 'exit' },
  ], 'screen 7/7 · completion')

  await waitForSpace()
}

// ═══════════════════════════════════════════════════════════════════
// Navigation
// ═══════════════════════════════════════════════════════════════════
let pendingKey = null

function setupKeys() {
  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.on('keypress', (str, key) => {
      if (key.ctrl && key.name === 'c') {
        show()
        cls()
        process.exit(0)
      }
      if (key.name === 'space' || key.name === 'return') pendingKey = 'next'
      else if (key.name === 'b') pendingKey = 'back'
      else if (key.name === 'r') pendingKey = 'restart'
    })
  }
}

async function waitForSpace() {
  pendingKey = null
  while (pendingKey !== 'next' && pendingKey !== 'back' && pendingKey !== 'restart') {
    await sleep(50)
  }
  return pendingKey
}

async function sleepOrSpace(ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    if (pendingKey === 'next') return true
    await sleep(30)
  }
  return false
}

async function main() {
  setupKeys()
  hide()

  const screens = [
    screenSplash,
    screenWelcome,
    screenChat,
    screenDashboard,
    screenFocus,
    screenHangar,
    screenCompletion,
  ]

  let i = 0
  while (true) {
    pendingKey = null
    await screens[i]()

    if (pendingKey === 'back' && i > 0) i--
    else if (pendingKey === 'restart') {
      SIM.tick = 0; SIM.bus = []; SIM.files = []
      for (const a of SIM.agents) {
        a.state = 'idle'; a.progress = 0; a.currentTool = '—'; a.tokens = 0
      }
      i = 0
    }
    else {
      i++
      if (i >= screens.length) {
        i = 0
        SIM.tick = 0; SIM.bus = []; SIM.files = []
        for (const a of SIM.agents) {
          a.state = 'idle'; a.progress = 0; a.currentTool = '—'; a.tokens = 0
        }
      }
    }
  }
}

main().catch(err => {
  show()
  cls()
  console.error(err)
  process.exit(1)
})
