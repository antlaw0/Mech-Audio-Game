#!/usr/bin/env node
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

const lockFilePath = join(process.cwd(), '.vscode', '.dev-playtest.lock.json')
const command = process.argv.slice(2)

if (command.length === 0) {
  console.error('[dev-lock] No command provided.')
  process.exit(1)
}

function isPidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false
  }

  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function releaseLock() {
  try {
    if (!existsSync(lockFilePath)) {
      return
    }

    const raw = readFileSync(lockFilePath, 'utf8')
    const lock = JSON.parse(raw)
    if (lock.pid === process.pid) {
      rmSync(lockFilePath)
    }
  } catch {
    // Ignore cleanup errors so shutdown stays reliable.
  }
}

if (existsSync(lockFilePath)) {
  try {
    const raw = readFileSync(lockFilePath, 'utf8')
    const lock = JSON.parse(raw)
    if (isPidRunning(lock.pid)) {
      console.error(`[dev-lock] A playtest session is already running (pid ${lock.pid}).`)
      console.error('[dev-lock] Stop the existing session before starting another one.')
      process.exit(1)
    }
  } catch {
    // If the lock is invalid, replace it.
  }

  try {
    rmSync(lockFilePath)
  } catch {
    // If cleanup fails, write below may still succeed.
  }
}

writeFileSync(
  lockFilePath,
  JSON.stringify({ pid: process.pid, command, startedAt: new Date().toISOString() }, null, 2)
)

process.on('exit', releaseLock)
process.on('SIGINT', () => {
  releaseLock()
  process.exit(130)
})
process.on('SIGTERM', () => {
  releaseLock()
  process.exit(143)
})

const child = spawn(command.join(' '), {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
})

child.on('exit', (code, signal) => {
  releaseLock()

  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})
