import { MAP_HEIGHT, MAP_WIDTH, PLAYER_RADIUS } from './constants.js'
import { getCell } from './map-data.js'
import type { SpriteObject } from './types.js'

export function isWall(mapData: Uint8Array, x: number, y: number): boolean {
  const col = Math.floor(x)
  const row = Math.floor(y)

  if (col < 0 || col >= MAP_WIDTH || row < 0 || row >= MAP_HEIGHT) {
    return true
  } // end if out of bounds

  return getCell(mapData, col, row) !== 0
} // end function isWall

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
