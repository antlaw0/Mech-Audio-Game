import { clamp } from '../utils/mathUtils.js'
import { fromAngle, vec2 } from '../utils/vector.js'
import { resolvePlayerCollision } from './collision.js'
import type { InputSnapshot } from './input.js'
import type { Obstacle, WorldBounds, PlayerState } from './worldTypes.js'

interface PhysicsConfig {
  acceleration: number
  maxSpeed: number
  friction: number
  turnSpeed: number
}

const DEFAULT_PHYSICS: PhysicsConfig = {
  acceleration: 11,
  maxSpeed: 5.4,
  friction: 7.2,
  turnSpeed: 2.4
}

export const stepPlayerPhysics = (
  player: PlayerState,
  input: InputSnapshot,
  obstacles: Obstacle[],
  bounds: WorldBounds,
  dt: number,
  config: PhysicsConfig = DEFAULT_PHYSICS
): { collided: boolean; boundaryDistance: number } => {
  const moveIntent = vec2(0, 0)

  if (input.moveForward) {
    const forward = fromAngle(player.heading, 1)
    moveIntent.x += forward.x
    moveIntent.y += forward.y
  }
  if (input.moveBackward) {
    const backward = fromAngle(player.heading + Math.PI, 1)
    moveIntent.x += backward.x
    moveIntent.y += backward.y
  }
  if (input.strafeLeft) {
    const left = fromAngle(player.heading - Math.PI / 2, 1)
    moveIntent.x += left.x
    moveIntent.y += left.y
  }
  if (input.strafeRight) {
    const right = fromAngle(player.heading + Math.PI / 2, 1)
    moveIntent.x += right.x
    moveIntent.y += right.y
  }

  const intentLength = Math.hypot(moveIntent.x, moveIntent.y)
  if (intentLength > 0.0001) {
    moveIntent.x /= intentLength
    moveIntent.y /= intentLength
    player.velocity.x += moveIntent.x * config.acceleration * dt
    player.velocity.y += moveIntent.y * config.acceleration * dt
  } else {
    const slow = clamp(1 - config.friction * dt, 0, 1)
    player.velocity.x *= slow
    player.velocity.y *= slow
  }

  const speed = Math.hypot(player.velocity.x, player.velocity.y)
  if (speed > config.maxSpeed) {
    const scale = config.maxSpeed / speed
    player.velocity.x *= scale
    player.velocity.y *= scale
  }

  const turnInput = (input.turnRight ? 1 : 0) - (input.turnLeft ? 1 : 0)
  player.heading += turnInput * config.turnSpeed * dt

  const nextX = player.position.x + player.velocity.x * dt
  const nextY = player.position.y + player.velocity.y * dt
  const collision = resolvePlayerCollision(player, nextX, nextY, obstacles)

  player.position.x = clamp(collision.correctedPosition.x, bounds.minX + 0.5, bounds.maxX - 0.5)
  player.position.y = clamp(collision.correctedPosition.y, bounds.minY + 0.5, bounds.maxY - 0.5)

  if (collision.hit) {
    player.velocity.x *= 0.45
    player.velocity.y *= 0.45
  }

  const boundaryDistance = Math.min(
    player.position.x - bounds.minX,
    bounds.maxX - player.position.x,
    player.position.y - bounds.minY,
    bounds.maxY - player.position.y
  )

  return { collided: collision.hit, boundaryDistance }
}
