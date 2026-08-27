#!/usr/bin/env node

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { validatePartsCatalog } from './lib/parts-catalog-validation.mjs'

const PROJECT_ROOT = process.cwd()
const TARGET_CATALOG_PATH = path.resolve(PROJECT_ROOT, 'packages/client/src/data/parts/parts.json')
const BACKUP_DIR = path.resolve(PROJECT_ROOT, 'packages/client/src/data/parts/backups')
const helpText = [
  'Apply an exported Garage catalog JSON to packages/client/src/data/parts/parts.json',
  '',
  'Usage:',
  '  npm run catalog:apply -- <path-to-exported-json> --allow-parts-json-write',
  '',
  'Options:',
  '  --no-backup                 Overwrite without a timestamped backup',
  '  --allow-parts-json-write    Required confirmation before writing parts.json',
  '  --help                      Show this help'
].join('\n')

const hasFlag = (flag) => process.argv.slice(2).includes(flag)

const parseInputPath = () => {
  const args = process.argv.slice(2).filter((argument) => !argument.startsWith('--'))
  return args[0] ?? ''
} // end function parseInputPath

const makeBackupPath = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return path.join(BACKUP_DIR, `parts.${timestamp}.json`)
} // end function makeBackupPath

const main = async () => {
  if (hasFlag('--help')) {
    console.log(helpText)
    return
  } // end if help requested

  const inputArgument = parseInputPath()
  if (!inputArgument) {
    throw new Error(`Missing input JSON path.\n\n${helpText}`)
  } // end if input path missing
  if (!hasFlag('--allow-parts-json-write')) {
    throw new Error('Refusing to write parts.json without --allow-parts-json-write.')
  } // end if write confirmation missing

  const inputPath = path.resolve(PROJECT_ROOT, inputArgument)
  const rawInput = await readFile(inputPath, 'utf8')
  let parsedInput
  try {
    parsedInput = JSON.parse(rawInput.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error(`Input file is not valid JSON: ${path.relative(PROJECT_ROOT, inputPath)}`)
  } // end try parsing input catalog

  const sourceLabel = path.relative(PROJECT_ROOT, inputPath)
  const validatedCatalog = validatePartsCatalog(parsedInput, sourceLabel)

  if (!hasFlag('--no-backup')) {
    await mkdir(BACKUP_DIR, { recursive: true })
    const backupPath = makeBackupPath()
    await copyFile(TARGET_CATALOG_PATH, backupPath)
    console.log(`Backup written: ${path.relative(PROJECT_ROOT, backupPath)}`)
  } // end if backup enabled

  await writeFile(TARGET_CATALOG_PATH, `${JSON.stringify(validatedCatalog, null, 2)}\n`, 'utf8')
  console.log(`Catalog applied to ${path.relative(PROJECT_ROOT, TARGET_CATALOG_PATH)}`)
  console.log(`Definitions: ${validatedCatalog.length}`)
} // end function main

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} // end catch apply catalog failure
)
