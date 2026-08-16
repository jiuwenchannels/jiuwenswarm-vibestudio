# Example Prompt — Analytics Dashboard

**Intent:** generate

**Prompt:**

```
Build an analytics dashboard with:
- Left sidebar navigation (Dashboard, Users, Revenue, Reports, Settings)
- Top bar with search and user avatar
- Main content with 4 KPI cards: Total Users, Revenue, Conversion Rate, Active Sessions
- A line chart for weekly revenue (use inline SVG, no chart library)
- A bar chart for daily active users (inline SVG)
- A table of recent transactions: date, user, amount, status badge (paid/pending/failed)
- Responsive layout using CSS Grid and Flexbox with Tailwind

Use React + TypeScript.
Split into multiple components: Sidebar, TopBar, KPICard, LineChart, BarChart, TransactionsTable.
Use realistic mock data.
```

**Expected output:**
Multiple component files under `src/components/` plus `src/App.tsx`.
Pure frontend, no backend, no extra libraries.
