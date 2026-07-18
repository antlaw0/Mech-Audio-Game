# Mech Audio Game Prime Directive

Follow the active documentation authority:

1. Current user instruction
2. `SESSION_NOTES.md`
3. `AI_CONTEXT.md`
4. `docs/CURRENT_STATE.md`
5. `docs/ROADMAP.md`
6. Current source code and authored data

Archived roadmaps and specifications are historical reference only.

## Before editing

- Inspect the current ownership and data flow.
- Identify the authoritative source of truth.
- Search for existing helpers and systems.
- List the smallest required file set.
- Identify regression risks.
- Convert the request into observable acceptance criteria.

## While editing

- Work on one focused task.
- Preserve unrelated behavior.
- Reuse existing stores, resolvers, event paths, and systems.
- Do not duplicate calculations.
- Do not reformat unrelated code.
- Do not rename unrelated symbols.
- Do not combine roadmap tickets.
- Do not introduce a new framework.
- Do not perform broad cleanup.

`packages/client/src/test-map/main.ts` is the composition root and is oversized.

Do not continue placing independent systems directly into it. Extract only the smallest coherent boundary required by the current task, while preserving behavior.

## Accessibility

- Use semantic HTML.
- Keep keyboard operation complete.
- Protect editable controls from gameplay hotkeys.
- Restore logical focus when overlays close.
- Do not rely on visuals or color alone.
- Avoid excessive live announcements.
- Preserve one stable meaning per audio cue.

## Code conventions

- Use TypeScript for project code.
- Use explicit exported types.
- Prefer `unknown` and validation over `any`.
- Add a trailing explanatory comment after every closing brace added or modified when comments are legal.
- Do not add comments to strict JSON.

## Verification

Run:

```text
npm run typecheck
npm run build
```

Use `npm run verify` when available.

Report:

- Files changed
- Behavior changed
- Source of truth
- Command results
- Manual test steps
- Unverified behavior
- Regression risks

Do not claim manual verification that did not occur.
