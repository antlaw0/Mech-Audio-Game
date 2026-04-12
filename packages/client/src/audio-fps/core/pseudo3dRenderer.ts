import type Phaser from 'phaser'
import type { EnemyState, Obstacle, WorldState } from './worldTypes.js'

interface RayHit {
  distance: number
  material: Obstacle['material'] | 'boundary'
}

const FOV = Math.PI / 3

const materialColor = (material: Obstacle['material'] | 'boundary'): number => {
  if (material === 'metal') {
    return 0x91b3c9
  }
  if (material === 'concrete') {
    return 0x8a8a8a
  }
  if (material === 'foliage') {
    return 0x3f7f4a
  }
  return 0x557eb4
}

export class Pseudo3dRenderer {
  private readonly depthByColumn: number[] = []

  constructor(private readonly graphics: Phaser.GameObjects.Graphics) {}

  render(world: WorldState, viewportWidth: number, viewportHeight: number): void {
    this.graphics.clear()
    const horizon = viewportHeight * 0.5

    // Sky and floor layers.
    this.graphics.fillStyle(0x081827, 1)
    this.graphics.fillRect(0, 0, viewportWidth, horizon)
    this.graphics.fillStyle(0x0e1115, 1)
    this.graphics.fillRect(0, horizon, viewportWidth, viewportHeight - horizon)
    this.graphics.fillStyle(0x113247, 0.18)
    this.graphics.fillRect(0, horizon - 48, viewportWidth, 24)

    const projectionPlane = viewportWidth / (2 * Math.tan(FOV / 2))
    const playerX = world.player.position.x
    const playerY = world.player.position.y
    const playerHeading = world.player.heading

    const rayStepPixels = 2
    for (let x = 0; x < viewportWidth; x += rayStepPixels) {
      const cameraX = (x / viewportWidth) * 2 - 1
      const rayAngle = playerHeading + cameraX * (FOV * 0.5)
      const rayDirX = Math.cos(rayAngle)
      const rayDirY = Math.sin(rayAngle)

      const hit = this.castRay(playerX, playerY, rayDirX, rayDirY, world)
      const correctedDistance = Math.max(0.001, hit.distance * Math.cos(rayAngle - playerHeading))
      this.depthByColumn[x] = correctedDistance

      const top = this.projectScreenY(world.verticality.airLayerHeight, world.player.altitude, correctedDistance, horizon, projectionPlane)
      const bottom = this.projectScreenY(0, world.player.altitude, correctedDistance, horizon, projectionPlane)
      const wallTop = Math.min(top, bottom)
      const wallHeight = Math.max(1, Math.abs(bottom - top))
      const shade = Math.max(0.18, 1 - correctedDistance / 32)

      this.graphics.fillStyle(materialColor(hit.material), shade)
      this.graphics.fillRect(x, wallTop, rayStepPixels, wallHeight)
    }

    this.renderEnemies(world.enemies, world, viewportWidth, viewportHeight, projectionPlane)
    this.renderCrosshair(viewportWidth, viewportHeight)
  }

  private renderEnemies(
    enemies: EnemyState[],
    world: WorldState,
    viewportWidth: number,
    viewportHeight: number,
    projectionPlane: number
  ): void {
    const horizon = viewportHeight * 0.5
    const visible = enemies
      .filter((enemy) => enemy.alive)
      .map((enemy) => {
        const dx = enemy.position.x - world.player.position.x
        const dy = enemy.position.y - world.player.position.y
        const distance = Math.hypot(dx, dy)
        let relative = Math.atan2(dy, dx) - world.player.heading
        while (relative > Math.PI) {
          relative -= Math.PI * 2
        }
        while (relative < -Math.PI) {
          relative += Math.PI * 2
        }
        return { enemy, distance, relative }
      })
      .filter((entry) => Math.abs(entry.relative) <= FOV * 0.65)
      .sort((a, b) => b.distance - a.distance)

    for (const entry of visible) {
      const screenX = (0.5 + entry.relative / FOV) * viewportWidth
      const spriteHeight = Math.max(
        8,
        (projectionPlane * this.getEnemyVisualHeight(entry.enemy)) / Math.max(0.001, entry.distance)
      )
      const spriteWidth = spriteHeight * 0.45
      const left = Math.floor(screenX - spriteWidth * 0.5)

      const occluded = this.isOccluded(left, entry.distance)
      if (occluded) {
        continue
      }

      const alpha = Math.max(0.25, 1 - entry.distance / 28)
      const bodyColor =
        entry.enemy.type === 'tank' ? 0xd64933 :
          entry.enemy.type === 'drone' ? 0xf0cd5d :
            entry.enemy.type === 'helicopter' ? 0x7cc7de : 0xd36a41
      const bottom = this.projectScreenY(
        entry.enemy.altitude,
        world.player.altitude,
        Math.max(0.001, entry.distance),
        horizon,
        projectionPlane
      )

      this.graphics.fillStyle(bodyColor, alpha)
      this.graphics.fillRect(
        left,
        bottom - spriteHeight,
        spriteWidth,
        spriteHeight
      )
    }
  }

  private renderCrosshair(viewportWidth: number, viewportHeight: number): void {
    const cx = viewportWidth * 0.5
    const cy = viewportHeight * 0.5
    this.graphics.lineStyle(1.4, 0x8be8ff, 0.75)
    this.graphics.lineBetween(cx - 8, cy, cx + 8, cy)
    this.graphics.lineBetween(cx, cy - 8, cx, cy + 8)
  }

  private isOccluded(screenX: number, distance: number): boolean {
    const clamped = Math.max(0, Math.min(this.depthByColumn.length - 1, screenX))
    const depth = this.depthByColumn[clamped]
    if (depth === undefined) {
      return false
    }
    return depth < distance
  }

  private castRay(startX: number, startY: number, dirX: number, dirY: number, world: WorldState): RayHit {
    let bestDistance = this.intersectBounds(startX, startY, dirX, dirY, world)
    let bestMaterial: Obstacle['material'] | 'boundary' = 'boundary'

    for (const obstacle of world.obstacles) {
      const hitDistance = this.intersectCircle(startX, startY, dirX, dirY, obstacle)
      if (hitDistance > 0 && hitDistance < bestDistance) {
        bestDistance = hitDistance
        bestMaterial = obstacle.material
      }
    }

    return {
      distance: Math.max(0.001, bestDistance),
      material: bestMaterial
    }
  }

  private intersectBounds(startX: number, startY: number, dirX: number, dirY: number, world: WorldState): number {
    const candidates: number[] = []
    if (Math.abs(dirX) > 0.000001) {
      candidates.push((world.bounds.minX - startX) / dirX)
      candidates.push((world.bounds.maxX - startX) / dirX)
    }
    if (Math.abs(dirY) > 0.000001) {
      candidates.push((world.bounds.minY - startY) / dirY)
      candidates.push((world.bounds.maxY - startY) / dirY)
    }

    let best = Number.POSITIVE_INFINITY
    for (const t of candidates) {
      if (t <= 0.0001) {
        continue
      }
      const hitX = startX + dirX * t
      const hitY = startY + dirY * t
      const inside =
        hitX >= world.bounds.minX - 0.001 &&
        hitX <= world.bounds.maxX + 0.001 &&
        hitY >= world.bounds.minY - 0.001 &&
        hitY <= world.bounds.maxY + 0.001
      if (inside && t < best) {
        best = t
      }
    }

    return Number.isFinite(best) ? best : 999
  }

  private intersectCircle(startX: number, startY: number, dirX: number, dirY: number, obstacle: Obstacle): number {
    const ox = startX - obstacle.x
    const oy = startY - obstacle.y
    const a = dirX * dirX + dirY * dirY
    const b = 2 * (ox * dirX + oy * dirY)
    const c = ox * ox + oy * oy - obstacle.radius * obstacle.radius
    const discriminant = b * b - 4 * a * c
    if (discriminant < 0) {
      return -1
    }

    const sqrtD = Math.sqrt(discriminant)
    const t0 = (-b - sqrtD) / (2 * a)
    const t1 = (-b + sqrtD) / (2 * a)
    const t = t0 > 0.0001 ? t0 : t1 > 0.0001 ? t1 : -1
    return t
  }

  private getEnemyVisualHeight(enemy: EnemyState): number {
    return enemy.layer === 'air' ? 0.7 : 0.85
  }

  private projectScreenY(
    worldHeight: number,
    viewerHeight: number,
    distance: number,
    horizon: number,
    projectionPlane: number
  ): number {
    return horizon - ((worldHeight - viewerHeight) / Math.max(0.001, distance)) * projectionPlane
  }
}
