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
        lineOfSightRequiredToShoot: true,
        stationary: false
      },
      missileLauncher: {
        enabled: true,
        missileType: 'light',
        speed: 26,
        turnRate: 5.8,
        damage: 22,
        blastRadius: 2.45,
        collisionRadius: 0.13,
        proximityFuseDistance: 1.2,
        lifetime: 2.2,
        projectileVisualType: 'missile',
        explosionSounds: [
          'assets/sounds/explosions/explosion_1A.ogg',
          'assets/sounds/explosions/explosion_2a.ogg'
        ]
      },
      sounds: {
        attackSound: 'assets/sounds/weapons/missileFire.ogg',
        hurtSound: 'assets/sounds/tankHit.ogg',
        deathSound: 'assets/sounds/explosions/explosion_2a.ogg',
        positionalLoopSound: 'assets/sounds/helicopterLoop.ogg',
        loopSoundPauseIntervalMs: 0
      }
    })
  } // end constructor HelicopterEnemyDefinition
} // end class HelicopterEnemyDefinition