# Advanced Targeting Backlog

Last reviewed: 2026-07-18  
Source: Deferred work extracted from the legacy implementation roadmap

## Purpose

This file preserves advanced targeting work without allowing it to displace the playable-demo loop.

The current target-lock, lock-audio, target-layout, and subsystem-selection systems must first be tested during the fresh baseline.

Only promote an item into `docs/ROADMAP.md` when:

- A baseline defect makes it necessary
- The demo requires it
- Its dependencies are verified
- The expected player benefit justifies the implementation cost

---

## Verification Items

These features appear implemented but require a fresh playtest.

### T-V1 Lock Audio and Cockpit Guidance

Status: Implemented, Needs Verification  
Legacy ticket: 21

Verify:

- Lockable target presence tone
- Alignment or bullseye guidance
- Stereo direction behavior
- Milestone cues
- Full-lock cue
- Loss and reacquisition behavior
- No obsolete duplicate chirps
- No excessive competing speech

Demo priority:

High only if current targeting is not usable without sight.

### T-V2 Directional Subsystem Selection

Status: Implemented, Needs Verification  
Legacy ticket: 24

Verify:

- Alt or current modifier behavior
- Bronze lock blocks subsystem navigation
- Silver or higher permits navigation
- Directional navigation follows target layout
- Target changes select a valid default
- Invalid selections fall back
- Controls do not conflict with movement or menu focus
- Selected subsystem is exposed in diagnostics

Demo priority:

Medium. Basic combat can remain demo-ready without every advanced subsystem feature if current behavior is stable and understandable.

---

## Deferred Feature T-1: Lock Memory Bandwidth

Legacy ticket: 22  
Status: Deferred

### Desired outcome

A computer part can retain partial lock progress for more than one target.

### Proposed data

- `memoryBandwidth`
- Remembered target ID
- Retained lock progress
- Last update time
- Decay state
- Bandwidth cost

### Rules to preserve

- Each remembered target consumes bandwidth.
- When capacity is exceeded, discard the weakest or least valuable remembered lock according to an explicit deterministic policy.
- Destroyed or removed targets release memory.
- Remembered locks decay.
- Switching weapons must not accidentally create duplicate memory entries.

### Risks

- Increased state and UI complexity
- Additional audio communication burden
- Harder multi-target debugging
- Potential conflict with retarget penalties
- Potential network-state expansion later

### Promotion criteria

Promote only after ordinary target switching is verified and the demo has encounters where multi-target memory provides meaningful value.

---

## Deferred Feature T-2: Internal Exposure and Core Breach

Legacy ticket: 25  
Status: Deferred

### Desired outcome

Destroying an outer protective node exposes defined internal subsystems through the target layout.

Potential internal nodes include:

- Computer
- Generator
- Thermal regulator
- Engine or mobility internals

### Required design decisions before implementation

- Which outer node exposes which internals?
- Can internals be damaged by splash before exposure?
- Does repaired or restored armor hide internals again?
- What does Core destruction mean for each entity type?
- Which bonuses are removed?
- Can an entity remain alive with a destroyed Core?
- How does fallback selection behave when the selected internal becomes hidden?

### Technical direction

Use `target-layout.ts` topology and explicit exposure rules.

Do not implement exposure through enemy-type conditionals scattered through combat code.

### Promotion criteria

Promote when subsystem targeting is verified and the demo requires layered armor as a core combat teaching moment.

---

## Deferred Feature T-3: Lock-Stage Combat Compensation

Legacy ticket: 26  
Status: Deferred

### Desired outcome

Lock refinement directly changes direct-fire accuracy and subsystem reliability.

### Legacy intent

#### Bronze

- Full spread
- No compensation
- Core or center-mass routing according to existing rules

#### Silver

- Partial spread compensation
- Partial subsystem bias

#### Gold

- Strong recoil or spread compensation
- Strong subsystem bias

#### Platinum

- Guaranteed selected-subsystem hit for eligible non-missile direct-fire weapons

Missiles continue to use blast routing.

### Required design decisions

- Exact compensation formulas
- Weapon-specific exceptions
- Interaction with authored weapon accuracy
- Interaction with movement, target velocity, ECM, and cover
- Whether Platinum guarantee remains appropriate for all direct-fire weapons

### Promotion criteria

Promote only after current hit routing is audited and automated statistical tests can verify the effect.

---

## Deferred Feature T-4: Subsystem Retarget Penalty

Legacy ticket: 27  
Status: Deferred

### Desired outcome

Changing selected subsystem reduces lock refinement and makes target analysis tactical.

### Legacy rule

```text
Platinum -> Gold
Gold -> Silver
Silver -> Bronze
Bronze -> Bronze
```

### Required behavior

- Target remains selected.
- New subsystem remains selected.
- Lock stage decreases exactly once per valid selection change.
- Invalid navigation does not apply a penalty.
- Repeated key events do not apply duplicate penalties.
- Active-lock loss continues to use retention and decay rules.

### Promotion criteria

Promote after directional subsystem selection and lock-stage accuracy are verified.

---

## Deferred Feature T-5: Remove Legacy Random Subsystem Damage

Legacy ticket: 28  
Status: Deferred pending audit

### Desired outcome

All subsystem damage uses explicit, explainable routing.

Potential routes:

- Bronze core or center-mass routing
- Selected subsystem routing
- Platinum guaranteed routing
- Layout-topology-based splash
- Explicit fallback routing

### Audit required

Before implementation, search for:

- Random subsystem selection
- Unseeded damage-routing randomness
- Enemy-specific direct subsystem mutation
- Splash code bypassing the target layout
- Duplicate core routing
- Damage applied outside the combat ECS path

### Risks

This work may be partly complete already. A blind rewrite could break functioning damage, missiles, explosions, or enemy-specific behavior.

### Promotion criteria

Promote if the audit finds unexplained random routing that creates inconsistent or inaccessible combat outcomes.

---

## Backlog Testing Requirements

Advanced targeting work should include:

- Fixed-seed or deterministic tests where randomness is involved
- Statistical tests for spread and bias when exact results vary
- Target-layout tests
- Lock-state transition tests
- Audio transition tests where practical
- Manual screen-reader and audio-only playtests
- Multi-target regression tests
- No visual-only status requirement

---

# End of advanced-targeting.md
