import {
  LOOK_SPEED,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_LOOK_PITCH,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  TURN_SPEED,
  type InputState,
  type PlayerState,
  type SpriteObject,
  type WorldState
} from '@mech-audio/shared'

function getCell(world: WorldState, col: number, row: number): number {
  if (col < 0 || col >= MAP_WIDTH || row < 0 || row >= MAP_HEIGHT) {
    return 1
  } // end if out of bounds

  return world.mapData[row * MAP_WIDTH + col] ?? 1
} // end function getCell

function isWall(world: WorldState, x: number, y: number): boolean {
  const col = Math.floor(x)
  const row = Math.floor(y)
  return getCell(world, col, row) !== 0
} // end function isWall

function isSolidSpriteAt(
  sprites: SpriteObject[],
  x: number,
  y: number,
  radius: number
): boolean {
  for (let i = 0; i < sprites.length; i += 1) {
    const sprite = sprites[i]
    if (!sprite) {
      continue
    } // end if missing sprite

    const dx = x - sprite.x
    const dy = y - sprite.y
    if (Math.hypot(dx, dy) < radius + sprite.radius) {
      return true
    } // end if overlaps sprite
  } // end for each sprite

  return false
} // end function isSolidSpriteAt

export function applyInput(
  world: WorldState,
  player: PlayerState,
  input: InputState,
  deltaSeconds: number
): void {
  const moveAmount = PLAYER_SPEED * deltaSeconds
  const turnAmount = TURN_SPEED * deltaSeconds
  const lookAmount = LOOK_SPEED * deltaSeconds

  if (input.turnLeft) {
    player.angle -= turnAmount
  } // end if turnLeft

  if (input.turnRight) {
    player.angle += turnAmount
  } // end if turnRight

  if (input.lookUp) {
    player.pitch -= lookAmount
  } // end if lookUp

  if (input.lookDown) {
    player.pitch += lookAmount
  } // end if lookDown

  player.pitch = Math.max(-MAX_LOOK_PITCH, Math.min(MAX_LOOK_PITCH, player.pitch))

  const forwardAxis = (input.moveForward ? 1 : 0) + (input.moveBack ? -1 : 0)
  const strafeAxis = (input.strafeRight ? 1 : 0) + (input.strafeLeft ? -1 : 0)

  if (forwardAxis === 0 && strafeAxis === 0) {
    return
  } // end if no movement

  const axisLength = Math.hypot(forwardAxis, strafeAxis)
  const normalizedForward = forwardAxis / axisLength
  const normalizedStrafe = strafeAxis / axisLength

  const directionX = Math.cos(player.angle) * normalizedForward + Math.cos(player.angle + Math.PI / 2) * normalizedStrafe
  const directionY = Math.sin(player.angle) * normalizedForward + Math.sin(player.angle + Math.PI / 2) * normalizedStrafe

  const nextX = player.x + directionX * moveAmount
  const nextY = player.y + directionY * moveAmount

  const canMoveX = !isWall(world, nextX, player.y) && !isSolidSpriteAt(world.sprites, nextX, player.y, PLAYER_RADIUS)
  if (canMoveX) {
    player.x = nextX
  } // end if canMoveX

  const canMoveY = !isWall(world, player.x, nextY) && !isSolidSpriteAt(world.sprites, player.x, nextY, PLAYER_RADIUS)
  if (canMoveY) {
    player.y = nextY
  } // end if canMoveY
} // end function applyInput
