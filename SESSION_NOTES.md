# Current Session: Return-to-Development Baseline

Created: 2026-07-18  
Target branch: `dev`  
Roadmap item: D0.2 Fresh Local Baseline

## 1. Session Outcome

Establish the exact current condition of the project before redesigning the pause menu or adding open-world systems.

This session should produce:

- A clean build result
- A completed smoke-test matrix
- Reproduction steps for blocking defects
- An updated `docs/CURRENT_STATE.md`
- A recommended first implementation ticket
- No speculative feature changes

---

## 2. In Scope

- Confirm current branch and working tree
- Record current commit
- Install dependencies
- Run type checking
- Run the workspace build
- Start the full playtest stack
- Test existing major systems
- Record Pass, Broken, Uncertain, or Not Implemented
- Identify demo-blocking defects
- Confirm current pause-menu tabs and garage access
- Confirm developer tools remain usable
- Confirm authoritative `ratedLoad` behavior
- Update current-state documentation

---

## 3. Out of Scope

Do not perform these during the baseline session:

- Redesign the pause menu
- Move the garage
- Refactor `main.ts`
- Add missions
- Add shops
- Add factions
- Add friendly or neutral entities
- Finish deferred targeting tickets
- Retune combat
- Replace frameworks
- Clean up unrelated code
- Change authored part values
- Delete developer tools

A small code fix is allowed only when it is required to make the baseline start and the cause is understood. Record it as a separate focused commit.

---

## 4. Initial Commands

Run from the repository root.

```powershell
git status
git branch --show-current
git rev-parse HEAD
git log -1 --oneline
node --version
npm --version
npm ci
npm run typecheck
npm run build
npm run dev:playtest
```

Expected branch:

```text
dev
```

If the working tree is not clean, record every changed or untracked file before pulling, switching branches, or resetting anything.

Do not discard local work.

---

## 5. Baseline Record

Fill this in.

```text
Date:
Branch:
Commit:
Working tree clean:
Node:
npm:
Windows version:
Browser:
Audio output:
Assistive technology:
```

### Command results

```text
npm ci:
npm run typecheck:
npm run build:
npm run dev:playtest:
```

---

## 6. Smoke-Test Order

Use this order so a startup blocker is discovered before long gameplay testing.

### A. Startup and UI

- Test map loads.
- Audio initialization succeeds.
- Pause opens.
- Pause closes.
- Focus is predictable.
- Runtime overlay opens.
- Developer console opens.
- World map opens.
- No blocking browser-console error appears.

### B. Movement and world

- Forward
- Reverse
- Strafe
- Turn
- Collision
- Current mobility behavior
- Flight
- Overweight flight restriction
- Chunk transition
- Navigation point selection

### C. Combat resources

- Fire each current weapon.
- Perform melee.
- Gain heat.
- Cool heat.
- Reach an elevated heat state.
- Reach overheat if practical.
- Spend energy.
- Regenerate energy.
- Reach zero energy if practical.
- Confirm allowed and blocked actions.

### D. Enemies and targeting

- Spawn or locate several enemy types.
- Acquire a target.
- Move aim across multiple targets.
- Build lock progress.
- Listen to lock guidance.
- Select a subsystem.
- Take damage.
- Destroy an enemy.
- Test hostile missile warning.
- Test missile flight and explosion.

### E. Inventory and garage

- Collect a pickup.
- Open a container.
- Confirm inventory update.
- Open garage through the current path.
- Equip a part.
- Unequip a part.
- Confirm resolved stats change.
- Confirm movement-part `ratedLoad` changes ground capacity.
- Confirm flight lift capacity remains separate.
- Reload and inspect persistence.

### F. Keyboard and accessibility regression

Inside each editable control:

- Type `M`.
- Type `F2` if the control permits function keys.
- Type the developer-console key.
- Press Escape according to the UI's expected behavior.
- Use Tab through all controls.
- Use Shift+Tab back through all controls.
- Confirm gameplay does not move or activate unexpectedly.
- Confirm focus does not jump to an unrelated overlay.

---

## 7. Result Format

For every failure, use:

```text
ID:
Area:
Status:
Title:
Reproduction:
Expected:
Actual:
Frequency:
Blocking:
Likely files:
Console output:
Diagnostic report:
Notes:
```

Do not write only “does not work.”

---

## 8. First UI Inspection Questions

During baseline testing, record:

- What command opens pause?
- Which tabs currently appear?
- Which DOM or controller code owns each tab?
- Which tabs are player-facing?
- Which tabs are developer-only?
- Is Inventory usable independently of Garage?
- How does Garage open and close?
- Where does focus land when Garage opens?
- Where does focus return?
- Which state pauses gameplay?
- Are there multiple independent pause flags?
- Which values already exist for a future Mech Status view?
- Which values are currently recalculated in UI code?
- Which developer tools are essential to preserve?

Do not edit the UI during this inspection.

---

## 9. Completion Criteria

This session is complete when:

- `docs/CURRENT_STATE.md` has the baseline metadata.
- Every major smoke-test area has a result.
- Blocking defects have reproduction steps.
- The current pause and garage behavior is documented.
- The first implementation ticket is selected.
- The working tree changes are understood.
- Documentation changes are committed separately from later feature code.

Suggested commit:

```text
chore: record playable demo baseline
```

---

## 10. Likely Next Session

Roadmap item:

D0.3 One-Command Verification

Possible exception:

If the fresh baseline finds a critical startup or data-loss defect, fix that defect first as a narrowly scoped ticket.

After verification is established, proceed to:

D1.1 Define and Preserve Existing UI Behavior

---

# End of SESSION_NOTES.md
