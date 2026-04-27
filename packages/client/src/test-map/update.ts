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
import { normalizeAngle } from './audio-utils.js'
import { isPlayerBlocked, type WorldCollisionWorld } from './world-collision.js'
import type { AudioController, InputState, Player } from './types.js'

export interface UpdateState {
  footstepTimerSeconds: number
  lastBumpTimeSeconds: number
  muzzleFlashTimer: number
} // end interface UpdateState

export interface UpdateEnvironment {
  player: Player
  input: InputState
  audio: AudioController
  state: UpdateState
  flightAltitude: number
  collisionWorld: WorldCollisionWorld
} // end interface UpdateEnvironment

export function createUpdateState(): UpdateState {
  return {
    footstepTimerSeconds: 0,
    lastBumpTimeSeconds: 0,
    muzzleFlashTimer: 0
  } // end object update state
} // end function createUpdateState

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

  const moveSpeed = (environment.player.isBoosting ?? false)
    ? PLAYER_BOOST_SPEED
    : environment.player.flightState === 'grounded'
      ? PLAYER_SPEED
      : PLAYER_FLIGHT_SPEED
  const moveAmount = moveSpeed * deltaSeconds
  const turnAmount = TURN_SPEED * deltaSeconds
  const lookAmount = LOOK_SPEED * deltaSeconds

  const { input, player, audio, state } = environment
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

  const targetFlightAltitude = Math.max(0, environment.flightAltitude)
  const verticalStep = PLAYER_FLIGHT_VERTICAL_SPEED * deltaSeconds
  let playerAltitude = player.z ?? 0
  if (player.flightState === 'ascending') {
    playerAltitude = Math.min(targetFlightAltitude, playerAltitude + verticalStep)
    if (playerAltitude >= targetFlightAltitude - 0.001) {
      playerAltitude = targetFlightAltitude
      player.flightState = 'airborne'
      player.isFlying = true
    } // end if reached flight altitude
  } else if (player.flightState === 'airborne') {
    playerAltitude = targetFlightAltitude
    player.isFlying = true
  } else if (player.flightState === 'descending') {
    playerAltitude = Math.max(0, playerAltitude - verticalStep)
    player.isFlying = playerAltitude > 0
    if (playerAltitude <= 0.001) {
      playerAltitude = 0
      player.flightState = 'grounded'
      player.isFlying = false
      // Ensure boost state is cleared on landing (jet is stopping so no audio fade needed)
      if (player.isBoosting) {
        player.isBoosting = false
      } // end if resetting boost on landing
      if (audio.isAudioStarted()) {
        audio.playHardLanding()
      } // end if hard landing should play
    } // end if landed
  } else {
    playerAltitude = 0
    player.flightState = 'grounded'
    player.isFlying = false
  } // end if flight state update
  player.z = playerAltitude

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

  if (input.turnLeft) {
    player.angle -= turnAmount
  } // end if turnLeft

  if (input.turnRight) {
    player.angle += turnAmount
  } // end if turnRight

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

  if (forwardAxis !== 0 || strafeAxis !== 0) {
    const axisLength = Math.hypot(forwardAxis, strafeAxis)
    const normalizedForward = forwardAxis / axisLength
    const normalizedStrafe = strafeAxis / axisLength

    const directionX = Math.cos(player.angle) * normalizedForward + Math.cos(player.angle + Math.PI / 2) * normalizedStrafe
    const directionY = Math.sin(player.angle) * normalizedForward + Math.sin(player.angle + Math.PI / 2) * normalizedStrafe

    const nextX = player.x + directionX * moveAmount
    const nextY = player.y + directionY * moveAmount

    let moved = false

    const playerFeet = player.z ?? 0
    const xWithinMap = Math.max(0.06, Math.min(MAP_WIDTH - 0.06, nextX))
    const yWithinMap = Math.max(0.06, Math.min(MAP_HEIGHT - 0.06, nextY))

    const canMoveX = !isPlayerBlocked(environment.collisionWorld, xWithinMap, player.y, playerFeet, PLAYER_RADIUS)
    if (canMoveX) {
      player.x = xWithinMap
      moved = true
    } else {
      collided = true
      movementBlockedByObstacle = true
      collisionDirection = normalizeAngle(Math.atan2(0, directionX) - player.angle)
    } // end if canMoveX

    const canMoveY = !isPlayerBlocked(environment.collisionWorld, player.x, yWithinMap, playerFeet, PLAYER_RADIUS)
    if (canMoveY) {
      player.y = yWithinMap
      moved = true
    } else {
      collided = true
      movementBlockedByObstacle = true
      collisionDirection = normalizeAngle(Math.atan2(directionY, 0) - player.angle)
    } // end if canMoveY

    if (moved) {
      isMoving = true
      collided = false
    } // end if moved
  } // end if has movement input

  if (isMoving && !movementBlockedByObstacle && player.flightState === 'grounded' && audio.isAudioStarted()) {
    state.footstepTimerSeconds += deltaSeconds
    if (state.footstepTimerSeconds >= FOOTSTEP_INTERVAL_SECONDS) {
      audio.playFootstep()
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
