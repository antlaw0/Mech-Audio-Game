# Mech Audio Game Project Index

Last reviewed: 2026-08-27

Use this index to locate the owner of a behavior before editing. Source remains the final authority for current implementation.

## Repository entry points

| Path | Responsibility |
|---|---|
| `test-map.html` | Browser shell for the active gameplay runtime. |
| `packages/client/src/test-map/main.ts` | Client composition root and current test-map runtime orchestration. |
| `packages/server/src/index.ts` | Plain WebSocket server entry point. |
| `packages/server/src/colyseus/index.ts` | Deferred Colyseus server entry point. |
| `packages/shared/src/index.ts` | Public exports for shared types and utilities. |
| `package.json` | Root build, development, validation, test, and verification commands. |
| `AGENTS.md` | Mandatory Codex operating and verification rules. |

## Input, focus, and UI

| Path | Responsibility |
|---|---|
| `packages/client/src/test-map/controls.ts` | Control definitions, labels, and bindings. |
| `packages/client/src/test-map/input.ts` | Browser input-event binding and normalized input state. |
| `packages/client/src/test-map/keyboard-focus.ts` | Prevents gameplay shortcuts from firing in editable controls. |
| `packages/client/src/test-map/dev-console.ts` | Developer-console parsing and command dispatch support. |
| `packages/client/src/test-map/world-map-overlay.ts` | World-map overlay behavior. |
| `packages/client/src/ui/garage/index.ts` | Garage DOM controller and interaction flow. |
| `packages/client/src/ui/garage/store.ts` | Garage inventory, loadout, equip, and unequip mutations. |
| `packages/client/src/ui/components/PartCard.ts` | Part-card presentation. |

## Simulation, combat, and resources

| Path | Responsibility |
|---|---|
| `packages/client/src/test-map/update.ts` | Per-frame player and runtime update helpers. |
| `packages/client/src/test-map/combat-ecs.ts` | ECS entities, projectiles, hits, damage, and combat simulation. |
| `packages/client/src/test-map/target-lock.ts` | Target acquisition and lock progression. |
| `packages/client/src/test-map/target-layout.ts` | Target subsystem layout and directional selection. |
| `packages/client/src/test-map/awareness.ts` | Threat and awareness evaluation. |
| `packages/client/src/test-map/resource-policy.ts` | Pure heat-state and energy-regeneration policy. |
| `packages/client/src/test-map/weapons.ts` | Player weapon definitions and weapon-facing types. |
| `packages/client/src/test-map/enemies/` | Enemy definitions and registry. |

## World, rendering, and collision

| Path | Responsibility |
|---|---|
| `packages/client/src/test-map/scene-layout.ts` | Static world layout and points of interest. |
| `packages/client/src/test-map/map-data.ts` | Grid data and cell queries. |
| `packages/client/src/test-map/world-streaming.ts` | Chunk activation and streaming diagnostics. |
| `packages/client/src/test-map/chunk-coordinates.ts` | Pure chunk coordinate, key, and distance calculations. |
| `packages/client/src/test-map/world-collision.ts` | Collision world, ray traces, and spatial queries. |
| `packages/client/src/test-map/three-render.ts` | Three.js scene and rendering system. |
| `packages/client/src/test-map/update-scheduler.ts` | Frame-budgeted update scheduling. |

## Audio and accessibility

| Path | Responsibility |
|---|---|
| `packages/client/src/test-map/audio.ts` | Primary gameplay-audio controller. |
| `packages/client/src/test-map/audio-config.ts` | Audio configuration values. |
| `packages/client/src/test-map/audio-occlusion.ts` | Obstruction and occlusion calculations. |
| `packages/client/src/test-map/audio-utils.ts` | Shared audio math. |
| `packages/client/src/test-map/spatial-audio.ts` | Resonance Audio integration. |
| `packages/client/src/systems/audio/uiAudio.ts` | Global UI sound service. |
| `packages/client/src/test-map/accessibility-mode-manager.ts` | Accessibility-mode runtime state. |

## Parts, weight, inventory, and persistence

| Path | Responsibility |
|---|---|
| `packages/client/src/data/parts/parts.json` | Authoritative manually authored part definitions. |
| `packages/client/src/data/parts/types.ts` | Part, loadout, modifier, and resolved-stat types. |
| `packages/client/src/data/parts/catalog.ts` | Runtime catalog loading and persistence boundary. |
| `packages/client/src/systems/parts/statResolver.ts` | Integrity, instance-modifier, and chip-state resolution. |
| `packages/client/src/systems/parts/effectModifiers.ts` | Conditional part-effect evaluation. |
| `packages/client/src/systems/weight/mechWeight.ts` | Total weight and overencumbrance states. |
| `packages/client/src/data/items/` | Item definitions and types. |
| `packages/client/src/systems/inventory/` | Item lookup and inventory operations. |
| `packages/client/src/data/lootTables/` | Authored loot-table definitions and types. |
| `packages/client/src/systems/loot/lootGenerator.ts` | Injected-random loot generation. |
| `packages/client/src/systems/pickup/` | Pickup interaction and world representation. |
| `packages/client/src/systems/persistence/worldItemPersistence.ts` | World-item persistence. |

## Networking and shared code

| Path | Responsibility |
|---|---|
| `packages/client/src/net/ws-client.ts` | Client WebSocket adapter. |
| `packages/server/src/net/` | WebSocket protocol, sessions, and server transport. |
| `packages/server/src/simulation/` | Server-side input application and world ticks. |
| `packages/server/src/state/` | Server world-state construction. |
| `packages/shared/src/types/` | Shared network and world types. |
| `packages/shared/src/schemas/` | Shared runtime validation schemas. |
| `packages/shared/src/utils/rng.ts` | Seedable shared random-number support. |
| `packages/shared/src/trace.ts` | Shared decision tracing. |

## Tooling and tests

| Path | Responsibility |
|---|---|
| `scripts/clean-generated.mjs` | Removes only known generated build and test output. |
| `scripts/validate-data.mjs` | Read-only authored-data validation entry point. |
| `scripts/lib/parts-catalog-validation.mjs` | Non-normalizing parts-catalog validator. |
| `scripts/sync-client-parts-json.mjs` | Copies the authoritative source catalog into client build output. |
| `scripts/apply-catalog-export.mjs` | Explicit, backed-up promotion of an exported catalog to source. |
| `tests/` | Automated regression tests run by `npm test`. |
| `tsconfig.tests.json` | Compiles TypeScript tests and production imports into ignored test output. |
