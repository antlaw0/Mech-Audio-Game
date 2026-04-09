import { BULLET_MAX_DIST, BULLET_SPEED, PLAYER_HEIGHT } from './constants.js'
import { isWall } from './collision.js'
import type { AudioController, Bullet, Player, SpriteObject } from './types.js'

const BULLET_HIT_RADIUS = 0.25

export function spawnBullet(player: Player): Bullet {
  return {
    x: player.x,
    y: player.y,
    angle: player.angle,
    pitch: player.pitch,
    distance: 0,
    alive: true
  } // end object bullet
} // end function spawnBullet

function computeFloorCeilHitDistance(pitch: number): number {
  // Bullet world-height at travel distance d = PLAYER_HEIGHT + d * tan(pitch).
  // Hit floor (height 0) if pitch < 0: d = PLAYER_HEIGHT / tan(-pitch)
  // Hit ceiling (height 1) if pitch > 0: d = (1 - PLAYER_HEIGHT) / tan(pitch)
  const absPitch = Math.abs(pitch)
  if (absPitch < 0.001) {
    return BULLET_MAX_DIST
  } // end if no pitch

  if (pitch > 0) {
    // looking up → ceiling at height 1
    return (1 - PLAYER_HEIGHT) / Math.tan(pitch)
  } // end if upward pitch

  // looking down → floor at height 0
  return PLAYER_HEIGHT / Math.tan(-pitch)
} // end function computeFloorCeilHitDistance

export function updateBullets(
  bullets: Bullet[],
  mapData: Uint8Array,
  sprites: SpriteObject[],
  audio: AudioController,
  player: Player,
  deltaSeconds: number
): void {
  for (let index = 0; index < bullets.length; index += 1) {
    const bullet = bullets[index]
    if (!bullet || !bullet.alive) {
      continue
    } // end if dead or missing bullet

    const step = BULLET_SPEED * deltaSeconds
    const cosA = Math.cos(bullet.angle)
    const sinA = Math.sin(bullet.angle)
    const nextX = bullet.x + cosA * step
    const nextY = bullet.y + sinA * step
    const nextDist = bullet.distance + step

    // Floor/ceiling hit — computed from the bullet's pitch angle
    const floorCeilDist = computeFloorCeilHitDistance(bullet.pitch)
    if (nextDist >= floorCeilDist) {
      // Impact at the point along the path where it would hit floor/ceiling
      const hitFraction = (floorCeilDist - bullet.distance) / step
      const hitX = bullet.x + cosA * step * hitFraction
      const hitY = bullet.y + sinA * step * hitFraction
      bullet.alive = false
      audio.playImpact(hitX, hitY, player.x, player.y, player.angle)
      continue
    } // end if floor/ceiling hit

    // Max travel distance exceeded — bullet expires silently
    if (nextDist >= BULLET_MAX_DIST) {
      bullet.alive = false
      continue
    } // end if max distance exceeded

    // Wall hit
    if (isWall(mapData, nextX, nextY)) {
      bullet.alive = false
      audio.playImpact(nextX, nextY, player.x, player.y, player.angle)
      continue
    } // end if wall hit

    // Sprite hit — check each sprite's circular radius
    let spriteHit = false
    for (let si = 0; si < sprites.length; si += 1) {
      const sprite = sprites[si]
      if (!sprite) {
        continue
      } // end if missing sprite

      const sdx = nextX - sprite.x
      const sdy = nextY - sprite.y
      if (Math.hypot(sdx, sdy) < sprite.radius + BULLET_HIT_RADIUS) {
        spriteHit = true
        bullet.alive = false
        audio.playImpact(sprite.x, sprite.y, player.x, player.y, player.angle)
        break
      } // end if sprite radius hit
    } // end for each sprite

    if (spriteHit) {
      continue
    } // end if sprite was hit

    // No collision — advance bullet
    bullet.x = nextX
    bullet.y = nextY
    bullet.distance = nextDist
  } // end for each bullet
} // end function updateBullets
