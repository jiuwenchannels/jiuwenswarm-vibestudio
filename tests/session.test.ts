/**
 * Tests for src/store/session.ts
 *
 * The session store is the persistence layer for the project list.  These
 * tests cover every action and the activeProject() selector.
 *
 * Note: Zustand's `persist` middleware stores to localStorage.  Each test
 * resets both the store state and localStorage to keep tests isolated.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useSessionStore } from "../src/store/session";
import type { SessionInfo } from "../src/lib/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal SessionInfo stub (only id + title are required by addProject). */
function makeSession(id: string, title = "Test Project"): SessionInfo {
  return { id, title } as unknown as SessionInfo;
}

// Reset store to a clean state before each test.
beforeEach(() => {
  // Clear the Zustand store directly.
  useSessionStore.setState({ projects: [], activeSessionId: null });
  // Also clear localStorage so the persist layer doesn't re-hydrate stale data.
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// addProject
// ---------------------------------------------------------------------------

describe("addProject", () => {
  it("adds a project with the session id and title", () => {
    useSessionStore.getState().addProject(makeSession("s1", "My App"));
    const { projects } = useSessionStore.getState();
    expect(projects).toHaveLength(1);
    expect(projects[0].sessionId).toBe("s1");
    expect(projects[0].title).toBe("My App");
  });

  it("stores an optional description", () => {
    useSessionStore.getState().addProject(makeSession("s2"), "Build a to-do app");
    const { projects } = useSessionStore.getState();
    expect(projects[0].description).toBe("Build a to-do app");
  });

  it("falls back to 'Untitled project' when title is absent", () => {
    useSessionStore.getState().addProject({ id: "s3" } as unknown as SessionInfo);
    expect(useSessionStore.getState().projects[0].title).toBe("Untitled project");
  });

  it("prepends new projects (most recent first)", () => {
    useSessionStore.getState().addProject(makeSession("first", "First"));
    useSessionStore.getState().addProject(makeSession("second", "Second"));
    const { projects } = useSessionStore.getState();
    expect(projects[0].sessionId).toBe("second");
    expect(projects[1].sessionId).toBe("first");
  });

  it("records a createdAt ISO timestamp", () => {
    const before = Date.now();
    useSessionStore.getState().addProject(makeSession("s4"));
    const after = Date.now();
    const ts = new Date(useSessionStore.getState().projects[0].createdAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// removeProject
// ---------------------------------------------------------------------------

describe("removeProject", () => {
  it("removes the project with the given sessionId", () => {
    useSessionStore.getState().addProject(makeSession("a"));
    useSessionStore.getState().addProject(makeSession("b"));
    useSessionStore.getState().removeProject("a");
    const { projects } = useSessionStore.getState();
    expect(projects).toHaveLength(1);
    expect(projects[0].sessionId).toBe("b");
  });

  it("clears activeSessionId when the active project is removed", () => {
    useSessionStore.getState().addProject(makeSession("x"));
    useSessionStore.getState().setActive("x");
    useSessionStore.getState().removeProject("x");
    expect(useSessionStore.getState().activeSessionId).toBeNull();
  });

  it("does not change activeSessionId when a different project is removed", () => {
    useSessionStore.getState().addProject(makeSession("keep"));
    useSessionStore.getState().addProject(makeSession("gone"));
    useSessionStore.getState().setActive("keep");
    useSessionStore.getState().removeProject("gone");
    expect(useSessionStore.getState().activeSessionId).toBe("keep");
  });

  it("is a no-op for an unknown sessionId", () => {
    useSessionStore.getState().addProject(makeSession("real"));
    useSessionStore.getState().removeProject("ghost");
    expect(useSessionStore.getState().projects).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// renameProject
// ---------------------------------------------------------------------------

describe("renameProject", () => {
  it("updates the title of the matching project", () => {
    useSessionStore.getState().addProject(makeSession("r1", "Old Name"));
    useSessionStore.getState().renameProject("r1", "New Name");
    expect(useSessionStore.getState().projects[0].title).toBe("New Name");
  });

  it("leaves other projects unchanged", () => {
    useSessionStore.getState().addProject(makeSession("r1", "One"));
    useSessionStore.getState().addProject(makeSession("r2", "Two"));
    useSessionStore.getState().renameProject("r1", "Updated");
    const proj = useSessionStore.getState().projects.find((p) => p.sessionId === "r2");
    expect(proj?.title).toBe("Two");
  });

  it("is a no-op for an unknown sessionId", () => {
    useSessionStore.getState().addProject(makeSession("r3", "Stable"));
    useSessionStore.getState().renameProject("unknown", "Foo");
    expect(useSessionStore.getState().projects[0].title).toBe("Stable");
  });
});

// ---------------------------------------------------------------------------
// persistFiles
// ---------------------------------------------------------------------------

describe("persistFiles", () => {
  it("stores the file map on the matching project", () => {
    useSessionStore.getState().addProject(makeSession("f1"));
    const files = { "src/App.tsx": "export default function App() {}" };
    useSessionStore.getState().persistFiles("f1", files);
    expect(useSessionStore.getState().projects[0].files).toEqual(files);
  });

  it("replaces a previously persisted file map", () => {
    useSessionStore.getState().addProject(makeSession("f2"));
    useSessionStore.getState().persistFiles("f2", { "a.ts": "v1" });
    useSessionStore.getState().persistFiles("f2", { "a.ts": "v2", "b.ts": "new" });
    expect(useSessionStore.getState().projects[0].files).toEqual({ "a.ts": "v2", "b.ts": "new" });
  });

  it("does not affect other projects", () => {
    useSessionStore.getState().addProject(makeSession("f3"));
    useSessionStore.getState().addProject(makeSession("f4"));
    useSessionStore.getState().persistFiles("f4", { "x.ts": "code" });
    const p3 = useSessionStore.getState().projects.find((p) => p.sessionId === "f3");
    expect(p3?.files).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// setActive / activeProject
// ---------------------------------------------------------------------------

describe("setActive", () => {
  it("sets the active session id", () => {
    useSessionStore.getState().addProject(makeSession("act1"));
    useSessionStore.getState().setActive("act1");
    expect(useSessionStore.getState().activeSessionId).toBe("act1");
  });

  it("can be set to null (no active session)", () => {
    useSessionStore.getState().setActive("act1");
    useSessionStore.getState().setActive(null);
    expect(useSessionStore.getState().activeSessionId).toBeNull();
  });
});

describe("activeProject", () => {
  it("returns the matching project", () => {
    useSessionStore.getState().addProject(makeSession("ap1", "Active One"));
    useSessionStore.getState().setActive("ap1");
    const proj = useSessionStore.getState().activeProject();
    expect(proj?.title).toBe("Active One");
  });

  it("returns null when activeSessionId is null", () => {
    useSessionStore.getState().addProject(makeSession("ap2"));
    expect(useSessionStore.getState().activeProject()).toBeNull();
  });

  it("returns null when no project matches the active id", () => {
    useSessionStore.getState().setActive("nonexistent");
    expect(useSessionStore.getState().activeProject()).toBeNull();
  });
});
