# Mech Audio Game: GitHub Copilot Instructions

Use these instructions for all work in this repository.

## Read first

Before a non-trivial edit, read:

1. `SESSION_NOTES.md`
2. `AI_CONTEXT.md`
3. `docs/CURRENT_STATE.md`
4. The matching item in `docs/ROADMAP.md`

Source code and authored data remain implementation truth.

Archived documents do not control current work.

## Work style

- Perform one focused task at a time.
- Inspect before editing.
- Identify the authoritative source of truth.
- Name the smallest required file set.
- Search for existing helpers, stores, resolvers, and event paths.
- Preserve unrelated behavior.
- Do not reformat unrelated code.
- Do not rename unrelated symbols.
- Do not combine roadmap tickets.
- Do not perform broad cleanup without explicit acceptance criteria.
- Make reversible, conservative assumptions only when necessary.
- Report any important assumption.

## Architecture

- The primary runtime is `packages/client/src/test-map`.
- `main.ts` is the composition root and is oversized.
- Preserve orchestration in `main.ts`, but put new self-contained systems in focused modules.
- Extract only the smallest coherent boundary required by the current task.
- The active test-map renderer uses Three.js.
- Do not remove or replace rendering or audio frameworks unless explicitly instructed.
- Keep player pause UI, contextual facility UI, and developer tools separate.
- Preserve the existing garage behavior while relocating its player access.
- Use existing client systems and data ownership described in `AI_CONTEXT.md`.

## Data ownership

- `packages/client/src/data/parts/parts.json` is authoritative for authored part definitions.
- Do not strip manually authored fields.
- Use the part stat resolver for resolved values.
- Use the mech-weight system for total weight and load behavior.
- Ground `ratedLoad` and flight lift capacity are distinct.
- Use the inventory manager, loot generator, garage store, controls system, combat ECS, target-lock system, and audio controller rather than duplicating their logic.
- Use shared types only for contracts that genuinely cross client and server.

## Accessibility

- Use semantic HTML.
- Keep every player action keyboard operable.
- Avoid positive `tabindex`.
- Do not fire gameplay or global hotkeys while focus is in an editable control.
- Restore logical focus after closing an overlay or dialog.
- Do not make color or visuals the only source of information.
- Avoid rapid screen-reader announcements for continuously changing telemetry.
- Preserve stable audio meanings.

## Code style

- Use TypeScript.
- Add explicit exported parameter and return types.
- Avoid `any` when practical.
- Use `unknown` and validation at untrusted boundaries.
- Prefer pure functions for calculations.
- Keep side effects at clear boundaries.

Every closing brace added or modified in a source file must have a trailing comment identifying what it closes when that language permits comments.

Example:

```ts
if (condition) {
  performAction()
} // end if condition
```

Do not add comments to strict JSON.

## Verification

For code changes, run:

```text
npm run typecheck
npm run build
```

Use `npm run verify` after that roadmap ticket implements it.

Do not claim manual behavior was verified unless it was actually playtested.

## Completion report

Always report:

- Files changed
- Behavior changed
- Source of truth used
- Commands run and results
- Manual test steps
- Unverified behavior
- Regression risks
- Documentation updates
