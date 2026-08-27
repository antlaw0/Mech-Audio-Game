# Mech Audio Game: Current Project State

Last document review: 2026-08-27
Target branch: `dev`  
Repository: `https://github.com/antlaw0/Mech-Audio-Game`

## Important status note

This file begins from a repository audit and the developer's recollection that most gameplay and the garage were working.

It is **not yet a fresh local playtest record**.

Until the return-to-development smoke test is completed, systems should be described as:

- Implemented in source
- Reported working previously
- Awaiting current verification

Do not silently promote an item to Verified Working without recording the date, branch, commit, and test result.

---

## 1. Status Vocabulary

Use only these status labels.

### Verified Working

The behavior was manually tested on the recorded commit and met its acceptance criteria.

### Automated Checks Passed

Relevant automated checks passed, but the feature may still require gameplay verification.

### Implemented, Needs Verification

The code exists and appears integrated, but a current focused playtest has not confirmed behavior.

### Partially Implemented

Some required behavior exists, but the feature is incomplete.

### Broken

The behavior was reproduced and does not meet its requirements.

### Not Implemented

No complete implementation exists.

### Deferred

The work is intentionally postponed.

### Unknown

The current repository audit did not provide enough evidence.

---

## 2. Baseline Record

Complete this section before beginning major feature work.

```text
Audit date:
Branch:
Commit:
Node version:
npm version:
Operating system:
Browser and version:
Audio output:
Assistive technology:
```

### Baseline commands

```text
git status
git branch --show-current
git rev-parse HEAD
node --version
npm --version
npm ci
npm run verify
npm run dev:playtest
```

### Automated results

| Check | Status | Notes |
|---|---|---|
| Dependency installation | Automated Checks Passed | Passed with `npm ci` in the isolated baseline-development checkout; rerun on the integrated Windows `dev` commit |
| Clean workspace build | Automated Checks Passed | `npm run verify` removes generated output and builds shared, client, then server in dependency order |
| Authored-data validation | Automated Checks Passed | Parts catalog, item definitions, and loot-table references are checked without modifying source data |
| Focused regression suite | Automated Checks Passed | 30 tests passed on the baseline-development branch |
| Client startup | Not run for return audit | |
| Server startup | Not run for return audit | |

---

## 3. Repository Architecture

| Area | Current status | Notes |
|---|---|---|
| TypeScript monorepo | Implemented, Needs Verification | npm workspaces with client, server, and shared packages |
| Test-map runtime | Implemented, Needs Verification | Primary gameplay runtime under `packages/client/src/test-map` |
| Three.js renderer | Implemented, Needs Verification | Active test-map rendering path |
| Web Audio, Tone.js, Resonance Audio | Implemented, Needs Verification | Major audio systems are present |
| WebSocket server scaffold | Implemented, Needs Verification | Not required for the first local demo |
| Colyseus server scaffold | Implemented, Needs Verification | Deferred for current demo work |
| Shared types and schemas | Implemented, Needs Verification | Used by client and server paths |
| Repository map | Partially Implemented | `docs/repo-map.md` exists but should be regenerated and checked |
| Generated dependency summary | Broken or stale | Previous generated summary reported no source files |

---

## 4. Gameplay Systems

### Player movement and mobility

| Behavior | Status | Return-audit test |
|---|---|---|
| Ground movement | Implemented, Needs Verification | Move, reverse, strafe, and turn |
| Collision blocking | Implemented, Needs Verification | Test walls, obstacles, and boundaries |
| Multiple mobility archetypes | Implemented, Needs Verification | Equip or force representative movement parts |
| Weight effects | Implemented, Needs Verification | Compare light, normal, and overloaded states |
| Ground `ratedLoad` ownership | Implemented, Needs Verification | Confirm equipped movement part controls ground capacity |
| Flight and lift restriction | Implemented, Needs Verification | Test valid and overweight takeoff |
| Melee homing dash | Implemented, Needs Verification | Test target and no-target flows |

### Resources and subsystem state

| Behavior | Status | Return-audit test |
|---|---|---|
| Heat generation | Implemented, Needs Verification | Fire repeatedly and take damage |
| Passive cooling | Implemented, Needs Verification | Confirm thermal subsystem dependency |
| Heat states | Implemented, Needs Verification | Cross each threshold |
| Overheat shutdown | Implemented, Needs Verification | Confirm weapons, boost, and flight restrictions |
| Energy consumption | Implemented, Needs Verification | Test active drains |
| Regeneration delay and calculation | Implemented, Needs Verification | Stop energy use and observe recovery |
| Energy starvation | Implemented, Needs Verification | Reach zero energy and test allowed actions |
| Subsystem integrity | Implemented, Needs Verification | Damage a part to zero |
| Offline subsystem effects | Implemented, Needs Verification | Confirm functionality and bonuses are removed |

### Combat

| Behavior | Status | Return-audit test |
|---|---|---|
| Direct-fire weapons | Implemented, Needs Verification | Test each equipped weapon |
| Melee | Implemented, Needs Verification | Test hit, miss, dash, and recovery |
| Enemy combat ECS | Implemented, Needs Verification | Spawn several enemy types |
| Player damage | Implemented, Needs Verification | Confirm core and subsystem effects |
| Explosions | Implemented, Needs Verification | Test center and edge falloff |
| Explosion terrain shielding | Implemented, Needs Verification | Test wall, pillar, tree, and rock |
| Missile guidance | Implemented, Needs Verification | Test player and hostile missiles |
| Incoming missile warnings | Implemented, Needs Verification | Test priority, escalation, loss, and handoff |
| Friendly-fire policy | Incomplete for open world | Current generic explosion path does not yet use faction relationships |

### Targeting

| Behavior | Status | Return-audit test |
|---|---|---|
| Target acquisition | Implemented, Needs Verification | Multiple targets and hysteresis |
| Continuous lock progression | Implemented, Needs Verification | Stationary and moving targets |
| Lock audio guidance | Implemented, Needs Verification | Presence, alignment, milestones, and full lock |
| Target layouts | Implemented, Needs Verification | Mech, tank, helicopter, APC, and drone layouts |
| Directional subsystem selection | Implemented, Needs Verification | Bronze block and Silver-or-higher navigation |
| Lock memory bandwidth | Deferred | See `docs/backlog/advanced-targeting.md` |
| Internal exposure after armor destruction | Deferred | See targeting backlog |
| Lock-stage combat compensation | Deferred | See targeting backlog |
| Retarget penalty | Deferred | See targeting backlog |
| Removal of all legacy random routing | Deferred | See targeting backlog |

---

## 5. Audio and Accessibility Systems

| Behavior | Status | Return-audit test |
|---|---|---|
| Spatial positioning | Implemented, Needs Verification | Front, rear, left, right, near, and far |
| Elevation communication | Implemented, Needs Verification | Ground and airborne emitters |
| Audio occlusion | Implemented, Needs Verification | Compare clear and blocked sources |
| Movement audio | Implemented, Needs Verification | Start, loop, turn, stop, and mobility variation |
| Weapon audio | Implemented, Needs Verification | Test each weapon |
| Missile audio | Implemented, Needs Verification | Launch, flight, flyby, and explosion |
| Navigation audio | Implemented, Needs Verification | Select and approach points of interest |
| Accessibility mode manager | Implemented, Needs Verification | Confirm intended mode behavior |
| Keyboard focus protection | Implemented, Needs Verification | Type in every editable control |
| Screen-reader-friendly HTML UI | Partially Implemented | Existing UI needs a structured player-facing redesign |
| Player-requested status summary | Unknown | Confirm current commands and speech paths |
| Developer speech/debug dump | Implemented, Needs Verification | Test F-key or console actions |

---

## 6. Inventory, Loot, Garage, and Persistence

| Behavior | Status | Return-audit test |
|---|---|---|
| Item definitions | Implemented, Needs Verification | Validate representative items |
| Inventory manager | Implemented, Needs Verification | Add, remove, stack, and capacity behavior |
| Loot tables | Implemented, Needs Verification | Generate deterministic or repeatable samples |
| Pickups | Implemented, Needs Verification | Detect, collect, and remove |
| Loot containers | Implemented or partially integrated, Needs Verification | Open, collect, and persist |
| World-item persistence | Implemented, Needs Verification | Leave chunk, return, and reload |
| Parts catalog | Implemented, Needs Verification | Confirm source catalog loads |
| Garage store | Reported working, Needs Verification | Equip, unequip, compare, and save |
| Garage UI | Reported working, Needs Verification | Full keyboard and screen-reader pass |
| Garage location restriction | Not Implemented | Garage currently lives in pause/developer UI |
| Buy and sell | Not Implemented | Required for demo |
| Currency | Not Implemented or Unknown | Establish during shop ticket |

---

## 7. World and Content

| Behavior | Status | Notes |
|---|---|---|
| Static scene layout | Implemented, Needs Verification | Current test world and points of interest |
| World streaming | Implemented, Needs Verification | Chunk lifecycle and diagnostics |
| Frame-budgeted scheduler | Implemented, Needs Verification | Check performance telemetry |
| World map overlay | Implemented, Needs Verification | F2 behavior was previously awaiting approval |
| Enemy archetypes | Implemented, Needs Verification | Brute, Bruiser, Striker, Tank, Helicopter, and test dummy files exist |
| Friendly entities | Not Implemented as a complete world system | |
| Neutral entities | Not Implemented as a complete world system | |
| Faction relationships | Not Implemented | Required before broader population |
| Facility access points | Not Implemented | Garage is first target |
| Shops | Not Implemented | |
| Mission system | Not Implemented | |
| Mission objectives | Not Implemented | |
| Data-driven spawn zones | Not Implemented or Unknown | |
| Demo outpost | Not Implemented | |
| Enemy base objective area | Not Implemented as a complete demo location | |
| Complete playable demo loop | Not Implemented | |

---

## 8. UI State

### Current condition

The current pause interface mixes player-facing and developer-only functions.

Existing or previously described pause areas include:

- Runtime statistics
- Event log
- Diagnostics
- Live tuning
- Inventory
- Garage
- Controls

### Required separation

#### Player pause menu

- Mech Status
- Loadout
- Inventory and Cargo
- Map and Objectives
- Controls and Accessibility
- Options

#### Contextual facilities

- Garage
- Shop
- Mission terminal
- Repair point

#### Developer tools

- Runtime statistics
- Event log
- Diagnostics
- Live tuning
- Editors
- Spawn and state mutation
- Trace export
- Developer console

### Current UI blockers

| Blocker | Status |
|---|---|
| No dedicated player-facing pause shell | Not Implemented |
| No organized authoritative Mech Status view | Not Implemented |
| Developer tabs appear as ordinary pause content | Needs redesign |
| Garage is globally available through pause | Needs relocation |
| Objectives do not have a player-facing home | Not Implemented |
| Facility interaction pattern does not exist | Not Implemented |

---

## 9. Developer Experience

| Tool | Status | Notes |
|---|---|---|
| Developer console | Implemented, Needs Verification | Many inspection and mutation commands |
| Runtime debug overlay | Implemented, Needs Verification | Includes performance and gameplay values |
| Event log | Implemented, Needs Verification | |
| Live tuning | Implemented, Needs Verification | |
| Frame scheduler diagnostics | Implemented, Needs Verification | |
| Fixed-seed debug scenarios | Not Implemented | High value for reducing setup time |
| One-command `npm run verify` | Not Implemented | Current baseline is separate typecheck and build |
| Automated gameplay-system tests | Not Implemented or minimal | Begin with pure systems |
| Exportable diagnostic report | Not Implemented | High value for AI-assisted debugging |
| Current repository dependency map | Partially Implemented | Regeneration tooling should be fixed |
| GitHub Copilot repository instructions | Added by documentation package | Verify Copilot references the file |
| Reusable Copilot prompt files | Added by documentation package | Prompt files may need to be enabled in VS Code |

---

## 10. Demo Blockers

These are the current high-level blockers to a playable demo.

1. A fresh local baseline has not been recorded.
2. The pause interface is not yet a player-facing product interface.
3. The player lacks a clear, authoritative Mech Status screen.
4. Garage access is not connected to a world location.
5. No common world interaction or facility-access system exists.
6. No faction relationship system exists.
7. No minimal mission state and objective loop exists.
8. No shop and currency loop exists.
9. No intentionally scoped demo region connects all systems.
10. Automated verification is too limited to support rapid safe iteration.
11. Runtime orchestration remains concentrated in `main.ts`.

---

## 11. Return-to-Development Smoke Test

Record each item as Pass, Broken, Uncertain, or Not Implemented.

### Startup

- [ ] Clean dependency installation succeeds.
- [ ] Type checking succeeds.
- [ ] Workspace build succeeds.
- [ ] Playtest stack starts.
- [ ] Test map loads without a blocking console error.
- [ ] Audio can be initialized.
- [ ] Pause and resume work.

### Movement

- [ ] Forward and reverse movement work.
- [ ] Strafe works when supported.
- [ ] Turning works.
- [ ] Collision prevents invalid movement.
- [ ] Ground mobility uses current movement-part values.
- [ ] Flight works when allowed.
- [ ] Overweight flight is blocked.

### Combat

- [ ] Each player weapon fires.
- [ ] Melee works.
- [ ] Enemies can be spawned or encountered.
- [ ] Enemies attack.
- [ ] Player damage is applied.
- [ ] Enemy damage is applied.
- [ ] Heat and energy react correctly.
- [ ] Overheat and starvation restrictions work.

### Targeting and missiles

- [ ] Target acquisition is stable.
- [ ] Lock progression changes with aim.
- [ ] Lock audio is understandable.
- [ ] Subsystem selection works at the correct lock stage.
- [ ] Hostile missile warnings escalate and clear.
- [ ] Player and hostile missile guidance works.
- [ ] Terrain affects explosion exposure.

### Inventory and garage

- [ ] Pickups can be collected.
- [ ] Inventory reflects collection.
- [ ] Containers work.
- [ ] Inventory persists as expected.
- [ ] Garage opens.
- [ ] Parts can be equipped and unequipped.
- [ ] Resolved stats update.
- [ ] Ground `ratedLoad` remains authoritative.
- [ ] Garage state persists as expected.

### World and UI

- [ ] World streaming transitions do not break gameplay.
- [ ] Navigation points of interest work.
- [ ] World map overlay works.
- [ ] Developer overlay works.
- [ ] Developer console works.
- [ ] Editable controls suppress gameplay hotkeys.
- [ ] Tab and Shift+Tab remain inside the correct active UI.
- [ ] Closing a UI restores logical focus.

---

## 12. Audit Findings

Use this section during the first return session.

### Confirmed working

- None recorded for the new baseline yet.

### Broken

- None recorded for the new baseline yet.

### Uncertain

- All implemented systems remain uncertain until the new baseline pass.

### Newly discovered defects

Add one entry per defect:

```text
ID:
Title:
Status:
Reproduction:
Expected:
Actual:
Likely owner:
Severity:
Demo blocker:
Evidence:
```

---

## 13. Update Rules

Update this document when:

- A feature is manually verified.
- A defect is reproduced.
- A roadmap ticket is completed.
- A source-of-truth location changes.
- A system moves between Implemented, Broken, Deferred, and Verified Working.
- A baseline commit changes.

Do not turn this file into a chronological diary. Keep only the current truth and link to commits or archived notes when historical detail matters.

---

# End of CURRENT_STATE.md
