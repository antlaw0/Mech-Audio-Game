import { clamp, remap, shortestAngleBetween } from '../utils/mathUtils.js'
import { angleVec2, lengthVec2, subVec2, vec2 } from '../utils/vector.js'
import type { CollisionResult, NavigationPingHit, Obstacle, PlayerState, VerticalLayer } from './worldTypes.js'

export interface NearbyObstacle {
  obstacle: Obstacle
  distance: number
  direction: number
}

export const resolvePlayerCollision = (
  player: PlayerState,
  nextX: number,
  nextY: number,
  obstacles: Obstacle[]
): CollisionResult => {
  if (player.layer === 'air') {
    return {
      hit: false,
      correctedPosition: vec2(nextX, nextY),
      normal: vec2(0, 0)
    }
  }

  return resolvePositionAgainstObstacles(nextX, nextY, obstacles, 0.58)
}

export const resolvePositionAgainstObstacles = (
  nextX: number,
  nextY: number,
  obstacles: Obstacle[],
  radius: number
): CollisionResult => {
  let corrected = vec2(nextX, nextY)
  let hit = false
  let normal = vec2(0, 0)

  for (const obstacle of obstacles) {
    const dx = corrected.x - obstacle.x
    const dy = corrected.y - obstacle.y
    const distance = Math.hypot(dx, dy)
    const minDistance = obstacle.radius + radius
    if (distance < minDistance) {
      hit = true
      const pushDistance = minDistance - Math.max(distance, 0.0001)
      const nx = dx / Math.max(distance, 0.0001)
      const ny = dy / Math.max(distance, 0.0001)
      corrected = vec2(corrected.x + nx * pushDistance, corrected.y + ny * pushDistance)
      normal = vec2(nx, ny)
    }
  }

  return { hit, correctedPosition: corrected, normal }
}

export const getNearestObstacles = (
  player: PlayerState,
  obstacles: Obstacle[],
  range: number
): NearbyObstacle[] => {
  if (player.layer === 'air') {
    return []
  }

  const result: NearbyObstacle[] = []
  for (const obstacle of obstacles) {
    const offset = subVec2({ x: obstacle.x, y: obstacle.y }, player.position)
    const distance = Math.max(0, lengthVec2(offset) - obstacle.radius)
    if (distance <= range) {
      const direction = shortestAngleBetween(angleVec2(offset), player.heading)
      result.push({ obstacle, distance, direction })
    }
  }

  result.sort((a, b) => a.distance - b.distance)
  return result
}

export const castNavigationPingRays = (
  player: PlayerState,
  obstacles: Obstacle[],
  rayCount: number,
  range: number
): NavigationPingHit[] => {
  if (player.layer === 'air') {
    return []
  }

  const hits: NavigationPingHit[] = []
  const angleStep = (Math.PI * 2) / rayCount

  for (let i = 0; i < rayCount; i += 1) {
    const angle = i * angleStep
    let nearestDistance = range
    let nearestMaterial: NavigationPingHit['material'] = 'none'

    for (let t = 0.5; t <= range; t += 0.5) {
      const sampleX = player.position.x + Math.cos(angle) * t
      const sampleY = player.position.y + Math.sin(angle) * t
      const obstacle = obstacles.find((candidate) => {
        const dx = sampleX - candidate.x
        const dy = sampleY - candidate.y
        return dx * dx + dy * dy <= candidate.radius * candidate.radius
      })
      if (obstacle) {
        nearestDistance = t
        nearestMaterial = obstacle.material
        break
      }
    }

    const relativeAngle = shortestAngleBetween(angle, player.heading)
    hits.push({
      distance: nearestDistance,
      angle: relativeAngle,
      material: nearestMaterial
    })
  }

  return hits
}

export const obstacleWarningIntensity = (distance: number, nearDistance: number, farDistance: number): number => {
  if (distance <= nearDistance) {
    return 1
  }
  if (distance >= farDistance) {
    return 0
  }
  return clamp(1 - remap(distance, nearDistance, farDistance, 0, 1), 0, 1)
}

export const lineOfSightBlockedByObstacles = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  startLayer: VerticalLayer,
  endLayer: VerticalLayer,
  obstacles: Obstacle[]
): boolean => {
  if (startLayer === 'air' || endLayer === 'air') {
    return false
  }

  const dx = endX - startX
  const dy = endY - startY
  const total = Math.hypot(dx, dy)
  if (total < 0.1) {
    return false
  }

  const step = 0.45
  const nx = dx / total
  const ny = dy / total

  for (let t = step; t < total; t += step) {
    const sampleX = startX + nx * t
    const sampleY = startY + ny * t
    const blocked = obstacles.some((obstacle) => {
      const ox = sampleX - obstacle.x
      const oy = sampleY - obstacle.y
      return ox * ox + oy * oy <= obstacle.radius * obstacle.radius
    })
    if (blocked) {
      return true
    }
  }

  return false
}
