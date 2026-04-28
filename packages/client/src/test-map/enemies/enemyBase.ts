import { getSharedFlightHeight } from '../runtime-config.js'
import type { EnemyAutomaticFireDefinition, EnemyBehaviorDefinition, EnemyDefinitionConfig, EnemyId, EnemyMeleeDefinition, EnemySoundDefinition } from './enemyTypes.js'

export abstract class EnemyDefinitionBase {
  readonly id: EnemyId
  readonly name: string
  readonly maxHp: number
  readonly collisionRadius: number
  readonly airborne: boolean
  readonly movementSpeed: number
  readonly projectileSpeed: number
  readonly shotDamage: number
  readonly fireRateSeconds: number
  readonly threatDelaySeconds: number
  readonly projectileMaxDistance: number
  readonly behavior: EnemyBehaviorDefinition
  readonly automaticFire?: EnemyAutomaticFireDefinition
  readonly melee?: EnemyMeleeDefinition
  readonly sounds: EnemySoundDefinition
  private readonly configuredFlightHeight?: number

  get flightHeight(): number {
    if (!this.airborne) {
      return 0
    } // end if ground unit

    return Math.max(0, this.configuredFlightHeight ?? getSharedFlightHeight())
  } // end getter flightHeight

  protected constructor(config: EnemyDefinitionConfig) {
    this.id = config.id
    this.name = config.name
    this.maxHp = config.maxHp
    this.collisionRadius = config.collisionRadius
    this.airborne = config.airborne
    this.configuredFlightHeight = config.flightHeight
    this.movementSpeed = config.movementSpeed
    this.projectileSpeed = config.projectileSpeed
    this.shotDamage = config.shotDamage
    this.fireRateSeconds = config.fireRateSeconds
    this.threatDelaySeconds = config.threatDelaySeconds
    this.projectileMaxDistance = config.projectileMaxDistance
    this.behavior = config.behavior
    this.automaticFire = config.automaticFire
    this.melee = config.melee
    this.sounds = config.sounds
  } // end constructor EnemyDefinitionBase
} // end class EnemyDefinitionBase
