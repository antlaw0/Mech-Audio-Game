# AI_CONTEXT.md — Mech Audio Game Operating Guide

## Purpose

This document is the stable working guide for humans and coding agents operating in the Mech Audio Game repository.

It defines:

- authority order when project materials disagree
- current architecture boundaries
- safe editing and validation rules
- accessibility and coding requirements
- how to keep AI-driven changes narrow, reviewable, and reversible

It is intentionally **not** a complete gameplay specification, roadmap, or file-by-file encyclopedia.

Use `docs/PROJECT_INDEX.md` for navigation. Use `MasterSpecDoc.md` for game-design intent. Use the current source code for the actual implementation.

---

## 1. Authority Order

When information conflicts, use this order:

1. **Current source code** is the implementation truth.
2. **SESSION_NOTES.md**, when present, defines the current task, permitted scope, and temporary constraints.
3. **MasterSpecDoc.md** is the canonical gameplay and design authority.
4. **IMPLEMENTATION_ROADMAP.md** describes planned work, ticket constraints, and unfinished systems.
5. **docs/PROJECT_INDEX.md** is the repository navigation and subsystem ownership map.
6. **This file** defines stable operating conventions.

Do not use an older document to override verified current code.

If intended design and current implementation conflict:

- do not silently “fix” either one
- identify the conflict
- report it before changing behavior
- follow the active task scope or explicit human decision

---

## 2. Current Project Reality

Mech Audio Game is an audio-first browser mech-combat project built as a TypeScript npm-workspace monorepo.

Current architecture:

```text
packages/client
  Browser-side test-map runtime and UI

packages/server
  Node/WebSocket authoritative simulation scaffolding

packages/shared
  Shared types, schemas, constants, and utilities
```

The current browser game runtime is centered on:

```text
packages/client/src/test-map/main.ts
```

The test map uses focused TypeScript modules for input, player state, ECS combat, targeting, collision, map data, Three.js rendering, audio, awareness feedback, developer tooling, and update orchestration.

The browser loads compiled client output from:

```text
packages/client/dist/test-map/main.js
```

Editable client source lives under:

```text
packages/client/src/
```

Never hand-edit generated output in `packages/client/dist/`.

---

## 3. Technology and Runtime Boundaries

### Browser client

The client workspace currently uses:

- TypeScript
- Three.js for the active test-map rendering system
- Web Audio API and Tone.js for audio systems
- bitecs for ECS-style combat state
- HTML/CSS DOM overlays for HUD, pause, editor, navigation, and developer-facing UI

Phaser remains a package dependency, but code changes must follow the **current active implementation**, not assumptions about a Phaser-only architecture.

### Server

The server workspace contains:

- Node.js TypeScript code
- WebSocket server scaffolding
- authoritative-world simulation scaffolding
- Colyseus-related code that is intentionally deferred for the current milestone

Do not introduce multiplayer authority rules into a local client-only feature unless the task specifically requires it.

### Shared workspace

Use `packages/shared` for any contract needed by both client and server, including:

- shared world-state types
- network payload types
- network schemas
- shared constants
- shared utilities

Do not create separate client and server versions of the same protocol or world contract.

---

## 4. Source Ownership Rules

Use `docs/PROJECT_INDEX.md` to locate the owning subsystem before editing.

General ownership rules:

| Behavior | Preferred owner |
|---|---|
| Static page markup, overlay markup, page-level CSS | `test-map.html` |
| Test-map runtime composition and DOM wiring | `packages/client/src/test-map/main.ts` |
| Input bindings and normalized input state | `packages/client/src/test-map/input.ts` |
| Player defaults/state shape | `packages/client/src/test-map/player-state.ts` |
| Frame update orchestration | `packages/client/src/test-map/update.ts` |
| Combat ECS/projectiles/enemy combat simulation | `packages/client/src/test-map/combat-ecs.ts` |
| Player weapon definitions | `packages/client/src/test-map/weapons.ts` |
| Target locking | `packages/client/src/test-map/target-lock.ts` |
| Collision world and blocking | `packages/client/src/test-map/world-collision.ts` |
| Three.js rendering | `packages/client/src/test-map/three-render.ts` |
| Audio controller and spatial/game feedback | `packages/client/src/test-map/audio.ts` and related audio modules |
| Shared client/server contracts | `packages/shared/src/*` |
| Server world simulation and protocol handling | `packages/server/src/*` |

### UI ownership rule

UI layers may display values owned by gameplay systems.

UI layers must **not** become a second calculation engine for:

- aggregate mech stats
- combat damage
- collision
- movement
- heat
- energy
- audio state
- networking state

The preferred flow is:

```text
owning system
  → read-only summary/helper
  → UI display
```

Not:

```text
UI display
  → reimplements gameplay formulas
```

### Composition-root rule

`main.ts` is a runtime composition root. It may wire systems together and bind DOM behavior.

Do not place a large new reusable subsystem in `main.ts` when a focused module is appropriate. Also do not perform broad file splitting or architectural cleanup during a small feature or bug fix unless that refactor is explicitly the task.

---

## 5. Accessibility Is a Functional Requirement

The game must remain workable for screen-reader and keyboard users.

For HTML/DOM UI:

- use semantic native elements first
- give every interactive control a clear accessible name
- use native buttons for actions
- use real headings, labels, lists, tables, descriptions, and status regions where appropriate
- maintain predictable keyboard focus movement
- do not trap focus in overlays or dialogs
- use correct ARIA patterns only when native HTML is not sufficient
- ensure tabs, dialogs, menus, and editable controls expose their selected/open/disabled state
- avoid relying on color, animation, or canvas-only information for required gameplay state
- keep content readable under magnification and avoid visual effects that obscure important information

For audio feedback:

- audio must complement, not block, input or gameplay
- direction, distance, target, warning, confirmation, and error feedback should be distinguishable
- audio-only mechanics should have an inspectable/debuggable state where practical

For coding-agent output:

- explain changed files and validation results in text
- do not rely on visual-only instructions such as “click the highlighted area”
- preserve the project's brace-tracking comments

---

## 6. TypeScript and Code Style

### Required practices

- Use TypeScript for source changes.
- Use explicit imports and exports.
- Preserve existing naming and formatting conventions in the target file.
- Prefer focused functions with explicit input and return types.
- Prefer named constants/configuration over unexplained magic numbers.
- Prefer existing helpers over duplicated logic.
- Avoid dead code, placeholder systems, and speculative abstractions unless explicitly requested.
- Do not add dependencies for an ordinary feature or bug fix without approval.

### Brace-tracking requirement

Every closing curly brace `}` in source code must include a trailing comment stating what it closes.

Examples:

```ts
if (isPaused) {
  return
} // end if game is paused

const createThing = (): Thing => {
  return thing
} // end function createThing

class AudioController {
  // ...
} // end class AudioController
```

Keep these comments accurate whenever code is moved or edited.

### Comment rule

Comments should explain **why** a decision exists, especially when a rule is non-obvious. Do not narrate code that is already clear from names and structure.

---

## 7. Safe AI Execution Protocol

This applies to Codex, Claude, Copilot, Continue, Gemini, local models, and future coding tools.

### Before editing

1. Read the current task instructions and this file.
2. Read `docs/PROJECT_INDEX.md`.
3. Identify the smallest likely owning module(s).
4. Inspect the current implementation before proposing edits.
5. Confirm that expected functions, IDs, types, and code paths actually exist.
6. If required context is missing or contradictory, stop and report the evidence. Do not guess.

### During editing

1. Use an explicit file allowlist.
2. Make the smallest change that satisfies the task.
3. Preserve existing behavior outside the stated task.
4. Reuse existing formulas, state, helpers, and architecture.
5. Do not reformat, rename, reorganize, or refactor unrelated code.
6. Do not modify generated files.
7. Do not modify package manifests, lockfiles, build configuration, or unrelated data files unless the task explicitly permits it.
8. Do not silently add a second source of truth.

### After editing

1. Report exact files changed.
2. Run the narrowest relevant validation command.
3. Run `git diff --check`.
4. Report validation output and errors exactly.
5. Review the resulting `git diff` before committing.
6. Do not make opportunistic follow-up cleanup changes.

### Default prohibited edits

Unless the current task explicitly permits them, do not edit:

```text
packages/client/dist/
package.json
package-lock.json
workspace/build configuration
parts/catalog source data
unrelated feature modules
```

---

## 8. Validation Commands

Run commands from the repository root unless a task says otherwise.

### Type-check all workspaces

```powershell
npm run typecheck
```

### Build all workspaces

```powershell
npm run build
```

### Build client only

```powershell
npm run build:client
```

### Build server only

```powershell
npm run build:server
```

### Start client watch + static server

```powershell
npm run dev
```

### Start full local playtest stack

```powershell
npm run dev:playtest
```

### Validate pending changes

```powershell
git diff --check
git diff
git status
```

Use the narrowest command set that proves the change. For a TypeScript client UI change, that usually means:

```powershell
npm run typecheck
npm run build:client
git diff --check
```

Then perform the relevant manual in-game verification.

---

## 9. Git Safety Rules

Use a dedicated branch for each isolated feature or bug fix.

Example:

```powershell
git switch -c ai-work/descriptive-task-name
```

Before giving a coding agent write access:

```powershell
git status
```

After it edits:

```powershell
git diff --check
git diff
git status
```

Do not commit generated output unless the repository’s established workflow explicitly requires it.

Do not let an agent commit, push, reset, rebase, force-push, delete branches, or discard changes unless explicitly instructed.

---

## 10. Documentation Roles

| Document | Role |
|---|---|
| `MasterSpecDoc.md` | Gameplay and design authority |
| `IMPLEMENTATION_ROADMAP.md` | Planned work, tickets, and implementation constraints |
| `docs/PROJECT_INDEX.md` | Navigation map and subsystem ownership guide |
| `SESSION_NOTES.md` | Current task scope, local decisions, known issue, and validation plan |
| `AI_CONTEXT.md` | Stable operating rules for humans and coding agents |
| Source code | Actual current implementation truth |

Avoid duplicating a whole system spec across several documents.

When documentation becomes stale, update or remove it rather than letting it silently become a false authority.

---

## 11. Current Task Notes Convention

For complex or multi-session work, create `SESSION_NOTES.md` at the repository root using this shape:

```md
# Current Task

## Goal

[One sentence.]

## Allowed Files

- `path/to/file.ts`
- `path/to/file.html`

## Must Not Change

- [Files, formulas, generated output, or behavior that is out of scope.]

## Existing Source of Truth

- [Owning module or helper.]

## Validation

```powershell
npm run typecheck
npm run build:client
git diff --check
```

## Manual Verification

- [Exact in-game behavior to test.]

## Notes / Decisions

- [Only current, relevant decisions.]
```

Delete or replace task-specific notes when the task is complete. Do not let this become a permanent second roadmap.

---

## 12. Final Operating Principle

Work from evidence, not assumptions.

A successful change is:

- scoped
- inspectable
- accessible
- validated
- reversible
- consistent with the owning subsystem
- free of hidden duplicate logic

When a task is ambiguous, ask the codebase what it already does before designing a new answer.
