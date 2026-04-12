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
        movementPattern: 'hold-and-pivot',
        retargetIntervalSeconds: 7,
        preferredEngageRange: 24,
        lineOfSightRequiredToShoot: true
      },
      sounds: {
        attackSound: 'assets/sounds/explosion_1A.ogg',
        hurtSound: 'assets/sounds/explosion_1B.ogg',
        deathSound: 'assets/sounds/explosion_2a.ogg',
        positionalLoopSound: 'assets/sounds/tankMoving.ogg'
      }
    })
  } // end constructor BruteEnemyDefinition
} // end class BruteEnemyDefinition
