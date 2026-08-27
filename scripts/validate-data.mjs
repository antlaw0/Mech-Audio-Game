#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validatePartsCatalog } from './lib/parts-catalog-validation.mjs'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..')
const PARTS_PATH = path.resolve(PROJECT_ROOT, 'packages/client/src/data/parts/parts.json')

const main = async () => {
  const sourceText = await readFile(PARTS_PATH, 'utf8')
  const catalog = JSON.parse(sourceText.replace(/^\uFEFF/, ''))
  const validatedCatalog = validatePartsCatalog(catalog, 'packages/client/src/data/parts/parts.json')

  console.log(`[validate-data] Parts catalog valid: ${validatedCatalog.length} definitions`)
} // end function main

main().catch((error) => {
  console.error(`[validate-data] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} // end catch validate-data failure
)
