import { EnemyDefinitionBase } from './enemyBase.js'

export class HelicopterEnemyDefinition extends EnemyDefinitionBase {
  constructor() {
    super({
      id: 'helicopter',
      name: 'Attack Helicopter',
      maxHp: 30,
      collisionRadius: 0.46,
      airborne: true,
      movementSpeed: 2,
      projectileSpeed: 30,
      shotDamage: 5,
      fireRateSeconds: 2.0,
      threatDelaySeconds: 0.32,
      projectileMaxDistance: 57.6,
      behavior: {
        movementPattern: 'wander',
        retargetIntervalSeconds: 4,
        preferredEngageRange: 24,
        lineOfSightRequiredToShoot: true
      },
      sounds: {
        attackSound: 'assets/sounds/weapons/pistol_fire.ogg',
        hurtSound: 'assets/sounds/tankHit.ogg',
        deathSound: 'assets/sounds/explosion_2a.ogg',
        positionalLoopSound: 'assets/sounds/helicopterLoop.ogg'
      }
    })
  } // end constructor HelicopterEnemyDefinition
} // end class HelicopterEnemyDefinition