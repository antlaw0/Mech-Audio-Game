# Codex Repository Instructions

These instructions apply to the entire repository.

## Authority order

1. The user's current explicit instructions.
2. `SESSION_NOTES.md` for the active task.
3. This file for repository operating rules.
4. `AI_CONTEXT.md` for stable architecture and ownership.
5. `docs/CURRENT_STATE.md` for evidence-backed status.
6. `docs/ROADMAP.md` for milestone order.
7. Current source code and authored data as implementation truth.
8. Archived documents as historical context only.

Report conflicts instead of silently choosing an outdated document over current source.

## Branch and task discipline

- Begin ordinary work from an updated `dev` branch and use a short-lived task branch.
- Do not modify or merge `main` unless the task explicitly concerns a verified milestone promotion.
- One task must have one outcome, defined scope, acceptance criteria, and verification commands.
- Preserve unrelated local changes. Never reset, discard, or overwrite work merely to obtain a clean tree.
- Avoid broad cleanup, framework replacement, combat retuning, or unrelated refactoring during a feature or bug fix.

## Authoritative data and calculations

- `packages/client/src/data/parts/parts.json` is the authoritative authored parts catalog.
- Never silently normalize, regenerate, delete, or overwrite authored catalog fields.
- Validation and verification must be read-only with respect to authored data.
- Use `packages/client/src/systems/parts/statResolver.ts` for resolved part values.
- Use `packages/client/src/systems/weight/mechWeight.ts` for weight states.
- Ground capacity comes from the equipped ground-mobility part's `ratedLoad`.
- Flight capacity comes from `liftCapacity`; never substitute it for `ratedLoad`.
- UI modules display authoritative or resolved values and must not create duplicate calculation systems.

## Runtime boundaries

- `packages/client/src/test-map/main.ts` is the composition root.
- Keep orchestration there, but put reusable calculations, state policies, DOM rendering, and lifecycle behavior in focused modules.
- Do not broadly rewrite `main.ts`; extract only the smallest coherent boundary required by the task.
- Avoid circular imports back into `main.ts`.
- Changes limited to UI must not casually refactor combat, audio, networking, or world simulation.

## Accessibility requirements

- Critical gameplay information must remain available through audio, speech, semantic HTML, and keyboard interaction.
- Do not require color, pointer use, visual meters, or visual inspection as the only interaction or test method.
- Preserve editable-control focus protection and predictable focus restoration.
- Every closing brace in new or modified TypeScript or JavaScript must have a trailing comment explaining what it closes.
- Test and diagnostic output must be understandable as plain text with NVDA.

## Debugging evidence ladder

1. Reproduce the failure.
2. Record exact expected and actual behavior.
3. Identify the responsible subsystem and authoritative data owner.
4. Add only diagnostics that distinguish plausible causes.
5. Prove the root cause.
6. Add a failing regression test where practical.
7. Apply the smallest focused fix.
8. Remove temporary diagnostics unless they retain operational value.
9. Run automated verification.
10. Perform the narrow manual regression check.

Do not make successive speculative edits across unrelated files.

## Required verification

- During implementation: `npm run verify:quick`.
- Before commit or completion: `npm run verify`.
- For audio, browser, keyboard, NVDA, focus, and gameplay behavior, perform and record the relevant manual checks from `SESSION_NOTES.md`.
- Automated success must never be reported as manual gameplay or accessibility verification.

## Completion report

State:

- Exact files changed.
- Automated commands run and whether they passed.
- Manual checks completed.
- Manual checks Anthony still needs to perform.
- Known risks, failures, or deferred work.
