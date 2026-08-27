import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APPLY_SCRIPT = path.join(REPOSITORY_ROOT, 'scripts', 'apply-catalog-export.mjs')

const makeDefinition = (overrides = {}) => ({
  id: 'test.head',
  name: 'Test Head',
  category: 'Head',
  integrity: 100,
  weight: 20,
  PDEF: 5,
  EDEF: 5,
  energyDrain: 1,
  ...overrides
}) // end function makeDefinition

const createTemporaryProject = async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'mech-catalog-apply-'))
  const catalogDirectory = path.join(projectRoot, 'packages', 'client', 'src', 'data', 'parts')
  await mkdir(catalogDirectory, { recursive: true })
  const targetPath = path.join(catalogDirectory, 'parts.json')
  await writeFile(targetPath, '[]\n', 'utf8')
  return { projectRoot, targetPath }
} // end function createTemporaryProject

test('catalog apply preserves unknown authored fields', async (testContext) => {
  const temporary = await createTemporaryProject()
  testContext.after(async () => {
    await rm(temporary.projectRoot, { force: true, recursive: true })
  } // end temporary project cleanup
  )
  const inputPath = path.join(temporary.projectRoot, 'export.json')
  await writeFile(inputPath, JSON.stringify([makeDefinition({ futureAuthoredStat: 77 })]), 'utf8')

  const result = spawnSync(process.execPath, [
    APPLY_SCRIPT,
    inputPath,
    '--allow-parts-json-write',
    '--no-backup'
  ], { cwd: temporary.projectRoot, encoding: 'utf8' })

  assert.equal(result.status, 0, result.stderr)
  const written = JSON.parse(await readFile(temporary.targetPath, 'utf8'))
  assert.equal(written[0].futureAuthoredStat, 77)
} // end test catalog apply preserves fields
)

test('catalog apply rejects invalid optional numeric fields before writing', async (testContext) => {
  const temporary = await createTemporaryProject()
  testContext.after(async () => {
    await rm(temporary.projectRoot, { force: true, recursive: true })
  } // end temporary project cleanup
  )
  const originalContents = await readFile(temporary.targetPath, 'utf8')
  const inputPath = path.join(temporary.projectRoot, 'invalid-export.json')
  await writeFile(inputPath, JSON.stringify([makeDefinition({ heatGeneration: 'high' })]), 'utf8')

  const result = spawnSync(process.execPath, [
    APPLY_SCRIPT,
    inputPath,
    '--allow-parts-json-write',
    '--no-backup'
  ], { cwd: temporary.projectRoot, encoding: 'utf8' })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /test\.head\.heatGeneration must be a finite number/)
  assert.equal(await readFile(temporary.targetPath, 'utf8'), originalContents)
} // end test catalog apply rejects invalid optional number
)
