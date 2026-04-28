import { EnemyDefinitionBase } from './enemyBase.js'

export class BruteEnemyDefinition extends EnemyDefinitionBase {
  constructor() {
    super({
      id: 'brute',
      name: 'Brute Siege Unit',
      maxHp: 55,
      collisionRadius: 0.62,
      airborne: false,
      flightHeight: 0,
      movementSpeed: 0.85,
      projectileSpeed: 24,
      shotDamage: 28,
      fireRateSeconds: 2.8,
      threatDelaySeconds: 0.45,
      projectileMaxDistance: 60,
      behavior: {
        movementPattern: 'aggressive-wander',
        retargetIntervalSeconds: 7,
        preferredEngageRange: 4,
        lineOfSightRequiredToShoot: true,
        stationary: false
      },
      melee: {
        damage: 34,
        cooldownSeconds: 1.35,
        range: 2.6,
        coneAngleDegrees: 85
      },
      sounds: {
        attackSound: 'assets/sounds/weapons/swing_heavy1.ogg',
        hurtSound: 'assets/sounds/explosions/explosion_1B.ogg',
        deathSound: 'assets/sounds/explosions/explosion_2a.ogg',
        positionalLoopSound: 'assets/sounds/tankMoving.ogg'
      }
    })
  } // end constructor BruteEnemyDefinition
} // end class BruteEnemyDefinition
