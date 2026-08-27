# Development Baseline and Codex Workflow Design

Date: 2026-08-27
Repository: `https://github.com/antlaw0/Mech-Audio-Game`
Candidate baseline branch: `dev`

## 1. Purpose

Establish a trustworthy development baseline and a repeatable Codex CLI workflow before adding more gameplay features. The workflow must prevent speculative multi-file fixes, protect authoritative authored data, distinguish automated evidence from manual gameplay verification, and keep the project easy to resume after a break.

## 2. Current Evidence

The July 18 documentation update exists on `dev` at commit `cac486b`, while `main` remains at commit `2b18ce7` from May 9.

A clean checkout of `dev` currently has these limitations:

- `npm run typecheck` fails before `packages/shared/dist` exists.
- `npm run build` attempts client and server builds before the shared package has been built and therefore fails from a clean checkout.
- Building `@mech-audio/shared` first allows the existing workspace type checks to pass.
- The repository has no automated test files.
- The repository has no standard `npm run verify` command.
- `docs/CURRENT_STATE.md` still describes an uncompleted return-to-development baseline.
- `docs/PROJECT_INDEX.md` and `docs/FILE_OWNERSHIP.md` are placeholders rather than useful navigation documents.
- The repository has no root `AGENTS.md` containing Codex CLI operating instructions.

These findings mean `dev` is the correct candidate branch but is not yet a verified baseline.

## 3. Branch Strategy

Preserve `main` unchanged while the baseline is established.

1. Perform baseline work against `dev`, using short-lived branches where practical.
2. Merge completed baseline tasks back into `dev` only after their automated checks pass.
3. Complete the manual smoke-test record against an exact `dev` commit.
4. Tag the verified baseline commit.
5. Merge the verified `dev` milestone into `main`.

After the baseline milestone, ordinary feature and bug-fix branches begin from an updated `dev` branch. Verified work returns to `dev`. Stable milestones, rather than every individual change, move from `dev` to `main`.

## 4. Recovery Boundary

The baseline phase includes:

- Repairing clean-checkout build and type-check ordering.
- Establishing standard automated verification commands.
- Adding focused validators and regression tests.
- Adding Codex repository instructions.
- Replacing navigation-document placeholders with useful content.
- Completing the documented Windows, browser, audio, keyboard, screen-reader, and gameplay smoke test.
- Recording evidence in `docs/CURRENT_STATE.md`.
- Creating a named baseline tag and merging the verified milestone.

The baseline phase excludes:

- New gameplay features.
- Broad refactoring of `packages/client/src/test-map/main.ts`.
- Pause-menu redesign.
- New missions, facilities, shops, factions, or world content.
- Combat retuning.
- Framework replacement.
- Unrelated cleanup.
- Changes to authored part values except a separately approved correction supported by evidence.

## 5. Automated Verification Architecture

### 5.1 Commands

The repository will expose two standard automated entry points.

`npm run verify:quick` is the normal inner-loop command. It will:

1. Build prerequisites required by downstream TypeScript imports.
2. Run workspace type checks in a deterministic dependency order.
3. Run data validators.
4. Run the focused automated test suite.

`npm run verify` is the pre-commit and milestone command. It will:

1. Start from a controlled generated-output state without altering authored source data.
2. Build workspaces in dependency order.
3. Run the complete type check, validator, and automated test suite.
4. Exit nonzero when any stage fails.

Neither command will start the browser game or claim that gameplay behavior was manually verified.

### 5.2 Failure output

Verification output must be concise and meaningful without color or visual reports. A failure must name the responsible check and, where applicable, the file, definition ID, field, or expected behavior.

### 5.3 Focused initial coverage

The first safety net will cover high-risk pure logic rather than attempting to retrofit the entire runtime at once:

- The authoritative parts catalog loads without removing manually authored properties.
- Applicable ground-mobility parts have valid `ratedLoad` values.
- Equipped ground mobility determines ground carrying capacity.
- Flight lift capacity remains separate from ground `ratedLoad`.
- Resolved part statistics correctly apply integrity, variants, chips, and effect modifiers.
- Inventory add, remove, stacking, and capacity operations.
- Seeded loot generation is repeatable.
- Heat threshold transitions.
- Energy depletion, regeneration delay, and regeneration.
- Chunk-coordinate boundary calculations.

Tests must exercise the existing public seams where available. Production restructuring is permitted only when a very small extraction is required to make important pure logic testable, and that extraction must preserve behavior.

## 6. Manual Baseline

Automated checks cannot verify the audio-first player experience. A manual smoke test will therefore be performed on Anthony's Windows development machine against an exact commit.

The smoke test will record:

- Windows, Node, npm, browser, audio output, and assistive-technology versions.
- Installation, build, verification, and playtest-startup results.
- Browser and audio initialization.
- Pause, overlays, developer tools, focus movement, and focus restoration.
- Ground movement, collision, mobility, flight, and weight restrictions.
- Weapons, melee, heat, energy, damage, targeting, locks, missiles, and enemies.
- Pickups, containers, inventory, garage, equipment changes, persistence, and reload.
- Ground `ratedLoad` behavior and its separation from flight lift capacity.
- Keyboard behavior in editable controls using NVDA.

Each result will be recorded as Pass, Broken, Uncertain, or Not Implemented. Broken results require exact reproduction steps, expected behavior, actual behavior, frequency, blocking status, likely files, and relevant diagnostic output.

Compilation or automated-test success must never be recorded as manual gameplay verification.

## 7. Codex CLI Operating Model

Each development cycle will follow this sequence:

1. Update and confirm a clean base branch.
2. Define one outcome in `SESSION_NOTES.md` with scope, authoritative files, acceptance criteria, and verification commands.
3. Inspect the relevant implementation before editing.
4. Reproduce a bug and add a failing regression test where practical.
5. Make the smallest coherent change.
6. Run `npm run verify:quick` during iteration.
7. Run the relevant manual gameplay and accessibility checks.
8. Review the complete diff.
9. Run `npm run verify` before commit.
10. Update current-state or roadmap documentation only when project status actually changes.
11. Create one focused commit and push it.

Codex must report:

- Files changed.
- Automated commands run and their results.
- Manual checks completed.
- Manual checks still required.
- Known risks or unresolved failures.

## 8. Debugging Model

Bug fixes use an evidence ladder:

1. Reproduce the failure.
2. Record exact expected and actual behavior.
3. Identify the responsible subsystem and authoritative data owner.
4. Add only the diagnostics needed to distinguish plausible causes.
5. Prove the root cause from evidence.
6. Add a regression test where practical.
7. Apply the focused fix.
8. Remove temporary diagnostics unless they have lasting operational value.
9. Run the full automated verification command.
10. Perform the narrow manual regression check.

Codex must not attempt a sequence of speculative fixes across unrelated files. If evidence does not distinguish the cause, the next action is better instrumentation or a smaller reproduction.

## 9. Repository Instructions

A root `AGENTS.md` will encode these mandatory rules:

- Preserve user instructions and unrelated working-tree changes.
- Treat source code as implementation truth and report documentation conflicts.
- Treat `packages/client/src/data/parts/parts.json` as authoritative authored data.
- Never silently normalize, regenerate, delete, or overwrite authored part fields.
- Preserve the required explanatory comment after every closing brace in authored code.
- Keep `main.ts` as the composition root and avoid adding unrelated responsibilities.
- Avoid broad cleanup during a feature or bug-fix task.
- Do not duplicate authoritative calculations in UI code.
- Run the appropriate standard verification command before completion.
- Do not claim manual gameplay, audio, keyboard, or screen-reader behavior is verified from automated checks.
- State exactly what changed, what passed, and what remains for Anthony to verify.

## 10. Documentation Responsibilities

Active documents will have non-overlapping purposes:

- `AGENTS.md`: mandatory Codex operating rules.
- `AI_CONTEXT.md`: stable architecture, ownership, and accessibility constraints.
- `SESSION_NOTES.md`: the current task only.
- `docs/CURRENT_STATE.md`: evidence-backed implementation and verification state.
- `docs/ROADMAP.md`: milestone order and status.
- `docs/PROJECT_INDEX.md`: concise navigation map for important systems.
- `docs/FILE_OWNERSHIP.md`: authoritative ownership and change boundaries.
- `docs/ARCHITECTURE.md`: runtime structure and system relationships.
- `docs/archive/`: historical material that does not direct current work.

Active documentation will use Codex-neutral or Codex-specific language rather than Copilot-specific workflow rules. Historical documents may retain original wording inside the archive.

## 11. Baseline Completion Criteria

The recovery milestone is complete only when:

- A clean checkout can install dependencies and run `npm run verify` successfully.
- Workspace builds occur in deterministic dependency order.
- Focused validators and regression tests pass.
- Manual smoke-test results are recorded against an exact commit.
- Known failures have reproducible issue records.
- Documentation matches the tested source and contains no active placeholder navigation files.
- The working tree is clean after committing the baseline record.
- The verified `dev` commit has a descriptive baseline tag.
- The verified milestone is merged into `main`.

Passing automated checks alone is insufficient to satisfy the milestone.

## 12. First Work Sequence

Implementation will be planned as independently reviewable tasks in this order:

1. Repair dependency-ordered build and type-check commands.
2. Establish the test runner and `verify:quick`/`verify` entry points.
3. Add parts-catalog and `ratedLoad` protections.
4. Add focused pure-logic regression tests for the remaining selected systems.
5. Add `AGENTS.md` and reconcile active workflow language.
6. Populate the project index and file-ownership guide from the current source tree.
7. Run and record the manual baseline.
8. Resolve only baseline-blocking defects through separate focused tasks.
9. Tag the verified baseline and merge the milestone to `main`.
