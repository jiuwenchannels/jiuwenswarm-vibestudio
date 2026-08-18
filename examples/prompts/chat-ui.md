# Example Prompt — Chat UI

**Intent:** generate

**Prompt:**

```
Build a polished chat interface in React + TypeScript with:
- Message bubbles: user messages right-aligned (blue), assistant messages
  left-aligned (grey/dark)
- Each message shows a relative timestamp ("just now", "2 min ago", "10:34")
- A typing indicator — three animated dots — that appears while the assistant
  is "typing" (simulate a 1–3 second delay before each response)
- An emoji picker button next to the input that inserts an emoji at the cursor
  (inline picker, no library — show a flat grid of ~20 common emojis)
- Send on Enter; Shift+Enter for new line
- Auto-scroll to the newest message
- A sidebar with a list of mock conversations (click to switch)
- Unread badge count on conversations that have new messages
- Search bar at the top of the sidebar to filter conversations by name
- Online / offline status indicator (green dot) on each conversation avatar
- Dark mode (Tailwind, class-based)

Generate mock conversation data inline (no external API).
Keep the layout in a single App.tsx; split into sub-components
(Sidebar, ConversationList, ChatWindow, MessageBubble, TypingIndicator,
EmojiPicker, MessageInput) within the same file.
```

**Expected output:**
A multi-panel chat application with a conversation sidebar and a main chat
window. Messages stream in with a typing delay. The emoji picker inserts
characters inline. No backend, no WebSocket — all interactions are simulated
with `useState` and `setTimeout`.

**Tips:**
- To connect this UI to the WorkSwarm streaming API instead of mock data,
  send a follow-up: *"Replace the mock typing simulation with a real
  streaming call to the WorkSwarm SDK."*
- To add read receipts: *"Add double-tick read receipts under each outgoing
  message (✓✓ when delivered, blue when read)."*
