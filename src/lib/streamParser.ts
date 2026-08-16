/**
 * Stream parser — extracts file deltas and status messages from the raw token
 * stream produced by the JiuwenSwarm agent team.
 *
 * Agent output convention
 * -----------------------
 * The Architect agent wraps each generated file in sentinel markers so the
 * parser can reliably extract structured content from a prose stream:
 *
 *   @@FILE: src/components/Button.tsx
 *   ```tsx
 *   export function Button({ label }: { label: string }) { … }
 *   ```
 *   @@END_FILE
 *
 * Any text outside these markers is treated as a plain assistant message.
 */

export interface FileDelta {
  /** Relative file path, e.g. "src/components/Button.tsx". */
  path: string;
  /** Full file content (decoded from the code fence). */
  content: string;
  /** Action to apply to the project store. */
  action: "create" | "update" | "delete";
}

export interface ParseResult {
  /** Files to write/update/delete in the project store. */
  deltas: FileDelta[];
  /** Prose text with all @@FILE…@@END_FILE blocks stripped out. */
  prose: string;
}

const FILE_PATTERN =
  /@@FILE:\s*(\S+)\s*\r?\n```[^\n]*\r?\n([\s\S]*?)```\r?\n@@END_FILE/g;

const DELETE_PATTERN = /@@DELETE:\s*(\S+)/g;

/**
 * Parse a completed generation response (full accumulated text) into file
 * deltas and leftover prose.  Call this once the `done` event fires.
 */
export function parseGenerationResult(fullText: string): ParseResult {
  const deltas: FileDelta[] = [];
  let prose = fullText;

  // Extract @@FILE...@@END_FILE blocks.
  for (const match of fullText.matchAll(FILE_PATTERN)) {
    const [block, path, content] = match;
    deltas.push({ path: path.trim(), content, action: "create" });
    prose = prose.replace(block, "");
  }

  // Extract @@DELETE: directives.
  for (const match of fullText.matchAll(DELETE_PATTERN)) {
    const [directive, path] = match;
    deltas.push({ path: path.trim(), content: "", action: "delete" });
    prose = prose.replace(directive, "");
  }

  return { deltas, prose: prose.trim() };
}

/**
 * Build the system prompt prefix that instructs the agent to use the file
 * marker convention when generating code.
 */
export function buildAgentSystemPrefix(): string {
  return `
When generating or modifying files, wrap each file in exactly this format:

@@FILE: <relative/path/to/file.ext>
\`\`\`<language>
<full file content>
\`\`\`
@@END_FILE

To delete a file use: @@DELETE: <relative/path/to/file.ext>

Write every file in full — never use ellipsis or "rest unchanged" placeholders.
After all file blocks you may include a short explanation of what was changed.
`.trim();
}
