import { BruiserEnemyDefinition } from './bruiserEnemy.js'
import { BruteEnemyDefinition } from './bruteEnemy.js'
import type { EnemyDefinitionBase } from './enemyBase.js'
import { HelicopterEnemyDefinition } from './helicopterEnemy.js'
import type { EnemyId } from './enemyTypes.js'
import { StrikerEnemyDefinition } from './strikerEnemy.js'
import { TankEnemyDefinition } from './tankEnemy.js'
import { TestDummyEnemyDefinition } from './testDummyEnemy.js'

const ENEMY_DEFINITIONS: Record<EnemyId, EnemyDefinitionBase> = {
  tank: new TankEnemyDefinition(),
  striker: new StrikerEnemyDefinition(),
  brute: new BruteEnemyDefinition(),
  helicopter: new HelicopterEnemyDefinition(),
  bruiser: new BruiserEnemyDefinition(),
  'test-dummy': new TestDummyEnemyDefinition()
} // end object ENEMY_DEFINITIONS

export const ENEMY_NUMERIC_ID = {
  tank: 1,
  striker: 2,
  brute: 3,
  helicopter: 4,
  bruiser: 5,
  'test-dummy': 6
} as const

export function getEnemyDefinition(id: EnemyId): EnemyDefinitionBase {
  return ENEMY_DEFINITIONS[id]
} // end function getEnemyDefinition

export function getEnemyDefinitionFromNumericId(numericId: number): EnemyDefinitionBase {
  if (numericId === ENEMY_NUMERIC_ID.striker) {
    return ENEMY_DEFINITIONS.striker
  } // end if striker id

  if (numericId === ENEMY_NUMERIC_ID.brute) {
    return ENEMY_DEFINITIONS.brute
  } // end if brute id

  if (numericId === ENEMY_NUMERIC_ID.helicopter) {
    return ENEMY_DEFINITIONS.helicopter
  } // end if helicopter id

  if (numericId === ENEMY_NUMERIC_ID.bruiser) {
    return ENEMY_DEFINITIONS.bruiser
  } // end if bruiser id

  if (numericId === ENEMY_NUMERIC_ID['test-dummy']) {
    return ENEMY_DEFINITIONS['test-dummy']
  } // end if test dummy id

  return ENEMY_DEFINITIONS.tank
} // end function getEnemyDefinitionFromNumericId
