export type EnemyId = 'tank' | 'striker' | 'brute' | 'helicopter'

export type EnemyMovementPattern = 'wander' | 'aggressive-wander' | 'hold-and-pivot'

export interface EnemyBehaviorDefinition {
  movementPattern: EnemyMovementPattern
  retargetIntervalSeconds: number
  preferredEngageRange: number
  lineOfSightRequiredToShoot: boolean
} // end interface EnemyBehaviorDefinition

export interface EnemySoundDefinition {
  attackSound: string
  hurtSound: string
  deathSound: string
  positionalLoopSound: string
} // end interface EnemySoundDefinition

export interface EnemyDefinitionConfig {
  id: EnemyId
  name: string
  maxHp: number
  collisionRadius: number
  airborne: boolean
  flightHeight: number
  movementSpeed: number
  projectileSpeed: number
  shotDamage: number
  fireRateSeconds: number
  threatDelaySeconds: number
  projectileMaxDistance: number
  behavior: EnemyBehaviorDefinition
  sounds: EnemySoundDefinition
} // end interface EnemyDefinitionConfig
