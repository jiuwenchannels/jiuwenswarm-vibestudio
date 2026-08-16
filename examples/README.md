# VibeStudio — Example Prompts

Each file in `prompts/` contains a ready-to-use generation prompt for VibeStudio
together with a description of what it builds and tips for follow-up requests.

---

## How to use

1. Open VibeStudio and create a new project (or click **Use template** to launch
   one of the built-in starters directly without copy-pasting).
2. Copy the text inside the ` ``` ` code block in the prompt file.
3. Paste it into the VibeStudio chat panel and press **Enter**.
4. The agent team generates the app; the live preview appears on the right.
5. Continue the conversation using the follow-up suggestions in each file.

---

## Prompts

| File | What it builds | Complexity |
|---|---|---|
| [`prompts/todo-app.md`](prompts/todo-app.md) | To-do app — tasks, priorities, tags, dark mode, localStorage | Beginner |
| [`prompts/landing-page.md`](prompts/landing-page.md) | SaaS landing page — hero, pricing, FAQ, email sign-up | Beginner |
| [`prompts/dashboard.md`](prompts/dashboard.md) | Analytics dashboard — KPI cards, charts, sidebar nav | Intermediate |
| [`prompts/kanban-board.md`](prompts/kanban-board.md) | Kanban board — drag-and-drop columns, labels, localStorage | Intermediate |
| [`prompts/chat-ui.md`](prompts/chat-ui.md) | Chat UI — bubbles, typing indicator, emoji picker, sidebar | Intermediate |
| [`prompts/auth-form.md`](prompts/auth-form.md) | Auth flow — login/sign-up, validation, password strength | Intermediate |

---

## Tips for writing your own prompts

- **Be specific about the stack.** VibeStudio defaults to React + TypeScript +
  Tailwind CSS. Mention if you want a different approach.
- **List features as bullet points.** Agents parse bullet lists more reliably
  than prose paragraphs.
- **Specify file structure constraints.** e.g. "Use a single App.tsx" vs.
  "Split into separate component files under `src/components/`."
- **State what NOT to use.** e.g. "No external state library", "No extra npm
  packages" — this keeps generated code self-contained and Sandpack-compatible.
- **Use follow-up prompts for refinement.** Generate a working base first, then
  ask for specific changes. Smaller targeted requests produce better results than
  one giant prompt.
- **Use quick-action buttons.** The **Fix**, **Explain**, and **Refactor** pills
  below the chat input pre-set the generation intent so you don't have to type
  those words at the start of every message.

---

## Prompt length guidelines

| App size | Recommended prompt length |
|---|---|
| Single-component UI | 3–8 bullet points |
| Multi-view app | 8–15 bullet points |
| Full-stack app | 15–25 bullet points, broken into sections |

Extremely long prompts (> 400 words) can cause the agent to miss some
requirements. For complex apps, generate a working skeleton first, then
add features incrementally through follow-up prompts.
