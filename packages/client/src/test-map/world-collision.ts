import { MAP_HEIGHT, MAP_WIDTH } from './constants.js'
import { getCell } from './map-data.js'
import type { SpriteObject } from './types.js'

export const WORLD_WALL_HEIGHT = 3.2
export const PLAYER_COLLISION_HEIGHT = 1.7
export const PLAYER_EYE_HEIGHT = 0.66

interface Point3D {
  x: number
  y: number
  z: number
} // end interface Point3D

export interface WorldTraceHit {
  distance: number
  x: number
  y: number
  z: number
  obstacleType: 'wall' | 'tree' | 'rock' | 'pillar'
} // end interface WorldTraceHit

interface WallCollider {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  zMin: number
  zMax: number
} // end interface WallCollider

interface RoundCollider {
  x: number
  y: number
  radius: number
  zMin: number
  zMax: number
  type: 'tree' | 'rock' | 'pillar'
} // end interface RoundCollider

export interface WorldCollisionWorld {
  walls: WallCollider[]
  roundObstacles: RoundCollider[]
  wallSet: Set<number>
} // end interface WorldCollisionWorld

function toRoundObstacle(sprite: SpriteObject): RoundCollider {
  if (sprite.type === 'tree') {
    return {
      x: sprite.x,
      y: sprite.y,
      radius: Math.max(0.25, sprite.radius),
      zMin: 0,
      zMax: 2.4,
      type: 'tree'
    } // end object tree collider
  } // end if tree collider

  if (sprite.type === 'pillar') {
    return {
      x: sprite.x,
      y: sprite.y,
      radius: Math.max(0.3, sprite.radius),
      zMin: 0,
      zMax: 3.1,
      type: 'pillar'
    } // end object pillar collider
  } // end if pillar collider

  return {
    x: sprite.x,
    y: sprite.y,
    radius: Math.max(0.25, sprite.radius),
    zMin: 0,
    zMax: 1.05,
    type: 'rock'
  } // end object rock collider
} // end function toRoundObstacle

export function createWorldCollisionWorld(mapData: Uint8Array, sprites: SpriteObject[]): WorldCollisionWorld {
  const walls: WallCollider[] = []
  const wallSet = new Set<number>()
  for (let row = 0; row < MAP_HEIGHT; row += 1) {
    for (let col = 0; col < MAP_WIDTH; col += 1) {
      if (getCell(mapData, col, row) === 0) {
        continue
      } // end if empty cell

      walls.push({
        xMin: col,
        xMax: col + 1,
        yMin: row,
        yMax: row + 1,
        zMin: 0,
        zMax: WORLD_WALL_HEIGHT
      })
      wallSet.add(row * MAP_WIDTH + col)
    } // end for each map column
  } // end for each map row

  const roundObstacles = sprites.map((sprite) => toRoundObstacle(sprite))
  return { walls, roundObstacles, wallSet }
} // end function createWorldCollisionWorld

function circleIntersectsAabb(x: number, y: number, radius: number, box: WallCollider): boolean {
  const clampedX = Math.max(box.xMin, Math.min(x, box.xMax))
  const clampedY = Math.max(box.yMin, Math.min(y, box.yMax))
  const dx = x - clampedX
  const dy = y - clampedY
  return (dx * dx) + (dy * dy) <= radius * radius
} // end function circleIntersectsAabb

function hasVerticalOverlap(zMinA: number, zMaxA: number, zMinB: number, zMaxB: number): boolean {
  return zMinA <= zMaxB && zMaxA >= zMinB
} // end function hasVerticalOverlap

function isWallCellFilled(world: WorldCollisionWorld, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= MAP_WIDTH || row >= MAP_HEIGHT) {
    return false
  } // end if out of map bounds
  return world.wallSet.has(row * MAP_WIDTH + col)
} // end function isWallCellFilled

function collidesWithWallCells(world: WorldCollisionWorld, x: number, y: number, radius: number, zMin: number, zMax: number): boolean {
  if (!hasVerticalOverlap(zMin, zMax, 0, WORLD_WALL_HEIGHT)) {
    return false
  } // end if no wall height overlap

  const colMin = Math.max(0, Math.floor(x - radius))
  const colMax = Math.min(MAP_WIDTH - 1, Math.floor(x + radius))
  const rowMin = Math.max(0, Math.floor(y - radius))
  const rowMax = Math.min(MAP_HEIGHT - 1, Math.floor(y + radius))

  for (let row = rowMin; row <= rowMax; row += 1) {
    for (let col = colMin; col <= colMax; col += 1) {
      if (!isWallCellFilled(world, col, row)) {
        continue
      } // end if map tile is not a wall

      const wallBox: WallCollider = {
        xMin: col,
        xMax: col + 1,
        yMin: row,
        yMax: row + 1,
        zMin: 0,
        zMax: WORLD_WALL_HEIGHT
      }

      if (circleIntersectsAabb(x, y, radius, wallBox)) {
        return true
      } // end if wall tile blocks sample
    } // end for each map column
  } // end for each map row

  return false
} // end function collidesWithWallCells

function getObstacleType(world: WorldCollisionWorld, x: number, y: number, z: number, radius: number): 'wall' | 'tree' | 'rock' | 'pillar' | null {
  const traceZMin = z
  const traceZMax = z + 0.001

  if (collidesWithWallCells(world, x, y, radius, traceZMin, traceZMax)) {
    return 'wall'
  } // end if wall hit

  for (const obstacle of world.roundObstacles) {
    if (!hasVerticalOverlap(traceZMin, traceZMax, obstacle.zMin, obstacle.zMax)) {
      continue
    } // end if no obstacle height overlap

    const dx = x - obstacle.x
    const dy = y - obstacle.y
    const minDist = radius + obstacle.radius
    if ((dx * dx) + (dy * dy) <= minDist * minDist) {
      return obstacle.type
    } // end if round obstacle hit
  } // end for each obstacle

  return null
} // end function getObstacleType

export function isWorldBlockedAtHeight(world: WorldCollisionWorld, x: number, y: number, z: number, radius = 0.02): boolean {
  return getObstacleType(world, x, y, z, radius) !== null
} // end function isWorldBlockedAtHeight

export function traceWorldHit3D(world: WorldCollisionWorld, from: Point3D, to: Point3D, radius = 0.02): WorldTraceHit | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z
  const totalDistance = Math.hypot(dx, dy)
  if (totalDistance < 0.001) {
    return null
  } // end if too close

  const steps = Math.max(1, Math.ceil(totalDistance / 0.1))
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps
    const sampleX = from.x + dx * t
    const sampleY = from.y + dy * t
    const sampleZ = from.z + dz * t
    const obstacleType = getObstacleType(world, sampleX, sampleY, sampleZ, radius)
    if (obstacleType !== null) {
      return {
        distance: totalDistance * t,
        x: sampleX,
        y: sampleY,
        z: sampleZ,
        obstacleType
      }
    } // end if obstacle blocks trace
  } // end for trace steps

  return null
} // end function traceWorldHit3D

export function hasWorldLineOfSight3D(world: WorldCollisionWorld, from: Point3D, to: Point3D): boolean {
  return traceWorldHit3D(world, from, to) === null
} // end function hasWorldLineOfSight3D

export function isPlayerBlocked(
  world: WorldCollisionWorld,
  x: number,
  y: number,
  feetZ: number,
  radius: number,
  collisionHeight: number = PLAYER_COLLISION_HEIGHT
): boolean {
  if (x - radius < 0 || y - radius < 0 || x + radius > MAP_WIDTH || y + radius > MAP_HEIGHT) {
    return true
  } // end if outside map bounds

  const playerZMin = Math.max(0, feetZ)
  const playerZMax = playerZMin + Math.max(0.1, collisionHeight)

  if (collidesWithWallCells(world, x, y, radius, playerZMin, playerZMax)) {
    return true
  } // end if collides with wall

  for (const obstacle of world.roundObstacles) {
    if (!hasVerticalOverlap(playerZMin, playerZMax, obstacle.zMin, obstacle.zMax)) {
      continue
    } // end if no vertical overlap with obstacle

    const dx = x - obstacle.x
    const dy = y - obstacle.y
    const distSq = (dx * dx) + (dy * dy)
    const minDist = radius + obstacle.radius
    if (distSq < minDist * minDist) {
      return true
    } // end if collides with obstacle
  } // end for each round obstacle

  return false
} // end function isPlayerBlocked
