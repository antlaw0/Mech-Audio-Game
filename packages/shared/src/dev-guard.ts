type DevGuardPayload = Record<string, unknown>

type DevGuardEmitter = (event: string, payload: DevGuardPayload) => void

const runtime = globalThis as {
  process?: { env?: Record<string, string | undefined> }
  console?: { warn?: (...args: unknown[]) => void }
}

let devGuardEmitter: DevGuardEmitter | null = null

function isDevGuardActive(): boolean {
  const env = runtime.process?.env
  if (!env) {
    return false
  }

  if (env.DEV_GUARD_ENABLED === 'true') {
    return true
  }

  if (env.DEV_GUARD_ENABLED === 'false') {
    return false
  }

  return env.NODE_ENV !== 'production'
} // end function isDevGuardActive

function emitDevGuardEvent(event: string, payload: DevGuardPayload): void {
  if (!isDevGuardActive()) {
    return
  }

  devGuardEmitter?.(event, payload)
} // end function emitDevGuardEvent

function warn(message: string): void {
  runtime.console?.warn?.(`[dev-guard] ${message}`)
} // end function warn

export function registerDevGuardTraceEmitter(emitter: DevGuardEmitter): void {
  devGuardEmitter = emitter
} // end function registerDevGuardTraceEmitter

export function assertIncrementalEdit(filePath: string, changeType: string): void {
  const normalizedChangeType = changeType.trim().toLowerCase()
  const suspiciousTerms = ['replace', 'wholesale', 'rewrite', 'recreate', 'delete']
  const isSuspicious = suspiciousTerms.some((term) => normalizedChangeType.includes(term))

  if (isSuspicious) {
    warn(`Incremental edit check flagged ${filePath} with changeType="${changeType}".`)
    emitDevGuardEvent('incremental-edit.violation', {
      filePath,
      changeType,
      reason: 'suspicious-change-type'
    })
    return
  }

  emitDevGuardEvent('incremental-edit.check', {
    filePath,
    changeType,
    status: 'ok'
  })
} // end function assertIncrementalEdit

export function assertNoWholesaleReplace(filePath: string, diff: string): void {
  const lines = diff.split('\n')
  let addedCount = 0
  let removedCount = 0
  let hasHunkHeader = false

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (line.startsWith('@@')) {
      hasHunkHeader = true
      continue
    }

    if (line.startsWith('+++') || line.startsWith('---')) {
      continue
    }

    if (line.startsWith('+')) {
      addedCount += 1
      continue
    }

    if (line.startsWith('-')) {
      removedCount += 1
    }
  }

  const largeDeleteSkew = removedCount >= 40 && addedCount <= 5
  const changedLineCount = removedCount + addedCount
  const patchWithoutHunks = changedLineCount > 0 && !hasHunkHeader
  const isSuspicious = largeDeleteSkew || patchWithoutHunks

  if (isSuspicious) {
    warn(
      `Wholesale replace check flagged ${filePath} (removed=${removedCount}, added=${addedCount}, hasHunks=${hasHunkHeader}).`
    )
    emitDevGuardEvent('wholesale-replace.suspected', {
      filePath,
      removedCount,
      addedCount,
      hasHunkHeader,
      reason: largeDeleteSkew ? 'large-delete-skew' : 'missing-hunk-headers'
    })
    return
  }

  emitDevGuardEvent('wholesale-replace.check', {
    filePath,
    removedCount,
    addedCount,
    hasHunkHeader,
    status: 'ok'
  })
} // end function assertNoWholesaleReplace