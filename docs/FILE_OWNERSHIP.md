# File Ownership and Change Boundaries

Last reviewed: 2026-08-27

Ownership means a value or behavior has one authoritative home. Consumers may display or use it, but must not create a competing source of truth.

| Area | Authoritative owner | Primary consumers | Change boundary |
|---|---|---|---|
| Authored part values | `packages/client/src/data/parts/parts.json` | Catalog loader, garage, stat resolver, runtime | Edit values here deliberately. Validators and builds must not normalize or delete fields. |
| Part schema and numeric keys | `packages/client/src/data/parts/types.ts` | Catalog, garage, resolver, scripts | Keep categories and supported fields consistent with authored data. |
| Runtime catalog loading | `packages/client/src/data/parts/catalog.ts` | Garage store and runtime | Load and normalize source definitions; `armorValue` may be derived from authored `integrity` when omitted. Do not become an alternate authored catalog. |
| Resolved installed-part values | `packages/client/src/systems/parts/statResolver.ts` | Runtime stats and UI | Own integrity and instance-modifier resolution. UI must not duplicate formulas. |
| Conditional part effects | `packages/client/src/systems/parts/effectModifiers.ts` | Runtime resource, movement, and weapon calculations | Own condition matching and effect application. |
| Ground carrying capacity | Equipped `GroundMobility.ratedLoad`, interpreted by `packages/client/src/systems/weight/mechWeight.ts` | Movement, status, garage | Never substitute `liftCapacity`, legacy `groundCapacity`, or a UI-derived value. |
| Flight capacity | Equipped flight part's `liftCapacity` | Flight eligibility and status | Keep independent from ground `ratedLoad`. |
| Garage mutations | `packages/client/src/ui/garage/store.ts` | Garage controller and runtime loadout | Equip, unequip, inventory, and loadout changes go through the store. |
| Garage presentation | `packages/client/src/ui/garage/index.ts` and `ui/components/PartCard.ts` | Player DOM | Display store/resolver state; do not own gameplay values. |
| Item definitions | `packages/client/src/data/items/definitions.ts` | Item database, inventory, loot | Add or revise authored item data here. |
| Item lookup | `packages/client/src/systems/inventory/itemDatabase.ts` | Inventory, loot, pickups | Own ID lookup and definition validation. |
| Inventory state | `packages/client/src/systems/inventory/inventoryManager.ts` | Runtime, containers, garage-facing flows | Own quantities, transfers, drops, categories, and cargo weight. |
| Loot definitions | `packages/client/src/data/lootTables/definitions.ts` | Loot generator | Author table membership, quantities, and chances here. |
| Loot generation | `packages/client/src/systems/loot/lootGenerator.ts` | Enemies, containers, pickups | Own roll and merge behavior; inject randomness for repeatable tests. |
| Heat and energy policy | `packages/client/src/test-map/resource-policy.ts` | `main.ts` runtime orchestration | Own pure thresholds and multipliers; state, audio, and effects remain in the composition root. |
| Input bindings | `packages/client/src/test-map/controls.ts` | Input and UI | Do not create a parallel keyboard-binding system. |
| Editable focus protection | `packages/client/src/test-map/keyboard-focus.ts` | Input handlers and overlays | All global shortcuts must respect this boundary. |
| Combat simulation | `packages/client/src/test-map/combat-ecs.ts` | Runtime, rendering, targeting, audio | Own combat entities, projectiles, hits, and damage state. |
| Target locking | `packages/client/src/test-map/target-lock.ts` | Runtime and audio guidance | Own acquisition and lock progression. |
| Collision and traces | `packages/client/src/test-map/world-collision.ts` | Movement, combat, audio, targeting | Own authoritative spatial obstruction queries. |
| Chunk coordinate math | `packages/client/src/test-map/chunk-coordinates.ts` | World streaming | Reuse these helpers rather than creating new boundary formulas. |
| Streaming lifecycle | `packages/client/src/test-map/world-streaming.ts` | Runtime, renderer, collision | Own active/dormant/unloaded transitions and diagnostics. |
| Rendering | `packages/client/src/test-map/three-render.ts` | Browser runtime | Visualize simulation state; visuals must not be required to operate the game. |
| Gameplay audio | `packages/client/src/test-map/audio.ts` | Runtime systems | Audio is a gameplay perception channel, not UI decoration. |
| UI audio | `packages/client/src/systems/audio/uiAudio.ts` | Menus and overlays | Own consistent focus, activation, success, and error cues. |
| Runtime composition | `packages/client/src/test-map/main.ts` | Browser entry | Wire systems and mutable session state. Extract focused logic instead of adding independent subsystems inline. |
| Shared network/world contracts | `packages/shared/src/types` and `packages/shared/src/schemas` | Client and server | Cross-package contracts belong here, not in duplicate client/server declarations. |
| Automated verification | Root `package.json`, `scripts/validate-data.mjs`, and `tests/` | Codex and developers | `verify:quick` is the inner loop; `verify` is the clean pre-commit gate. |
