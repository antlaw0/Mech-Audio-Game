import { EnemyDefinitionBase } from './enemyBase.js'

export class BruiserEnemyDefinition extends EnemyDefinitionBase {
  constructor() {
    super({
      id: 'bruiser',
      name: 'Bruiser Mech',
      maxHp: 70,
      collisionRadius: 0.6,
      airborne: false,
      flightHeight: 0,
      movementSpeed: 1.95,
      projectileSpeed: 18,
      shotDamage: 1,
      fireRateSeconds: 10,
      threatDelaySeconds: 0,
      projectileMaxDistance: 10,
      behavior: {
        movementPattern: 'aggressive-wander',
        retargetIntervalSeconds: 1.6,
        preferredEngageRange: 3,
        lineOfSightRequiredToShoot: true,
        stationary: false
      },
      melee: {
        damage: 26,
        cooldownSeconds: 0.8,
        range: 2.5,
        coneAngleDegrees: 78
      },
      sounds: {
        attackSound: 'assets/sounds/weapons/swing_medium1.ogg',
        hurtSound: 'assets/sounds/tankHit.ogg',
        deathSound: 'assets/sounds/explosions/explosion_2a.ogg',
        positionalLoopSound: 'assets/sounds/tankMoving.ogg'
      }
    })
  } // end constructor BruiserEnemyDefinition
} // end class BruiserEnemyDefinition