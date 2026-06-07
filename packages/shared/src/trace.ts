export type TracePayload = Record<string, unknown>
export type TraceLevel = 'debug' | 'info' | 'decision' | 'critical'

// trace = source of truth
// Raw trace events are immutable facts captured at emit time; downstream code only queries them.

export interface TraceEventFilter {
  level?: TraceLevel
  domain?: string
  event?: string
} // end interface TraceEventFilter

export interface TraceEvent {
  domain: string
  event: string
  payload: TracePayload
  // Semantically defaults to 'info' when omitted.
  level?: TraceLevel
  timestamp: string
  actor?: string
  system?: string
  tags?: string[]
} // end interface TraceEvent

export interface TraceInputEvent {
  domain: string
  event: string
  payload: TracePayload
  // Semantically defaults to 'info' when omitted.
  level?: TraceLevel
  actor?: string
  system?: string
  tags?: string[]
} // end interface TraceInputEvent

const DEFAULT_BUFFER_SIZE = 500

const runtime = globalThis as {
  process?: { env?: Record<string, string | undefined> }
  TRACE_ENABLED?: boolean | string
}

function isTraceEnabled(): boolean {
  const envValue = runtime.process?.env?.TRACE_ENABLED
  if (envValue !== undefined) {
    return envValue === 'true'
  }

  const runtimeFlag = runtime.TRACE_ENABLED
  if (typeof runtimeFlag === 'boolean') {
    return runtimeFlag
  }

  if (typeof runtimeFlag === 'string') {
    return runtimeFlag === 'true'
  }

  // Default to enabled in browser runtime when no explicit trace flag exists.
  return typeof window !== 'undefined'
} // end function isTraceEnabled

function normalizePayload(payload: TracePayload): TracePayload {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload
  }

  return {}
} // end function normalizePayload

class CircularTraceBuffer {
  private readonly buffer: Array<TraceEvent | undefined>
  private writeIndex = 0
  private size = 0

  constructor(private readonly capacity: number) {
    this.buffer = new Array<TraceEvent | undefined>(capacity)
  }

  public push(value: TraceEvent): void {
    this.buffer[this.writeIndex] = value
    this.writeIndex = (this.writeIndex + 1) % this.capacity
    this.size = Math.min(this.size + 1, this.capacity)
  }

  public snapshot(): TraceEvent[] {
    const values: TraceEvent[] = []
    const startIndex = this.size === this.capacity ? this.writeIndex : 0
    for (let index = 0; index < this.size; index += 1) {
      const slotIndex = (startIndex + index) % this.capacity
      const value = this.buffer[slotIndex]
      if (value) {
        values.push(value)
      }
    }
    return values
  }
} // end class CircularTraceBuffer

const traceBuffer = new CircularTraceBuffer(DEFAULT_BUFFER_SIZE)
const scopeStack: string[] = []

function emitInternal(input: TraceInputEvent): void {
  if (!isTraceEnabled()) {
    return
  }

  const event: TraceEvent = {
    domain: input.domain,
    event: input.event,
    payload: normalizePayload(input.payload),
    timestamp: new Date().toISOString(),
    actor: input.actor,
    system: input.system,
    tags: input.tags
  }

  traceBuffer.push(event)
} // end function emitInternal

export const trace = {
  emit: (event: TraceInputEvent): void => {
    emitInternal(event)
  },
  beginScope: (name: string): void => {
    scopeStack.push(name)
    emitInternal({
      domain: 'trace',
      event: 'scope.begin',
      payload: { name },
      system: 'trace'
    })
  },
  endScope: (): void => {
    const name = scopeStack.pop()
    emitInternal({
      domain: 'trace',
      event: 'scope.end',
      payload: { name: name ?? null },
      system: 'trace'
    })
  }
}

function matchesFilter(event: TraceEvent, filter: TraceEventFilter): boolean {
  if (filter.level !== undefined) {
    const level = event.level ?? 'info'
    if (level !== filter.level) {
      return false
    }
  }

  if (filter.domain !== undefined && event.domain !== filter.domain) {
    return false
  }

  if (filter.event !== undefined && event.event !== filter.event) {
    return false
  }

  return true
} // end function matchesFilter

export function getTraceEvents(filter: TraceEventFilter = {}): TraceEvent[] {
  return traceBuffer.snapshot().filter((event) => matchesFilter(event, filter))
} // end function getTraceEvents

export function getLatestTraceEvents(n: number): TraceEvent[] {
  const count = Math.max(0, Math.floor(n))
  if (count <= 0) {
    return []
  }
  const events = traceBuffer.snapshot()
  return events.slice(Math.max(0, events.length - count))
} // end function getLatestTraceEvents

export function getCriticalEventsOnly(): TraceEvent[] {
  return getTraceEvents({ level: 'critical' })
} // end function getCriticalEventsOnly
