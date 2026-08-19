# Requirements Analysis — VibeStudio

---

## Source of Demand

- **Strategic Direction** — New OpenJiuwen Channel / Developer Product Surface
- **Product Requirements** — JiuwenSwarm Platform / Vibe Coding and App Generation

---

## Demand Background

### WHY

#### The problem: every OpenJiuwen channel assumes a developer

Every existing OpenJiuwen channel — the IDE plugin, the JupyterLab extension,
the browser extension — assumes its user can write code, reads a terminal, or
works inside a technical environment. That assumption is a filter, and it
excludes the largest cohort of people who want to build software: product
managers, designers, founders, domain experts, and developers who need a result
in an hour, not a project scaffold.

For these people the current channels are not "harder to use" — they are
unusable. There is no OpenJiuwen surface where describing an app in plain
language produces a running app. They either hire a developer, use a
general-purpose LLM and copy-paste fragments, or give up. Every one of those
outcomes sends the user away from JiuwenSwarm.

#### The market is proven, and the moat is missing

The "vibe coding" pattern — describe a product in plain language, let an agent
generate a working app — is no longer speculative. Base44, Bolt.new, v0, and
Lovable have proven there is a large, paying audience that builds this way.

But every one of those products runs on a general-purpose LLM. None of them has
JiuwenSwarm's distinguishing capabilities: persistent memory across sessions,
multi-agent team coordination, structured tool execution, and a protocol built
for long-running agent tasks. The market leaders are thin frontends over a
model API; the hard part — a coordinated team that remembers the project and
builds a deployable app, not just a pretty screenshot — is unserved. That is the
open seam, and it is exactly the infrastructure JiuwenSwarm already owns.

#### The stakes for JiuwenSwarm: why build it

**The return.** VibeStudio is the lowest-friction entry point JiuwenSwarm has
ever had: a URL, a text box, a generated app. Every person who today cannot use
the IDE plugin becomes a reachable user. And VibeStudio is not a side product —
it is the flagship demonstration of `@jiuwenswarm/sdk`, proving the SDK can
carry a real application end to end, which in turn sells the SDK to the
developers the platform strategy depends on.

**Competitive position and timing.** The vibe-coding window is open now and it
will not stay open. The incumbents are adding features monthly; every month
JiuwenSwarm does not have a browser-native generation surface is a month the
"describe → build → deploy" habit forms around a competitor. The differentiator
— a coordinated agent team with persistent memory — is only a moat if it ships
while the category is still being chosen. Shipping later means competing for
users who already learned someone else's product.

**What winning looks like.** VibeStudio succeeds when it changes who can build,
not when it renders a preview: (a) reach — users outside the developer cohort
complete a generated app; (b) retention — a user returns to iterate on the same
project across days (session continuity working in practice); (c) capability
proof — complex apps (database, auth, multi-agent) generate and run, proving the
team mode, not just single-shot prompts; (d) SDK adoption — VibeStudio drives
real `@jiuwenswarm/sdk` usage, validating the SDK as a product surface. If those
move, VibeStudio paid for itself twice over; if none move, the wall was not the
developer assumption.

#### The user, in one sentence

A non-developer with an idea who types what they want and gets a working,
deployable app from a coordinated JiuwenSwarm agent team — without opening a
terminal, writing a config file, or ever leaving the browser.

---

### WHEN

The TypeScript SDK (`@jiuwenswarm/sdk`) and the JiuwenSwarm team mode are both
available.  The prerequisite infrastructure — sessions, multi-agent coordination,
WebSocket streaming, tool execution — is already in production.  VibeStudio adds
only the product layer on top: the browser frontend, the in-browser preview
runtime, and the deployment pipeline.

Development can begin as soon as the SDK is stable.  Phase 1 (core generation
loop) requires only a working JiuwenSwarm server and the SDK; it does not require
a production hosting environment.

---

### WHAT

VibeStudio is a browser application with five primary capabilities:

---

**Capability 1 — Conversational App Generation**

The user describes what they want to build in natural language.  A JiuwenSwarm
agent team interprets the description, decomposes it into frontend, backend, and
data-layer components, and generates a complete project.  Each subsequent message
refines or extends the current project without requiring the user to re-explain
context — JiuwenSwarm session memory carries the full project history.

Supported output targets:
- Single-page React/TypeScript app (Vite)
- Next.js full-stack app (with API routes)
- Plain HTML/CSS/JS (for simpler use cases or non-developers)

---

**Capability 2 — Live In-Browser Preview**

Every generated version of the app is rendered in a sandboxed iframe immediately
after generation completes.  The user can interact with the running app, identify
issues, and describe corrections in the next message.  No local dev environment
is required; the preview runs entirely in the browser using StackBlitz
WebContainers or a Sandpack runtime.

---

**Capability 3 — Multi-Agent Team Coordination**

Complex apps are built by a coordinated team of specialised JiuwenSwarm agents,
each responsible for one layer of the stack.  The team is orchestrated using
JiuwenSwarm's existing team mode, accessed through `client.send()` with
`mode: "team"` via the SDK.

| Agent | Responsibility |
|---|---|
| Architect | Decomposes requirements; produces a component plan; coordinates other agents |
| Frontend | React / TypeScript / Tailwind components; page layout; routing |
| Backend | API routes (Next.js/Express/FastAPI); auth; middleware |
| Database | Schema design; Prisma ORM or raw SQL; migration scripts |
| QA | Reviews generated code for correctness, type errors, and missing dependencies |

For simple apps (a landing page, a calculator, a to-do list), the Architect agent
handles the full generation without spawning sub-agents.  For complex apps
(multi-tenant SaaS, apps with database and auth), the Architect coordinates the
full team.

---

**Capability 4 — Project Persistence and History**

Each VibeStudio project is backed by a JiuwenSwarm session.  The session stores
the full conversation history, all generated file contents, the current project
state, and all user-supplied assets (images, data files, style tokens).  Users
can close the browser, return the next day, and continue exactly where they left
off.  Multiple projects are represented as multiple sessions, listed in the
VibeStudio project dashboard.

---

**Capability 5 — One-Click Deployment**

When the user is satisfied with their app, they can deploy it with a single click.
VibeStudio supports three deployment targets in the initial release:

- **Static hosting** (Vercel, Netlify, GitHub Pages) — for React/Vite apps with
  no backend
- **Full-stack hosting** (Vercel, Railway, Render) — for Next.js apps with API
  routes and a managed Postgres database
- **Export to ZIP** — download the project as a standard repository for
  self-hosting or further development in an IDE

---

### Requirement Type

☑ **Functionality** (new end-user product; new channel on top of JiuwenSwarm)
☑ **Platform extensibility** (demonstrates `@jiuwenswarm/sdk` in a production app)
☑ **Operation and Maintenance Methods** (project versioning, deployment pipeline)

---

## Needs Assessment

### Requirement Decomposition

| Sub-requirement | Scope |
|---|---|
| Project dashboard (list, create, delete projects) | `vibestudio/src/pages/Dashboard.tsx` |
| Conversation UI (chat interface, message history) | `vibestudio/src/components/Chat/` |
| SDK integration (`JiuwenSwarmClient` init, session management) | `vibestudio/src/lib/client.ts` |
| Agent team mode dispatch (`mode: "team"`, `mode: "agent"`) | `vibestudio/src/lib/agentMode.ts` |
| In-browser preview (Sandpack or WebContainers) | `vibestudio/src/components/Preview/` |
| File explorer (view and edit generated files) | `vibestudio/src/components/FileExplorer/` |
| Monaco Editor integration (optional code view) | `vibestudio/src/components/Editor/` |
| Asset uploader (images, data files, fonts) | `vibestudio/src/components/Assets/` |
| Project state store (current files, assets, settings) | `vibestudio/src/store/project.ts` |
| Auth / user accounts (for multi-project persistence) | `vibestudio/src/lib/auth.ts` |
| Deployment pipeline — static (Vercel/Netlify API) | `vibestudio/src/lib/deploy/static.ts` |
| Deployment pipeline — full-stack (Vercel/Railway API) | `vibestudio/src/lib/deploy/fullstack.ts` |
| Export to ZIP | `vibestudio/src/lib/deploy/export.ts` |
| Project templates (starter apps: SaaS, landing page, …) | `vibestudio/src/templates/` |
| Streaming response rendering (tokens → file diffs) | `vibestudio/src/lib/streamParser.ts` |
| Multi-agent progress panel (which agent is active) | `vibestudio/src/components/SwarmPanel/` |
| Rewind support (undo last generation step) | `vibestudio/src/lib/rewind.ts` via SDK `client.rewind()` |
| Session export (download conversation as Markdown/JSON) | via SDK `client.exportSession()` |
| Collaboration (shared project URL, read-only view) | Phase 3 |
| Mobile-responsive UI | Phase 2 |

---

### Constraints

**SDK as the only transport:**
VibeStudio must not implement its own WebSocket or REST client.  All
communication with JiuwenSwarm goes through `@jiuwenswarm/sdk`.  This is a
design constraint, not just an engineering preference: VibeStudio is the flagship
demonstration of what the SDK enables.

**In-browser execution must be sandboxed:**
User-generated code runs in an iframe with a `sandbox` attribute or inside a
WebContainers runtime that enforces filesystem isolation.  Generated code must
never have access to VibeStudio's own cookies, tokens, or DOM.

**No server-side execution in Phase 1:**
The first release hosts VibeStudio as a static web application; the only
server-side component is the JiuwenSwarm gateway.  The deployment pipeline calls
Vercel/Netlify APIs from the browser.  A VibeStudio server (for collaboration,
webhook handling, and managed deployment) is a Phase 3 addition.

**Project state is server-authoritative:**
The project's source of truth is the JiuwenSwarm session (conversation history +
generated file contents stored in session memory).  The browser holds a derived
UI state.  If the user opens the project in a second tab, both tabs should
eventually converge to the same state via a fresh `getHistory()` call.

**Generated apps must be valid, runnable projects:**
The agent team output is not pseudocode or a code sketch — it is a complete,
syntactically valid project that can be installed (`npm install`) and run
(`npm run dev`) without modification.  The QA agent reviews every generated
artifact before it is presented to the user.

**TypeScript only (VibeStudio itself):**
VibeStudio is built in TypeScript.  Generated apps may be TypeScript or
JavaScript depending on user preference, but the VibeStudio codebase is
TypeScript throughout.

**Deployment credentials are user-supplied:**
VibeStudio does not hold deployment tokens.  Users connect their own Vercel or
Netlify account via OAuth.  Tokens are stored in browser localStorage, encrypted
with a user-specific key, and never sent to the VibeStudio server.

---

### Impact on Existing Systems

**`@jiuwenswarm/sdk`:**
VibeStudio is a consumer of the SDK, not a modifier.  It uses `JiuwenSwarmClient`
with `mode: "team"`, `streamEvents()`, `client.on("metrics")`, `rewind()`, and
`exportSession()`.  If VibeStudio discovers a gap in the SDK API during
development, that gap is addressed in the SDK first, then consumed here.

**JiuwenSwarm gateway:**
No changes required.  VibeStudio connects to the standard WebSocket gateway at
`ws://<host>:19000/v1/ws` and uses the existing session and team protocol.

**JiuwenSwarm team mode:**
The Architect + Frontend + Backend + Database + QA agent team is a new agent team
configuration.  It is defined as a `TeamSpec` and deployed on the JiuwenSwarm
server.  The VibeStudio frontend does not need to know the internal structure of
the team — it sends prompts with `mode: "team"` and receives generated file
contents through the standard streaming protocol.

**Other channels (IDE, JupyterLab, Browser):**
No impact.  A VibeStudio project is a JiuwenSwarm session; the same session can
be opened in the IDE plugin if the user wants to continue working in their editor.
This cross-channel continuity is a feature, not a side effect.

---

### External Dependencies

| Dependency | Purpose | Notes |
|---|---|---|
| `@jiuwenswarm/sdk` | All JiuwenSwarm communication | SDK package; peer to gateway |
| `react` + `react-dom` | UI framework | v18+ with concurrent features |
| `vite` | Build tool and dev server | Fast HMR |
| `typescript` | Language | Strict mode throughout |
| `@codesandbox/sandpack-react` | In-browser code preview and execution | Sandpack by CodeSandbox |
| `monaco-editor` / `@monaco-editor/react` | Optional code editing view | Loaded lazily |
| `zustand` | Client-side project state management | Lightweight, no boilerplate |
| `tailwindcss` | UI styling | JIT mode |
| `jszip` | ZIP export of generated projects | Client-side only |
| Vercel API (`api.vercel.com`) | Static and full-stack deployment | User OAuth token |
| Netlify API (`api.netlify.com`) | Static deployment alternative | User OAuth token |
| `@StackBlitz/sdk` *(Phase 2)* | WebContainers for Node.js backends in-browser | For Next.js preview |
| `yjs` + `liveblocks` *(Phase 3)* | Real-time collaboration | Shared editing cursor, presence |
