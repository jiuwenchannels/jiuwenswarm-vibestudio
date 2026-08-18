/**
 * Session store — maps VibeStudio projects to WorkSwarm sessions.
 *
 * One project = one WorkSwarm session.  The session ID is the
 * authoritative project ID used in all SDK calls.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionInfo } from "../lib/client";

/** Minimal message shape stored alongside the project (no ephemeral fields). */
export interface PersistedMessage {
  id: string;
  role: string;
  content: string;
  isError?: boolean;
}

export interface ProjectMeta {
  /** WorkSwarm session ID. */
  sessionId: string;
  /** Human-readable project title. */
  title: string;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** Optional short description (first user prompt, truncated). */
  description?: string;
  /** Last-known generated file map — persisted so files survive page reload. */
  files?: Record<string, string>;
  /** Last-known chat messages — persisted so the conversation survives reload. */
  messages?: PersistedMessage[];
}

interface SessionState {
  /** All known projects (persisted to localStorage). */
  projects: ProjectMeta[];
  /** Currently open project session ID, or null on the dashboard. */
  activeSessionId: string | null;

  // Actions
  addProject: (session: SessionInfo, description?: string) => void;
  removeProject: (sessionId: string) => void;
  renameProject: (sessionId: string, title: string) => void;
  /** Persist the latest generated file map for a project (survives reload). */
  persistFiles: (sessionId: string, files: Record<string, string>) => void;
  /** Persist the chat conversation for a project (survives reload). */
  persistMessages: (sessionId: string, messages: PersistedMessage[]) => void;
  setActive: (sessionId: string | null) => void;
  activeProject: () => ProjectMeta | null;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeSessionId: null,

      addProject: (session, description) =>
        set((s) => ({
          projects: [
            {
              sessionId: session.id,
              title: session.title ?? "Untitled project",
              createdAt: new Date().toISOString(),
              description,
            },
            ...s.projects,
          ],
        })),

      removeProject: (sessionId) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.sessionId !== sessionId),
          activeSessionId:
            s.activeSessionId === sessionId ? null : s.activeSessionId,
        })),

      renameProject: (sessionId, title) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.sessionId === sessionId ? { ...p, title } : p,
          ),
        })),

      persistFiles: (sessionId, files) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.sessionId === sessionId ? { ...p, files } : p,
          ),
        })),

      persistMessages: (sessionId, messages) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.sessionId === sessionId ? { ...p, messages } : p,
          ),
        })),

      setActive: (sessionId) => set({ activeSessionId: sessionId }),

      activeProject: () => {
        const { projects, activeSessionId } = get();
        return projects.find((p) => p.sessionId === activeSessionId) ?? null;
      },
    }),
    { name: "vibestudio-sessions" },
  ),
);
