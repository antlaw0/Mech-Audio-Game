#!/usr/bin/env node

import { rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..')
const GENERATED_PATHS = [
  '.test-dist',
  'packages/shared/dist',
  'packages/client/dist',
  'packages/server/dist',
  'packages/shared/tsconfig.tsbuildinfo',
  'packages/client/tsconfig.tsbuildinfo',
  'packages/server/tsconfig.tsbuildinfo'
]

const main = async () => {
  for (const relativePath of GENERATED_PATHS) {
    const targetPath = path.resolve(PROJECT_ROOT, relativePath)
    if (!targetPath.startsWith(`${PROJECT_ROOT}${path.sep}`)) {
      throw new Error(`Refusing to remove path outside repository: ${targetPath}`)
    } // end if target outside repository

    await rm(targetPath, { force: true, recursive: true })
    console.log(`[clean-generated] Removed ${relativePath}`)
  } // end for generated path
} // end function main

main().catch((error) => {
  console.error(`[clean-generated] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} // end catch clean-generated failure
)
