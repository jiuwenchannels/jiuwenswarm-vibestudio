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
│   │   └── export.ts              # ZIP download + chat Markdown export (fflate)
│   │
│   ├── store/
│   │   ├── project.ts             # In-memory project state (files, messages, rewind)
│   │   ├── session.ts             # Persisted session list + file snapshots
│   │   └── theme.ts               # Dark/light preference (persisted)
│   │
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatPanel.tsx      # Prompt input + streaming message list + quick-actions
│   │   │   └── MessageBubble.tsx  # User / assistant / status bubbles
│   │   ├── Preview/
│   │   │   └── SandpackPreview.tsx # Live preview (+ optional code editor)
│   │   ├── FileExplorer/
│   │   │   └── FileTree.tsx       # Nested file tree (toggleable)
│   │   ├── Swarm/
│   │   │   └── SwarmActivity.tsx    # Inline collapsible agent activity feed
│   │   ├── TemplateModal.tsx      # Template picker overlay (6 starters)
│   │   ├── ReconnectToast.tsx     # Floating disconnection banner
│   │   └── ErrorBoundary.tsx      # Render-error recovery screen
│   │
│   └── pages/
│       ├── Dashboard.tsx          # Project list, create, rename, delete, templates
│       └── Studio.tsx             # Main workspace (chat + preview + swarm)
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

`lib/export.ts` — `downloadProjectZip(files, name)` and `exportChatMarkdown(messages, name)`:

1. Converts each file string to `Uint8Array` via `fflate.strToU8`.
2. Calls `fflate.zip()` (async, Web Worker-compatible).
3. Creates a `Blob`, creates an object URL, and programmatically clicks a
   temporary `<a>` element to trigger the browser download.
4. Revokes the object URL immediately after.

No server is involved. The ZIP is generated entirely in the browser.

---

## Chat Export (Markdown)

`lib/export.ts` — `exportChatMarkdown(messages, name)`:

1. Iterates over `ChatMessage[]` from the project store.
2. Renders user messages as `**You:** …`, assistant messages as `**Agent:** …`,
   and status messages as `> _…_` blockquotes.
3. Creates a `Blob` with `text/markdown` MIME type and triggers a browser
   download of `<sanitized-name>-chat.md`.

---

## Template Picker

`components/TemplateModal.tsx` — modal overlay shown from the Dashboard.

6 built-in templates (To-do App, Landing Page, Finance Dashboard, Recipe Book,
Kanban Board, Chat UI). Each template carries:
- `title` — used as the session name.
- `prompt` — a detailed generation prompt.

On selection:
1. Creates a new JiuwenSwarm session with `client.sessions.create(title)`.
2. Calls `setInitialPrompt(prompt)` on the project store.
3. Navigates to `/studio/<sessionId>`.
4. `ChatPanel` auto-sends the prompt as the first message once connected.

---

## Swarm Activity

`components/Swarm/SwarmActivity.tsx` — collapsible activity section rendered
inline inside the chat panel, so the work-in-progress lives next to the
conversation it belongs to instead of a separate side window.

- Reads `agentLog: AgentLogEntry[]` from the project store.
- `agentLog` is populated by `appendAgentLog(entry)`, called from `ChatPanel`
  on every `"status"` and `"reasoning"` stream event. Entries carry an
  optional `agent` name and a `kind` classifier (`reasoning` / `status` /
  `tool`).
- Auto-opens when a generation starts and auto-collapses to a compact header
  (with a step count) when generation finishes.
- Long reasoning entries are truncated with a "Show more" toggle.
- Entries show a wall-clock timestamp and are bounded at 200.
- "Clear" button calls `clearAgentLog()`.

---

## Reconnect Toast

`components/ReconnectToast.tsx` — fixed overlay banner that appears when the
WebSocket connection is lost and auto-dismisses when the connection is restored.

Subscribes to `"connected"` / `"disconnected"` events on the `RpcClient`
singleton. Rendered inside `StudioInner` so it is always mounted during a
workspace session.

---

## Mobile Layout

On screens narrower than the Tailwind `md` breakpoint (768 px), Studio hides
the side-by-side flex layout and shows a tab bar instead:

| Tab | Content |
|---|---|
| Chat | Full-height `ChatPanel` (including inline swarm activity) |
| Preview | Full-height `SandpackPreview` |

The desktop layout (hidden on mobile via `hidden md:flex`) continues to use
the side-by-side column layout with an optional FileTree column.
