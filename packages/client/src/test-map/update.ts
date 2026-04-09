import {
  FOOTSTEP_INTERVAL_SECONDS,
  LOOK_SPEED,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_LOOK_PITCH,
  PLAYER_SPEED,
  TURN_SPEED
} from './constants.js'
import { isSolidSpriteAt, isWall } from './collision.js'
import type { AudioController, InputState, Player, SpriteObject } from './types.js'

export interface UpdateState {
  footstepTimerSeconds: number
  lastBumpTimeSeconds: number
  muzzleFlashTimer: number
} // end interface UpdateState

export interface UpdateEnvironment {
  mapData: Uint8Array
  sprites: SpriteObject[]
  player: Player
  input: InputState
  audio: AudioController
  state: UpdateState
} // end interface UpdateEnvironment

export function createUpdateState(): UpdateState {
  return {
    footstepTimerSeconds: 0,
    lastBumpTimeSeconds: 0,
    muzzleFlashTimer: 0
  } // end object update state
} // end function createUpdateState

export function updateFrame(environment: UpdateEnvironment, deltaSeconds: number): void {
  const moveAmount = PLAYER_SPEED * deltaSeconds
  const turnAmount = TURN_SPEED * deltaSeconds
  const lookAmount = LOOK_SPEED * deltaSeconds

  const { input, player, audio, sprites, mapData, state } = environment
  let isMoving = false
  let collided = false

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

    const canMoveX = !isWall(mapData, nextX, player.y) && !isSolidSpriteAt(sprites, nextX, player.y, null)
    if (canMoveX) {
      player.x = nextX
      moved = true
    } else {
      collided = true
    } // end if canMoveX

    const canMoveY = !isWall(mapData, player.x, nextY) && !isSolidSpriteAt(sprites, player.x, nextY, null)
    if (canMoveY) {
      player.y = nextY
      moved = true
    } else {
      collided = true
    } // end if canMoveY

    if (moved) {
      isMoving = true
      collided = false
    } // end if moved
  } // end if has movement input

  if (isMoving && audio.isAudioStarted()) {
    state.footstepTimerSeconds += deltaSeconds
    if (state.footstepTimerSeconds >= FOOTSTEP_INTERVAL_SECONDS) {
      audio.playFootstep()
      state.footstepTimerSeconds -= FOOTSTEP_INTERVAL_SECONDS
    } // end if footstep timer reached
  } else {
    state.footstepTimerSeconds = 0
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

  if (collided && audio.isAudioStarted()) {
    const nowSeconds = performance.now() / 1000
    if (nowSeconds - state.lastBumpTimeSeconds > 0.4) {
      audio.playBump()
      state.lastBumpTimeSeconds = nowSeconds
    } // end if bump throttle
  } // end if collided

  if (state.muzzleFlashTimer > 0) {
    state.muzzleFlashTimer = Math.max(0, state.muzzleFlashTimer - deltaSeconds)
  } // end if muzzle flash active

  if (audio.isAudioStarted()) {
    const distanceToBoundary = Math.min(
      player.x,
      player.y,
      MAP_WIDTH - 1 - player.x,
      MAP_HEIGHT - 1 - player.y
    )
    audio.updateBoundaryZoneCue(distanceToBoundary, deltaSeconds)
  } // end if boundary cue should update
} // end function updateFrame
