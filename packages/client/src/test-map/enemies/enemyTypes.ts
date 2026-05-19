export type EnemyId = 'tank' | 'striker' | 'brute' | 'helicopter' | 'bruiser' | 'test-dummy'

export type EnemyMovementPattern = 'wander' | 'aggressive-wander' | 'hold-and-pivot'

export interface EnemyBehaviorDefinition {
  movementPattern: EnemyMovementPattern
  retargetIntervalSeconds: number
  preferredEngageRange: number
  lineOfSightRequiredToShoot: boolean
  stationary: boolean
} // end interface EnemyBehaviorDefinition

export interface EnemyAutomaticFireDefinition {
  enabled: boolean
  burstRoundCounts: number[]
  burstIntervalSeconds: number
  burstAudioPrefix: string
} // end interface EnemyAutomaticFireDefinition

export interface EnemyMeleeDefinition {
  damage: number
  cooldownSeconds: number
  range: number
  coneAngleDegrees: number
} // end interface EnemyMeleeDefinition

export interface EnemySoundDefinition {
  startupSound?: string
  attackSound: string
  hurtSound: string
  deathSound: string
  positionalLoopSound: string
  /** Milliseconds to pause between loop iterations. 0 or undefined = continuous loop. */
  loopSoundPauseIntervalMs?: number
  /** Maximum distance in world units for loop audibility. */
  loopSoundMaxDistance?: number
  /** If true, stop the loop sound when the enemy is not moving and resume when it moves again. If false or undefined, always loop. */
  stopLoopSoundWhileStationary?: boolean
} // end interface EnemySoundDefinition

export interface EnemyDefinitionConfig {
  id: EnemyId
  name: string
  maxHp: number
  collisionRadius: number
  airborne: boolean
  flightHeight?: number
  movementSpeed: number
  projectileSpeed: number
  shotDamage: number
  fireRateSeconds: number
  threatDelaySeconds: number
  projectileMaxDistance: number
  behavior: EnemyBehaviorDefinition
  automaticFire?: EnemyAutomaticFireDefinition
  melee?: EnemyMeleeDefinition
  sounds: EnemySoundDefinition
} // end interface EnemyDefinitionConfig
