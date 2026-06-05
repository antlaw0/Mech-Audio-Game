#  ARCHITECTURE.md — Test-Map Game Runtime (Client)

## 🎮 1. High-Level Overview

This project is a browser-based mech combat simulation built around a single primary runtime:

> **Test-Map = the actual game loop**

It is a real-time, frame-based simulation combining:

* ECS combat system
* physics + collision world
* spatial audio perception engine
* 3D rendering (Three.js)
* inventory / loot / progression systems
* enemy AI definitions
* world streaming + chunk activation

The runtime is orchestrated by a single entry point:

> `packages/client/src/test-map/main.ts`

This file acts as the **simulation conductor**.

---

## 🧠 2. Core Game Loop Model

Each frame follows this conceptual pipeline:

### 1. Input Phase

* Keyboard + mouse events captured in:

  * `input.ts`
  * `controls.ts`
* Focus gating via:

  * `keyboard-focus.ts`

Outputs:

* Normalized `InputState`

---

### 2. Simulation Phase (Game Logic)

Handled primarily in:

* `update.ts`
* `combat-ecs.ts`
* `target-lock.ts`
* `awareness.ts`

Responsibilities:

* Player movement + physics updates
* Combat resolution (ECS)
* Target acquisition + lock states
* Threat + awareness evaluation

Uses:

* `world-collision.ts` (authoritative spatial queries)
* `constants.ts` (movement tuning)
* `missile-types.ts`

---

### 3. World Query / Physics Layer

Central spatial authority:

* `world-collision.ts`

Provides:

* raycasts / traces
* wall and sprite collision checks
* obstruction tests

Used by:

* movement
* combat
* audio occlusion
* targeting systems
* awareness system

---

### 4. Audio Perception Layer (Parallel Simulation)

Audio is not cosmetic—it is a **secondary perception model**.

Core modules:

* `audio.ts` (main controller)
* `audio-occlusion.ts` (obstruction modeling)
* `audio-utils.ts` (distance + spatial math)
* `spatial-audio.ts` (resonance-audio integration)
* `audio-config.ts`

Audio events are driven by:

* movement
* weapon fire
* impacts
* enemy behavior
* navigation state
* surface type (`surface-material.ts`)

Key idea:

> Audio is computed from world simulation state, not UI events.

---

### 5. Combat System (ECS Core)

Primary combat engine:

* `combat-ecs.ts`

Handles:

* entities (players, enemies, projectiles)
* projectile simulation
* damage resolution
* explosions / missile behavior
* combat state updates

Dependencies:

* `enemy definitions`
* `missile-types.ts`
* `target-layout.ts`
* `world-collision.ts`

---

### 6. Enemy System (Definition Layer)

Enemies are **data-driven class definitions**, not ECS entities directly.

Structure:

* `enemyBase.ts`
* `tankEnemy.ts`, `strikerEnemy.ts`, etc.
* `enemies/index.ts` (registry)

Purpose:

* define behavior profiles
* provide combat parameters
* feed ECS spawning logic

---

### 7. World Structure + Streaming

World is chunk-based and partially streamed:

* `scene-layout.ts` → generates world layout + POIs
* `map-data.ts` → grid + cell queries
* `world-streaming.ts` → active chunk management

Responsibilities:

* define spatial layout
* activate/deactivate world regions
* optimize collision + rendering scope

---

### 8. Rendering Layer

Primary renderer:

* `three-render.ts`

Uses:

* Three.js
* mesh BVH acceleration

Responsibilities:

* scene graph construction
* camera + view updates
* rendering world state each frame

Consumes:

* player state
* world geometry
* combat entities
* sprites

---

### 9. UI + Overlay Systems

Includes:

* `world-map-overlay.ts`
* HUD/debug systems (inside main.ts)

Responsibilities:

* POI visualization
* tactical map rendering
* runtime debug views

---

### 10. Inventory / Loot / Progression

Subsystem cluster:

* `inventoryManager.ts`
* `itemDatabase.ts`
* `lootGenerator.ts`
* `pickupSystem.ts`
* `pickupWorldSystem.ts`
* `worldItemPersistence.ts`
* `weight/mechWeight.ts`

Responsibilities:

* item definitions and lookup
* loot generation from tables
* pickup interaction flow
* persistence of world items
* encumbrance calculation

---

### 11. Parts / Garage System (Mech Loadout Layer)

Subsystem:

* `data/parts/*`
* `ui/garage/*`
* `systems/parts/*`

Responsibilities:

* mech loadout configuration
* part stats + effects resolution
* garage UI editing interface
* stat aggregation pipeline

Key pipeline:

> Parts → Effects → Stat Resolver → Runtime Loadout

---

### 12. Targeting + Awareness Systems

Modules:

* `target-lock.ts`
* `target-layout.ts`
* `awareness.ts`
* `missile-threat-manager.ts`

Responsibilities:

* lock-on acquisition
* line-of-sight evaluation
* threat prioritization
* HUD awareness signals

All depend heavily on:

* `world-collision.ts`

---

### 13. Runtime Control Layer (Orchestration Core)

Primary conductor:

* `main.ts`

Responsibilities:

* initialize all subsystems
* create player + input state
* start animation loop
* coordinate frame execution order:

  * input → update → ECS → render → audio
* optionally integrate networking client

Also integrates:

* dev console
* garage UI
* streaming system
* inventory systems

---

### 14. Developer Tools

* `dev-console.ts`
* `dev-console-history.ts`

Responsibilities:

* runtime debugging commands
* persistent command history
* live state inspection/modification

---

### 15. Runtime Configuration

* `runtime-config.ts`

Provides:

* mutable tuning parameters
* shared runtime constants (non-core physics)

Used for:

* balancing
* debugging
* experimental tweaks

---

## 🔁 3. Global Data Flow (Simplified)

```text
INPUT
  ↓
input.ts → InputState
  ↓
update.ts + combat-ecs.ts
  ↓
world-collision.ts (spatial truth)
  ↓
audio.ts (perception model)
  ↓
three-render.ts (visual output)
  ↓
DOM / Canvas output
```

Parallel systems:

* inventory/loot updates
* targeting + awareness updates
* world streaming updates

---

## 🧩 4. Key Architectural Principles

### 1. Collision is the “source of truth”

Everything spatial depends on `world-collision.ts`.

---

### 2. Audio is a simulation layer, not UI

Audio is computed from world state + occlusion.

---

### 3. ECS is the combat backbone

All combat flows through `combat-ecs.ts`.

---

### 4. main.ts is the orchestrator, not logic owner

It coordinates systems but should not contain deep logic.

---

### 5. World is chunked and partially active

Streaming system defines simulation scope.

---

## ⚠️ 5. Known Structural Risks

### 1. Distributed mutable state

Many systems maintain internal state:

* audio controller
* ECS world
* inventory manager
* streaming system
* runtime config

Risk:

> implicit ordering dependencies

---

### 2. Hybrid architecture styles

Mix of:

* ECS (combat)
* OO classes (enemies)
* functional utilities (audio/math)
* stateful managers (UI/inventory)

Risk:

> cognitive model fragmentation

---

### 3. Collision dependency centralization

Many systems depend on a single module:

> `world-collision.ts`

Risk:

> performance bottleneck + tight coupling

---

## 📌 6. What This System *Is*

In one sentence:

> A real-time browser mech combat simulation where physics, audio, and combat are co-simulated through a centralized spatial collision model and orchestrated by a single frame-loop controller.

---

## 🧠 7. How this doc should be used

This file is intended to be:

* the primary reference for AI-assisted development
* the “source of truth map” for architecture decisions
* a stable mental model of the runtime

Not a file index. Not exhaustive documentation.
