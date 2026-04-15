import { MAP_HEIGHT, MAP_WIDTH, PLAYER_RADIUS, WALL_HEIGHT } from './constants.js'
import { getCell } from './map-data.js'
import type { SpriteObject } from './types.js'

interface Point3D {
  x: number
  y: number
  z: number
} // end interface Point3D

export interface WallTraceHit {
  distance: number
  x: number
  y: number
  z: number
} // end interface WallTraceHit

export function isWall(mapData: Uint8Array, x: number, y: number): boolean {
  const col = Math.floor(x)
  const row = Math.floor(y)

  if (col < 0 || col >= MAP_WIDTH || row < 0 || row >= MAP_HEIGHT) {
    return true
  } // end if out of bounds

  return getCell(mapData, col, row) !== 0
} // end function isWall

export function isWallBlockingAtHeight(mapData: Uint8Array, x: number, y: number, z: number): boolean {
  if (!isWall(mapData, x, y)) {
    return false
  } // end if no wall at sample position

  return z <= WALL_HEIGHT + 0.001
} // end function isWallBlockingAtHeight

export function traceWallHit3D(mapData: Uint8Array, from: Point3D, to: Point3D): WallTraceHit | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const totalDistance = Math.hypot(dx, dy)
  if (totalDistance < 0.001) {
    return null
  } // end if too close

  const steps = Math.max(1, Math.ceil(totalDistance / 0.16))
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps
    const sampleX = from.x + dx * t
    const sampleY = from.y + dy * t
    const sampleZ = from.z + (to.z - from.z) * t
    if (isWallBlockingAtHeight(mapData, sampleX, sampleY, sampleZ)) {
      return {
        distance: totalDistance * t,
        x: sampleX,
        y: sampleY,
        z: sampleZ
      } // end object wall trace hit
    } // end if wall blocks trace at sampled height
  } // end for each trace step

  return null
} // end function traceWallHit3D

export function hasLineOfSight3D(mapData: Uint8Array, from: Point3D, to: Point3D): boolean {
  return traceWallHit3D(mapData, from, to) === null
} // end function hasLineOfSight3D

export function isSolidSpriteAt(
  sprites: SpriteObject[],
  x: number,
  y: number,
  ignoreSprite: SpriteObject | null
): boolean {
  for (let index = 0; index < sprites.length; index += 1) {
    const sprite = sprites[index]
    if (!sprite) {
      continue
    } // end if missing sprite

    if (sprite === ignoreSprite) {
      continue
    } // end if ignored sprite

    const dx = x - sprite.x
    const dy = y - sprite.y
    if (Math.hypot(dx, dy) < PLAYER_RADIUS + sprite.radius) {
      return true
    } // end if collision
  } // end for each sprite

  return false
} // end function isSolidSpriteAt
