import { getCell } from './map-data.js'
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

function traceWallHit(
  mapData: Uint8Array,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): ObstacleHit | null {
  const dx = toX - fromX
  const dy = toY - fromY
  const totalDistance = Math.hypot(dx, dy)
  if (totalDistance < 0.001) {
    return null
  } // end if too close

  const stepDistance = 0.16
  const steps = Math.max(1, Math.ceil(totalDistance / stepDistance))
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps
    const sampleX = fromX + dx * t
    const sampleY = fromY + dy * t
    const mapCol = Math.floor(sampleX)
    const mapRow = Math.floor(sampleY)
    if (getCell(mapData, mapCol, mapRow) !== 0) {
      return {
        type: 'wall',
        distance: totalDistance * t,
        x: sampleX,
        y: sampleY
      } // end object wall hit
    } // end if wall hit
  } // end for each trace step

  return null
} // end function traceWallHit

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
  mapData: Uint8Array,
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
  const wallHit = traceWallHit(mapData, player.x, player.y, target.x, target.y)
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
