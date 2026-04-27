// Skill runner — deterministic orchestration for skills that small
// models can't reliably handle through prompt instructions alone.
//
// Today this only knows how to drive `scaffold-and-run`. The shape is
// generic enough that other skills can plug in : each runner takes
// the user prompt, calls the LLM with a tightly scoped instruction
// (one block to produce, nothing else), and returns either the
// generated content or null on failure. The CLI assembles the
// resulting actions in Mission Control.
//
// The win over a single LLM call : Mistral Small collapses
// "what the agent is" (AGENT.md) and "what the agent should do this
// time" (forge:run prompt) into one big system prompt. Splitting the
// work into two narrow calls forces the model to keep them apart.

import { generateText } from 'ai'
import { getBuilderModel } from './provider.ts'
import type { BuilderLang } from './system-prompt.ts'

export type ScaffoldAndRunResult = {
  agentName: string
  agentMdContent: string // full AGENT.md (frontmatter + body), no fences
  runPrompt: string // prompt to feed forge:run
}

const AGENT_MD_INSTRUCTION_FR = `Tu es un assistant qui produit UNIQUEMENT le contenu d'un fichier AGENT.md, rien d'autre.

Format obligatoire (commence par \`---\`, finis par \`---\` puis le corps) :

---
name: <nom-en-kebab-case>
description: "Une phrase courte décrivant le rôle GÉNÉRIQUE de l'agent (pas la mission spécifique de cette session)."
sandbox:
  image: agent-forge/base:latest
  timeout: 120s
maxTurns: 8
---

# <nom-en-kebab-case>

Tu es un <rôle>. Décris en 2 à 4 lignes le rôle GÉNÉRIQUE de l'agent. Mentionne brièvement les outils dont il dispose (forge:bash, forge:write, forge:read, forge:edit, forge:grep, forge:glob, sandboxés sous /workspace). NE liste PAS d'étapes spécifiques à la session courante — ces étapes seront passées séparément en prompt run.

RÈGLES STRICTES :
- Ne produis QUE le contenu du fichier AGENT.md, sans \`\`\` ni texte avant/après.
- La valeur de \`description\` ne doit JAMAIS contenir de deux-points non quoté.
- N'invente pas de section "Étapes" ou "Mission" dans le corps : elles iront dans le prompt run.
- Réponds en français.`

const AGENT_MD_INSTRUCTION_EN = `You output ONLY the content of an AGENT.md file, nothing else.

Required format (start with \`---\`, end with \`---\` then the body) :

---
name: <kebab-case-name>
description: "One short sentence describing the GENERIC role of the agent (not the specific mission of this session)."
sandbox:
  image: agent-forge/base:latest
  timeout: 120s
maxTurns: 8
---

# <kebab-case-name>

You are a <role>. Describe the GENERIC role in 2-4 lines. Briefly mention the tools available (forge:bash, forge:write, forge:read, forge:edit, forge:grep, forge:glob, sandboxed under /workspace). Do NOT list session-specific steps — those will be passed separately as the run prompt.

STRICT RULES :
- Output ONLY the AGENT.md content, no \`\`\` and no prose before/after.
- The \`description\` value must NEVER contain an unquoted colon.
- Do not invent a "Steps" or "Mission" section in the body : that goes in the run prompt.
- Answer in English.`

const RUN_PROMPT_INSTRUCTION_FR = `Tu es un assistant qui produit UNIQUEMENT le prompt à envoyer à un agent, rien d'autre.

Tu vas extraire de la demande utilisateur la MISSION CONCRÈTE à exécuter, et la reformuler comme une INSTRUCTION DIRECTE adressée à l'agent (à la 2ème personne du singulier en français : « tu vas… »). Cette instruction sera passée à l'agent via un bloc forge:run.

RÈGLES STRICTES :
- Produis UNIQUEMENT le texte du prompt, sans \`\`\`, sans préambule, sans explication.
- Décris des étapes concrètes et exécutables (pas de méta-discours).
- Ne ré-explique PAS le rôle de l'agent, il est déjà défini dans son AGENT.md.
- Si la demande mentionne du code à scaffolder, sois explicite sur le contenu attendu.
- Termine par : « Réponds en français. »`

const RUN_PROMPT_INSTRUCTION_EN = `You output ONLY the prompt to send to an agent, nothing else.

You extract from the user's message the CONCRETE MISSION to execute, and rephrase it as a DIRECT INSTRUCTION to the agent (second person : "you will…"). This instruction will be passed to the agent through a forge:run block.

STRICT RULES :
- Output ONLY the prompt text, no \`\`\`, no preamble, no explanation.
- Describe concrete executable steps (no meta-talk).
- Do NOT re-explain the role of the agent, it's already defined in its AGENT.md.
- If the user mentioned code to scaffold, be explicit about the expected content.
- End with : "Answer in English."`

function buildAgentMdInstruction(lang: BuilderLang): string {
  return lang === 'fr' ? AGENT_MD_INSTRUCTION_FR : AGENT_MD_INSTRUCTION_EN
}

function buildRunPromptInstruction(lang: BuilderLang): string {
  return lang === 'fr' ? RUN_PROMPT_INSTRUCTION_FR : RUN_PROMPT_INSTRUCTION_EN
}

const NAME_RE = /name\s*:\s*([a-z][a-z0-9-]*)/i

function extractAgentName(agentMd: string): string | null {
  const m = NAME_RE.exec(agentMd)
  return m && m[1] ? m[1] : null
}

function stripFences(text: string): string {
  // The instruction tells the model NOT to wrap output in fences, but
  // small models slip — strip a leading and trailing ``` if present.
  let out = text.trim()
  if (out.startsWith('```')) {
    const firstNl = out.indexOf('\n')
    if (firstNl !== -1) out = out.slice(firstNl + 1)
  }
  if (out.endsWith('```')) {
    out = out.slice(0, -3).trimEnd()
  }
  return out.trim()
}

/**
 * Drive the scaffold-and-run skill end to end. Two narrow LLM calls,
 * each producing exactly one artefact. The CLI then surfaces them as
 * a write action + a run action in Mission Control.
 *
 * Returns null if either call fails to produce a recognisable
 * artefact (e.g. AGENT.md without a `name:` line). The caller falls
 * back to the normal flow.
 */
export async function runScaffoldAndRun(args: {
  userMessage: string
  lang: BuilderLang
}): Promise<ScaffoldAndRunResult | null> {
  const model = getBuilderModel()
  const agentMdInstruction = buildAgentMdInstruction(args.lang)
  const runPromptInstruction = buildRunPromptInstruction(args.lang)

  // Call 1 : produce the AGENT.md.
  const agentMdResp = await generateText({
    model,
    system: agentMdInstruction,
    prompt: args.userMessage,
    maxTokens: 600,
  })
  const agentMdContent = stripFences(agentMdResp.text)
  const agentName = extractAgentName(agentMdContent)
  if (!agentName) return null

  // Call 2 : produce the run prompt.
  const runResp = await generateText({
    model,
    system: runPromptInstruction,
    prompt: args.userMessage,
    maxTokens: 400,
  })
  const runPrompt = stripFences(runResp.text)
  if (runPrompt.length === 0) return null

  return { agentName, agentMdContent, runPrompt }
}
