# Mech Audio Game: Playable Demo Roadmap

Last revised: 2026-07-18  
Target branch: `dev`

## 1. Roadmap Purpose

This roadmap defines the shortest safe route from the current prototype to a playable single-player demo.

It is outcome-oriented. It does not contain full agent prompts or implementation diaries.

Detailed instructions for the active task belong in `SESSION_NOTES.md`.

Historical implementation tickets belong in `docs/archive` or a focused backlog document.

---

## 2. Demo Definition

The demo is complete when a player can perform this loop:

1. Start at a friendly outpost.
2. Review mech condition, loadout, inventory, map, and objective.
3. Accept a mission.
4. Select or understand the destination.
5. Travel through the world.
6. Encounter hostile entities.
7. Fight using current movement, targeting, weapons, audio, heat, energy, and subsystem systems.
8. Collect loot from enemies or containers.
9. Complete the mission objective.
10. Return to the outpost.
11. Buy or sell at a shop.
12. Enter a garage and change equipment.
13. Save and reload without losing required progress.

The demo does not need a huge world. It needs one coherent world loop that proves the architecture can expand.

---

## 3. Scope Principles

### Preserve working systems

Do not rebuild movement, combat, targeting, inventory, loot, garage, audio, or world streaming unless the baseline identifies a blocking defect.

### Build narrow foundations

New foundations should support the demo and one obvious next extension. They do not need to solve every future game design problem.

### Data before repetition

Once a system works for one facility, mission, shop, spawn zone, or point of interest, additional content should normally be authored as data.

### Separate interfaces by purpose

Player pause UI, contextual facility UI, and developer tools must remain distinct.

### Protect agentic-development effort

Each implementation task should:

- Have one outcome
- Name likely files
- Identify source of truth
- Define what is out of scope
- Include acceptance criteria
- Include verification commands
- End in one focused commit

### Verification precedes expansion

Do not add broad content on top of an unverified baseline.

---

## 4. Status Values

- Not Started
- Ready
- In Progress
- Blocked
- Implemented, Needs Verification
- Verified
- Deferred

---

# Phase D0: Regain Control of the Project

## D0.1 Documentation and AI Context Reset

Status: Verified
Priority: Critical  
Dependencies: None

### Outcome

AI assistants and the developer use a small, consistent set of active documents instead of contradictory historical specifications.

### Deliverables

- Updated `AI_CONTEXT.md`
- Updated `docs/CURRENT_STATE.md`
- Updated `docs/ROADMAP.md`
- Updated `SESSION_NOTES.md`
- Archived legacy implementation roadmap
- Focused advanced-targeting backlog
- Repository instructions for Codex and other contributors
- A single active-task handoff in `SESSION_NOTES.md`

### Acceptance criteria

- Old `AI_CONTEXT.md` and `docs/ImplementationRoadMap.md` are archived.
- Active documents have one clear responsibility each.
- No active instruction prohibits Three.js.
- No active instruction incorrectly fixes chunk size at 64 world units.
- No active instruction forbids focused module extraction.
- Codex can identify the authority order without reading the archived roadmap.

---

## D0.2 Fresh Local Baseline

Status: In Progress
Priority: Critical  
Dependencies: D0.1

### Outcome

The current `dev` branch has a recorded, reproducible status before feature work begins.

### Deliverables

- Branch and commit recorded
- Node and npm versions recorded
- Dependency installation result
- Typecheck result
- Build result
- Playtest startup result
- Completed smoke-test matrix
- List of demo-blocking defects
- Updated `docs/CURRENT_STATE.md`

### Acceptance criteria

- Every smoke-test entry is Pass, Broken, Uncertain, or Not Implemented.
- Each broken item has reproduction steps.
- No system is called Verified Working solely because it compiled.
- A baseline commit or tag is created after the audit documentation is committed.

### Suggested commit

```text
chore: record playable demo baseline
```

---

## D0.3 One-Command Verification

Status: Implemented, Needs Verification
Priority: Critical  
Dependencies: D0.2

### Outcome

A single command performs the project's standard automated checks.

### Target command

```text
npm run verify
```

### Initial verification contents

1. Workspace type check
2. Workspace build
3. Parts catalog validation
4. Item definition validation
5. Loot-table validation
6. Focused automated tests

### First automated test targets

- Part stat resolution
- Mech weight and `ratedLoad`
- Inventory add, remove, stack, and capacity
- Loot generation with a fixed seed
- Heat-state thresholds
- Energy regeneration
- Chunk coordinate calculations

### Acceptance criteria

- `npm run verify` exits nonzero on failure.
- Failures identify the responsible validation or test.
- The command does not modify authored data.
- The command runs without starting the browser game.

---

## D0.4 Reproducible Debug Scenarios

Status: Not Started  
Priority: High  
Dependencies: D0.2

### Outcome

Common test states can be loaded without manually entering many console commands.

### Initial scenarios

- `baseline`
- `overheat`
- `energy-starved`
- `overweight`
- `damaged-subsystems`
- `inventory-full`
- `garage-loadout`
- `missile-threat`
- `multi-enemy`
- `facility-access`
- `mission-completion`

### Required properties

- Stable scenario ID
- Fixed or recorded random seed
- Known player loadout
- Known position
- Known enemies and interactables
- Clear reset behavior
- Debug output identifying the active scenario

### Acceptance criteria

- A scenario produces the same important starting state after reset.
- Scenario loading does not permanently corrupt normal saves.
- Scenarios are implemented outside `main.ts` except for composition and command binding.

---

## D0.5 Exportable Diagnostic Report

Status: Not Started  
Priority: High  
Dependencies: D0.2

### Outcome

One developer command produces a compact report that can be pasted into ChatGPT or Codex.

### Report contents

- Branch or build identifier when available
- Active debug scenario
- Player position and heading
- Current chunk
- Mech stat snapshot
- Equipped parts
- Heat and energy state
- Target and lock state
- Active enemy summary
- Inventory summary
- Mission state
- Recent trace events
- Recent errors

### Acceptance criteria

- Report is accessible as plain text.
- Report can be copied or downloaded.
- Report excludes massive frame-by-frame spam.
- Report generation does not mutate game state.

---

# Phase D1: Player-Facing Pause UI

## D1.1 Define and Preserve Existing UI Behavior

Status: Not Started  
Priority: Critical  
Dependencies: D0.2

### Outcome

The current pause, garage, inventory, controls, diagnostics, and developer-tool behavior is mapped before UI extraction.

### Deliverables

- Inventory of existing pause tabs and controls
- Ownership map for DOM elements and event handlers
- Focus open/close behavior record
- List of global hotkeys
- List of developer-only surfaces
- Regression checklist

### Acceptance criteria

- Each existing pause tab has a known owner.
- The task identifies which behavior must remain unchanged.
- No UI is moved yet.
- The result is recorded in `SESSION_NOTES.md` or a focused UI architecture document.

---

## D1.2 Separate Developer Tools from Player Pause

Status: Not Started  
Priority: Critical  
Dependencies: D1.1

### Outcome

Developer tools retain all existing functionality but no longer define the player's pause experience.

### Developer surfaces to preserve

- Runtime Stats
- Event Log
- Diagnostics
- Live Tuning
- Developer console
- Editors and mutation tools

### Implementation direction

- Create a focused developer-tools UI controller or equivalent boundary.
- Move ownership in small behavior-preserving steps.
- Keep existing shortcuts unless a conflict is documented.
- Do not redesign developer content during extraction.

### Acceptance criteria

- All existing developer tabs remain keyboard accessible.
- Existing tuning changes still apply.
- Existing debug dumps still work.
- Opening player pause does not automatically expose developer tabs.
- Editable controls continue to suppress gameplay hotkeys.

---

## D1.3 Player Pause Shell

Status: Not Started  
Priority: Critical  
Dependencies: D1.2

### Outcome

A semantic player-facing pause menu exists independently of developer tools.

### Initial sections

- Mech Status
- Loadout
- Inventory and Cargo
- Map and Objectives
- Controls and Accessibility
- Options

### Interaction requirements

- One predictable pause command
- Semantic tab or navigation pattern
- Logical heading structure
- Deterministic focus on open
- Focus restoration on close
- Normal Tab and Shift+Tab behavior
- Escape closes only the appropriate layer
- No gameplay hotkeys while operating the menu

### Acceptance criteria

- Menu is fully keyboard operable.
- A screen-reader user can identify the active section.
- Opening and closing pause does not lose focus.
- Developer tools remain available through their own entry path.
- No garage mutation control is present.

---

## D1.4 Authoritative Mech Status

Status: Not Started  
Priority: Critical  
Dependencies: D1.3

### Outcome

The player can understand the mech's critical current state in one organized view.

### Required groups

- Condition
- Resources
- Mobility
- Defense
- Combat

### Data rules

- Use existing stat resolvers and runtime snapshots.
- Do not recalculate part, weight, defense, heat, or energy values in the UI.
- Do not display unsupported placeholders as real values.
- Handle missing values explicitly.

### Acceptance criteria

- Total weight matches the authoritative weight system.
- Ground `ratedLoad` matches the equipped movement part.
- Flight lift capacity is clearly distinguished from ground `ratedLoad`.
- Damaged and offline subsystems update.
- Heat and energy state update.
- Current target and lock information update when applicable.
- Information remains readable through screen reader and magnification.
- Update frequency does not create excessive announcements.

---

## D1.5 Read-Only Loadout Inspection

Status: Not Started  
Priority: High  
Dependencies: D1.3, D1.4

### Outcome

The player can inspect equipped parts and their current condition anywhere without changing equipment.

### Required information

- Slot
- Part name
- Part category
- Integrity
- Online or offline state
- Relevant resolved statistics
- Relevant effects
- Weapon mounts and readiness

### Acceptance criteria

- View uses the current garage/loadout state.
- No equip or unequip operation is available.
- Integrity changes update the view.
- Source part values and resolved values are not confused.

---

## D1.6 Reuse Player Inventory, Map, Objectives, Controls, and Options

Status: Not Started  
Priority: High  
Dependencies: D1.3

### Outcome

Existing player-relevant UI is integrated into the new shell with minimal duplication.

### Acceptance criteria

- Inventory operations continue to use the inventory manager.
- World map and navigation state are not reimplemented.
- Objectives have a stable section even before the mission system is complete.
- Control rebinding retains focus and hotkey safety.
- Accessibility options are discoverable.
- Developer tuning controls do not appear as player options.

---

# Phase D2: Contextual World Facilities

## D2.1 Common World Interaction Foundation

Status: Not Started  
Priority: Critical  
Dependencies: D0.3, D1.3

### Outcome

The player can detect and activate a nearby world interactable through one consistent interaction path.

### Initial interactable fields

- Stable ID
- Kind
- Accessible name
- Position
- Interaction radius
- Enabled state
- Optional faction or access rule
- Optional navigation or beacon reference
- Activation action or handler reference

### Initial interactable kinds

- Garage access
- Shop access
- Mission terminal
- Repair point
- Loot container

### Acceptance criteria

- The nearest valid interactable can be identified.
- The player receives an accessible availability cue.
- The normal interaction command activates it.
- Leaving range removes availability.
- Disabled interactables explain why they cannot be used.
- Interaction logic is not hard-coded separately for each facility.

---

## D2.2 Garage Facility

Status: Not Started  
Priority: Critical  
Dependencies: D2.1

### Outcome

The existing working garage opens only after the player interacts with a garage access point.

### Scope

- Preserve the garage store.
- Preserve garage equip and unequip behavior.
- Preserve parts editor behavior as developer-only.
- Move the garage presentation into a contextual facility overlay.
- Remove ordinary player access from pause only after facility access works.

### Acceptance criteria

- Player cannot open the garage from ordinary pause.
- Player can open the garage while in range of a garage access point.
- Gameplay pauses while garage UI is active.
- Focus moves to the garage heading or first meaningful control.
- Closing returns focus and gameplay correctly.
- Existing loadout and inventory changes still work.
- Garage persistence still works.
- Developer parts editing remains available through a developer path.

---

## D2.3 Minimal Shop and Currency

Status: Not Started  
Priority: Critical  
Dependencies: D2.1, D0.3

### Outcome

The player can buy and sell existing items or parts at one shop.

### Required functions

- View stock
- View price
- Buy
- Sell
- Confirm transaction
- Report insufficient funds
- Report unavailable stock
- Update currency
- Update inventory

### Rules

- Existing item and part definitions remain authoritative.
- Shop entries reference existing definitions.
- Transaction calculations live in a focused service, not DOM handlers.
- Currency persistence must be defined.

### Acceptance criteria

- Successful buy changes currency and inventory exactly once.
- Successful sell changes currency and inventory exactly once.
- Failed transactions make no partial changes.
- Keyboard and screen-reader operation is complete.
- Transactions can be automated-tested without opening the UI.

---

## D2.4 Mission Terminal Facility

Status: Not Started  
Priority: High  
Dependencies: D2.1, D4.1

### Outcome

The player can inspect, accept, and turn in the demo mission through a world facility.

### Acceptance criteria

- Available mission is announced clearly.
- Mission details include objective and reward.
- Accepting creates one active mission instance.
- Turn-in is available only when completion requirements are satisfied.
- Reward is granted exactly once.

---

# Phase D3: World Population and Relationships

## D3.1 Faction and Disposition Foundation

Status: Not Started  
Priority: Critical  
Dependencies: D0.3

### Outcome

World entities can be hostile, friendly, or neutral according to faction relationships.

### Initial model

- Stable faction ID
- Relationship lookup
- Hostile, friendly, and neutral result
- Entity faction membership
- Explicit override support only when required

### Acceptance criteria

- Enemies target hostile entities.
- Friendly entities do not automatically attack the player.
- Neutral entities remain non-hostile unless provoked or scripted.
- Target acquisition filters by legal relationship.
- Explosion and damage policy has a documented relationship-aware rule.
- Faction logic can be tested without rendering.

---

## D3.2 Shared World-Entity Capabilities

Status: Not Started  
Priority: High  
Dependencies: D3.1

### Outcome

Friendly, neutral, and hostile actors reuse ordinary world capabilities rather than becoming unrelated architectures.

### Shared capabilities where applicable

- Position
- Collision
- Health
- Faction
- Audio emitter
- Targetability
- Movement controller
- Combat capability
- Interaction capability
- Persistence identity

### Acceptance criteria

- A friendly guard can exist in the same world and collision systems as an enemy.
- A neutral trader can be navigated to and interacted with.
- Entity role does not require a separate rendering or health engine.
- Controller differences remain modular.

---

## D3.3 Data-Driven Spawn Zones

Status: Not Started  
Priority: High  
Dependencies: D3.1, D3.2, D0.4

### Outcome

Demo-region population can be authored without adding a new source module per spawn.

### Required data

- Zone ID
- Area or anchor
- Faction
- Entity definition references
- Count or density
- Respawn policy
- Activation conditions
- Persistence policy
- Random seed or deterministic identifier where relevant

### Acceptance criteria

- At least one hostile zone and one friendly zone work.
- Zone activation respects world streaming.
- Persistent defeated entities follow documented demo rules.
- Debug scenario can reset the zones.

---

# Phase D4: Mission and Objective Loop

## D4.1 Mission Definitions and State

Status: Not Started  
Priority: Critical  
Dependencies: D0.3

### Outcome

The game can represent and persist one active mission with ordered objectives.

### Initial objective types

- Visit location
- Defeat entities
- Collect item
- Interact with object
- Return or turn in

### Mission states

- Available
- Active
- Completed
- Turned in
- Failed only if explicitly needed

### Acceptance criteria

- Objective progress is deterministic.
- Completion cannot be awarded twice.
- Save and reload preserves mission state.
- Pure objective progression has automated tests.
- Mission data is separate from mission runtime state.

---

## D4.2 Objective Presentation and Navigation

Status: Not Started  
Priority: Critical  
Dependencies: D1.6, D4.1

### Outcome

The active objective is understandable through pause UI, speech, and navigation support.

### Acceptance criteria

- Map and Objectives shows active mission and current objective.
- User can request a concise spoken objective summary.
- Relevant destination can be selected or identified through navigation.
- Progress changes announce once at meaningful milestones.
- Rapid events do not create repeated speech spam.

---

## D4.3 Complete Demo Mission

Status: Not Started  
Priority: Critical  
Dependencies: D2.4, D3.3, D4.1, D4.2

### Outcome

One authored mission exercises travel, combat, loot or interaction, return, and reward.

### Recommended structure

1. Accept mission at outpost.
2. Travel to hostile area.
3. Defeat required enemies or interact with an objective.
4. Collect required item or confirmation.
5. Return to outpost.
6. Turn in mission.
7. Receive currency or an item.

### Acceptance criteria

- Mission can be completed from a new save.
- Mission can survive save and reload at each major stage.
- Mission cannot be completed or rewarded twice.
- Failure to meet requirements produces clear feedback.

---

# Phase D5: Demo Region

## D5.1 Friendly Outpost

Status: Not Started  
Priority: Critical  
Dependencies: D2.2, D2.3, D2.4, D3.2

### Required content

- Player spawn
- Garage access
- Shop access
- Mission terminal
- Friendly guard or patrol
- Neutral trader or traveler
- Navigation point
- Clear audio identity

### Acceptance criteria

- Facilities are discoverable without sight.
- Friendly and neutral actors behave correctly.
- Facility overlays open and close predictably.
- Outpost remains stable across save and reload.

---

## D5.2 Travel Corridor and Encounter Zone

Status: Not Started  
Priority: Critical  
Dependencies: D3.3, D4.2

### Required content

- Navigable route
- World-streaming transition
- Ambient identity
- Hostile encounter
- Loot container
- Optional alternate route or cover feature

### Acceptance criteria

- Player can navigate from outpost to objective without visual dependency.
- Enemy cues remain distinguishable from navigation and ambience.
- Streaming does not remove required mission state or loot incorrectly.

---

## D5.3 Enemy Base or Objective Location

Status: Not Started  
Priority: Critical  
Dependencies: D3.3, D4.3

### Required content

- Objective anchor
- Concentrated enemy encounter
- Cover or terrain interaction
- Mission interaction or loot
- Return route

### Acceptance criteria

- Objective can be completed through intended mechanics.
- Combat remains readable with multiple enemies.
- Required entity or object persists correctly.
- Mission completion is recorded once.

---

## D5.4 Save-and-Return Loop

Status: Not Started  
Priority: Critical  
Dependencies: D4.3, D5.1, D5.2, D5.3

### Required persisted state

- Player position or documented spawn behavior
- Inventory
- Currency
- Equipped parts
- Relevant part integrity
- Mission state
- Required world-item state
- Required objective state

### Acceptance criteria

- Reloading at each major demo stage does not block completion.
- No reward duplication occurs.
- No required objective disappears permanently.
- Garage and shop results persist.

---

## D5.5 Demo Readiness Pass

Status: Not Started  
Priority: Critical  
Dependencies: All critical demo tickets

### Work areas

- Accessibility
- Audio clarity
- Keyboard consistency
- Focus management
- Onboarding
- Error recovery
- Combat readability
- Balance
- Performance
- Save reliability
- Defect cleanup

### Acceptance criteria

- New player can understand the first required action.
- Critical information is available without visuals.
- No known Critical demo blocker remains.
- No known save corruption or progression blocker remains.
- Build and verification command pass.
- Full demo loop is completed from a clean save.

---

# Phase D6: Post-Demo Expansion

Status: Deferred

Potential later work:

- Additional towns, cities, bases, and biomes
- More shops and garage types
- Multiple mission chains
- More friendly and neutral behaviors
- Faction reputation
- Deeper economy
- Procedural encounters
- Advanced targeting backlog
- Expanded server authority
- Multiplayer synchronization
- Large-world precision and scaling work

None of these should displace a critical demo ticket without a recorded reason.

---

## 5. Recommended Immediate Ticket Order

1. D0.1 Documentation and AI Context Reset
2. D0.2 Fresh Local Baseline
3. D0.3 One-Command Verification
4. D1.1 Define and Preserve Existing UI Behavior
5. D1.2 Separate Developer Tools from Player Pause
6. D1.3 Player Pause Shell
7. D1.4 Authoritative Mech Status
8. D2.1 Common World Interaction Foundation
9. D2.2 Garage Facility
10. D3.1 Faction and Disposition Foundation
11. D4.1 Mission Definitions and State
12. D2.3 Minimal Shop and Currency
13. D4.2 Objective Presentation and Navigation
14. D3.3 Data-Driven Spawn Zones
15. D5.1 through D5.5 Demo Region and readiness

D0.4 and D0.5 can be inserted earlier when repeated debugging setup begins consuming significant time.

---

## 6. Definition of Done for a Roadmap Ticket

A ticket is done only when:

- The implementation outcome exists.
- The change uses the correct source of truth.
- Relevant type checking passes.
- Relevant build passes.
- Relevant automated tests pass.
- Manual playtest steps are completed when required.
- Accessibility acceptance criteria are checked.
- `docs/CURRENT_STATE.md` is updated.
- Roadmap status is updated.
- Unverified behavior is explicitly recorded.
- The work is committed as a focused change.

Agent completion is not developer approval.

---

## 7. Roadmap Change Policy

Change roadmap priority when:

- The fresh baseline reveals a blocker.
- A dependency is missing.
- A simpler implementation path is discovered.
- A feature is no longer required for the demo.
- A technical risk threatens progress.
- A completed foundation makes several tickets obsolete.

Record the reason beside the affected ticket or in the commit message.

Do not preserve an obsolete sequence merely because it appeared in the legacy implementation roadmap.

---

# End of ROADMAP.md
