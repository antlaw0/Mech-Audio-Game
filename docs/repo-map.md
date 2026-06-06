# 1. Repository Overview

This repository appears to be a multi-package TypeScript game project centered on a "test map" playable client runtime with heavy audio systems, plus server networking and shared schema/type packages. The top-level HTML files bootstrap browser-facing experiences (`index.html`, `test-map.html`, `audio-combo-tester.html`), while `packages/client` contains gameplay/runtime systems, `packages/server` contains multiplayer simulation/runtime servers (WebSocket and Colyseus paths), and `packages/shared` provides shared constants/types/schemas used by both client and server.

Major subsystems inferred from folder structure:
- `packages/client/src/test-map`: test map runtime and gameplay orchestration
- `packages/client/src/systems`: client gameplay/data systems (inventory, loot, pickup, persistence, parts, weight)
- `packages/client/src/ui`: garage UI and components
- `packages/client/src/data`: static gameplay data definitions/types/catalogs
- `packages/client/src/net`: client WebSocket networking
- `packages/server/src/net`: WebSocket server protocol/session handling
- `packages/server/src/simulation`: world ticking and input application
- `packages/server/src/state`: world state creation
- `packages/server/src/colyseus`: Colyseus server path
- `packages/shared/src`: shared constants, types, schemas, RNG
- `assets`: audio/music/sound content and conversion scripts
- `scripts`: repository automation scripts

# 2. Directory Tree (cleaned)

```text
.
├─ assets/
│  ├─ audio/
│  ├─ burstShotMaker/
│  ├─ music/
│  ├─ sounds/
│  │  ├─ ambience/
│  │  ├─ explosions/
│  │  ├─ inventory/
│  │  ├─ nav/
│  │  ├─ steps/
│  │  └─ weapons/
│  ├─ convertMP3toOgg.bat
│  ├─ convertWavToOgg.bat
│  └─ normalize.bat
├─ docs/
├─ packages/
│  ├─ client/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ src/
│  │     ├─ data/
│  │     │  ├─ items/
│  │     │  ├─ lootTables/
│  │     │  └─ parts/
│  │     ├─ net/
│  │     ├─ systems/
│  │     ├─ test-map/
│  │     ├─ types/
│  │     └─ ui/
│  ├─ server/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ src/
│  │     ├─ colyseus/
│  │     ├─ net/
│  │     ├─ simulation/
│  │     ├─ state/
│  │     ├─ config.ts
│  │     └─ index.ts
│  └─ shared/
│     ├─ package.json
│     ├─ tsconfig.json
│     └─ src/
│        ├─ constants/
│        ├─ schemas/
│        ├─ types/
│        ├─ utils/
│        └─ index.ts
├─ scripts/
│  ├─ apply-catalog-export.mjs
│  ├─ sync-client-parts-json.mjs
│  └─ with-dev-lock.mjs
├─ audio-combo-tester.html
├─ index.html
├─ test-map.html
├─ missile-sim.mjs
├─ package.json
├─ tsconfig.base.json
└─ tsconfig.json
```

# 3. File Index (MOST IMPORTANT SECTION)

### FILE: `test-map.html`
Purpose:
- Browser shell for the test-map game UI overlays and module bootstrap.
Key Components:
- HTML HUD/overlay structure, import map, module script tag.
Inputs:
- Browser events and DOM interactions.
Outputs:
- Renders page and loads `./packages/client/dist/test-map/main.js`.
Dependencies:
- Internal files it imports: UNKNOWN (HTML module load target is built output).
- External libraries used: import map entries (browser-side modules), exact runtime set in HTML.
Side Effects:
- DOM rendering and CSS styling.
Confidence:
- High
Notes:
- Contains `<script type="module" src="./packages/client/dist/test-map/main.js"></script>`.

### FILE: `scripts/with-dev-lock.mjs`
Purpose:
- Prevents concurrent dev/playtest processes via a lock mechanism.
Key Components:
- Process/lock management logic.
Inputs:
- Command-line invocation arguments.
Outputs:
- Launches child process under lock guard.
Dependencies:
- Internal files it imports: UNKNOWN.
- External libraries used: `fs`, `child_process` (Node built-ins).
Side Effects:
- Filesystem lock-file operations; process spawning.
Confidence:
- Medium
Notes:
- Script utility, not part of runtime game loop.

### FILE: `scripts/sync-client-parts-json.mjs`
Purpose:
- Syncs parts catalog JSON into client distribution/build context.
Key Components:
- Copy/read/write JSON synchronization steps.
Inputs:
- Source `parts.json` paths.
Outputs:
- Updated target JSON file(s).
Dependencies:
- Internal files it imports: UNKNOWN.
- External libraries used: `fs/promises`.
Side Effects:
- Filesystem reads/writes.
Confidence:
- High
Notes:
- Build/asset prep utility script.

### FILE: `scripts/apply-catalog-export.mjs`
Purpose:
- Applies exported catalog content into parts catalog JSON.
Key Components:
- Catalog merge/apply logic.
Inputs:
- Catalog export data from file/CLI input.
Outputs:
- Updated catalog JSON content.
Dependencies:
- Internal files it imports: UNKNOWN.
- External libraries used: `fs`.
Side Effects:
- Filesystem reads/writes and JSON mutation persistence.
Confidence:
- Medium
Notes:
- CLI-oriented data maintenance script.

### FILE: `audio-combo-tester.html`
Purpose:
- Standalone browser UI for composing/testing audio effect combinations.
Key Components:
- Tone.js-driven controls UI, preset and step forms.
Inputs:
- User UI input for audio paths/effect settings.
Outputs:
- Browser audio playback and on-page status UI.
Dependencies:
- Internal files it imports: UNKNOWN.
- External libraries used: Tone.js CDN.
Side Effects:
- DOM manipulation and audio playback.
Confidence:
- High
Notes:
- Contains references/placeholders for `assets/sounds/...` paths.

### FILE: `packages/shared/src/utils/rng.ts`
Purpose:
- Provides deterministic seeded PRNG helper(s).
Key Components:
- `Rng` interface, `createSeededRng()`.
Inputs:
- Seed value(s).
Outputs:
- RNG object/function yielding pseudo-random values.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- None expected.
Confidence:
- High
Notes:
- Shared utility module.

### FILE: `packages/shared/src/types/world.ts`
Purpose:
- Declares world simulation domain types.
Key Components:
- `WorldState`, `PlayerState`, `SpriteObject`, `InputState` interfaces/types.
Inputs:
- Type consumers via imports.
Outputs:
- Type declarations.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Pure type definition file.

### FILE: `packages/shared/src/types/network.ts`
Purpose:
- Declares network message/data types shared client/server.
Key Components:
- `ClientToServerMessage`, `ServerToClientMessage`, `SerializedWorldState`.
Inputs:
- Type consumers via imports.
Outputs:
- Type declarations.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Protocol type source of truth.

### FILE: `packages/shared/src/index.ts`
Purpose:
- Barrel exports shared package modules.
Key Components:
- Re-export statements.
Inputs:
- Consumers importing from `@mech-audio/shared`.
Outputs:
- Aggregated exports.
Dependencies:
- Internal files it imports: constants/types/schemas/utils modules.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Central shared import surface.

### FILE: `packages/shared/src/constants/world-constants.ts`
Purpose:
- Defines shared simulation constants.
Key Components:
- Movement, map, and physics constants.
Inputs:
- Imported by client/server simulation code.
Outputs:
- Constant exports.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Numeric config constants only.

### FILE: `packages/client/src/ui/garage/store.ts`
Purpose:
- Implements garage state/store logic for loadout/parts/inventory.
Key Components:
- `GarageStore` interface, `createGarageStore()`.
Inputs:
- Part catalog/types and inventory-related inputs.
Outputs:
- Store API and mutable garage state operations.
Dependencies:
- Internal files it imports: parts catalog/types and related systems.
- External libraries used: UNKNOWN.
Side Effects:
- In-memory state mutations.
Confidence:
- Medium
Notes:
- Used by garage UI controller and test-map integration.

### FILE: `packages/client/src/ui/garage/index.ts`
Purpose:
- Garage UI controller and rendering/interaction bindings.
Key Components:
- `GarageViewController`, `createGarageView()`.
Inputs:
- Store instance, part/inventory data, UI events.
Outputs:
- Garage UI lifecycle/controller methods.
Dependencies:
- Internal files it imports: `ui/garage/store.ts`, `ui/components/PartCard.ts`, parts catalog/systems.
- External libraries used: browser DOM APIs.
Side Effects:
- DOM updates and event listeners.
Confidence:
- High
Notes:
- UI-layer orchestration for garage screen components.

### FILE: `packages/client/src/net/ws-client.ts`
Purpose:
- Implements browser WebSocket client for server message exchange.
Key Components:
- `WsClient` interface, `createWsClient()`, `connect()`, `sendInput()`, `close()`.
Inputs:
- `clientId`, input payloads, message callback.
Outputs:
- Sends hello/input messages; emits parsed server messages to callback.
Dependencies:
- Internal files it imports: `@mech-audio/shared` parsers/types.
- External libraries used: browser `WebSocket`.
Side Effects:
- Network I/O over WebSocket.
Confidence:
- High
Notes:
- Validates inbound payloads through shared schema parser.

### FILE: `packages/server/src/state/create-world-state.ts`
Purpose:
- Creates initial world state and map/sprite data for simulation.
Key Components:
- `createWorldState()` and map/sprite initialization helpers.
Inputs:
- Shared constants and map generation logic.
Outputs:
- Initialized `WorldState` object.
Dependencies:
- Internal files it imports: `@mech-audio/shared` types/constants.
- External libraries used: UNKNOWN.
Side Effects:
- None beyond object creation.
Confidence:
- Medium
Notes:
- Server startup and room initialization depend on this.

### FILE: `packages/client/src/ui/components/PartCard.ts`
Purpose:
- Builds/updates part card UI component.
Key Components:
- `createPartCard()`.
Inputs:
- Part definitions/store callbacks.
Outputs:
- DOM element(s) for part display/actions.
Dependencies:
- Internal files it imports: parts types/catalog and garage store types.
- External libraries used: browser DOM APIs.
Side Effects:
- DOM node creation and event binding.
Confidence:
- High
Notes:
- UI primitive reused in garage view.

### FILE: `packages/server/src/simulation/tick-world.ts`
Purpose:
- Advances world by one simulation tick and applies player input.
Key Components:
- `tickWorld()`.
Inputs:
- `WorldState`, `Map<playerId, InputState>`, `deltaSeconds`.
Outputs:
- Mutated `WorldState` tick/player state.
Dependencies:
- Internal files it imports: `simulation/apply-input.ts`, shared types.
- External libraries used: none.
Side Effects:
- Mutates world state object.
Confidence:
- High
Notes:
- Called in WebSocket and Colyseus simulation loops.

### FILE: `packages/server/src/simulation/apply-input.ts`
Purpose:
- Converts input flags into movement/look updates with collision checks.
Key Components:
- `applyInput()`, `getCell()`, `isWall()`, `isSolidSpriteAt()`.
Inputs:
- `WorldState`, `PlayerState`, `InputState`, `deltaSeconds`.
Outputs:
- Updated player position/orientation fields.
Dependencies:
- Internal files it imports: shared constants/types.
- External libraries used: none.
Side Effects:
- Mutates `player` object.
Confidence:
- High
Notes:
- Uses map cell and sprite overlap checks to prevent invalid movement.

### FILE: `packages/client/src/types/resonance-audio.d.ts`
Purpose:
- Provides TypeScript ambient declarations for `resonance-audio` package.
Key Components:
- `ResonanceAudioSource`, `ResonanceAudioScene`, options/constructor declarations.
Inputs:
- TypeScript compiler/type consumers.
Outputs:
- Module type definitions.
Dependencies:
- Internal files it imports: none.
- External libraries used: `resonance-audio` module typing target.
Side Effects:
- None.
Confidence:
- High
Notes:
- Declaration-only file.

### FILE: `packages/client/src/data/parts/types.ts`
Purpose:
- Defines part/loadout/garage-related domain types.
Key Components:
- `PartDefinition`, `MechLoadout`, `GarageSnapshot` and related enums/types.
Inputs:
- Type consumers across UI/systems/test-map.
Outputs:
- Type exports.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Central parts-domain typing module.

### FILE: `packages/client/src/data/parts/catalog.ts`
Purpose:
- Loads/saves/manages parts catalog data.
Key Components:
- `loadPartCatalog()`, `savePartCatalog()` and catalog helpers.
Inputs:
- JSON catalog payloads and persistence targets.
Outputs:
- Catalog structures and persisted catalog updates.
Dependencies:
- Internal files it imports: `data/parts/types.ts`.
- External libraries used: browser storage or filesystem proxy (environment-dependent), UNKNOWN exact.
Side Effects:
- State/persistence updates.
Confidence:
- Medium
Notes:
- Acts as catalog data persistence boundary.

### FILE: `packages/server/src/net/ws-server.ts`
Purpose:
- Starts WebSocket server and runs snapshot broadcast loop.
Key Components:
- `startWebSocketServer()`, `send()`, local `createPlayer()`.
Inputs:
- Socket messages (`hello`, `input`) and tick timer.
Outputs:
- Welcome and snapshot server messages to clients.
Dependencies:
- Internal files it imports: config, state creation, simulation tick, session/protocol modules, shared types.
- External libraries used: `ws`.
Side Effects:
- Network server start, timer loop, in-memory session/world mutations.
Confidence:
- High
Notes:
- Maintains `sessions` and `inputsByPlayerId` maps.

### FILE: `packages/server/src/net/protocol.ts`
Purpose:
- Parses client JSON messages and serializes world/server payloads.
Key Components:
- `parseClientMessage()`, `serializeWorld()`, `encodeServerMessage()`.
Inputs:
- Raw JSON strings and world/message objects.
Outputs:
- Parsed typed messages and JSON strings.
Dependencies:
- Internal files it imports: shared parse/type exports.
- External libraries used: JSON built-ins.
Side Effects:
- None.
Confidence:
- High
Notes:
- Central protocol adapter for WebSocket server path.

### FILE: `packages/server/src/net/client-session.ts`
Purpose:
- Defines and constructs per-client session state.
Key Components:
- `ClientSession` interface, `createClientSession()`.
Inputs:
- Client identifier and socket.
Outputs:
- Session object with last input tracking.
Dependencies:
- Internal files it imports: shared `InputState` type.
- External libraries used: `ws` socket type usage.
Side Effects:
- None beyond object creation.
Confidence:
- High
Notes:
- Used by `ws-server.ts` session map.

### FILE: `packages/server/src/index.ts`
Purpose:
- Server WebSocket runtime entry point.
Key Components:
- Calls `startWebSocketServer()`.
Inputs:
- Process startup.
Outputs:
- Running WebSocket server.
Dependencies:
- Internal files it imports: `net/ws-server.ts`.
- External libraries used: none.
Side Effects:
- Starts long-running network process.
Confidence:
- High
Notes:
- Minimal bootstrap module.

### FILE: `packages/server/src/config.ts`
Purpose:
- Exposes server runtime constants.
Key Components:
- `SERVER_PORT`, `TICK_RATE_HZ`, `TICK_INTERVAL_MS`.
Inputs:
- Importing modules.
Outputs:
- Constant exports.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Shared across server modules.

### FILE: `packages/shared/src/schemas/network.ts`
Purpose:
- Runtime schema validation for network payloads.
Key Components:
- `InputStateSchema`, message schema parsers.
Inputs:
- Unknown/raw payload objects.
Outputs:
- Validated/parsed message objects or parse failures.
Dependencies:
- Internal files it imports: shared network/world types constants as needed.
- External libraries used: `zod`.
Side Effects:
- None.
Confidence:
- High
Notes:
- Used by client/server parse paths and Colyseus input handling.

### FILE: `missile-sim.mjs`
Purpose:
- Standalone missile trajectory simulation script for combat logic checks.
Key Components:
- `simulate()` and projectile collision helper functions.
Inputs:
- Hardcoded simulation cases and parameters.
Outputs:
- Console logs of trajectory/hit outcomes.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- Console output.
Confidence:
- High
Notes:
- Declares it mirrors combat missile behavior.

### FILE: `packages/client/src/test-map/world-streaming.ts`
Purpose:
- Manages active/chunked world streaming state and diagnostics.
Key Components:
- `WorldStreamingManager` and state/diagnostic methods.
Inputs:
- Player/camera position and map state.
Outputs:
- Active chunk sets and streaming diagnostics.
Dependencies:
- Internal files it imports: `map-data.ts`, `types.ts`.
- External libraries used: UNKNOWN.
Side Effects:
- In-memory streaming state updates.
Confidence:
- High
Notes:
- Connected from `main.ts` orchestration.

### FILE: `packages/client/src/test-map/world-map-overlay.ts`
Purpose:
- Renders tactical/world map overlay UI.
Key Components:
- `createWorldMapOverlay()`, overlay system API.
Inputs:
- World/player/navigation data.
Outputs:
- Overlay draw/update output.
Dependencies:
- Internal files it imports: `types.ts`, `scene-layout.ts`.
- External libraries used: canvas/DOM APIs.
Side Effects:
- Canvas/DOM drawing updates.
Confidence:
- High
Notes:
- Called by test-map runtime.

### FILE: `packages/client/src/test-map/world-collision.ts`
Purpose:
- Provides 3D collision/raycast queries for world geometry.
Key Components:
- `createWorldCollisionWorld()`, `traceWorldHit3D()`, `isPlayerBlocked()`.
Inputs:
- Rays, positions, chunk/map/collider data.
Outputs:
- Collision hit data and movement-block checks.
Dependencies:
- Internal files it imports: `constants.ts`, `map-data.ts`, `types.ts`.
- External libraries used: `three`, `three-mesh-bvh`.
Side Effects:
- Maintains collision-world diagnostics/state.
Confidence:
- High
Notes:
- Core dependency for audio occlusion, awareness, lock-on, movement checks.

### FILE: `packages/client/src/test-map/weapons.ts`
Purpose:
- Defines player weapon and melee weapon data/config behavior.
Key Components:
- `PLAYER_WEAPON_DEFINITIONS`, `PLAYER_MELEE_WEAPON_DEFINITIONS`.
Inputs:
- Parts/stat context and weapon identifiers.
Outputs:
- Weapon definition objects and audio path mappings.
Dependencies:
- Internal files it imports: `constants.ts`, parts catalog/types, `types.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Contains many `assets/sounds/weapons/...` path references.

### FILE: `packages/client/src/test-map/update.ts`
Purpose:
- Executes per-frame player movement/physics status updates.
Key Components:
- `createUpdateState()`, `updateFrame()`.
Inputs:
- Current player/input/world state and timing.
Outputs:
- Updated frame state values.
Dependencies:
- Internal files it imports: `constants.ts`, `audio-config.ts`, `audio-utils.ts`, `world-collision.ts`.
- External libraries used: none.
Side Effects:
- Mutates update state and player-related runtime values.
Confidence:
- High
Notes:
- Main runtime update logic used by `main.ts` loop.

### FILE: `packages/client/src/test-map/update-scheduler.ts`
Purpose:
- Schedules per-frame tasks by priority/frame budget.
Key Components:
- `FrameScheduler` API and update priority types.
Inputs:
- Task functions and timing budget.
Outputs:
- Ordered task execution decisions.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- In-memory scheduling state changes.
Confidence:
- High
Notes:
- Runtime utility used in test-map orchestrator.

### FILE: `packages/client/src/test-map/types.ts`
Purpose:
- Central type declarations for test-map runtime entities/systems.
Key Components:
- Player/input/enemy/render/audio/combat related types.
Inputs:
- Type consumers across `test-map` modules.
Outputs:
- Type exports.
Dependencies:
- Internal files it imports: `world-collision.ts` types.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- High fan-in dependency within `test-map` subsystem.

### FILE: `packages/client/src/test-map/three-render.ts`
Purpose:
- Creates and updates Three.js rendering system.
Key Components:
- `createThreeRenderSystem()` and renderer/scene/camera integration.
Inputs:
- Render state, world/map data, camera/player data.
Outputs:
- Frame rendering to canvas.
Dependencies:
- Internal files it imports: `constants.ts`, `map-data.ts`, `types.ts`, `world-collision.ts`.
- External libraries used: `three`.
Side Effects:
- GPU/canvas rendering and scene state mutation.
Confidence:
- High
Notes:
- Core visual pipeline implementation.

### FILE: `packages/client/src/test-map/target-lock.ts`
Purpose:
- Implements enemy target-lock acquisition/tracking logic.
Key Components:
- `createTargetLockState()`, `updateTargetLock()`, lock-level typing.
Inputs:
- Candidate targets, player orientation/range/visibility context.
Outputs:
- Lock state transitions and selected target info.
Dependencies:
- Internal files it imports: `constants.ts`, `world-collision.ts`, `types.ts`.
- External libraries used: none.
Side Effects:
- Mutates target-lock state.
Confidence:
- High
Notes:
- Integrated into `main.ts` combat targeting flow.

### FILE: `packages/client/src/test-map/target-layout.ts`
Purpose:
- Defines subsystem targeting layout and adjacency/navigation helpers.
Key Components:
- Layout types plus adjacency/accessor functions.
Inputs:
- Layout IDs/entities and directional navigation requests.
Outputs:
- Derived adjacent/exposed subsystem selection.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Used by targeting and combat logic.

### FILE: `packages/client/src/test-map/surface-material.ts`
Purpose:
- Maps world positions/surfaces to material categories.
Key Components:
- `SURFACE_MATERIAL` constants and resolver functions.
Inputs:
- Scene/world location/context.
Outputs:
- Material classification (for audio/effects).
Dependencies:
- Internal files it imports: `scene-layout.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Used by impact/occlusion/footstep audio flows.

### FILE: `packages/client/src/test-map/sprites.ts`
Purpose:
- Generates sprite objects for scene setup.
Key Components:
- `createSprites()`.
Inputs:
- Scene layout inputs.
Outputs:
- Sprite object arrays.
Dependencies:
- Internal files it imports: `scene-layout.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Scene data provisioning utility.

### FILE: `packages/client/src/test-map/spatial-audio.ts`
Purpose:
- Initializes shared 3D spatial audio scene/emitter wrappers.
Key Components:
- `createSharedSpatialAudioScene()` and emitter interfaces.
Inputs:
- Audio context and emitter/listener transforms.
Outputs:
- Spatial audio scene and source controls.
Dependencies:
- Internal files it imports: `types/resonance-audio.d.ts` declarations.
- External libraries used: `resonance-audio`.
Side Effects:
- Web Audio graph creation/manipulation.
Confidence:
- High
Notes:
- Used by `audio.ts` for positional sound.

### FILE: `packages/client/src/test-map/scene-layout.ts`
Purpose:
- Defines map layout, POIs, and scene sprite/map generation rules.
Key Components:
- `createSceneMapData()`, `createSceneSprites()`, POI exports.
Inputs:
- Constants and scene generation parameters.
Outputs:
- Map grid and sprite/POI structures.
Dependencies:
- Internal files it imports: `constants.ts`, `types.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Supplies core static world composition data.

### FILE: `packages/client/src/test-map/runtime-config.ts`
Purpose:
- Runtime mutable tuning state shared by systems.
Key Components:
- `runtimeTuning`, `getSharedFlightHeight()`, `setSharedFlightHeight()`.
Inputs:
- Runtime adjustment values.
Outputs:
- Read/write access to tuning values.
Dependencies:
- Internal files it imports: `constants.ts`.
- External libraries used: none.
Side Effects:
- Mutates shared in-memory config.
Confidence:
- High
Notes:
- Referenced by enemy base and main console/tuning controls.

### FILE: `packages/client/src/test-map/player-state.ts`
Purpose:
- Creates initial player and input objects.
Key Components:
- `createPlayer()`, `createInputState()`.
Inputs:
- Optional defaults/config.
Outputs:
- Initialized player/input state objects.
Dependencies:
- Internal files it imports: `types.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Initialization helper used by `main.ts`.

### FILE: `packages/client/src/test-map/missile-types.ts`
Purpose:
- Declares missile type definitions and tuning constants.
Key Components:
- `MISSILE_TYPE_DEFINITIONS`, missile type IDs/interfaces.
Inputs:
- Type identifiers for missile selection.
Outputs:
- Missile behavior configuration objects.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Includes explosion/audio asset path references.

### FILE: `packages/client/src/test-map/missile-threat-manager.ts`
Purpose:
- Tracks and scores incoming missile threats.
Key Components:
- `MissileThreatManager` and threat update/query methods.
Inputs:
- Missile/player state snapshots.
Outputs:
- Threat level and warning-state info.
Dependencies:
- Internal files it imports: `types.ts`.
- External libraries used: none.
Side Effects:
- In-memory threat state updates.
Confidence:
- High
Notes:
- Used for warning/awareness behavior.

### FILE: `packages/client/src/test-map/map-data.ts`
Purpose:
- Constructs and queries map cell/grid data.
Key Components:
- `createMapData()`, `getCell()`, `isBoundaryCell()`.
Inputs:
- Scene layout/constants.
Outputs:
- Map data structures and query responses.
Dependencies:
- Internal files it imports: `constants.ts`, `scene-layout.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Shared by collision/render/streaming systems.

### FILE: `packages/client/src/test-map/main.ts`
Purpose:
- Primary test-map runtime orchestrator (game loop, systems wiring, UI integration).
Key Components:
- Bootstrap logic, dev console bindings, update/render orchestration, inventory/combat/audio integration.
Inputs:
- Browser input events, runtime timing, network messages, UI actions.
Outputs:
- Frame updates, rendered visuals/audio, network input messages, UI state updates.
Dependencies:
- Internal files it imports: most `test-map` modules plus `systems/*`, `ui/garage/*`, data definitions, and `net/ws-client.ts`.
- External libraries used: browser APIs and imported runtime libs via dependencies of submodules.
Side Effects:
- DOM updates, audio playback, network I/O, extensive in-memory state mutation.
Confidence:
- High
Notes:
- Central dependency hub of client runtime.

### FILE: `packages/client/src/test-map/keyboard-focus.ts`
Purpose:
- Detects whether keyboard focus is in editable/typing contexts.
Key Components:
- `isEditableEventTarget()`, `isTypingContextActive()`.
Inputs:
- DOM event target/context.
Outputs:
- Boolean typing/focus state.
Dependencies:
- Internal files it imports: none.
- External libraries used: browser DOM types.
Side Effects:
- None.
Confidence:
- High
Notes:
- Used to suppress gameplay bindings while typing.

### FILE: `packages/client/src/test-map/input.ts`
Purpose:
- Binds controls to keyboard/pointer input handling.
Key Components:
- `bindInput()` and event listener wiring.
Inputs:
- Control mappings and input-state setters.
Outputs:
- Input handler binding/unbinding behavior.
Dependencies:
- Internal files it imports: `types.ts`, `controls.ts`, `keyboard-focus.ts`.
- External libraries used: browser event APIs.
Side Effects:
- Registers event listeners and mutates input state.
Confidence:
- High
Notes:
- Input abstraction between controls and runtime state.

### FILE: `index.html`
Purpose:
- Redirects root page to test-map page.
Key Components:
- Meta refresh and noscript fallback.
Inputs:
- Browser page load.
Outputs:
- Immediate redirect to `./test-map.html`.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- Browser navigation redirect.
Confidence:
- High
Notes:
- No application logic beyond redirect.

### FILE: `packages/server/src/colyseus/start-colyseus.ts`
Purpose:
- Bootstraps Colyseus server and registers room.
Key Components:
- `COLYSEUS_PORT`, `startColyseusServer()`.
Inputs:
- Optional port argument.
Outputs:
- Running Colyseus server listener.
Dependencies:
- Internal files it imports: `colyseus/mech-room.ts`.
- External libraries used: `colyseus`, `@colyseus/ws-transport`, `node:http`.
Side Effects:
- Starts network server and logs startup.
Confidence:
- High
Notes:
- Alternative server path to plain `ws` server.

### FILE: `packages/client/src/data/lootTables/types.ts`
Purpose:
- Declares loot table type contracts.
Key Components:
- Loot table interfaces/types and registry types.
Inputs:
- Type consumers in loot systems/data defs.
Outputs:
- Type exports.
Dependencies:
- Internal files it imports: `data/items/types.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Pure type file.

### FILE: `packages/client/src/data/lootTables/definitions.ts`
Purpose:
- Defines default loot table data.
Key Components:
- `DEFAULT_LOOT_TABLES` object.
Inputs:
- Static definitions.
Outputs:
- Loot table registry export.
Dependencies:
- Internal files it imports: `lootTables/types.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Static data definition module.

### FILE: `packages/client/src/test-map/audio.ts`
Purpose:
- Master audio controller for game sounds, ambience, music, and spatial playback.
Key Components:
- `createAudioController()`, `AudioController` interface, numerous audio helper flows.
Inputs:
- Runtime combat/movement events, world/collision context, user settings.
Outputs:
- Played/updated audio streams and control methods.
Dependencies:
- Internal files it imports: `audio-config.ts`, `audio-utils.ts`, `audio-occlusion.ts`, `spatial-audio.ts`, `world-collision.ts`, `types.ts`.
- External libraries used: `tone`.
Side Effects:
- Audio playback, Web Audio graph mutation, asset loading.
Confidence:
- High
Notes:
- Contains extensive `assets/sounds/*` and `assets/music/*` references.

### FILE: `packages/client/src/test-map/audio-utils.ts`
Purpose:
- Provides utility math/state helpers for audio behavior and sensing.
Key Components:
- Distance/volume math helpers and sonar-related utility functions.
Inputs:
- Positions, world/collision context, config values.
Outputs:
- Derived audio parameters and contact metrics.
Dependencies:
- Internal files it imports: `constants.ts`, `types.ts`, `world-collision.ts`.
- External libraries used: `tone`.
Side Effects:
- In-memory helper state updates (if any).
Confidence:
- High
Notes:
- Shared by audio/update logic.

### FILE: `packages/client/src/test-map/audio-occlusion.ts`
Purpose:
- Calculates occlusion/obstruction factors for 3D audio emitters.
Key Components:
- `AudioOcclusionSystem` class and material profile/ray sampling logic.
Inputs:
- Listener/emitter transforms and world collision traces.
Outputs:
- Occlusion attenuation values/state.
Dependencies:
- Internal files it imports: `world-collision.ts`, `types.ts`.
- External libraries used: none.
Side Effects:
- In-memory emitter/occlusion state tracking.
Confidence:
- High
Notes:
- Coupled with spatial audio pipeline.

### FILE: `packages/client/src/test-map/audio-config.ts`
Purpose:
- Holds configurable audio tuning presets.
Key Components:
- `AUDIO_CONFIG`, `AUDIO_NAVIGATION_CONFIG` constants.
Inputs:
- Importing systems.
Outputs:
- Config object exports.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Static config module.

### FILE: `packages/client/src/test-map/accessibility-mode-manager.ts`
Purpose:
- Manages accessibility mode state and focus/navigation support.
Key Components:
- `accessibilityModeManager` singleton and focus APIs.
Inputs:
- UI mode toggles/focus targets.
Outputs:
- Accessibility mode state and DOM focus actions.
Dependencies:
- Internal files it imports: none.
- External libraries used: browser DOM APIs.
Side Effects:
- DOM focus/state changes.
Confidence:
- High
Notes:
- Integrated by test-map UI/console overlays.

### FILE: `packages/client/src/test-map/enemies/testDummyEnemy.ts`
Purpose:
- Defines stationary test-dummy enemy configuration.
Key Components:
- `TestDummyEnemyDefinition` class.
Inputs:
- Base enemy config conventions.
Outputs:
- Enemy definition object/class behavior.
Dependencies:
- Internal files it imports: `enemies/enemyBase.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Includes enemy audio sound-path assignments.

### FILE: `packages/client/src/test-map/enemies/tankEnemy.ts`
Purpose:
- Defines tank enemy behavior/configuration.
Key Components:
- `TankEnemyDefinition` class.
Inputs:
- Base enemy architecture.
Outputs:
- Tank enemy definition for registry/spawn.
Dependencies:
- Internal files it imports: `enemies/enemyBase.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Contains tank-specific sound references.

### FILE: `packages/client/src/test-map/enemies/strikerEnemy.ts`
Purpose:
- Defines striker enemy behavior/configuration.
Key Components:
- `StrikerEnemyDefinition` class.
Inputs:
- Base enemy architecture.
Outputs:
- Striker enemy definition.
Dependencies:
- Internal files it imports: `enemies/enemyBase.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Contains burst-audio and weapon sound references.

### FILE: `packages/client/src/test-map/enemies/index.ts`
Purpose:
- Enemy definition registry and lookup.
Key Components:
- `ENEMY_DEFINITIONS`, `getEnemyDefinition()`.
Inputs:
- Enemy ID lookup requests.
Outputs:
- Enemy definition objects.
Dependencies:
- Internal files it imports: enemy definition files under `enemies/`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Central registry used by combat/spawn systems.

### FILE: `packages/client/src/test-map/enemies/helicopterEnemy.ts`
Purpose:
- Defines helicopter enemy behavior/configuration.
Key Components:
- `HelicopterEnemyDefinition` class.
Inputs:
- Base enemy architecture and missile capability config.
Outputs:
- Helicopter enemy definition.
Dependencies:
- Internal files it imports: `enemies/enemyBase.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Includes missile and looped flight audio references.

### FILE: `packages/client/src/test-map/enemies/enemyTypes.ts`
Purpose:
- Declares enemy type/config interfaces and enums.
Key Components:
- Enemy IDs, definition config types, movement/fire/melee/sound typing.
Inputs:
- Type consumers in enemy/combat systems.
Outputs:
- Type exports.
Dependencies:
- Internal files it imports: `missile-types.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Pure type/config contract file.

### FILE: `packages/client/src/test-map/enemies/enemyBase.ts`
Purpose:
- Abstract base class with shared enemy-definition behavior.
Key Components:
- `EnemyDefinitionBase` class.
Inputs:
- Enemy config objects and runtime config.
Outputs:
- Base methods/properties inherited by concrete enemy definitions.
Dependencies:
- Internal files it imports: `runtime-config.ts`, `enemyTypes.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Common layer for all enemy variants.

### FILE: `packages/client/src/test-map/enemies/bruteEnemy.ts`
Purpose:
- Defines brute enemy behavior/configuration.
Key Components:
- `BruteEnemyDefinition` class.
Inputs:
- Base enemy architecture.
Outputs:
- Brute enemy definition.
Dependencies:
- Internal files it imports: `enemies/enemyBase.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Melee-heavy enemy config.

### FILE: `packages/client/src/test-map/enemies/bruiserEnemy.ts`
Purpose:
- Defines bruiser enemy behavior/configuration.
Key Components:
- `BruiserEnemyDefinition` class.
Inputs:
- Base enemy architecture.
Outputs:
- Bruiser enemy definition.
Dependencies:
- Internal files it imports: `enemies/enemyBase.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Rival-mech style enemy definition.

### FILE: `packages/client/src/test-map/dev-console.ts`
Purpose:
- Implements in-game developer console controller/UI integration.
Key Components:
- `createDeveloperConsole()`, `DeveloperConsoleController` interface.
Inputs:
- Command input strings and bindings.
Outputs:
- Command execution output/history updates.
Dependencies:
- Internal files it imports: `dev-console-history.ts`.
- External libraries used: browser DOM APIs.
Side Effects:
- DOM and local history state updates.
Confidence:
- High
Notes:
- Exposes command execution path for runtime inspection.

### FILE: `packages/client/src/test-map/dev-console-history.ts`
Purpose:
- Persists and retrieves developer-console history.
Key Components:
- `loadDevConsoleHistory()`, `saveDevConsoleHistory()`.
Inputs:
- Command history list.
Outputs:
- Stored history and loaded history arrays.
Dependencies:
- Internal files it imports: none.
- External libraries used: browser storage APIs.
Side Effects:
- Local storage reads/writes.
Confidence:
- High
Notes:
- Storage utility for dev console.

### FILE: `packages/client/src/test-map/controls.ts`
Purpose:
- Defines control actions/default bindings and binding utilities.
Key Components:
- Control action IDs, binding definitions/getters/setters.
Inputs:
- User binding changes and action queries.
Outputs:
- Current binding state and formatted control labels.
Dependencies:
- Internal files it imports: none.
- External libraries used: UNKNOWN.
Side Effects:
- In-memory or persisted binding state changes.
Confidence:
- High
Notes:
- Referenced by input and UI command/help systems.

### FILE: `packages/client/src/test-map/constants.ts`
Purpose:
- Declares gameplay/map/physics constants for test-map.
Key Components:
- Movement, weapon, map size, and tuning constants.
Inputs:
- Importing runtime systems.
Outputs:
- Constant exports.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Core constant source for test-map modules.

### FILE: `packages/client/src/test-map/combat-ecs.ts`
Purpose:
- ECS-based combat simulation state/update/spawn/collision logic.
Key Components:
- Combat world creation, spawn helpers, damage/hit functions, simulation step.
Inputs:
- Player/enemy/weapons state, frame delta, collision context.
Outputs:
- Updated ECS combat state and render-state extracts.
Dependencies:
- Internal files it imports: `constants.ts`, `world-collision.ts`, `enemies/index.ts`, `types.ts`, `missile-types.ts`, `target-layout.ts`, `surface-material.ts`.
- External libraries used: `bitecs`.
Side Effects:
- Mutates ECS world state; may trigger effects hooks/events consumed by audio/UI.
Confidence:
- High
Notes:
- Core combat-state engine used by `main.ts` and update loop.

### FILE: `packages/client/src/test-map/awareness.ts`
Purpose:
- Computes line-of-sight/obstruction awareness state.
Key Components:
- Awareness update functions and threat detection helpers.
Inputs:
- Player/enemy/world collision context.
Outputs:
- Awareness metrics/status flags.
Dependencies:
- Internal files it imports: `constants.ts`, `world-collision.ts`, `types.ts`.
- External libraries used: none.
Side Effects:
- Mutates awareness state objects.
Confidence:
- High
Notes:
- Feeds HUD and/or behavior cues.

### FILE: `packages/client/src/data/items/types.ts`
Purpose:
- Defines item and inventory stack type contracts.
Key Components:
- `ItemDefinition`, `InventoryStack` interfaces/types.
Inputs:
- Type consumers.
Outputs:
- Type exports.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Pure type declaration module.

### FILE: `packages/client/src/data/items/definitions.ts`
Purpose:
- Declares default item catalog entries.
Key Components:
- `DEFAULT_ITEM_DEFINITIONS`.
Inputs:
- Static item definitions.
Outputs:
- Item definition registry export.
Dependencies:
- Internal files it imports: `data/items/types.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Static data source consumed by item database.

### FILE: `packages/server/src/colyseus/index.ts`
Purpose:
- Colyseus runtime entry point.
Key Components:
- Calls `startColyseusServer()`.
Inputs:
- Process startup.
Outputs:
- Running Colyseus server process.
Dependencies:
- Internal files it imports: `colyseus/start-colyseus.ts`.
- External libraries used: none.
Side Effects:
- Starts long-running network process.
Confidence:
- High
Notes:
- Separate entry path from WebSocket server bootstrap.

### FILE: `packages/server/src/colyseus/mech-room.ts`
Purpose:
- Implements Colyseus room simulation lifecycle and client handling.
Key Components:
- `MechRoom` class (`onCreate`, `onJoin`, `onLeave`), local `createPlayer()`.
Inputs:
- Colyseus client join/input messages and tick interval.
Outputs:
- Welcome and snapshot broadcasts.
Dependencies:
- Internal files it imports: shared schemas/types/constants, `config.ts`, `state/create-world-state.ts`, `simulation/tick-world.ts`, `net/protocol.ts`.
- External libraries used: `colyseus`.
Side Effects:
- Network messaging and in-memory world/session mutations.
Confidence:
- High
Notes:
- Uses schema validation on room input messages.

### FILE: `packages/client/src/systems/parts/statResolver.ts`
Purpose:
- Computes final part-derived runtime stats.
Key Components:
- `configurePartStatResolver()`, `getFinalPartStats()`.
Inputs:
- Part definitions/loadout/effect context.
Outputs:
- Derived final stat values.
Dependencies:
- Internal files it imports: `data/parts/types.ts`.
- External libraries used: none.
Side Effects:
- In-memory resolver configuration/state updates.
Confidence:
- High
Notes:
- Main path for part stat application.

### FILE: `packages/client/src/systems/parts/effectModifiers.ts`
Purpose:
- Evaluates and applies conditional part-effect modifiers.
Key Components:
- Effect-active checks and modifier application helpers.
Inputs:
- Runtime context and part effect definitions.
Outputs:
- Modified stats/effect application results.
Dependencies:
- Internal files it imports: `data/parts/types.ts`.
- External libraries used: none.
Side Effects:
- Mutates or returns modified stat objects depending on call path.
Confidence:
- High
Notes:
- Used with stat resolver in runtime loadout calculations.

### FILE: `packages/client/src/systems/loot/lootGenerator.ts`
Purpose:
- Generates loot drops from configured loot tables.
Key Components:
- `LootGenerator` interface and generation functions.
Inputs:
- Loot table entries, RNG/context inputs.
Outputs:
- Item stack/drop results.
Dependencies:
- Internal files it imports: items data/types, inventory and loot table modules.
- External libraries used: UNKNOWN.
Side Effects:
- None expected beyond RNG usage.
Confidence:
- High
Notes:
- Data-driven loot creation layer.

### FILE: `packages/client/src/systems/weight/mechWeight.ts`
Purpose:
- Calculates mech total weight and over-encumbrance state.
Key Components:
- `getTotalMechWeight()`, `getOverencumbranceState()`, threshold types.
Inputs:
- Loadout/component weights and threshold configuration.
Outputs:
- Weight totals and encumbrance state.
Dependencies:
- Internal files it imports: none.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Pure computation utility.

### FILE: `packages/client/src/systems/inventory/itemDatabase.ts`
Purpose:
- Item definition lookup/registry API.
Key Components:
- `ItemDatabase` interface, `createItemDatabase()`, default database export.
Inputs:
- Item IDs/definition keys.
Outputs:
- Item definition objects.
Dependencies:
- Internal files it imports: `data/items/definitions.ts`, `data/items/types.ts`.
- External libraries used: none.
Side Effects:
- None.
Confidence:
- High
Notes:
- Consumed by inventory/loot/pickup systems.

### FILE: `packages/client/src/systems/inventory/inventoryManager.ts`
Purpose:
- Manages inventory stack add/remove/query operations.
Key Components:
- `InventoryManager` interface, `createInventoryManager()`.
Inputs:
- Item stack operations and inventory requests.
Outputs:
- Updated inventory state and query results.
Dependencies:
- Internal files it imports: item database and item types/defs.
- External libraries used: none.
Side Effects:
- Mutates inventory state.
Confidence:
- High
Notes:
- Core inventory state module.

### FILE: `packages/client/src/systems/pickup/pickupSystem.ts`
Purpose:
- Handles item pickup interaction rules and prompts.
Key Components:
- `PickupSystem` interface, `createPickupSystem()`.
Inputs:
- Player position/interact state and nearby loot containers/items.
Outputs:
- Pickup results and prompt status.
Dependencies:
- Internal files it imports: items/inventory/loot modules.
- External libraries used: none.
Side Effects:
- Mutates world pickup/inventory state.
Confidence:
- High
Notes:
- Connected to main runtime interaction flow.

### FILE: `packages/client/src/systems/pickup/pickupWorldSystem.ts`
Purpose:
- World-space representation/audio-cue layer for pickups.
Key Components:
- `PickupWorldSystem` interface, `createPickupWorldSystem()`.
Inputs:
- Pickup entities, world transforms, player context.
Outputs:
- World pickup visuals/audio cue updates.
Dependencies:
- Internal files it imports: pickup/inventory modules.
- External libraries used: `three`.
Side Effects:
- Scene object creation/update and audio cue playback/state.
Confidence:
- High
Notes:
- Bridges pickup data to world presentation.

### FILE: `packages/client/src/systems/persistence/worldItemPersistence.ts`
Purpose:
- Persists world item/chunk state and handles cleanup/despawn.
Key Components:
- `WorldItemPersistenceManager` interface and persistence operations.
Inputs:
- Chunk lifecycle and item state transitions.
Outputs:
- Saved/restored world item state.
Dependencies:
- Internal files it imports: inventory and pickup systems.
- External libraries used: UNKNOWN.
Side Effects:
- Persistence reads/writes and in-memory cleanup mutations.
Confidence:
- Medium
Notes:
- Handles world-item continuity across chunk/activity changes.

# 4. Entry Points

Application/server entry points identified:
- Browser root redirect: `index.html` redirects to `test-map.html`.
- Client runtime bootstrap (served build artifact): `test-map.html` loads `./packages/client/dist/test-map/main.js`.
- Client source bootstrap module: `packages/client/src/test-map/main.ts` (runtime orchestrator used for build output).
- WebSocket server start point: `packages/server/src/index.ts` calling `startWebSocketServer()` in `packages/server/src/net/ws-server.ts`.
- Colyseus server start point: `packages/server/src/colyseus/index.ts` calling `startColyseusServer()` in `packages/server/src/colyseus/start-colyseus.ts`.
- Auxiliary standalone entry points:
  - `audio-combo-tester.html` (audio test UI)
  - `missile-sim.mjs` (console simulation script)

Client initialization flow (source-level):
1. `test-map.html` loads built `main.js`.
2. Source analog is `packages/client/src/test-map/main.ts`.
3. `main.ts` imports and initializes controls/input/audio/render/combat/world systems.
4. `main.ts` runs the per-frame update/render loop and optional network client messaging.

# 5. Data Flow Map (IMPORTANT)

Client gameplay flow:
1. User input events are bound via `packages/client/src/test-map/input.ts` and control definitions from `packages/client/src/test-map/controls.ts`.
2. `packages/client/src/test-map/main.ts` reads input state, runs `packages/client/src/test-map/update.ts`, and steps combat via `packages/client/src/test-map/combat-ecs.ts`.
3. Collision and world queries are performed through `packages/client/src/test-map/world-collision.ts` and map data from `packages/client/src/test-map/map-data.ts`.
4. Visual output is rendered by `packages/client/src/test-map/three-render.ts` and UI overlays (`world-map-overlay.ts`, HUD DOM in `test-map.html`).
5. Audio events/state are routed through `packages/client/src/test-map/audio.ts` (using helpers from `audio-utils.ts`, `audio-occlusion.ts`, `spatial-audio.ts`).

Network flow (WebSocket path):
1. Client creates socket via `packages/client/src/net/ws-client.ts`.
2. Client sends `hello` and `input` JSON payloads.
3. Server receives and parses via `packages/server/src/net/ws-server.ts` + `packages/server/src/net/protocol.ts`.
4. Server updates per-client input map, runs `tickWorld()` (`packages/server/src/simulation/tick-world.ts`), applying movement in `apply-input.ts`.
5. Server serializes world snapshots (`serializeWorld`) and broadcasts snapshot messages back to clients.
6. Client parses incoming server messages via shared schema parser in `@mech-audio/shared` usage inside `ws-client.ts`.

Network flow (Colyseus path):
1. `packages/server/src/colyseus/start-colyseus.ts` registers `MechRoom`.
2. `packages/server/src/colyseus/mech-room.ts` validates input (`InputStateSchema`), ticks world, broadcasts snapshots.

State/data management flow:
- Item data: `data/items/*` -> `systems/inventory/itemDatabase.ts` -> `systems/inventory/inventoryManager.ts`.
- Loot: `data/lootTables/*` + item DB -> `systems/loot/lootGenerator.ts`.
- Pickup: `systems/pickup/pickupSystem.ts` and `pickupWorldSystem.ts` manage interaction plus world representation.
- Parts/loadout: `data/parts/types.ts` + `data/parts/catalog.ts` -> `systems/parts/statResolver.ts` + `effectModifiers.ts` -> used by `main.ts` and garage UI.

# 6. “Testmap” subsystem focus

All files belonging to `test-map` subsystem:
- `packages/client/src/test-map/accessibility-mode-manager.ts`
- `packages/client/src/test-map/audio-config.ts`
- `packages/client/src/test-map/audio-occlusion.ts`
- `packages/client/src/test-map/audio-utils.ts`
- `packages/client/src/test-map/audio.ts`
- `packages/client/src/test-map/awareness.ts`
- `packages/client/src/test-map/combat-ecs.ts`
- `packages/client/src/test-map/constants.ts`
- `packages/client/src/test-map/controls.ts`
- `packages/client/src/test-map/dev-console-history.ts`
- `packages/client/src/test-map/dev-console.ts`
- `packages/client/src/test-map/input.ts`
- `packages/client/src/test-map/keyboard-focus.ts`
- `packages/client/src/test-map/main.ts`
- `packages/client/src/test-map/map-data.ts`
- `packages/client/src/test-map/missile-threat-manager.ts`
- `packages/client/src/test-map/missile-types.ts`
- `packages/client/src/test-map/player-state.ts`
- `packages/client/src/test-map/runtime-config.ts`
- `packages/client/src/test-map/scene-layout.ts`
- `packages/client/src/test-map/spatial-audio.ts`
- `packages/client/src/test-map/sprites.ts`
- `packages/client/src/test-map/surface-material.ts`
- `packages/client/src/test-map/target-layout.ts`
- `packages/client/src/test-map/target-lock.ts`
- `packages/client/src/test-map/three-render.ts`
- `packages/client/src/test-map/types.ts`
- `packages/client/src/test-map/update-scheduler.ts`
- `packages/client/src/test-map/update.ts`
- `packages/client/src/test-map/weapons.ts`
- `packages/client/src/test-map/world-collision.ts`
- `packages/client/src/test-map/world-map-overlay.ts`
- `packages/client/src/test-map/world-streaming.ts`
- `packages/client/src/test-map/enemies/bruiserEnemy.ts`
- `packages/client/src/test-map/enemies/bruteEnemy.ts`
- `packages/client/src/test-map/enemies/enemyBase.ts`
- `packages/client/src/test-map/enemies/enemyTypes.ts`
- `packages/client/src/test-map/enemies/helicopterEnemy.ts`
- `packages/client/src/test-map/enemies/index.ts`
- `packages/client/src/test-map/enemies/strikerEnemy.ts`
- `packages/client/src/test-map/enemies/tankEnemy.ts`
- `packages/client/src/test-map/enemies/testDummyEnemy.ts`

How `test-map` connects to rest of system:
- Runtime entry path: `test-map.html` -> built `main.js` (source: `packages/client/src/test-map/main.ts`).
- Networking connection: `main.ts` imports `packages/client/src/net/ws-client.ts`.
- Data systems integration from `main.ts`:
  - Inventory/loot/pickup/persistence/weight systems in `packages/client/src/systems/*`
  - Parts data and stat systems in `packages/client/src/data/parts/*` and `packages/client/src/systems/parts/*`
  - Garage UI in `packages/client/src/ui/garage/*`

What `test-map` depends on:
- Internal dependencies outside folder:
  - `packages/client/src/net/ws-client.ts`
  - `packages/client/src/systems/inventory/*`
  - `packages/client/src/systems/loot/*`
  - `packages/client/src/systems/parts/*`
  - `packages/client/src/systems/pickup/*`
  - `packages/client/src/systems/persistence/*`
  - `packages/client/src/systems/weight/mechWeight.ts`
  - `packages/client/src/ui/garage/*`
  - `packages/client/src/data/items/*`
  - `packages/client/src/data/lootTables/*`
  - `packages/client/src/data/parts/*`
  - `packages/client/src/types/resonance-audio.d.ts`
- External libraries (directly or via submodules):
  - `three`
  - `three-mesh-bvh`
  - `tone`
  - `bitecs`
  - `resonance-audio`

What depends on `test-map`:
- `test-map.html` depends on built output of `test-map/main.ts`.
- Root `index.html` indirectly depends on test-map page via redirect.
- No server package files import `packages/client/src/test-map/*` directly (from inspected import graph context).

# 7. Cross-file relationships

Strongly coupled relationships (import/explicit usage based):
- `packages/client/src/test-map/main.ts` <-> many `packages/client/src/test-map/*` runtime modules.
- `packages/client/src/test-map/main.ts` <-> `packages/client/src/systems/*` (inventory, loot, pickup, persistence, weight).
- `packages/client/src/test-map/main.ts` <-> `packages/client/src/ui/garage/index.ts` and `packages/client/src/ui/garage/store.ts`.
- `packages/client/src/test-map/combat-ecs.ts` <-> `packages/client/src/test-map/enemies/index.ts` and `packages/client/src/test-map/world-collision.ts`.
- `packages/client/src/test-map/audio.ts` <-> `audio-utils.ts`, `audio-occlusion.ts`, `spatial-audio.ts`, `world-collision.ts`.
- `packages/client/src/test-map/update.ts` <-> `world-collision.ts` and `audio-utils.ts`.
- `packages/server/src/net/ws-server.ts` <-> `packages/server/src/simulation/tick-world.ts` <-> `packages/server/src/simulation/apply-input.ts`.
- `packages/server/src/colyseus/mech-room.ts` <-> `packages/server/src/state/create-world-state.ts` and `tick-world.ts`.
- `packages/client/src/net/ws-client.ts` <-> `@mech-audio/shared` network parsers/types.
- `packages/server/src/net/protocol.ts` <-> `@mech-audio/shared` network parsers/types.

Shared utilities/modules used across repo:
- `packages/shared/src/index.ts` and re-exported shared modules are imported by both client and server packages.
- `packages/client/src/data/items/types.ts` and `definitions.ts` are reused across inventory and loot systems.
- `packages/client/src/data/parts/types.ts` is shared across parts systems and garage UI.

Central core modules:
- Client core: `packages/client/src/test-map/main.ts`
- Collision core: `packages/client/src/test-map/world-collision.ts`
- Combat core: `packages/client/src/test-map/combat-ecs.ts`
- Audio core: `packages/client/src/test-map/audio.ts`
- Server core: `packages/server/src/net/ws-server.ts`
- Shared protocol/types core: `packages/shared/src/types/network.ts`, `packages/shared/src/schemas/network.ts`

# Asset and Content Inventory

## Audio

Path:
- `assets/sounds/`
Purpose:
- Core SFX library (weapons, explosions, movement, UI, ambient loops, navigation cues).
Referenced By:
- `packages/client/src/test-map/audio.ts`
- `packages/client/src/test-map/main.ts`
- `packages/client/src/test-map/weapons.ts`
- `packages/client/src/test-map/missile-types.ts`
- `packages/client/src/test-map/enemies/*.ts`
- `audio-combo-tester.html` (path input/testing support)
References:
- Subfolders include `ambience/`, `explosions/`, `inventory/`, `nav/`, `steps/`, `weapons/`.

Path:
- `assets/music/`
Purpose:
- Music tracks used by test-map audio controller.
Referenced By:
- `packages/client/src/test-map/audio.ts`
References:
- Track names referenced in code include `slowDrone`, `scary`, `suspense`, `dark`, `hunting`, `alleyWay`, `CfuturisticCity`.

Path:
- `assets/audio/`
Purpose:
- UNKNOWN
Referenced By:
- UNKNOWN
References:
- UNKNOWN

## Images

Path:
- `favicon.svg`
Purpose:
- Browser tab icon.
Referenced By:
- `index.html`
- `test-map.html`
References:
- None

Path:
- `favicon.ico`
Purpose:
- Alternate favicon asset.
Referenced By:
- UNKNOWN
References:
- None

## JSON data

Path:
- `packages/client/src/data/parts/parts.json`
Purpose:
- Parts catalog data source.
Referenced By:
- `packages/client/src/data/parts/catalog.ts`
- `scripts/sync-client-parts-json.mjs`
- `scripts/apply-catalog-export.mjs`
References:
- `packages/client/src/data/parts/types.ts`

Path:
- `garage-catalog-2026-05-15.json`
Purpose:
- Catalog export/snapshot data.
Referenced By:
- `scripts/apply-catalog-export.mjs` (intended workflow context).
References:
- Part catalog JSON structure.

Path:
- `packages/client/src/data/parts/backups/parts.2026-05-15T20-00-35-478Z.json`
Purpose:
- Backup catalog snapshot.
Referenced By:
- UNKNOWN
References:
- Mirrors parts catalog structure.

## Configuration files

Path:
- `package.json`
Purpose:
- Root workspace scripts/dependency config.
Referenced By:
- npm tooling.
References:
- Package scripts and workspace package linkage.

Path:
- `packages/client/package.json`
Purpose:
- Client package config.
Referenced By:
- npm/package manager and client build tooling.
References:
- Client dependencies/scripts.

Path:
- `packages/server/package.json`
Purpose:
- Server package config.
Referenced By:
- npm/package manager and server tooling.
References:
- Server dependencies/scripts.

Path:
- `packages/shared/package.json`
Purpose:
- Shared package config.
Referenced By:
- npm/package manager and package consumers.
References:
- Shared dependencies/scripts.

Path:
- `tsconfig.json`
Purpose:
- Root TypeScript config.
Referenced By:
- TypeScript compiler/tooling.
References:
- `tsconfig.base.json`

Path:
- `tsconfig.base.json`
Purpose:
- Base TypeScript compiler options.
Referenced By:
- Root and package tsconfig files.
References:
- `packages/client/tsconfig.json`, `packages/server/tsconfig.json`, `packages/shared/tsconfig.json`

Path:
- `packages/client/tsconfig.json`
Purpose:
- Client TS build/typecheck config.
Referenced By:
- TypeScript tooling.
References:
- Root/base TS config.

Path:
- `packages/server/tsconfig.json`
Purpose:
- Server TS build/typecheck config.
Referenced By:
- TypeScript tooling.
References:
- Root/base TS config.

Path:
- `packages/shared/tsconfig.json`
Purpose:
- Shared TS build/typecheck config.
Referenced By:
- TypeScript tooling.
References:
- Root/base TS config.

## Maps

Path:
- `packages/client/src/test-map/scene-layout.ts`
Purpose:
- Defines map zones, POIs, and scene layout data generation.
Referenced By:
- `map-data.ts`, `world-map-overlay.ts`, `surface-material.ts`, `sprites.ts`.
References:
- `constants.ts`, `types.ts`.

Path:
- `packages/client/src/test-map/map-data.ts`
Purpose:
- Constructs/query map grid data.
Referenced By:
- `world-collision.ts`, `three-render.ts`, `world-streaming.ts`.
References:
- `scene-layout.ts`, `constants.ts`.

## Localization

Path:
- UNKNOWN
Purpose:
- UNKNOWN
Referenced By:
- UNKNOWN
References:
- UNKNOWN

## Other content

Path:
- `docs/`
Purpose:
- Project documentation/spec files.
Referenced By:
- Developer workflow.
References:
- Markdown design and implementation docs.

Path:
- `assets/convertMP3toOgg.bat`, `assets/convertWavToOgg.bat`, `assets/normalize.bat`, `assets/burstShotMaker/*`
Purpose:
- Audio asset pipeline/conversion utilities.
Referenced By:
- Manual asset prep workflow.
References:
- Audio files under `assets/sounds` and related folders.

Path:
- `PartStatsCatalog.txt`, `MasterSpecDoc.md`, `ImplementationRoadMap.md`
Purpose:
- Design/specification/reference artifacts.
Referenced By:
- Human/dev process.
References:
- UNKNOWN
# 1. Repository Overview

This repository appears to be a TypeScript/JavaScript game project centered on a browser-playable test environment (test-map) with strong audio systems, a modular client runtime, shared protocol/types, and a Node.js multiplayer server stack (WebSocket and optional Colyseus). The top-level structure also contains content pipelines, static HTML test harnesses, and data catalogs for parts/items/loot.

Major subsystems inferred from folder structure only:
- packages/client: Client runtime, test-map gameplay systems, UI, data catalogs, and network client.
- packages/server: Multiplayer server runtime, simulation tick, protocol, and Colyseus room bootstrap.
- packages/shared: Shared constants, network types, validation schemas, and RNG utilities.
- assets: Audio/music/content assets plus conversion/normalization utility scripts.
- scripts: Repo automation scripts (catalog application, JSON sync, lock wrapper).
- docs: Design and system documentation.
- root HTML tools: test-map shell, audio-combo-tester, and redirect index page.

# 2. Directory Tree (cleaned)

```text
.
├─ assets/
│  ├─ audio/
│  ├─ burstShotMaker/
│  ├─ music/
│  ├─ sounds/
│  │  ├─ ambience/
│  │  ├─ explosions/
│  │  ├─ inventory/
│  │  ├─ nav/
│  │  ├─ steps/
│  │  └─ weapons/
│  ├─ convertMP3toOgg.bat
│  ├─ convertWavToOgg.bat
│  └─ normalize.bat
├─ docs/
│  ├─ audio-signal-flow.md
│  └─ world-chunking-system.md
├─ packages/
│  ├─ client/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ src/
│  │     ├─ data/
│  │     │  ├─ items/
│  │     │  ├─ lootTables/
│  │     │  └─ parts/
│  │     ├─ net/
│  │     ├─ systems/
│  │     ├─ test-map/
│  │     ├─ types/
│  │     └─ ui/
│  ├─ server/
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ src/
│  │     ├─ colyseus/
│  │     ├─ net/
│  │     ├─ simulation/
│  │     ├─ state/
│  │     ├─ config.ts
│  │     └─ index.ts
│  └─ shared/
│     ├─ package.json
│     ├─ tsconfig.json
│     └─ src/
│        ├─ constants/
│        ├─ schemas/
│        ├─ types/
│        ├─ utils/
│        └─ index.ts
├─ scripts/
│  ├─ apply-catalog-export.mjs
│  ├─ sync-client-parts-json.mjs
│  └─ with-dev-lock.mjs
├─ audio-combo-tester.html
├─ index.html
├─ missile-sim.mjs
├─ test-map.html
├─ package.json
├─ tsconfig.json
└─ tsconfig.base.json
```

# 3. File Index (MOST IMPORTANT SECTION)

### FILE: `index.html`
Purpose:
- Redirects browser entry to test-map.html.
Key Components:
- HTML document with meta refresh.
Inputs:
- Browser request for root page.
Outputs:
- Immediate redirect to test-map.html.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- Browser navigation redirect.
Confidence:
- High.
Notes:
- Contains fallback link in noscript block.

### FILE: `test-map.html`
Purpose:
- Provides the UI shell and DOM containers for the test-map client runtime.
Key Components:
- HUD overlays, debug/pause/navigation panels, import map, module script tag.
Inputs:
- User browser interactions and module script loading.
Outputs:
- Renders game container and overlays; loads client dist main module.
Dependencies:
- Internal files it imports: packages/client/dist/test-map/main.js (runtime output path in script tag).
- External libraries used: Import map entries (THREE/Tone related module aliases in page).
Side Effects:
- DOM creation/styling, event target surfaces for game UI.
Confidence:
- High.
Notes:
- Script tag points to built dist file path.

### FILE: `audio-combo-tester.html`
Purpose:
- Standalone browser tool for constructing/testing layered audio combinations.
Key Components:
- Tone.js-backed UI controls, preset/editor panels, path entry fields.
Inputs:
- Form inputs, button actions, audio path strings.
Outputs:
- Plays audio/effect combinations and updates status UI.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: Tone.js CDN.
Side Effects:
- DOM mutation, WebAudio playback.
Confidence:
- Medium.
Notes:
- Uses asset path text fields (example paths under assets/sounds).

### FILE: `missile-sim.mjs`
Purpose:
- Runs missile trajectory simulations in Node for ballistic/guidance behavior checks.
Key Components:
- simulate, clampProjectilePitch, getPitchToTarget, getFirstContactFraction.
Inputs:
- Hardcoded test scenarios and numeric parameters.
Outputs:
- Console logs per-frame/hit simulation results.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- Console output.
Confidence:
- High.
Notes:
- Self-contained simulation script.

### FILE: `scripts/with-dev-lock.mjs`
Purpose:
- Runs a child process with lock-file protection against overlapping dev runs.
Key Components:
- Lock acquisition/release logic, process spawn wrapper.
Inputs:
- CLI arguments and lock state.
Outputs:
- Starts target process or exits on active lock.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: node:fs, node:child_process.
Side Effects:
- Filesystem lock writes/removals, process spawning.
Confidence:
- High.
Notes:
- Used as development safety wrapper.

### FILE: `scripts/sync-client-parts-json.mjs`
Purpose:
- Synchronizes parts JSON content into client dist/output location.
Key Components:
- File read/copy routine.
Inputs:
- Source parts JSON file content.
Outputs:
- Copied/synced JSON file.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: node:fs/promises.
Side Effects:
- Filesystem read/write.
Confidence:
- High.
Notes:
- Data pipeline utility script.

### FILE: `scripts/apply-catalog-export.mjs`
Purpose:
- Applies exported catalog snapshots into the parts catalog JSON.
Key Components:
- Catalog merge/apply logic and file persistence.
Inputs:
- Exported catalog payload and existing catalog file.
Outputs:
- Updated catalog JSON on disk.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: node:fs.
Side Effects:
- Filesystem read/write and data mutation.
Confidence:
- High.
Notes:
- CLI-style content editing utility.

### FILE: `packages/shared/src/index.ts`
Purpose:
- Barrel re-export for shared constants/types/schemas/utilities.
Key Components:
- Named re-exports.
Inputs:
- Consumer imports.
Outputs:
- Re-exported module surface.
Dependencies:
- Internal files it imports: constants/world-constants.ts, types/world.ts, types/network.ts, schemas/network.ts, utils/rng.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Aggregates shared package public API.

### FILE: `packages/shared/src/constants/world-constants.ts`
Purpose:
- Defines world simulation constants used across client/server.
Key Components:
- MAP_WIDTH, MAP_HEIGHT, PLAYER_SPEED, TURN_SPEED, and related constants.
Inputs:
- Import usage by simulation/render/network modules.
Outputs:
- Constant exports.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Central numeric tuning constants in shared layer.

### FILE: `packages/shared/src/types/world.ts`
Purpose:
- Declares canonical world-state interfaces and entity structures.
Key Components:
- WorldState, PlayerState, SpriteObject, InputState interfaces/types.
Inputs:
- Type imports from client/server modules.
Outputs:
- Type exports.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Type-only module.

### FILE: `packages/shared/src/types/network.ts`
Purpose:
- Declares client/server message contracts and serialized world payload types.
Key Components:
- ClientToServerMessage, ServerToClientMessage, SerializedWorldState.
Inputs:
- Type imports from ws client/server protocol code.
Outputs:
- Type exports.
Dependencies:
- Internal files it imports: world types.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Discriminated message unions defined here.

### FILE: `packages/shared/src/schemas/network.ts`
Purpose:
- Implements runtime schema validation for network payloads.
Key Components:
- InputStateSchema, ClientToServerMessageSchema, parser helpers.
Inputs:
- Unknown/parsed JSON network payloads.
Outputs:
- Validated typed objects or failed parses.
Dependencies:
- Internal files it imports: shared network/world types/constants as needed.
- External libraries used: zod.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Runtime validation boundary for protocol safety.

### FILE: `packages/shared/src/utils/rng.ts`
Purpose:
- Provides deterministic seeded random-number generator utilities.
Key Components:
- Rng interface, createSeededRng.
Inputs:
- Seed value.
Outputs:
- RNG methods/next values.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- Internal mutable RNG state.
Confidence:
- High.
Notes:
- Utility module for repeatable randomness.

### FILE: `packages/server/src/config.ts`
Purpose:
- Defines server runtime constants such as port and tick interval.
Key Components:
- SERVER_PORT, TICK_RATE_HZ, TICK_INTERVAL_MS.
Inputs:
- Imported by server startup/simulation modules.
Outputs:
- Constant exports.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Central server config values.

### FILE: `packages/server/src/index.ts`
Purpose:
- Default server bootstrap for WebSocket server mode.
Key Components:
- startWebSocketServer invocation.
Inputs:
- Process startup.
Outputs:
- Starts listening server.
Dependencies:
- Internal files it imports: net/ws-server.ts.
- External libraries used: NONE.
Side Effects:
- Opens network server.
Confidence:
- High.
Notes:
- Minimal entry point.

### FILE: `packages/server/src/net/client-session.ts`
Purpose:
- Wraps per-client session state for server connection management.
Key Components:
- ClientSession interface, createClientSession.
Inputs:
- Client id, websocket socket.
Outputs:
- Session object with lastInput state.
Dependencies:
- Internal files it imports: shared input types.
- External libraries used: ws (socket type usage).
Side Effects:
- Session object state mutation by consumers.
Confidence:
- High.
Notes:
- Used by ws-server session map.

### FILE: `packages/server/src/net/protocol.ts`
Purpose:
- Parses incoming client JSON and serializes world snapshots/server messages.
Key Components:
- parseClientMessage, serializeWorld, encodeServerMessage.
Inputs:
- Raw JSON strings, world state objects, server message objects.
Outputs:
- Parsed message objects and JSON strings.
Dependencies:
- Internal files it imports: @mech-audio/shared parsers/types.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Protocol translation boundary.

### FILE: `packages/server/src/net/ws-server.ts`
Purpose:
- Implements WebSocket multiplayer server loop and player lifecycle.
Key Components:
- startWebSocketServer, createPlayer helper, send helper.
Inputs:
- Socket connections and message events (hello/input).
Outputs:
- welcome/snapshot server messages to clients.
Dependencies:
- Internal files it imports: config.ts, create-world-state.ts, tick-world.ts, client-session.ts, protocol.ts, shared types.
- External libraries used: ws.
Side Effects:
- Network I/O, setInterval simulation tick, world/session/input map mutation, console logging.
Confidence:
- High.
Notes:
- Maintains authoritative world state in-memory.

### FILE: `packages/server/src/simulation/apply-input.ts`
Purpose:
- Applies one player input to world/player physics and collision constraints.
Key Components:
- applyInput, getCell, isWall, isSolidSpriteAt.
Inputs:
- WorldState, PlayerState, InputState, deltaSeconds.
Outputs:
- Mutated player position/angle/pitch in world state.
Dependencies:
- Internal files it imports: shared constants and world/input types.
- External libraries used: NONE.
Side Effects:
- Mutates player state in-place.
Confidence:
- High.
Notes:
- Handles turn/look and move/strafe with collision checks.

### FILE: `packages/server/src/simulation/tick-world.ts`
Purpose:
- Advances world tick and applies pending player inputs each frame.
Key Components:
- tickWorld.
Inputs:
- WorldState, inputsByPlayerId map, deltaSeconds.
Outputs:
- Updated world tick and player transforms.
Dependencies:
- Internal files it imports: apply-input.ts, shared types.
- External libraries used: NONE.
Side Effects:
- Mutates world object.
Confidence:
- High.
Notes:
- Iterates all active players.

### FILE: `packages/server/src/state/create-world-state.ts`
Purpose:
- Builds initial world object including map/sprites/player container.
Key Components:
- createWorldState and map/sprite setup helpers.
Inputs:
- Internal constants/defaults.
Outputs:
- Initialized WorldState object.
Dependencies:
- Internal files it imports: shared world constants/types.
- External libraries used: NONE.
Side Effects:
- NONE (returns new object).
Confidence:
- Medium.
Notes:
- Contains world bootstrap data.

### FILE: `packages/server/src/colyseus/start-colyseus.ts`
Purpose:
- Starts Colyseus game server and defines room mappings.
Key Components:
- COLYSEUS_PORT, startColyseusServer.
Inputs:
- Optional port parameter.
Outputs:
- Running Colyseus server listener.
Dependencies:
- Internal files it imports: mech-room.ts.
- External libraries used: colyseus, @colyseus/ws-transport, node:http.
Side Effects:
- Opens network listener, console logging.
Confidence:
- High.
Notes:
- Alternative multiplayer server bootstrap.

### FILE: `packages/server/src/colyseus/mech-room.ts`
Purpose:
- Defines Colyseus room lifecycle with world simulation and input handling.
Key Components:
- MechRoom class, createPlayer helper.
Inputs:
- onCreate, onMessage(input), onJoin, onLeave room events.
Outputs:
- Broadcast snapshot messages and welcome messages.
Dependencies:
- Internal files it imports: config.ts, create-world-state.ts, tick-world.ts, protocol.ts, shared schema/types.
- External libraries used: colyseus.
Side Effects:
- Room state mutation, interval simulation, client messaging.
Confidence:
- High.
Notes:
- Validates input via shared InputStateSchema.

### FILE: `packages/server/src/colyseus/index.ts`
Purpose:
- Entry point for Colyseus server mode.
Key Components:
- startColyseusServer invocation.
Inputs:
- Process startup.
Outputs:
- Starts Colyseus host.
Dependencies:
- Internal files it imports: start-colyseus.ts.
- External libraries used: NONE.
Side Effects:
- Network listener startup.
Confidence:
- High.
Notes:
- Uses void call for async bootstrap.

### FILE: `packages/client/src/types/resonance-audio.d.ts`
Purpose:
- Declares TypeScript module typings for resonance-audio package.
Key Components:
- ResonanceAudioSource, ResonanceAudioScene, constructor/type declarations.
Inputs:
- TypeScript compile-time type lookups.
Outputs:
- Ambient module type definitions.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: resonance-audio (type declaration target).
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Declaration-only file.

### FILE: `packages/client/src/net/ws-client.ts`
Purpose:
- Provides browser WebSocket client abstraction for hello/input/snapshot handling.
Key Components:
- WsClient interface, createWsClient, connect/sendInput/close.
Inputs:
- URL, clientId, InputState payloads, incoming socket events.
Outputs:
- Sends protocol JSON and invokes onMessage callback with validated messages.
Dependencies:
- Internal files it imports: @mech-audio/shared parseServerToClientMessage/types.
- External libraries used: Browser WebSocket API.
Side Effects:
- Network I/O, internal socket state mutation.
Confidence:
- High.
Notes:
- Drops invalid JSON or schema-invalid payloads.

### FILE: `packages/client/src/data/items/types.ts`
Purpose:
- Defines item and inventory stack type contracts.
Key Components:
- ItemDefinition, InventoryStack and related types.
Inputs:
- Type imports by inventory/loot/ui systems.
Outputs:
- Type exports.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Type-only data model.

### FILE: `packages/client/src/data/items/definitions.ts`
Purpose:
- Contains default item catalog entries.
Key Components:
- DEFAULT_ITEM_DEFINITIONS collection.
Inputs:
- Consumed by item database/loot systems.
Outputs:
- Item definition registry export.
Dependencies:
- Internal files it imports: items/types.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Static data module.

### FILE: `packages/client/src/data/lootTables/types.ts`
Purpose:
- Defines loot table type system and registry interfaces.
Key Components:
- LootTable, LootTableRegistry and entry types.
Inputs:
- Type imports by loot generator/data definitions.
Outputs:
- Type exports.
Dependencies:
- Internal files it imports: data/items/types.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Type-only module.

### FILE: `packages/client/src/data/lootTables/definitions.ts`
Purpose:
- Provides default loot table datasets.
Key Components:
- DEFAULT_LOOT_TABLES.
Inputs:
- Used by createLootGenerator and gameplay systems.
Outputs:
- Loot table registry export.
Dependencies:
- Internal files it imports: lootTables/types.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Static loot content definitions.

### FILE: `packages/client/src/data/parts/types.ts`
Purpose:
- Declares part/loadout/garage/effect type system for mech configuration.
Key Components:
- PartDefinition, MechLoadout, GarageSnapshot, effect-related types.
Inputs:
- Type imports by garage UI, stat/effect systems, main runtime.
Outputs:
- Type exports.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Core type hub for parts subsystem.

### FILE: `packages/client/src/data/parts/catalog.ts`
Purpose:
- Loads/saves/manages part catalog persistence.
Key Components:
- loadPartCatalog, savePartCatalog and helper utilities.
Inputs:
- Catalog snapshots/JSON data and consumer requests.
Outputs:
- Catalog data structures and persistence writes.
Dependencies:
- Internal files it imports: data/parts/types.ts.
- External libraries used: Browser storage APIs or UNKNOWN (runtime storage abstraction).
Side Effects:
- Persistent state read/write.
Confidence:
- Medium.
Notes:
- Data source boundary for parts UI/systems.

### FILE: `packages/client/src/systems/inventory/itemDatabase.ts`
Purpose:
- Builds lookup database around item definitions.
Key Components:
- ItemDatabase interface, createItemDatabase, defaultItemDatabase.
Inputs:
- Item definition collections.
Outputs:
- Query helpers for item retrieval.
Dependencies:
- Internal files it imports: data/items/definitions.ts, data/items/types.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Read-oriented item registry wrapper.

### FILE: `packages/client/src/systems/inventory/inventoryManager.ts`
Purpose:
- Manages inventory stacks and item quantity operations.
Key Components:
- InventoryManager interface, createInventoryManager.
Inputs:
- Item ids/quantities and inventory operations.
Outputs:
- Updated inventory state and operation results.
Dependencies:
- Internal files it imports: data/items/types.ts, systems/inventory/itemDatabase.ts.
- External libraries used: NONE.
Side Effects:
- In-memory state mutation.
Confidence:
- High.
Notes:
- Central inventory state manager.

### FILE: `packages/client/src/systems/loot/lootGenerator.ts`
Purpose:
- Rolls loot outputs from configured loot tables.
Key Components:
- LootGenerator interface, generateFromEntries.
Inputs:
- Loot table entries, RNG and request context.
Outputs:
- Generated loot stack outputs.
Dependencies:
- Internal files it imports: data/items/types.ts, data/lootTables/types.ts, inventory modules.
- External libraries used: NONE.
Side Effects:
- NONE (returns generated data).
Confidence:
- High.
Notes:
- Data generation utility for drops/containers.

### FILE: `packages/client/src/systems/parts/effectModifiers.ts`
Purpose:
- Applies conditional part effect modifiers at runtime.
Key Components:
- isPartEffectModifierActive, applyPartEffects/applyPartEffectModifiers.
Inputs:
- Part effect definitions and runtime context.
Outputs:
- Modified stat/effect values.
Dependencies:
- Internal files it imports: data/parts/types.ts.
- External libraries used: NONE.
Side Effects:
- May mutate supplied runtime stat object.
Confidence:
- High.
Notes:
- Used by main runtime and stat resolver flow.

### FILE: `packages/client/src/systems/parts/statResolver.ts`
Purpose:
- Resolves final part-derived combat/performance stats.
Key Components:
- configurePartStatResolver, getFinalPartStats.
Inputs:
- Loadout/part data and tuning inputs.
Outputs:
- Resolved final stat bundle.
Dependencies:
- Internal files it imports: data/parts/types.ts.
- External libraries used: NONE.
Side Effects:
- Maintains resolver configuration state.
Confidence:
- High.
Notes:
- Core transformation from part selections to runtime stats.

### FILE: `packages/client/src/systems/pickup/pickupSystem.ts`
Purpose:
- Controls pickup interaction logic and item acquisition events.
Key Components:
- PickupSystem interface, createPickupSystem.
Inputs:
- Player position/interactions, world pickup records.
Outputs:
- Pickup prompts, transfer actions, inventory updates.
Dependencies:
- Internal files it imports: data/items/types.ts, inventoryManager.ts, lootGenerator.ts.
- External libraries used: NONE.
Side Effects:
- Mutates pickup/inventory state.
Confidence:
- High.
Notes:
- Gameplay interaction layer for loot collection.

### FILE: `packages/client/src/systems/pickup/pickupWorldSystem.ts`
Purpose:
- Renders and updates world-space pickup representation/audio cues.
Key Components:
- PickupWorldSystem interface, createPickupWorldSystem.
Inputs:
- Pickup state and scene/update hooks.
Outputs:
- Mesh/audio updates for pickup objects.
Dependencies:
- Internal files it imports: pickupSystem.ts, inventory modules.
- External libraries used: three.
Side Effects:
- Scene graph and audio object mutation.
Confidence:
- High.
Notes:
- Bridges gameplay pickup data to render/audio layer.

### FILE: `packages/client/src/systems/persistence/worldItemPersistence.ts`
Purpose:
- Persists world item lifecycle across chunk streaming/cleanup.
Key Components:
- WorldItemPersistenceManager interface and factory.
Inputs:
- Pickup world state, chunk activity and item events.
Outputs:
- Saved/restored/despawned world item records.
Dependencies:
- Internal files it imports: pickup/inventory systems.
- External libraries used: UNKNOWN.
Side Effects:
- Persistent storage and in-memory world item mutation.
Confidence:
- Medium.
Notes:
- Handles long-lived world item continuity.

### FILE: `packages/client/src/systems/weight/mechWeight.ts`
Purpose:
- Computes total mech load and overencumbrance state.
Key Components:
- getTotalMechWeight, getOverencumbranceState, threshold constants/types.
Inputs:
- Equipped part/loadout weight values.
Outputs:
- Weight totals and overencumbrance status object.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Pure calculation module.

### FILE: `packages/client/src/ui/components/PartCard.ts`
Purpose:
- Renders a part card UI component used by garage screens.
Key Components:
- createPartCard.
Inputs:
- Part data and store/UI callbacks.
Outputs:
- DOM node/component representation.
Dependencies:
- Internal files it imports: data/parts types/catalog, ui/garage/store.
- External libraries used: NONE.
Side Effects:
- DOM creation/mutation.
Confidence:
- High.
Notes:
- Reused presentational unit for part entries.

### FILE: `packages/client/src/ui/garage/store.ts`
Purpose:
- Maintains garage UI state (inventory, loadout, selected parts/actions).
Key Components:
- GarageStore interface, createGarageStore.
Inputs:
- Catalog data, user actions, systems callbacks.
Outputs:
- Store selectors/actions and updated garage state.
Dependencies:
- Internal files it imports: data/parts/catalog.ts, data/parts/types.ts, systems modules.
- External libraries used: NONE.
Side Effects:
- In-memory state mutation.
Confidence:
- High.
Notes:
- State core for garage UI flow.

### FILE: `packages/client/src/ui/garage/index.ts`
Purpose:
- Implements garage view controller and UI wiring.
Key Components:
- GarageViewController, createGarageView.
Inputs:
- Store instance, DOM roots, user events.
Outputs:
- Rendered/updated garage UI and control API.
Dependencies:
- Internal files it imports: ui/garage/store.ts, ui/components/PartCard.ts, data/systems modules.
- External libraries used: NONE.
Side Effects:
- DOM updates and event handlers.
Confidence:
- High.
Notes:
- Main garage presentation/controller module.

### FILE: `packages/client/src/test-map/constants.ts`
Purpose:
- Defines gameplay/world constants used by test-map runtime.
Key Components:
- Movement, weapon, map and physics constants.
Inputs:
- Imported by update/combat/render/audio modules.
Outputs:
- Constant exports.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Central tuning constants for test-map.

### FILE: `packages/client/src/test-map/types.ts`
Purpose:
- Declares broad test-map runtime types and interfaces.
Key Components:
- Player, input, render, enemy, combat, audio-related types.
Inputs:
- Type imports across test-map modules.
Outputs:
- Type exports.
Dependencies:
- Internal files it imports: world-collision types and other local type deps.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Type hub used by many test-map files.

### FILE: `packages/client/src/test-map/audio-config.ts`
Purpose:
- Stores audio configuration presets for navigation/player/environment channels.
Key Components:
- AUDIO_CONFIG, AUDIO_NAVIGATION_CONFIG.
Inputs:
- Imported by audio/update modules.
Outputs:
- Config objects.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Static tuning/config module.

### FILE: `packages/client/src/test-map/audio-utils.ts`
Purpose:
- Provides reusable audio math, targeting, and helper utilities.
Key Components:
- Distance/volume helpers, clamps, sonar/contact and related utility functions.
Inputs:
- Positions, world collision queries, audio context values.
Outputs:
- Computed scalar values/contact data.
Dependencies:
- Internal files it imports: constants.ts, types.ts, world-collision.ts.
- External libraries used: tone.
Side Effects:
- UNKNOWN.
Confidence:
- Medium.
Notes:
- Used by audio.ts and update.ts.

### FILE: `packages/client/src/test-map/audio-occlusion.ts`
Purpose:
- Computes acoustic occlusion between listener and emitters.
Key Components:
- AudioOcclusionSystem class and occlusion profile logic.
Inputs:
- Emitter/listener positions and world traces.
Outputs:
- Occlusion attenuation values/state.
Dependencies:
- Internal files it imports: world-collision.ts, types.ts.
- External libraries used: NONE.
Side Effects:
- Internal occlusion state mutation.
Confidence:
- High.
Notes:
- Uses physics/raycast-style obstruction sampling.

### FILE: `packages/client/src/test-map/spatial-audio.ts`
Purpose:
- Wraps resonance-audio scene/source creation for 3D spatial sound.
Key Components:
- createSharedSpatialAudioScene, SpatialEmitter interface.
Inputs:
- AudioContext and emitter/listener transforms.
Outputs:
- Spatial scene/emitter handles.
Dependencies:
- Internal files it imports: resonance-audio typings.
- External libraries used: resonance-audio.
Side Effects:
- WebAudio graph creation/mutation.
Confidence:
- High.
Notes:
- Shared spatial layer used by audio controller.

### FILE: `packages/client/src/test-map/audio.ts`
Purpose:
- Implements master test-map audio controller and asset playback routing.
Key Components:
- createAudioController and large audio-state/control surface.
Inputs:
- Runtime state, events (fire/hit/movement/navigation), asset paths/config.
Outputs:
- Plays/updates channelized game audio.
Dependencies:
- Internal files it imports: audio-config.ts, audio-utils.ts, audio-occlusion.ts, spatial-audio.ts, world-collision.ts, types.ts.
- External libraries used: tone.
Side Effects:
- WebAudio playback/graph mutation, asset loading, runtime channel state mutation.
Confidence:
- High.
Notes:
- Primary reference point for many assets under assets/sounds and assets/music.

### FILE: `packages/client/src/test-map/controls.ts`
Purpose:
- Defines action ids, default bindings, and control binding helpers.
Key Components:
- ControlActionId, control definitions, get/set binding utilities.
Inputs:
- User-selected key bindings and action ids.
Outputs:
- Control mapping lookups and updates.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- Persistent or in-memory binding updates.
Confidence:
- High.
Notes:
- Consumed by input.ts and main runtime UI.

### FILE: `packages/client/src/test-map/keyboard-focus.ts`
Purpose:
- Detects whether current focus context is text-editing/typing.
Key Components:
- isEditableEventTarget, isTypingContextActive.
Inputs:
- DOM event targets/focus state.
Outputs:
- Boolean focus-context decisions.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: Browser DOM APIs.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Helps prevent gameplay input while typing.

### FILE: `packages/client/src/test-map/input.ts`
Purpose:
- Binds keyboard/pointer input events into runtime input state.
Key Components:
- bindInput.
Inputs:
- DOM events and control bindings.
Outputs:
- Updated InputState signals/callback invocations.
Dependencies:
- Internal files it imports: controls.ts, keyboard-focus.ts, types.ts.
- External libraries used: Browser DOM APIs.
Side Effects:
- Registers event listeners and mutates input state.
Confidence:
- High.
Notes:
- Input bridge between DOM and simulation loop.

### FILE: `packages/client/src/test-map/player-state.ts`
Purpose:
- Creates initial player and input state objects for runtime startup.
Key Components:
- createPlayer, createInputState.
Inputs:
- Startup defaults/constants.
Outputs:
- Initialized player/input objects.
Dependencies:
- Internal files it imports: types.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Pure object factory module.

### FILE: `packages/client/src/test-map/weapons.ts`
Purpose:
- Defines player weapon and melee weapon configuration data/normalizers.
Key Components:
- PLAYER_WEAPON_DEFINITIONS, PLAYER_MELEE_WEAPON_DEFINITIONS and helpers.
Inputs:
- Weapon ids/config records and path strings.
Outputs:
- Normalized weapon definition objects.
Dependencies:
- Internal files it imports: constants.ts, data/parts/catalog.ts, types.ts.
- External libraries used: NONE.
Side Effects:
- NONE (data transformation/config assembly).
Confidence:
- High.
Notes:
- Includes many weapon-related asset path references.

### FILE: `packages/client/src/test-map/target-layout.ts`
Purpose:
- Defines subsystem targeting layout and navigation across target nodes.
Key Components:
- TargetLayout types, getAdjacentSubsystem/getFallbackSubsystem helpers.
Inputs:
- Layout ids/entities and direction commands.
Outputs:
- Next/adjacent subsystem selection results.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Data/navigation logic for lock/target UI.

### FILE: `packages/client/src/test-map/target-lock.ts`
Purpose:
- Manages target lock acquisition, stability, and lock-level state.
Key Components:
- createTargetLockState, updateTargetLock, LockLevel types.
Inputs:
- Target candidates, timing, line-of-sight/collision checks.
Outputs:
- Updated lock state and lock-level results.
Dependencies:
- Internal files it imports: constants.ts, world-collision.ts, types.ts.
- External libraries used: NONE.
Side Effects:
- Mutates target-lock state object.
Confidence:
- High.
Notes:
- Integrated into main frame update flow.

### FILE: `packages/client/src/test-map/scene-layout.ts`
Purpose:
- Generates scene map layout and points of interest definitions.
Key Components:
- createSceneMapData, createSceneSprites, TEST_MAP_NAVIGATION_POIS.
Inputs:
- Constants and layout generation parameters.
Outputs:
- Map grid data and sprite/POI structures.
Dependencies:
- Internal files it imports: constants.ts, types.ts.
- External libraries used: NONE.
Side Effects:
- NONE (returns generated structures).
Confidence:
- High.
Notes:
- Supplies POI data used by overlays/navigation.

### FILE: `packages/client/src/test-map/map-data.ts`
Purpose:
- Produces and serves map data helpers for cell/boundary lookup.
Key Components:
- createMapData, getCell, isBoundaryCell.
Inputs:
- Scene/map generation inputs.
Outputs:
- Map data object and grid query results.
Dependencies:
- Internal files it imports: constants.ts, scene-layout.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Used by collision/render/streaming modules.

### FILE: `packages/client/src/test-map/sprites.ts`
Purpose:
- Creates sprite objects for test-map scene population.
Key Components:
- createSprites.
Inputs:
- Scene layout data.
Outputs:
- SpriteObject array.
Dependencies:
- Internal files it imports: scene-layout.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Scene content factory.

### FILE: `packages/client/src/test-map/world-collision.ts`
Purpose:
- Provides 3D world collision and ray trace queries with acceleration structures.
Key Components:
- createWorldCollisionWorld, traceWorldHit3D, isPlayerBlocked, diagnostics helpers.
Inputs:
- World/map geometry, rays, player movement probes, chunk activation data.
Outputs:
- Collision hits/block checks/diagnostics.
Dependencies:
- Internal files it imports: constants.ts, map-data.ts, types.ts, sprites.ts.
- External libraries used: three, three-mesh-bvh.
Side Effects:
- Maintains collision world/metrics state.
Confidence:
- High.
Notes:
- Shared by movement, awareness, targeting, and occlusion systems.

### FILE: `packages/client/src/test-map/three-render.ts`
Purpose:
- Builds and updates THREE.js renderer/scene/camera/material pipeline.
Key Components:
- createThreeRenderSystem and render-system interface.
Inputs:
- Runtime world/entity state and render options.
Outputs:
- Frame rendering to canvas.
Dependencies:
- Internal files it imports: constants.ts, map-data.ts, types.ts, world-collision.ts.
- External libraries used: three, three-mesh-bvh.
Side Effects:
- GPU render calls, scene graph mutation.
Confidence:
- High.
Notes:
- Main visual rendering backend.

### FILE: `packages/client/src/test-map/update.ts`
Purpose:
- Executes per-frame player and movement update logic.
Key Components:
- createUpdateState, updateFrame.
Inputs:
- InputState, player state, delta time, collision/audio helpers.
Outputs:
- Updated movement/flight/physics state.
Dependencies:
- Internal files it imports: constants.ts, audio-config.ts, audio-utils.ts, world-collision.ts.
- External libraries used: NONE.
Side Effects:
- Mutates player/update state objects.
Confidence:
- High.
Notes:
- One of the main frame-loop modules.

### FILE: `packages/client/src/test-map/update-scheduler.ts`
Purpose:
- Schedules per-frame tasks by priority/budget.
Key Components:
- FrameScheduler interface, scheduling utilities.
Inputs:
- Tasks, priorities, frame budget/time slices.
Outputs:
- Ordered task execution decisions.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- Internal queue/state mutation.
Confidence:
- High.
Notes:
- Used by main update orchestration.

### FILE: `packages/client/src/test-map/runtime-config.ts`
Purpose:
- Stores mutable runtime tuning values shared across systems.
Key Components:
- runtimeTuning, getSharedFlightHeight, setSharedFlightHeight.
Inputs:
- Runtime setter calls and tuning updates.
Outputs:
- Current tuning values.
Dependencies:
- Internal files it imports: constants.ts.
- External libraries used: NONE.
Side Effects:
- Module-level state mutation.
Confidence:
- High.
Notes:
- Referenced by enemy base and debug/runtime controls.

### FILE: `packages/client/src/test-map/accessibility-mode-manager.ts`
Purpose:
- Manages accessibility mode and focus/interaction behavior.
Key Components:
- accessibilityModeManager singleton and related methods.
Inputs:
- UI mode toggles/focus events.
Outputs:
- Accessibility mode state and focus handling actions.
Dependencies:
- Internal files it imports: UNKNOWN.
- External libraries used: Browser DOM APIs.
Side Effects:
- DOM focus manipulation and module state mutation.
Confidence:
- Medium.
Notes:
- Used by main.ts accessibility integration.

### FILE: `packages/client/src/test-map/surface-material.ts`
Purpose:
- Maps world/surface context to surface material categories.
Key Components:
- SURFACE_MATERIAL constants and resolution functions.
Inputs:
- World positions/collision context.
Outputs:
- Surface material category values.
Dependencies:
- Internal files it imports: scene-layout.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Used by audio/combat impact handling.

### FILE: `packages/client/src/test-map/missile-types.ts`
Purpose:
- Defines missile type metadata for gameplay and effects.
Key Components:
- MissileTypeId, MissileTypeDefinition, MISSILE_TYPE_DEFINITIONS.
Inputs:
- Missile type key selection.
Outputs:
- Missile config (speed/damage/explosion/audio fields).
Dependencies:
- Internal files it imports: NONE.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Includes explosion sound path references.

### FILE: `packages/client/src/test-map/missile-threat-manager.ts`
Purpose:
- Tracks incoming missile threats and computes warning state.
Key Components:
- MissileThreatManager class and threat scoring/update methods.
Inputs:
- Missile entities, player state, timing.
Outputs:
- Threat level/alerts.
Dependencies:
- Internal files it imports: types.ts.
- External libraries used: NONE.
Side Effects:
- Internal manager state mutation.
Confidence:
- High.
Notes:
- Supports danger cue logic.

### FILE: `packages/client/src/test-map/awareness.ts`
Purpose:
- Evaluates line-of-sight and obstruction awareness signals.
Key Components:
- Awareness update helpers and related state logic.
Inputs:
- Player/enemy positions, world-collision traces.
Outputs:
- Awareness status values for runtime/HUD.
Dependencies:
- Internal files it imports: constants.ts, world-collision.ts, types.ts.
- External libraries used: NONE.
Side Effects:
- Mutates awareness state objects.
Confidence:
- High.
Notes:
- Used by HUD/status updates.

### FILE: `packages/client/src/test-map/dev-console-history.ts`
Purpose:
- Persists and retrieves developer console command history.
Key Components:
- loadDevConsoleHistory, saveDevConsoleHistory.
Inputs:
- Command entries/history arrays.
Outputs:
- Stored/restored history.
Dependencies:
- Internal files it imports: NONE.
- External libraries used: Browser localStorage API.
Side Effects:
- localStorage read/write.
Confidence:
- High.
Notes:
- Persistence helper for dev-console.ts.

### FILE: `packages/client/src/test-map/dev-console.ts`
Purpose:
- Implements in-game developer console controller and command execution plumbing.
Key Components:
- createDeveloperConsole and controller interfaces/types.
Inputs:
- User command lines and bound command handlers.
Outputs:
- Command results/help/history updates.
Dependencies:
- Internal files it imports: dev-console-history.ts.
- External libraries used: Browser DOM APIs.
Side Effects:
- DOM/event handling, localStorage via history module.
Confidence:
- High.
Notes:
- Integrated into main.ts debug workflow.

### FILE: `packages/client/src/test-map/world-streaming.ts`
Purpose:
- Controls chunk activation/dormancy for world streaming.
Key Components:
- WorldStreamingManager and diagnostics/state utilities.
Inputs:
- Observer position, map/chunk metadata.
Outputs:
- Active chunk sets and streaming diagnostics.
Dependencies:
- Internal files it imports: map-data.ts, types.ts.
- External libraries used: NONE.
Side Effects:
- Internal streaming state mutation.
Confidence:
- High.
Notes:
- Feeds chunk-aware systems (collision/persistence).

### FILE: `packages/client/src/test-map/world-map-overlay.ts`
Purpose:
- Renders tactical/world map overlay UI.
Key Components:
- createWorldMapOverlay and overlay system APIs.
Inputs:
- POI/state/layout data and UI events.
Outputs:
- Overlay rendering updates.
Dependencies:
- Internal files it imports: types.ts, scene-layout.ts.
- External libraries used: Browser Canvas/DOM APIs.
Side Effects:
- Canvas drawing and DOM updates.
Confidence:
- High.
Notes:
- Integrates with test-map navigation features.

### FILE: `packages/client/src/test-map/combat-ecs.ts`
Purpose:
- Implements ECS-based combat simulation for entities, projectiles, collisions, and damage.
Key Components:
- createCombatEcsWorld, spawn/step/apply-damage functions, render state helpers.
Inputs:
- Spawn commands, player input effects, world/collision data, weapon/enemy configs.
Outputs:
- Updated ECS world state and combat render snapshots/events.
Dependencies:
- Internal files it imports: constants.ts, world-collision.ts, enemies/index.ts, types.ts, missile-types.ts, target-layout.ts, surface-material.ts.
- External libraries used: bitecs.
Side Effects:
- Extensive mutable ECS world state updates.
Confidence:
- High.
Notes:
- Core combat runtime engine.

### FILE: `packages/client/src/test-map/enemies/enemyTypes.ts`
Purpose:
- Defines enemy id/types/config interfaces and behavior shape contracts.
Key Components:
- EnemyId, EnemyDefinitionConfig, movement/fire/melee/sound descriptors.
Inputs:
- Type imports by enemy definitions and combat systems.
Outputs:
- Type exports.
Dependencies:
- Internal files it imports: missile-types.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Type backbone for enemy definitions.

### FILE: `packages/client/src/test-map/enemies/enemyBase.ts`
Purpose:
- Provides abstract base class for concrete enemy definition classes.
Key Components:
- EnemyDefinitionBase class.
Inputs:
- Enemy configuration values and runtime config access.
Outputs:
- Shared enemy definition behavior/properties.
Dependencies:
- Internal files it imports: runtime-config.ts, enemyTypes.ts.
- External libraries used: NONE.
Side Effects:
- Class instance state initialization.
Confidence:
- High.
Notes:
- Parent class of tank/striker/brute/bruiser/helicopter/test-dummy files.

### FILE: `packages/client/src/test-map/enemies/tankEnemy.ts`
Purpose:
- Declares tank enemy definition.
Key Components:
- TankEnemyDefinition class.
Inputs:
- Base class config values.
Outputs:
- Exported tank definition instance/class data.
Dependencies:
- Internal files it imports: enemyBase.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Includes tank-specific sound and combat parameters.

### FILE: `packages/client/src/test-map/enemies/strikerEnemy.ts`
Purpose:
- Declares striker enemy definition.
Key Components:
- StrikerEnemyDefinition class.
Inputs:
- Base class config values.
Outputs:
- Exported striker definition instance/class data.
Dependencies:
- Internal files it imports: enemyBase.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Includes burst-fire-related configuration.

### FILE: `packages/client/src/test-map/enemies/bruteEnemy.ts`
Purpose:
- Declares brute enemy definition.
Key Components:
- BruteEnemyDefinition class.
Inputs:
- Base class config values.
Outputs:
- Exported brute definition instance/class data.
Dependencies:
- Internal files it imports: enemyBase.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Heavy/melee tuning in definition values.

### FILE: `packages/client/src/test-map/enemies/bruiserEnemy.ts`
Purpose:
- Declares bruiser enemy definition.
Key Components:
- BruiserEnemyDefinition class.
Inputs:
- Base class config values.
Outputs:
- Exported bruiser definition instance/class data.
Dependencies:
- Internal files it imports: enemyBase.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Rival-mech style config profile.

### FILE: `packages/client/src/test-map/enemies/helicopterEnemy.ts`
Purpose:
- Declares helicopter enemy definition.
Key Components:
- HelicopterEnemyDefinition class.
Inputs:
- Base class config values.
Outputs:
- Exported helicopter definition instance/class data.
Dependencies:
- Internal files it imports: enemyBase.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Airborne/missile-oriented enemy config.

### FILE: `packages/client/src/test-map/enemies/testDummyEnemy.ts`
Purpose:
- Declares stationary test-dummy enemy definition.
Key Components:
- TestDummyEnemyDefinition class.
Inputs:
- Base class config values.
Outputs:
- Exported test-dummy definition instance/class data.
Dependencies:
- Internal files it imports: enemyBase.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Intended as non-mobile test target profile.

### FILE: `packages/client/src/test-map/enemies/index.ts`
Purpose:
- Registers enemy definitions and exposes enemy lookup helpers.
Key Components:
- ENEMY_DEFINITIONS map/list, getEnemyDefinition.
Inputs:
- EnemyId selection.
Outputs:
- Matching enemy definition object.
Dependencies:
- Internal files it imports: tankEnemy.ts, strikerEnemy.ts, bruteEnemy.ts, bruiserEnemy.ts, helicopterEnemy.ts, testDummyEnemy.ts.
- External libraries used: NONE.
Side Effects:
- NONE.
Confidence:
- High.
Notes:
- Central enemy definition registry.

### FILE: `packages/client/src/test-map/main.ts`
Purpose:
- Main test-map runtime orchestrator wiring gameplay, rendering, audio, UI, networking, inventory, and systems together.
Key Components:
- Top-level initialization, game loop, subsystem integration, debug/pause/navigation/inventory control flow.
Inputs:
- User input events, frame timing, subsystem state, optional network snapshots.
Outputs:
- Per-frame updates to render/audio/world/UI and outgoing network inputs.
Dependencies:
- Internal files it imports: large cross-section of test-map modules, systems modules, UI garage modules, data modules, net/ws-client.ts.
- External libraries used: Browser DOM APIs and modules transitively (THREE/Tone/bitecs).
Side Effects:
- DOM/event lifecycle, animation loop, mutable runtime state, audio playback, possible websocket I/O.
Confidence:
- High.
Notes:
- Primary client bootstrap source for test-map subsystem.

# 4. Entry Points

Application entry points:
- index.html: redirects to test-map.html.
- test-map.html: browser shell that loads packages/client/dist/test-map/main.js as module.

Main runtime bootstrap files:
- packages/client/src/test-map/main.ts: main client orchestrator for test-map.
- packages/client/src/ui/garage/index.ts: garage UI controller construction used by main.ts.

Server start points:
- packages/server/src/index.ts: starts WebSocket server via startWebSocketServer().
- packages/server/src/colyseus/index.ts: starts Colyseus server via startColyseusServer().

Client initialization flow:
- Browser opens test-map.html -> module script loads dist main -> main.ts creates player/input/map/collision/render/audio/systems -> enters frame update loop -> optional ws-client sends hello/input and consumes snapshot messages.

# 5. Data Flow Map (IMPORTANT)

User input to movement/render/audio:
- DOM keyboard/pointer events captured in packages/client/src/test-map/input.ts using control definitions from controls.ts.
- main.ts collects input state and passes to update.ts and combat-ecs.ts each frame.
- update.ts mutates player movement/flight state using constants and collision traces from world-collision.ts.
- three-render.ts consumes world/combat/player state and renders frame to canvas.
- audio.ts consumes movement/combat/awareness events and plays channelized sound via Tone/resonance helpers.

Combat and targeting flow:
- main.ts calls combat-ecs.ts spawn/step/update functions.
- combat-ecs.ts depends on enemy definitions (enemies/index.ts), missile types (missile-types.ts), collision (world-collision.ts), and target layout data.
- target-lock.ts and awareness.ts query collision/world context and produce lock/awareness state consumed by HUD and audio cues.

Inventory/loot/pickup flow:
- main.ts creates item database/inventory manager/loot generator.
- pickupSystem.ts manages interaction and transfer to inventory.
- pickupWorldSystem.ts handles 3D representation and pickup audio cue integration.
- worldItemPersistence.ts tracks world items relative to chunk/streaming lifecycle.

Network flow (WebSocket mode):
- client ws-client.ts connect() sends hello and then input payloads.
- server net/ws-server.ts parses messages with net/protocol.ts + shared schemas.
- server tick-world.ts applies inputs through apply-input.ts and serializes world snapshots.
- server broadcasts snapshot messages back to clients.
- client ws-client.ts validates incoming messages and forwards to consumer callback.

State management flow:
- Mutable module/runtime state exists in main.ts orchestration, update state, combat ECS world, audio controller state, garage store, and streaming/persistence managers.
- Shared compile-time/runtime contract state is centralized in packages/shared (types/constants/schemas).

# 6. "Testmap" subsystem focus

All files belonging to testmap subsystem:
- test-map.html
- packages/client/src/test-map/accessibility-mode-manager.ts
- packages/client/src/test-map/audio-config.ts
- packages/client/src/test-map/audio-occlusion.ts
- packages/client/src/test-map/audio-utils.ts
- packages/client/src/test-map/audio.ts
- packages/client/src/test-map/awareness.ts
- packages/client/src/test-map/combat-ecs.ts
- packages/client/src/test-map/constants.ts
- packages/client/src/test-map/controls.ts
- packages/client/src/test-map/dev-console-history.ts
- packages/client/src/test-map/dev-console.ts
- packages/client/src/test-map/input.ts
- packages/client/src/test-map/keyboard-focus.ts
- packages/client/src/test-map/main.ts
- packages/client/src/test-map/map-data.ts
- packages/client/src/test-map/missile-threat-manager.ts
- packages/client/src/test-map/missile-types.ts
- packages/client/src/test-map/player-state.ts
- packages/client/src/test-map/runtime-config.ts
- packages/client/src/test-map/scene-layout.ts
- packages/client/src/test-map/spatial-audio.ts
- packages/client/src/test-map/sprites.ts
- packages/client/src/test-map/surface-material.ts
- packages/client/src/test-map/target-layout.ts
- packages/client/src/test-map/target-lock.ts
- packages/client/src/test-map/three-render.ts
- packages/client/src/test-map/types.ts
- packages/client/src/test-map/update-scheduler.ts
- packages/client/src/test-map/update.ts
- packages/client/src/test-map/weapons.ts
- packages/client/src/test-map/world-collision.ts
- packages/client/src/test-map/world-map-overlay.ts
- packages/client/src/test-map/world-streaming.ts
- packages/client/src/test-map/enemies/index.ts
- packages/client/src/test-map/enemies/enemyTypes.ts
- packages/client/src/test-map/enemies/enemyBase.ts
- packages/client/src/test-map/enemies/tankEnemy.ts
- packages/client/src/test-map/enemies/strikerEnemy.ts
- packages/client/src/test-map/enemies/bruteEnemy.ts
- packages/client/src/test-map/enemies/bruiserEnemy.ts
- packages/client/src/test-map/enemies/helicopterEnemy.ts
- packages/client/src/test-map/enemies/testDummyEnemy.ts

How testmap connects to the rest of the system:
- test-map/main.ts imports and orchestrates client systems (inventory/loot/pickup/persistence/weight), UI garage modules, and net/ws-client.ts.
- test-map main and other files consume shared contracts indirectly through ws-client and server protocol compatibility.
- test-map.html is the browser shell loading dist output generated from client source.

What testmap depends on:
- packages/client/src/systems/* modules.
- packages/client/src/ui/* modules.
- packages/client/src/data/* catalogs/types.
- packages/client/src/net/ws-client.ts.
- packages/client/src/types/resonance-audio.d.ts (typing support).
- External libs: three, three-mesh-bvh, tone, bitecs, resonance-audio.

What depends on testmap:
- test-map.html runtime module load targets built output of test-map/main.
- gameplay behavior in this repo is centered on this subsystem; no other client runtime entry was identified in source list.
- Additional external dependency relation from outside repo: UNKNOWN.

# 7. Cross-file relationships

Files with strong mutual/central dependencies:
- packages/client/src/test-map/main.ts strongly depends on most test-map modules plus systems/ui/net.
- packages/client/src/test-map/types.ts is a central type dependency used across many test-map files.
- packages/client/src/test-map/world-collision.ts is shared by update.ts, combat-ecs.ts, awareness.ts, target-lock.ts, audio-utils.ts, audio-occlusion.ts, and render flow.
- packages/client/src/test-map/enemies/index.ts depends on all concrete enemy definition files and is consumed by combat-ecs.ts/main.ts.
- packages/client/src/systems/inventory/itemDatabase.ts + inventoryManager.ts + lootGenerator.ts + pickupSystem.ts form a linked gameplay item pipeline.
- packages/client/src/ui/garage/store.ts + ui/garage/index.ts + ui/components/PartCard.ts form garage UI core.
- packages/server/src/net/ws-server.ts depends on protocol.ts, create-world-state.ts, tick-world.ts, and client-session.ts.
- packages/server/src/simulation/tick-world.ts and apply-input.ts are tightly coupled simulation steps.

Shared utilities/core modules:
- packages/shared/src/types/world.ts and packages/shared/src/types/network.ts define common contracts.
- packages/shared/src/schemas/network.ts is protocol validation boundary.
- packages/shared/src/constants/world-constants.ts supplies common simulation constants.
- packages/shared/src/index.ts is shared package export surface.

# Asset and Content Inventory

Audio
- Path: assets/sounds/
  Purpose: Primary SFX library (weapons, impacts, footsteps, ambience, inventory, explosions, navigation).
  Referenced By: packages/client/src/test-map/audio.ts, packages/client/src/test-map/main.ts, packages/client/src/test-map/weapons.ts, packages/client/src/test-map/missile-types.ts, packages/client/src/test-map/enemies/*.ts, audio-combo-tester.html (path input examples).
  References: assets/sounds/ambience/, assets/sounds/explosions/, assets/sounds/inventory/, assets/sounds/nav/, assets/sounds/steps/, assets/sounds/weapons/.
- Path: assets/music/
  Purpose: Music tracks used by test-map audio controller.
  Referenced By: packages/client/src/test-map/audio.ts.
  References: Individual .ogg tracks (slowDrone/scary/suspense/dark/hunting/alleyWay/CfuturisticCity).
- Path: assets/audio/
  Purpose: Audio content bucket (exact runtime usage UNKNOWN).
  Referenced By: UNKNOWN.
  References: UNKNOWN.

Images
- Path: favicon.svg
  Purpose: Browser tab icon for root/test-map pages.
  Referenced By: index.html, test-map.html.
  References: NONE.
- Path: favicon.ico
  Purpose: Alternate favicon artifact.
  Referenced By: UNKNOWN.
  References: NONE.
- Path: assets image files
  Purpose: UNKNOWN (no significant image inventory detected in asset tree listing).
  Referenced By: UNKNOWN.
  References: UNKNOWN.

JSON data
- Path: packages/client/src/data/parts/parts.json
  Purpose: Parts catalog dataset for mech parts/loadout systems.
  Referenced By: packages/client/src/data/parts/catalog.ts and downstream garage/stat systems.
  References: packages/client/src/data/parts/types.ts.
- Path: garage-catalog-2026-05-15.json
  Purpose: Exported/backup garage catalog data.
  Referenced By: scripts/apply-catalog-export.mjs (apply workflow).
  References: packages/client/src/data/parts/parts.json.
- Path: packages/client/src/data/parts/backups/parts.2026-05-15T20-00-35-478Z.json
  Purpose: Backup snapshot of parts catalog.
  Referenced By: UNKNOWN.
  References: packages/client/src/data/parts/parts.json (content lineage).

Configuration files
- Path: package.json, packages/client/package.json, packages/server/package.json, packages/shared/package.json
  Purpose: Workspace/package scripts and dependency manifests.
  Referenced By: npm tooling and build/test commands.
  References: package-lock.json.
- Path: tsconfig.json, tsconfig.base.json, packages/*/tsconfig.json
  Purpose: TypeScript compiler configuration.
  Referenced By: TypeScript build/typecheck tooling.
  References: Source files under packages and root scripts as configured.
- Path: .vscode/tasks.json (workspace task config, if present via workspace metadata)
  Purpose: Task runner definitions.
  Referenced By: VS Code task execution.
  References: npm and git commands.

Maps
- Path: packages/client/src/test-map/scene-layout.ts
  Purpose: Defines map layout generation and POIs.
  Referenced By: map-data.ts, world-map-overlay.ts, sprites.ts, surface-material.ts.
  References: constants.ts, types.ts.
- Path: packages/client/src/test-map/map-data.ts
  Purpose: Grid data/query layer for map cells.
  Referenced By: world-collision.ts, world-streaming.ts, render/update systems.
  References: scene-layout.ts.
- Path: test-map.html
  Purpose: Runtime viewport/map UI shell.
  Referenced By: Browser entry flow.
  References: packages/client/dist/test-map/main.js.

Localization
- Path: Repository-wide localization resources
  Purpose: UNKNOWN.
  Referenced By: UNKNOWN.
  References: UNKNOWN.

Other content
- Path: docs/
  Purpose: Design/system documentation.
  Referenced By: Human workflow; runtime references UNKNOWN.
  References: audio-signal-flow.md, world-chunking-system.md.
- Path: AI_CONTEXT.md, MasterSpecDoc.md, ImplementationRoadMap.md, other top-level markdown/txt docs
  Purpose: Project context/spec/process documents.
  Referenced By: Human workflow.
  References: UNKNOWN.
- Path: assets/convertMP3toOgg.bat, assets/convertWavToOgg.bat, assets/normalize.bat, assets/burstShotMaker/*.bat
  Purpose: Audio content pipeline tooling.
  Referenced By: Manual content processing workflows.
  References: files under assets/sounds and assets/music.
