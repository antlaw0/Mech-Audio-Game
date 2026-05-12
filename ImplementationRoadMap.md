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

Implement:

```text
loadRatio = totalWeight / movement.ratedLoad
weightFactor = 1 / (1 + loadRatio)
```

---

## Ticket 7 — Apply Weight to Ground Movement

Apply to:

* acceleration
* deceleration
* reverse
* strafe
* turn

---

## Ticket 8 — Flight Weight Restriction

* overweight disables flight

---

## Ticket 9 — Stagger Resistance from Weight

Implement:

```text
weightResistance = totalWeight / (totalWeight + 1000)
```

---

# 🔥 PHASE 3 — HEAT SYSTEM

---

## Ticket 10 — Weapon Heat Generation

Heat per shot.

---

## Ticket 11 — Heat From Incoming Damage

Incoming damage generates heat.

---

## Ticket 12 — Heat Dissipation

Passive cooling.

---

## Ticket 13 — Heat State System

States:

* NORMAL
* HOT
* CRITICAL
* DANGER
* OVERHEAT

---

## Ticket 14 — Overheat Shutdown

Disable:

* weapons
* flight
* regen

---

# ⚡ PHASE 4 — ENERGY SYSTEM

---

## Ticket 15 — Energy Consumption

Track usage.

---

## Ticket 16 — Regen Delay

Delayed regeneration.

---

## Ticket 17 — Regen Calculation

Use:

* movement
* flight
* weight
* heat

---

## Ticket 18 — Energy Starvation

Disable:

* flight
* energy weapons
* boost

Ground movement remains.

---

# 🛡️ PHASE 5 — COMBAT PIPELINE

---

## Ticket 19 — Defense Calculation

```text
mitigation = x / (x + 100)
finalDamage = incoming * (1 - mitigation)
```

---

## Ticket 20 — Damage Routing

* physical → PDEF
* energy → EDEF

---

## Ticket 21 — Combat Resolution Order

Process:

```text
damage
heat
energy
stagger
subsystem damage
```

---

## Ticket 22 — Subsystem Damage

Random subsystem hit.

Destroying parts disables them.

---

