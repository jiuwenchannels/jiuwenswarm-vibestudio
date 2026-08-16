import { describe, it, expect } from "vitest";
import {
  parseGenerationResult,
  buildAgentSystemPrefix,
  type FileDelta,
} from "../src/lib/streamParser";

describe("parseGenerationResult", () => {
  it("returns empty deltas and trimmed prose for plain text", () => {
    const result = parseGenerationResult("Hello! I will build your app now.");
    expect(result.deltas).toHaveLength(0);
    expect(result.prose).toBe("Hello! I will build your app now.");
  });

  it("extracts a single file block", () => {
    const raw = `Here is the Button component:

@@FILE: src/components/Button.tsx
\`\`\`tsx
export function Button({ label }: { label: string }) {
  return <button>{label}</button>;
}
\`\`\`
@@END_FILE

That's it!`;

    const result = parseGenerationResult(raw);

    expect(result.deltas).toHaveLength(1);
    expect(result.deltas[0].path).toBe("src/components/Button.tsx");
    expect(result.deltas[0].action).toBe("create");
    expect(result.deltas[0].content).toContain("export function Button");
    expect(result.prose).toContain("That's it!");
    expect(result.prose).not.toContain("@@FILE:");
  });

  it("extracts multiple file blocks", () => {
    const raw = `
@@FILE: src/App.tsx
\`\`\`tsx
export default function App() { return <div>Hello</div>; }
\`\`\`
@@END_FILE
@@FILE: src/main.tsx
\`\`\`tsx
import App from "./App";
\`\`\`
@@END_FILE
Done.
    `.trim();

    const result = parseGenerationResult(raw);
    expect(result.deltas).toHaveLength(2);

    const paths = result.deltas.map((d: FileDelta) => d.path);
    expect(paths).toContain("src/App.tsx");
    expect(paths).toContain("src/main.tsx");
    expect(result.prose).toBe("Done.");
  });

  it("handles @@DELETE directives", () => {
    const raw = `Removing unused file.\n@@DELETE: src/old.ts\nDone.`;
    const result = parseGenerationResult(raw);

    expect(result.deltas).toHaveLength(1);
    expect(result.deltas[0].path).toBe("src/old.ts");
    expect(result.deltas[0].action).toBe("delete");
    expect(result.deltas[0].content).toBe("");
    expect(result.prose).toContain("Removing unused file.");
  });

  it("trims whitespace from extracted file paths", () => {
    const raw = `@@FILE:  src/index.ts  \n\`\`\`ts\nexport {};\n\`\`\`\n@@END_FILE`;
    const result = parseGenerationResult(raw);
    expect(result.deltas[0].path).toBe("src/index.ts");
  });

  it("returns trimmed prose when input is only file blocks", () => {
    const raw = `@@FILE: a.ts\n\`\`\`ts\n// a\n\`\`\`\n@@END_FILE`;
    const result = parseGenerationResult(raw);
    expect(result.prose).toBe("");
  });

  it("preserves file content with code fences inside", () => {
    const raw =
      "@@FILE: README.md\n```md\n# Title\n\nSome `code`.\n```\n@@END_FILE";
    const result = parseGenerationResult(raw);
    expect(result.deltas[0].content).toContain("# Title");
    expect(result.deltas[0].content).toContain("Some `code`.");
  });
});

describe("buildAgentSystemPrefix", () => {
  it("mentions the @@FILE sentinel", () => {
    expect(buildAgentSystemPrefix()).toContain("@@FILE:");
  });

  it("mentions the @@END_FILE sentinel", () => {
    expect(buildAgentSystemPrefix()).toContain("@@END_FILE");
  });

  it("mentions @@DELETE", () => {
    expect(buildAgentSystemPrefix()).toContain("@@DELETE:");
  });
});
