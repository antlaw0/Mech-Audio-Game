#!/usr/bin/env node

import { readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { basename, extname, resolve } from 'node:path'

const PROJECT_ROOT = process.cwd()
const USER_PROFILE = process.env.USERPROFILE || process.env.HOME || ''

const CANDIDATE_DIRS = [
  resolve(PROJECT_ROOT),
  resolve(PROJECT_ROOT, 'exports'),
  USER_PROFILE ? resolve(USER_PROFILE, 'Downloads') : ''
].filter((dir) => dir.length > 0)

const CATALOG_FILE_NAME_PATTERN = /^garage-catalog-\d{4}-\d{2}-\d{2}\.json$/i

const helpText = [
  'Apply the newest exported Garage catalog JSON to source parts.json',
  '',
  'Usage:',
  '  npm run catalog:apply:latest',
  '  npm run catalog:apply:latest -- --no-backup',
  '',
  'Search order:',
  '  1) project root',
  '  2) project root/exports',
  '  3) %USERPROFILE%/Downloads'
].join('\n')

const hasFlag = (flag) => process.argv.slice(2).includes(flag)

const findNewestCatalog = async () => {
  let newest = null

  for (const dir of CANDIDATE_DIRS) {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue
      }
      if (extname(entry.name).toLowerCase() !== '.json') {
        continue
      }
      if (!CATALOG_FILE_NAME_PATTERN.test(entry.name)) {
        continue
      }

      const fullPath = resolve(dir, entry.name)
      const stamp = basename(entry.name, '.json').replace(/^garage-catalog-/i, '')
      const rank = Date.parse(`${stamp}T00:00:00.000Z`)
      const score = Number.isFinite(rank) ? rank : 0

      if (!newest || score > newest.score || (score === newest.score && fullPath > newest.path)) {
        newest = {
          path: fullPath,
          score
        }
      }
    }
  }

  return newest?.path ?? null
}

const runApply = async (catalogPath) => {
  const passthrough = process.argv.slice(2).filter((arg) => arg !== '--help')
  const args = [
    './scripts/apply-catalog-export.mjs',
    catalogPath,
    '--allow-parts-json-write',
    ...passthrough
  ]

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, args, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit'
    })

    child.on('error', (error) => {
      rejectPromise(error)
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }
      rejectPromise(new Error(`catalog apply failed with exit code ${code ?? -1}.`))
    })
  })
}

const main = async () => {
  if (hasFlag('--help')) {
    console.log(helpText)
    return
  }

  const newestCatalogPath = await findNewestCatalog()
  if (!newestCatalogPath) {
    throw new Error('No garage-catalog-YYYY-MM-DD.json export found in project root, exports folder, or Downloads.')
  }

  console.log(`Using latest catalog export: ${newestCatalogPath}`)
  await runApply(newestCatalogPath)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
