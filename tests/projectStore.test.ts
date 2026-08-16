/**
 * Tests for the Phase 2 additions to src/store/project.ts:
 *   - addChatMessage / updateLastAssistantMessage / clearChatMessages
 *   - appendAgentStatus / clearAgentLog
 *   - setInitialPrompt
 *   - resetProject clears all Phase 2 state
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useProjectStore } from "../src/store/project";

// Reset store to a clean state before each test.
beforeEach(() => {
  useProjectStore.getState().resetProject();
});

// ---------------------------------------------------------------------------
// Chat messages
// ---------------------------------------------------------------------------

describe("addChatMessage", () => {
  it("appends a message to an initially empty list", () => {
    const { addChatMessage, messages } = useProjectStore.getState();
    expect(messages).toHaveLength(0);

    addChatMessage({ id: "1", role: "user", content: "Hello" });
    expect(useProjectStore.getState().messages).toHaveLength(1);
    expect(useProjectStore.getState().messages[0].content).toBe("Hello");
  });

  it("preserves insertion order for multiple messages", () => {
    const { addChatMessage } = useProjectStore.getState();
    addChatMessage({ id: "a", role: "user", content: "First" });
    addChatMessage({ id: "b", role: "assistant", content: "Second" });
    addChatMessage({ id: "c", role: "user", content: "Third" });

    const msgs = useProjectStore.getState().messages;
    expect(msgs.map((m) => m.content)).toEqual(["First", "Second", "Third"]);
  });
});

describe("updateLastAssistantMessage", () => {
  it("updates the most recent assistant message", () => {
    const { addChatMessage, updateLastAssistantMessage } = useProjectStore.getState();
    addChatMessage({ id: "1", role: "user", content: "Hi" });
    addChatMessage({ id: "2", role: "assistant", content: "", isStreaming: true });

    updateLastAssistantMessage((m) => ({ ...m, content: "Hello!", isStreaming: false }));

    const msgs = useProjectStore.getState().messages;
    expect(msgs[1].content).toBe("Hello!");
    expect(msgs[1].isStreaming).toBe(false);
  });

  it("does not affect user messages before the assistant message", () => {
    const { addChatMessage, updateLastAssistantMessage } = useProjectStore.getState();
    addChatMessage({ id: "u", role: "user", content: "User text" });
    addChatMessage({ id: "a", role: "assistant", content: "Draft" });

    updateLastAssistantMessage((m) => ({ ...m, content: "Final" }));

    const msgs = useProjectStore.getState().messages;
    expect(msgs[0].content).toBe("User text");
    expect(msgs[1].content).toBe("Final");
  });

  it("is a no-op when there are no assistant messages", () => {
    const { addChatMessage, updateLastAssistantMessage } = useProjectStore.getState();
    addChatMessage({ id: "u", role: "user", content: "Hey" });

    // Should not throw.
    updateLastAssistantMessage((m) => ({ ...m, content: "REPLACED" }));

    expect(useProjectStore.getState().messages[0].content).toBe("Hey");
  });
});

describe("clearChatMessages", () => {
  it("empties the messages array", () => {
    const { addChatMessage, clearChatMessages } = useProjectStore.getState();
    addChatMessage({ id: "1", role: "user", content: "text" });
    clearChatMessages();
    expect(useProjectStore.getState().messages).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Agent log
// ---------------------------------------------------------------------------

describe("appendAgentStatus", () => {
  it("adds an entry with status string and a timestamp", () => {
    const before = Date.now();
    useProjectStore.getState().appendAgentStatus("Planning…");
    const after = Date.now();

    const { agentLog } = useProjectStore.getState();
    expect(agentLog).toHaveLength(1);
    expect(agentLog[0].status).toBe("Planning…");
    expect(agentLog[0].time).toBeGreaterThanOrEqual(before);
    expect(agentLog[0].time).toBeLessThanOrEqual(after);
  });

  it("preserves previous entries", () => {
    useProjectStore.getState().appendAgentStatus("Step 1");
    useProjectStore.getState().appendAgentStatus("Step 2");

    const { agentLog } = useProjectStore.getState();
    expect(agentLog).toHaveLength(2);
    expect(agentLog[0].status).toBe("Step 1");
    expect(agentLog[1].status).toBe("Step 2");
  });
});

describe("clearAgentLog", () => {
  it("empties the agentLog array", () => {
    useProjectStore.getState().appendAgentStatus("Active");
    useProjectStore.getState().clearAgentLog();
    expect(useProjectStore.getState().agentLog).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Initial prompt (template picker)
// ---------------------------------------------------------------------------

describe("setInitialPrompt", () => {
  it("stores a prompt string", () => {
    useProjectStore.getState().setInitialPrompt("Build a todo app");
    expect(useProjectStore.getState().initialPrompt).toBe("Build a todo app");
  });

  it("clears the prompt when set to null", () => {
    useProjectStore.getState().setInitialPrompt("Something");
    useProjectStore.getState().setInitialPrompt(null);
    expect(useProjectStore.getState().initialPrompt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resetProject
// ---------------------------------------------------------------------------

describe("resetProject", () => {
  it("clears messages, agentLog, and initialPrompt", () => {
    const store = useProjectStore.getState();
    store.addChatMessage({ id: "m1", role: "user", content: "hi" });
    store.appendAgentStatus("Busy");
    store.setInitialPrompt("Build something");

    useProjectStore.getState().resetProject();

    const s = useProjectStore.getState();
    expect(s.messages).toHaveLength(0);
    expect(s.agentLog).toHaveLength(0);
    expect(s.initialPrompt).toBeNull();
  });
});
