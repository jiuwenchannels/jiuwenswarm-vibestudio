import { describe, it, expect } from "vitest";
import { pickMode, inferIntent, buildStreamOptions } from "../src/lib/agentMode";

describe("pickMode", () => {
  it("returns 'team' for generate intent", () => {
    expect(pickMode("generate")).toBe("team");
  });

  it("returns 'agent' for refine, explain, and fix", () => {
    expect(pickMode("refine")).toBe("agent");
    expect(pickMode("explain")).toBe("agent");
    expect(pickMode("fix")).toBe("agent");
  });
});

describe("inferIntent", () => {
  it("detects fix intent from error keywords", () => {
    expect(inferIntent("There's a bug in the login form")).toBe("fix");
    expect(inferIntent("It's broken")).toBe("fix");
    expect(inferIntent("fix the navigation error")).toBe("fix");
    expect(inferIntent("This doesn't work")).toBe("fix");
  });

  it("detects explain intent from question keywords", () => {
    expect(inferIntent("What is this component doing?")).toBe("explain");
    expect(inferIntent("Explain the useEffect hook")).toBe("explain");
    expect(inferIntent("How does the router work?")).toBe("explain");
  });

  it("detects refine intent from modification keywords", () => {
    expect(inferIntent("Change the button colour to blue")).toBe("refine");
    expect(inferIntent("Rename the Dashboard page to Home")).toBe("refine");
    expect(inferIntent("Refactor the auth module")).toBe("refine");
    expect(inferIntent("Update the header text")).toBe("refine");
  });

  it("falls back to generate for open-ended prompts", () => {
    expect(inferIntent("Build a recipe app")).toBe("generate");
    expect(inferIntent("Create a SaaS dashboard")).toBe("generate");
    expect(inferIntent("I want a todo list with authentication")).toBe("generate");
  });

  it("is case-insensitive", () => {
    expect(inferIntent("EXPLAIN how the store works")).toBe("explain");
    expect(inferIntent("FIX the broken header")).toBe("fix");
  });
});

describe("buildStreamOptions", () => {
  const sessionId = "sess_test_123";

  it("sets mode to team for generate intent", () => {
    const opts = buildStreamOptions("generate", sessionId);
    expect(opts.mode).toBe("team");
    expect(opts.sessionId).toBe(sessionId);
  });

  it("sets mode to agent for fix intent", () => {
    const opts = buildStreamOptions("fix", sessionId);
    expect(opts.mode).toBe("agent");
  });

  it("includes the agent system prefix in contextPrefix", () => {
    const opts = buildStreamOptions("generate", sessionId);
    expect(opts.contextPrefix).toContain("@@FILE:");
  });

  it("appends extraPrefix after the system prefix", () => {
    const extra = "Current file: src/App.tsx\n\nconst x = 1;";
    const opts = buildStreamOptions("refine", sessionId, extra);
    expect(opts.contextPrefix).toContain("@@FILE:");
    expect(opts.contextPrefix).toContain(extra);
  });

  it("does not include extraPrefix in contextPrefix when not provided", () => {
    const opts = buildStreamOptions("generate", sessionId);
    // contextPrefix should only be the system prefix
    expect(opts.contextPrefix).toBeDefined();
    // No extra content beyond the system prompt
    const prefix = buildAgentSystemPrefixForTest();
    expect(opts.contextPrefix?.trim()).toBe(prefix.trim());
  });
});

// Local helper to avoid a circular import in the test file
function buildAgentSystemPrefixForTest(): string {
  // Mirrors the logic in streamParser.ts — kept in sync manually.
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
