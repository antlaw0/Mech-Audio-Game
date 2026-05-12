import {
  FOOTSTEP_INTERVAL_SECONDS,
  LOOK_SPEED,
  PLAYER_BOOST_SPEED,
  PLAYER_FLIGHT_SPEED,
  PLAYER_FLIGHT_VERTICAL_SPEED,
  MAX_LOOK_PITCH,
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

const PLAYER_FALL_GRAVITY = 18
const PLAYER_MAX_FALL_SPEED = 14
const LANDING_EPSILON = 0.001

export interface UpdateState {
  footstepTimerSeconds: number
  lastBumpTimeSeconds: number
  muzzleFlashTimer: number
  verticalVelocityZ: number
  groundForwardVelocity: number
  groundStrafeVelocity: number
} // end interface UpdateState

export type MobilityType = 'Wheels' | 'Treads' | 'Hover' | 'Walker' | 'Flight' | 'Placeholder'

export interface MovementArchetypeProfile {
  mobilityType: MobilityType
  ratedLoad: number
  groundAcceleration: number
  groundDeceleration: number
  maxForwardSpeed: number
  maxReverseSpeed: number
  maxStrafeSpeed: number
  turnRate: number
  terrainPenaltyMultiplier: number
  energyUse: number
} // end interface MovementArchetypeProfile

export interface UpdateEnvironment {
  player: Player
  input: InputState
  audio: AudioController
  state: UpdateState
  flightAltitude: number
  collisionWorld: WorldCollisionWorld
  movementProfile: MovementArchetypeProfile
} // end interface UpdateEnvironment

export function createUpdateState(): UpdateState {
  return {
    footstepTimerSeconds: 0,
    lastBumpTimeSeconds: 0,
    muzzleFlashTimer: 0,
    verticalVelocityZ: 0,
    groundForwardVelocity: 0,
    groundStrafeVelocity: 0
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

  const movementProfile = environment.movementProfile
  const { input, player, audio, state } = environment
  const moveSpeed = (environment.player.isBoosting ?? false)
    ? PLAYER_BOOST_SPEED
    : environment.player.flightState === 'grounded'
      ? PLAYER_SPEED
      : PLAYER_FLIGHT_SPEED
  const moveAmount = moveSpeed * deltaSeconds
  const lookAmount = LOOK_SPEED * deltaSeconds
  const turnInput = (input.turnRight ? 1 : 0) - (input.turnLeft ? 1 : 0)
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

      player.angle += turnInput * movementProfile.turnRate * turnScale * deltaSeconds
    }
  } // end if turn input


  let isMoving = false
  let collided = false
  let movementBlockedByObstacle = false
  let collisionDirection = 0

  if (input.flightTogglePending) {
    input.flightTogglePending = false
    if (player.flightState === 'grounded') {
      player.flightState = 'ascending'
      player.isFlying = true
      if (audio.isAudioStarted()) {
        audio.startFlightLoop()
      } // end if flight loop should start
    } else {
      // Cancel boost before descent begins
      if (player.isBoosting) {
        player.isBoosting = false
        if (audio.isAudioStarted()) {
          audio.stopBoostAudio()
        } // end if stopping boost audio on flight exit
      } // end if was boosting
      player.flightState = 'descending'
      player.isFlying = true
      if (audio.isAudioStarted()) {
        audio.stopFlightLoop()
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
  const verticalStep = PLAYER_FLIGHT_VERTICAL_SPEED * deltaSeconds
  let playerAltitude = player.z ?? 0
  const supportHeight = getTopSurfaceHeight(environment.collisionWorld, player.x, player.y, PLAYER_RADIUS)
  let justLanded = false

  if (player.flightState === 'ascending') {
    if (playerAltitude >= targetFlightAltitude - LANDING_EPSILON) {
      player.flightState = 'airborne'
      player.isFlying = true
      state.verticalVelocityZ = 0
    } else {
      playerAltitude = Math.min(targetFlightAltitude, playerAltitude + verticalStep)
      state.verticalVelocityZ = 0
      if (playerAltitude >= targetFlightAltitude - LANDING_EPSILON) {
        playerAltitude = targetFlightAltitude
        player.flightState = 'airborne'
        player.isFlying = true
      } // end if reached flight altitude
    } // end if reached flight altitude
  } else if (player.flightState === 'airborne') {
    playerAltitude = Math.max(playerAltitude, targetFlightAltitude)
    state.verticalVelocityZ = 0
    player.isFlying = true
  } else {
    const wasDescendingFromFlight = player.flightState === 'descending'
    const shouldFall = wasDescendingFromFlight || playerAltitude > supportHeight + LANDING_EPSILON

    if (shouldFall) {
      state.verticalVelocityZ = Math.max(-PLAYER_MAX_FALL_SPEED, state.verticalVelocityZ - PLAYER_FALL_GRAVITY * deltaSeconds)
      playerAltitude = Math.max(supportHeight, playerAltitude + state.verticalVelocityZ * deltaSeconds)

      if (playerAltitude <= supportHeight + LANDING_EPSILON) {
        playerAltitude = supportHeight
        state.verticalVelocityZ = 0
        player.flightState = 'grounded'
        player.isFlying = false
        justLanded = true

        // Ensure boost state is cleared on landing (jet is stopping so no audio fade needed)
        if (player.isBoosting) {
          player.isBoosting = false
        } // end if resetting boost on landing
      } else {
        player.isFlying = wasDescendingFromFlight
      } // end if landed this frame
    } else {
      playerAltitude = supportHeight
      state.verticalVelocityZ = 0
      player.flightState = 'grounded'
      player.isFlying = false
    } // end if player should fall toward support
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
    const wasOffCenter = Math.abs(player.pitch) > 0.001
    player.pitch = 0
    if (wasOffCenter && audio.isAudioStarted()) {
      audio.playPitchCenterConfirm()
    } // end if reset returned pitch to neutral
  } // end if pitch reset requested

  if (input.lookUp) {
    player.pitch -= lookAmount
  } // end if lookUp

  if (input.lookDown) {
    player.pitch += lookAmount
  } // end if lookDown

  player.pitch = Math.max(-MAX_LOOK_PITCH, Math.min(MAX_LOOK_PITCH, player.pitch))

  const forwardAxis = (input.moveForward ? 1 : 0) + (input.moveBack ? -1 : 0)
  const strafeAxis = (input.strafeRight ? 1 : 0) + (input.strafeLeft ? -1 : 0)

  if (player.flightState === 'grounded') {
    const terrainPenalty = Math.max(0.1, movementProfile.terrainPenaltyMultiplier)
    const effectiveAcceleration = movementProfile.groundAcceleration / terrainPenalty
    const effectiveDeceleration = movementProfile.groundDeceleration / terrainPenalty
    const targetForwardVelocity = forwardAxis >= 0
      ? forwardAxis * movementProfile.maxForwardSpeed
      : forwardAxis * movementProfile.maxReverseSpeed
    const targetStrafeVelocity = strafeAxis * movementProfile.maxStrafeSpeed
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

    const canMoveX = !isPlayerBlocked(environment.collisionWorld, xWithinMap, player.y, collisionFeet, PLAYER_RADIUS)
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

    const canMoveY = !isPlayerBlocked(environment.collisionWorld, player.x, yWithinMap, collisionFeet, PLAYER_RADIUS)
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

    const canMoveX = !isPlayerBlocked(environment.collisionWorld, xWithinMap, player.y, collisionFeet, PLAYER_RADIUS)
    const canMoveY = !isPlayerBlocked(environment.collisionWorld, player.x, yWithinMap, collisionFeet, PLAYER_RADIUS)

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
    movementProfile.maxReverseSpeed,
    movementProfile.maxStrafeSpeed
  )
  const normalizedGroundSpeed = Math.min(1, groundedHorizontalSpeed / maxGroundSpeed)
  const normalizedForward = state.groundForwardVelocity >= 0
    ? Math.min(1, state.groundForwardVelocity / Math.max(0.1, movementProfile.maxForwardSpeed))
    : -Math.min(1, Math.abs(state.groundForwardVelocity) / Math.max(0.1, movementProfile.maxReverseSpeed))
  const targetForwardVelocity = forwardAxis >= 0
    ? forwardAxis * movementProfile.maxForwardSpeed
    : forwardAxis * movementProfile.maxReverseSpeed
  const targetStrafeVelocity = strafeAxis * movementProfile.maxStrafeSpeed
  const accelerating = (
    Math.abs(targetForwardVelocity) > Math.abs(state.groundForwardVelocity) + 0.05
    || Math.abs(targetStrafeVelocity) > Math.abs(state.groundStrafeVelocity) + 0.05
  )

  if (audio.isAudioStarted()) {
    audio.updatePlayerMobilityAudio(
      movementProfile.mobilityType,
      normalizedGroundSpeed,
      normalizedForward,
      accelerating,
      player.flightState === 'grounded'
    )
  } // end if mobility placeholder audio should update

  const shouldUseWalkerFootsteps = movementProfile.mobilityType === 'Walker'
  const shouldPlayFootsteps = shouldUseWalkerFootsteps
    && isMoving
    && !movementBlockedByObstacle
    && player.flightState === 'grounded'
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
    const shouldPlayServo = input.turnLeft || input.turnRight || input.lookUp || input.lookDown
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
