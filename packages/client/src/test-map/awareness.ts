import { PLAYER_HEIGHT } from './constants.js'
import { traceWorldHit3D, type WorldCollisionWorld } from './world-collision.js'
import type { ObstructionAwareness, Player, SpriteObject, TankRender } from './types.js'

interface ObstacleHit {
  type: 'wall' | 'tree' | 'rock'
  distance: number
  x: number
  y: number
} // end interface ObstacleHit

function normalizeAngle(angle: number): number {
  let wrapped = angle
  while (wrapped > Math.PI) {
    wrapped -= Math.PI * 2
  } // end while wrapped greater than PI
  while (wrapped < -Math.PI) {
    wrapped += Math.PI * 2
  } // end while wrapped less than -PI
  return wrapped
} // end function normalizeAngle

function findNearestAliveTank(player: Player, tanks: TankRender[]): TankRender | null {
  let nearest: TankRender | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const tank of tanks) {
    if (!tank.alive) {
      continue
    } // end if tank dead

    const distance = Math.hypot(tank.x - player.x, tank.y - player.y)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = tank
    } // end if nearest tank updated
  } // end for each tank

  return nearest
} // end function findNearestAliveTank

function traceSpriteHit(
  sprites: SpriteObject[],
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): ObstacleHit | null {
  const dx = toX - fromX
  const dy = toY - fromY
  const segmentLengthSquared = dx * dx + dy * dy
  if (segmentLengthSquared < 0.000001) {
    return null
  } // end if degenerate segment

  let nearestHit: ObstacleHit | null = null

  for (const sprite of sprites) {
    const px = sprite.x - fromX
    const py = sprite.y - fromY
    const projected = (px * dx + py * dy) / segmentLengthSquared
    if (projected <= 0 || projected >= 1) {
      continue
    } // end if closest point not on segment interior

    const closestX = fromX + dx * projected
    const closestY = fromY + dy * projected
    const closestDistance = Math.hypot(sprite.x - closestX, sprite.y - closestY)
    if (closestDistance > sprite.radius + 0.05) {
      continue
    } // end if no intersection with obstacle radius

    const hitDistance = Math.hypot(closestX - fromX, closestY - fromY)
    if (!nearestHit || hitDistance < nearestHit.distance) {
      nearestHit = {
        type: sprite.type,
        distance: hitDistance,
        x: closestX,
        y: closestY
      }
    } // end if nearest sprite hit updated
  } // end for each sprite

  return nearestHit
} // end function traceSpriteHit

export function computeObstructionAwareness(
  player: Player,
  tanks: TankRender[],
  collisionWorld: WorldCollisionWorld,
  sprites: SpriteObject[]
): ObstructionAwareness {
  const target = findNearestAliveTank(player, tanks)
  if (!target) {
    return {
      hasTarget: false,
      isBlocked: false,
      obstacleType: null,
      obstacleDistance: 0,
      obstacleBearingDelta: 0,
      targetDistance: 0
    } // end object no-target awareness
  } // end if no alive targets

  const targetDistance = Math.hypot(target.x - player.x, target.y - player.y)
  const wallTrace = traceWorldHit3D(
    collisionWorld,
    { x: player.x, y: player.y, z: (player.z ?? 0) + PLAYER_HEIGHT },
    { x: target.x, y: target.y, z: target.height + PLAYER_HEIGHT }
  )
  const wallHit = wallTrace
    ? {
        type: 'wall' as const,
        distance: wallTrace.distance,
        x: wallTrace.x,
        y: wallTrace.y
      }
    : null
  const spriteHit = traceSpriteHit(sprites, player.x, player.y, target.x, target.y)

  let nearestObstacle: ObstacleHit | null = null
  if (wallHit && spriteHit) {
    nearestObstacle = wallHit.distance < spriteHit.distance ? wallHit : spriteHit
  } else {
    nearestObstacle = wallHit ?? spriteHit
  } // end if obstacle selection

  if (!nearestObstacle) {
    return {
      hasTarget: true,
      isBlocked: false,
      obstacleType: null,
      obstacleDistance: 0,
      obstacleBearingDelta: 0,
      targetDistance
    } // end object clear-path awareness
  } // end if no obstacle detected

  const obstacleAngle = Math.atan2(nearestObstacle.y - player.y, nearestObstacle.x - player.x)
  const obstacleBearingDelta = normalizeAngle(obstacleAngle - player.angle)

  return {
    hasTarget: true,
    isBlocked: true,
    obstacleType: nearestObstacle.type,
    obstacleDistance: nearestObstacle.distance,
    obstacleBearingDelta,
    targetDistance
  } // end object blocked-path awareness
} // end function computeObstructionAwareness
