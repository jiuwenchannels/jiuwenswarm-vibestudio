# VibeStudio Roadmap

Each stage is intentionally small-to-medium. Stages within a phase may be
worked in parallel where dependencies allow.

**Current version: v0.4.0** — Phase 1 complete. Phase 2 core UX complete
(2.1 templates, 2.2 quick-actions, 2.3+2.4 Monaco editor, 2.5 swarm activity,
2.10 mobile layout, 2.11 chat export, 2.12 reconnect toast). Also shipped:
resizable panels, HITL in-chat clarification cards, chat message persistence,
changed-file badges in FileTree, retry button on error bubbles.
See `CHANGELOG.md` for full details.

---

## Phase 2 — Richer editing and deployment (remaining)

Stage 2.6 — WebContainers preview (Next.js / server-side support)
: Integrate `@stackblitz/sdk` WebContainers for projects that contain an
  `api/` or `server/` directory; auto-detect and toggle between offline
  esbuild (client-only) and WebContainers (full Node.js).

Stage 2.7 — Asset uploader
: Drag-and-drop image/font/file upload into the Chat panel; base64-encode
  and pass as `mediaItems` in the SDK call; inject a reference URL comment
  into the conversation context.

Stage 2.8 — Deployment to Vercel
: OAuth connect-account flow; `src/lib/deploy/vercel.ts`; "Deploy to Vercel"
  button in the Studio toolbar; poll deployment status; show live URL when
  ready.

Stage 2.9 — Deployment to Netlify
: Netlify API equivalent of Stage 2.8; drops build into the Netlify CDN
  directly from the browser ZIP export.

---

## Phase 3 — Collaboration and extensibility

Stage 3.1 — VibeStudio server (Node.js / Next.js)
: Minimal backend for OAuth token relay, team workspace management, and
  future webhook handling.

Stage 3.2 — Shared project URL (read-only view)
: Generate a shareable URL; recipients can view the live project and
  conversation without editing.

Stage 3.3 — Shared editing (Y.js + Liveblocks)
: Real-time collaboration: shared chat input, presence cursors in the
  editor, conflict-free file map via CRDTs.

Stage 3.4 — Custom domain deployment
: CNAME management via Vercel API; show custom domain status in the Deploy
  panel.

Stage 3.5 — Project forking
: "Remix this project" button; clones the session (conversation + files)
  into a new session owned by the current user.

Stage 3.6 — Skill marketplace integration
: Users can enable WorkSwarm skills (Stripe, Supabase, Resend, etc.) from
  within VibeStudio; the agent team uses the selected skills during
  generation; skill list pulled from Swarm Skills Hub.

Stage 3.7 — Embeddable preview iframe
: Generate `<iframe>` embed code for the current preview; suitable for
  portfolio pages and public demos.

Stage 3.8 — Agent feedback loop (thumbs-up / thumbs-down)
: After each generation, allow thumbs-up / thumbs-down and a short note;
  feeds back into skill self-evolution via the WorkSwarm HITL loop.
  Note: HITL clarification mid-generation is already implemented (see above).

Stage 3.9 — Project analytics dashboard
: Per-project token usage, generation count, and deployment history; pulled
  from the gateway `metrics` push and session history API.

Stage 3.10 — Internationalization (i18n)
: `react-i18next` setup; initial locales: English and Simplified Chinese.
