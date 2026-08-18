/**
 * TemplateModal — template picker overlay shown from the Dashboard.
 *
 * Displays 6 starter templates. Selecting one:
 * 1. Sets initialPrompt in the project store (ChatPanel auto-sends it on mount).
 * 2. Creates a new WorkSwarm session with the template title.
 * 3. Navigates to the Studio workspace.
 *
 * Stage 2.1
 */
import { useEffect, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { getClient, connectClient } from "../lib/client";
import { useSessionStore } from "../store/session";
import { useProjectStore } from "../store/project";

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

interface Template {
  title: string;
  description: string;
  prompt: string;
  icon: string;
}

const TEMPLATES: Template[] = [
  {
    title: "To-do App",
    description: "Tasks with tags, priorities, and drag-and-drop reordering.",
    prompt:
      "Build a modern to-do app with drag-and-drop task reordering, colour-coded priority levels (low / medium / high), tag filtering, and a dark-mode toggle. Use React + TypeScript.",
    icon: "✅",
  },
  {
    title: "Landing Page",
    description: "SaaS landing page with hero, pricing, and email sign-up.",
    prompt:
      "Create a SaaS landing page with a bold hero section, feature grid, tiered pricing cards, an FAQ accordion, and an email sign-up form. Use Tailwind CSS with a modern design.",
    icon: "🚀",
  },
  {
    title: "Finance Dashboard",
    description: "Personal finance tracker with charts and monthly summaries.",
    prompt:
      "Build a personal finance dashboard with income/expense entry, monthly bar charts using Recharts, a running balance, and category breakdowns. Include a dark mode.",
    icon: "📊",
  },
  {
    title: "Recipe Book",
    description: "Search, favourite, and shopping-list features.",
    prompt:
      "Make a recipe book app where users can browse recipes, search by ingredient or title, mark favourites, and generate a shopping list from selected recipes.",
    icon: "🍳",
  },
  {
    title: "Kanban Board",
    description: "Drag-and-drop project board with columns and cards.",
    prompt:
      "Create a Kanban board with To Do / In Progress / Done columns, drag-and-drop cards, inline editing, and card colour labels. Persist state in localStorage.",
    icon: "🗂️",
  },
  {
    title: "Chat UI",
    description: "A polished messaging interface with bubble layout.",
    prompt:
      "Build a polished chat UI with message bubbles (user right, assistant left), a typing indicator, a timestamp on each message, and an emoji picker. Use React + TypeScript.",
    icon: "💬",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  onClose: () => void;
}

export function TemplateModal({ onClose }: Props): ReactNode {
  const navigate = useNavigate();
  const { addProject, setActive } = useSessionStore();
  const { resetProject, setInitialPrompt } = useProjectStore();

  // Close on Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSelect = useCallback(
    async (template: Template): Promise<void> => {
      onClose();
      try {
        await connectClient();
        const client = getClient();
        const session = await client.sessions.create(template.title);
        addProject(session);
        setActive(session.id);
        client.sessions.setActive(session.id);
        resetProject();
        setInitialPrompt(template.prompt);
        navigate(`/studio/${session.id}`);
      } catch (err) {
        console.error("[VibeStudio] Template project creation failed:", err);
      }
    },
    [onClose, addProject, setActive, resetProject, setInitialPrompt, navigate],
  );

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a template"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Panel — stop propagation so clicks inside don't close */}
      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl bg-vs-surface border border-vs-border
                   shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-vs-border">
          <div>
            <h2 className="text-base font-semibold text-vs-text">Choose a template</h2>
            <p className="text-xs text-vs-muted mt-0.5">
              Pick a starter — agents will build it for you instantly.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-vs-faint hover:text-vs-text transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-6">
          {TEMPLATES.map((t) => (
            <button
              key={t.title}
              onClick={() => { void handleSelect(t); }}
              className="text-left p-4 rounded-xl border border-vs-border bg-vs-raised
                         hover:border-brand-500 hover:bg-vs-bg transition-all group"
            >
              <span className="text-2xl mb-2 block">{t.icon}</span>
              <p className="text-sm font-medium text-vs-text group-hover:text-brand-400 transition-colors">
                {t.title}
              </p>
              <p className="text-xs text-vs-muted mt-1 leading-snug">
                {t.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
