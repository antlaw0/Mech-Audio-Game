import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getChunkDistance,
  toChunkCoordinate,
  toChunkKey
} from '../packages/client/src/test-map/chunk-coordinates.js'

test('chunk coordinates handle positive and negative boundaries', () => {
  assert.equal(toChunkCoordinate(0, 32), 0)
  assert.equal(toChunkCoordinate(31.999, 32), 0)
  assert.equal(toChunkCoordinate(32, 32), 1)
  assert.equal(toChunkCoordinate(63.999, 32), 1)
  assert.equal(toChunkCoordinate(64, 32), 2)
  assert.equal(toChunkCoordinate(-0.001, 32), -1)
  assert.equal(toChunkCoordinate(-32, 32), -1)
} // end test chunk coordinate boundaries
)

test('chunk coordinate rejects invalid chunk sizes', () => {
  assert.throws(() => toChunkCoordinate(10, 0), /positive finite number/)
  assert.throws(() => toChunkCoordinate(10, Number.NaN), /positive finite number/)
} // end test invalid chunk size
)

test('chunk keys and distance use stable grid semantics', () => {
  assert.equal(toChunkKey(-1, 2), '-1,2')
  assert.equal(getChunkDistance(0, 0, 3, -2), 3)
} // end test chunk key and distance
)
