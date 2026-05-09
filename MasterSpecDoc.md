# MECH SYSTEMS SPEC v2 (FINAL)

---

# CORE GAME SYSTEMS OVERVIEW

This system defines a deterministic mech combat simulation with modular parts, subsystem damage, energy/heat management, utility AI, vehicle-style mobility systems, and gameplay-critical audio feedback.

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

No implementation may invent gameplay rules not defined here.

---

# GLOBAL UNITS (CANONICAL)

All systems use consistent units:

```text
Weight = kilograms
Distance = meters
Speed = meters/second
Acceleration = meters/second^2
Rotation = degrees/second
Energy = EP
Heat = Heat Units
Memory = Node Units
Time = milliseconds
Damage = Integrity Points
```

---

# ACCESSIBILITY REQUIREMENTS

All gameplay-critical UI must support:

* keyboard navigation
* semantic HTML
* screen reader labeling

No gameplay-critical UI may rely solely on:

* canvas rendering
* color
* animation
* visual-only indicators

Critical state changes must support:

* audio feedback
* optional speech output
* optional console text output

Examples:

* subsystem offline
* lock acquired
* overheat
* energy starvation
* weapon disabled

---

# DEVELOPMENT INSTRUMENTATION

Developer systems are part of the core architecture.

Required developer tools:

* runtime console
* runtime debug overlay
* pause menu debug tabs
* live tuning controls
* event logging
* full loadout inspection

Developer instrumentation must never alter deterministic gameplay unless explicitly invoked.

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
- integrity
```

Integrity is both:

* part durability
* subsystem HP

If integrity reaches 0:

→ part becomes OFFLINE

Offline parts contribute no bonuses.

---

# EQUIP SLOTS

```text
Head
Computer
ExoShell
Arms
Movement
Generator
ThermalRegulator
ShoulderLeft
ShoulderRight
LeftHand
RightHand
FlightSystem
```

---

# GLOBAL MECH STATS

```text
totalWeight = sum(all part weights)

totalPDEF = sum(all PDEF)
totalEDEF = sum(all EDEF)

currentEP / maxEP

currentHeat / maxHeat

mobilityType

weightFactor

staggerResistance
```

These values are always runtime authoritative.

Any equipment change updates them immediately.

---

# MOBILITY SYSTEM

Movement is data-driven.

Movement behavior is determined entirely by the equipped movement subsystem.

Every movement system exposes:

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

stability
```

---

# MOBILITY TYPES

---

## WHEELS

Vehicle-like movement.

Behavior:

* smooth acceleration
* speed-based steering
* wide turn radius
* minimal strafing
* strong braking
* rough terrain penalties

Fantasy:

Armored car / APC.

---

## TREADS

Tracked movement.

Behavior:

* pivot turning
* high traction
* strong stability
* moderate top speed
* reduced acceleration
* stagger resistance bonus

Fantasy:

Heavy tank.

---

## HOVER

Low-friction hover movement.

Behavior:

* momentum preserved
* drifting
* strong strafing
* terrain smoothing
* weak braking precision

Fantasy:

Combat hovercraft.

---

## WALKER

Biped mech locomotion.

Behavior:

* balanced movement
* precise turning
* balanced terrain handling
* jump capable

Fantasy:

Classic mech.

---

## FLIGHT

Optional aerial subsystem.

Behavior:

* vertical thrust
* weight-sensitive lift
* energy drain
* heat generation

Fantasy:

Boost-assisted aerial combat.

---

# GLOBAL MOVEMENT MODEL

Movement is deterministic.

```text
velocity += acceleration * dt

position += velocity * dt
```

No rigid body simulation.

No wheel colliders.

No suspension simulation.

---

# DAMAGE SYSTEM

## Defense Formula

```text
mitigation = x / (x + 100)

finalDamage = incomingDamage * (1 - mitigation)
```

Where:

* x = total PDEF or EDEF

No hard cap.

---

## Damage Routing

* Physical → PDEF
* Energy / Plasma / EMP → EDEF

Heat is NOT reduced by defense.

---

# WEIGHT SYSTEM

```text
loadRatio = totalWeight / movement.ratedLoad

weightFactor = 1 / (1 + loadRatio)
```

Applied to:

* acceleration
* deceleration
* reverse speed
* strafe speed
* turn speed

```text
effectiveTurnSpeed = baseTurnSpeed * sqrt(weightFactor)
```

---

# STAGGER RESISTANCE

```text
weightResistance = totalWeight / (totalWeight + 1000)
```

Used in stagger calculations.

---

# FLIGHT LOAD CHECK

```text
canFly = totalWeight <= flight.liftCapacity
```

---

# ENERGY SYSTEM

## Generator Stats

```text
energyCapacity
idleEnergyRegen
movingEnergyRegen
flyingEnergyRegen
regenDelay
```

---

## Energy Rules

Energy is continuously consumed.

Energy regenerates only after delay:

```text
if (currentTime - lastEnergyUseTime >= regenDelay)
```

---

## Energy Regen

```text
finalRegen =
baseRegen
* weightFactor
* heatMultiplier
```

---

## Energy Starvation

If EP ≤ 0:

* no flight
* no energy weapons
* no boosts
* ground movement remains

---

# HEAT SYSTEM

Heat is independent from damage.

Defense never reduces heat.

Only ThermalRegulator affects heat.

---

## Heat Sources

### Weapon fire

```text
currentHeat += weapon.heatPerShot
```

### Incoming heat

```text
targetHeat += weapon.heatDamage * damageTypeMultiplier
```

---

# HEAT STATES

```text
NORMAL
HOT
CRITICAL
DANGER
OVERHEAT
```

Overheat disables:

* weapons
* flight
* energy regen

Recovery:

```text
currentHeat <= maxHeat * 0.25
```

---

# THERMAL REGULATOR

```text
maxHeat
heatDissipationRate
dissipationDelay
emergencyCoolingRate
heatResistance
```

---

# SUBSYSTEM SYSTEM

Each part is a subsystem.

Integrity ≤ 0:

→ subsystem OFFLINE

Offline systems provide no bonuses.

Subsystem failure affects gameplay immediately.

---

# STAGGER SYSTEM

```text
impactForce = damage * weaponImpactMultiplier

staggerResistance =
(totalWeight * 0.6) +
(arms.stability * 40) +
(movement.stability * 60)
```

---

# COMPUTER SYSTEM

## Stats

```text
bootUpTime
shutDownTime
processorSpeed
nodeCapacity
chipSlots
```

---

# WEAPON SYSTEM

## Core Stats

```text
weight
damage
accuracy
rateOfFire
projectilesPerShot
spread
heatPerShot
heatDamage
energyCost
ammoCost
reloadTime
recoil
stability
damageType
```

---

# LOCK SYSTEM

```text
lockIntegrity = 0–100
```

Missiles require:

```text
lockIntegrity >= 100
```

---

# AUDIO SYSTEM

Audio is gameplay-critical.

Audio is semantic and event-driven.

Gameplay systems never reference filenames.

They trigger audio events.

---

# REQUIRED AUDIO BEHAVIOR

If final assets are missing:

Placeholder audio must automatically be used.

Missing audio must never generate runtime errors.

Placeholder audio must support:

* looping
* pitch scaling
* volume scaling
* fade in
* fade out

---

# MOVEMENT AUDIO EVENTS

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

# MOBILITY AUDIO PROFILES

## Wheels

```text
wheel_idle
wheel_roll
wheel_accelerate
wheel_brake
wheel_skid
```

---

## Treads

```text
tread_idle
tread_roll
tread_turn
tread_brake
```

---

## Hover

```text
hover_idle
hover_move
hover_strafe
hover_boost
```

---

## Walker

```text
servo_idle
servo_step
servo_turn
servo_jump
```

---

## Flight

```text
thruster_start
thruster_loop
thruster_stop
```

---

# ENTITY SYSTEM

Modules:

```text
Identity
Transform
Combat
Systems
Locomotion
Sensors
Decision
Audio
State
```

---

# MASTER UPDATE ORDER

```text
1. Input
2. Sensors
3. Targeting
4. AI decisions
5. Movement
6. Weapon firing
7. Combat resolution
8. Heat update
9. Energy update
10. Subsystem updates
11. Status effects
12. Audio
13. Rendering
```

---

# AI SYSTEM (UTILITY AI)

Actions:

* Attack
* Retreat
* Advance
* CoolDown
* Reload
* SwitchWeapon
* BreakLock
* TargetSubsystem

Each action receives a score.

Highest score wins.

---
