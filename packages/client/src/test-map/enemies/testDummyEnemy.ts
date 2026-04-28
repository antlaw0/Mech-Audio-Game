import { EnemyDefinitionBase } from './enemyBase.js'

export class TestDummyEnemyDefinition extends EnemyDefinitionBase {
  constructor() {
    super({
      id: 'test-dummy',
      name: 'Test Dummy',
      maxHp: 100,
      collisionRadius: 0.55,
      airborne: false,
      flightHeight: 0,
      movementSpeed: 0,
      projectileSpeed: 20,
      shotDamage: 1,
      fireRateSeconds: 10,
      threatDelaySeconds: 0,
      projectileMaxDistance: 10,
      behavior: {
        movementPattern: 'hold-and-pivot',
        retargetIntervalSeconds: 999,
        preferredEngageRange: 6,
        lineOfSightRequiredToShoot: true,
        stationary: true
      },
      sounds: {
        attackSound: 'assets/sounds/weapons/swing_medium.ogg',
        hurtSound: 'assets/sounds/tankHit.ogg',
        deathSound: 'assets/sounds/explosions/explosion_2a.ogg',
        positionalLoopSound: 'assets/sounds/tankMoving.ogg'
      }
    })
  } // end constructor TestDummyEnemyDefinition
} // end class TestDummyEnemyDefinition