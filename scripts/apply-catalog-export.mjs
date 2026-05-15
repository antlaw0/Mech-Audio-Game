#!/usr/bin/env node

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PART_CATEGORIES = new Set([
  'Head',
  'Computer',
  'Core',
  'Generator',
  'LeftArm',
  'RightArm',
  'Utility1',
  'Utility2'
])

const REQUIRED_NUMERIC_KEYS = ['integrity', 'weight', 'PDEF', 'EDEF', 'energyDrain']
const OPTIONAL_NUMERIC_KEYS = [
  'energyCapacity',
  'powerOutput',
  'heatGeneration',
  'heatDissipation',
  'liftCapacity',
  'rotorCount',
  'verticalTakeoffTime',
  'flightStability',
  'speedModifier',
  'energyUse',
  'range',
  'lockOn',
  'stability',
  'meleePower',
  'accuracy',
  'sensorStrength'
]

const PROJECT_ROOT = process.cwd()
const TARGET_CATALOG_PATH = path.resolve(PROJECT_ROOT, 'packages/client/src/data/parts/parts.json')
const BACKUP_DIR = path.resolve(PROJECT_ROOT, 'packages/client/src/data/parts/backups')

const helpText = [
  'Apply an exported Garage catalog JSON to packages/client/src/data/parts/parts.json',
  '',
  'Usage:',
  '  npm run catalog:apply -- <path-to-exported-json>',
  '',
  'Options:',
  '  --no-backup   Overwrite without writing a timestamped backup',
  '  --help        Show this help'
].join('\n')

const hasFlag = (flag) => process.argv.slice(2).includes(flag)

const parseInputPath = () => {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  return args[0] ?? ''
}

const parseFiniteNumber = (value, fieldName) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid field "${fieldName}": expected a finite number.`)
  }
  return value
}

const parseStringArray = (value, fieldName) => {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new Error(`Invalid field "${fieldName}": expected an array of strings.`)
  }
  const invalid = value.find((entry) => typeof entry !== 'string')
  if (invalid !== undefined) {
    throw new Error(`Invalid field "${fieldName}": expected an array of strings.`)
  }
  return value
}

const normalizeDefinition = (entry, index) => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error(`Invalid catalog entry at index ${index}: expected an object.`)
  }

  const source = entry
  const id = typeof source.id === 'string' ? source.id.trim() : ''
  const name = typeof source.name === 'string' ? source.name.trim() : ''
  const category = typeof source.category === 'string' ? source.category : ''

  if (!id) {
    throw new Error(`Invalid catalog entry at index ${index}: id is required.`)
  }
  if (!name) {
    throw new Error(`Invalid catalog entry "${id}": name is required.`)
  }
  if (!PART_CATEGORIES.has(category)) {
    throw new Error(`Invalid catalog entry "${id}": category "${category}" is not supported.`)
  }

  const normalized = {
    id,
    name,
    category,
    integrity: parseFiniteNumber(source.integrity, `${id}.integrity`),
    weight: parseFiniteNumber(source.weight, `${id}.weight`),
    PDEF: parseFiniteNumber(source.PDEF, `${id}.PDEF`),
    EDEF: parseFiniteNumber(source.EDEF, `${id}.EDEF`),
    energyDrain: parseFiniteNumber(source.energyDrain, `${id}.energyDrain`),
    deprecated: source.deprecated === true,
    passiveBonuses: parseStringArray(source.passiveBonuses, `${id}.passiveBonuses`),
    activeAbilities: parseStringArray(source.activeAbilities, `${id}.activeAbilities`),
    specialEffects: parseStringArray(source.specialEffects, `${id}.specialEffects`)
  }

  for (const key of OPTIONAL_NUMERIC_KEYS) {
    const value = source[key]
    if (value === undefined || value === null) {
      continue
    }
    normalized[key] = parseFiniteNumber(value, `${id}.${key}`)
  }

  if (source.flightType !== undefined) {
    if (typeof source.flightType !== 'string') {
      throw new Error(`Invalid field "${id}.flightType": expected a string.`)
    }
    normalized.flightType = source.flightType
  }

  return normalized
}

const normalizeCatalog = (rawCatalog) => {
  if (!Array.isArray(rawCatalog)) {
    throw new Error('Import failed: root JSON value must be an array of part definitions.')
  }
  if (rawCatalog.length === 0) {
    throw new Error('Import failed: catalog array cannot be empty.')
  }

  const normalized = rawCatalog.map((entry, index) => normalizeDefinition(entry, index))

  const seenIds = new Set()
  for (const definition of normalized) {
    if (seenIds.has(definition.id)) {
      throw new Error(`Import failed: duplicate id "${definition.id}" found.`)
    }
    seenIds.add(definition.id)
  }

  return normalized
}

const makeBackupPath = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return path.join(BACKUP_DIR, `parts.${timestamp}.json`)
}

const main = async () => {
  if (hasFlag('--help')) {
    console.log(helpText)
    return
  }

  const inputArg = parseInputPath()
  if (!inputArg) {
    console.error('Missing input JSON path.\n')
    console.error(helpText)
    process.exitCode = 1
    return
  }

  const inputPath = path.resolve(PROJECT_ROOT, inputArg)
  const rawInput = await readFile(inputPath, 'utf8')

  let parsed
  try {
    parsed = JSON.parse(rawInput)
  } catch {
    throw new Error('Input file is not valid JSON.')
  }

  const normalizedCatalog = normalizeCatalog(parsed)

  if (!hasFlag('--no-backup')) {
    await mkdir(BACKUP_DIR, { recursive: true })
    const backupPath = makeBackupPath()
    await copyFile(TARGET_CATALOG_PATH, backupPath)
    console.log(`Backup written: ${path.relative(PROJECT_ROOT, backupPath)}`)
  }

  await writeFile(TARGET_CATALOG_PATH, `${JSON.stringify(normalizedCatalog, null, 2)}\n`, 'utf8')

  const requiredFieldText = REQUIRED_NUMERIC_KEYS.join(', ')
  console.log(`Catalog applied to ${path.relative(PROJECT_ROOT, TARGET_CATALOG_PATH)}`)
  console.log(`Definitions: ${normalizedCatalog.length}`)
  console.log(`Validated required numeric fields: ${requiredFieldText}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})