import { EnemyBase } from './enemyBase.js'

export class EnemyTank extends EnemyBase {
  constructor(id: string, x: number, y: number) {
    super(id, 'tank', x, y, 2.3, 1.8)
  }
}

export class EnemyMech extends EnemyBase {
  constructor(id: string, x: number, y: number) {
    super(id, 'mech', x, y, 2.7, 2.4)
  }
}

export class EnemyHelicopter extends EnemyBase {
  constructor(id: string, x: number, y: number) {
    super(id, 'helicopter', x, y, 3.5, 2.7)
  }
}

export class EnemyDrone extends EnemyBase {
  constructor(id: string, x: number, y: number) {
    super(id, 'drone', x, y, 3.9, 3.2)
  }
}
