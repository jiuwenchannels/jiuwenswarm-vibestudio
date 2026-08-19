# System Investigation — VibeStudio

**Requirements reference:** `vibestudio-RAT.md`

---

## Architecture Overview

VibeStudio is a browser-based application.  It has no application server of its
own in Phase 1 — the only backend is the JiuwenSwarm gateway, which VibeStudio
reaches exclusively through `@jiuwenswarm/sdk`.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         User's Browser                                       │
│                                                                              │
│  VibeStudio SPA (React + TypeScript + Vite)                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Chat UI     │  │  Preview     │  │  File        │  │  Deploy      │     │
│  │  (messages,  │  │  (Sandpack   │  │  Explorer    │  │  Panel       │     │
│  │   streaming) │  │   iframe)    │  │  + Editor    │  │  (Vercel /   │     │
│  └──────┬───────┘  └──────────────┘  └──────────────┘  │   Netlify)   │     │
│         │                                               └──────────────┘     │
│         │  @jiuwenswarm/sdk                                                  │
│  ┌──────▼───────────────────────────────────────────────────────────────┐    │
│  │  JiuwenSwarmClient  (WebSocket, session management, streamEvents)    │    │
│  └──────────────────────────────────────┬─────────────────────────────-┘    │
└─────────────────────────────────────────┼────────────────────────────────────┘
                                          │  ws://host:19000/v1/ws
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         JiuwenSwarm Server                                   │
│                                                                              │
│  openjiuwen.gateway  (WebSocket router)                                      │
│         │                                                                    │
│         ▼                                                                    │
│  openjiuwen.agent_teams  — VibeStudio team                                   │
│  ┌────────────┐ ┌──────────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Architect  │ │  Frontend    │ │  Backend  │ │ Database │ │   QA     │   │
│  │  (coord.)  │ │   Agent      │ │   Agent   │ │  Agent   │ │  Agent   │   │
│  └────────────┘ └──────────────┘ └───────────┘ └──────────┘ └──────────┘   │
│                                                                              │
│  openjiuwen.core  (Runner, DeepAgent, memory, retrieval, tool execution)     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Design Principles

1. **SDK is the only wire.**  VibeStudio calls no JiuwenSwarm API directly.
   Every session, message, stream, rewind, and export goes through
   `JiuwenSwarmClient` from `@jiuwenswarm/sdk`.  This constraint keeps the
   product honest: if the SDK does not support something, the SDK is extended
   first.

2. **The session is the project.**  A VibeStudio project is a JiuwenSwarm
   session.  Files, assets, and conversation history are all stored in session
   memory on the server.  The browser holds only a derived render state.

3. **Stream first, parse second.**  Agent output arrives as a token stream.
   The UI renders tokens as they arrive.  A post-stream parser extracts file
   deltas and applies them to the project store when the `done` event fires.

4. **Preview immediately.**  Every completed generation cycle produces a
   rendered preview, not just a code listing.  The user evaluates the app by
   using it, not by reading it.

5. **The team is transparent.**  The swarm panel shows which agent is active and
   what it is doing.  Users understand that multiple agents are collaborating;
   they do not experience the team as a black box.

6. **No lock-in.**  The user can export the project as a standard `npm` package
   at any time.  Nothing about the generated code is specific to VibeStudio or
   JiuwenSwarm.

---

## Directory Layout

```
jiuwenswarm-vibestudio/
├── package.json             # name: jiuwenswarm-vibestudio
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── index.html
└── src/
    ├── main.tsx             # React root; initialises client from config
    ├── App.tsx              # Router: /dashboard, /project/:sessionId
    ├── config.ts            # VITE_JIUWENSWARM_URL, VITE_AUTH_TOKEN
    │
    ├── lib/
    │   ├── client.ts        # Singleton JiuwenSwarmClient; initialise on app mount
    │   ├── agentMode.ts     # Helpers: pickMode(complexity), buildPrompt(intent, project)
    │   ├── streamParser.ts  # Parse streaming tokens → FileDelta[], StatusMessage[]
    │   ├── rewind.ts        # Wrapper around client.rewind(); integrates with store
    │   └── deploy/
    │       ├── static.ts    # Vercel / Netlify API; static site deployment
    │       ├── fullstack.ts # Vercel / Railway; Next.js deployment with DB provision
    │       └── export.ts    # JSZip: generate downloadable ZIP from project files
    │
    ├── store/
    │   ├── project.ts       # Zustand: files, assets, activeFile, generationState
    │   ├── session.ts       # Zustand: sessionId, title, createdAt
    │   └── ui.ts            # Zustand: panelLayout, previewVisible, swarmPanelOpen
    │
    ├── components/
    │   ├── Chat/
    │   │   ├── ChatPanel.tsx       # Message list + input box
    │   │   ├── MessageBubble.tsx   # User vs agent; streaming token rendering
    │   │   ├── StreamingMessage.tsx # Live token accumulation
    │   │   └── QuickActions.tsx    # Suggested follow-up prompts
    │   │
    │   ├── Preview/
    │   │   ├── PreviewPanel.tsx    # Hosts Sandpack or WebContainers iframe
    │   │   ├── SandpackPreview.tsx # @codesandbox/sandpack-react integration
    │   │   └── PreviewToolbar.tsx  # Refresh, device size, open-in-new-tab
    │   │
    │   ├── FileExplorer/
    │   │   ├── FileTree.tsx        # Nested file tree from project store
    │   │   ├── FileTab.tsx         # Active file indicator
    │   │   └── DiffView.tsx        # Before/after for each generation step
    │   │
    │   ├── Editor/
    │   │   ├── CodeEditor.tsx      # Monaco editor, lazily loaded
    │   │   └── ReadOnlyEditor.tsx  # Non-interactive code view with syntax highlighting
    │   │
    │   ├── SwarmPanel/
    │   │   ├── SwarmPanel.tsx      # Shows active agents, progress, metrics
    │   │   ├── AgentCard.tsx       # One card per agent: name, status, last action
    │   │   └── MetricsBadge.tsx    # Token count, uptime from client.on("metrics")
    │   │
    │   ├── Deploy/
    │   │   ├── DeployPanel.tsx     # Choose target; connect accounts; deploy
    │   │   ├── VercelDeploy.tsx
    │   │   ├── NetlifyDeploy.tsx
    │   │   └── ZipExport.tsx
    │   │
    │   └── Assets/
    │       ├── AssetManager.tsx    # Upload images, data files, fonts
    │       └── AssetGallery.tsx    # Thumbnails; copy reference URL
    │
    ├── pages/
    │   ├── Dashboard.tsx    # Project list; create / delete / rename projects
    │   └── Studio.tsx       # Main workspace: Chat | Preview | FileExplorer
    │
    └── templates/
        ├── index.ts         # Template registry
        ├── landing-page.ts  # Starter prompt + initial file scaffold
        ├── saas-app.ts
        ├── dashboard.ts
        └── api-only.ts
```

---

## SDK Integration — `src/lib/client.ts`

The singleton client is initialised once when the app mounts.  Every component
that needs to send or receive messages imports the singleton, not a new instance.

```typescript
import { JiuwenSwarmClient, AgentModeConstants, ChannelIdConstants } from "@jiuwenswarm/sdk";

let _client: JiuwenSwarmClient | null = null;

export function getClient(): JiuwenSwarmClient {
  if (!_client) {
    _client = new JiuwenSwarmClient({
      url: import.meta.env.VITE_JIUWENSWARM_URL,
      authToken: import.meta.env.VITE_AUTH_TOKEN,
      channelId: ChannelIdConstants.BROWSER,   // VibeStudio identifies as browser channel
      reconnect: { maxAttempts: 10, initialDelayMs: 1000, maxDelayMs: 30_000 },
      onError: (msg) => console.error("[jiuwenswarm]", msg),
    });
  }
  return _client;
}

export async function connectClient(): Promise<void> {
  const client = getClient();
  await client.connect();
}
```

---

## SDK Integration — `src/lib/agentMode.ts`

The VibeStudio UI always uses `mode: "team"` for full app generation and
`mode: "agent"` for targeted single-question or refinement prompts (e.g.
"explain this function", "fix this type error").

```typescript
import type { StreamEventsOptions } from "@jiuwenswarm/sdk";

type Intent = "generate" | "refine" | "explain" | "fix" | "deploy";

export function buildStreamOptions(
  intent: Intent,
  sessionId: string,
  contextPrefix?: string,
): StreamEventsOptions {
  return {
    mode: intent === "generate" ? "team" : "agent",
    sessionId,
    contextPrefix,
  };
}
```

---

## Stream Parsing — `src/lib/streamParser.ts`

The agent team emits generated files as fenced code blocks inside the token
stream, using a convention the Architect agent is instructed to follow:

```
@@FILE: src/components/Button.tsx
```typescript
export function Button({ label }: { label: string }) { … }
```
@@END_FILE
```

The stream parser accumulates tokens and extracts file deltas when `done` fires:

```typescript
export type FileDelta = {
  path: string;
  content: string;
  action: "create" | "update" | "delete";
};

export function extractFileDeltas(fullText: string): FileDelta[] {
  const FILE_PATTERN = /@@FILE:\s*(\S+)\n```[\w]*\n([\s\S]*?)```\n@@END_FILE/g;
  const deltas: FileDelta[] = [];
  let match: RegExpExecArray | null;
  while ((match = FILE_PATTERN.exec(fullText)) !== null) {
    deltas.push({ path: match[1], content: match[2], action: "create" });
  }
  return deltas;
}
```

The `Studio.tsx` page orchestrates the full cycle:

```typescript
async function generate(prompt: string): Promise<void> {
  const client = getClient();
  const { sessionId } = useSessionStore.getState();
  const opts = buildStreamOptions("generate", sessionId);
  let fullText = "";

  for await (const event of client.streamEvents(prompt, opts)) {
    switch (event.kind) {
      case "delta":
        fullText += event.text;
        appendToken(event.text);           // live token render
        break;
      case "status":
        setAgentStatus(event.text);        // swarm panel update
        break;
      case "done":
        const deltas = extractFileDeltas(fullText);
        applyDeltas(deltas);               // project store update
        triggerPreviewRefresh();
        break;
      case "error":
        showError(event.message);
        break;
    }
  }
}
```

---

## Rewind Integration — `src/lib/rewind.ts`

Every successfully generated project state is assigned a server message ID.
The VibeStudio UI stores a rewind stack (message IDs) in the session store.
When the user clicks "Undo last generation", `client.rewind(messageId)` is
called and the UI rolls back the project store to the previous snapshot.

```typescript
import { getClient } from "./client";
import { useProjectStore } from "../store/project";

export function rewindToSnapshot(messageId: string): void {
  const client = getClient();
  const { popSnapshot } = useProjectStore.getState();

  // Listen for confirmation before applying the rollback.
  client.once("rewind_done", (confirmedId) => {
    if (confirmedId === messageId) {
      popSnapshot(messageId);
    }
  });

  client.rewind(messageId);
}
```

---

## Swarm Panel — Live Agent Visibility

The swarm panel receives status updates from three sources:

| Source | SDK mechanism | What it shows |
|---|---|---|
| Agent `status` stream events | `event.kind === "status"` in `streamEvents()` | Which agent is writing and what it is doing |
| Gateway metrics push | `client.on("metrics", ...)` | Total tokens used, session uptime, request count |
| `rewindable` push | `client.on("rewindable", ...)` | Highlights messages that can be rewound |

```typescript
// SwarmPanel.tsx
useEffect(() => {
  const client = getClient();
  const handleMetrics = (info: MetricsInfo) => setMetrics(info);
  const handleRewindable = (msgId: string) => markRewindable(msgId);
  client.on("metrics", handleMetrics);
  client.on("rewindable", handleRewindable);
  return () => {
    client.off("metrics", handleMetrics);
    client.off("rewindable", handleRewindable);
  };
}, []);
```

---

## In-Browser Preview — Sandpack Integration

Sandpack receives the current project file map from the project store and renders
a live, interactive preview without any server involvement:

```typescript
// SandpackPreview.tsx
import { Sandpack } from "@codesandbox/sandpack-react";
import { useProjectStore } from "../../store/project";

export function SandpackPreview(): JSX.Element {
  const files = useProjectStore((s) => s.files);

  // Convert project file map to Sandpack format
  const sandpackFiles = Object.fromEntries(
    Object.entries(files).map(([path, content]) => [
      `/${path}`,
      { code: content },
    ]),
  );

  return (
    <Sandpack
      files={sandpackFiles}
      template="react-ts"
      options={{ showPreview: true, showNavigator: true }}
    />
  );
}
```

For projects with a Node.js backend (Next.js), Sandpack is replaced with a
StackBlitz WebContainers iframe in Phase 2.

---

## Project Templates

Templates provide two things: a starting prompt sent to the agent team on project
creation, and a minimal file scaffold placed in the project store before the first
generation.  The scaffold prevents the preview from showing a blank page during
the first generation cycle.

```typescript
// src/templates/saas-app.ts
export const saasAppTemplate = {
  name: "SaaS App",
  description: "Multi-page app with auth, dashboard, and billing",
  initialPrompt: `
    Build a SaaS application with:
    - A marketing landing page
    - Email/password sign-up and login (mock auth, no real backend required)
    - A post-login dashboard with a sidebar navigation
    - A settings page with user profile and billing section (placeholder)
    - Tailwind CSS, React Router, TypeScript
    Keep the design clean and professional.
  `,
  initialFiles: {
    "src/main.tsx": "// Scaffold — will be replaced by agent generation",
    "package.json": JSON.stringify({ name: "saas-app", version: "0.0.1" }, null, 2),
  },
};
```

---

## Deployment Pipeline

### Static deployment (Vercel)

```typescript
// src/lib/deploy/static.ts
export async function deployToVercel(
  projectName: string,
  files: Record<string, string>,
  token: string,
): Promise<string> {
  const payload = {
    name: projectName,
    files: Object.entries(files).map(([file, data]) => ({
      file,
      data,
      encoding: "utf8",
    })),
    projectSettings: { framework: "vite" },
  };

  const res = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const { url } = await res.json();
  return `https://${url}`;
}
```

### ZIP export

```typescript
// src/lib/deploy/export.ts
import JSZip from "jszip";
import { saveAs } from "file-saver";

export async function exportProjectZip(
  projectName: string,
  files: Record<string, string>,
): Promise<void> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${projectName}.zip`);
}
```

---

## Sequence Diagrams

### First-time project creation

```
User                VibeStudio UI              SDK (JiuwenSwarmClient)     JiuwenSwarm Server
 │                       │                              │                         │
 │ "Build a SaaS app"    │                              │                         │
 │──────────────────────►│                              │                         │
 │                       │ client.sessions.create()     │                         │
 │                       │─────────────────────────────►│ {type:"create_session"} │
 │                       │                              │────────────────────────►│
 │                       │                              │◄────────────────────────│ session_created
 │                       │ setActive(session.id)        │                         │
 │                       │                              │                         │
 │                       │ for await streamEvents(      │                         │
 │                       │   prompt, {mode:"team"})     │                         │
 │                       │─────────────────────────────►│ {type:"chat",           │
 │                       │                              │  mode:"team", ...}      │
 │                       │                              │────────────────────────►│
 │                       │                              │                         │ Architect → agents
 │                       │◄─────────────────────────────│ status: "Frontend agent │
 │ [SwarmPanel updates]  │                              │   writing Button.tsx"   │
 │                       │◄─────────────────────────────│ token: "@@FILE: src/..." │
 │ [Live token stream]   │                              │  ... (many tokens) ...  │
 │                       │◄─────────────────────────────│ done                    │
 │                       │ extractFileDeltas()          │                         │
 │                       │ applyDeltas() → store        │                         │
 │                       │ triggerPreviewRefresh()      │                         │
 │ [Preview appears]     │                              │                         │
```

### Rewind (undo last generation)

```
User            VibeStudio UI                SDK                    Server
 │                   │                        │                        │
 │ [clicks Undo]     │                        │                        │
 │──────────────────►│                        │                        │
 │                   │ client.rewind(msgId)   │                        │
 │                   │───────────────────────►│ {type:"rewind",        │
 │                   │                        │  message_id: msgId}    │
 │                   │                        │───────────────────────►│
 │                   │                        │                        │ rewinds state
 │                   │                        │◄───────────────────────│ rewind_done
 │                   │ client.on("rewind_done")│                       │
 │                   │◄───────────────────────│                        │
 │                   │ popSnapshot(msgId)     │                        │
 │ [Preview rolls    │ triggerPreviewRefresh()│                        │
 │  back to prev.]   │                        │                        │
```

### Export session conversation

```
User            VibeStudio UI                     SDK                    Server
 │                   │                              │                        │
 │ [Export Chat]     │                              │                        │
 │──────────────────►│                              │                        │
 │                   │ client.exportSession(        │                        │
 │                   │   sessionId, "markdown")     │                        │
 │                   │─────────────────────────────►│ {type:"session.export"}│
 │                   │                              │───────────────────────►│
 │                   │                              │◄───────────────────────│ session_exported
 │                   │◄─────────────────────────────│ {url} or {data}        │
 │                   │ offer download link          │                        │
 │ [Downloads .md]   │                              │                        │
```

---

## Phased Delivery

### Phase 1 — Core generation loop

- `JiuwenSwarmClient` integration (connect, session create, chat in team mode)
- Chat UI with streaming token rendering
- Sandpack in-browser preview for React/Vite apps
- Basic file explorer (read-only, generated files only)
- Project dashboard (create, list, rename, delete — backed by `client.sessions`)
- ZIP export

Deliverable: users can describe a React app and get a working, downloadable
preview in the browser.

---

### Phase 2 — Full-stack apps and richer editing

- StackBlitz WebContainers integration for Next.js preview
- Monaco editor with TypeScript language server
- Swarm panel with per-agent status (using `status` stream events)
- Rewind support (undo last generation step)
- Deployment to Vercel and Netlify
- Asset uploader (images and data files passed as `mediaItems` via SDK)
- Mobile-responsive layout

Deliverable: users can generate, preview, and deploy full-stack Next.js
applications.

---

### Phase 3 — Collaboration and extensibility

- Real-time collaboration (Y.js / Liveblocks): shared cursor, presence, shared
  conversation
- VibeStudio server (Node.js / Next.js): webhook handling, managed OAuth token
  store, team workspace management
- Plugin system: users can add custom agent tools (e.g. Stripe, Supabase,
  Resend) that the agent team uses during generation
- Custom domain deployment (CNAME management)
- Project forking: clone another user's public project

---

## Technical Constraints Summary

| Constraint | Mitigation |
|---|---|
| SDK is the only transport | `client.ts` singleton enforces this; no direct fetch/WebSocket calls in components |
| Generated code must be runnable | QA agent reviews every output; Sandpack validates by execution, not static analysis |
| Sandboxed preview (no credential leak) | Sandpack iframe has `sandbox` attribute; no cookies shared |
| No VibeStudio server in Phase 1 | Vercel/Netlify OAuth tokens stored in localStorage with user-key encryption |
| Project state is server-authoritative | On tab focus, `client.getHistory()` is called to reconcile any stale UI state |
| Large file output may exceed token limits | Architect decomposes large apps into sequential agent turns; each turn generates one component or route |
| TypeScript throughout | `strict: true` in `tsconfig.json`; generated app code may be JS or TS per user choice |
