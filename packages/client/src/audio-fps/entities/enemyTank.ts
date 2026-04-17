import { EnemyBase } from './enemyBase.js'

export class EnemyTank extends EnemyBase {
  constructor(id: string, x: number, y: number, existingState?: import('../core/worldTypes.js').EnemyState) {
    super(id, 'tank', x, y, {
      maxHealth: 100,
      movementSpeed: 2.3,
      turnSpeed: 1.8,
      detectionRadius: 20,
      attackRange: 18,
      shotDamage: 12,
      projectileSpeed: 10,
      projectileLifeSeconds: 1.6,
      fireIntervalSeconds: 2.2,
      layer: 'ground',
      altitude: 0,
      ignoresObstacles: false,
      loopSound: 'assets/sounds/tankMoving.ogg',
      fireSound: 'assets/sounds/weapons/tankCannon.ogg',
      loadSound: 'assets/sounds/weapons/reloadCannon.ogg',
      hitSound: 'assets/sounds/tankHit.ogg',
      deathSound: 'assets/sounds/explosion_2a.ogg',
      explosiveProjectile: true
    }, existingState)
  }
}

export class EnemyMech extends EnemyBase {
  constructor(id: string, x: number, y: number, existingState?: import('../core/worldTypes.js').EnemyState) {
    super(id, 'mech', x, y, {
      maxHealth: 80,
      movementSpeed: 2.7,
      turnSpeed: 2.4,
      detectionRadius: 18,
      attackRange: 16,
      shotDamage: 10,
      projectileSpeed: 12,
      projectileLifeSeconds: 1.4,
      fireIntervalSeconds: 1.7,
      layer: 'ground',
      altitude: 0,
      ignoresObstacles: false,
      loopSound: 'assets/sounds/servomotor.ogg',
      fireSound: 'assets/sounds/weapons/pistol_fire.ogg',
      loadSound: 'assets/sounds/weapons/reload.ogg',
      hitSound: 'assets/sounds/mechHit.ogg',
      deathSound: 'assets/sounds/explosion_1B.ogg'
    }, existingState)
  }
}

export class EnemyHelicopter extends EnemyBase {
  constructor(id: string, x: number, y: number, airLayerHeight: number, existingState?: import('../core/worldTypes.js').EnemyState) {
    super(id, 'helicopter', x, y, {
      maxHealth: 30,
      movementSpeed: 2,
      turnSpeed: 1.8,
      detectionRadius: 33,
      attackRange: 18,
      shotDamage: 5,
      projectileSpeed: 12,
      projectileLifeSeconds: 1.8,
      fireIntervalSeconds: 2,
      layer: 'air',
      altitude: airLayerHeight,
      ignoresObstacles: true,
      loopSound: 'assets/sounds/helicopterLoop.ogg',
      fireSound: 'assets/sounds/weapons/pistol_fire.ogg',
      loadSound: 'assets/sounds/weapons/reload.ogg',
      hitSound: 'assets/sounds/tankHit.ogg',
      deathSound: 'assets/sounds/explosion_2a.ogg'
    }, existingState)
  }
}

export class EnemyDrone extends EnemyBase {
  constructor(id: string, x: number, y: number, airLayerHeight: number, existingState?: import('../core/worldTypes.js').EnemyState) {
    super(id, 'drone', x, y, {
      maxHealth: 24,
      movementSpeed: 3.9,
      turnSpeed: 3.2,
      detectionRadius: 22,
      attackRange: 14,
      shotDamage: 4,
      projectileSpeed: 13,
      projectileLifeSeconds: 1.1,
      fireIntervalSeconds: 1.4,
      layer: 'air',
      altitude: airLayerHeight,
      ignoresObstacles: true,
      loopSound: 'assets/sounds/servomotor.ogg',
      fireSound: 'assets/sounds/weapons/pistol_fire.ogg',
      loadSound: 'assets/sounds/weapons/reload.ogg',
      hitSound: 'assets/sounds/mechHit.ogg',
      deathSound: 'assets/sounds/explosion_1B.ogg'
    }, existingState)
  }
}
