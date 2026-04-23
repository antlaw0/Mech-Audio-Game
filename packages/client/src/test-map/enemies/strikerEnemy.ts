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
      shotDamage: 1,
      fireRateSeconds: 1.35,
      threatDelaySeconds: 0.22,
      projectileMaxDistance: 54,
      behavior: {
        movementPattern: 'aggressive-wander',
        retargetIntervalSeconds: 2.4,
        preferredEngageRange: 16,
        lineOfSightRequiredToShoot: true
      },
      automaticFire: {
        enabled: true,
        burstRoundCounts: [3, 4, 5],
        burstIntervalSeconds: 0.08,
        burstAudioPrefix: 'assets/sounds/weapons/arBurst'
      },
      sounds: {
        attackSound: 'assets/sounds/weapons/assault_fire.ogg',
        startupSound: 'assets/sounds/weapons/reload.ogg',
        hurtSound: 'assets/sounds/explosions/explosion_1B.ogg',
        deathSound: 'assets/sounds/explosions/explosion_2a.ogg',
        positionalLoopSound: 'assets/sounds/footstep2.ogg'
      }
    })
  } // end constructor StrikerEnemyDefinition
} // end class StrikerEnemyDefinition
