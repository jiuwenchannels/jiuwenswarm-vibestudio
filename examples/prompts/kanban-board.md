# Example Prompt — Kanban Board

**Intent:** generate

**Prompt:**

```
Build a Kanban board in React + TypeScript with:
- Three columns: To Do, In Progress, Done
- Drag-and-drop cards between columns (HTML5 drag API, no library)
- Add new cards to any column via an inline text input
- Edit a card title by double-clicking on it
- Delete a card with a hover-reveal ✕ button
- Colour labels on cards (5 colours: red, orange, yellow, green, blue)
- Card count badge on each column header
- Persist board state to localStorage so it survives page reload
- Responsive layout — columns stack vertically on narrow screens
- Dark mode via Tailwind (follow system preference)
- Clean, minimal design with subtle drop-shadow cards and smooth drag transitions

Use React + TypeScript. Keep all logic in App.tsx and split display into
small sub-components (Board, Column, Card, AddCardForm) within the same file.
No external drag-and-drop library.
```

**Expected output:**
A single-file React app (`src/App.tsx`) containing a fully functional
drag-and-drop Kanban board. Columns are rendered side-by-side on desktop and
stacked on mobile. Card state persists across reloads via localStorage.

**Tips:**
- The agent uses the HTML5 `draggable` attribute and `onDragStart` /
  `onDragOver` / `onDrop` events to implement drag-and-drop.
- To add a second column constraint (e.g. WIP limit), send a follow-up
  prompt: *"Add a WIP limit of 3 cards to the In Progress column and
  highlight the column header red when the limit is reached."*
