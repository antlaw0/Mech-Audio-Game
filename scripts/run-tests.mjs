#!/usr/bin/env node

import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..')

const listMatchingFiles = async (directoryPath, suffix) => {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  const matches = []
  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name)
    if (entry.isDirectory()) {
      matches.push(...await listMatchingFiles(entryPath, suffix))
      continue
    } // end if nested directory
    if (entry.isFile() && entry.name.endsWith(suffix)) {
      matches.push(entryPath)
    } // end if matching file
  } // end for directory entry
  return matches
} // end function listMatchingFiles

const main = async () => {
  const compiledTests = await listMatchingFiles(path.join(PROJECT_ROOT, '.test-dist', 'tests'), '.test.js')
  const JavaScriptTests = await listMatchingFiles(path.join(PROJECT_ROOT, 'tests'), '.test.mjs')
  const testFiles = [...compiledTests, ...JavaScriptTests].sort()
  if (testFiles.length === 0) {
    throw new Error('No compiled or JavaScript test files were found.')
  } // end if no tests found

  const result = spawnSync(process.execPath, ['--test', ...testFiles], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  })
  if (result.error) {
    throw result.error
  } // end if test process failed to start
  process.exitCode = result.status ?? 1
} // end function main

main().catch((error) => {
  console.error(`[run-tests] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} // end catch run-tests failure
)
