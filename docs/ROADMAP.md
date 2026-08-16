# VibeStudio Roadmap

Each stage is intentionally small-to-medium: the goal is frequent, reviewable milestones rather than large batches.  Stages within a phase may be worked in parallel.

---

## Phase 1 — Core generation loop *(v0.1 — current)*

**[DONE]** Stage 1.1 — Project scaffold
: Vite + React + TypeScript, Tailwind, Vitest, `@jiuwenswarm/sdk` local reference, `.env.example`.

**[DONE]** Stage 1.2 — SDK singleton and connection management
: `src/lib/client.ts` — `getClient()`, `connectClient()`, `disconnectClient()`.

**[DONE]** Stage 1.3 — Stream parser
: `parseGenerationResult()` — extracts `@@FILE:…@@END_FILE` and `@@DELETE:` blocks from token stream.

**[DONE]** Stage 1.4 — Agent mode helpers
: `pickMode()`, `inferIntent()`, `buildStreamOptions()` — selects "team" vs "agent" mode per intent.

**[DONE]** Stage 1.5 — Project and session stores
: Zustand stores for file map, generation state, rewind stack, and session list (persisted).

**[DONE]** Stage 1.6 — Chat UI with live streaming
: `ChatPanel` + `MessageBubble`; streaming tokens, status bubbles, auto-scroll.

**[DONE]** Stage 1.7 — Sandpack in-browser preview
: `SandpackPreview` — live React/TS preview from project file map; generating overlay.

**[DONE]** Stage 1.8 — File tree
: `FileTree` — nested directory view of generated files; click to set active file.

**[DONE]** Stage 1.9 — Dashboard
: Project list, create/delete sessions, starter prompt chips.

**[DONE]** Stage 1.10 — Studio workspace
: Three-column layout (FileTree | Chat | Preview); rewind button; agent status badge.

---

## Phase 1 — Remaining stages

Stage 1.11 — ZIP export
: `src/lib/deploy/export.ts` — `exportProjectZip()` using `jszip`; Download button in Studio toolbar.

Stage 1.12 — Persist generated files in session memory
: After each generation, call `client.exportSession()` and serialize the file map into the session so it survives page reload.

Stage 1.13 — Restore project files on session re-open
: On Studio mount, call `client.getHistory()` to replay the last generation result and rebuild the file map.

Stage 1.14 — Rewind integration (full cycle)
: Wire `client.on("rewind_done")` → `popRewindSnapshot()` → re-render preview with rolled-back file map.

Stage 1.15 — Project rename
: Inline rename input in Dashboard cards; calls `client.renameSession()`.

Stage 1.16 — Error boundary and disconnection recovery
: React Error Boundary around Studio; reconnect toast; resume generation after reconnect.

Stage 1.17 — Vitest CI workflow
: GitHub Actions `.github/workflows/ci.yml` — runs `npm test` and `npm run typecheck` on every PR.

---

## Phase 2 — Full-stack apps and richer editing

Stage 2.1 — Template picker on Dashboard
: "Choose a template" modal with 6 starter templates (landing page, SaaS, dashboard, API-only, blog, portfolio).

Stage 2.2 — Quick-action buttons in Chat
: Pill buttons below the input: "Generate", "Fix", "Explain", "Refactor" — pre-sets intent without typing.

Stage 2.3 — Monaco editor panel (read-only first)
: Lazy-load `@monaco-editor/react`; display active file with syntax highlighting; tab between files.

Stage 2.4 — Monaco editor (editable, sync to store)
: Allow manual edits; debounce store updates; re-render Sandpack on change.

Stage 2.5 — Swarm panel (agent activity sidebar)
: Collapsible right panel; shows per-agent status from `status` stream events; token counter from `metrics` push.

Stage 2.6 — WebContainers preview (Next.js support)
: Integrate `@stackblitz/sdk` WebContainers for projects that have an `api/` directory; toggle between Sandpack and WebContainers.

Stage 2.7 — Asset uploader
: Drag-and-drop image/file upload; base64-encode and pass as `mediaItems` in SDK call; inject reference URL into conversation.

Stage 2.8 — Deployment to Vercel
: OAuth connect-account flow; `src/lib/deploy/static.ts`; "Deploy to Vercel" button in toolbar; show deployment URL.

Stage 2.9 — Deployment to Netlify
: Netlify API equivalent of Stage 2.8.

Stage 2.10 — Mobile-responsive layout
: Collapsible FileTree and Preview panels; bottom-sheet chat on narrow screens.

Stage 2.11 — Session export (conversation as Markdown)
: "Export chat" button; calls `client.exportSession(sessionId, "markdown")`; download `.md` file.

Stage 2.12 — Dark/light theme toggle
: System preference detection; Tailwind `dark:` classes; persisted preference.

---

## Phase 3 — Collaboration and extensibility

Stage 3.1 — VibeStudio server (Node.js/Next.js)
: Minimal backend for OAuth token relay, team workspace management, and future webhook handling.

Stage 3.2 — Shared project URL (read-only view)
: Generate a shareable URL; recipients can view the live project and conversation without editing.

Stage 3.3 — Shared editing (Y.js + Liveblocks)
: Real-time collaboration: shared chat input, presence cursors in the editor, conflict-free file map.

Stage 3.4 — Custom domain deployment
: CNAME management via Vercel API; show custom domain status in Deploy panel.

Stage 3.5 — Project forking
: "Remix this project" button; clones the session (conversation + files) into a new session.

Stage 3.6 — Plugin / tool marketplace
: Users can enable JiuwenSwarm skills (Stripe, Supabase, Resend, etc.) that the agent team uses during generation; skill list pulled from Swarm Skills Hub.

Stage 3.7 — Embeddable preview iframe
: Generate an `<iframe>` embed code for the current preview; suitable for portfolio pages.

Stage 3.8 — Agent feedback loop
: After each generation, allow thumbs up/down and a short note; feed back into skill self-evolution.

Stage 3.9 — Project analytics dashboard
: Per-project token usage, generation count, and deployment history; pulled from gateway `metrics` push and session history.

Stage 3.10 — Internationalization (i18n)
: `react-i18next` setup; initial locales: English and Simplified Chinese.
