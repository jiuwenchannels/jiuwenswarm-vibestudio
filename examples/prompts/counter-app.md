# Example Prompt — Minimal Counter (Very Simple)

**Intent:** generate

**Prompt:**

```
Build the simplest possible React app: a counter. - Show a big number and two buttons: +1 and −1 (Reset is optional)
- One file only: src/App.tsx

- Use useState, plain inline styles — no Tailwind, no libraries, no backend
- Keep the page clean and centred; cap the counter between −10 and 10
- Nothing else. No routing, no storage, no tests
```

**Expected output:**
A single-file React app that shows a number and two buttons. It should be
generated in well under a minute — there is no feature surface beyond the
counter, so the swarm has almost nothing to write.

**Tips:**
- Great first prompt to check that the swarm pipeline, preview, and file tree
  all work end-to-end before attempting bigger apps.
- To make it a tiny bit richer, follow up with: *"Style it with a dark
  background and a soft shadow card."*
