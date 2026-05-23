#!/usr/bin/env node

import { copyFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..')
const SRC_PARTS_PATH = path.resolve(PROJECT_ROOT, 'packages/client/src/data/parts/parts.json')
const DIST_PARTS_DIR = path.resolve(PROJECT_ROOT, 'packages/client/dist/data/parts')
const DIST_PARTS_PATH = path.join(DIST_PARTS_DIR, 'parts.json')

const fail = (message) => {
  console.error(`[parts-sync] ${message}`)
  process.exitCode = 1
}

const main = async () => {
  const sourceContents = await readFile(SRC_PARTS_PATH, 'utf8')
  await mkdir(DIST_PARTS_DIR, { recursive: true })
  await copyFile(SRC_PARTS_PATH, DIST_PARTS_PATH)

  const syncedContents = await readFile(DIST_PARTS_PATH, 'utf8')
  if (syncedContents !== sourceContents) {
    throw new Error('dist parts.json verification failed after copy.')
  }

  console.log('[parts-sync] Synced packages/client/src/data/parts/parts.json -> packages/client/dist/data/parts/parts.json')
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
