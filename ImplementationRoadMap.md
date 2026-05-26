	# 🧾 MECH COPILOT EXECUTION PACK (v4)


### ROADMAP AUTHORITY

This execution pack implements the master specification.

If a ticket conflicts with the master spec:

MASTER SPEC WINS.

Copilot must never invent gameplay rules,
stat formulas,
part categories,
movement behaviors,
audio behaviors,
or UI conventions that contradict the master spec.
If any instructions are unclear or better options are available, pause work and ask me before proceeding

If required data is missing:

Implement extensible placeholders
and leave TODO hooks.
Track status of each ticket by adding these two lines after each ticket heading if not already done so:
Copilot status:
Developer status:
put Copilot status as either, not started, in-progress, ready for approval
I will put my own status in the developer status. If I approve the ticket once I see it has the Copilot status of 'ready for review', I will indicate Approved on developer status line and move Copilot status to 'Complete'
This way you need approval from me the developer before considering a ticket done.

Copilot must not:
- invent new systems
- modify architecture outside current ticket
- refactor unrelated modules
- assume missing design intent

If something is unclear:
→ mark as TODO
→ do not guess
when a ticket is ready for my review, make sure to tell me what was implemented and what to test 
---

# 🔧 PHASE 0 — DEVELOPMENT INSTRUMENTATION

Build this first, before touching gameplay systems.

---

## Ticket 0A — Expand Dev Console Commands *(if not already implemented)*
Copilot status: Complete
Developer status: Approved
Notes: Some Ticket 0A commands are wired to placeholder runtime state (heat/parts/stagger) with TODO hooks because those gameplay systems are defined in later roadmap tickets.

### 🧠 Copilot Prompt

Expand the existing developer console with runtime inspection and mutation commands.

If commands already exist, do not duplicate them.

Implement any missing commands from the following list.

### Required inspection commands

```text
help
list systems
list parts
list slots
list weapons
list enemies
list projectiles
list audio
list timers
list events
```

### Required player inspection commands

```text
player.get all
player.get stats
player.get heat
player.get energy
player.get weight
player.get movement
player.get position
player.get velocity
player.get target
```

### Required part inspection commands

```text
part.get all
part.get <slot>
part.get <slot> integrity
part.get <slot> stats
part.get <slot> state
```

### Required mutation commands

```text
player.set heat <value>
player.set energy <value>
player.set weight <value>

part.set <slot> integrity <value>
part.set <slot> offline
part.set <slot> online

part.attach <partId> <slot>
part.detach <slot>
```

### Required combat testing commands

```text
player.damage <amount> <type>
player.stagger
player.overheat
player.shutdown

spawn enemy <type>
kill all
```

### Required simulation commands

```text
time.scale <value>
ai.enable
ai.disable

physics.debug on
physics.debug off

audio.debug on
audio.debug off

events.debug on
events.debug off
```

### Required persistence commands

```text
save.build <name>
load.build <name>
reset.build
```

---

### 🎯 Expected Outcome

* Every gameplay variable can be inspected live
* Every core stat can be mutated live
* Any test state can be forced instantly

---

### 🧪 Verify

* Set heat to max
* Disable left arm
* Spawn enemy
* Slow time
* Confirm all changes happen immediately

---

## Ticket 0B — Runtime Debug Overlay
Copilot status: Complete
Developer status: Approved

### 🧠 Copilot Prompt

Implement a runtime debug overlay.

Overlay must update in real time.

Overlay can render either:

* existing HUD debug layer
* or pause menu debug tab if overlay system already exists

Must support keyboard toggle.

Required sections:

---

## PLAYER

```text
Position
Velocity
Heading
Grounded
Flying
Boosting
Target Locked
```

---

## CORE STATS

```text
Current Heat / Max Heat
Current Energy / Max Energy
Total Weight
Weight Factor
Heat State
Energy State
Movement State
```

---

## MOVEMENT

```text
Mobility Type
Forward Speed
Reverse Speed
Strafe Speed
Turn Speed
Acceleration
Flight Thrust
Lift Capacity
Terrain Multiplier
```

---

## DEFENSE

```text
Total PDEF
Total EDEF
Stagger Resistance
```

---

## PERFORMANCE

```text
FPS
Entity Count
Projectile Count
Audio Voices
Active Timers
```

---

## COMBAT

```text
Last Damage Taken
Last Damage Type
Last Hit Location
Last Heat Gain
Last Energy Drain
```

---

## AUDIO

```text
Current Audio Event
Playback Rate
Volume
Loop State
```

---

## PART STATUS

Display every equipped slot:

```text
slotName
partName
integrity
ONLINE/OFFLINE
```

---

### Accessibility requirement

Debug overlay must also support optional:

* console text dump
* speech summary

---

### 🎯 Expected Outcome

* Every live gameplay system is visible at runtime
* No guessing why a stat changed

---

### 🧪 Verify

* Fire weapon
* Take damage
* Overheat
* Fly
* Confirm all values change live

---

## Ticket 0C — Pause Menu Debug Tabs
Copilot status: Complete
Developer status: Approved

### 🧠 Copilot Prompt

Expand the existing pause menu with developer tabs.

Required tabs:

---

## Runtime Stats

Shows same data as debug overlay.

---

## Event Log

Shows newest first.

Example:

```text
12.4 Weapon Fired
12.6 Heat Increased
12.8 Missile Impact
13.1 Left Arm Offline
```

---

## Live Tuning

Allows runtime adjustment of:

```text
heat multipliers
energy regen
cooling rates
movement scaling
stagger scaling
traction multipliers
drift multipliers
audio pitch scaling
audio volume scaling
```

Changes apply instantly.

---

### 🎯 Expected Outcome

* Systems can be tuned without restarting

---

### 🧪 Verify

* Change cooling rate
* Return to combat
* Observe immediate difference

### Regression Note — Global Form Keyboard Safety

This is a project-wide non-regression requirement for every current and future form/modal/editor UI.

Required behavior:

* While focus is inside any editable control (`input`, `textarea`, `select`, or `contenteditable`), gameplay/global hotkeys must not fire.
* `Tab` and `Shift+Tab` must move focus normally through actionable elements in the active form/modal.
* Focus traps are allowed only within the currently active dialog, and must never steal focus from another open form/modal.

Minimum regression check after any keyboard/focus/hotkey change:

* Open a form (garage/editor/console-adjacent UI), type letters used by hotkeys (`M`, `F2`, `` ` ``, `Esc`) and confirm no unintended global action occurs while typing.
* Use `Tab` and `Shift+Tab` to traverse the full form and confirm focus does not jump to pause menu or unrelated overlays.
* Repeat the same checks while paused and while developer overlays are visible.

---

## Ticket 0D — In-Game Loadout HTML UI
Copilot status: Complete
Developer status: Approved

### 🧠 Copilot Prompt

Implement an HTML-based in-game loadout UI.

Use existing HTML UI framework.

---

## Left Side

Tab or button for every slot:

```text
Head
Core/ExoShell
Generator
Thermal
Movement
Left Arm
Right Arm
Left Shoulder
Right Shoulder
Legs
Utility 1
Utility 2
Aggregate Stats
```

---

## Right Side

When slot selected:

# Part Name

Display:

```text
Part Type
Mobility Type
Weight
Integrity
ONLINE/OFFLINE

PDEF
EDEF

Energy Drain
Heat Generation
Heat Dissipation

Power Output
Rated Load
Lift Capacity

Speed Modifier
Terrain Multiplier

Special Effects
Passive Bonuses
Active Abilities
```

Only show relevant fields.

---

## Aggregate Stats Tab

```text
Total Weight
Rated Load
Weight Factor

Total PDEF
Total EDEF

Max Energy
Energy Regen

Max Heat
Cooling Rate

Mobility Type

Top Speed
Reverse Speed
Strafe Speed
Turn Speed

Flight Enabled
Lift Capacity

Stagger Resistance

Total Passive Bonuses
Total Active Systems
```

Stats must update immediately when:

* part changes
* integrity changes
* subsystem goes offline
---
There will need to be actual parts equipped to the player by default for testing purposes. Use existing stats as the player is already using where applicable and placeholder for things not implemented yet. Here is the initial loadout player has by default:
---

## Default Equipped Parts (Required for Testing)

The player must spawn with a complete baseline loadout so every slot in the loadout UI can be validated against current player stats and capabilities.

Use these generic part names:

Head: Basic Head
Core/ExoShell: Basic ExoShell
Generator: Basic Generator
Thermal: Basic Thermal Regulator
Movement: Basic Legs
Left Arm: Basic Left Arm
Right Arm: Basic Right Arm
Legs: Basic Legs
Utility 1: Basic Utility 1
Utility 2: Basic Jetpack

Weapon/mount requirements:

Right Hand: Basic Pistol (must map to current pistol behavior/stats)
Left Hand: Basic Sword (must map to current melee sword behavior/stats)
Left Shoulder: Empty
Right Shoulder: Empty

Implementation note:

For any part stat category not implemented yet, use placeholder values that are stable and visible in the UI. Slot displays and aggregate stats must still reflect those placeholders consistently.

### Accessibility requirement

* keyboard navigable
* screen reader labeled
* semantic HTML only
* no canvas rendering

---

### 🎯 Expected Outcome

* Full mech state visible at any time
* Can inspect every subsystem individually
* Aggregate stats always authoritative

---

### 🧪 Verify

* Damage left arm to 0
* Open loadout
* Confirm offline state
* Confirm aggregate stats changed

---

## Ticket 0E — Fullscreen World Map Overlay (F2)
Copilot status: ready for approval
Developer status: complete

### Implementation Notes

Implemented a fullscreen world map overlay toggle on F2 that renders above all other visuals.

Delivered behavior:

* F2 toggles map on and off at runtime
* Map covers full viewport with opaque black ground for contrast
* Player renders as a green directional arrow in real time
* Enemies render as red directional arrows in real time
* City and town labels render as text on the map
* Overlay takes visual precedence while active and returns to underlying gameplay view when closed

---

# 🧱 PHASE 1 — CORE WORLD TRUTH

---

## Ticket 1 — Normalize Part Data Access
Copilot status: Complete
Developer status: Approved

### 🧠 Copilot Prompt

Implement a unified way to access all equipped mech parts.

Every part must expose:

* weight
* PDEF
* EDEF
* energyDrain
* integrity

Missing values must never crash systems.

---

### 🎯 Expected Outcome

* All parts iterable uniformly

---

### 🧪 Verify

* Log all parts in one loop

---

## Ticket 2 — Compute Global Mech Stats
Copilot status: Complete
Developer status: Approved

### 🧠 Copilot Prompt

Aggregate:

* totalWeight
* totalPDEF
* totalEDEF
* maxEP
* maxHeat

Update instantly when parts change.

---

### 🎯 Expected Outcome

* Single authoritative mech stat snapshot

---

### 🧪 Verify

* Equip/unequip updates totals

---

## Ticket 3 — Subsystem Integrity Binding
Copilot status: Complete
Developer status: Approved

### 🧠 Copilot Prompt

Integrity acts as subsystem HP.

At zero:

* mark OFFLINE
* remove bonuses
* disable functionality

---

### 🎯 Expected Outcome

* Broken parts affect gameplay

---

### 🧪 Verify

* Set integrity to 0

---

## Ticket 4 — Mobility Archetypes
Copilot status: Complete
Developer status: Approved

### 🧠 Copilot Prompt

Implement movement parts exposing:

```text
mobilityType
ratedLoad

groundAcceleration
groundDeceleration

maxForwardSpeed
maxReverseSpeed
maxStrafeSpeed

turnRate

terrainPenaltyMultiplier

energyUse
```

Supported types:

---

## Wheels

Vehicle-like:

* smooth acceleration
* speed-based steering
* wide turns
* minimal strafing

---

## Treads

Tank-like:

* pivot turning
* high traction
* stable

---

## Hover

Hovercraft-like:

* drift
* momentum
* strong strafing

---

## Walker

Balanced mech legs.

---

## Flight

Weight-sensitive thrust.

---

### 🎯 Expected Outcome

* Movement behavior depends entirely on equipped movement system

---

### 🧪 Verify

* Swap movement parts

---

## Ticket 5 — Audio Event Contracts
Copilot status: Complete
Developer status: Approved

### 🧠 Copilot Prompt

Implement semantic audio events.

Never hardcode filenames.

Use placeholders automatically if assets are missing.

---

### Movement Events

```text
move_start
move_stop
move_idle
move_loop
move_accelerate
move_decelerate
move_skid
move_boost
```

---

### Wheels

```text
wheel_idle
wheel_roll
wheel_accelerate
wheel_brake
wheel_skid
```

Current client implementation uses layered idle, pitch, and skid synthesis tied to wheel speed and acceleration.

---

### Treads

```text
tread_idle
tread_roll
tread_turn
tread_brake
```

---

### Hover

```text
hover_idle
hover_move
hover_strafe
hover_boost
```

---

### Walker

```text
servo_idle
servo_step
servo_turn
servo_jump
```

---

### Flight

```text
thruster_start
thruster_loop
thruster_stop
```

---

### Placeholder requirements

Missing assets must still:

* loop
* pitch scale
* volume scale
* fade in/out

Never throw missing-audio errors.

---

### 🎯 Expected Outcome

* Audio independent of final assets

---

### 🧪 Verify

* Remove asset
* Placeholder still plays

---

# ⚖️ PHASE 2 — WEIGHT SYSTEM

---

## Ticket 6 — Weight Factor Calculation
Copilot status: Complete
Developer status: Approved

Notes: Implemented authoritative Ticket 6 formula in runtime UI/debug paths using movement.ratedLoad from the current movement archetype profile.

Implement:

```text
loadRatio = totalWeight / movement.ratedLoad
weightFactor = 1 / (1 + loadRatio)
```

---

## Ticket 7 — Apply Weight to Ground Movement
Copilot status: Complete
Developer status: Approved

Notes: Applied Ticket 6 weightFactor to grounded turn rate, acceleration/deceleration response, and reverse/strafe velocity caps in runtime movement update.

Apply to:

* acceleration
* deceleration
* reverse
* strafe
* turn

---

## Ticket 8 — Flight Weight Restriction
Copilot status: Complete
Developer status: Approved

Notes: Rotor/helicopter flight part prototype now uses weighted lift checks, weighted vertical takeoff timing, and rotor-count scaling for stability and energy/heat usage. Runtime now blocks takeoff and forces grounded state when current total weight exceeds lift capacity.

* overweight disables flight

---

## Ticket 9 — Stagger Resistance from Weight
Copilot status: Complete
Developer status: Approved

Notes: Added authoritative weight resistance formula helper and surfaced live stagger resistance values in runtime debug and player.stagger command output.

Implement:

```text
weightResistance = totalWeight / (totalWeight + 1000)
```

---

# 🔥 PHASE 3 — HEAT SYSTEM

---

## Ticket 10 — Weapon Heat Generation
Copilot status: ready for approval
Developer status: approved

Notes: Added per-shot weapon heat generation with an explicit `heatPerShot` override path and a runtime-derived fallback formula when the override is omitted.

Heat per shot.

---

## Ticket 11 — Heat From Incoming Damage
Copilot status: ready for approval
Developer status: pending

Notes: Incoming combat damage now emits typed player-damage events (physical/incoming/explosive), and runtime heat gain is computed from those events using deterministic type multipliers plus `devHeatMultiplier`.

Incoming damage generates heat.

---

## Ticket 12 — Heat Dissipation
Copilot status: Complete
Developer status: Approved

Notes: Passive cooling now applies every frame from online `ThermalRegulator.heatDissipation`, scaled by the existing runtime cooling tuning value (default 1.0). If the thermal subsystem is offline, passive cooling is 0.

Passive cooling.

---

## Ticket 13 — Heat State System
Copilot status: ready for approval
Developer status: approved

Notes: Implemented canonical runtime heat states (`NORMAL`, `HOT`, `CRITICAL`, `DANGER`, `OVERHEAT`) with deterministic thresholds and overheat recovery lockout until heat drops to 25% or lower. Added live HUD heat percentage after EP and a Tone.js heat-sizzle status layer that rises in volume and timbre intensity proportionally to heat percentage.

States:

* NORMAL
* HOT
* CRITICAL
* DANGER
* OVERHEAT

---

## Ticket 14 — Overheat Shutdown
Copilot status: Complete
Developer status: Approved

Notes: `OVERHEAT` now hard-disables player weapon use, blocks takeoff/boost attempts, forces an in-air mech into descending shutdown, and sets energy regeneration to 0 until heat recovers to the spec-defined recovery threshold.

Disable:

* weapons
* flight
* regen

---

# ⚡ PHASE 4 — ENERGY SYSTEM

---

## Ticket 15 — Energy Consumption
Copilot status: Complete
Developer status: Approved

Notes: Equipped online subsystem `energyDrain` values are tracked as live energy load for debug/runtime accounting, while direct EP depletion currently comes from active runtime drains already implemented (flight/boost). This avoids idle EP lockout until the canonical generator regen model is added in later energy tickets.

Track usage.

---

## Ticket 16 — Regen Delay
Copilot status: Complete
Developer status: Approved

Notes: Energy regeneration now waits for a generator-scoped `regenDelay` window after the last active energy use currently implemented in runtime (flight or boost). Passive subsystem upkeep remains continuous drain but does not perpetually reset the delay, preserving recovery until Ticket 17 adds canonical generator regen formulas.

Delayed regeneration.

---

## Ticket 17 — Regen Calculation
Copilot status: Complete
Developer status: Approved

Notes: Generator regen now uses explicit idle/moving/flying stats with deterministic fallback from legacy generator data, then scales the active regen rate by existing weight factor and a heat-state multiplier. Regen remains delayed by Ticket 16 before the calculated rate is applied.

Use:

* movement
* flight
* weight
* heat

# ⚡ PHASE 4 — ENERGY SYSTEM

---

## Ticket 18 — Energy Starvation

Copilot status: Complete
Developer status: Approved

Notes: Added runtime energy-starvation state transitions (`energy_starved`, `energy_restored`) plus immediate shutdown of flight/boost while EP is 0. Added an extensible placeholder gate for energy-weapon firing (`energyDependent` / `energyCostPerShot`) so physical weapons remain usable.

### 🧠 Copilot Prompt

Implement energy starvation behavior.

When:

```text
currentEP <= 0
```

Disable:

* flight
* energy weapons
* boost systems

Ground movement remains available.

Physical weapons remain usable.

Trigger:

```text
energy_starved
```

when entering starvation.

Trigger:

```text
energy_restored
```

when exiting starvation.

---

### 🎯 Expected Outcome

* Mech remains mobile
* Energy-dependent systems shut down immediately

---

### 🧪 Verify

* Set energy to 0
* Attempt boost
* Attempt flight
* Attempt ballistic weapon
* Confirm only energy systems fail


# 🎯 PHASE 5 — TARGETING + COMBAT COGNITION

---

## Ticket 19 — Target Lock Acquisition

Copilot status: ready for approval
Developer status: approved

Notes: Target acquisition now scores all visible combat targets, keeps the current target unless a new one clears the hysteresis threshold, and exposes currentTargetId, lockProgress, and targetScore in runtime debug output.

### 🧠 Copilot Prompt

Implement target lock acquisition.

A target becomes lockable when:

* inside lock box
* within weapon range
* line of sight exists
* target is not fully ECM-obscured

Bronze lock must occur instantly.

If multiple targets qualify:

Use target priority:

```text
targetScore =
(crosshairAlignment * 0.5) +
(distanceWeight * 0.3) +
(targetSizeWeight * 0.2)
```

Highest score wins.

Implement hysteresis.

Current target remains selected unless another target exceeds score by hysteresis threshold.

Weapon switching must preserve:

```text
currentTargetId
lockProgress
selectedSubsystem
```

unless the newly selected weapon cannot engage at current range.

---

### Required runtime data

```text
currentTargetId
lockProgress
targetScore
selectedSubsystem
```

---

### 🎯 Expected Outcome

* Stable target selection
* No target jitter
* Weapon switching does not drop lock unnecessarily

---

### 🧪 Verify

* Spawn multiple enemies
* Sweep crosshairs across targets
* Switch weapons
* Confirm stable target retention

---

## Ticket 20 — Continuous Lock Progression

Copilot status: ready for approval
Developer status: approved

Notes: Replaced instant lock with continuous progression (0-100) using alignment, distance, target movement, and runtime head/computer/chip factors. Added retention decay when lock requirements break, resume-on-reacquire for the same target, and enforced head-destroyed penalties (max Silver cap, 0.4 gain multiplier, reduced tracking stability).

### 🧠 Copilot Prompt

Implement continuous lock progression:

```text
lockProgress = 0–100
```

Lock gain speed affected by:

* crosshair alignment
* target distance
* target movement
* head.lockAcquisition
* head.trackingStability
* computer.processorSpeed
* chip modifiers

Lock thresholds:

```text
0–24 Bronze
25–59 Silver
60–84 Gold
85–100 Platinum
```

Active lock breaks when:

* target leaves lock box
* target leaves weapon range
* line of sight breaks
* ECM disrupts lock
* player loses aim

When active lock breaks:

* lock enters retention state
* lock progress decays

Decay affected by:

```text
computer.lockRetention
```

Head destruction penalties:

```text
maxLockLevel = Silver
lockGainMultiplier = 0.4
trackingStability reduced
```

---

### 🎯 Expected Outcome

* Lock grows smoothly
* Faster targets harder to refine
* Sensor crippling affects combat

---

### 🧪 Verify

* Track stationary target
* Track moving target
* Destroy head
* Confirm degraded lock capability

---

## Ticket 21 — Lock Audio + Cockpit Announcements

Copilot status: ready for approval
Developer status: pending review
Notes: Implemented a full lock-audio redesign in runtime targeting/audio systems. Added explicit lock telemetry (`isTargetInLockBox`, `centerError`, `horizontalOffset`, `lockRateMultiplier`) and switched lock refinement gain to accuracy-driven quadratic scaling. Replaced refinement beeps with transition-based lock state audio: continuous presence tone while target is lockable, smoothed bullseye pulse-rate guidance with stereo panning, and one-shot milestone chirps at 25/50/75 plus distinct 100% lock-acquired cue. Removed old per-frame lock acquire/loss chirps from active target-lock transitions to preserve one-signal-per-meaning behavior.

### 🧠 Copilot Prompt

Implement lock audio.

Continuous lock tone:

Pitch scales proportionally with:

```text
lockProgress
```

Threshold announcements:

Bronze:

```text
Target acquired
```

Silver:

```text
Subsystem analysis available
```

Gold:

```text
Precision lock
```

Platinum:

```text
Surgical lock
```

Must support:

* audio
* speech
* debug text

---

### 🎯 Expected Outcome

* Player can track lock state without visuals

---

### 🧪 Verify

* Lock target from 0 to Platinum
* Confirm all transitions

---

## Ticket 22 — Lock Memory Bandwidth

Copilot status: not started
Developer status: approved

### 🧠 Copilot Prompt

Implement target memory.

Computer exposes:

```text
memoryBandwidth
```

Partial lock progress may be retained across multiple targets.

Rules:

Each remembered target consumes bandwidth.

When bandwidth is full:

* weakest remembered lock is discarded

When target destroyed:

* memory returns to pool

Lock memory decays over time.

---

### 🎯 Expected Outcome

* Skilled players may juggle multiple partial locks

---

### 🧪 Verify

* Lock enemy A
* Lock enemy B
* Return to enemy A
* Confirm retained progress

---

## Ticket 23 — Bronze Combat Routing

Copilot status: Complete
Developer status: Approved

Notes: Bronze lock now forces full direct-fire spread cone, direct-fire impacts route through the explicit Core damage path in ECS, missile targeting continues to ignore subsystem routing and applies center-mass blast damage, and ECM-obstructed targets are capped to Bronze lock progression.

### 🧠 Copilot Prompt

At Bronze lock:

Subsystem targeting is disabled.

Weapon spread uses full accuracy cone.

Damage routing:

```text
all direct-fire damage → Core
```

Missiles ignore subsystem targeting.

Missiles always use center-mass blast routing.

ECM interference limits maximum lock to Bronze.

---

### 🎯 Expected Outcome

* Spray-and-pray remains viable

---

### 🧪 Verify

* Fire at Bronze
* Confirm only Core takes damage

---

## Ticket 23A — Entity Target Layout Definitions

Copilot status: Complete
Developer status: Approved

### Implementation Notes

Implemented a new `target-layout.ts` module in `packages/client/src/test-map/` with:
- `TargetLayout`, `TargetLayoutNode`, `TargetLayoutEdge`, `TargetLayoutEntity` type definitions
- Five starter layouts: `HumanoidMech`, `Tank`, `Helicopter`, `APC`, `Drone`
- Four required APIs: `getTargetLayout`, `getAdjacentSubsystem`, `getExposedSubsystems`, `getFallbackSubsystem`
- Grid-based directional navigation (up/down/left/right maps to gridX/gridY)
- `getLayoutIdForEntityType(string)` helper mapping enemy type strings to layout IDs
- `layoutId` added to `TargetableEnemyRender` (and populated in `combat-ecs.ts` for all enemy/tank render objects)
- Internal nodes (Generator, Computer, ThermalRegulator, Engine) are `initiallyExposed: false`; TODO Ticket 25 hooks in `getAdjacentSubsystem` and `getExposedSubsystems`

### 🧠 Copilot Prompt

Implement data-driven targeting layouts.

Every targetable entity must expose:

```text
layoutId
nodes
edges
defaultNode
fallbackNode
```

Each node exposes:

```text
nodeId
partType
gridX
gridY
initiallyExposed
destroyedFallbackNode
```

Implement APIs:

```text
getTargetLayout(entity)
getAdjacentSubsystem(entity,node,direction)
getExposedSubsystems(entity)
getFallbackSubsystem(entity)
```

Required starter layouts:

* HumanoidMech
* Tank
* Helicopter
* APC
* Drone

Layout coordinates are for deterministic navigation only.

---

### 🎯 Expected Outcome

* Any entity can use subsystem targeting

---

### 🧪 Verify

* Spawn mech
* Spawn tank
* Spawn helicopter
* Navigate subsystems

---

## Ticket 24 — Directional Subsystem Selection

Copilot status: ready for approval
Developer status:

### Implementation Notes

Implemented Alt-modifier subsystem navigation in test-map runtime targeting flow:

* Added runtime `selectedSubsystem` state to target lock (`TargetLockState`).
* Added input tracking for subsystem-selection modifier (`Alt`) and preserved existing movement keys.
* While `Alt` is held, `turnLeft/turnRight/lookUp/lookDown` are remapped away from camera/movement and used for subsystem navigation.
* Bronze lock behavior: subsystem directional controls are disabled and a blocked-action announcement is emitted.
* Silver+ lock behavior: subsystem directional controls are enabled and navigate by target layout adjacency.
* On target change, subsystem selection initializes from layout default/fallback exposed node.
* If selected subsystem becomes invalid (not exposed/available), selection auto-falls back to layout fallback and announces `Subsystem unavailable`.
* Extended `player.get target` output to include current `selectedSubsystem` for runtime verification.

Files touched:

* `packages/client/src/test-map/types.ts`
* `packages/client/src/test-map/player-state.ts`
* `packages/client/src/test-map/input.ts`
* `packages/client/src/test-map/target-lock.ts`
* `packages/client/src/test-map/main.ts`

### 🧠 Copilot Prompt

Subsystem targeting unlocks at Silver.

Holding subsystem-selection modifier:

```text
Alt
```

temporarily remaps:

```text
turnLeft
turnRight
lookUp
lookDown
```

into:

```text
navigate subsystem layout
```

Use entity targeting layouts.

Bronze:

* subsystem controls disabled

Silver+:

* subsystem controls enabled

If selected subsystem becomes invalid:

* destroyed
* hidden
* jammed

Automatically:

```text
selectedSubsystem = fallbackNode
```

Announce:

```text
Subsystem unavailable
```

---

### 🎯 Expected Outcome

* Directional muscle memory
* No static cycling

---

### 🧪 Verify

* Reach Silver
* Navigate all directions

---

## Ticket 25 — Core Breach + Internal Exposure

Copilot status: not started
Developer status:

### 🧠 Copilot Prompt

When Core integrity reaches 0:

Expose all hidden internal nodes defined by entity layout.

Example mech internals:

```text
Computer
Generator
ThermalRegulator
```

Core destruction:

* removes defensive bonuses
* does NOT destroy entity

If core becomes restored:

* internal nodes become hidden again

Invalid selections fall back automatically.

---

### 🎯 Expected Outcome

* Layered armor targeting

---

### 🧪 Verify

* Destroy Core
* Confirm internals appear

---

## Ticket 26 — Lock Stage Combat Accuracy

Copilot status: not started
Developer status:

### 🧠 Copilot Prompt

Apply lock-stage weapon compensation.

### Bronze

* no compensation
* full spread

### Silver

* partial spread compensation
* partial subsystem bias

### Gold

* strong recoil compensation
* strong subsystem bias

### Platinum

For non-missile direct-fire weapons:

* guaranteed subsystem hit

Missiles:

* always use blast routing

---

### 🎯 Expected Outcome

* Lock refinement directly affects combat precision

---

### 🧪 Verify

* Fire a each lock stage

---

## Ticket 27 — Lock Loss + Retarget Penalty

Copilot status: not started
Developer status:

### 🧠 Copilot Prompt

When subsystem selection changes:

Reduce lock stage by one:

```text
Platinum → Gold
Gold → Silver
Silver → Bronze
Bronze → Bronze
```

When active lock breaks:

* enter retention state
* preserve target
* preserve subsystem
* decay over time

---

### 🎯 Expected Outcome

* Retargeting remains tactical

---

### 🧪 Verify

* Reach Platinum
* Change subsystem
* Confirm downgrade

---

## Ticket 28 — Replace Random Subsystem Damage

Copilot status: not started
Developer status:

### 🧠 Copilot Prompt

Remove all legacy random subsystem hit logic.

All subsystem damage must route through:

* Bronze Core routing
* Silver+ selected subsystem routing
* Platinum guaranteed routing

No hidden random subsystem damage allowed.

Splash routing must use:

* blast radius
* blast direction
* entity targeting layout topology

Explosion damage distributes across exposed subsystems.

Generator destruction:

```text
storedEP remains
energyRegen = 0
```

Thermal destruction:

```text
coolingRate = 0
```

---

### 🎯 Expected Outcome

* Combat fully matches Master Spec

---

### 🧪 Verify

* Search codebase for random subsystem routing
* Confirm all combat uses targeting system

---

## Open-World Runtime Update — Centralized Frame-Budgeted Scheduler (2026-05-21)

Copilot status: ready for review
Developer status: pending

### Implementation Notes

Implemented a centralized update scheduler and integrated it into the open-world runtime loop to prioritize consistent frame pacing over maximum update frequency.

Delivered:

* New strict-TS scheduler module (`packages/client/src/test-map/update-scheduler.ts`) with:
	* priority levels (`critical`, `high`, `medium`, `low`, `dormant`)
	* per-task interval scheduling
	* frame budget tracking and budget-aware deferral for non-critical tasks
	* anti-starvation controls (`maxDeferralFrames`)
	* event-driven triggering (`eventToken`)
	* runtime diagnostics (per-frame and per-task cost/defer/skip/queue metrics)
* Main loop integration in `packages/client/src/test-map/main.ts`:
	* dynamic per-frame scheduler budget setup
	* scheduled chunk-streaming transitions to reduce activation spikes
	* scheduled combat ECS updates with distance-aware cadence behavior
	* scheduled combat render-state extraction
	* scheduled, event-driven target refinement with time-sliced target candidate processing
	* scheduled audio navigation and occlusion/runtime updates with emitter slicing
* Runtime debug overlay now reports scheduler budget usage and queue/defer/worst-frame telemetry.

### Validation

* `npm run typecheck` passed (workspace)
* `npm run build:client` passed

### Suggested Playtest Focus

* Sprint/traverse across chunk boundaries and confirm reduced stutter.
* Heavy combat scenarios (high enemy/projectile counts) and verify stable frame pacing.
* Confirm targeting responsiveness remains acceptable under scheduler deferral.
* Confirm distant audio/AI degrade gracefully without obvious pops or starvation.

---

## Enemy Missile System — Phase 2 (Threat Detection + Audio Warning Layer)

Copilot status: Complete
Developer status: Pending playtest

### Implementation Notes

- Added `MissileThreatManager` at `packages/client/src/test-map/missile-threat-manager.ts`.
- Integrated threat manager into `stepCombatEcsWorld` in `packages/client/src/test-map/combat-ecs.ts`.
- Threat scan runs once per tick over active missiles (`O(n)`), with per-missile cached track state for flyby/overshoot checks.
- Threat eligibility:
	- missile explicitly targeting player
	- OR missile inside configurable threat distance
- Threat score used:
	- `(damage * 2.0) + (speed * 1.5) + (1 / distance_to_player) + (blast_radius * 1.2)`
- Single active warning target rule enforced:
	- highest threat score missile becomes active warning source
	- no multi-missile warning mix
- Warning states implemented:
	- detection
	- tracking
	- terminal
- Time-to-impact estimate used for urgency transitions:
	- `distance / missile_speed`
- Flyby/overshoot detection implemented with cached per-missile trend checks:
	- distance increasing after a close pass
	- or approach speed sign flip across player vector

- Added audio interface hooks and runtime playback implementation:
	- `play_missile_warning(type, intensity, direction)`
	- `stop_missile_warning()`
	- `play_flyby_sound(direction, speed)`
- Runtime follow-up update:
	- Added directional missile warning pulse playback with state-based urgency (detection/tracking/terminal).
	- Added flyby chirp playback tied to overshoot events.
	- Added explicit missile explosion visual bursts in render state with radius-based scaling.
	- Increased helicopter missile blast radius/damage and proximity fuse distance to improve near-hit explosive threat.

### Suggested Playtest Focus

- Spawn multiple enemy missiles and confirm only one drives warning at a time.
- Confirm warning escalation from detection to tracking to terminal as range/TTI collapse.
- Confirm active warning target swaps immediately when current threat is destroyed/lost.
- Confirm dodged missile flyby triggers once and warning handoff occurs cleanly.

---

## Enemy Missile System — Phase 3 (Explosion Interaction + Terrain Strategy Layer)

Copilot status: Complete
Developer status: Pending playtest

### Implementation Notes

- Kept unified shared explosion path for all missile detonations:
	- `create_explosion(position, radius, damage, owner_id)` in `packages/client/src/test-map/combat-ecs.ts`.
	- Missile detonation callsites still route through `detonateMissile(...) -> create_explosion(...)` only.
- Updated explosion falloff to quadratic profile for clearer center/edge readability:
	- `damage_multiplier = (1 - distance/radius)^2`.
- Added LOS terrain shielding in explosion resolution:
	- Per target in blast radius, perform `traceWorldHit3D(collisionWorld, explosionCenter, targetCenter, EXPLOSION_LOS_TRACE_RADIUS)`.
	- If occluded, apply exposure multiplier by obstacle type.
- Added hard-cover rule:
	- `wall` and `pillar` fully block blast (`0x` exposure).
- Added soft-cover attenuation:
	- `rock` heavily attenuates (`0.25x` exposure).
	- `tree` attenuates (`0.4x` exposure).
- Preserved grounded explosion origin behavior:
	- Explosion origin remains actual missile detonation point from impact/proximity/lifetime logic.
- Friendly fire consistency retained:
	- No faction/immunity filters were introduced in shared explosion damage path.
	- Any alive entity with `Health` in range is evaluated.
- Destructible/environment interaction support confirmed:
	- Explosion damage path is generic over `Health` component holders (not tank-only).
	- Existing combat audio confirms now play only for combatants (`KIND_TANK` / `KIND_ENEMY`) while damage stays generic.
- Performance considerations:
	- Explosion remains `O(n entities in radius-check loop)` over active ECS entities.
	- LOS ray is only executed after radius gate passes.
	- Uses existing BVH-backed `traceWorldHit3D` world collision system (no new physics subsystem).

### Suggested Playtest Focus

- Verify wall/pillar hard cover gives zero missile splash damage.
- Verify tree/rock give partial protection and edge-of-radius feels safer under quadratic falloff.
- Verify enemy self-damage and enemy-on-enemy splash still occur naturally.
- Verify forcing missiles into terrain can intentionally reduce/negate blast on player.

---

## Enemy Missile Guidance Intercept Update

Copilot status: Complete
Developer status: Pending playtest

### Implementation Notes

- Replaced point-chase steering with predictive intercept steering in missile guidance loop.
- Intercept lead calculation now uses:
	- `interceptTime = distance(missile,target) / missileSpeed`
	- `predictedTargetPosition = targetPosition + targetVelocity * interceptTime`
- Added max lead-time clamp:
	- `MISSILE_INTERCEPT_MAX_LEAD_SECONDS = 0.75`
	- prevents long-arc overshoot on distant/high-relative-speed shots.
- Added explicit lead scaling to avoid over-leading high lateral targets:
	- `MISSILE_INTERCEPT_LEAD_FACTOR = 0.65`.
- Preserved turn-rate-limited steering:
	- desired angle is computed from predicted intercept direction first,
	- then angular delta is clamped by per-missile turn rate.
- Added smoothing to desired direction:
	- blends previous guidance direction toward new desired direction each tick
	- `MISSILE_GUIDANCE_SMOOTHING_FACTOR = 0.45`.
- Added vertical homing (pitch guidance) each tick:
	- desired pitch is recomputed against predicted target position
	- pitch rotation is clamped by turn-rate-scaled cap (`MISSILE_PITCH_TURN_RATE_SCALE = 0.9`).
- Fixed enemy missile launch pitch sign bug:
	- enemy missile spawn now uses `getPitchToTarget(...)` for consistent vertical aiming convention.
- Added helicopter-specific spawn pitch clamp to prevent immediate ground dives:
	- initial launch pitch is limited to a shallow band before homing takes over (`-0.10 .. 0.02` rad).
- Added distance-aware descent gating in missile pitch homing:
	- when far from target, maximum downward pitch is capped to shallow angles,
	- downward authority increases as horizontal range closes,
	- prevents early terrain impact before seeker convergence.
- Applied global missile speed reduction:
	- `MISSILE_SPEED_GLOBAL_SCALE = 0.78` for all spawned missiles (enemy and player).
- Velocity sampling source:
	- World-space target velocity is estimated per tick from position deltas (`deltaSeconds`) for player and tank entities.
	- Missiles consume cached world-space velocity samples by target id.
- Scope guard:
	- No explosion, damage, threat, audio, or missile movement/physics structure changes.

### Suggested Playtest Focus

- Verify helicopter-fired missiles no longer climb/arc away and now descend/track into player envelope.
- Verify player missiles reacquire and home both horizontally and vertically against moving enemies.
- Verify missiles lead strafing player instead of trailing current position.
- Verify fewer wide-orbit misses against fast lateral targets.
- Verify guidance remains stable (reduced jitter) during rapid target direction changes.
