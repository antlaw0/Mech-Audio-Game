# Mech Audio Game: AI Context

Last reviewed: 2026-07-18  
Primary repository: `https://github.com/antlaw0/Mech-Audio-Game`  
Active development branch: `dev`

This document provides stable repository-wide context for AI assistants and human contributors. It describes the current architecture, authoritative data ownership, development rules, and near-term product direction.

It is not a task tracker, an implementation diary, or a substitute for inspecting the source code.

---

## 1. Authority Order

Use the following authority order when sources disagree:

1. The user's explicit instruction in the current conversation or task.
2. `SESSION_NOTES.md`, for the current task only.
3. `AI_CONTEXT.md`, for stable architecture and development rules.
4. `docs/CURRENT_STATE.md`, for recently audited implementation status.
5. `docs/ROADMAP.md`, for current priorities and sequencing.
6. Current source code and authored data, as implementation truth.
7. Archived documents, old roadmaps, and historical specifications.

Important rules:

- Source code is the final authority for what the project currently does.
- Authored data files are the final authority for content values assigned to them.
- A historical design document does not override working source code unless the current task explicitly restores that design.
- Never copy old assumptions into new code without verifying them against the active implementation.
- When documentation and source code conflict, report the conflict and use the smallest safe change that follows the current task.

---

## 2. Project Identity

Mech Audio Game is an audio-first browser-based mech combat game built as a TypeScript monorepo.

The game is designed so that critical gameplay information is available through audio, speech, semantic HTML, and keyboard interaction. Visual rendering supports sighted and low-vision players but must not be the only way to understand or operate the game.

The current development objective is a playable single-player demo built around the existing test-map runtime.

The target demo loop is:

1. Start at a friendly outpost.
2. Inspect the player's mech, equipment, inventory, and mission.
3. Receive or accept a mission.
4. Navigate through a streamed world.
5. Encounter and fight hostile entities.
6. Find or collect loot.
7. Complete the mission objective.
8. Return to the outpost.
9. Buy, sell, repair, or change equipment.
10. Save and restore the resulting state.

Optional multiplayer remains a future direction. Do not make the first playable demo depend on the multiplayer server.

---

## 3. Current Technology Stack

### Repository

- TypeScript monorepo
- npm workspaces
- Node.js 20 or later
- npm 10 or later

### Client

The primary active gameplay runtime is under:

`packages/client/src/test-map`

Important current client technologies include:

- TypeScript
- Three.js
- `three-mesh-bvh`
- `bitecs`
- Tone.js
- Web Audio API
- Resonance Audio
- Semantic HTML and browser DOM APIs

Phaser is installed in the client package, but AI must not assume Phaser owns the active test-map renderer. Inspect imports and current usage before modifying rendering code.

Do not introduce, remove, or replace a rendering or audio framework unless the current task explicitly requires it.

### Server and shared packages

The repository contains:

- A shared TypeScript package for common types, schemas, constants, and utilities.
- A plain WebSocket server path.
- A Colyseus server scaffold.
- Server-side world state and simulation modules.

These systems support future multiplayer work, but the current playable-demo priority is the local client runtime.

---

## 4. Monorepo Structure

```text
packages/
  client/
    src/
      data/
      net/
      systems/
      test-map/
      types/
      ui/
  server/
    src/
      colyseus/
      net/
      simulation/
      state/
  shared/
    src/
      constants/
      schemas/
      types/
      utils/
```

### Primary runtime entry points

- Browser shell: `test-map.html`
- Compiled client entry: `packages/client/dist/test-map/main.js`
- Source client entry: `packages/client/src/test-map/main.ts`
- WebSocket server entry: `packages/server/src/index.ts`
- Colyseus entry: `packages/server/src/colyseus/index.ts`

The browser loads compiled output. Changes made under `packages/client/src` will not appear in the browser until the client build or TypeScript watcher updates `packages/client/dist`.

---

## 5. Current Runtime Architecture

`packages/client/src/test-map/main.ts` is the primary runtime orchestrator. It currently wires together gameplay, UI, audio, combat, inventory, garage, targeting, world streaming, rendering, developer tools, and persistence.

This file has accumulated too many responsibilities.

### Rules for `main.ts`

- Preserve its role as the runtime composition root.
- Do not add a new independent system directly to `main.ts` when that system can have a focused module.
- Do not perform a broad rewrite of `main.ts`.
- Extract only the smallest coherent boundary required by the current task.
- Keep orchestration in `main.ts`; move reusable state, calculations, DOM rendering, and lifecycle behavior into focused modules.
- Avoid circular imports back into `main.ts`.
- Every extraction must preserve behavior before adding new behavior.
- A task that only changes UI must not casually refactor combat, audio, networking, or world simulation.

Examples of coherent extraction boundaries include:

- Player pause-menu controller
- Developer-tools overlay controller
- Mech-status snapshot adapter
- Facility interaction controller
- Mission state manager
- Faction relationship resolver
- Shop transaction service
- Reproducible debug scenario loader

The garage controller under `packages/client/src/ui/garage` is also large. Preserve its working behavior and relocate its presentation before attempting internal cleanup.

---

## 6. Authoritative Sources of Truth

Always identify the authoritative owner before changing or displaying a value.

### Part definitions

Authoritative authored file:

`packages/client/src/data/parts/parts.json`

Rules:

- Fixed part values such as weight, defense, energy drain, damage-related authored properties, and movement-part `ratedLoad` belong in `parts.json`.
- Do not silently rewrite, normalize away, regenerate, or delete manually authored fields.
- Browser-local catalog overrides are not the source of truth.
- The client build synchronizes the authoritative source catalog into compiled output.

### Part types and catalog loading

- Types: `packages/client/src/data/parts/types.ts`
- Catalog loader and persistence boundary: `packages/client/src/data/parts/catalog.ts`

### Resolved part statistics

Authoritative resolver:

`packages/client/src/systems/parts/statResolver.ts`

Use the resolver for final part values affected by integrity, variants, chips, and effect modifiers.

Do not duplicate resolved-stat formulas in a UI component.

### Part effects

Authoritative effect logic:

`packages/client/src/systems/parts/effectModifiers.ts`

### Mech weight and load behavior

Authoritative system:

`packages/client/src/systems/weight/mechWeight.ts`

Use the equipped movement system's authored `ratedLoad` for ground carrying capacity. Do not confuse ground `ratedLoad` with flight lift capacity.

### Garage

- Store and loadout mutation: `packages/client/src/ui/garage/store.ts`
- Garage UI controller: `packages/client/src/ui/garage/index.ts`
- Part-card UI: `packages/client/src/ui/components/PartCard.ts`

The garage store owns equip, unequip, inventory, and loadout mutation behavior.

The pause-menu status and loadout screens must not create a second garage state model.

### Items and inventory

- Item definitions: `packages/client/src/data/items`
- Item database: `packages/client/src/systems/inventory/itemDatabase.ts`
- Inventory state and operations: `packages/client/src/systems/inventory/inventoryManager.ts`

### Loot

- Loot table definitions: `packages/client/src/data/lootTables`
- Loot generation: `packages/client/src/systems/loot/lootGenerator.ts`

Use a seedable random source where reproducibility matters.

### Pickups and world items

- Pickup system: `packages/client/src/systems/pickup/pickupSystem.ts`
- World pickup representation: `packages/client/src/systems/pickup/pickupWorldSystem.ts`
- World-item persistence: `packages/client/src/systems/persistence/worldItemPersistence.ts`

### Controls and keyboard focus

- Control definitions and bindings: `packages/client/src/test-map/controls.ts`
- Input binding: `packages/client/src/test-map/input.ts`
- Editable-focus protection: `packages/client/src/test-map/keyboard-focus.ts`

Do not create a second independent keyboard binding layer for player menus or facilities.

### Rendering and collision

- Three.js renderer: `packages/client/src/test-map/three-render.ts`
- World collision and ray tracing: `packages/client/src/test-map/world-collision.ts`
- Map data: `packages/client/src/test-map/map-data.ts`
- Scene layout and current points of interest: `packages/client/src/test-map/scene-layout.ts`
- World streaming: `packages/client/src/test-map/world-streaming.ts`
- World map overlay: `packages/client/src/test-map/world-map-overlay.ts`

Read chunk size and streaming behavior from the current implementation or runtime configuration. Do not copy the obsolete 64-unit chunk assumptions from archived documentation.

### Combat and targeting

- Combat ECS: `packages/client/src/test-map/combat-ecs.ts`
- Target acquisition and lock state: `packages/client/src/test-map/target-lock.ts`
- Target subsystem layouts: `packages/client/src/test-map/target-layout.ts`
- Weapon definitions and behavior: `packages/client/src/test-map/weapons.ts`
- Enemy definitions: `packages/client/src/test-map/enemies`

Do not introduce a second damage-routing system.

### Audio

- Main runtime audio controller: `packages/client/src/test-map/audio.ts`
- Audio configuration: `packages/client/src/test-map/audio-config.ts`
- Audio utility functions: `packages/client/src/test-map/audio-utils.ts`
- Occlusion: `packages/client/src/test-map/audio-occlusion.ts`
- Shared spatial-audio wrapper: `packages/client/src/test-map/spatial-audio.ts`

Use semantic event meanings rather than scattering raw asset paths through unrelated systems.

### Runtime tuning and scheduling

- Runtime tuning: `packages/client/src/test-map/runtime-config.ts`
- Frame-budgeted scheduling: `packages/client/src/test-map/update-scheduler.ts`
- Player movement update: `packages/client/src/test-map/update.ts`

### Shared network contracts

Use `packages/shared` for types and schemas that genuinely cross client and server boundaries.

Do not move a client-only prototype type into `packages/shared` merely because it might become networked later.

---

## 7. Player UI Architecture

The project must use three distinct UI surfaces.

### 7.1 Player pause menu

The player pause menu is available during ordinary play and must contain player-facing information and settings.

Target sections:

- Mech Status
- Loadout
- Inventory and Cargo
- Map and Objectives
- Controls and Accessibility
- Options

The pause menu may allow inspection anywhere, but it must not allow garage-only equipment mutation.

### 7.2 Contextual facility screens

Facility screens become available only when the player interacts with a corresponding world access point.

Initial facility types:

- Garage
- Shop
- Mission terminal
- Repair point

The existing garage should be presented through this facility system rather than rewritten.

### 7.3 Developer tools

Developer-only interfaces include:

- Runtime statistics
- Event log
- Diagnostics
- Live tuning
- Spawn and mutation tools
- Editors
- Trace export
- Developer console

Developer tools must remain available during the player UI redesign, but they must not be presented as ordinary player pause-menu tabs.

---

## 8. Mech Status UI Rules

The Mech Status view must read from authoritative runtime snapshots and resolvers.

It should organize information into meaningful groups.

### Condition

- Core health
- Maximum health
- Subsystem integrity
- Online or offline status
- Active status effects

### Resources

- Current and maximum energy
- Energy regeneration
- Current and maximum heat
- Cooling rate
- Current heat state
- Current energy state

### Mobility

- Mobility type
- Forward, reverse, strafe, and turn values
- Acceleration and deceleration
- Total weight
- Ground `ratedLoad`
- Load ratio or weight factor
- Flight availability
- Flight lift capacity when applicable

### Defense

- Physical defense
- Energy defense
- Stagger resistance

### Combat

- Ready or selected weapon
- Damage
- Range
- Fire rate
- Damage type
- Ammunition
- Energy cost
- Heat generation
- Current target
- Lock stage
- Selected subsystem

Rules:

- Do not invent missing values.
- Do not show placeholder numbers as if they are authoritative.
- If a value is not implemented, omit it or clearly announce that it is unavailable.
- Prefer semantic headings and definition lists.
- Dynamic changes must be announced only when meaningful; do not create constant screen-reader chatter.
- Never require a visual chart to understand a stat.

---

## 9. Open-World Direction

The playable demo should be open-world-shaped but deliberately small.

Initial world content should be data-driven wherever practical:

- Points of interest
- Spawn zones
- Facilities
- Loot containers
- Mission objectives
- Shops
- Friendly, neutral, and hostile population definitions

### Entity model

Friendly, neutral, and hostile entities should share ordinary world and combat foundations where practical.

Differences should come from:

- Controller or behavior
- Faction
- Disposition
- Capabilities
- Role-specific data

Do not build completely separate engines for enemies, allies, and neutral actors.

### Factions and dispositions

The initial relationship results are:

- Hostile
- Friendly
- Neutral

Faction relationships should govern:

- Automatic targeting
- Aggression
- Assistance
- Friendly fire policy
- Protected mission targets
- Shop or facility access when later required

### Interactables

Use a common interaction foundation for:

- Garages
- Shops
- Mission terminals
- Repair points
- Loot containers
- Doors
- Communication terminals

An interactable should have a stable ID, kind, accessible name, position, interaction range, state, and activation handler or action reference.

### Missions

The first mission system should support:

- Visit a location
- Defeat specified entities
- Collect an item
- Interact with a world object
- Return or turn in

Do not begin with procedural missions, branching narrative graphs, or a reputation simulation.

### Shop economy

The first shop system needs only:

- Currency
- Shop stock
- Buy
- Sell
- Price
- Availability
- Confirmation
- Error feedback

Existing item and part definitions remain authoritative. Do not create duplicate shop-only item definitions.

---

## 10. Accessibility Requirements

Accessibility is a core gameplay requirement, not a later polish pass.

### Keyboard and focus

- Every player-facing action must be operable with a keyboard.
- Use semantic HTML controls before custom widgets.
- Do not use positive `tabindex` values.
- Do not trap focus except inside a true modal dialog.
- Restore focus to the logical triggering control when a dialog or facility closes.
- While focus is in `input`, `textarea`, `select`, or an editable region, gameplay and global hotkeys must not fire.
- `Tab` and `Shift+Tab` must move predictably through the active interface.
- `Escape` behavior must be deterministic and must not close unrelated layers.

### Screen-reader output

- Controls need unique accessible names.
- Use headings and landmarks to expose structure.
- Use status regions sparingly for important changes.
- Do not repeatedly announce rapidly changing telemetry.
- Use concise speech for combat-critical information.
- Provide a user-initiated status summary for dense information.

### Audio-first gameplay

- Direction, distance, elevation, threat, and state changes must be understandable without visuals.
- One audio cue should have one stable meaning.
- Avoid several simultaneous cues communicating the same fact.
- Important cues need sensible priority and interruption behavior.
- Audio assets must not block gameplay while loading.
- Dispose of audio nodes and loops when their owners are removed.

### Visual support

- Color must not be the only indicator.
- Text must remain usable with magnification.
- Avoid unnecessary motion and long animations.
- Player information must remain available through text and audio.

---

## 11. TypeScript and Code Conventions

### General

- Use TypeScript for project code.
- Prefer explicit parameter and return types for exported functions.
- Use `unknown` at untrusted boundaries and validate before use.
- Avoid `any` unless an external API boundary makes it unavoidable and the reason is documented.
- Prefer pure functions for calculations.
- Keep side effects at clear boundaries.
- Use explicit imports.
- Use existing project naming and module patterns.
- Do not reformat unrelated code.
- Do not rename unrelated symbols during a feature task.
- Do not create speculative abstractions for possible future systems.

### Naming

- File names: `kebab-case` unless an existing local convention requires otherwise.
- Functions and variables: `camelCase`
- Types, interfaces, and classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

### Closing-brace comments

Every closing brace `}` added or modified by AI must have a trailing comment that identifies what it closes.

Examples:

```ts
if (condition) {
  performAction()
} // end if condition

const calculateValue = (): number => {
  return 1
} // end function calculateValue

class AudioManager {
  public dispose(): void {
    // Dispose owned audio nodes.
  } // end method dispose
} // end class AudioManager
```

This requirement applies to TypeScript, JavaScript, JSON-like code examples that permit comments, PowerShell script blocks, and other brace-based source files when comments are syntactically valid.

Do not add illegal comments to strict JSON files.

### Error handling

- Fail with actionable messages at data boundaries.
- Do not silently replace invalid authored values with unrelated defaults.
- Missing optional audio assets may use the project's intended fallback behavior.
- Invalid gameplay data should be reported during validation rather than concealed at runtime.

---

## 12. Refactoring Rules

Refactoring is allowed when it directly reduces risk for the current feature.

A focused extraction is appropriate when code has:

- Independent state
- A clear lifecycle
- More than one public operation
- Reuse potential
- Independent testing value
- A distinct UI responsibility

Refactoring is not appropriate when it:

- Changes unrelated behavior
- Rewrites stable systems without acceptance criteria
- Renames large portions of the project
- Introduces a new framework
- Combines several roadmap tickets
- Moves code only to satisfy an arbitrary line-count target

Use this sequence:

1. Identify current behavior and source of truth.
2. Add a narrow adapter or test seam when needed.
3. Move one coherent responsibility.
4. Build and verify behavior preservation.
5. Add the new feature.
6. Build and verify again.

---

## 13. AI Work Procedure

For every non-trivial task, AI must perform these steps.

### Before editing

1. Restate the concrete outcome.
2. Inspect `SESSION_NOTES.md`.
3. Inspect the relevant section of `AI_CONTEXT.md`.
4. Inspect `docs/CURRENT_STATE.md` and the matching roadmap item.
5. Identify the authoritative source of truth.
6. Identify the smallest set of files likely to change.
7. Search for existing helpers before creating new ones.
8. List likely regression risks.
9. Distinguish required work from optional cleanup.

Do not edit before understanding the current ownership path.

### During editing

- Keep changes within the current ticket.
- Preserve working behavior unless the ticket explicitly changes it.
- Reuse existing stores, resolvers, and event paths.
- Add tests or validation at the same time as pure logic.
- Avoid unrelated formatting.
- Add closing-brace comments.
- Keep the working tree understandable.

### When design information is missing

- Make the smallest conservative assumption when it is reversible and does not invent a gameplay rule.
- State the assumption in the completion report.
- Do not create a large placeholder system.
- Stop and report the exact missing decision only when proceeding would be destructive, incompatible, or likely to encode the wrong game rule.

### After editing

Report:

1. Files changed
2. Behavior changed
3. Source of truth used
4. Automated commands run
5. Results
6. Exact manual playtest steps
7. Unverified behavior
8. Regression risks
9. Documentation that should be updated

---

## 14. Verification

Current baseline commands:

```text
npm run typecheck
npm run build
```

Current full local playtest command:

```text
npm run dev:playtest
```

Until `npm run verify` is implemented, both type checking and build are required for code changes.

When `npm run verify` exists, it should become the standard automated gate and include:

- Type checking
- Workspace build
- Data validation
- Focused automated tests

Do not claim a feature works because TypeScript compiled. Separate these states:

- Implemented
- Automated checks passed
- Manually playtested
- Developer approved

---

## 15. Documentation Maintenance

### `AI_CONTEXT.md`

Update only when stable architecture, ownership, or repository-wide rules change.

### `docs/CURRENT_STATE.md`

Update after:

- Baseline audits
- Major playtests
- Confirmed defects
- Completed roadmap items
- Changes in verification status

### `docs/ROADMAP.md`

Update when priorities, dependencies, scope, or milestone status changes.

Do not paste full implementation prompts into the roadmap.

### `SESSION_NOTES.md`

Replace for each focused work session. It should describe one task, its constraints, files to inspect, and acceptance criteria.

### Archived documents

Archived documents are historical evidence only. They do not control active development.

---

## 16. Known Architectural Debt

Current known debt includes:

- `packages/client/src/test-map/main.ts` is an oversized orchestration hub.
- The player pause menu and developer tools are mixed together.
- The garage is exposed through pause instead of a contextual world facility.
- The garage controller is large and tightly integrated with DOM behavior.
- Automated test coverage is limited or absent.
- Repository mapping artifacts may become stale or incomplete.
- Several advanced targeting tickets remain unfinished or unverified.
- The world lacks a completed faction, mission, facility, and shop loop.
- Existing implemented systems require a fresh baseline smoke test before being treated as demo-ready.

Address these through roadmap tickets, not opportunistic rewrites.

---

## 17. Deferred Work

Unless a current ticket explicitly changes priority, defer:

- Full multiplayer authority and synchronization
- Massive cities or a huge world
- Procedural mission generation
- Deep faction reputation simulation
- Complex dialogue trees
- Dynamic economy simulation
- Broad engine replacement
- Large visual redesign unrelated to the playable loop
- Advanced targeting work that does not block the demo
- General cleanup with no acceptance criteria

---

# End of AI_CONTEXT.md
