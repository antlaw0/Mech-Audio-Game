import type { EnemyState, EnemyType } from '../core/worldTypes.js'
import { EnemyBase } from './enemyBase.js'
import { EnemyDrone, EnemyHelicopter, EnemyMech, EnemyTank } from './enemyTank.js'

export const createEnemyControllerByType = (
  id: string,
  type: EnemyType,
  x: number,
  y: number,
  airLayerHeight: number,
  existingState?: EnemyState
): EnemyBase => {
  if (type === 'tank') {
    return new EnemyTank(id, x, y, existingState)
  }
  if (type === 'mech') {
    return new EnemyMech(id, x, y, existingState)
  }
  if (type === 'helicopter') {
    return new EnemyHelicopter(id, x, y, airLayerHeight, existingState)
  }
  return new EnemyDrone(id, x, y, airLayerHeight, existingState)
}