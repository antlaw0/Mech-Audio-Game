import { HALF_FOV } from './constants.js'
import { hasLineOfSight } from './audio-utils.js'
import type { Player, TargetLockState, TankRender } from './types.js'

export function createTargetLockState(): TargetLockState {
  return {
    lockedTankId: null
  } // end object target lock state
} // end function createTargetLockState

export interface TargetLockUpdate {
  /** Transitioned from no-lock → locked this frame. */
  justLocked: boolean
  /** Transitioned from locked → no-lock this frame (obstacle / out of range). */
  justLost: boolean
  /** Lock jumped from one tank to a different tank this frame. */
  switchedTarget: boolean
  /** The currently locked TankRender, or null if not locked. */
  lockedTank: TankRender | null
} // end interface TargetLockUpdate

/**
 * Evaluates which tank (if any) the player should be locked onto this frame.
 *
 * Lock criteria — tank must be:
 *  1. Alive
 *  2. Within `lockOnRange` world units
 *  3. Within the player's horizontal field of view
 *  4. Unobstructed by walls (line-of-sight check)
 *
 * When multiple tanks qualify the closest one is chosen.
 */
export function updateTargetLock(
  state: TargetLockState,
  player: Player,
  tanks: TankRender[],
  mapData: Uint8Array,
  lockOnRange: number,
  lockOnWindowWidthPercent = 100,
  lockOnWindowHeightPercent = 100
): TargetLockUpdate {
  const previousLockedId = state.lockedTankId

  let bestTank: TankRender | null = null
  let bestDist = Number.POSITIVE_INFINITY

  for (const tank of tanks) {
    if (!tank.alive) {
      continue
    } // end if tank not alive

    const dx = tank.x - player.x
    const dy = tank.y - player.y
    const dist = Math.hypot(dx, dy)

    if (dist > lockOnRange) {
      continue
    } // end if out of weapon range

    // Horizontal field-of-view check with lock-on window restriction.
    const bearing = Math.atan2(dy, dx)
    let angleDelta = bearing - player.angle
    while (angleDelta > Math.PI) {
      angleDelta -= 2 * Math.PI
    } // end while normalize positive overshoot
    while (angleDelta < -Math.PI) {
      angleDelta += 2 * Math.PI
    } // end while normalize negative overshoot
    const maxHorizontalAngle = HALF_FOV * (lockOnWindowWidthPercent / 100)
    if (Math.abs(angleDelta) > maxHorizontalAngle) {
      continue
    } // end if target not within horizontal lock-on window

    // Vertical lock-on window check based on pitch.
    const MAX_LOOK_PITCH = 0.7 // from constants.ts
    const maxVerticalPitch = MAX_LOOK_PITCH * (lockOnWindowHeightPercent / 100)
    if (Math.abs(player.pitch) > maxVerticalPitch) {
      continue
    } // end if player pitch outside lock-on window

    // Wall line-of-sight check.
    if (!hasLineOfSight(mapData, { x: player.x, y: player.y }, { x: tank.x, y: tank.y })) {
      continue
    } // end if wall blocking view

    if (dist < bestDist) {
      bestDist = dist
      bestTank = tank
    } // end if closer than current best
  } // end for each tank

  const newLockedId = bestTank !== null ? bestTank.id : null
  state.lockedTankId = newLockedId

  const justLocked = previousLockedId === null && newLockedId !== null
  const justLost = previousLockedId !== null && newLockedId === null
  const switchedTarget =
    previousLockedId !== null &&
    newLockedId !== null &&
    previousLockedId !== newLockedId

  return { justLocked, justLost, switchedTarget, lockedTank: bestTank }
} // end function updateTargetLock
