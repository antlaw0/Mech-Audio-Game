import { EnemyDefinitionBase } from './enemyBase.js'

export class TankEnemyDefinition extends EnemyDefinitionBase {
  constructor() {
    super({
      id: 'tank',
      name: 'Titan Tank',
      maxHp: 30,
      collisionRadius: 0.5,
      airborne: false,
      flightHeight: 0,
      movementSpeed: 1.2,
      projectileSpeed: 30,
      shotDamage: 18,
      fireRateSeconds: 2.0,
      threatDelaySeconds: 0.36,
      projectileMaxDistance: 57.6,
      behavior: {
        movementPattern: 'wander',
        retargetIntervalSeconds: 5,
        preferredEngageRange: 20,
        lineOfSightRequiredToShoot: true,
        stationary: false
      },
      sounds: {
        attackSound: 'assets/sounds/weapons/tankCannon.ogg',
        hurtSound: 'assets/sounds/tankHit.ogg',
        deathSound: 'assets/sounds/explosions/explosion_2a.ogg',
        positionalLoopSound: 'assets/sounds/tankMoving.ogg'
      }
    })
  } // end constructor TankEnemyDefinition
} // end class TankEnemyDefinition
