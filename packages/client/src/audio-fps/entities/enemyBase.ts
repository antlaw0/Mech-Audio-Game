import { lineOfSightBlockedByObstacles, resolvePositionAgainstObstacles } from '../core/collision.js'
import type { BulletState, EnemyState, EnemyType, Obstacle, PlayerState, VerticalLayer, WorldBounds } from '../core/worldTypes.js'
import { clamp, normalizeAngle, shortestAngleBetween } from '../utils/mathUtils.js'
import { fromAngle, lengthVec2, normalizeVec2, subVec2, vec2 } from '../utils/vector.js'

export interface EnemyUpdateContext {
  dt: number
  timeSeconds: number
  player: PlayerState
  obstacles: Obstacle[]
  bounds: WorldBounds
}

export interface EnemyConfig {
  maxHealth: number
  movementSpeed: number
  turnSpeed: number
  detectionRadius: number
  attackRange: number
  shotDamage: number
  projectileSpeed: number
  projectileLifeSeconds: number
  fireIntervalSeconds: number
  layer: VerticalLayer
  altitude: number
  ignoresObstacles: boolean
  loopSound: string
  fireSound: string
  loadSound?: string
  hitSound: string
  deathSound: string
  explosiveProjectile?: boolean
}

export class EnemyBase {
  protected readonly config: EnemyConfig
  private wanderHeading = 0
  private wanderTimer = 0
  private pendingLoadCue = true

  readonly state: EnemyState

  constructor(id: string, type: EnemyType, x: number, y: number, config: EnemyConfig, existingState?: EnemyState) {
    this.config = config
    this.state = existingState ?? {
      id,
      type,
      position: vec2(x, y),
      velocity: vec2(0, 0),
      heading: 0,
      health: config.maxHealth,
      alive: true,
      inCover: false,
      seesPlayer: false,
      fireCooldown: 0,
      maxHealth: config.maxHealth,
      layer: config.layer,
      altitude: config.altitude,
      movementSpeed: config.movementSpeed,
      turnSpeed: config.turnSpeed,
      detectionRadius: config.detectionRadius,
      attackRange: config.attackRange,
      shotDamage: config.shotDamage,
      projectileSpeed: config.projectileSpeed,
      projectileLifeSeconds: config.projectileLifeSeconds,
      fireIntervalSeconds: config.fireIntervalSeconds,
      loopSound: config.loopSound,
      fireSound: config.fireSound,
      loadSound: config.loadSound ?? null,
      hitSound: config.hitSound,
      deathSound: config.deathSound,
      explosiveProjectile: config.explosiveProjectile ?? false
    }

    this.state.id = id
    this.state.type = type
    this.state.position.x = x
    this.state.position.y = y
    this.state.maxHealth = config.maxHealth
    this.state.layer = config.layer
    this.state.altitude = config.altitude
    this.state.movementSpeed = config.movementSpeed
    this.state.turnSpeed = config.turnSpeed
    this.state.detectionRadius = config.detectionRadius
    this.state.attackRange = config.attackRange
    this.state.shotDamage = config.shotDamage
    this.state.projectileSpeed = config.projectileSpeed
    this.state.projectileLifeSeconds = config.projectileLifeSeconds
    this.state.fireIntervalSeconds = config.fireIntervalSeconds
    this.state.loopSound = config.loopSound
    this.state.fireSound = config.fireSound
    this.state.loadSound = config.loadSound ?? null
    this.state.hitSound = config.hitSound
    this.state.deathSound = config.deathSound
    this.state.explosiveProjectile = config.explosiveProjectile ?? false
  }

  update(context: EnemyUpdateContext): void {
    const { dt, player, obstacles, bounds } = context
    if (!this.state.alive) {
      this.state.velocity = vec2(0, 0)
      return
    }

    this.state.fireCooldown = Math.max(0, this.state.fireCooldown - dt)

    const toPlayer = subVec2(player.position, this.state.position)
    const playerDistance = lengthVec2(toPlayer)
    const canDetectPlayer =
      playerDistance <= this.state.detectionRadius &&
      !lineOfSightBlockedByObstacles(
        this.state.position.x,
        this.state.position.y,
        player.position.x,
        player.position.y,
        this.state.layer,
        player.layer,
        obstacles
      )

    this.state.seesPlayer = canDetectPlayer

    const desiredHeading = canDetectPlayer ? Math.atan2(toPlayer.y, toPlayer.x) : this.getWanderHeading(context)
    const headingDelta = shortestAngleBetween(desiredHeading, this.state.heading)
    this.state.heading = normalizeAngle(
      this.state.heading + clamp(headingDelta, -this.state.turnSpeed * dt, this.state.turnSpeed * dt)
    )

    const moveSpeed = canDetectPlayer ? this.state.movementSpeed : this.state.movementSpeed * 0.82
    const forward = fromAngle(this.state.heading, moveSpeed)
    this.state.velocity = forward

    const nextX = this.state.position.x + this.state.velocity.x * dt
    const nextY = this.state.position.y + this.state.velocity.y * dt
    if (this.config.ignoresObstacles) {
      this.state.position.x = clamp(nextX, bounds.minX + 0.5, bounds.maxX - 0.5)
      this.state.position.y = clamp(nextY, bounds.minY + 0.5, bounds.maxY - 0.5)
      this.state.inCover = false
      return
    }

    const collision = resolvePositionAgainstObstacles(nextX, nextY, obstacles, 0.58)
    this.state.position.x = clamp(collision.correctedPosition.x, bounds.minX + 0.5, bounds.maxX - 0.5)
    this.state.position.y = clamp(collision.correctedPosition.y, bounds.minY + 0.5, bounds.maxY - 0.5)
    this.state.inCover = this.findNearbyCover(obstacles)
  }

  canFireAtPlayer(player: PlayerState): boolean {
    if (!this.state.alive || this.state.fireCooldown > 0 || !this.state.seesPlayer) {
      return false
    }

    const distance = lengthVec2(subVec2(player.position, this.state.position))
    if (distance > this.state.attackRange) {
      return false
    }

    return true
  }

  createProjectile(projectileId: string, player: PlayerState): BulletState {
    const toPlayer = subVec2(player.position, this.state.position)
    const direction = normalizeVec2(toPlayer)
    const shotDirection = lengthVec2(direction) > 0.001 ? direction : fromAngle(this.state.heading, 1)
    const targetLayer = player.layer

    this.state.fireCooldown = this.state.fireIntervalSeconds

    return {
      id: projectileId,
      ownerId: this.state.id,
      position: vec2(this.state.position.x, this.state.position.y),
      velocity: vec2(shotDirection.x * this.state.projectileSpeed, shotDirection.y * this.state.projectileSpeed),
      lifeSeconds: this.state.projectileLifeSeconds,
      damage: this.state.shotDamage,
      targetLayer,
      altitude: targetLayer === 'air' ? this.state.altitude : 0,
      expiryMode: targetLayer === 'ground'
        ? this.state.explosiveProjectile ? 'explode' : 'impact'
        : this.state.explosiveProjectile ? 'explode' : 'remove'
    }
  }

  applyDamage(damage: number): boolean {
    if (!this.state.alive) {
      return false
    }

    this.state.health -= damage
    if (this.state.health <= 0) {
      this.state.health = 0
      this.state.alive = false
      this.state.velocity = vec2(0, 0)
      return true
    }

    return false
  }

  consumeLoadCue(): string | null {
    if (!this.pendingLoadCue || !this.state.loadSound) {
      return null
    }

    this.pendingLoadCue = false
    return this.state.loadSound
  }

  getHitSound(): string {
    return this.state.hitSound
  }

  getDeathSound(): string {
    return this.state.deathSound
  }

  private getWanderHeading(context: EnemyUpdateContext): number {
    this.wanderTimer -= context.dt
    if (this.wanderTimer > 0) {
      return this.wanderHeading
    }

    const timeFactor = context.timeSeconds * 0.35 + this.state.position.x * 0.13 + this.state.position.y * 0.07
    this.wanderHeading = normalizeAngle(Math.sin(timeFactor) * Math.PI + Math.cos(timeFactor * 0.61) * 0.7)
    this.wanderTimer = 1.8 + Math.abs(Math.sin(timeFactor * 1.7)) * 2.4
    return this.wanderHeading
  }

  private findNearbyCover(obstacles: Obstacle[]): boolean {
    return obstacles.some((obstacle) => {
      const dx = this.state.position.x - obstacle.x
      const dy = this.state.position.y - obstacle.y
      return dx * dx + dy * dy < (obstacle.radius + 2) * (obstacle.radius + 2)
    })
  }
}
