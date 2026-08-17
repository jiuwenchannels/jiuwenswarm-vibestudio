/**
 * Dashboard — project list.
 *
 * Allows the user to:
 * - Create a new project (creates a JiuwenSwarm session).
 * - Open an existing project.
 * - Delete a project.
 */
import { useState, useCallback, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getClient, connectClient } from "../lib/client";
import { useSessionStore } from "../store/session";
import { useProjectStore } from "../store/project";
import { useThemeStore } from "../store/theme";
import { TemplateModal } from "../components/TemplateModal";

const STARTER_PROMPTS = [
  "Build a modern to-do app with drag-and-drop, tags, and dark mode",
  "Create a SaaS landing page with pricing, FAQ, and email sign-up",
  "Make a personal finance dashboard with charts and monthly summaries",
  "Build a recipe book app with search, favorites, and shopping list",
];

export function Dashboard(): React.ReactNode {
  const navigate = useNavigate();
  const { projects, addProject, removeProject, renameProject, setActive } = useSessionStore();
  const { resetProject, setInitialPrompt } = useProjectStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();

  const [prompt, setPrompt] = useState("");
  const [projectName, setProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Quick-start + delete-confirm state
  const [quickStarting, setQuickStarting] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmTimerRef = useRef<number | null>(null);

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

  /**
   * Create a project and start building. The main field is a real prompt:
   * whatever the user types is handed to the swarm immediately (ChatPanel
   * auto-sends initialPrompt on mount). The optional name field only controls
   * the session title — it never replaces the prompt.
   */
  const createProject = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();
      const promptText = prompt.trim();
      const name =
        projectName.trim() || promptText.slice(0, 40) || "Untitled project";
      setCreating(true);
      setError(null);
      try {
        await connectClient();
        const client = getClient();
        const session = await client.sessions.create(name);
        addProject(session, promptText.slice(0, 120) || undefined);
        setActive(session.id);
        client.sessions.setActive(session.id);
        resetProject();
        if (promptText) setInitialPrompt(promptText);
        navigate(`/studio/${session.id}`);
      } catch (err) {
        setError(`Could not create project: ${String(err)}`);
      } finally {
        setCreating(false);
        setPrompt("");
        setProjectName("");
      }
    },
    [prompt, projectName, addProject, setActive, resetProject, setInitialPrompt, navigate],
  );

  /**
   * Quick-start: create a project from an idea and immediately hand the full
   * prompt to the swarm (ChatPanel auto-sends initialPrompt on mount).
   */
  const startQuickStart = useCallback(
    async (prompt: string): Promise<void> => {
      setQuickStarting(prompt);
      setError(null);
      try {
        await connectClient();
        const client = getClient();
        const quickTitle = prompt.slice(0, 40);
        const session = await client.sessions.create(quickTitle);
        addProject(session, prompt.slice(0, 120));
        setActive(session.id);
        client.sessions.setActive(session.id);
        resetProject();
        setInitialPrompt(prompt);
        navigate(`/studio/${session.id}`);
      } catch (err) {
        setError(`Could not start project: ${String(err)}`);
      } finally {
        setQuickStarting(null);
      }
    },
    [addProject, setActive, resetProject, setInitialPrompt, navigate],
  );

  const openProject = useCallback(
    (sessionId: string): void => {
      setActive(sessionId);
      setConfirmingId(null);
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

  /**
   * Two-step delete: the first click arms a "Confirm?" state (auto-resets after
   * 3s); the second click actually deletes. Prevents accidental data loss.
   */
  const handleDeleteClick = useCallback(
    (sessionId: string): void => {
      if (confirmingId === sessionId) {
        if (confirmTimerRef.current) window.clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
        setConfirmingId(null);
        void deleteProject(sessionId);
        return;
      }
      setConfirmingId(sessionId);
      if (confirmTimerRef.current) window.clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = window.setTimeout(() => {
        setConfirmingId(null);
        confirmTimerRef.current = null;
      }, 3000);
    },
    [confirmingId, deleteProject],
  );

  // Clear the confirm timer on unmount.
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) window.clearTimeout(confirmTimerRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-vs-bg text-vs-text flex flex-col">
      {showTemplates && <TemplateModal onClose={() => setShowTemplates(false)} />}
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
          <h2 className="text-lg font-semibold mb-4">Build something new</h2>
          <form onSubmit={(e) => { void createProject(e); }} className="flex gap-3 items-start">
            <div className="flex-1 space-y-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                placeholder="Describe what you want to build — the swarm starts immediately. e.g. Build a modern to-do app with drag-and-drop and dark mode"
                className="w-full rounded-xl bg-vs-raised border border-vs-border px-4 py-3
                           text-sm placeholder-vs-muted focus:outline-none focus:border-brand-500 resize-y"
              />
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name (optional)"
                className="w-full rounded-xl bg-vs-raised border border-vs-border px-4 py-2
                           text-sm placeholder-vs-muted focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowTemplates(true)}
                className="px-4 py-2.5 rounded-xl border border-vs-border bg-vs-raised
                           text-sm text-vs-muted hover:text-vs-text hover:bg-vs-border
                           transition-colors whitespace-nowrap"
              >
                Use template
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white
                           text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {creating ? "Creating…" : "Create & build"}
              </button>
            </div>
          </form>

          {error && (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          )}

          {/* Quick-start ideas */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-vs-muted mb-2">
              Or start from a ready-made idea
            </h3>
            <div className="flex flex-wrap gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { void startQuickStart(prompt); }}
                  disabled={quickStarting !== null}
                  className="text-xs px-3 py-1.5 rounded-lg bg-vs-raised hover:bg-vs-border
                             text-vs-muted hover:text-vs-text transition-colors text-left
                             disabled:opacity-50 disabled:cursor-wait"
                >
                  {quickStarting === prompt ? "Starting…" : prompt}
                </button>
              ))}
            </div>
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

                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(project.sessionId, project.title, e);
                      }}
                      className="p-1.5 rounded-lg text-vs-faint opacity-70 group-hover:opacity-100
                                 hover:text-vs-text hover:bg-vs-raised transition-all text-xs"
                      title="Rename project"
                      aria-label={`Rename ${project.title}`}
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(project.sessionId);
                      }}
                      className={`p-1.5 rounded-lg text-xs transition-all ${
                        confirmingId === project.sessionId
                          ? "bg-red-500 text-white hover:bg-red-600 px-2 font-medium"
                          : "text-vs-faint opacity-70 group-hover:opacity-100 hover:text-red-500 hover:bg-vs-raised"
                      }`}
                      title={
                        confirmingId === project.sessionId
                          ? "Click again to confirm deletion"
                          : "Delete project"
                      }
                      aria-label={
                        confirmingId === project.sessionId
                          ? `Confirm deleting ${project.title}`
                          : `Delete ${project.title}`
                      }
                    >
                      {confirmingId === project.sessionId ? "Confirm?" : "✕"}
                    </button>
                  </div>
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
