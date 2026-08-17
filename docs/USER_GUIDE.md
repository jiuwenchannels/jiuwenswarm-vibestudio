# VibeStudio — User Guide

## What is VibeStudio?

VibeStudio lets you build React applications through conversation. You describe
what you want, and a team of JiuwenSwarm AI agents writes the code and shows
you a live preview — all in the browser, no coding required.

---

## Getting Started

1. Make sure JiuwenSwarm is running. See [INSTALLATION.md](INSTALLATION.md).
2. Open VibeStudio in your browser (default: `http://localhost:5174`).
3. You land on the **Dashboard**.

---

## The Dashboard

The Dashboard is your project home screen.

### Creating a project

Type a project name in the **New project** field (or leave it blank for
"Untitled project") and click **Create**.

You can also click one of the **starter prompt chips** to pre-fill the name
with a ready-made idea — useful for getting started quickly.

### Opening a project

Click any project card to open the Studio workspace.

### Renaming a project

**Double-click** the project title in the card. An inline input appears.
Edit the name and press **Enter** (or click away) to save. Press **Escape** to
cancel. The rename is reflected immediately in both the local list and the
JiuwenSwarm session.

### Deleting a project

Hover over a project card and click the **✕** button that appears in the
top-right corner. This deletes the session from JiuwenSwarm and removes it
from your list.

### Theme toggle

The **☾ Dark / ☀ Light** button in the header switches the colour theme.
Your preference is remembered between sessions.

---

## The Studio Workspace

When you open a project you enter the Studio.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Dashboard  |  Project name     ↩ Undo  ↓ ZIP  ↓ Chat  </>           │
├─────────────────────────────────────────────────────────────────────────┤
│   Chat panel                          |   Live preview                  │
│   (send prompts, see responses,       |   (your app running live)       │
│   plus inline swarm activity          |                                 │
│   while agents work)                  |                                 │
├───────────────────────────────────────┴─────────────────────────────────┤
```

### Chat panel

Type your request in the text box at the bottom and press **Enter** (or
**Shift+Enter** for a new line) or click **Send**.

The panel shows:
- Your messages (right-aligned, blue).
- Agent responses streaming in real time (left-aligned).
- A collapsible **Swarm activity** section that opens automatically while the
  agents work. It lists each agent's steps and thinking with timestamps, and
  collapses to a compact "N steps" header when generation finishes.

### Live preview

The right side shows your app running live in the browser as soon as the first
generation completes. It automatically refreshes whenever new files are
generated. The preview uses the same code that appears in the code editor.

---

## Generating Your First App

1. Type what you want to build, for example:
   > *"Build a to-do app with tags, priority levels, and a dark mode toggle"*
2. Press **Enter**.
3. Watch the status bubbles — a team of agents is planning, writing, and
   reviewing the code. This takes 20–60 seconds for the first generation.
4. The live preview appears on the right when generation is complete.

---

## Refining Your App

After the first generation you can keep chatting to change anything:

| Intent | Example prompt |
|---|---|
| Change appearance | *"Make the header dark blue and use rounded buttons"* |
| Add a feature | *"Add a search bar that filters the task list"* |
| Fix a bug | *"The delete button is not working, please fix it"* |
| Explain code | *"Explain how the filtering logic works"* |
| Refactor | *"Refactor the task list into a separate component"* |

VibeStudio automatically detects whether you want a full regeneration (uses
the full agent team) or a targeted change (uses a single fast agent).

---

## Code Toggle (`</> Code`)

By default only the live preview is shown. Click **`</> Code`** in the
toolbar to reveal:

- **File explorer** — lists every generated file in a tree. Click a file to
  make it active.
- **Code editor** — shows the source of the active file, inside the preview
  panel. You can read the generated code but cannot edit it manually yet
  (editable editor is coming in a future stage).

Click **`</> Hide code`** to return to the full-width preview.

---

## Undo / Rewind

After each successful generation a **↩ Undo** button appears in the toolbar.
Clicking it sends a rewind request to JiuwenSwarm, which rolls the session
back to the state before that generation. VibeStudio restores the file map to
match.

You can undo multiple times to step back through the generation history.

---

## Downloading Your Project

Once files have been generated, a **↓ ZIP** button appears in the toolbar.
Clicking it packages all generated source files into a ZIP archive and
downloads it to your machine — entirely in the browser, no server required.

The ZIP contains the raw source files in their original directory structure,
ready to open in any code editor or deploy manually.

---

## Theme Toggle

Click **☾ Dark** to switch to dark mode, or **☀ Light** to switch to light
mode. The preference is saved and restored automatically on your next visit.

The toggle appears in both the Dashboard header and the Studio toolbar.

Note: the **live preview pane** runs in an isolated browser frame — its
background and colours are determined by the generated app's own CSS, not by
VibeStudio's theme.

---

## Project Persistence

Your projects are stored in your browser's `localStorage`. This means:

- Projects survive page reloads and browser restarts.
- Generated files are restored automatically when you re-open a project —
  you do not need to regenerate.
- Clearing browser storage will remove all projects. Download a ZIP first if
  you want to keep the code.

---

## Templates

The Dashboard has a **Use template** button next to the **Create** button.
Click it to open the template picker — a modal with six ready-made starter
projects:

| Template | What it builds |
|---|---|
| To-do App | Task list with priorities, tags, and dark mode |
| Landing Page | SaaS-style hero, pricing, FAQ, and email form |
| Finance Dashboard | Income/expense tracker with charts |
| Recipe Book | Searchable recipes, favourites, and shopping list |
| Kanban Board | Drag-and-drop columns stored in localStorage |
| Chat UI | Polished messaging layout with timestamps |

Selecting a template creates a new project and immediately sends the full
generation prompt when you enter the Studio — no typing required.

---

## Quick-Action Buttons

The chat panel shows four pill buttons below the input:

| Button | Effect |
|---|---|
| **Generate** | Removes any existing prefix — plain generation |
| **Fix** | Prepends `Fix: ` to your message |
| **Explain** | Prepends `Explain: ` to your message |
| **Refactor** | Prepends `Refactor: ` to your message |

The prefix is stripped and replaced when you switch between actions, so you
never end up with double prefixes. You can always type the prefix manually
instead — the intent detection works the same way.

---

## Swarm Activity

While the agents are working, a collapsible **Swarm activity** section appears
at the bottom of the chat panel:

- It opens automatically when generation starts and collapses to a compact
  "N steps" header when it finishes — your attention stays in the chat.
- Each entry shows a wall-clock timestamp. Agent steps are colour-coded by
  role (Architect, Frontend, Backend, Database, QA); tool calls and thinking
  get their own badges.
- Long reasoning text is truncated — click **Show more** to expand it.
- Click **Clear** to empty the log.

The section is purely informational — it does not affect generation.
Collapsing it never clears the log.

On mobile, the activity appears inline in the **Chat** tab — no extra tab needed.

---

## Exporting the Chat

Once you have exchanged at least one non-status message, a **↓ Chat** button
appears in the Studio toolbar. Clicking it downloads a Markdown file
(`<project-name>-chat.md`) containing the full conversation, suitable for
sharing or archiving.

The file uses simple formatting:

```
# Project name
_Exported: <timestamp>_

**You:** your message…

**Agent:** agent response…

> _Agent status: Planning…_
```

---

## Using VibeStudio on Mobile

VibeStudio adapts to small screens automatically. On screens narrower than
768 px, the side-by-side layout is replaced by a tab bar at the top of the
workspace:

| Tab | Content |
|---|---|
| **Chat** | Full-screen chat panel |
| **Preview** | Full-screen live preview |
| **Swarm** | Agent activity log (visible only when Swarm is enabled) |

All toolbar buttons remain accessible at the top of the screen.

---

## Reconnection

If the connection to JiuwenSwarm drops (e.g. the server is restarted), a
banner appears at the bottom of the screen:

> 🔴 Disconnected from JiuwenSwarm — reconnecting…

The client retries automatically with exponential back-off. The banner
disappears as soon as the connection is restored and any in-flight generation
resumes.

---

## Troubleshooting

**"Disconnected — reconnecting…" in the chat panel**
: The JiuwenSwarm server is not reachable. Check that it is running on
  `ws://localhost:19000` (or the URL you configured in `.env`). The SDK
  retries automatically with exponential back-off.

**Preview stays blank after generation**
: The generated app may have an error. Click **`</> Code`** to open the
  Sandpack editor — it shows any compilation errors in the console at the
  bottom.

**Generation takes a very long time**
: Team mode (used for "generate" intent) runs multiple agents in sequence.
  Large or complex apps can take 60–90 seconds. You can see which agent is
  currently active in the toolbar spinner.

**Project files disappeared after reload**
: This can happen if the browser's `localStorage` quota was exceeded (rare
  with large projects). Download a ZIP regularly as a backup.

**Undo not available**
: The ↩ Undo button only appears after at least one successful generation in
  the current session. If you reloaded the page, the rewind history is reset
  (though the generated files are still restored).
