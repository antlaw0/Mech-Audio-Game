# MECH SYSTEMS SPEC v2.4 (FINAL)

---

# CORE GAME SYSTEMS OVERVIEW

This system defines a deterministic mech combat simulation with modular parts, subsystem damage, layered targeting, lock memory, energy/heat management, utility AI, vehicle-style mobility systems, and gameplay-critical audio feedback.

No physics engine is used.

All movement is mathematical, kinematic, and deterministic.

No rigid body simulation is used.

---

# DESIGN AUTHORITY

This document is the canonical gameplay authority.

If implementation, prototypes, AI-generated code, roadmap tickets, or tooling conflict with this document:

**THIS DOCUMENT WINS.**

Missing implementation details must use:

* placeholder systems
* extensible hooks
* deterministic defaults

No gameplay rule may be invented outside this specification.

---

# GLOBAL UNITS (CANONICAL)

```text
Weight = kilograms
Distance = meters
Speed = meters/second
Acceleration = meters/second^2
Rotation = degrees/second
Energy = EP
Heat = Heat Units
Memory = Lock Points
Time = milliseconds
Damage = Integrity Points
Lock = Lock Points
```

---

# ACCESSIBILITY REQUIREMENTS

All gameplay-critical UI must support:

* keyboard navigation
* semantic HTML
* screen reader labeling

Critical feedback must support:

* audio feedback
* optional speech output
* optional console text output

Critical state changes:

* subsystem offline
* lock acquired
* lock upgraded
* lock lost
* subsystem selected
* overheat
* energy starvation
* weapon disabled

---

# BASE PART MODEL

All equippable parts inherit from:

```text
BasePart:
- id
- name
- slot
- weight
- PDEF
- EDEF
- energyDrain
- currentIntegrity
- maxIntegrity
```

Rules:

* integrity = subsystem health
* integrity ≤ 0 → subsystem OFFLINE
* offline parts provide no bonuses
* integrity contributes to Hull

---

# EQUIP SLOTS

```text
Head
Computer
Core
LeftArm
RightArm
Movement
Generator
ThermalRegulator
LeftMount
RightMount
UtilityLeft
UtilityRight
```

---

# GLOBAL HULL MODEL

Hull is player-facing HP.

Hull is always derived.

```text
maxHP = sum(all part.maxIntegrity)

currentHP = sum(all part.currentIntegrity)

damageTaken = maxHP - currentHP
```

Rules:

* all damage routes to parts
* repairing parts restores Hull
* mech destroyed when currentHP ≤ 0

---

# LOCK SYSTEM

Lock uses continuous refinement.

No hard lock exists.

No camera tracking exists.

Player must manually maintain:

* target inside lock box
* line of sight
* weapon range
* aim alignment

Loss of any requirement:

* stops accumulation
* begins degradation

Reacquisition resumes from remembered progress.

---

# LOCK PROGRESS

```text
lockProgress = 0–100
```

---

# LOCK LEVELS

```text
0–24    Bronze
25–59   Silver
60–84   Gold
85–100  Platinum
```

---

# TARGET PRIORITY

When multiple targets qualify:

```text
targetScore =
(crosshairAlignment * 0.5) +
(distanceWeight * 0.3) +
(targetSizeWeight * 0.2)
```

Highest score selected.

Hysteresis prevents jitter switching.

---

# LOCK GAIN FACTORS

Lock gain depends on:

* crosshair alignment
* distance
* target movement
* head stats
* computer stats
* chips
* ECM

---

# HEAD STATS

```text
lockAcquisition
trackingStability
targetResolution
ecmResistance
```

---

# COMPUTER STATS

```text
processorSpeed
memoryBandwidth
lockRetention
chipSlots
```

---

# LOCK MEMORY

Bandwidth uses raw lock points.

Example:

```text
memoryBandwidth = 200
```

Possible stored locks:

```text
TargetA = 90
TargetB = 70
TargetC = 40
```

Total:

```text
200 / 200
```

When full:

* weakest lock discarded

When target destroyed:

* lock points return to pool

---

# LOCK AUDIO

Continuous tone:

Pitch scales with:

```text
lockProgress
```

Threshold events:

Bronze:

> Target acquired

Silver:

> Subsystem analysis available

Gold:

> Precision lock

Platinum:

> Surgical lock

---

# LOCK DEGRADATION

When target requirements are lost:

Lock begins degrading.

Rate affected by:

```text
computer.lockRetention
```

Reacquiring target resumes accumulation.

Selected subsystem is remembered.

---

# WEAPON SWITCHING

Switching weapons preserves:

* current target
* lock progress
* selected subsystem

Unless:

* new weapon cannot engage current range/type

---

# LOCK STAGE EFFECTS

## Bronze

* no subsystem targeting
* full weapon spread
* no compensation

Damage routing:

```text
Core only
```

---

## Silver

* subsystem targeting enabled
* partial compensation

---

## Gold

* strong compensation

---

## Platinum

Non-missile direct fire:

* guaranteed subsystem hit

---

# SUBSYSTEM GRID

Directional targeting uses this canonical grid:

```text
         UtilityLeft    UtilityRight

               Head

LeftMount                    RightMount

LeftArm        Core          RightArm

             Movement
```

After Core breach:

```text
         UtilityLeft    UtilityRight

               Head

LeftMount                  RightMount

LeftArm   Computer/Core    RightArm
          Generator
          Thermal

             Movement
```

---

# SUBSYSTEM INPUT

Hold subsystem modifier:

Example:

```text
Alt
```

While held:

Movement/look keys become subsystem navigation:

```text
Up
Down
Left
Right
```

Movement controls do not fire while modifier held.

---

# INVALID DIRECTIONAL INPUT

If no subsystem exists:

* selection remains unchanged
* optional boundary audio may play

Nearest valid neighbor used only when directional adjacency exists.

---

# SUBSYSTEM UNLOCK

Bronze:

* no subsystem targeting

Silver+:

* subsystem targeting enabled

---

# INVALID SUBSYSTEM

If selected subsystem becomes invalid:

Examples:

* destroyed
* hidden
* jammed
* unequipped

Selection automatically returns to:

```text
Core
```

Announcement:

> Subsystem unavailable

---

# CORE BREACH

When Core integrity reaches 0:

* Core bonuses removed
* internal systems exposed

Exposed:

```text
Computer
Generator
ThermalRegulator
```

Core destruction does NOT destroy mech.

---

# HEAD FAILURE

If Head is offline:

Bronze still possible.

Penalties:

```text
maxLockLevel = Silver
lockGain × 0.4
```

---

# GENERATOR FAILURE

Stored EP remains.

Penalty:

```text
energyRegen = 0
```

EP continues draining normally.

---

# THERMAL FAILURE

Penalty:

```text
heatDissipation = 0
```

Current heat remains.

---

# JAMMING

When jammed:

Only Bronze possible.

Accumulated lock begins degrading.

If internal subsystem selected:

Selection returns to Core.

---

# EXPLOSION ROUTING

Explosion damage always preserves total damage.

Full engulfment:

Explosion damage distributed evenly across:

* exposed
* online subsystems

Example:

```text
100 damage
5 exposed systems
20 damage each
```

---

# DIRECTIONAL EXPLOSIONS

Off-center explosions bias damage toward nearby subsystems.

Examples:

Left:

* LeftArm
* LeftMount

Above:

* Head
* Utility slots
* Mounts

Below:

* Movement

Front:

* Head
* Mounts

Rear:

* Utility slots

Diagonal:

Weighted between adjacent systems.

Distance to explosion center scales total damage.

---

# MISSILES

Missiles use independent lock.

Missiles:

* target mech center mass
* ignore subsystem targeting
* apply blast routing

---

# MELEE

Melee uses standard lock progression.

Bronze:

* Core hit

Silver+:

* subsystem bias

Platinum:

* guaranteed subsystem hit

---

# AI TARGETING

AI uses utility scoring.

Priority examples:

* mobility cripple
* weapon disable
* thermal overload
* energy starvation
* kill shot

Advanced computers may enable:

```text
AutoSubsystemTarget
```

Optional player toggle.

---

# DAMAGE SYSTEM

```text
mitigation = x / (x + 100)

finalDamage = incomingDamage * (1 - mitigation)
```

Physical:

* PDEF

Energy:

* EDEF

Heat:

* Thermal system

---

# MASTER UPDATE ORDER

```text
1 Input
2 Sensors
3 Targeting
4 AI
5 Movement
6 Weapons
7 Combat
8 Heat
9 Energy
10 Subsystems
11 Status
12 Audio
13 Rendering
```
