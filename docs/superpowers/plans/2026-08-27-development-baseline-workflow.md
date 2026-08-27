# Development Baseline and Codex Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `dev` a reproducible, tested, documented candidate baseline that can be manually smoke-tested and then promoted to `main`.

**Architecture:** Keep production behavior unchanged while repairing workspace dependency ordering, adding a lightweight TypeScript test runner, and testing existing pure-logic seams. Add small pure modules only where important heat and energy calculations are currently trapped inside `main.ts`; keep orchestration and mutable runtime state in `main.ts`.

**Tech Stack:** Node.js 20+, npm 10+, npm workspaces, TypeScript, `tsx`, Node's built-in `node:test` and `node:assert/strict` APIs.

**Spec:** `docs/superpowers/specs/2026-08-27-development-baseline-workflow-design.md`

## Global Constraints

- Work from a branch based on `dev`; do not modify `main` during implementation.
- Do not add gameplay features, retune combat, redesign UI, replace frameworks, or broadly refactor `main.ts`.
- `packages/client/src/data/parts/parts.json` is authoritative authored data and must not be rewritten by verification.
- Keep ground `ratedLoad` independent from flight `liftCapacity`.
- Every closing brace in new or modified TypeScript or JavaScript must have a trailing comment explaining what it closes.
- Automated success must not be described as manual gameplay, audio, keyboard, or screen-reader verification.
- Preserve unrelated user changes and commit each task separately.

---

### Task 1: Make clean builds dependency ordered

**Files:**
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: workspace scripts from `packages/shared`, `packages/client`, and `packages/server`.
- Produces: deterministic root commands `build`, `typecheck`, `build:shared`, `build:client`, and `build:server`.

- [ ] **Step 1: Reproduce the clean-output failure**

Remove only ignored workspace outputs (`packages/shared/dist`, `packages/client/dist`, and `packages/server/dist`) and run:

```bash
npm run typecheck
npm run build
```

Expected before the fix: both commands exit nonzero because client and server cannot resolve the unbuilt shared package.

- [ ] **Step 2: Replace unordered workspace traversal**

Change the root scripts to use explicit dependency order:

```json
"build": "npm run build:shared && npm run build:client && npm run build:server",
"typecheck": "npm run build:shared && npm run typecheck:workspaces",
"typecheck:workspaces": "npm run typecheck -w @mech-audio/shared && npm run typecheck -w @mech-audio/client && npm run typecheck -w @mech-audio/server"
```

Keep the existing per-workspace build aliases. Do not use the ambiguous single-hyphen `-ws` form.

- [ ] **Step 3: Verify from absent generated output**

Run:

```bash
npm run build
npm run typecheck
```

Expected: both commands exit 0 from a clean generated-output state.

- [ ] **Step 4: Correct the README commands**

State that root build and typecheck commands establish their shared-package prerequisite automatically. Keep the warning that browser execution uses compiled client output.

- [ ] **Step 5: Commit**

```bash
git add package.json README.md
git commit -m "build: order workspace verification dependencies"
```

### Task 2: Establish the automated test and verification entry points

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/smoke.test.ts`
- Create: `scripts/clean-generated.mjs`

**Interfaces:**
- Consumes: dependency-ordered `build` and `typecheck` commands from Task 1.
- Produces: `test`, `validate`, `verify:quick`, and `verify` root scripts.

- [ ] **Step 1: Install the TypeScript test launcher**

Run:

```bash
npm install --save-dev tsx@^4.20.6
```

- [ ] **Step 2: Add a failing smoke test**

Create `tests/smoke.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'

test('test runner executes TypeScript', () => {
  assert.equal(1 + 1, 2)
} // end test TypeScript runner)
```

Before adding the root `test` script, run `npm test` and expect failure because no test script exists.

- [ ] **Step 3: Add a safe generated-output cleaner**

Create `scripts/clean-generated.mjs` using `rm(path, { force: true, recursive: true })` only for these resolved paths:

- `packages/shared/dist`
- `packages/client/dist`
- `packages/server/dist`

The script must validate that every target is beneath the resolved repository root before deleting it. It must not touch `parts.json` under `src`, `node_modules`, saves, exports, or user content.

- [ ] **Step 4: Add root verification scripts**

Add:

```json
"clean:generated": "node ./scripts/clean-generated.mjs",
"test": "tsx --test tests/**/*.test.ts",
"validate": "node ./scripts/validate-data.mjs",
"verify:quick": "npm run typecheck && npm run validate && npm test",
"verify": "npm run clean:generated && npm run build && npm run validate && npm test"
```

Task 3 will create `validate-data.mjs`; `verify:quick` is expected to fail at that missing entry point until Task 3 completes.

- [ ] **Step 5: Verify the test runner independently**

Run:

```bash
npm test
```

Expected: one passing test and exit code 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tests/smoke.test.ts scripts/clean-generated.mjs
git commit -m "test: add baseline verification entry points"
```

### Task 3: Protect the authored parts catalog and repair catalog apply

**Files:**
- Create: `scripts/lib/parts-catalog-validation.mjs`
- Create: `scripts/validate-data.mjs`
- Modify: `scripts/apply-catalog-export.mjs`
- Test: `tests/parts-catalog-validation.test.ts`

**Interfaces:**
- Produces: `validatePartsCatalog(rawCatalog, sourceLabel)` returning the original parsed definitions after validation and throwing descriptive errors on invalid content.
- Consumes: `packages/client/src/data/parts/parts.json` without writing it.

- [ ] **Step 1: Write failing validator tests**

Tests must prove:

- The current source catalog validates.
- Duplicate IDs fail with the ID in the message.
- Non-finite required numbers fail with `definitionId.field` in the message.
- Every non-deprecated `GroundMobility` definition requires a finite, positive `ratedLoad`.
- `liftCapacity` does not satisfy the `ratedLoad` requirement.
- Unknown properties survive validation unchanged; validation must not normalize or rebuild the objects.

Run:

```bash
npm test -- tests/parts-catalog-validation.test.ts
```

Expected: fail because the validator module does not exist.

- [ ] **Step 2: Implement read-only validation**

Define the supported categories from `PART_CATEGORIES` in `packages/client/src/data/parts/types.ts`, including `ThermalRegulator`, `GroundMobility`, `Chip`, `HandWeapon`, and `ShoulderWeapon`. Check identity, category, required base numeric fields, duplicate IDs, and the ground-mobility rule. Return the input array without serializing, normalizing, or writing it.

- [ ] **Step 3: Add the validation command**

`scripts/validate-data.mjs` must read and parse the authoritative catalog, call `validatePartsCatalog`, print the catalog path and definition count, and exit nonzero with a concise message on failure.

- [ ] **Step 4: Repair the catalog-apply parser without expanding its authority**

Fix the missing comma between `'ratedLoad'` and `'heatGeneration'`. Replace its stale category list with the complete current categories. Reuse the shared validator before any backup or write occurs. Preserve the existing explicit `--allow-parts-json-write` requirement.

- [ ] **Step 5: Verify read-only behavior**

Record the source hash, run validation, and compare it again:

```bash
git hash-object packages/client/src/data/parts/parts.json
npm run validate
git hash-object packages/client/src/data/parts/parts.json
```

Expected: identical hashes and a successful validation.

- [ ] **Step 6: Run focused and full automated checks**

```bash
npm test -- tests/parts-catalog-validation.test.ts
npm run verify:quick
```

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/parts-catalog-validation.mjs scripts/validate-data.mjs scripts/apply-catalog-export.mjs tests/parts-catalog-validation.test.ts
git commit -m "test: protect authoritative parts catalog"
```

### Task 4: Test weight, resolved part statistics, inventory, and loot

**Files:**
- Test: `tests/mech-weight.test.ts`
- Test: `tests/part-stat-resolver.test.ts`
- Test: `tests/inventory-manager.test.ts`
- Test: `tests/loot-generator.test.ts`

**Interfaces:**
- Consumes: `getTotalMechWeight`, `getOverencumbranceState`, `configurePartStatResolver`, `getFinalPartStats`, `createItemDatabase`, `createInventoryManager`, and `createLootGenerator`.
- Produces: regression protection only; no production API changes are planned.

- [ ] **Step 1: Add weight tests**

Cover negative-input clamping and exact state boundaries at ratios `1`, `1.5`, and `2`. Include a fixture where a ground part has `ratedLoad: 100` and a flight utility has `liftCapacity: 40`; assert ground state is calculated from 100, not 40.

- [ ] **Step 2: Add part-stat resolver tests**

Use in-memory definitions and instances. Cover full integrity, damaged integrity, additive and multiplicative modifiers, supported chip memory, and an active chip rejected when compute capacity is exhausted. Reconfigure the resolver inside each test so global lookup state cannot leak between fixtures.

- [ ] **Step 3: Add inventory tests**

Cover unknown-item rejection, integer quantity normalization, add/remove, stable sorted stacks, cargo weight, drop, transfer, and category filtering. Assert the actual current behavior rather than inventing enforcement for `maxStackSize`; if stack limits are a desired feature, record it separately.

- [ ] **Step 4: Add deterministic loot tests**

Inject a fixed sequence function through `LootGeneratorOptions.random`. Cover chance pass/fail, inclusive minimum/maximum quantity, duplicate-entry merging, stable sorting, unknown item IDs, and missing table IDs.

- [ ] **Step 5: Run the focused files and the quick suite**

```bash
npm test -- tests/mech-weight.test.ts tests/part-stat-resolver.test.ts tests/inventory-manager.test.ts tests/loot-generator.test.ts
npm run verify:quick
```

Expected: all tests pass and verification exits 0.

- [ ] **Step 6: Commit**

```bash
git add tests/mech-weight.test.ts tests/part-stat-resolver.test.ts tests/inventory-manager.test.ts tests/loot-generator.test.ts
git commit -m "test: cover core parts inventory and loot logic"
```

### Task 5: Extract and test heat and energy policy

**Files:**
- Create: `packages/client/src/test-map/resource-policy.ts`
- Modify: `packages/client/src/test-map/main.ts`
- Test: `tests/resource-policy.test.ts`

**Interfaces:**
- Produces: `HeatState`, `resolveHeatState(heatValue, maxHeatValue, previousState)`, `getEnergyHeatMultiplier(heatState)`, and `calculateEnergyRegeneration(input)`.
- `calculateEnergyRegeneration` consumes `{ basePerSecond, weightFactor, heatMultiplier, runtimeMultiplier }` and returns a nonnegative number before conditional part effects.

- [ ] **Step 1: Write failing policy tests**

Cover heat boundaries at 40%, 65%, 85%, and 100%; overheat hysteresis above and at 25%; multipliers `1`, `0.8`, `0.55`, `0.25`, and `0`; and regeneration multiplication with negative inputs clamped to zero.

Run:

```bash
npm test -- tests/resource-policy.test.ts
```

Expected: fail because `resource-policy.ts` does not exist.

- [ ] **Step 2: Implement the pure policy module**

Move only the heat-state decision and pure multiplication policy. Do not move player state, audio calls, part-effect diagnostics, or frame-loop behavior.

- [ ] **Step 3: Replace duplicate logic in `main.ts`**

Import the policy functions. Keep `updateHeatState`, shutdown effects, profile selection, weight calculation, and `applyPartEffectsWithDiagnostics` in `main.ts`. The runtime result must remain equivalent.

- [ ] **Step 4: Run automated verification**

```bash
npm test -- tests/resource-policy.test.ts
npm run verify:quick
```

Expected: pass.

- [ ] **Step 5: Perform narrow manual regression**

Start the playtest and verify heat state announcements, overheat shutdown, recovery at 25%, and energy regeneration at normal and elevated heat. Record manual results; do not block the code commit if Anthony must perform the NVDA/audio judgment later, but state that it remains required.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/test-map/resource-policy.ts packages/client/src/test-map/main.ts tests/resource-policy.test.ts
git commit -m "refactor: isolate tested heat and energy policy"
```

### Task 6: Test chunk-coordinate boundaries

**Files:**
- Create: `packages/client/src/test-map/chunk-coordinates.ts`
- Modify: `packages/client/src/test-map/world-streaming.ts`
- Test: `tests/chunk-coordinates.test.ts`

**Interfaces:**
- Produces: `toChunkCoordinate(value, chunkSize)`, `toChunkKey(chunkX, chunkY)`, and `getChunkDistance(observerX, observerY, chunkX, chunkY)`.
- Consumes: finite coordinates and a positive chunk size.

- [ ] **Step 1: Write failing boundary tests**

For chunk size 32, cover `0`, `31.999`, `32`, `63.999`, `64`, `-0.001`, and `-32`. Cover key formatting and Chebyshev chunk distance.

- [ ] **Step 2: Implement and adopt the pure helpers**

Move the existing formulas without changing default chunk size or streaming transitions. Throw a descriptive error for a non-finite or nonpositive chunk size.

- [ ] **Step 3: Verify**

```bash
npm test -- tests/chunk-coordinates.test.ts
npm run verify:quick
```

Expected: pass with unchanged build behavior.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/test-map/chunk-coordinates.ts packages/client/src/test-map/world-streaming.ts tests/chunk-coordinates.test.ts
git commit -m "test: protect world chunk boundaries"
```

### Task 7: Add Codex instructions and complete navigation documents

**Files:**
- Create: `AGENTS.md`
- Modify: `AI_CONTEXT.md`
- Modify: `SESSION_NOTES.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/PROJECT_INDEX.md`
- Modify: `docs/FILE_OWNERSHIP.md`

**Interfaces:**
- Consumes: the approved workflow specification and the current source tree.
- Produces: one unambiguous instruction hierarchy and current repository navigation.

- [ ] **Step 1: Write `AGENTS.md`**

Include the authority order, active branch policy, authoritative data paths, brace-comment accessibility rule, `main.ts` boundary, debugging evidence ladder, required verification commands, manual-verification distinction, dirty-worktree protection, and completion-report format from the approved specification.

- [ ] **Step 2: Reconcile active workflow language**

Replace active Copilot-specific instructions with Codex-neutral wording. Do not rewrite archived historical files. Change D0.1 to Verified only if its actual acceptance criteria are satisfied; set D0.2 and D0.3 to their evidence-backed states.

- [ ] **Step 3: Populate `PROJECT_INDEX.md`**

Index current entry points and the client systems for runtime orchestration, input/focus, rendering/collision, audio, combat/targeting, world streaming, parts/garage/weight, inventory/loot/pickups, persistence, server networking, shared types, scripts, and tests. Each entry must give a path and one-sentence responsibility.

- [ ] **Step 4: Populate `FILE_OWNERSHIP.md`**

For each authoritative area, state the owner, consumers, permitted changes, and prohibited duplication. Explicitly distinguish authored values, resolved runtime values, UI presentation, ground `ratedLoad`, and flight `liftCapacity`.

- [ ] **Step 5: Verify instructions and links**

Run:

```bash
rg -n "Copilot" AGENTS.md AI_CONTEXT.md SESSION_NOTES.md docs/ROADMAP.md docs/PROJECT_INDEX.md docs/FILE_OWNERSHIP.md
npm run verify
```

Expected: no active Copilot workflow dependency and verification passes.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md AI_CONTEXT.md SESSION_NOTES.md docs/ROADMAP.md docs/PROJECT_INDEX.md docs/FILE_OWNERSHIP.md
git commit -m "docs: establish Codex development workflow"
```

### Task 8: Record the manual playable baseline

**Files:**
- Modify: `docs/CURRENT_STATE.md`
- Modify: `SESSION_NOTES.md`
- Modify: `docs/ROADMAP.md`
- Create as needed: `docs/baseline-defects/<defect-id>.md`

**Interfaces:**
- Consumes: an exact `dev` commit for which `npm run verify` passes.
- Produces: evidence-backed manual results and reproducible records for failures.

- [ ] **Step 1: Record environment and commit metadata**

Run the commands already specified in `SESSION_NOTES.md` and record branch, commit, working-tree state, Node, npm, Windows, browser, audio output, and NVDA version.

- [ ] **Step 2: Run full automated verification**

```powershell
npm ci
npm run verify
```

Record exit results and relevant failure text.

- [ ] **Step 3: Start the full playtest stack**

```powershell
npm run dev:playtest
```

Confirm client and server startup without treating startup as gameplay verification.

- [ ] **Step 4: Complete the smoke-test matrix**

Follow sections A through F in `SESSION_NOTES.md`. Record every item as Pass, Broken, Uncertain, or Not Implemented. Test focus and editable-control behavior with NVDA, including Tab, Shift+Tab, Escape, `M`, the developer-console key, and applicable function keys.

- [ ] **Step 5: Record every blocking defect separately**

Use the existing defect template. Do not fix defects during this documentation task. Select the first blocker as a new focused bug-fix task using the evidence ladder.

- [ ] **Step 6: Update milestone state**

Update `CURRENT_STATE.md`, `SESSION_NOTES.md`, and D0 roadmap statuses to match evidence. If blockers exist, D0.2 remains In Progress or Blocked. If none exist, mark D0.2 and D0.3 Verified.

- [ ] **Step 7: Commit**

```bash
git add docs/CURRENT_STATE.md SESSION_NOTES.md docs/ROADMAP.md docs/baseline-defects
git commit -m "chore: record playable demo baseline"
```

### Task 9: Tag and promote the verified baseline

**Files:**
- No source-file changes expected.

**Interfaces:**
- Consumes: a clean `dev` commit with passing `npm run verify`, completed manual smoke results, and no unresolved baseline blocker.
- Produces: an annotated baseline tag and a verified merge to `main`.

- [ ] **Step 1: Confirm the promotion gate**

```bash
git status --short
git branch --show-current
git rev-parse HEAD
npm run verify
```

Expected: clean tree, branch `dev`, recorded commit, and exit code 0. Confirm the smoke-test record names the same commit and has no unresolved baseline blocker.

- [ ] **Step 2: Create and push the annotated tag**

Use a date-based tag whose exact name is recorded in `docs/CURRENT_STATE.md`, for example:

```bash
git tag -a baseline-2026-08-27 -m "Verified playable development baseline"
git push origin dev baseline-2026-08-27
```

- [ ] **Step 3: Merge the verified milestone**

Update local `main`, merge `dev` with a merge commit, run verification again, and push only if it remains successful:

```bash
git switch main
git pull --ff-only origin main
git merge --no-ff dev -m "merge: promote verified development baseline"
npm run verify
git push origin main
```

- [ ] **Step 4: Return to development branch**

```bash
git switch dev
git status --short --branch
```

Expected: clean `dev` branch ready for the next narrowly scoped roadmap task.
