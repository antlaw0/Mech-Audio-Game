import type Phaser from 'phaser'
import { clamp, normalizeAngle } from '../utils/mathUtils.js'
import { fromAngle, lengthVec2, subVec2, vec2 } from '../utils/vector.js'
import type { AudioManager } from '../audio/audioManager.js'
import { castNavigationPingRays, getNearestObstacles } from './collision.js'
import { createEnemyControllerByType } from '../entities/enemyFactory.js'
import type { InputController } from './input.js'
import type { BulletState, EnemyState, EnemyType, VerticalLayer, WorldState } from './worldTypes.js'
import { stepPlayerPhysics } from './physics.js'
import audioConfig from '../config/audioConfig.json'
import type { EnemyBase } from '../entities/enemyBase.js'
import type { AudioPanel } from '../ui/audioPanel.js'

export class GameLoop {
  private autoSweepTimer = audioConfig.navigation.autoSweepIntervalSeconds
  private bulletId = 0
  private enemyProjectileId = 0
  private spawnedEnemyId = 0
  private readonly enemyControllers: EnemyBase[]
  private readonly enemyControllersById = new Map<string, EnemyBase>()
  private readonly pendingSpawnCueIds = new Set<string>()

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldState,
    private readonly input: InputController,
    private readonly audio: AudioManager,
    private readonly debugText: Phaser.GameObjects.Text,
    private readonly audioPanel: AudioPanel
  ) {
    this.enemyControllers = this.world.enemies.map((enemy) =>
      createEnemyControllerByType(
        enemy.id,
        enemy.type,
        enemy.position.x,
        enemy.position.y,
        this.world.verticality.airLayerHeight,
        enemy
      )
    )

    for (const controller of this.enemyControllers) {
      this.enemyControllersById.set(controller.state.id, controller)
      this.audio.registerEnemy(controller.state)
      const loadCue = controller.consumeLoadCue()
      if (loadCue) {
        this.pendingSpawnCueIds.add(controller.state.id)
      }
    }
  }

  update(dt: number): void {
    this.world.timeSeconds += dt
    if (this.audio.isStarted() && this.pendingSpawnCueIds.size > 0) {
      for (const enemyId of this.pendingSpawnCueIds) {
        this.audio.playEnemyCue(enemyId, 'spawn')
      }
      this.pendingSpawnCueIds.clear()
    }

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

    const playerSpeed = Math.hypot(this.world.player.velocity.x, this.world.player.velocity.y)
    this.audio.updatePlayerLocomotionAudio(dt, playerSpeed, 'field')

    this.audio.updateBoundaryWarning(movement.boundaryDistance)

    for (const controller of this.enemyControllers) {
      const enemy = controller.state
      if (!enemy.alive) {
        continue
      }

      const previousLos = enemy.seesPlayer
      const previousCover = enemy.inCover
      controller.update({
        dt,
        timeSeconds: this.world.timeSeconds,
        player: this.world.player,
        obstacles: this.world.obstacles,
        bounds: this.world.bounds
      })

      const toPlayer = subVec2(this.world.player.position, enemy.position)
      const distance = lengthVec2(toPlayer)

      if (enemy.seesPlayer !== previousLos) {
        this.audio.playEnemyCue(enemy.id, enemy.seesPlayer ? 'los-enter' : 'los-lost')
      }

      if (enemy.inCover !== previousCover) {
        this.audio.playEnemyCue(enemy.id, enemy.inCover ? 'cover-enter' : 'cover-leave')
      }

      if (distance <= enemy.attackRange && controller.canFireAtPlayer(this.world.player)) {
        this.world.bullets.push(controller.createProjectile(`eb-${this.enemyProjectileId}`, this.world.player))
        this.enemyProjectileId += 1
        this.audio.playEnemyCue(enemy.id, 'fire')
        this.audio.uiAudio.playUI('health-alert')
      }
    }

    this.updateProjectiles(dt)

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

    if (controls.toggleAudioPanelPressed) {
      this.audioPanel.toggle()
    }

    if (this.world.devMode) {
      if (controls.spawnTankPressed) {
        this.spawnEnemyNearPlayer('tank')
      }
      if (controls.spawnMechPressed) {
        this.spawnEnemyNearPlayer('mech')
      }
      if (controls.spawnHelicopterPressed) {
        this.spawnEnemyNearPlayer('helicopter')
      }
      if (controls.spawnDronePressed) {
        this.spawnEnemyNearPlayer('drone')
      }
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
    const targetLayer = this.getPlayerTargetLayer()
    this.world.bullets.push({
      id: `pb-${this.bulletId}`,
      ownerId: 'player',
      position: vec2(this.world.player.position.x, this.world.player.position.y),
      velocity: vec2(bulletDirection.x * 14, bulletDirection.y * 14),
      lifeSeconds: targetLayer === 'air' ? 1.6 : 1.2,
      damage: 35,
      targetLayer,
      altitude: targetLayer === 'air' ? this.world.verticality.airLayerHeight : 0,
      expiryMode: targetLayer === 'air' ? 'remove' : 'impact'
    })
    this.bulletId += 1
  }

  private getPlayerTargetLayer(): VerticalLayer {
    const target = this.world.enemies
      .filter((enemy) => enemy.alive)
      .map((enemy) => {
        const toEnemy = subVec2(enemy.position, this.world.player.position)
        const distance = lengthVec2(toEnemy)
        const angle = Math.atan2(toEnemy.y, toEnemy.x)
        const delta = Math.abs(normalizeAngle(angle - this.world.player.heading))
        return { enemy, distance, delta }
      })
      .filter((entry) => entry.distance <= 20 && entry.delta <= 0.14)
      .sort((a, b) => a.delta - b.delta || a.distance - b.distance)[0]

    return target?.enemy.layer ?? this.world.player.layer
  }

  private updateProjectiles(dt: number): void {
    const surviving: BulletState[] = []

    for (const bullet of this.world.bullets) {
      const startX = bullet.position.x
      const startY = bullet.position.y
      bullet.position.x += bullet.velocity.x * dt
      bullet.position.y += bullet.velocity.y * dt
      bullet.lifeSeconds -= dt

      if (this.projectileHitsObstacle(startX, startY, bullet) && bullet.targetLayer === 'ground') {
        this.handleProjectileExpiry(bullet, true)
        continue
      }

      if (bullet.ownerId === 'player') {
        const hitEnemy = this.findEnemyHitByProjectile(bullet, startX, startY)
        if (hitEnemy) {
          this.handleEnemyHit(hitEnemy, bullet.damage)
          continue
        }
      } else if (this.world.player.layer === bullet.targetLayer && this.segmentHitsPoint(startX, startY, bullet.position.x, bullet.position.y, this.world.player.position.x, this.world.player.position.y, 0.68)) {
        this.world.player.health = Math.max(0, this.world.player.health - bullet.damage)
        this.audio.uiAudio.playUI(bullet.expiryMode === 'explode' ? 'impact-heavy' : 'impact-light')
        continue
      }

      if (bullet.lifeSeconds <= 0) {
        this.handleProjectileExpiry(bullet, false)
        continue
      }

      surviving.push(bullet)
    }

    this.world.bullets = surviving
  }

  private findEnemyHitByProjectile(bullet: BulletState, startX: number, startY: number): EnemyState | null {
    for (const enemy of this.world.enemies) {
      if (!enemy.alive || enemy.layer !== bullet.targetLayer) {
        continue
      }

      if (this.segmentHitsPoint(startX, startY, bullet.position.x, bullet.position.y, enemy.position.x, enemy.position.y, 0.72)) {
        return enemy
      }
    }

    return null
  }

  private handleEnemyHit(enemy: EnemyState, damage: number): void {
    const controller = this.enemyControllersById.get(enemy.id)
    if (!controller) {
      return
    }

    const destroyed = controller.applyDamage(damage)
    this.audio.uiAudio.playUI(enemy.type === 'tank' || enemy.type === 'helicopter' ? 'impact-heavy' : 'impact-light')
    this.audio.playEnemyCue(enemy.id, destroyed ? 'destroyed' : 'hit')
  }

  private handleProjectileExpiry(bullet: BulletState, collided: boolean): void {
    if (bullet.expiryMode === 'explode') {
      this.audio.uiAudio.playUI('impact-heavy')
      this.audio.playWorldOneShot('assets/sounds/explosions/explosion_2a.ogg')
      return
    }

    if (collided || bullet.expiryMode === 'impact') {
      this.audio.uiAudio.playUI('impact-light')
    }
  }

  private projectileHitsObstacle(startX: number, startY: number, bullet: BulletState): boolean {
    return this.world.obstacles.some((obstacle) =>
      this.segmentHitsPoint(startX, startY, bullet.position.x, bullet.position.y, obstacle.x, obstacle.y, obstacle.radius)
    )
  }

  private segmentHitsPoint(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    targetX: number,
    targetY: number,
    radius: number
  ): boolean {
    const dx = endX - startX
    const dy = endY - startY
    const lengthSquared = dx * dx + dy * dy
    if (lengthSquared <= 0.000001) {
      const offsetX = targetX - startX
      const offsetY = targetY - startY
      return offsetX * offsetX + offsetY * offsetY <= radius * radius
    }

    const t = clamp(((targetX - startX) * dx + (targetY - startY) * dy) / lengthSquared, 0, 1)
    const nearestX = startX + dx * t
    const nearestY = startY + dy * t
    const diffX = targetX - nearestX
    const diffY = targetY - nearestY
    return diffX * diffX + diffY * diffY <= radius * radius
  }

  private updateDebugOverlay(): void {
    const audioStats = this.audio.getDebugStats()
    this.debugText.setText([
      'Audio FPS Prototype (Phaser + Tone.js)',
      'WASD move, Q/E turn, SPACE fire, C compass, P ping',
      'Numpad 1/2/3/4 spawn tank/mech/helicopter/drone (dev)',
      `FPS: ${this.world.debug.fps}`,
      `Player: ${this.world.debug.playerX.toFixed(1)}, ${this.world.debug.playerY.toFixed(1)} heading=${this.world.debug.headingDeg} deg hp=${this.world.player.health}`,
      `Layer: ${this.world.player.layer} altitude=${this.world.player.altitude.toFixed(1)}`,
      `Nearest obstacle: ${this.world.debug.nearestObstacleDistance.toFixed(2)}`,
      `Enemies alive: ${this.world.debug.enemyCount}`,
      `Auto sweep in: ${this.world.debug.sonarSweepSeconds.toFixed(1)}s`,
      `Audio started=${audioStats.started} transients=${audioStats.activeTransientVoices}/${audioStats.totalTransientVoices} pools=${audioStats.samplePools}`,
      `Audio req=${audioStats.transientRequests} drop=${audioStats.transientDropped} steal=${audioStats.transientSteals} restart=${audioStats.transientRestarts}`,
      `Loops active=${audioStats.activeLoopSources}/${audioStats.totalLoopSources} recoveries=${audioStats.loopRecoveries}`,
      `Terrain ambience active=${audioStats.ambienceActive} pools=${audioStats.terrainStepPools}`
    ])
  }

  private spawnEnemyNearPlayer(type: EnemyType): void {
    const spawnRadius = 6.5
    const angle = this.world.player.heading
    const x = clamp(
      this.world.player.position.x + Math.cos(angle) * spawnRadius,
      this.world.bounds.minX + 1,
      this.world.bounds.maxX - 1
    )
    const y = clamp(
      this.world.player.position.y + Math.sin(angle) * spawnRadius,
      this.world.bounds.minY + 1,
      this.world.bounds.maxY - 1
    )

    const id = `${type}-spawn-${this.spawnedEnemyId}`
    this.spawnedEnemyId += 1

    const controller = createEnemyControllerByType(
      id,
      type,
      x,
      y,
      this.world.verticality.airLayerHeight
    )

    this.enemyControllers.push(controller)
    this.enemyControllersById.set(controller.state.id, controller)
    this.world.enemies.push(controller.state)
    this.audio.registerEnemy(controller.state)

    const loadCue = controller.consumeLoadCue()
    if (loadCue) {
      if (this.audio.isStarted()) {
        this.audio.playEnemyCue(controller.state.id, 'spawn')
      } else {
        this.pendingSpawnCueIds.add(controller.state.id)
      }
    }

    this.scene.events.emit('debug-log', `[spawn] ${type} id=${id}`)
  }
}
