import { EnemyDefinitionBase } from './enemyBase.js'

export class StrikerEnemyDefinition extends EnemyDefinitionBase {
  constructor() {
    super({
      id: 'striker',
      name: 'Striker Walker',
      maxHp: 22,
      collisionRadius: 0.42,
      airborne: false,
      flightHeight: 0,
      movementSpeed: 1.8,
      projectileSpeed: 36,
      shotDamage: 12,
      fireRateSeconds: 1.35,
      threatDelaySeconds: 0.22,
      projectileMaxDistance: 54,
      behavior: {
        movementPattern: 'aggressive-wander',
        retargetIntervalSeconds: 2.4,
        preferredEngageRange: 16,
        lineOfSightRequiredToShoot: true
      },
      sounds: {
        attackSound: 'assets/sounds/explosion_1A.ogg',
        hurtSound: 'assets/sounds/explosion_1B.ogg',
        deathSound: 'assets/sounds/explosion_2a.ogg',
        positionalLoopSound: 'assets/sounds/tankMoving.ogg'
      }
    })
  } // end constructor StrikerEnemyDefinition
} // end class StrikerEnemyDefinition
