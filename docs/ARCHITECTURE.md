# VibeStudio — Architecture

## Overview

VibeStudio is a browser-based vibe-coding environment. The user describes
what they want to build; JiuwenSwarm's multi-agent team generates the React +
TypeScript source files; an offline esbuild bundler renders a live preview in
an iframe — all without a VibeStudio backend.

```
Browser
┌──────────────────────────────────────────────────────────────┐
│  VibeStudio SPA  (React + Vite)                              │
│                                                              │
│  ┌──────────┐  ┌────────────────┐  ┌────────────────────┐   │
│  │ Chat /   │  │ Stream parser  │  │ Offline preview    │   │
│  │ Prompt   │→ │ @@FILE: proto  │→ │ (esbuild → iframe) │   │
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
│   │   │   └── SandpackPreview.tsx # Live preview shell (OfflinePreview + MonacoEditorPanel)
│   │   ├── Editor/
│   │   │   └── MonacoEditorPanel.tsx # Lazy Monaco editor: tabs, dirty indicator, store sync
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
│   ├── files        — last-known generated file map (survives reload)
│   └── messages     — last-known chat messages (PersistedMessage[], survives reload)
└── activeSessionId: string | null
```

Key actions:
- `addProject` / `removeProject` / `renameProject`
- `persistFiles(sessionId, files)` — called after each generation to save files
- `persistMessages(sessionId, messages)` — called after each generation to save chat
- `setActive` / `activeProject`

### `store/project.ts` — in-memory only

Holds the working state of the currently open project. Reset when navigating
to a different project.

```
ProjectState
├── files: Record<path, source>    — generated file map
├── activeFile: string | null      — selected in file tree / editor
├── changedFiles: Set<string>      — paths modified in last generation (dot badge)
├── messages: ChatMessage[]        — chat conversation
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
- `updateFile(path, content)` — apply a single manual edit (does not touch `changedFiles`)
- `loadFiles(files)` — restore a full file map (used on session re-open)
- `loadMessages(messages)` — restore chat messages (used on session re-open)
- `setChangedFiles(paths)` — mark files as changed by the last generation
- `snapshotForRewind()` — saves current files before a new generation; clears `changedFiles`
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

`applyDeltas(deltas)` in the project store merges them into the live file map.
`SandpackPreview.buildSetup()` recomputes via `useMemo`, `OfflinePreview`'s
`useEffect` fires, and the offline bundler re-bundles and re-renders the preview.

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

The Monaco editor uses its built-in `theme="vs-dark"` / `theme="light"` prop
(passed based on `useThemeStore().isDark`) because Monaco renders on a canvas
and cannot inherit CSS variables directly.

---

## Monaco Editor (Stages 2.3 + 2.4)

`components/Editor/MonacoEditorPanel.tsx` — lazy-loaded via `React.lazy` so
the ~4 MB Monaco bundle is only fetched when the code drawer is first opened.

### Architecture

```
MonacoEditorPanel
├── Tab strip (scrollable)         — one tab per user file, dirty dot (●)
├── Monaco Editor (lazy)           — full syntax highlighting, minimap, folding
│   ├── key={activeSlash}          — remounts when active file switches
│   ├── defaultValue={storeContent}— initial content from project store
│   ├── onChange (debounced 800ms) — writes to project store → preview rebuilds
│   └── onMount                   — captures editor instance ref
└── FileTree toggle                — collapsible file tree beside the editor
```

### Edit → Preview loop

```
User types in Monaco
      ↓ (800 ms debounce)
updateFile(path, content)  →  files in project store updates
      ↓
SandpackPreview.buildSetup(files) recomputes (useMemo)
      ↓
OfflinePreview useEffect fires  →  POST /api/preview  →  iframe refreshes
```

### Generation overwrite safety

When the swarm regenerates a file the user was editing:

```
applyDeltas() → files[path] changes in store
      ↓
MonacoEditorPanel useEffect: storeContent !== prevStoreContentRef
      ↓
suppressChangeRef.current = true
editor.setValue(newContent)           ← editor updates
suppressChangeRef.current = false     ← onChange will be suppressed
dirty dot cleared for this file
```

### Pending-flush on file switch

The `useEffect(() => { return () => { flush() }; }, [activeFile])` cleanup
runs when `activeFile` changes: it clears the debounce timer and immediately
calls `updateFile` with the latest typed value, so no edits are lost when
switching files.

### Language detection

File extension → Monaco language id:
`ts/tsx → typescript`, `js/jsx → javascript`, `css/scss/less → css`,
`html/htm → html`, `json → json`, `md → markdown`, `py → python`, `sh → shell`.

---

## File Persistence

Generated files are stored in two places:

| Location | Lifetime | Purpose |
|---|---|---|
| `store/project.ts` (memory) | Until page reload | Live editing, rewind stack |
| `store/session.ts` (localStorage) | Permanent | Restore files on re-open |

After every successful generation, `ChatPanel` calls:
- `persistFiles(sessionId, updatedFiles)` — writes the file map into the matching `ProjectMeta`.
- `persistMessages(sessionId, finalMsgs)` — writes the completed chat messages.

On `Studio` mount, `loadFiles()` and `loadMessages()` restore both from
localStorage so the preview and conversation both re-appear without
re-generating.

Manual edits via Monaco are written immediately to the in-memory store (via
`updateFile`) and trigger a preview rebuild, but are NOT separately persisted
to localStorage — they become part of `files` which IS persisted on the next
generation.

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

## HITL — In-Chat Clarification

When a JiuwenSwarm agent cannot proceed without more information it emits a
`chat.ask_user_question` event.  `RpcClient` surfaces this as an `"ask_user"`
EventEmitter event; `ChatPanel` catches it and calls `addChatMessage` with a
message whose `question` field is set:

```ts
interface HitlQuestion {
  requestId: string;   // UUID from the server — passed back in the answer
  text: string;        // The question text shown to the user
}
```

`MessageBubble` inspects the `question` field and renders a distinct
**clarification card** instead of a normal bubble:

- Blue-bordered card with a "The swarm needs clarification" header pill.
- The agent's question text.
- An inline `<input>` and **Reply** button (Enter key also submits).
- After the user types an answer and presses Reply, `onAnswer(requestId, text)`
  is called, which routes to `getClient().sendAnswer(requestId, { answer: text })`.
- The button shows "Sending…" and disables while the RPC call is in flight.
- A `sendingRef` guard prevents double-sends on rapid clicks.

On the server side the blocked agent receives the answer and continues
generation.  The rest of the stream (further deltas, file blocks) then arrives
as normal.

---

## Workspace Layout

### Desktop (≥ md)

The preview is the hero surface. `Studio` renders, in order:

1. The **chat column** at a persisted pixel width (`store/layout.ts`,
   default 420 px) containing `ChatPanel`.
2. A `Resizer` drag handle (pointer-based) that updates `chatWidth`,
   clamped to `[320, 760]`.
3. The **preview column** (`flex-1`) containing `SandpackPreview`. The live
   preview is bundled offline by the dev server (`POST /api/preview` → esbuild)
   and rendered in an iframe. When the code drawer is open, it is a vertical
   split: the live preview on top and a resizable `MonacoEditorPanel` drawer
   beneath it. The drawer height is persisted (`codeHeight`, clamped to
   `[200, 560]`) and adjusted via a second `Resizer`.

Clicking a file in `FileTree` or a tab in `MonacoEditorPanel` calls
`setActiveFile`; Monaco remounts with the new file's content (keyed on
`activeSlash`).

Sizes persist via the `"vs-layout"` localStorage key (`store/layout.ts`).

### Mobile (< md)

`Studio` hides the side-by-side flex layout and shows a tab bar instead:

| Tab | Content |
|---|---|
| Chat | Full-height `ChatPanel` (including inline swarm activity) |
| Preview | Full-height `SandpackPreview` |
| Code | `SandpackPreview` with `hidePreview` — full-height `MonacoEditorPanel` |
