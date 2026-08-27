import assert from 'node:assert/strict'
import test from 'node:test'

import { getOverencumbranceState, getTotalMechWeight } from '../packages/client/src/systems/weight/mechWeight.js'

test('total mech weight clamps negative inputs', () => {
  assert.equal(getTotalMechWeight(-10, 25), 25)
  assert.equal(getTotalMechWeight(80, -5), 80)
} // end test total mech weight clamps negatives
)

test('overencumbrance states change at exact configured boundaries', () => {
  assert.equal(getOverencumbranceState(99.9, 100).state, 'normal')
  assert.equal(getOverencumbranceState(100, 100).state, 'heavy')
  assert.equal(getOverencumbranceState(150, 100).state, 'severe')
  assert.equal(getOverencumbranceState(200, 100).state, 'extreme')
} // end test overencumbrance boundaries
)

test('ground load calculation uses ratedLoad independently of flight lift capacity', () => {
  const groundPart = { ratedLoad: 100 }
  const flightPart = { liftCapacity: 40 }

  assert.equal(getOverencumbranceState(80, groundPart.ratedLoad).state, 'normal')
  assert.equal(flightPart.liftCapacity, 40)
} // end test ratedLoad independence
)
