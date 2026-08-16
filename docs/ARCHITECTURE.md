# VibeStudio — Architecture

## Overview

VibeStudio is a browser-based vibe-coding environment. The user describes
what they want to build; JiuwenSwarm's multi-agent team generates the React +
TypeScript source files; Sandpack renders a live in-browser preview —
all without a VibeStudio backend.

```
Browser
┌──────────────────────────────────────────────────────────────┐
│  VibeStudio SPA  (React + Vite)                              │
│                                                              │
│  ┌──────────┐  ┌────────────────┐  ┌────────────────────┐   │
│  │ Chat /   │  │ Stream parser  │  │ Sandpack preview   │   │
│  │ Prompt   │→ │ @@FILE: proto  │→ │ (iframe sandbox)   │   │
│  └──────────┘  └────────────────┘  └────────────────────┘   │
│        │                                                     │
│  @jiuwenswarm/sdk  (WebSocket)                               │
└─────────────────────────┬────────────────────────────────────┘
                          │ ws://localhost:19000/v1/ws
┌─────────────────────────▼────────────────────────────────────┐
│  JiuwenSwarm Server                                          │
│  Agent team (planner → coder → reviewer → …)                 │
└──────────────────────────────────────────────────────────────┘
```

---

## Directory Layout

```
jiuwenswarm-vibestudio/
├── src/
│   ├── App.tsx                    # Router (Dashboard / Studio routes)
│   ├── main.tsx                   # React root, global CSS
│   ├── index.css                  # Tailwind + CSS variable themes
│   ├── config.ts                  # Vite env var wrappers
│   │
│   ├── lib/
│   │   ├── client.ts              # SDK singleton (getClient / connectClient)
│   │   ├── agentMode.ts           # Intent → agent mode selection
│   │   ├── streamParser.ts        # @@FILE: / @@DELETE: extraction
│   │   └── export.ts              # ZIP download (fflate)
│   │
│   ├── store/
│   │   ├── project.ts             # In-memory project state (files, rewind)
│   │   ├── session.ts             # Persisted session list + file snapshots
│   │   └── theme.ts               # Dark/light preference (persisted)
│   │
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatPanel.tsx      # Prompt input + streaming message list
│   │   │   └── MessageBubble.tsx  # User / assistant / status bubbles
│   │   ├── Preview/
│   │   │   └── SandpackPreview.tsx # Live preview (+ optional code editor)
│   │   ├── FileExplorer/
│   │   │   └── FileTree.tsx       # Nested file tree (toggleable)
│   │   └── ErrorBoundary.tsx      # Render-error recovery screen
│   │
│   └── pages/
│       ├── Dashboard.tsx          # Project list, create, rename, delete
│       └── Studio.tsx             # Main workspace (chat + preview)
│
├── tests/                         # Vitest unit tests
├── docs/                          # This documentation
├── examples/                      # Usage examples
└── .github/workflows/ci.yml       # GitHub Actions CI
```

---

## State Management

Three Zustand stores, each with a clear scope:

### `store/session.ts` — persisted to `localStorage`

Tracks every project the user has created.

```
SessionState
├── projects: ProjectMeta[]
│   ├── sessionId    — JiuwenSwarm session ID
│   ├── title        — project name
│   ├── createdAt    — ISO timestamp
│   ├── description  — first prompt (truncated)
│   └── files        — last-known generated file map (survives reload)
└── activeSessionId: string | null
```

Key actions:
- `addProject` / `removeProject` / `renameProject`
- `persistFiles(sessionId, files)` — called after each generation to save files
- `setActive` / `activeProject`

### `store/project.ts` — in-memory only

Holds the working state of the currently open project. Reset when navigating
to a different project.

```
ProjectState
├── files: Record<path, source>    — generated file map
├── activeFile: string | null      — selected in file tree / editor
├── generation: GenerationState
│   ├── isGenerating: boolean
│   ├── activeAgent: string | null — current agent name (from status events)
│   └── streamBuffer: string       — accumulated token text
└── rewindStack: RewindEntry[]
    ├── msgId: string              — JiuwenSwarm message ID
    └── snapshot: Record<path, src>— files before this generation ran
```

Key actions:
- `applyDeltas(deltas)` — merge file changes from the stream parser
- `loadFiles(files)` — restore a full file map (used on session re-open)
- `snapshotForRewind()` — saves current files before a new generation
- `pushRewindable(msgId)` — creates a rewind entry from the pending snapshot
- `popRewindSnapshot()` — pops the latest entry, returns its file snapshot
- `restoreSnapshot(snapshot)` — replaces files with a saved snapshot

### `store/theme.ts` — persisted to `localStorage`

Single `isDark: boolean` flag. Writes the `dark` class to `<html>` on every
change and on rehydration. An anti-flash inline script in `index.html` applies
the class synchronously before React renders to prevent a light flash.

---

## SDK Integration

`src/lib/client.ts` exports a module-level singleton `JiuwenSwarmClient`
configured from `src/config.ts` (reads `VITE_JIUWENSWARM_URL`).

```typescript
// One connect() call is enough; subsequent calls are no-ops.
await connectClient();
const client = getClient();

// All chat goes through streamEvents() — an async generator.
for await (const event of client.streamEvents(prompt, opts)) {
  switch (event.kind) {
    case "delta":  /* accumulate tokens */
    case "status": /* show agent status bubble */
    case "done":   /* parse files, apply deltas */
    case "error":  /* show error message */
  }
}
```

### Agent mode selection (`lib/agentMode.ts`)

`inferIntent(text)` — keyword heuristic returns one of:
`"generate" | "refine" | "explain" | "fix"`

`pickMode(intent)` — maps to SDK agent mode:
- `"generate"` → `"team"` (full multi-agent swarm)
- `"refine" | "explain" | "fix"` → `"agent"` (single agent, faster)

`buildStreamOptions(intent, sessionId)` — returns `StreamEventsOptions`
ready to pass to `client.streamEvents()`.

---

## File Delta Protocol

Agents are instructed (via system prompt) to wrap every generated file in
a sentinel block:

```
@@FILE: src/components/Button.tsx
```tsx
export function Button({ label }) {
  return <button>{label}</button>;
}
```
@@END_FILE
```

To delete a file:
```
@@DELETE: src/old/Legacy.tsx
```

`lib/streamParser.ts` — `parseGenerationResult(text)` — scans the full
accumulated response for these sentinels and returns:

```typescript
{ deltas: FileDelta[], prose: string }
```

`FileDelta` is `{ action: "upsert" | "delete", path: string, content: string }`.

`applyDeltas(deltas)` in the project store merges them into the live file map,
which Sandpack picks up and re-renders.

---

## Rewind Mechanism

Rewind allows the user to roll back to the state before any previous generation.

```
1. User submits prompt
      ↓
   snapshotForRewind()   ← save current files as _pendingSnapshot

2. Generation completes → applyDeltas() updates files

3. Server sends rewindable(msgId)
      ↓
   pushRewindable(msgId) ← create RewindEntry { msgId, snapshot }

4. User clicks ↩ Undo
      ↓
   client.rewind(latest.msgId)

5. Server processes rewind → sends rewind_done
      ↓
   popRewindSnapshot()   ← get saved files
   restoreSnapshot()     ← files = pre-generation state
```

---

## Theme System

Tailwind's `darkMode: "class"` strategy is used. Instead of duplicating
`dark:` variants on every element, a single set of CSS custom properties is
defined in `index.css`:

```css
:root  { --vs-bg: 248 250 252; --vs-surface: 255 255 255; … }  /* light */
.dark  { --vs-bg:   3   7  18; --vs-surface:  17  24  39; … }  /* dark  */
```

Tailwind color tokens (`bg-vs-bg`, `text-vs-text`, etc.) reference these
variables. The `dark` class on `<html>` triggers the switch instantly via CSS
cascade — no React re-render needed.

The Sandpack component uses its built-in `theme="dark"` / `theme="light"` prop
(passed based on `useThemeStore().isDark`) because Sandpack's internal editor
renders inside an iframe and cannot inherit parent CSS variables.

---

## Sandpack Integration

`SandpackPreview` wraps Sandpack's individual primitives rather than the
all-in-one `<Sandpack>` component, so the code editor can be shown or hidden
without remounting the preview:

```tsx
<SandpackProvider files={...} template="react-ts" theme={...}>
  <SandpackLayout>
    {showEditor && <SandpackCodeEditor showLineNumbers showTabs />}
    <SandpackPreviewPane showNavigator={false} />
  </SandpackLayout>
</SandpackProvider>
```

- `showEditor = false` (default): preview pane takes full width.
- `showEditor = true` (Code button active): Sandpack native split.

The live preview pane runs in an isolated iframe. Its background colour and
styling come entirely from the generated app's own CSS — they cannot be
controlled by VibeStudio's theme.

---

## File Persistence

Generated files are stored in two places:

| Location | Lifetime | Purpose |
|---|---|---|
| `store/project.ts` (memory) | Until page reload | Live editing, rewind stack |
| `store/session.ts` (localStorage) | Permanent | Restore files on re-open |

After every successful generation, `ChatPanel` calls
`persistFiles(sessionId, updatedFiles)` which writes the file map into the
matching `ProjectMeta` entry. On `Studio` mount, `loadFiles()` restores them
from localStorage into the project store so the Sandpack preview re-appears
without needing to re-generate.

---

## ZIP Export

`lib/export.ts` — `downloadProjectZip(files, name)`:

1. Converts each file string to `Uint8Array` via `fflate.strToU8`.
2. Calls `fflate.zip()` (async, Web Worker-compatible).
3. Creates a `Blob`, creates an object URL, and programmatically clicks a
   temporary `<a>` element to trigger the browser download.
4. Revokes the object URL immediately after.

No server is involved. The ZIP is generated entirely in the browser.
