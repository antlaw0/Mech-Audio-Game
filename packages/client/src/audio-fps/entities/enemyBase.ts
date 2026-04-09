import type { EnemyState, EnemyType, Obstacle, PlayerState, WorldBounds } from '../core/worldTypes.js'
import { clamp, normalizeAngle, shortestAngleBetween } from '../utils/mathUtils.js'
import { fromAngle, lengthVec2, normalizeVec2, subVec2, vec2 } from '../utils/vector.js'

interface EnemyUpdateContext {
  dt: number
  player: PlayerState
  obstacles: Obstacle[]
  bounds: WorldBounds
}

export class EnemyBase {
  protected readonly maxSpeed: number
  protected readonly turnSpeed: number
  protected readonly engagementDistance: number

  readonly state: EnemyState

  constructor(id: string, type: EnemyType, x: number, y: number, maxSpeed: number, turnSpeed: number) {
    this.maxSpeed = maxSpeed
    this.turnSpeed = turnSpeed
    this.engagementDistance = 14
    this.state = {
      id,
      type,
      position: vec2(x, y),
      velocity: vec2(0, 0),
      heading: 0,
      health: 100,
      alive: true,
      inCover: false,
      seesPlayer: false,
      fireCooldown: 0
    }
  }

  update(context: EnemyUpdateContext): void {
    const { dt, player, obstacles, bounds } = context
    if (!this.state.alive) {
      return
    }

    this.state.fireCooldown = Math.max(0, this.state.fireCooldown - dt)

    const toPlayer = subVec2(player.position, this.state.position)
    const playerDistance = lengthVec2(toPlayer)
    const desiredHeading = Math.atan2(toPlayer.y, toPlayer.x)
    const headingDelta = shortestAngleBetween(desiredHeading, this.state.heading)

    this.state.heading = normalizeAngle(this.state.heading + clamp(headingDelta, -this.turnSpeed * dt, this.turnSpeed * dt))
    this.state.seesPlayer = this.checkLineOfSight(player.position, obstacles)

    if (this.state.seesPlayer && playerDistance <= this.engagementDistance) {
      const retreat = fromAngle(this.state.heading + Math.PI, this.maxSpeed * 0.25)
      this.state.velocity = retreat
      this.state.inCover = this.findNearbyCover(obstacles)
      return
    }

    const forward = fromAngle(this.state.heading, this.maxSpeed)
    this.state.velocity = forward
    this.state.position.x = clamp(this.state.position.x + this.state.velocity.x * dt, bounds.minX + 0.5, bounds.maxX - 0.5)
    this.state.position.y = clamp(this.state.position.y + this.state.velocity.y * dt, bounds.minY + 0.5, bounds.maxY - 0.5)
    this.state.inCover = this.findNearbyCover(obstacles)
  }

  canFireAtPlayer(player: PlayerState): boolean {
    if (!this.state.alive || this.state.fireCooldown > 0 || !this.state.seesPlayer) {
      return false
    }

    const distance = lengthVec2(subVec2(player.position, this.state.position))
    if (distance > this.engagementDistance + 4) {
      return false
    }

    this.state.fireCooldown = 0.95
    return true
  }

  applyDamage(damage: number): void {
    this.state.health -= damage
    if (this.state.health <= 0) {
      this.state.health = 0
      this.state.alive = false
      this.state.velocity = vec2(0, 0)
    }
  }

  private checkLineOfSight(target: { x: number; y: number }, obstacles: Obstacle[]): boolean {
    const toTarget = subVec2(target, this.state.position)
    const direction = normalizeVec2(toTarget)
    const distance = lengthVec2(toTarget)
    if (distance < 0.1) {
      return true
    }

    const step = 0.5
    for (let t = step; t < distance; t += step) {
      const sampleX = this.state.position.x + direction.x * t
      const sampleY = this.state.position.y + direction.y * t
      const blocked = obstacles.some((obstacle) => {
        const dx = sampleX - obstacle.x
        const dy = sampleY - obstacle.y
        return dx * dx + dy * dy <= obstacle.radius * obstacle.radius
      })
      if (blocked) {
        return false
      }
    }
    return true
  }

  private findNearbyCover(obstacles: Obstacle[]): boolean {
    return obstacles.some((obstacle) => {
      const dx = this.state.position.x - obstacle.x
      const dy = this.state.position.y - obstacle.y
      return dx * dx + dy * dy < (obstacle.radius + 2) * (obstacle.radius + 2)
    })
  }
}
