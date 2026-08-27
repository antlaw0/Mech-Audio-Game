import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateEnergyRegeneration,
  getEnergyHeatMultiplier,
  resolveHeatState
} from '../packages/client/src/test-map/resource-policy.js'

test('heat state resolves exact threshold boundaries', () => {
  assert.equal(resolveHeatState(39.9, 100, 'NORMAL'), 'NORMAL')
  assert.equal(resolveHeatState(40, 100, 'NORMAL'), 'HOT')
  assert.equal(resolveHeatState(65, 100, 'NORMAL'), 'CRITICAL')
  assert.equal(resolveHeatState(85, 100, 'NORMAL'), 'DANGER')
  assert.equal(resolveHeatState(100, 100, 'NORMAL'), 'OVERHEAT')
} // end test heat thresholds
)

test('overheat persists above the recovery threshold', () => {
  assert.equal(resolveHeatState(25.1, 100, 'OVERHEAT'), 'OVERHEAT')
  assert.equal(resolveHeatState(25, 100, 'OVERHEAT'), 'NORMAL')
} // end test overheat hysteresis
)

test('energy heat multiplier follows heat state', () => {
  assert.equal(getEnergyHeatMultiplier('NORMAL'), 1)
  assert.equal(getEnergyHeatMultiplier('HOT'), 0.8)
  assert.equal(getEnergyHeatMultiplier('CRITICAL'), 0.55)
  assert.equal(getEnergyHeatMultiplier('DANGER'), 0.25)
  assert.equal(getEnergyHeatMultiplier('OVERHEAT'), 0)
} // end test heat multipliers
)

test('energy regeneration multiplies nonnegative policy inputs', () => {
  assert.equal(calculateEnergyRegeneration({
    basePerSecond: 20,
    weightFactor: 0.5,
    heatMultiplier: 0.8,
    runtimeMultiplier: 1.5
  }), 12)
  assert.equal(calculateEnergyRegeneration({
    basePerSecond: -20,
    weightFactor: 1,
    heatMultiplier: 1,
    runtimeMultiplier: 1
  }), 0)
} // end test energy regeneration calculation
)
