# jiuwenswarm-vibestudio

**VibeStudio** — build full-stack web apps through natural language conversation, powered by WorkSwarm.

Describe what you want.  A coordinated team of WorkSwarm agents writes the code.  A live in-browser preview appears immediately.  No terminal, no configuration, no prior coding knowledge required.

---

## What it is

VibeStudio is an OpenJiuwen Channel — a thin client over the WorkSwarm agent runtime.  It uses `@jiuwenswarm/sdk` as its sole communication layer with the WorkSwarm gateway.

The agent side runs on the server:
- **Architect** agent decomposes the request into components
- **Frontend** agent writes React / TypeScript / Tailwind
- **Backend** agent writes API routes when needed
- **Database** agent writes schema and queries
- **QA** agent reviews every output before it reaches the user

The browser side renders:
- A **chat panel** with live streaming token output and quick-action buttons
- A **live preview** — the generated app, bundled offline by the dev server
  (esbuild) so it works without reaching CodeSandbox
- A **Code drawer** — a file explorer and editor side-by-side beneath the
  preview (nothing squeezes the preview sideways); clicking a file opens it
- **Swarm activity inline in the chat** — a collapsible, real-time per-agent
  activity feed that opens while agents work and closes when they finish
- A **template picker** with 6 ready-made starters
- A **reconnect toast** that auto-dismisses when the WebSocket recovers

---

## Quick start

```bash
# 0. Start WorkSwarm (must be running first)
jiuwenswarm-start           # or use the desktop installer

# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env
# set VITE_JIUWENSWARM_URL=ws://localhost:19000/ws  (already the default)

# 3. Start the dev server
npm run dev
# open http://localhost:5174
```

For full prerequisites, remote-server setup, production builds, and
troubleshooting see **[`docs/INSTALLATION.md`](docs/INSTALLATION.md)**.

---

## Architecture

```
Browser (VibeStudio SPA)
├── @jiuwenswarm/sdk         ← sole transport layer to WorkSwarm
│   └── RpcClient            ← WebSocket, sessions, streamEvents, rewind
├── Zustand stores           ← project files, chat messages, agent log, session list
├── Sandpack                 ← in-browser React/TS preview + optional code editor
└── React Router             ← /  (Dashboard)  and  /studio/:sessionId

WorkSwarm server
└── agent team (Architect + Frontend + Backend + Database + QA)
    └── openjiuwen.core runtime (memory, retrieval, tool execution)
```

The session IS the project.  Generated files are persisted to `localStorage` so
closing and re-opening a project restores the last state without re-generating.

---

## Project structure

```
jiuwenswarm-vibestudio/
├── src/
│   ├── config.ts                       # Env var access
│   ├── main.tsx                        # React root
│   ├── App.tsx                         # Router
│   ├── index.css                       # Tailwind + CSS variable themes (light/dark)
│   │
│   ├── lib/
│   │   ├── client.ts                   # RpcClient — WebSocket, sessions, streamEvents, rewind
│   │   ├── streamParser.ts             # @@FILE…@@END_FILE extraction
│   │   ├── agentMode.ts                # Mode selection (team/agent) + intent detection
│   │   └── export.ts                   # ZIP export + Markdown chat export (fflate)
│   │
│   ├── store/
│   │   ├── project.ts                  # Files, chat messages, agent log, rewind stack
│   │   ├── session.ts                  # Project list + file snapshots (localStorage)
│   │   ├── layout.ts                   # Chat width + code drawer height (localStorage)
│   │   └── theme.ts                    # Dark/light preference (localStorage)
│   │
│   ├── components/
│   │   ├── Resizer.tsx                 # Drag handle for resizable panes
│   │   ├── Chat/
│   │   │   ├── ChatPanel.tsx           # Prompt input + streaming messages + quick-actions
│   │   │   └── MessageBubble.tsx       # User / assistant / status bubbles
│   │   ├── Preview/
│   │   │   └── SandpackPreview.tsx     # Live preview + resizable code drawer underneath
│   │   ├── FileExplorer/
│   │   │   └── FileTree.tsx            # Nested file tree (opens files in the editor)
│   │   ├── Swarm/
│   │   │   └── SwarmActivity.tsx       # Inline collapsible agent activity feed (in chat)
│   │   ├── TemplateModal.tsx           # Template picker overlay (6 starters)
│   │   ├── ReconnectToast.tsx          # Floating disconnection banner
│   │   └── ErrorBoundary.tsx           # Render-error recovery screen
│   │
│   └── pages/
│       ├── Dashboard.tsx               # Project list, create, rename, delete, templates
│       └── Studio.tsx                  # Main workspace (chat + preview + drawers, mobile tabs)
│
├── tests/
│   ├── setup.ts                        # Vitest + jest-dom bootstrap
│   ├── streamParser.test.ts            # @@FILE extraction, @@DELETE, whitespace
│   ├── agentMode.test.ts               # Intent detection, mode selection, stream options
│   ├── projectStore.test.ts            # Chat messages, agent log, rewind, reset
│   ├── export.test.ts                  # Markdown export, filename sanitisation, download trigger
│   └── session.test.ts                 # Session CRUD, file persistence, active project
│
├── docs/
│   ├── INSTALLATION.md                 # Full setup guide
│   ├── ARCHITECTURE.md                 # System design, state management, protocols
│   ├── USER_GUIDE.md                   # End-user guide (templates, panels, mobile, export)
│   └── ROADMAP.md                      # Remaining Phase 2 + Phase 3 stages
│
└── examples/
    └── prompts/
        ├── counter-app.md              # Minimal counter — the simplest possible app
        ├── todo-app.md                 # To-do app with priorities, tags, dark mode
        ├── landing-page.md             # SaaS landing page
        ├── dashboard.md                # Analytics dashboard with charts
        ├── kanban-board.md             # Drag-and-drop Kanban board
        ├── chat-ui.md                  # Polished chat interface
        └── auth-form.md                # Login / sign-up form with validation
```

---

## How agent output works

WorkSwarm agents embed generated files inside the token stream using sentinel markers:

```
@@FILE: src/components/Button.tsx
```tsx
export function Button({ label }: { label: string }) {
  return <button>{label}</button>;
}
```
@@END_FILE
```

`src/lib/streamParser.ts` extracts these blocks when the stream completes and
applies them as file deltas to the project store.  Deletions use `@@DELETE: path`.

The system prompt prefix (`buildAgentSystemPrefix()`) instructs the agent to
follow this convention.

---

## Agent mode selection

| Intent | Mode | When |
|---|---|---|
| `generate` | `"team"` | Building a new app or major feature |
| `refine` | `"agent"` | Targeted change to an existing file |
| `explain` | `"agent"` | Question about the codebase |
| `fix` | `"agent"` | Bug fix or error correction |

`inferIntent()` applies a simple heuristic to the user's message text.
Users can also override with quick-action buttons (**Generate / Fix / Explain / Refactor**).

---

## Development

```bash
npm run dev        # Start Vite dev server on :5174
npm test           # Run Vitest unit tests (42 tests across 5 suites)
npm run coverage   # Run tests with V8 coverage report
npm run typecheck  # TypeScript check (no emit)
npm run build      # Production build to dist/
```

---

## Roadmap

Full roadmap: [`docs/ROADMAP.md`](docs/ROADMAP.md)

**Phase 1** (complete) — core generation loop: chat, streaming, Sandpack preview,
file tree, dashboard, ZIP export, session restore, rewind, CI.

**Phase 2** (in progress) — richer editing and deployment:
- Done: templates, quick-actions, inline swarm activity, mobile layout, chat export, reconnect toast
- Remaining: Monaco editor (read-only + editable), WebContainers, Vercel/Netlify deploy, asset uploader

**Phase 3** — collaboration and extensibility: real-time shared editing,
VibeStudio server, plugin marketplace, project forking.

---

## Design references

- Requirements: [`docs/rat_sig/RAT.md`](docs/rat_sig/RAT.md) → full doc in `docs-michael/vibestudio/vibestudio-RAT.md`
- Architecture: [`docs/rat_sig/SIG.md`](docs/rat_sig/SIG.md) → full doc in `docs-michael/vibestudio/vibestudio-SIG.md`
- SDK: [`../jiuwenswarm-sdk/packages/sdk/README.md`](../jiuwenswarm-sdk/packages/sdk/README.md)
