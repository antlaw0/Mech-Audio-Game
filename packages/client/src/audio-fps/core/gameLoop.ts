import type Phaser from 'phaser'
import { clamp, normalizeAngle } from '../utils/mathUtils.js'
import { fromAngle, lengthVec2, subVec2, vec2 } from '../utils/vector.js'
import type { AudioManager } from '../audio/audioManager.js'
import { castNavigationPingRays, getNearestObstacles } from './collision.js'
import type { InputController } from './input.js'
import type { WorldState } from './worldTypes.js'
import { stepPlayerPhysics } from './physics.js'
import audioConfig from '../config/audioConfig.json'

export class GameLoop {
  private autoSweepTimer = audioConfig.navigation.autoSweepIntervalSeconds
  private bulletId = 0

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldState,
    private readonly input: InputController,
    private readonly audio: AudioManager,
    private readonly debugText: Phaser.GameObjects.Text
  ) {}

  update(dt: number): void {
    this.world.timeSeconds += dt
    const controls = this.input.sample()

    const movement = stepPlayerPhysics(
      this.world.player,
      controls,
      this.world.obstacles,
      this.world.bounds,
      dt
    )

    const nearbyObstacles = getNearestObstacles(this.world.player, this.world.obstacles, 12)
    this.audio.obstacleCues.updateBackgroundCues(nearbyObstacles)

    if (nearbyObstacles.length > 0) {
      this.world.debug.nearestObstacleDistance = nearbyObstacles[0]!.distance
    }

    if (movement.collided) {
      this.audio.uiAudio.playUI('impact')
    }

    this.audio.updateBoundaryWarning(movement.boundaryDistance)

    for (const enemy of this.world.enemies) {
      if (!enemy.alive) {
        continue
      }

      const toPlayer = subVec2(this.world.player.position, enemy.position)
      const distance = lengthVec2(toPlayer)
      const enemyMove = fromAngle(enemy.heading, 1.8 + (enemy.type === 'tank' ? 0 : 0.8))

      enemy.position.x = clamp(enemy.position.x + enemyMove.x * dt, this.world.bounds.minX + 0.5, this.world.bounds.maxX - 0.5)
      enemy.position.y = clamp(enemy.position.y + enemyMove.y * dt, this.world.bounds.minY + 0.5, this.world.bounds.maxY - 0.5)
      enemy.velocity = enemyMove

      const desiredHeading = Math.atan2(toPlayer.y, toPlayer.x)
      enemy.heading = normalizeAngle(enemy.heading + clamp(desiredHeading - enemy.heading, -1.2 * dt, 1.2 * dt))

      const los = this.hasLineOfSight(enemy.position.x, enemy.position.y, this.world.player.position.x, this.world.player.position.y)
      if (enemy.seesPlayer !== los) {
        enemy.seesPlayer = los
        this.audio.enemyCues.playCoverChangeCue(enemy.id, !los)
      }

      enemy.inCover = nearbyObstacles.some((item) => {
        const ex = enemy.position.x - item.obstacle.x
        const ey = enemy.position.y - item.obstacle.y
        return ex * ex + ey * ey <= (item.obstacle.radius + 1.4) * (item.obstacle.radius + 1.4)
      })

      if (distance <= 14 && los) {
        this.audio.enemyCues.playEnemyCue(enemy.id, 'los-enter')
      }

      if (distance <= 18 && los && enemy.fireCooldown <= 0) {
        enemy.fireCooldown = 1.2
        this.audio.enemyCues.playEnemyCue(enemy.id, 'fire')
        this.audio.uiAudio.playUI('health-alert')
      }
      enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt)
    }

    this.audio.syncWorldAudio(this.world)

    if (controls.firePressed) {
      this.firePlayerWeapon()
    }

    if (controls.compassPressed) {
      const dx = this.world.objective.x - this.world.player.position.x
      const dy = this.world.objective.y - this.world.player.position.y
      const angle = Math.atan2(dy, dx)
      this.audio.uiAudio.playCompassCue(angle)
    }

    if (controls.manualPingPressed) {
      const hits = castNavigationPingRays(
        this.world.player,
        this.world.obstacles,
        audioConfig.navigation.pingRays,
        audioConfig.navigation.pingRange
      )
      this.audio.uiAudio.playNavigationPing(hits)
      this.scene.events.emit('debug-log', `[nav] manual ping rays=${hits.length}`)
    }

    this.autoSweepTimer -= dt
    this.world.debug.sonarSweepSeconds = Math.max(0, this.autoSweepTimer)
    if (this.autoSweepTimer <= 0) {
      this.autoSweepTimer = audioConfig.navigation.autoSweepIntervalSeconds
      this.audio.runAutoSweep(this.world)
    }

    this.world.debug.fps = Math.round(1 / Math.max(dt, 0.0001))
    this.world.debug.playerX = this.world.player.position.x
    this.world.debug.playerY = this.world.player.position.y
    this.world.debug.headingDeg = Math.round((this.world.player.heading * 180) / Math.PI)
    this.world.debug.enemyCount = this.world.enemies.filter((enemy) => enemy.alive).length
    this.updateDebugOverlay()
  }

  private firePlayerWeapon(): void {
    this.audio.uiAudio.playUI('weapon-fire')

    const bulletDirection = fromAngle(this.world.player.heading, 1)
    this.world.bullets.push({
      id: `pb-${this.bulletId}`,
      ownerId: 'player',
      position: vec2(this.world.player.position.x, this.world.player.position.y),
      velocity: vec2(bulletDirection.x * 14, bulletDirection.y * 14),
      lifeSeconds: 1.2
    })
    this.bulletId += 1

    const hitEnemy = this.world.enemies.find((enemy) => {
      if (!enemy.alive) {
        return false
      }
      const toEnemy = subVec2(enemy.position, this.world.player.position)
      const distance = lengthVec2(toEnemy)
      if (distance > 16) {
        return false
      }
      const angle = Math.atan2(toEnemy.y, toEnemy.x)
      const delta = Math.abs(normalizeAngle(angle - this.world.player.heading))
      return delta <= 0.14
    })

    if (hitEnemy) {
      hitEnemy.health -= 35
      this.audio.uiAudio.playUI(hitEnemy.type === 'tank' ? 'impact-heavy' : 'impact-light')
      if (hitEnemy.health <= 0) {
        hitEnemy.alive = false
        this.audio.enemyCues.playEnemyCue(hitEnemy.id, 'destroyed')
      }
    }
  }

  private hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0
    const dy = y1 - y0
    const total = Math.hypot(dx, dy)
    if (total < 0.1) {
      return true
    }
    const step = 0.45
    const nx = dx / total
    const ny = dy / total

    for (let t = step; t < total; t += step) {
      const sx = x0 + nx * t
      const sy = y0 + ny * t
      const blocked = this.world.obstacles.some((obstacle) => {
        const ox = sx - obstacle.x
        const oy = sy - obstacle.y
        return ox * ox + oy * oy <= obstacle.radius * obstacle.radius
      })
      if (blocked) {
        return false
      }
    }

    return true
  }

  private updateDebugOverlay(): void {
    this.debugText.setText([
      'Audio FPS Prototype (Phaser + Tone.js)',
      'WASD move, Q/E turn, SPACE fire, C compass, P ping',
      `FPS: ${this.world.debug.fps}`,
      `Player: ${this.world.debug.playerX.toFixed(1)}, ${this.world.debug.playerY.toFixed(1)} heading=${this.world.debug.headingDeg} deg`,
      `Nearest obstacle: ${this.world.debug.nearestObstacleDistance.toFixed(2)}`,
      `Enemies alive: ${this.world.debug.enemyCount}`,
      `Auto sweep in: ${this.world.debug.sonarSweepSeconds.toFixed(1)}s`
    ])
  }
}
