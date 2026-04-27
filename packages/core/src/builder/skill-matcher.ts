// Server-side skill trigger matching.
//
// Small models (Mistral Small, MLX local) don't reliably emit
// forge:skill even when the system prompt says they MUST. Plan B :
// the CLI matches triggers itself before calling the LLM. If a
// trigger phrase appears as a substring of the user message
// (case-insensitive), the matched skill is auto-loaded : its body is
// injected into the conversation as a system message, and a
// SkillAction (status=done) is added to Mission Control. The LLM
// then sees the skill instructions as if it had asked for them
// itself, and the next turn follows the orchestration described in
// the skill body.

import type { SkillEntry } from './skill-catalog.ts'

/**
 * Returns the FIRST skill whose triggers match the user message, or
 * null if none match. Match is case-insensitive substring : we trim
 * the trigger and lower-case both sides before comparing. We don't
 * need a fuzzy matcher — skills define their own trigger phrases, so
 * authors can list as many synonyms as they like.
 *
 * The first match wins because skills are sorted alphabetically in
 * the catalog ; if two skills compete on a message, the first one
 * lexicographically takes precedence. That's deterministic and easy
 * to reason about ; we'll revisit if real conflicts appear.
 */
export function matchSkillForMessage(
  message: string,
  skills: SkillEntry[],
): SkillEntry | null {
  const haystack = message.toLowerCase()
  for (const skill of skills) {
    for (const trigger of skill.triggers) {
      const needle = trigger.trim().toLowerCase()
      if (needle.length === 0) continue
      if (haystack.includes(needle)) return skill
    }
  }
  return null
}
