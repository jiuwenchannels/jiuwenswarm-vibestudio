/**
 * Agent mode helpers.
 *
 * VibeStudio uses two JiuwenSwarm modes:
 * - "team"  — full multi-agent generation (Architect + sub-agents).  Used for
 *             initial app creation and major feature additions.
 * - "agent" — single-agent mode.  Used for targeted edits, explanations, and
 *             quick bug fixes where full team overhead is not needed.
 */
import type { StreamEventsOptions } from "./client";
import { buildAgentSystemPrefix } from "./streamParser";

export type GenerationIntent =
  | "generate"   // Build a new app or a substantial new feature
  | "refine"     // Targeted change to an existing file
  | "explain"    // Question about the current codebase
  | "fix";       // Fix a specific error or bug

/**
 * Pick the agent mode based on the user's intent.
 *
 * "generate" is always "team" so the Architect can delegate to specialists.
 * All other intents use "agent" for lower latency.
 */
export function pickMode(intent: GenerationIntent): "team" | "agent" {
  return intent === "generate" ? "team" : "agent";
}

/**
 * Build the `StreamEventsOptions` for a given intent and session.
 *
 * @param intent      What the user wants to do.
 * @param sessionId   Active JiuwenSwarm session ID.
 * @param extraPrefix Extra context to prepend (e.g. current file contents).
 */
export function buildStreamOptions(
  intent: GenerationIntent,
  sessionId: string,
  extraPrefix?: string,
): StreamEventsOptions {
  const systemPrefix = buildAgentSystemPrefix();
  const contextPrefix = extraPrefix
    ? `${systemPrefix}\n\n${extraPrefix}`
    : systemPrefix;

  return {
    mode: pickMode(intent),
    sessionId,
    contextPrefix,
  };
}

/**
 * Infer the most likely intent from the user's raw message text.
 * This is a simple heuristic — the user can also pick intent explicitly
 * from the quick-action buttons in the Chat UI.
 */
export function inferIntent(text: string): GenerationIntent {
  const lower = text.toLowerCase();
  if (/\b(fix|error|bug|broken|doesn.t work|not working)\b/.test(lower)) return "fix";
  if (/\b(explain|what is|how does|why|describe)\b/.test(lower)) return "explain";
  if (/\b(change|update|rename|move|refactor|modify|adjust|tweak)\b/.test(lower)) return "refine";
  return "generate";
}
