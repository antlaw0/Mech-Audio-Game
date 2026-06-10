import {
  FOOTSTEP_INTERVAL_SECONDS,
  PLAYER_BOOST_SPEED,
  PLAYER_FLIGHT_SPEED,
  PLAYER_FLIGHT_VERTICAL_SPEED,
  MAX_LOOK_PITCH,
  PITCH_ASSIST_CONFIG,
  MAP_HEIGHT,
  MAP_WIDTH,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  TURN_SPEED
} from './constants.js'
import { AUDIO_CONFIG } from './audio-config.js'
import { normalizeAngle } from './audio-utils.js'
import { getTopSurfaceHeight, isPlayerBlocked, type WorldCollisionWorld, WORLD_WALL_HEIGHT } from './world-collision.js'
import type { AudioController, InputState, Player } from './types.js'

const PLAYER_FALL_GRAVITY = 13.5
const PLAYER_MAX_FALL_SPEED = 11.5
const LANDING_EPSILON = 0.001
const JUMP_ASCENT_SPEED_MIN = 5.8
const JUMP_ASCENT_SPEED_MAX = 11.4
const JUMP_APEX_TRANSITION_SECONDS = 0.62
const AIRBORNE_HOLD_SPRING = 7.5
const AIRBORNE_HOLD_DAMPING = 3.2

export interface UpdateState {
  footstepTimerSeconds: number
  lastBumpTimeSeconds: number
  muzzleFlashTimer: number
  verticalVelocityZ: number
  groundForwardVelocity: number
  groundStrafeVelocity: number
  jumpActive: boolean
  jumpReachedApex: boolean
  jumpApexHangRemainingSeconds: number
  rotorSpinupElapsedSeconds: number
  rotorSpinNormalized: number
  currentPitch: number
  targetPitchVelocity: number
  pitchVelocity: number
  pitchHardRecenterTimeRemainingSeconds: number
  pitchSpringStrength: number
  pitchSpringSuppressed: boolean
  targetElevationOffset: number
} // end interface UpdateState

export interface PitchAssistContext {
  hasTargetLock: boolean
  lockRefiningActive: boolean
  targetElevationOffset: number
} // end interface PitchAssistContext

export interface FlightRuntimeConfig {
  mode: 'jet' | 'rotor'
  rotorCount: number
  spinUpSeconds: number
  maxHorizontalSpeed: number
  stability: number
} // end interface FlightRuntimeConfig

export type MobilityType = 'Wheels' | 'Treads' | 'Hover' | 'Walker' | 'Flight' | 'Placeholder'

export interface MovementArchetypeProfile {
  mobilityType: MobilityType
  groundAcceleration: number
  groundDeceleration: number
  maxForwardSpeed: number
  maxReverseSpeed: number
  maxStrafeSpeed: number
  turnRate: number
  terrainPenaltyMultiplier: number
  energyUse: number
}
export interface UpdateEnvironment {
  player: Player
  input: InputState
  audio: AudioController
  state: UpdateState
  weightFactor: number
  canEngageFlight: boolean
  flightAltitude: number
  flightConfig: FlightRuntimeConfig
  pitchAssistContext?: PitchAssistContext
  collisionWorld: WorldCollisionWorld
  ignorePlayerCollision?: boolean
  movementProfile: MovementArchetypeProfile
  fpsModeEnabled?: boolean
} // end interface UpdateEnvironment

export function createUpdateState(): UpdateState {
  return {
    footstepTimerSeconds: 0,
    lastBumpTimeSeconds: 0,
    muzzleFlashTimer: 0,
    verticalVelocityZ: 0,
    groundForwardVelocity: 0,
    groundStrafeVelocity: 0,
    jumpActive: false,
    jumpReachedApex: false,
    jumpApexHangRemainingSeconds: 0,
    rotorSpinupElapsedSeconds: 0,
    rotorSpinNormalized: 0,
    currentPitch: 0,
    targetPitchVelocity: 0,
    pitchVelocity: 0,
    pitchHardRecenterTimeRemainingSeconds: 0,
    pitchSpringStrength: 0,
    pitchSpringSuppressed: false,
    targetElevationOffset: 0
  } // end object update state
} // end function createUpdateState

function moveToward(current: number, target: number, maxDelta: number): number {
  if (current < target) {
    return Math.min(target, current + maxDelta)
  }
  if (current > target) {
    return Math.max(target, current - maxDelta)
  }
  return target
} // end function moveToward

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
} // end function clamp

function getCriticallyDampedSpringAcceleration(
  position: number,
  velocity: number,
  springStrength: number,
  dampingScale = 1
): number {
  const omega = Math.sqrt(Math.max(0.0001, springStrength))
  const damping = (2 * omega) * Math.max(0.25, dampingScale)
  return (-springStrength * position) - (damping * velocity)
} // end function getCriticallyDampedSpringAcceleration

function isPointInsideZone(
  x: number,
  y: number,
  zone: { colStart: number, rowStart: number, width: number, height: number }
): boolean {
  const colEnd = zone.colStart + zone.width - 1
  const rowEnd = zone.rowStart + zone.height - 1
  return x >= zone.colStart && x <= colEnd && y >= zone.rowStart && y <= rowEnd
} // end function isPointInsideZone

export function updateFrame(environment: UpdateEnvironment, deltaSeconds: number): void {
  if (environment.player.flightState === undefined) {
    environment.player.flightState = 'grounded'
  } // end if flight state is uninitialized
  if (environment.player.isFlying === undefined) {
    environment.player.isFlying = false
  } // end if flight flag is uninitialized
  if (environment.player.z === undefined) {
    environment.player.z = 0
  } // end if altitude is uninitialized
  if (!Number.isFinite(environment.state.verticalVelocityZ)) {
    environment.state.verticalVelocityZ = 0
  } // end if vertical velocity is uninitialized
  if (!Number.isFinite(environment.state.groundForwardVelocity)) {
    environment.state.groundForwardVelocity = 0
  } // end if forward velocity is uninitialized
  if (!Number.isFinite(environment.state.groundStrafeVelocity)) {
    environment.state.groundStrafeVelocity = 0
  } // end if strafe velocity is uninitialized
  if (typeof environment.state.jumpActive !== 'boolean') {
    environment.state.jumpActive = false
  } // end if jump active state is uninitialized
  if (typeof environment.state.jumpReachedApex !== 'boolean') {
    environment.state.jumpReachedApex = false
  } // end if jump apex state is uninitialized
  if (!Number.isFinite(environment.state.jumpApexHangRemainingSeconds)) {
    environment.state.jumpApexHangRemainingSeconds = 0
  } // end if jump apex hang timer is uninitialized

  const movementProfile = environment.movementProfile
  const ignorePlayerCollision = environment.ignorePlayerCollision ?? false
  const fpsModeEnabled = environment.fpsModeEnabled ?? false
  const weightFactor = clamp(environment.weightFactor, 0, 1)
  const flightConfig = environment.flightConfig
  const { input, player, audio, state } = environment
  const moveSpeed = (environment.player.isBoosting ?? false)
    ? PLAYER_BOOST_SPEED
    : environment.player.flightState === 'grounded'
      ? PLAYER_SPEED
      : flightConfig.maxHorizontalSpeed
  const moveAmount = moveSpeed * deltaSeconds
  const maxPitchAngle = Math.min(MAX_LOOK_PITCH, PITCH_ASSIST_CONFIG.maxPitchAngleRadians)
  const maxPitchSpeed = maxPitchAngle / Math.max(0.2, PITCH_ASSIST_CONFIG.maxPitchReachTimeSeconds)
  const pitchAcceleration = Math.max(0.1, PITCH_ASSIST_CONFIG.pitchAccelerationRadiansPerSecondSquared)
  const passiveSpringStrength = Math.pow(4 / Math.max(0.35, PITCH_ASSIST_CONFIG.passiveSpringSettleTimeSeconds), 2)
  const hardRecenterSpringStrength = Math.pow(4 / Math.max(0.2, PITCH_ASSIST_CONFIG.hardRecenterSettleTimeSeconds), 2)
  const pitchAssistContext = environment.pitchAssistContext
  const targetElevationOffset = pitchAssistContext?.targetElevationOffset ?? 0
  const hasSignificantTargetElevation = Math.abs(targetElevationOffset) >= PITCH_ASSIST_CONFIG.significantTargetElevationRadians
  const springSuppressed = !!pitchAssistContext?.hasTargetLock
    || !!pitchAssistContext?.lockRefiningActive
    || hasSignificantTargetElevation
  const springSuppressionMultiplier = springSuppressed
    ? clamp(PITCH_ASSIST_CONFIG.springSuppressedMultiplier, 0.05, 1)
    : 1

  if (!Number.isFinite(state.currentPitch)) {
    state.currentPitch = player.pitch
  } // end if pitch state is uninitialized
  if (!Number.isFinite(state.pitchVelocity)) {
    state.pitchVelocity = 0
  } // end if pitch velocity state is uninitialized
  if (!Number.isFinite(state.targetPitchVelocity)) {
    state.targetPitchVelocity = 0
  } // end if target pitch velocity state is uninitialized
  if (!Number.isFinite(state.pitchHardRecenterTimeRemainingSeconds)) {
    state.pitchHardRecenterTimeRemainingSeconds = 0
  } // end if hard recenter timer state is uninitialized
  const turnInput = fpsModeEnabled ? 0 : ((input.turnRight ? 1 : 0) - (input.turnLeft ? 1 : 0))
  if (turnInput !== 0) {
    const isFlying = player.isFlying || player.flightState === 'ascending' || player.flightState === 'airborne'
    if (isFlying) {
      player.angle += turnInput * TURN_SPEED * deltaSeconds
    } else {
      const mobilityType = movementProfile.mobilityType
      let turnScale = 1

      if (mobilityType === 'Wheels') {
        const speedRatio = Math.min(1, Math.abs(state.groundForwardVelocity) / Math.max(0.1, movementProfile.maxForwardSpeed))
        if (state.groundForwardVelocity === 0) {
          turnScale = 0
        } else {
          turnScale = 0.25 + (speedRatio * 0.75)
        }
      } else if (mobilityType === 'Treads') {
        turnScale = 1
      } else if (mobilityType === 'Hover') {
        turnScale = 0.9
      } else if (mobilityType === 'Flight') {
        turnScale = 0.95
      }

      player.angle += turnInput * movementProfile.turnRate * weightFactor * turnScale * deltaSeconds
    }
  } // end if turn input


  let isMoving = false
  let collided = false
  let movementBlockedByObstacle = false
  let collisionDirection = 0

  if (input.flightTogglePending) {
    input.flightTogglePending = false
    if (player.flightState === 'grounded') {
      if (environment.canEngageFlight) {
        state.jumpActive = false
        state.jumpReachedApex = false
        state.jumpApexHangRemainingSeconds = 0
        state.rotorSpinupElapsedSeconds = 0
        state.rotorSpinNormalized = 0
        player.flightState = 'ascending'
        player.isFlying = true
        if (audio.isAudioStarted()) {
          audio.startFlightLoop({
            flightType: flightConfig.mode,
            rotorCount: flightConfig.rotorCount,
            spinUpSeconds: flightConfig.spinUpSeconds
          })
        } // end if flight loop should start
      } else {
        player.flightState = 'grounded'
        player.isFlying = false
        state.rotorSpinupElapsedSeconds = 0
        state.rotorSpinNormalized = 0
      }
    } else {
      // Cancel boost before descent begins
      if (player.isBoosting) {
        player.isBoosting = false
        if (audio.isAudioStarted()) {
          audio.stopBoostAudio()
        } // end if stopping boost audio on flight exit
      } // end if was boosting
      state.jumpActive = false
      state.jumpReachedApex = false
      state.jumpApexHangRemainingSeconds = 0
      player.flightState = 'descending'
      player.isFlying = true
      if (audio.isAudioStarted()) {
        audio.stopFlightLoop({ quickSpinDown: true })
      } // end if flight loop should stop immediately
    } // end if toggle entering or exiting flight
  } // end if flight toggle requested

  // Toggle boost mode — only permitted while ascending or airborne
  if (input.boostTogglePending) {
    input.boostTogglePending = false
    const canBoost = player.isFlying &&
      (player.flightState === 'ascending' || player.flightState === 'airborne')
    if (canBoost) {
      if (!player.isBoosting) {
        player.isBoosting = true
        if (audio.isAudioStarted()) {
          audio.startBoostAudio()
        } // end if starting boost audio
      } else {
        player.isBoosting = false
        if (audio.isAudioStarted()) {
          audio.stopBoostAudio()
        } // end if stopping boost audio voluntarily
      } // end if toggling boost on or off
    } // end if can boost
  } // end if boost toggle requested

  const minimumCruiseAltitude = WORLD_WALL_HEIGHT + 0.05
  const targetFlightAltitude = Math.max(0, environment.flightAltitude, minimumCruiseAltitude)
  let playerAltitude = player.z ?? 0
  const supportHeight = getTopSurfaceHeight(environment.collisionWorld, player.x, player.y, PLAYER_RADIUS)
  let justLanded = false
  const jumpRequested = input.jumpPending
  input.jumpPending = false

  if (
    jumpRequested
    && !fpsModeEnabled
    && player.flightState === 'grounded'
    && !player.isFlying
    && !state.jumpActive
    && playerAltitude <= supportHeight + LANDING_EPSILON
  ) {
    const initialJumpAscentSpeed = JUMP_ASCENT_SPEED_MIN + ((JUMP_ASCENT_SPEED_MAX - JUMP_ASCENT_SPEED_MIN) * weightFactor)
    state.jumpActive = true
    state.jumpReachedApex = false
    state.jumpApexHangRemainingSeconds = 0
    state.verticalVelocityZ = initialJumpAscentSpeed
    if (audio.isAudioStarted()) {
      audio.playJump()
    } // end if jump cue should play
  } // end if jump started

  if (fpsModeEnabled) {
    // FPS flycam altitude is controlled externally (wheel) and must not trigger flight/fall landing transitions.
    playerAltitude = Math.max(0, playerAltitude)
    state.verticalVelocityZ = 0
    state.jumpActive = false
    state.jumpReachedApex = false
    state.jumpApexHangRemainingSeconds = 0
    player.flightState = 'grounded'
    player.isFlying = false
    state.rotorSpinupElapsedSeconds = 0
    state.rotorSpinNormalized = 0
  } else if (player.flightState === 'ascending') {
    const thrustWeightScale = clamp(0.8 + (weightFactor * 0.9), 0.65, 1.7)
    const rotorStabilityScale = clamp(0.8 + (Math.max(0.6, flightConfig.stability) * 0.35), 0.8, 1.9)
    let thrustAcceleration = 0

    if (flightConfig.mode === 'rotor') {
      const clampedSpinUpSeconds = Math.max(0.4, flightConfig.spinUpSeconds)
      state.rotorSpinupElapsedSeconds = Math.min(clampedSpinUpSeconds, state.rotorSpinupElapsedSeconds + deltaSeconds)
      const takeoffProgress = clamp(state.rotorSpinupElapsedSeconds / clampedSpinUpSeconds, 0, 1)
      state.rotorSpinNormalized = takeoffProgress
      const spinupComplete = takeoffProgress >= 1 - LANDING_EPSILON
      if (spinupComplete) {
        thrustAcceleration = 29 * thrustWeightScale * rotorStabilityScale * (1 + ((flightConfig.rotorCount - 1) * 0.12))
      }
    } else {
      state.rotorSpinNormalized = 1
      thrustAcceleration = 34 * thrustWeightScale
    }

    state.verticalVelocityZ = Math.max(
      -PLAYER_MAX_FALL_SPEED,
      Math.min(
        PLAYER_FLIGHT_VERTICAL_SPEED * 2,
        state.verticalVelocityZ + ((thrustAcceleration - PLAYER_FALL_GRAVITY) * deltaSeconds)
      )
    )
    playerAltitude += state.verticalVelocityZ * deltaSeconds

    if (playerAltitude <= supportHeight + LANDING_EPSILON && state.verticalVelocityZ <= 0) {
      playerAltitude = supportHeight
      state.verticalVelocityZ = 0
    } // end if thrust has not overcome gravity yet

    if (playerAltitude >= targetFlightAltitude - LANDING_EPSILON) {
      player.flightState = 'airborne'
      player.isFlying = true
      if (playerAltitude < targetFlightAltitude) {
        playerAltitude = targetFlightAltitude
      }
      state.verticalVelocityZ = Math.max(0, state.verticalVelocityZ)
      state.rotorSpinNormalized = 1
    } else {
      player.isFlying = true
    }
  } else if (player.flightState === 'airborne') {
    const altitudeError = targetFlightAltitude - playerAltitude
    const holdWeightScale = clamp(0.72 + (weightFactor * 0.82), 0.55, 1.55)
    const holdStabilityScale = flightConfig.mode === 'rotor'
      ? clamp(0.78 + (Math.max(0.6, flightConfig.stability) * 0.22), 0.72, 1.5)
      : 1
    const holdAcceleration = ((altitudeError * AIRBORNE_HOLD_SPRING) - (state.verticalVelocityZ * AIRBORNE_HOLD_DAMPING))
      * holdWeightScale
      * holdStabilityScale

    state.verticalVelocityZ = Math.max(
      -PLAYER_MAX_FALL_SPEED,
      Math.min(PLAYER_FLIGHT_VERTICAL_SPEED * 1.8, state.verticalVelocityZ + (holdAcceleration * deltaSeconds))
    )
    playerAltitude += state.verticalVelocityZ * deltaSeconds

    if (Math.abs(altitudeError) <= 0.03 && Math.abs(state.verticalVelocityZ) <= 0.08) {
      playerAltitude = targetFlightAltitude
      state.verticalVelocityZ = 0
    } // end if altitude converged to shared flight height

    player.isFlying = true
    state.rotorSpinNormalized = 1
  } else {
    const wasDescendingFromFlight = player.flightState === 'descending'
    const jumpAscendingByMomentum = !state.jumpReachedApex
      && playerAltitude > supportHeight + LANDING_EPSILON
      && state.verticalVelocityZ > 0.05
    const jumping = (state.jumpActive || jumpAscendingByMomentum) && !wasDescendingFromFlight

    if (jumping && !state.jumpActive) {
      state.jumpActive = true
    }

    if (jumping && !state.jumpReachedApex && playerAltitude >= targetFlightAltitude - LANDING_EPSILON) {
      playerAltitude = targetFlightAltitude
      state.jumpReachedApex = true
      if (state.jumpApexHangRemainingSeconds <= 0) {
        state.jumpApexHangRemainingSeconds = JUMP_APEX_TRANSITION_SECONDS
      }
      state.verticalVelocityZ = 0
      player.isFlying = false
      player.flightState = 'grounded'
      state.rotorSpinNormalized = 0
    } else if (jumping && !state.jumpReachedApex && playerAltitude < targetFlightAltitude - LANDING_EPSILON) {
      const jumpAscentSpeed = JUMP_ASCENT_SPEED_MIN + ((JUMP_ASCENT_SPEED_MAX - JUMP_ASCENT_SPEED_MIN) * weightFactor)
      state.verticalVelocityZ = Math.max(state.verticalVelocityZ, jumpAscentSpeed)
      playerAltitude = Math.min(targetFlightAltitude, playerAltitude + (state.verticalVelocityZ * deltaSeconds))

      if (playerAltitude >= targetFlightAltitude - LANDING_EPSILON) {
        playerAltitude = targetFlightAltitude
        state.jumpReachedApex = true
        state.jumpApexHangRemainingSeconds = JUMP_APEX_TRANSITION_SECONDS
        state.verticalVelocityZ = 0
      } // end if jump reached apex

      player.isFlying = false
      player.flightState = 'grounded'
      state.rotorSpinNormalized = 0
    } else {
      const isJumpApexTransitionActive = !wasDescendingFromFlight
        && state.jumpActive
        && state.jumpReachedApex
        && state.jumpApexHangRemainingSeconds > 0

      if (isJumpApexTransitionActive) {
        state.jumpApexHangRemainingSeconds = Math.max(0, state.jumpApexHangRemainingSeconds - deltaSeconds)
        const transitionProgress = clamp(
          1 - (state.jumpApexHangRemainingSeconds / JUMP_APEX_TRANSITION_SECONDS),
          0,
          1
        )
        const easedGravityScale = 0.1 + (0.9 * transitionProgress * transitionProgress)
        state.verticalVelocityZ = Math.max(
          -PLAYER_MAX_FALL_SPEED,
          state.verticalVelocityZ - (PLAYER_FALL_GRAVITY * easedGravityScale * deltaSeconds)
        )
        playerAltitude = Math.max(supportHeight, playerAltitude + (state.verticalVelocityZ * deltaSeconds))
      }

      const shouldFall = !isJumpApexTransitionActive
        && (wasDescendingFromFlight || state.jumpActive || playerAltitude > supportHeight + LANDING_EPSILON)

      if (shouldFall) {
        state.verticalVelocityZ = Math.max(-PLAYER_MAX_FALL_SPEED, state.verticalVelocityZ - PLAYER_FALL_GRAVITY * deltaSeconds)
        playerAltitude = Math.max(supportHeight, playerAltitude + state.verticalVelocityZ * deltaSeconds)

        if (playerAltitude <= supportHeight + LANDING_EPSILON) {
          playerAltitude = supportHeight
          state.verticalVelocityZ = 0
          player.flightState = 'grounded'
          player.isFlying = false
          justLanded = wasDescendingFromFlight || state.jumpActive
          state.jumpActive = false
          state.jumpReachedApex = false
          state.jumpApexHangRemainingSeconds = 0

          // Ensure boost state is cleared on landing (jet is stopping so no audio fade needed)
          if (player.isBoosting) {
            player.isBoosting = false
          } // end if resetting boost on landing
          state.rotorSpinupElapsedSeconds = 0
          state.rotorSpinNormalized = 0
        } else {
          player.isFlying = wasDescendingFromFlight
          state.rotorSpinNormalized = clamp(state.rotorSpinNormalized - (deltaSeconds * 2.6), 0, 1)
        } // end if landed this frame
      } else if (isJumpApexTransitionActive) {
        player.flightState = 'grounded'
        player.isFlying = false
        state.rotorSpinNormalized = 0
      } else {
        playerAltitude = supportHeight
        state.verticalVelocityZ = 0
        state.jumpActive = false
        state.jumpReachedApex = false
        state.jumpApexHangRemainingSeconds = 0
        player.flightState = 'grounded'
        player.isFlying = false
        state.rotorSpinupElapsedSeconds = 0
        state.rotorSpinNormalized = 0
      } // end if player should fall toward support
    }
  } // end if flight state update
  player.z = playerAltitude

  if (justLanded && audio.isAudioStarted()) {
    audio.playHardLanding()
  } // end if landing cue should play

  const cardinalFacings = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]
  const normalizePositiveAngle = (angle: number): number => {
    let wrapped = angle
    while (wrapped < 0) {
      wrapped += Math.PI * 2
    } // end while wrapped below zero
    while (wrapped >= Math.PI * 2) {
      wrapped -= Math.PI * 2
    } // end while wrapped above full turn
    return wrapped
  } // end function normalizePositiveAngle

  const getNextCardinalFacing = (currentAngle: number, direction: 'left' | 'right'): number => {
    const normalizedAngle = normalizePositiveAngle(currentAngle)

    if (direction === 'left') {
      for (let index = cardinalFacings.length - 1; index >= 0; index -= 1) {
        const facing = cardinalFacings[index]!
        if (facing < normalizedAngle - 1e-6) {
          return facing
        } // end if facing is previous leftward cardinal
      } // end for each cardinal facing in reverse

      return cardinalFacings[cardinalFacings.length - 1]!
    } // end if snapping left

    const nextFacing = cardinalFacings.find((facing) => facing > normalizedAngle + 1e-6)
    if (nextFacing !== undefined) {
      return nextFacing
    } // end if facing is next rightward cardinal

    return cardinalFacings[0]!
  } // end function getNextCardinalFacing

  let snappedFacing: number | null = null
  if (input.snapNorthPending) {
    snappedFacing = -Math.PI / 2
  } // end if north snap requested
  if (input.snapEastPending) {
    snappedFacing = 0
  } // end if east snap requested
  if (input.snapSouthPending) {
    snappedFacing = Math.PI / 2
  } // end if south snap requested
  if (input.snapWestPending) {
    snappedFacing = Math.PI
  } // end if west snap requested
  if (input.snapLeftPending) {
    snappedFacing = getNextCardinalFacing(player.angle, 'left')
  } // end if left snap requested
  if (input.snapRightPending) {
    snappedFacing = getNextCardinalFacing(player.angle, 'right')
  } // end if right snap requested

  if (snappedFacing !== null) {
    player.angle = snappedFacing
    input.snapNorthPending = false
    input.snapEastPending = false
    input.snapSouthPending = false
    input.snapWestPending = false
    input.snapLeftPending = false
    input.snapRightPending = false
    if (audio.isAudioStarted()) {
      audio.playCardinalHeadingCueForFacing(snappedFacing)
    } // end if heading cue should play
  } // end if snap handled

  if (input.pitchResetPending) {
    input.pitchResetPending = false
    const wasOffCenter = Math.abs(state.currentPitch) > 0.001
    state.targetPitchVelocity = 0
    state.pitchVelocity = 0
    state.pitchHardRecenterTimeRemainingSeconds = Math.max(
      state.pitchHardRecenterTimeRemainingSeconds,
      PITCH_ASSIST_CONFIG.hardRecenterBlendDurationSeconds
    )
    if (wasOffCenter && audio.isAudioStarted()) {
      audio.playPitchCenterConfirm()
    } // end if reset returned pitch to neutral
  } // end if pitch reset requested

  if (fpsModeEnabled) {
    state.currentPitch = player.pitch
    state.targetPitchVelocity = 0
    state.pitchVelocity = 0
    state.pitchHardRecenterTimeRemainingSeconds = 0
    state.pitchSpringStrength = 0
    state.pitchSpringSuppressed = true
    state.targetElevationOffset = targetElevationOffset
  } else {
    const lookInputAxis = (input.lookDown ? 1 : 0) - (input.lookUp ? 1 : 0)
    if (lookInputAxis !== 0) {
      state.pitchHardRecenterTimeRemainingSeconds = 0
      state.targetPitchVelocity = lookInputAxis * maxPitchSpeed
      state.pitchVelocity = moveToward(
        state.pitchVelocity,
        state.targetPitchVelocity,
        pitchAcceleration * deltaSeconds
      )
    } else {
      state.targetPitchVelocity = 0
      state.pitchHardRecenterTimeRemainingSeconds = Math.max(0, state.pitchHardRecenterTimeRemainingSeconds - deltaSeconds)
      const springStrength = state.pitchHardRecenterTimeRemainingSeconds > 0
        ? hardRecenterSpringStrength
        : passiveSpringStrength * springSuppressionMultiplier
      const pitchAccelerationTowardHorizon = getCriticallyDampedSpringAcceleration(
        state.currentPitch,
        state.pitchVelocity,
        springStrength
      )
      state.pitchVelocity += pitchAccelerationTowardHorizon * deltaSeconds
    }

    state.pitchVelocity = clamp(state.pitchVelocity, -maxPitchSpeed, maxPitchSpeed)
    state.currentPitch = clamp(
      state.currentPitch + (state.pitchVelocity * deltaSeconds),
      -maxPitchAngle,
      maxPitchAngle
    )

    if ((state.currentPitch <= -maxPitchAngle && state.pitchVelocity < 0) || (state.currentPitch >= maxPitchAngle && state.pitchVelocity > 0)) {
      state.pitchVelocity = 0
    } // end if pitch reached clamp boundary

    player.pitch = state.currentPitch
    state.pitchSpringStrength = state.pitchHardRecenterTimeRemainingSeconds > 0
      ? hardRecenterSpringStrength
      : passiveSpringStrength * springSuppressionMultiplier
    state.pitchSpringSuppressed = springSuppressed
    state.targetElevationOffset = targetElevationOffset
  }
  const normalizedPitchAssistMotion = maxPitchSpeed <= 0.0001
    ? 0
    : clamp(Math.abs(state.pitchVelocity) / maxPitchSpeed, 0, 1)

  const forwardAxis = (input.moveForward ? 1 : 0) + (input.moveBack ? -1 : 0)
  const strafeAxis = (input.strafeRight ? 1 : 0) + (input.strafeLeft ? -1 : 0)
  const flightInputAxisMagnitude = Math.min(1, Math.hypot(forwardAxis, strafeAxis))
  const effectiveMaxReverseSpeed = movementProfile.maxReverseSpeed * weightFactor
  const effectiveMaxStrafeSpeed = movementProfile.maxStrafeSpeed * weightFactor

  if (player.flightState === 'grounded') {
    const terrainPenalty = Math.max(0.1, movementProfile.terrainPenaltyMultiplier)
    const effectiveAcceleration = (movementProfile.groundAcceleration * weightFactor) / terrainPenalty
    const effectiveDeceleration = (movementProfile.groundDeceleration * weightFactor) / terrainPenalty
    const targetForwardVelocity = forwardAxis >= 0
      ? forwardAxis * movementProfile.maxForwardSpeed
      : forwardAxis * effectiveMaxReverseSpeed
    const targetStrafeVelocity = strafeAxis * effectiveMaxStrafeSpeed
    const accelerationStep = effectiveAcceleration * deltaSeconds
    const decelerationStep = effectiveDeceleration * deltaSeconds

    const useForwardStep = Math.abs(targetForwardVelocity) > Math.abs(state.groundForwardVelocity)
      ? accelerationStep
      : decelerationStep
    const useStrafeStep = Math.abs(targetStrafeVelocity) > Math.abs(state.groundStrafeVelocity)
      ? accelerationStep
      : decelerationStep

    state.groundForwardVelocity = moveToward(state.groundForwardVelocity, targetForwardVelocity, useForwardStep)
    state.groundStrafeVelocity = moveToward(state.groundStrafeVelocity, targetStrafeVelocity, useStrafeStep)

    if (movementProfile.mobilityType === 'Wheels' || movementProfile.mobilityType === 'Treads') {
      state.groundStrafeVelocity = moveToward(state.groundStrafeVelocity, 0, decelerationStep * 1.3)
    }

    if (movementProfile.mobilityType === 'Treads' && Math.abs(state.groundForwardVelocity) > movementProfile.maxForwardSpeed * 0.92) {
      state.groundForwardVelocity = Math.sign(state.groundForwardVelocity) * movementProfile.maxForwardSpeed * 0.92
    }

    const directionX =
      (Math.cos(player.angle) * state.groundForwardVelocity)
      + (Math.cos(player.angle + Math.PI / 2) * state.groundStrafeVelocity)
    const directionY =
      (Math.sin(player.angle) * state.groundForwardVelocity)
      + (Math.sin(player.angle + Math.PI / 2) * state.groundStrafeVelocity)

    const nextX = player.x + directionX * deltaSeconds
    const nextY = player.y + directionY * deltaSeconds

    let moved = false

    const playerFeet = player.z ?? 0
    const collisionFeet = playerFeet
    const xWithinMap = Math.max(0.06, Math.min(MAP_WIDTH - 0.06, nextX))
    const yWithinMap = Math.max(0.06, Math.min(MAP_HEIGHT - 0.06, nextY))

    const canMoveX = ignorePlayerCollision || !isPlayerBlocked(environment.collisionWorld, xWithinMap, player.y, collisionFeet, PLAYER_RADIUS)
    if (canMoveX) {
      player.x = xWithinMap
      moved = true
    } else {
      collided = true
      movementBlockedByObstacle = true
      state.groundForwardVelocity *= 0.45
      state.groundStrafeVelocity *= 0.45
      collisionDirection = normalizeAngle(Math.atan2(0, directionX) - player.angle)
    } // end if canMoveX

    const canMoveY = ignorePlayerCollision || !isPlayerBlocked(environment.collisionWorld, player.x, yWithinMap, collisionFeet, PLAYER_RADIUS)
    if (canMoveY) {
      player.y = yWithinMap
      moved = true
    } else {
      collided = true
      movementBlockedByObstacle = true
      state.groundForwardVelocity *= 0.45
      state.groundStrafeVelocity *= 0.45
      collisionDirection = normalizeAngle(Math.atan2(directionY, 0) - player.angle)
    } // end if canMoveY

    if (moved) {
      isMoving = true
      collided = false
    } // end if moved
  } else if (forwardAxis !== 0 || strafeAxis !== 0) {
    state.groundForwardVelocity = 0
    state.groundStrafeVelocity = 0
    const axisLength = Math.hypot(forwardAxis, strafeAxis)
    const normalizedForward = forwardAxis / axisLength
    const normalizedStrafe = strafeAxis / axisLength

    const directionX = Math.cos(player.angle) * normalizedForward + Math.cos(player.angle + Math.PI / 2) * normalizedStrafe
    const directionY = Math.sin(player.angle) * normalizedForward + Math.sin(player.angle + Math.PI / 2) * normalizedStrafe

    const nextX = player.x + directionX * moveAmount
    const nextY = player.y + directionY * moveAmount

    const playerFeet = player.z ?? 0
    const collisionFeet = Math.max(playerFeet, minimumCruiseAltitude)
    const xWithinMap = Math.max(0.06, Math.min(MAP_WIDTH - 0.06, nextX))
    const yWithinMap = Math.max(0.06, Math.min(MAP_HEIGHT - 0.06, nextY))

    const canMoveX = ignorePlayerCollision || !isPlayerBlocked(environment.collisionWorld, xWithinMap, player.y, collisionFeet, PLAYER_RADIUS)
    const canMoveY = ignorePlayerCollision || !isPlayerBlocked(environment.collisionWorld, player.x, yWithinMap, collisionFeet, PLAYER_RADIUS)

    if (canMoveX) {
      player.x = xWithinMap
      isMoving = true
    }
    if (canMoveY) {
      player.y = yWithinMap
      isMoving = true
    }
  } // end if has movement input

  const groundedHorizontalSpeed = Math.hypot(state.groundForwardVelocity, state.groundStrafeVelocity)
  const maxGroundSpeed = Math.max(
    0.1,
    movementProfile.maxForwardSpeed,
    effectiveMaxReverseSpeed,
    effectiveMaxStrafeSpeed
  )
  const normalizedGroundSpeed = Math.min(1, groundedHorizontalSpeed / maxGroundSpeed)
  const normalizedForward = state.groundForwardVelocity >= 0
    ? Math.min(1, state.groundForwardVelocity / Math.max(0.1, movementProfile.maxForwardSpeed))
    : -Math.min(1, Math.abs(state.groundForwardVelocity) / Math.max(0.1, effectiveMaxReverseSpeed))
  const targetForwardVelocity = forwardAxis >= 0
    ? forwardAxis * movementProfile.maxForwardSpeed
    : forwardAxis * effectiveMaxReverseSpeed
  const targetStrafeVelocity = strafeAxis * effectiveMaxStrafeSpeed
  const accelerating = (
    Math.abs(targetForwardVelocity) > Math.abs(state.groundForwardVelocity) + 0.05
    || Math.abs(targetStrafeVelocity) > Math.abs(state.groundStrafeVelocity) + 0.05
  )

  const normalizedFlightSpeed = player.flightState === 'grounded'
    ? 0
    : clamp(Math.max(flightInputAxisMagnitude, normalizedGroundSpeed), 0, 1)
  const movementAudioSupportHeight = getTopSurfaceHeight(environment.collisionWorld, player.x, player.y, PLAYER_RADIUS)
  const isOnGroundForMovementAudio = player.flightState === 'grounded'
    && !state.jumpActive
    && (player.z ?? 0) <= movementAudioSupportHeight + LANDING_EPSILON

  if (audio.isAudioStarted()) {
    audio.updateFlightLoopAudio({
      flightType: flightConfig.mode,
      flightState: player.flightState ?? 'grounded',
      normalizedSpeed: normalizedFlightSpeed,
      rotorCount: flightConfig.rotorCount,
      spinProgress: state.rotorSpinNormalized,
      spinUpSeconds: flightConfig.spinUpSeconds,
      boosting: !!player.isBoosting
    })
  } // end if flight loop audio should update

  if (audio.isAudioStarted()) {
    audio.updatePlayerMobilityAudio(
      movementProfile.mobilityType,
      normalizedGroundSpeed,
      normalizedForward,
      accelerating,
      isOnGroundForMovementAudio
    )
  } // end if mobility placeholder audio should update

  const shouldUseWalkerFootsteps = movementProfile.mobilityType === 'Walker'
  const shouldPlayFootsteps = shouldUseWalkerFootsteps
    && isMoving
    && !movementBlockedByObstacle
    && isOnGroundForMovementAudio
    && groundedHorizontalSpeed > 0.22

  if (shouldPlayFootsteps && audio.isAudioStarted()) {
    state.footstepTimerSeconds += deltaSeconds
    if (state.footstepTimerSeconds >= FOOTSTEP_INTERVAL_SECONDS) {
      const stepSupportHeight = getTopSurfaceHeight(environment.collisionWorld, player.x, player.y, PLAYER_RADIUS)
      let terrainLayer: 'default' | 'building' | 'city' | 'town' = 'default'
      if (stepSupportHeight > LANDING_EPSILON) {
        terrainLayer = 'building'
      } else if (isPointInsideZone(player.x, player.y, AUDIO_CONFIG.player.testTownZone)) {
        terrainLayer = 'town'
      } else if (isPointInsideZone(player.x, player.y, AUDIO_CONFIG.player.novaCityZone)) {
        terrainLayer = 'city'
      }
      audio.playFootstep(terrainLayer)
      state.footstepTimerSeconds -= FOOTSTEP_INTERVAL_SECONDS
    } // end if footstep timer reached
  } else {
    state.footstepTimerSeconds = 0
    if (audio.isAudioStarted()) {
      audio.stopFootstep()
    } // end if footsteps should be silenced
  } // end if isMoving

  if (audio.isAudioStarted()) {
    const shouldPlayServo = input.turnLeft
      || input.turnRight
      || input.lookUp
      || input.lookDown
      || normalizedPitchAssistMotion > 0.015
    audio.setServoMotionIntensity(normalizedPitchAssistMotion)
    if (shouldPlayServo && !audio.isServoPlaying()) {
      audio.startServo()
    } // end if should start servo

    if (!shouldPlayServo && audio.isServoPlaying()) {
      audio.stopServo()
    } // end if should stop servo
  } // end if audio started

  if (collided && player.flightState === 'grounded' && audio.isAudioStarted()) {
    const nowSeconds = performance.now() / 1000
    if (nowSeconds - state.lastBumpTimeSeconds > 0.4) {
      audio.playCollisionThud(collisionDirection)
      state.lastBumpTimeSeconds = nowSeconds
    } // end if bump throttle
  } // end if collided

  if (state.muzzleFlashTimer > 0) {
    state.muzzleFlashTimer = Math.max(0, state.muzzleFlashTimer - deltaSeconds)
  } // end if muzzle flash active

} // end function updateFrame
