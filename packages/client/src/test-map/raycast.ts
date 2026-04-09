import { HALF_FOV, MAX_DEPTH } from './constants.js'
import { getCell } from './map-data.js'
import type { Player, RayHit } from './types.js'

export function castRay(mapData: Uint8Array, player: Player, angle: number): RayHit {
  const rayDirectionX = Math.cos(angle)
  const rayDirectionY = Math.sin(angle)

  let mapCol = Math.floor(player.x)
  let mapRow = Math.floor(player.y)

  const deltaDistanceX = Math.abs(1 / rayDirectionX)
  const deltaDistanceY = Math.abs(1 / rayDirectionY)

  let stepCol = 0
  let stepRow = 0
  let sideDistanceX = 0
  let sideDistanceY = 0

  if (rayDirectionX < 0) {
    stepCol = -1
    sideDistanceX = (player.x - mapCol) * deltaDistanceX
  } else {
    stepCol = 1
    sideDistanceX = (mapCol + 1 - player.x) * deltaDistanceX
  } // end if rayDirectionX sign

  if (rayDirectionY < 0) {
    stepRow = -1
    sideDistanceY = (player.y - mapRow) * deltaDistanceY
  } else {
    stepRow = 1
    sideDistanceY = (mapRow + 1 - player.y) * deltaDistanceY
  } // end if rayDirectionY sign

  let hit = false
  let side: 0 | 1 = 0
  let distance = 0

  while (!hit && distance < MAX_DEPTH) {
    if (sideDistanceX < sideDistanceY) {
      sideDistanceX += deltaDistanceX
      mapCol += stepCol
      side = 0
    } else {
      sideDistanceY += deltaDistanceY
      mapRow += stepRow
      side = 1
    } // end if shortest side

    if (getCell(mapData, mapCol, mapRow) !== 0) {
      hit = true
    } // end if hit wall
  } // end while dda

  if (!hit) {
    return {
      hit: false,
      dist: MAX_DEPTH,
      side: 0,
      mapCol,
      mapRow
    } // end object no hit
  } // end if no hit

  if (side === 0) {
    distance = (mapCol - player.x + (1 - stepCol) / 2) / rayDirectionX
  } else {
    distance = (mapRow - player.y + (1 - stepRow) / 2) / rayDirectionY
  } // end if side

  return {
    hit: true,
    dist: distance,
    side,
    mapCol,
    mapRow
  } // end object hit
} // end function castRay

export function calculateProjectionPlane(canvasWidth: number): number {
  return canvasWidth / (2 * Math.tan(HALF_FOV))
} // end function calculateProjectionPlane
