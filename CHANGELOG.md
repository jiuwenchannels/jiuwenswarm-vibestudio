# Changelog

All notable changes to VibeStudio are documented here.
Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

---

## [0.4.0] — Monaco editor (Stages 2.3 + 2.4)

### Added
- **Monaco editor** (Stages 2.3 + 2.4) — `@monaco-editor/react` lazy-loaded
  on first open, replacing the former Sandpack CodeMirror editor. Ships with
  syntax highlighting for TypeScript, JavaScript, CSS, HTML, JSON, Markdown,
  Python, and Shell; minimap; code folding; light/dark theme sync.
- **Scrollable file tab strip** — `MonacoEditorPanel` renders all project
  files as tabs above the editor; active tab has an underline accent;
  horizontal scroll for projects with many files.
- **Dirty indicator** — Tabs show a small brand-coloured dot (●) while the
  file has unsaved local edits; dot disappears after the 800 ms debounce
  writes the change to the project store, which triggers a preview rebuild.
- **Live preview sync on manual edits** — `updateFile(path, content)` action
  in the project store updates `files`, which causes `OfflinePreview` to
  rebundle automatically; no generation required for small tweaks.
- **Generation-overwrite safety** — If the swarm regenerates a file you were
  editing, the editor imperatively updates its content (via `editor.setValue`)
  with change suppression so the Monaco `onChange` callback is not triggered.
  The dirty dot is cleared to reflect the overwrite.
- **Pending-flush on file switch** — Any debounced edit is immediately written
  to the store before the editor switches to a new file, preventing data loss.

### Removed
- **`@codesandbox/sandpack-react`** — no longer a dependency; 48 packages
  removed, reducing the install footprint by ~12 MB. `SandpackProvider`,
  `SandpackCodeEditor`, `useSandpack`, and `SyncActiveFile` are gone. The
  offline preview (`OfflinePreview`) was always custom and is unchanged.

---

## [0.3.1] — UX polish

### Added
- **Chat persistence** — Chat messages are now stored alongside files in
  `ProjectMeta.messages` (localStorage). Conversations survive page reload just
  like generated files do. Only fully-sent, non-ephemeral messages are stored
  (`isStreaming` messages are excluded). Restored via `loadMessages()` in the
  project store on Studio mount.
- **Changed-file badges** — After each generation the FileTree shows a small
  brand-coloured dot next to every file that was created or modified.
  `changedFiles: Set<string>` is held in the project store; populated from the
  delta list on `done`, cleared at the start of each new generation
  (`snapshotForRewind`).
- **Retry button on error bubbles** — When an assistant message carries
  `isError: true`, a "↺ Retry" link appears below the error text. Clicking it
  re-runs the preceding user message without the user having to retype anything.
  Wired via a new `onRetry` prop on `MessageBubble`.

---

## [0.3.0] — Phase 2 core UX

### Added
- **Template picker** (Stage 2.1) — "Use template" button on Dashboard opens a
  modal with 6 ready-made starters: To-do App, Landing Page, Finance Dashboard,
  Recipe Book, Kanban Board, Chat UI. Selecting a template creates a project and
  auto-sends the generation prompt on Studio mount.
- **Quick-action buttons** (Stage 2.2) — Generate / Fix / Explain / Refactor pill
  buttons below the chat input pre-set the generation intent without typing.
- **Swarm activity** (Stage 2.5) — `SwarmActivity` component inline inside
  ChatPanel: auto-opens when generation starts, auto-collapses to a step-count
  header when done; colour-coded per-agent pills (Architect=purple,
  Frontend=sky, Backend=emerald, Database=amber, QA=rose); reasoning/tool-call
  classification; "Show more/less" for long reasoning text; bounded at 200 entries.
- **Mobile-responsive layout** (Stage 2.10) — Studio detects `< 768 px` and
  replaces the side-by-side layout with a tab bar: **Chat / Preview / Code**.
- **Chat export** (Stage 2.11) — `exportChatMarkdown()` in `lib/export.ts`;
  ↓ Chat toolbar button downloads the conversation as a `.md` file.
- **Reconnect toast** (Stage 2.12) — `ReconnectToast`: fixed banner that appears
  when WebSocket drops and dismisses automatically on reconnect.
- **Resizable panels** — `Resizer.tsx` drag handles on both the chat/preview
  divider and the code-drawer divider; `store/layout.ts` persists `chatWidth`
  (default 420 px, clamped 320–760) and `codeHeight` (default 320 px,
  clamped 200–560) to `localStorage` under `"vs-layout"`.
- **HITL in-chat clarification** — When an agent cannot proceed without more
  context it emits `chat.ask_user_question`; `MessageBubble` renders a distinct
  blue-bordered clarification card with an inline answer input; the answer is
  sent back via `client.sendAnswer()` so the blocked agent resumes generation.
- **7 example prompts** — Counter app (new minimal sanity-check), Kanban board,
  Chat UI, Auth form added alongside existing To-do App, Landing Page, Dashboard.
- **Coverage script** — `npm run coverage` via `@vitest/coverage-v8`.
- **`public/logo.svg`** — brand favicon (chat bubble + code brackets).
- **80 unit tests** across 7 suites (streamParser, agentMode, export,
  projectStore, session, layout, client).

---

## [0.2.0] — Phase 1 complete

### Added
- **ZIP export** (Stage 1.11) — `downloadProjectZip()` via fflate; ↓ ZIP button
  in Studio toolbar; entirely browser-side, no server required.
- **File persistence** (Stages 1.12 / 1.13) — Generated files stored in
  `ProjectMeta.files` (localStorage) via `persistFiles()`; restored on Studio
  mount via `loadFiles()`.
- **Full rewind cycle** (Stage 1.14) — `RewindEntry {msgId, snapshot}` stack;
  `snapshotForRewind()` captures files before generation; `pushRewindable(msgId)`
  pairs the WorkSwarm message ID with the snapshot; `rewind_done` event
  restores the pre-generation file state.
- **Inline project rename** (Stage 1.15) — Double-click any project card title
  on Dashboard to edit inline; Enter saves, Escape cancels; best-effort server
  sync via `client.renameSession()`.
- **ErrorBoundary** (Stage 1.16) — Class component wrapping `StudioInner`; shows
  an error card with "Try again" and "Reload page" actions.
- **GitHub Actions CI** (Stage 1.17) — `.github/workflows/ci.yml`: typecheck →
  test → build on push to `main` / `dev` and on PRs targeting `main`.
- **Dark / light theme** — CSS custom property tokens (`--vs-*`); Zustand persist
  store (`store/theme.ts`); anti-flash inline script in `index.html`; Sandpack
  mirrors parent theme via `theme` prop.
- **Code toggle (Base44-style)** — Default layout shows chat + preview only;
  `</> Code` button reveals `FileTree` + `SandpackCodeEditor` side panel.
- **`docs/ARCHITECTURE.md`** — Full system design document.
- **`docs/USER_GUIDE.md`** — End-user guide.
- **`docs/ROADMAP.md`** — Phase 2 + Phase 3 stages (Phase 1 removed as complete).

### Changed
- `SandpackPreview` refactored to use individual Sandpack primitives
  (`SandpackProvider`, `SandpackLayout`, `SandpackCodeEditor`,
  `SandpackPreviewPane`) so the editor can be hidden without remounting the
  preview iframe.

### Fixed
- `renameSession` missing from `RpcClient` — added `session.rename` RPC call.

---

## [0.1.0] — Phase 1 initial implementation

### Added
- **Chat panel** — streaming WebSocket chat using `@jiuwenswarm/sdk`;
  user / assistant / status message bubbles.
- **Live preview** — Sandpack rendering generated React + TypeScript files
  in an isolated iframe.
- **File tree** — nested file explorer of all generated files.
- **Dashboard** — project creation, listing, opening, and deletion.
- **Session store** — `store/session.ts` persisting project list and active
  session ID to `localStorage`.
- **Project store** — `store/project.ts` holding in-memory file map,
  generation state, and rewind stack.
- **Stream parser** — `lib/streamParser.ts` extracting `@@FILE:`/`@@END_FILE`
  and `@@DELETE:` blocks from the accumulated agent response.
- **Agent mode selection** — `lib/agentMode.ts`; `inferIntent()` keyword
  heuristic; `pickMode()` mapping to `"team"` or `"agent"` SDK mode.
- **`docs/INSTALLATION.md`** — Full setup guide for Python SDK, TypeScript SDK,
  and VibeStudio.
- **`tests/streamParser.test.ts`** and **`tests/agentMode.test.ts`** — initial
  test suites (22 tests).
