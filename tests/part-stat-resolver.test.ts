import assert from 'node:assert/strict'
import test from 'node:test'

import type { PartDefinition, PartInstance } from '../packages/client/src/data/parts/types.js'
import { configurePartStatResolver, getFinalPartStats } from '../packages/client/src/systems/parts/statResolver.js'

const baseDefinition: PartDefinition = {
  id: 'test.generator',
  name: 'Test Generator',
  category: 'Generator',
  integrity: 100,
  armorValue: 10,
  weight: 20,
  PDEF: 10,
  EDEF: 8,
  energyDrain: 2,
  energyCapacity: 100,
  computeBandWidth: 2,
  chipSlots: 2
}

const chipDefinition: PartDefinition = {
  id: 'test.chip',
  name: 'Test Chip',
  category: 'Chip',
  integrity: 10,
  armorValue: 0,
  weight: 1,
  PDEF: 0,
  EDEF: 0,
  energyDrain: 0,
  chipMemoryCost: 2,
  chipModifiers: ['test modifier']
}

const makeInstance = (overrides: Partial<PartInstance> = {}): PartInstance => ({
  instanceId: 'generator-instance',
  definitionId: baseDefinition.id,
  currentIntegrity: 100,
  modifiers: [],
  installedChips: [],
  rngSeed: 1,
  ...overrides
}) // end function makeInstance

const configureFixture = (partInstance: PartInstance, chipInstances: PartInstance[] = []): void => {
  const definitions = new Map([
    [baseDefinition.id, baseDefinition],
    [chipDefinition.id, chipDefinition]
  ])
  const instances = new Map([
    [partInstance.instanceId, partInstance],
    ...chipInstances.map((instance) => [instance.instanceId, instance] as const)
  ])
  configurePartStatResolver({
    getDefinition: (id) => definitions.get(id) ?? null,
    getInstance: (id) => instances.get(id) ?? null
  })
} // end function configureFixture

test('part resolver applies integrity and instance modifiers', () => {
  const instance = makeInstance({
    currentIntegrity: 50,
    modifiers: [
      { id: 'capacity-add', type: 'stat_add', stat: 'energyCapacity', value: 20 },
      { id: 'defense-mult', type: 'stat_mult', stat: 'PDEF', value: 0.5 }
    ]
  })
  configureFixture(instance)

  const resolved = getFinalPartStats(instance.instanceId)
  assert.equal(resolved.damagePenaltyMultiplier, 0.675)
  assert.equal(resolved.energyCapacity, 81)
  assert.equal(resolved.PDEF, 10.125)
} // end test integrity and modifiers
)

test('part resolver marks chips unsupported after compute is exhausted', () => {
  const firstChip = makeInstance({ instanceId: 'chip-one', definitionId: chipDefinition.id })
  const secondChip = makeInstance({ instanceId: 'chip-two', definitionId: chipDefinition.id })
  const instance = makeInstance({
    installedChips: [
      { chipInstanceId: firstChip.instanceId, active: true },
      { chipInstanceId: secondChip.instanceId, active: true }
    ]
  })
  configureFixture(instance, [firstChip, secondChip])

  const states = getFinalPartStats(instance.instanceId).installedChipStates
  assert.equal(states[0]?.supportedByCompute, true)
  assert.equal(states[1]?.supportedByCompute, false)
} // end test chip compute exhaustion
)
