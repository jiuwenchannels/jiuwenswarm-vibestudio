/**
 * Dashboard — project list.
 *
 * Allows the user to:
 * - Create a new project (creates a JiuwenSwarm session).
 * - Open an existing project.
 * - Delete a project.
 */
import { useState, useCallback, useRef, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getClient, connectClient } from "../lib/client";
import { useSessionStore } from "../store/session";
import { useProjectStore } from "../store/project";
import { useThemeStore } from "../store/theme";

const STARTER_PROMPTS = [
  "Build a modern to-do app with drag-and-drop, tags, and dark mode",
  "Create a SaaS landing page with pricing, FAQ, and email sign-up",
  "Make a personal finance dashboard with charts and monthly summaries",
  "Build a recipe book app with search, favorites, and shopping list",
];

export function Dashboard(): React.ReactNode {
  const navigate = useNavigate();
  const { projects, addProject, removeProject, renameProject, setActive } = useSessionStore();
  const { resetProject } = useProjectStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();

  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback((sessionId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(sessionId);
    setRenameValue(currentTitle);
    // Focus happens via autoFocus on the input
  }, []);

  const commitRename = useCallback(async (sessionId: string): Promise<void> => {
    const newTitle = renameValue.trim();
    setRenamingId(null);
    if (!newTitle || newTitle === projects.find((p) => p.sessionId === sessionId)?.title) return;
    renameProject(sessionId, newTitle);
    try {
      await connectClient();
      await getClient().renameSession(sessionId, newTitle);
    } catch {
      // Best-effort; local store is already updated.
    }
  }, [renameValue, projects, renameProject]);

  const handleRenameKey = useCallback((e: KeyboardEvent<HTMLInputElement>, sessionId: string): void => {
    if (e.key === "Enter") void commitRename(sessionId);
    if (e.key === "Escape") setRenamingId(null);
  }, [commitRename]);

  const createProject = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();
      const projectTitle = title.trim() || "Untitled project";
      setCreating(true);
      setError(null);
      try {
        await connectClient();
        const client = getClient();
        const session = await client.sessions.create(projectTitle);
        addProject(session);
        setActive(session.id);
        client.sessions.setActive(session.id);
        resetProject();
        navigate(`/studio/${session.id}`);
      } catch (err) {
        setError(`Could not create project: ${String(err)}`);
      } finally {
        setCreating(false);
        setTitle("");
      }
    },
    [title, addProject, setActive, resetProject, navigate],
  );

  const openProject = useCallback(
    (sessionId: string): void => {
      setActive(sessionId);
      getClient().sessions.setActive(sessionId);
      resetProject();
      navigate(`/studio/${sessionId}`);
    },
    [setActive, resetProject, navigate],
  );

  const deleteProject = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        await getClient().sessions.delete(sessionId);
      } catch {
        // Session may already be gone on the server; remove locally regardless.
      }
      removeProject(sessionId);
    },
    [removeProject],
  );

  return (
    <div className="min-h-screen bg-vs-bg text-vs-text flex flex-col">
      {/* Header */}
      <header className="border-b border-vs-border px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vs-text">VibeStudio</h1>
          <p className="text-xs text-vs-muted mt-0.5">Build apps through conversation</p>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="px-3 py-1.5 rounded-lg text-xs border border-vs-border
                     bg-vs-surface hover:bg-vs-raised text-vs-muted hover:text-vs-text
                     transition-colors"
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? "☀ Light" : "☾ Dark"}
        </button>
      </header>

      <main className="flex-1 px-8 py-10 max-w-4xl mx-auto w-full">
        {/* New project form */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">New project</h2>
          <form onSubmit={(e) => { void createProject(e); }} className="flex gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project name (optional)"
              className="flex-1 rounded-xl bg-vs-raised border border-vs-border px-4 py-3
                         text-sm placeholder-vs-muted focus:outline-none focus:border-brand-500"
            />
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white
                         text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </form>

          {error && (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          )}

          {/* Starter prompts */}
          <div className="mt-4 flex flex-wrap gap-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setTitle(prompt.slice(0, 60))}
                className="text-xs px-3 py-1.5 rounded-lg bg-vs-raised hover:bg-vs-border
                           text-vs-muted hover:text-vs-text transition-colors text-left"
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>

        {/* Existing projects */}
        {projects.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Your projects</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {projects.map((project) => (
                <div
                  key={project.sessionId}
                  className="group relative rounded-xl bg-vs-surface border border-vs-border
                             hover:border-vs-border-light p-5 cursor-pointer transition-colors"
                  onClick={() => openProject(project.sessionId)}
                >
                  {renamingId === project.sessionId ? (
                    <input
                      ref={renameInputRef}
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => void commitRename(project.sessionId)}
                      onKeyDown={(e) => handleRenameKey(e, project.sessionId)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full font-medium bg-vs-raised border border-brand-500 rounded px-2 py-0.5
                                 text-sm text-vs-text focus:outline-none"
                    />
                  ) : (
                    <h3
                      className="font-medium text-vs-text truncate cursor-text"
                      title="Double-click to rename"
                      onDoubleClick={(e) => startRename(project.sessionId, project.title, e)}
                    >
                      {project.title}
                    </h3>
                  )}
                  {project.description && (
                    <p className="mt-1 text-xs text-vs-muted line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-vs-faint">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </p>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteProject(project.sessionId);
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-vs-faint
                               opacity-0 group-hover:opacity-100 hover:text-red-500
                               hover:bg-vs-raised transition-all text-xs"
                    title="Delete project"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {projects.length === 0 && (
          <p className="text-vs-faint text-sm text-center mt-12">
            No projects yet. Create one above to get started.
          </p>
        )}
      </main>
    </div>
  );
}
