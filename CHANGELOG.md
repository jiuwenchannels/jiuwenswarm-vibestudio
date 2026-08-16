# Changelog

All notable changes to VibeStudio are documented here.
Follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

---

## [0.3.0] — Phase 2 core UX

### Added
- **Template picker** (Stage 2.1) — "Use template" button on Dashboard opens a modal
  with 6 ready-made starters: To-do App, Landing Page, Finance Dashboard, Recipe Book,
  Kanban Board, Chat UI. Selecting a template creates a project and auto-sends the
  generation prompt on Studio mount.
- **Quick-action buttons** (Stage 2.2) — Generate / Fix / Explain / Refactor pill
  buttons below the chat input pre-set the generation intent without typing.
- **Chat messages in project store** — `messages: ChatMessage[]` moved from local
  `useState` to the project store so Studio can access conversation history.
- **Agent activity log** (Stage 2.5) — `agentLog: AgentLogEntry[]` in the project
  store accumulates every status event from the stream; bounded at 200 entries.
- **Swarm panel** (Stage 2.5) — `SwarmPanel` component: collapsible right-column
  sidebar showing agent statuses with timestamps; auto-scrolls; ⚡ Swarm toggle
  in Studio toolbar; mobile Swarm tab.
- **Mobile-responsive layout** (Stage 2.10) — Studio detects `< 768 px` and
  replaces the side-by-side layout with a tab bar (Chat / Preview / Swarm).
- **Chat export** (Stage 2.11) — `exportChatMarkdown()` in `lib/export.ts`;
  ↓ Chat button in Studio toolbar downloads the conversation as a `.md` file.
- **Reconnect toast** (Stage 2.12) — `ReconnectToast` component: fixed banner
  that appears when WebSocket drops and dismisses automatically on reconnect.
- **`tests/session.test.ts`** — 20 test cases covering all session store actions.
- **`tests/export.test.ts`** — 8 test cases for `exportChatMarkdown`.
- **`tests/projectStore.test.ts`** — 12 test cases for Phase 2 store additions.
- **Coverage script** — `npm run coverage` via `@vitest/coverage-v8`.
- **6 example prompts** — Kanban board, Chat UI, Auth form added alongside existing
  To-do App, Landing Page, Dashboard.
- **`public/logo.svg`** — brand favicon (chat bubble + code brackets).

### Fixed
- Mobile tab state bug: toggling Swarm off while on the "swarm" tab now resets
  to "chat" instead of leaving the user on a blank tab.

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
  pairs the JiuwenSwarm message ID with the snapshot; `rewind_done` event
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
