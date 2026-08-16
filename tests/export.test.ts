/**
 * Tests for src/lib/export.ts
 *
 * Note: downloadProjectZip relies on fflate's async zip() which is harder to
 * unit-test portably; it is covered by integration. We focus on
 * exportChatMarkdown whose output is synchronously deterministic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --------------------------------------------------------------------------
// Browser API stubs (jsdom doesn't provide these)
// --------------------------------------------------------------------------

const revokeObjectURL = vi.fn();
const createObjectURL = vi.fn().mockReturnValue("blob:mock");

Object.defineProperty(globalThis, "URL", {
  value: {
    createObjectURL,
    revokeObjectURL,
  },
  writable: true,
});

// Capture Blob contents so we can inspect generated markdown.
let lastBlobContent = "";

class MockBlob {
  constructor(parts: BlobPart[], _opts?: BlobPropertyBag) {
    lastBlobContent = parts.join("");
  }
}
Object.defineProperty(globalThis, "Blob", { value: MockBlob, writable: true });

// Stub document.createElement for the <a> download trigger.
const clickSpy = vi.fn();
const appendChildSpy = vi.fn();
const removeChildSpy = vi.fn();
vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
  if (tag === "a") {
    const a = { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
    return a;
  }
  return document.createElement(tag);
});
vi.spyOn(document.body, "appendChild").mockImplementation(appendChildSpy);
vi.spyOn(document.body, "removeChild").mockImplementation(removeChildSpy);

// --------------------------------------------------------------------------
// Import after stubs are in place
// --------------------------------------------------------------------------

import { exportChatMarkdown } from "../src/lib/export";

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe("exportChatMarkdown", () => {
  beforeEach(() => {
    lastBlobContent = "";
    clickSpy.mockClear();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it("does nothing when messages array is empty", () => {
    exportChatMarkdown([], "My Project");
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("includes project name as H1 heading", () => {
    exportChatMarkdown([{ role: "user", content: "Hello" }], "My Project");
    expect(lastBlobContent).toMatch(/^# My Project/);
  });

  it("renders user messages with bold 'You:' prefix", () => {
    exportChatMarkdown([{ role: "user", content: "Build me a todo app" }], "P");
    expect(lastBlobContent).toContain("**You:** Build me a todo app");
  });

  it("renders assistant messages with bold 'Agent:' prefix", () => {
    exportChatMarkdown([{ role: "assistant", content: "Sure, here is the code." }], "P");
    expect(lastBlobContent).toContain("**Agent:** Sure, here is the code.");
  });

  it("renders status messages as italic blockquotes", () => {
    exportChatMarkdown([{ role: "status", content: "Planning…" }], "P");
    expect(lastBlobContent).toContain("> _Planning…_");
  });

  it("triggers a browser download (<a>.click)", () => {
    exportChatMarkdown([{ role: "user", content: "hi" }], "Test");
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("uses a sanitised project name in the filename", () => {
    const anchors: { download?: string }[] = [];
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "a") {
        const a = { href: "", download: "", click: clickSpy } as unknown as HTMLAnchorElement;
        anchors.push(a);
        return a;
      }
      return document.createElement(tag);
    });

    exportChatMarkdown([{ role: "user", content: "x" }], "My Cool App!");
    const lastA = anchors[anchors.length - 1];
    // sanitizeFilename strips non-word chars, replaces spaces with dashes
    expect(lastA.download).toBe("My-Cool-App-chat.md");
  });

  it("handles a full conversation round-trip", () => {
    exportChatMarkdown(
      [
        { role: "user", content: "Build a todo app" },
        { role: "status", content: "Planning…" },
        { role: "assistant", content: "Done! Here is your app." },
      ],
      "Todo",
    );
    expect(lastBlobContent).toContain("**You:** Build a todo app");
    expect(lastBlobContent).toContain("> _Planning…_");
    expect(lastBlobContent).toContain("**Agent:** Done! Here is your app.");
  });
});
