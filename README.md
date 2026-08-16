# jiuwenswarm-vibestudio

**VibeStudio** — build full-stack web apps through natural language conversation, powered by JiuwenSwarm.

Describe what you want.  A coordinated team of JiuwenSwarm agents writes the code.  A live in-browser preview appears immediately.  No terminal, no configuration, no prior coding knowledge required.

---

## What it is

VibeStudio is an OpenJiuwen Channel — a thin client over the JiuwenSwarm agent runtime.  It uses `@jiuwenswarm/sdk` as its sole communication layer with the JiuwenSwarm gateway.

The agent side runs on the server:
- **Architect** agent decomposes the request into components
- **Frontend** agent writes React / TypeScript / Tailwind
- **Backend** agent writes API routes when needed
- **Database** agent writes schema and queries
- **QA** agent reviews every output before it reaches the user

The browser side renders:
- A **chat panel** with live streaming token output
- A **Sandpack preview** — the generated app running live in the browser
- A **file tree** of all generated files

---

## Quick start

```bash
# 0. Start JiuwenSwarm (must be running first)
jiuwenswarm-start           # or use the desktop installer

# 1. Install dependencies
npm install

# 2. Copy and fill in environment variables
cp .env.example .env
# set VITE_JIUWENSWARM_URL=ws://localhost:19000/v1/ws  (already the default)

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
├── @jiuwenswarm/sdk         ← sole transport layer to JiuwenSwarm
│   └── JiuwenSwarmClient   ← WebSocket, sessions, streamEvents, rewind
├── Zustand stores           ← project files, generation state, session list
├── Sandpack                 ← in-browser React/TS preview
└── React Router             ← /dashboard  and  /studio/:sessionId

JiuwenSwarm server
└── agent team (Architect + Frontend + Backend + Database + QA)
    └── openjiuwen.core runtime (memory, retrieval, tool execution)
```

The session IS the project.  Files, conversation history, and project state are
all stored in the JiuwenSwarm session.  Closing the browser and returning later
will continue exactly where you left off (once session restore is implemented —
see Roadmap Stage 1.13).

---

## Project structure

```
jiuwenswarm-vibestudio/
├── src/
│   ├── config.ts                  # Env var access
│   ├── main.tsx                   # React root
│   ├── App.tsx                    # Router
│   ├── index.css                  # Tailwind imports
│   ├── lib/
│   │   ├── client.ts              # Singleton JiuwenSwarmClient
│   │   ├── streamParser.ts        # @@FILE…@@END_FILE extraction
│   │   └── agentMode.ts           # Mode selection (team/agent) + intent detection
│   ├── store/
│   │   ├── project.ts             # Files, generation state, rewind stack
│   │   └── session.ts             # Project list (persisted to localStorage)
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatPanel.tsx      # Full streaming chat interface
│   │   │   └── MessageBubble.tsx  # Message rendering
│   │   ├── Preview/
│   │   │   └── SandpackPreview.tsx # Live in-browser preview
│   │   └── FileExplorer/
│   │       └── FileTree.tsx       # Generated file tree
│   └── pages/
│       ├── Dashboard.tsx          # Project list + creation
│       └── Studio.tsx             # Main workspace
├── tests/
│   ├── setup.ts
│   ├── streamParser.test.ts
│   └── agentMode.test.ts
├── docs/
│   ├── ROADMAP.md
│   └── rat_sig/
│       ├── RAT.md                 # Requirements analysis (reference)
│       └── SIG.md                 # System investigation (reference)
└── examples/
    └── prompts/
        ├── todo-app.md
        ├── landing-page.md
        └── dashboard.md
```

---

## How agent output works

JiuwenSwarm agents embed generated files inside the token stream using sentinel markers:

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
Users can also override the intent with quick-action buttons (Phase 2).

---

## Development

```bash
npm run dev       # Start Vite dev server on :5174
npm test          # Run Vitest unit tests
npm run typecheck # TypeScript check (src/ only)
npm run build     # Production build to dist/
```

---

## Roadmap

Full roadmap with 30 small-to-medium stages across three phases:
[`docs/ROADMAP.md`](docs/ROADMAP.md)

**Phase 1** (current) — core generation loop: chat, streaming, Sandpack preview,
file tree, dashboard, ZIP export, session restore, rewind, CI.

**Phase 2** — full-stack apps: templates, Monaco editor, swarm panel,
WebContainers, deployment (Vercel/Netlify), asset uploader, mobile layout.

**Phase 3** — collaboration and extensibility: real-time shared editing,
VibeStudio server, plugin marketplace, project forking.

---

## Design references

- Requirements: [`docs/rat_sig/RAT.md`](docs/rat_sig/RAT.md) → full doc in `docs-michael/vibestudio/vibestudio-RAT.md`
- Architecture: [`docs/rat_sig/SIG.md`](docs/rat_sig/SIG.md) → full doc in `docs-michael/vibestudio/vibestudio-SIG.md`
- SDK: [`../jiuwenswarm-sdk/packages/sdk/README.md`](../jiuwenswarm-sdk/packages/sdk/README.md)
