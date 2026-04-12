import * as Tone from 'tone'
import audioConfig from '../config/audioConfig.json'
import type { EnemyState, WorldState } from '../core/worldTypes.js'
import { shortestAngleBetween } from '../utils/mathUtils.js'
import { lengthVec2, subVec2 } from '../utils/vector.js'
import { EnemyCues } from './enemyCues.js'
import { ObstacleCues } from './obstacleCues.js'
import { PositionalAudioEngine } from './positionalAudio.js'
import { UIAudio } from './uiAudio.js'

export class AudioManager {
  readonly positional: PositionalAudioEngine
  readonly uiAudio: UIAudio
  readonly obstacleCues: ObstacleCues
  readonly enemyCues: EnemyCues

  private started = false
  private readonly eventLog: (message: string) => void
  private boundaryCooldown = 0

  constructor(log: (message: string) => void) {
    this.eventLog = log
    this.positional = new PositionalAudioEngine(log)
    this.uiAudio = new UIAudio(log)
    this.obstacleCues = new ObstacleCues(log)
    this.enemyCues = new EnemyCues(log)
    Tone.Destination.volume.value = Tone.gainToDb(audioConfig.masterVolume)
  }

  async ensureStarted(): Promise<void> {
    if (this.started) {
      return
    }

    await Tone.start()
    await Tone.loaded()
    this.started = true
    this.eventLog('[audio] context started')
  }

  isStarted(): boolean {
    return this.started
  }

  registerEnemy(enemy: EnemyState): void {
    this.enemyCues.registerEnemy(enemy)
  }

  playEnemyCue(enemyId: string, cueType: 'spawn' | 'fire' | 'hit' | 'destroyed' | 'los-enter' | 'los-lost' | 'cover-enter' | 'cover-leave'): void {
    if (!this.started) {
      return
    }

    this.enemyCues.playEnemyCue(enemyId, cueType)
  }

  playWorldOneShot(audioFile: string): void {
    if (!this.started) {
      return
    }

    this.enemyCues.playSample(audioFile)
  }

  syncWorldAudio(world: WorldState): void {
    if (!this.started) {
      return
    }

    const listener = {
      x: world.player.position.x,
      y: world.player.position.y,
      z: world.player.altitude * 8
    }

    for (const enemy of world.enemies) {
      const sourceId = `enemy-${enemy.id}`
      this.positional.createPositionalSource(sourceId, enemy.loopSound, true, {
        x: enemy.position.x,
        y: enemy.position.y,
        z: enemy.altitude * 8
      })

      this.positional.updateSourcePosition(sourceId, {
        x: enemy.position.x,
        y: enemy.position.y,
        z: enemy.altitude * 8
      })
      this.positional.setSourceVelocity(sourceId, {
        x: enemy.velocity.x,
        y: enemy.velocity.y,
        z: 0
      })
      this.positional.setSourceActive(sourceId, enemy.alive)
    }

    this.positional.updateFrame(listener)

    const nearestAlive = world.enemies
      .filter((enemy) => enemy.alive)
      .map((enemy) => {
        const offset = subVec2(enemy.position, world.player.position)
        const distance = lengthVec2(offset)
        const bearing = Math.atan2(offset.y, offset.x)
        const relative = shortestAngleBetween(bearing, world.player.heading)
        return { enemy, distance, relative }
      })
      .sort((a, b) => a.distance - b.distance)[0]

    if (!nearestAlive) {
      return
    }

    this.enemyCues.updateTrackingTone(nearestAlive.relative, nearestAlive.distance)

    const horizontalAligned = Math.abs(nearestAlive.relative) <= 0.08
    if (horizontalAligned) {
      this.uiAudio.playUI('objective-marker')
    }

    const verticalAligned = nearestAlive.enemy.type === 'helicopter' || nearestAlive.enemy.type === 'drone'
    if (verticalAligned && nearestAlive.distance < 16) {
      this.uiAudio.playUI('reload')
    }

    if (horizontalAligned && nearestAlive.distance <= 12) {
      this.uiAudio.playUI('impact-light')
    }
  }

  updateBoundaryWarning(distanceToBoundary: number): void {
    if (!this.started) {
      return
    }

    this.boundaryCooldown -= 1 / 60
    if (distanceToBoundary > 7 || this.boundaryCooldown > 0) {
      return
    }

    this.uiAudio.playUI('health-alert')
    this.boundaryCooldown = distanceToBoundary < 2 ? 0.25 : 0.8
  }

  runAutoSweep(world: WorldState): void {
    if (!this.started) {
      return
    }

    const nearestObstacle = [...world.obstacles]
      .map((obstacle) => {
        const dx = obstacle.x - world.player.position.x
        const dy = obstacle.y - world.player.position.y
        const distance = Math.hypot(dx, dy) - obstacle.radius
        return { obstacle, distance, angle: Math.atan2(dy, dx) }
      })
      .sort((a, b) => a.distance - b.distance)[0]

    const nearestEnemy = [...world.enemies]
      .filter((enemy) => enemy.alive)
      .map((enemy) => {
        const dx = enemy.position.x - world.player.position.x
        const dy = enemy.position.y - world.player.position.y
        return { enemy, distance: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) }
      })
      .sort((a, b) => a.distance - b.distance)[0]

    if (nearestObstacle) {
      this.obstacleCues.playObstacleProximityCue(
        nearestObstacle.distance,
        shortestAngleBetween(nearestObstacle.angle, world.player.heading)
      )
    }

    if (nearestEnemy) {
      this.uiAudio.playCompassCue(shortestAngleBetween(nearestEnemy.angle, world.player.heading))
      this.enemyCues.playEnemyCue(nearestEnemy.enemy.id, 'los-enter')
    }

    this.eventLog('[audio] auto sweep executed')
  }
}
