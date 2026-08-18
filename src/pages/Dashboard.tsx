/**
 * Dashboard — project list.
 *
 * Allows the user to:
 * - Resume the most recent project.
 * - Create a new project from a prompt (creates a WorkSwarm session and
 *   immediately starts building).
 * - Open, rename, or delete an existing project.
 */
import { useState, useCallback, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getClient, connectClient } from "../lib/client";
import { useSessionStore } from "../store/session";
import { useProjectStore } from "../store/project";
import { useThemeStore } from "../store/theme";
import { TemplateModal } from "../components/TemplateModal";

/** Derive a short, readable project title from a free-form prompt. */
function deriveTitle(prompt: string): string {
  const clean = prompt
    .trim()
    .replace(/^(build|create|make|generate|write|add|design|give me)\s+/i, "")
    .replace(/\s+/g, " ");
  if (!clean) return "Untitled project";
  const words = clean.split(" ");
  let title = "";
  for (const word of words) {
    const next = title ? `${title} ${word}` : word;
    if (next.length > 24) break;
    title = next;
  }
  title = title || clean.slice(0, 24);
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function Dashboard(): React.ReactNode {
  const navigate = useNavigate();
  const { projects, addProject, removeProject, renameProject, setActive } = useSessionStore();
  const { resetProject, setInitialPrompt } = useProjectStore();
  const { isDark, toggle: toggleTheme } = useThemeStore();

  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Inline rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Delete-confirm state
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmTimerRef = useRef<number | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const startRename = useCallback((sessionId: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(sessionId);
    setRenameValue(currentTitle);
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
   * Create a project and start building. The single field is the prompt; the
   * session title is derived from it (and renamable later).
   */
  const createProject = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();
      const promptText = prompt.trim();
      const name = deriveTitle(promptText);
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
      }
    },
    [prompt, addProject, setActive, resetProject, setInitialPrompt, navigate],
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
    (sessionId: string): void => {
      // Remove locally first (instant UI), then delete on the server
      // best-effort — a slow server should never block the UI.
      removeProject(sessionId);
      getClient().sessions.delete(sessionId).catch(() => {});
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
        deleteProject(sessionId);
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

  // Close the "more" menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const lastProject = projects[0] ?? null;

  return (
    <div className="min-h-screen bg-vs-bg text-vs-text flex flex-col">
      {showTemplates && <TemplateModal onClose={() => setShowTemplates(false)} />}

      {/* Header */}
      <header className="border-b border-vs-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-brand-500/30">
            V
          </span>
          <div>
            <h1 className="text-lg font-bold text-vs-text tracking-tight">VibeStudio</h1>
            <p className="text-xs text-vs-muted mt-0.5">Build apps through conversation</p>
            <p className="text-[10px] text-vs-faint mt-0.5">
              Powered by <span className="text-vs-muted">WorkSwarm</span> · OpenJiuwen
            </p>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="px-2 py-1.5 rounded-lg text-vs-muted hover:text-vs-text hover:bg-vs-raised transition-colors"
            title="Menu"
            aria-label="Menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="12" cy="19" r="1.7" />
            </svg>
          </button>
          {menuOpen && (
            <div
              role="menu"
              onKeyDown={(e) => {
                if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                e.preventDefault();
                const items = Array.from(
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitem']"),
                );
                const idx = items.indexOf(document.activeElement as HTMLButtonElement);
                const next =
                  e.key === "ArrowDown"
                    ? (idx + 1) % items.length
                    : (idx - 1 + items.length) % items.length;
                items[next]?.focus();
              }}
              className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-vs-border bg-vs-surface shadow-lg py-1 z-50"
            >
              <button
                role="menuitem"
                autoFocus
                onClick={() => {
                  toggleTheme();
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-vs-text hover:bg-vs-raised transition-colors"
              >
                <span className="text-sm leading-none">{isDark ? "☀" : "☾"}</span>
                {isDark ? "Light mode" : "Dark mode"}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 px-8 py-10 max-w-4xl mx-auto w-full">
        {/* Continue where you left off */}
        {lastProject && (
          <section className="mb-8">
            <button
              onClick={() => openProject(lastProject.sessionId)}
              className="w-full flex items-center justify-between gap-4 rounded-xl bg-vs-surface border border-vs-border hover:border-brand-500/40 px-5 py-4 text-left transition-colors"
            >
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-vs-muted mb-0.5">
                  Continue where you left off
                </p>
                <p className="font-medium text-vs-text truncate">{lastProject.title}</p>
              </div>
              <span className="shrink-0 text-brand-400 font-medium text-sm">Open →</span>
            </button>
          </section>
        )}

        {/* New project form */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-4">Build something new</h2>
          <form onSubmit={(e) => { void createProject(e); }}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              placeholder="Describe what you want to build — the swarm starts immediately. e.g. Build a modern to-do app with drag-and-drop and dark mode"
              className="w-full rounded-xl bg-vs-raised border border-vs-border px-4 py-3
                         text-sm placeholder-vs-muted focus:outline-none focus:border-brand-500 resize-y"
            />
            <div className="flex items-center gap-2 mt-3 justify-end">
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
                           text-sm font-medium disabled:opacity-50 transition-colors shadow-sm shadow-brand-500/30"
              >
                {creating ? "Building…" : "Build it"}
              </button>
            </div>
          </form>

          {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
        </section>

        {/* Existing projects */}
        {projects.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Your projects</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {projects.map((project) => {
                const fileCount = Object.keys(project.files ?? {}).length;
                return (
                  <div
                    key={project.sessionId}
                    role="button"
                    tabIndex={0}
                    onClick={() => openProject(project.sessionId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openProject(project.sessionId);
                      }
                    }}
                    className="group relative rounded-xl bg-vs-surface border border-vs-border
                               hover:border-brand-500/40 p-5 cursor-pointer transition-colors
                               focus-visible:border-brand-500"
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
                    <div className="mt-3 flex items-center gap-2 text-xs text-vs-faint">
                      <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                      {fileCount > 0 && (
                        <span className="text-vs-muted">
                          · {fileCount} file{fileCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>

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
                );
              })}
            </div>
          </section>
        )}

        {projects.length === 0 && (
          <p className="text-vs-faint text-sm text-center mt-12">
            No projects yet — describe an app above to build your first one.
          </p>
        )}
      </main>
    </div>
  );
}
