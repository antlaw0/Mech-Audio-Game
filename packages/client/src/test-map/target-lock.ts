import { HALF_FOV, MAX_LOOK_PITCH, PLAYER_HEIGHT } from './constants.js'
import { hasWorldLineOfSight3D, type WorldCollisionWorld } from './world-collision.js'
import type { Player, TargetLockState, TargetableEnemyRender } from './types.js'

const TARGET_LOCK_HYSTERESIS_THRESHOLD = 0.08
const BASE_LOCK_REFINEMENT_RATE = 12
const BASE_LOCK_DECAY_PER_SECOND = 21
const LOCK_MAX_PROGRESS = 100
const ECM_INTERFERENCE_MIN_OBSTRUCTION = 0.0001
const LOCK_AIM_RATE_EXPONENT = 2

const LOCK_LEVEL_CAP_PROGRESS: Readonly<Record<LockLevel, number>> = {
  Bronze: 24,
  Silver: 59,
  Gold: 84,
  Platinum: 100
}

export type LockLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'

export interface TargetLockModifiers {
  deltaSeconds: number
  headLockAcquisition: number
  headTrackingStability: number
  computerProcessorSpeed: number
  computerLockRetention: number
  chipLockMultiplier: number
  ecmResistance: number
  maxLockLevel: LockLevel
  lockGainMultiplier: number
}

export type LockableTarget = TargetableEnemyRender & {
  velocityX?: number
  velocityY?: number
  ecmObstruction?: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function clampPositive(value: number, fallback = 1): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return value
}

function getMaxProgressForLevel(level: LockLevel): number {
  return LOCK_LEVEL_CAP_PROGRESS[level] ?? LOCK_MAX_PROGRESS
}

function getResolvedModifiers(input?: Partial<TargetLockModifiers>): TargetLockModifiers {
  return {
    deltaSeconds: Math.max(0, input?.deltaSeconds ?? 0),
    headLockAcquisition: clampPositive(input?.headLockAcquisition ?? 1, 1),
    headTrackingStability: clampPositive(input?.headTrackingStability ?? 1, 1),
    computerProcessorSpeed: clampPositive(input?.computerProcessorSpeed ?? 1, 1),
    computerLockRetention: clampPositive(input?.computerLockRetention ?? 1, 1),
    chipLockMultiplier: clampPositive(input?.chipLockMultiplier ?? 1, 1),
    ecmResistance: clampPositive(input?.ecmResistance ?? 1, 1),
    maxLockLevel: input?.maxLockLevel ?? 'Platinum',
    lockGainMultiplier: clampPositive(input?.lockGainMultiplier ?? 1, 1)
  }
}

function getTargetMovementPenalty(target: LockableTarget): number {
  const speed = Math.hypot(target.velocityX ?? 0, target.velocityY ?? 0)
  return clamp01(1 - Math.min(1, speed / 9))
}

function computeLockRefinementPerSecond(
  lockRateMultiplier: number,
  distanceFactor: number,
  stabilityFactor: number,
  targetEcmResistanceFactor: number,
  modifiers: TargetLockModifiers
): number {
  const systemMultiplier =
    modifiers.headLockAcquisition
    * modifiers.computerProcessorSpeed
    * modifiers.chipLockMultiplier
    * modifiers.lockGainMultiplier
    * targetEcmResistanceFactor

  return BASE_LOCK_REFINEMENT_RATE
    * systemMultiplier
    * clamp01(lockRateMultiplier)
    * clamp01(distanceFactor)
    * clamp01(stabilityFactor)
}

function computeLockDecayPerSecond(modifiers: TargetLockModifiers): number {
  const retentionMultiplier = Math.max(0.2, modifiers.computerLockRetention * modifiers.chipLockMultiplier)
  return BASE_LOCK_DECAY_PER_SECOND / retentionMultiplier
}

function computeTargetScore(
  player: Player,
  target: LockableTarget,
  lockOnRange: number,
  lockOnWindowWidthPercent: number,
  lockOnWindowHeightPercent: number,
  halfHorizontalFovRadians: number
): {
  score: number
  horizontalAlignment: number
  verticalAlignment: number
  crosshairAlignment: number
  distanceWeight: number
  centerError: number
  horizontalOffset: number
} {
  const dx = target.x - player.x
  const dy = target.y - player.y
  const dist = Math.hypot(dx, dy)
  const playerEyeZ = (player.z ?? 0) + PLAYER_HEIGHT
  const targetCenterZ = target.height + PLAYER_HEIGHT

  const bearing = Math.atan2(dy, dx)
  let angleDelta = bearing - player.angle
  while (angleDelta > Math.PI) {
    angleDelta -= 2 * Math.PI
  } // end while normalize positive overshoot
  while (angleDelta < -Math.PI) {
    angleDelta += 2 * Math.PI
  } // end while normalize negative overshoot

  const maxHorizontalAngle = halfHorizontalFovRadians * (lockOnWindowWidthPercent / 100)
  const horizontalAlignment = maxHorizontalAngle <= 0 ? 0 : clamp01(1 - (Math.abs(angleDelta) / maxHorizontalAngle))

  const desiredPitch = Math.atan2(playerEyeZ - targetCenterZ, Math.max(dist, 0.0001))
  const maxVerticalPitch = MAX_LOOK_PITCH * (lockOnWindowHeightPercent / 100)
  const pitchDelta = desiredPitch - player.pitch
  const verticalAlignment = maxVerticalPitch <= 0 ? 0 : clamp01(1 - (Math.abs(pitchDelta) / maxVerticalPitch))

  // Normalize target position within outer lockbox to [-1, 1] on each axis.
  const normalizedX = maxHorizontalAngle <= 0
    ? 0
    : Math.max(-1, Math.min(1, angleDelta / maxHorizontalAngle))
  const normalizedY = maxVerticalPitch <= 0
    ? 0
    : Math.max(-1, Math.min(1, pitchDelta / maxVerticalPitch))

  const centerDistance = Math.hypot(normalizedX, normalizedY)
  const centerError = clamp01(centerDistance)

  const crosshairAlignment = (horizontalAlignment + verticalAlignment) / 2
  const distanceWeight = clamp01(1 - (dist / Math.max(1, lockOnRange)))
  const targetSizeWeight = clamp01(target.radius / 1.5)

  return {
    score: (crosshairAlignment * 0.5) + (distanceWeight * 0.3) + (targetSizeWeight * 0.2),
    horizontalAlignment,
    verticalAlignment,
    crosshairAlignment,
    distanceWeight,
    centerError,
    horizontalOffset: normalizedX
  }
} // end function computeTargetScore

export function createTargetLockState(): TargetLockState {
  return {
    currentTargetId: null,
    lockProgress: 0,
    targetScore: 0,
    isTargetInLockBox: false,
    centerError: 1,
    horizontalOffset: 0,
    lockRateMultiplier: 0,
    retainedTargetId: null,
    retentionActive: false,
    selectedSubsystem: null
  } // end object target lock state
} // end function createTargetLockState

export interface TargetLockUpdate {
  /** Transitioned from no-lock → locked this frame. */
  justLocked: boolean
  /** Transitioned from locked → no-lock this frame (obstacle / out of range). */
  justLost: boolean
  /** Lock jumped from one tank to a different tank this frame. */
  switchedTarget: boolean
  /** The currently locked combat target, or null if not locked. */
  lockedTarget: TargetableEnemyRender | null
  /** The currently selected tank id, or null if nothing qualifies. */
  currentTargetId: number | null
  /** Instant bronze lock progress for the currently selected target. */
  lockProgress: number
  /** Score for the currently selected target. */
  targetScore: number
  /** Whether a target currently satisfies lock-box eligibility checks. */
  isTargetInLockBox: boolean
  /** Normalized center aiming error where 0 is centered and 1 touches lock-box edge. */
  centerError: number
  /** Horizontal target offset in lock box where -1 is far left and +1 is far right. */
  horizontalOffset: number
  /** Accuracy-based refinement multiplier used for this frame's lock gain. */
  lockRateMultiplier: number
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
  targets: LockableTarget[],
  collisionWorld: WorldCollisionWorld,
  lockOnRange: number,
  lockOnWindowWidthPercent = 100,
  lockOnWindowHeightPercent = 100,
  halfHorizontalFovRadians = HALF_FOV,
  modifiers?: Partial<TargetLockModifiers>
): TargetLockUpdate {
  const resolvedModifiers = getResolvedModifiers(modifiers)
  const previousLockedId = state.currentTargetId
  const previousRetainedId = state.retainedTargetId
  const previousProgress = Math.max(0, Math.min(LOCK_MAX_PROGRESS, state.lockProgress))

  type Candidate = {
    target: LockableTarget
    score: number
    crosshairAlignment: number
    distanceWeight: number
    movementPenalty: number
    centerError: number
    horizontalOffset: number
    ecmResistanceFactor: number
    ecmInterferenceActive: boolean
  }

  let bestCandidate: Candidate | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  let currentCandidate: Candidate | null = null
  let currentScore = Number.NEGATIVE_INFINITY

  for (const target of targets) {
    if (!target.alive) {
      continue
    } // end if target not alive

    const dx = target.x - player.x
    const dy = target.y - player.y
    const dist = Math.hypot(dx, dy)
    const playerEyeZ = (player.z ?? 0) + PLAYER_HEIGHT
    const targetCenterZ = target.height + PLAYER_HEIGHT

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
    const maxHorizontalAngle = halfHorizontalFovRadians * (lockOnWindowWidthPercent / 100)
    if (Math.abs(angleDelta) > maxHorizontalAngle) {
      continue
    } // end if target not within horizontal lock-on window

    // Vertical lock-on window check based on the target elevation relative to the current aim.
    const desiredPitch = Math.atan2(playerEyeZ - targetCenterZ, Math.max(dist, 0.0001))
    const maxVerticalPitch = MAX_LOOK_PITCH * (lockOnWindowHeightPercent / 100)
    const pitchDelta = desiredPitch - player.pitch
    if (Math.abs(pitchDelta) > maxVerticalPitch) {
      continue
    } // end if player pitch outside lock-on window

    // Wall line-of-sight check.
    if (!hasWorldLineOfSight3D(
      collisionWorld,
      { x: player.x, y: player.y, z: playerEyeZ },
      { x: target.x, y: target.y, z: targetCenterZ }
    )) {
      continue
    } // end if wall blocking view

    const scoreData = computeTargetScore(
      player,
      target,
      lockOnRange,
      lockOnWindowWidthPercent,
      lockOnWindowHeightPercent,
      halfHorizontalFovRadians
    )

    const movementPenalty = getTargetMovementPenalty(target)
    const ecmObstruction = clamp01(target.ecmObstruction ?? 0)
    const ecmResistanceFactor = clamp01(1 - (ecmObstruction * (1 / Math.max(0.0001, resolvedModifiers.ecmResistance))))
    const ecmInterferenceActive = ecmObstruction >= ECM_INTERFERENCE_MIN_OBSTRUCTION

    const candidate: Candidate = {
      target,
      score: scoreData.score,
      crosshairAlignment: scoreData.crosshairAlignment,
      distanceWeight: scoreData.distanceWeight,
      movementPenalty,
      centerError: scoreData.centerError,
      horizontalOffset: scoreData.horizontalOffset,
      ecmResistanceFactor,
      ecmInterferenceActive
    }

    if (target.id === previousLockedId) {
      currentCandidate = candidate
      currentScore = scoreData.score
    }

    if (scoreData.score > bestScore) {
      bestScore = scoreData.score
      bestCandidate = candidate
    } // end if better than current best
  } // end for each target

  let selectedCandidate = currentCandidate
  let selectedScore = currentScore

  if (selectedCandidate === null) {
    selectedCandidate = bestCandidate
    selectedScore = bestScore
  } else if (bestCandidate !== null && bestCandidate.target.id !== selectedCandidate.target.id) {
    if (bestScore > selectedScore + TARGET_LOCK_HYSTERESIS_THRESHOLD) {
      selectedCandidate = bestCandidate
      selectedScore = bestScore
    }
  }

  const selectedTarget = selectedCandidate?.target ?? null
  const newLockedId = selectedTarget !== null ? selectedTarget.id : null
  const hasLock = newLockedId !== null
  const resolvedScore = Number.isFinite(selectedScore) ? Math.max(0, selectedScore) : 0
  const centerError = clamp01(selectedCandidate?.centerError ?? 1)
  const horizontalOffset = Math.max(-1, Math.min(1, selectedCandidate?.horizontalOffset ?? 0))
  const lockRateMultiplier = Math.pow(1 - centerError, LOCK_AIM_RATE_EXPONENT)

  const modifierMaxProgress = getMaxProgressForLevel(resolvedModifiers.maxLockLevel)
  let nextProgress = 0

  if (selectedCandidate) {
    const targetMaxProgress = selectedCandidate.ecmInterferenceActive
      ? Math.min(modifierMaxProgress, getMaxProgressForLevel('Bronze'))
      : modifierMaxProgress
    const canResumeRetained = previousLockedId === null && previousRetainedId === selectedCandidate.target.id
    const startsFromPreviousTarget = previousLockedId === selectedCandidate.target.id || canResumeRetained
    const baseProgress = startsFromPreviousTarget ? previousProgress : 0
    const trackingStabilityFactor = clamp01(Math.min(1.5, resolvedModifiers.headTrackingStability) / 1.2)
    const stabilityFactor = clamp01((selectedCandidate.movementPenalty * 0.8) + (trackingStabilityFactor * 0.2))
    const refinementRate = computeLockRefinementPerSecond(
      lockRateMultiplier,
      selectedCandidate.distanceWeight,
      stabilityFactor,
      selectedCandidate.ecmResistanceFactor,
      resolvedModifiers
    )

    nextProgress = Math.min(targetMaxProgress, baseProgress + (refinementRate * resolvedModifiers.deltaSeconds))

    state.retainedTargetId = newLockedId
    state.retentionActive = false
  } else {
    const retainedTargetId = previousLockedId ?? previousRetainedId
    if (retainedTargetId !== null && previousProgress > 0) {
      const decayPerSecond = computeLockDecayPerSecond(resolvedModifiers)
      nextProgress = Math.max(0, previousProgress - (decayPerSecond * resolvedModifiers.deltaSeconds))
      state.retainedTargetId = nextProgress > 0 ? retainedTargetId : null
      state.retentionActive = nextProgress > 0
    } else {
      nextProgress = 0
      state.retainedTargetId = null
      state.retentionActive = false
    }
  }

  state.currentTargetId = newLockedId
  state.lockProgress = Math.max(0, Math.min(modifierMaxProgress, nextProgress))
  state.targetScore = resolvedScore
  state.isTargetInLockBox = hasLock
  state.centerError = centerError
  state.horizontalOffset = horizontalOffset
  state.lockRateMultiplier = hasLock ? lockRateMultiplier : 0

  const justLocked = previousLockedId === null && newLockedId !== null
  const justLost = previousLockedId !== null && newLockedId === null
  const switchedTarget =
    previousLockedId !== null &&
    newLockedId !== null &&
    previousLockedId !== newLockedId

  return {
    justLocked,
    justLost,
    switchedTarget,
    lockedTarget: selectedTarget,
    currentTargetId: newLockedId,
    lockProgress: state.lockProgress,
    targetScore: state.targetScore,
    isTargetInLockBox: state.isTargetInLockBox,
    centerError: state.centerError,
    horizontalOffset: state.horizontalOffset,
    lockRateMultiplier: state.lockRateMultiplier
  }
} // end function updateTargetLock
