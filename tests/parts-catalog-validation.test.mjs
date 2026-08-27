import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { validatePartsCatalog } from '../scripts/lib/parts-catalog-validation.mjs'

const sourceCatalogUrl = new URL('../packages/client/src/data/parts/parts.json', import.meta.url)

const makeDefinition = (overrides = {}) => ({
  id: 'test.head',
  name: 'Test Head',
  category: 'Head',
  integrity: 100,
  armorValue: 10,
  weight: 20,
  PDEF: 5,
  EDEF: 5,
  energyDrain: 1,
  ...overrides
}) // end function makeDefinition

test('current authoritative parts catalog validates', async () => {
  const sourceText = await readFile(sourceCatalogUrl, 'utf8')
  const catalog = JSON.parse(sourceText.replace(/^\uFEFF/, ''))

  assert.equal(validatePartsCatalog(catalog, 'parts.json'), catalog)
} // end test current catalog validates
)

test('duplicate part IDs identify the duplicate', () => {
  const catalog = [makeDefinition(), makeDefinition()]

  assert.throws(
    () => validatePartsCatalog(catalog, 'fixture'),
    /fixture: duplicate part id "test\.head"/
  )
} // end test duplicate part IDs
)

test('invalid required number identifies definition and field', () => {
  const catalog = [makeDefinition({ weight: Number.NaN })]

  assert.throws(
    () => validatePartsCatalog(catalog, 'fixture'),
    /fixture: test\.head\.weight must be a finite number/
  )
} // end test invalid required number
)

test('invalid optional number identifies definition and field', () => {
  const catalog = [makeDefinition({ energyCapacity: 'unlimited' })]

  assert.throws(
    () => validatePartsCatalog(catalog, 'fixture'),
    /fixture: test\.head\.energyCapacity must be a finite number/
  )
} // end test invalid optional number
)

test('active ground mobility requires positive ratedLoad', () => {
  const catalog = [makeDefinition({
    id: 'test.legs',
    category: 'GroundMobility',
    liftCapacity: 500
  })]

  assert.throws(
    () => validatePartsCatalog(catalog, 'fixture'),
    /fixture: test\.legs\.ratedLoad must be a finite number greater than zero/
  )
} // end test ground mobility ratedLoad
)

test('deprecated ground mobility may omit ratedLoad', () => {
  const catalog = [makeDefinition({
    id: 'test.legacy-legs',
    category: 'GroundMobility',
    deprecated: true
  })]

  assert.equal(validatePartsCatalog(catalog, 'fixture'), catalog)
} // end test deprecated ground mobility
)

test('validation preserves unknown authored properties and object identity', () => {
  const definition = makeDefinition({ futureAuthoredStat: 77 })
  const catalog = [definition]
  const result = validatePartsCatalog(catalog, 'fixture')

  assert.equal(result, catalog)
  assert.equal(result[0], definition)
  assert.equal(result[0].futureAuthoredStat, 77)
} // end test authored property preservation
)
