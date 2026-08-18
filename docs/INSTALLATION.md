# Installation Guide — VibeStudio

---

## Requirements

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18+ | LTS recommended; verify with `node -v` |
| npm | 9+ | Bundled with Node.js; verify with `npm -v` |
| WorkSwarm server | any current | Must be running and reachable via WebSocket |
| Modern browser | Chrome 114+, Firefox 120+, Safari 17+ | For the Sandpack in-browser preview |

---

## Step 1 — Start WorkSwarm

VibeStudio has no backend of its own.  It connects to a running WorkSwarm
gateway.  Start it before opening VibeStudio.

**Option A — desktop installer (Windows / macOS / HarmonyOS)**

Download and run the installer from [openjiuwen.com](https://openjiuwen.com/en/jiuwenswarm).
The gateway starts automatically on port 19000.

**Option B — pip**

```bash
pip install jiuwenswarm
jiuwenswarm-init          # first-time setup only
jiuwenswarm-start
```

**Option C — from source**

```bash
cd jiuwenswarm            # the openjiuwen/jiuwenswarm repository
uv venv && uv pip install -e .
jiuwenswarm-start
```

After any of the above, the WebSocket gateway is available at:

```
ws://localhost:19000/v1/ws
```

Verify it is up:

```bash
curl http://localhost:19000/v1/health
# expected: {"status":"ok","protocol_version":"1",...}
```

---

## Step 2 — Get the VibeStudio source

If you have the `openjiuwenchannels` repository already:

```bash
cd /path/to/openjiuwenchannels/jiuwenswarm-vibestudio
```

If not, clone it:

```bash
git clone <repo-url> openjiuwenchannels
cd openjiuwenchannels/jiuwenswarm-vibestudio
```

---

## Step 3 — Install dependencies

```bash
npm install
```

This also installs `@jiuwenswarm/sdk` from the local sibling package at
`../jiuwenswarm-sdk/packages/sdk`.  If that path does not exist, install the
SDK from npm instead:

```bash
# Alternative: install published SDK from npm
npm install @jiuwenswarm/sdk
```

Then remove the `file:` reference from `package.json` and replace it with the
published version:

```json
"@jiuwenswarm/sdk": "^1.0.0"
```

---

## Step 4 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

```dotenv
# WebSocket URL of the WorkSwarm gateway
VITE_JIUWENSWARM_URL=ws://localhost:19000/v1/ws

# Optional bearer token — leave empty if your server runs without auth
VITE_AUTH_TOKEN=
```

**Remote server:** if WorkSwarm runs on another machine or behind a TLS
terminator, change the URL accordingly:

```dotenv
VITE_JIUWENSWARM_URL=wss://your-server.example.com:19000/v1/ws
VITE_AUTH_TOKEN=your-token-here
```

> `VITE_` is required — Vite only exposes variables with this prefix to the
> browser bundle.  Do not store production secrets here; the values are embedded
> in the compiled JavaScript.

---

## Step 5 — Start the development server

```bash
npm run dev
```

Output:

```
  VITE v5.x.x  ready in 300ms

  ➜  Local:   http://localhost:5174/
  ➜  Network: http://192.168.x.x:5174/
```

Open **http://localhost:5174** in your browser.  You should see the VibeStudio
dashboard.

---

## Verify the connection

1. Open VibeStudio in the browser.
2. Click **Create** (or select an existing project) to open the Studio.
3. The top bar of the chat panel shows a green dot and **"Connected to WorkSwarm"**.
4. If the dot is red (**"Disconnected — reconnecting…"**):
   - Confirm the WorkSwarm server is running: `curl http://localhost:19000/v1/health`
   - Confirm `VITE_JIUWENSWARM_URL` in `.env` matches the actual server address.
   - Restart the Vite dev server (`Ctrl+C` then `npm run dev`) after editing `.env`.

---

## Development commands

| Command | What it does |
|---|---|
| `npm run dev` | Start Vite dev server on `:5174` with HMR |
| `npm test` | Run Vitest unit tests (22 tests) |
| `npm run typecheck` | TypeScript type check of `src/` — no output means no errors |
| `npm run build` | Compile TypeScript and bundle to `dist/` |
| `npm run preview` | Serve the production build locally for final check |

---

## Production build

```bash
npm run build
```

Output lands in `dist/`.  The result is a plain static site — no server-side
rendering, no Node.js at runtime.  Serve it from any static host:

**Serve locally for testing:**

```bash
npm run preview
# opens http://localhost:4173
```

**Deploy to a static host:**

```bash
# Vercel
npx vercel dist

# Netlify CLI
netlify deploy --dir dist --prod

# Any HTTP server
npx serve dist
```

The only runtime dependency is a reachable WorkSwarm gateway.  The
`VITE_JIUWENSWARM_URL` must be set to the production gateway URL **before**
running `npm run build` because Vite inlines env vars at build time.

For production, build with explicit env vars:

```bash
VITE_JIUWENSWARM_URL=wss://gateway.prod.example.com:19000/v1/ws \
VITE_AUTH_TOKEN=prod-token \
npm run build
```

---

## Updating

After pulling new source:

```bash
npm install       # pick up new or updated dependencies
npm run dev       # restart dev server
```

---

## Troubleshooting

**"Could not create project: Not connected. Call connect() first."**
: The SDK could not open the WebSocket before the session was created.
  The connection is attempted automatically on first project creation.
  Check that `VITE_JIUWENSWARM_URL` is correct and the gateway is running.

**WebSocket connection immediately drops**
: If `VITE_JIUWENSWARM_URL` starts with `ws://` but the page is served over
  `https://`, the browser blocks the mixed-content request.  Use `wss://`
  and a TLS-terminated gateway for production HTTPS deployments.

**Preview shows a blank iframe**
: Sandpack needs to fetch its runtime from `https://sandpack-cdn-v2.codesandbox.io`.
  Ensure your network allows this domain.  In restricted environments, the
  Sandpack bundler URL can be customized via the `bundlerURL` prop (Phase 2).

**`npm install` fails on `@jiuwenswarm/sdk`**
: The local `file:` reference requires `jiuwenswarm-sdk/packages/sdk` to exist
  as a sibling directory.  Run `npm install` from inside
  `jiuwenswarm-sdk/packages/sdk` first, or switch to the published npm package
  as described in Step 3.

**Port 5174 already in use**
: Change the port in `vite.config.ts` (`server.port`) or kill the process
  occupying the port: `lsof -ti:5174 | xargs kill`.

**`tsc` type errors in `tests/`**
: The `tsconfig.app.json` covers only `src/`.  Test files use Vitest globals
  declared via `/// <reference types="vitest" />` in `vite.config.ts` and are
  not checked by `npm run typecheck`.  Run `npm test` to exercise them instead.
