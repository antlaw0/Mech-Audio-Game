---
agent: "agent"
description: "Implement the current focused Mech Audio Game roadmap ticket"
---

Implement only the focused task described in `SESSION_NOTES.md`.

Before editing:

1. Read `SESSION_NOTES.md`.
2. Read `AI_CONTEXT.md`.
3. Read `docs/CURRENT_STATE.md`.
4. Read the matching `docs/ROADMAP.md` item.
5. Inspect the relevant source files.
6. Identify the authoritative source of truth.
7. Confirm the smallest required file set.

Implementation rules:

- Preserve unrelated behavior.
- Reuse existing stores, resolvers, systems, and event paths.
- Do not duplicate calculations.
- Do not perform broad `main.ts` cleanup.
- Extract only a coherent boundary required by this ticket.
- Do not reformat unrelated code.
- Keep player UI, facility UI, and developer UI boundaries intact.
- Preserve keyboard focus protection.
- Use semantic HTML for UI.
- Add closing-brace comments to every brace you add or modify where comments are legal.
- Add focused automated tests for pure logic.
- Do not modify authored part values unless the ticket explicitly requires it.

Run:

```text
npm run typecheck
npm run build
```

Use `npm run verify` if it exists.

Return:

- Files changed
- Behavior implemented
- Source of truth used
- Commands and results
- Manual playtest steps
- Unverified behavior
- Regression risks
- Required documentation updates
