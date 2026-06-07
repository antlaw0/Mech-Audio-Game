import type { TraceEvent, TracePayload } from './trace.js'

const SHORT_WINDOW_MS = 120

// narrative = projection only
// This module derives human-readable structure from raw trace facts and must never feed back into runtime trace generation.

export type TraceNarrativeDomainCategory =
  | 'ai'
  | 'combat'
  | 'inventory'
  | 'movement'
  | 'scene'
  | 'state'
  | 'ui'
  | 'world'
  | 'audio'
  | 'other'

export interface TraceNarrativeEvent extends TraceEvent {
  index: number
  timeMs: number
  frame: number | null
  category: TraceNarrativeDomainCategory
} // end interface TraceNarrativeEvent

export interface TraceNarrativeDomainGroup {
  domain: string
  system: string | null
  category: TraceNarrativeDomainCategory
  events: TraceNarrativeEvent[]
} // end interface TraceNarrativeDomainGroup

export interface TraceNarrativeSegment {
  index: number
  startIndex: number
  endIndex: number
  frameStart: number | null
  frameEnd: number | null
  startTimestamp: string
  endTimestamp: string
  durationMs: number
  events: TraceNarrativeEvent[]
  domainGroups: TraceNarrativeDomainGroup[]
} // end interface TraceNarrativeSegment

export interface TraceNarrativeTransition {
  fromIndex: number
  toIndex: number
  fromDomain: string
  toDomain: string
  fromSystem: string | null
  toSystem: string | null
  fromCategory: TraceNarrativeDomainCategory
  toCategory: TraceNarrativeDomainCategory
  kind: 'domain' | 'frame' | 'window'
} // end interface TraceNarrativeTransition

export interface TraceNarrative {
  orderedEvents: TraceNarrativeEvent[]
  groupedSegments: TraceNarrativeSegment[]
  inferredTransitions: TraceNarrativeTransition[]
} // end interface TraceNarrative

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
} // end function toNumberOrNull

function extractFrame(payload: TracePayload): number | null {
  return toNumberOrNull(payload.frame)
} // end function extractFrame

function extractTimeMs(timestamp: string, fallback: number): number {
  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) ? parsed : fallback
} // end function extractTimeMs

function classifyDomain(domain: string, system: string | undefined): TraceNarrativeDomainCategory {
  const normalized = `${system ?? ''} ${domain}`.toLowerCase()

  if (normalized.includes('combat')) {
    return 'combat'
  }
  if (normalized.includes('movement') || normalized.includes('locomotion') || normalized.includes('motion')) {
    return 'movement'
  }
  if (normalized.includes('state') || normalized.includes('status') || normalized.includes('mutation')) {
    return 'state'
  }
  if (normalized.includes('ai') || normalized.includes('decision') || normalized.includes('behavior')) {
    return 'ai'
  }
  if (normalized.includes('scene') || normalized.includes('transition') || normalized.includes('stream')) {
    return 'scene'
  }
  if (normalized.includes('inventory') || normalized.includes('loot') || normalized.includes('pickup')) {
    return 'inventory'
  }
  if (normalized.includes('audio') || normalized.includes('sound') || normalized.includes('music')) {
    return 'audio'
  }
  if (normalized.includes('ui') || normalized.includes('menu') || normalized.includes('hud')) {
    return 'ui'
  }
  if (normalized.includes('world') || normalized.includes('collision') || normalized.includes('chunk')) {
    return 'world'
  }

  return 'other'
} // end function classifyDomain

function humanizeCategory(category: TraceNarrativeDomainCategory): string {
  switch (category) {
    case 'ai':
      return 'AI'
    case 'combat':
      return 'Combat'
    case 'inventory':
      return 'Inventory'
    case 'movement':
      return 'Movement'
    case 'scene':
      return 'Scene transition'
    case 'state':
      return 'State'
    case 'ui':
      return 'UI'
    case 'world':
      return 'World'
    case 'audio':
      return 'Audio'
    default:
      return 'System'
  }
} // end function humanizeCategory

function hasPayloadKey(payload: TracePayload, keys: string[]): boolean {
  return Object.keys(payload).some((key) => keys.includes(key.toLowerCase()))
} // end function hasPayloadKey

function hasPayloadWord(payload: TracePayload, words: string[]): boolean {
  const haystack = JSON.stringify(payload).toLowerCase()
  return words.some((word) => haystack.includes(word))
} // end function hasPayloadWord

function buildOrderedEvents(events: TraceEvent[]): TraceNarrativeEvent[] {
  return events
    .map((event, index) => ({
      ...event,
      index,
      timeMs: extractTimeMs(event.timestamp, index),
      frame: extractFrame(event.payload),
      category: classifyDomain(event.domain, event.system)
    }))
    .sort((left, right) => {
      if (left.timeMs !== right.timeMs) {
        return left.timeMs - right.timeMs
      }
      if (left.frame !== right.frame) {
        if (left.frame === null) {
          return 1
        }
        if (right.frame === null) {
          return -1
        }
        return left.frame - right.frame
      }
      return left.index - right.index
    })
} // end function buildOrderedEvents

function canChain(previous: TraceNarrativeEvent, current: TraceNarrativeEvent): boolean {
  const gapMs = current.timeMs - previous.timeMs

  if (gapMs < 0) {
    return true
  }

  if (previous.frame !== null && current.frame !== null && previous.frame === current.frame) {
    return true
  }

  return gapMs <= SHORT_WINDOW_MS
} // end function canChain

function createSegment(index: number, event: TraceNarrativeEvent): TraceNarrativeSegment {
  return {
    index,
    startIndex: event.index,
    endIndex: event.index,
    frameStart: event.frame,
    frameEnd: event.frame,
    startTimestamp: event.timestamp,
    endTimestamp: event.timestamp,
    durationMs: 0,
    events: [event],
    domainGroups: [
      {
        domain: event.domain,
        system: event.system ?? null,
        category: event.category,
        events: [event]
      }
    ]
  }
} // end function createSegment

function buildSegments(orderedEvents: TraceNarrativeEvent[]): TraceNarrativeSegment[] {
  const segments: TraceNarrativeSegment[] = []
  let currentSegment: TraceNarrativeSegment | null = null

  orderedEvents.forEach((event) => {
    if (currentSegment === null) {
      currentSegment = createSegment(segments.length, event)
      return
    }

    const previousEvent = currentSegment.events[currentSegment.events.length - 1]
    if (previousEvent === undefined) {
      currentSegment = createSegment(segments.length, event)
      return
    }

    if (!canChain(previousEvent, event)) {
      segments.push(currentSegment)
      currentSegment = createSegment(segments.length, event)
      return
    }

    currentSegment.events.push(event)
    currentSegment.endIndex = event.index
    currentSegment.frameEnd = event.frame
    currentSegment.endTimestamp = event.timestamp
    const firstEvent = currentSegment.events[0]
    currentSegment.durationMs = firstEvent !== undefined ? Math.max(0, event.timeMs - firstEvent.timeMs) : 0

    const lastGroup = currentSegment.domainGroups[currentSegment.domainGroups.length - 1]
    if (lastGroup !== undefined && lastGroup.domain === event.domain && lastGroup.system === (event.system ?? null)) {
      lastGroup.events.push(event)
    } else {
      currentSegment.domainGroups.push({
        domain: event.domain,
        system: event.system ?? null,
        category: event.category,
        events: [event]
      })
    }
  })

  if (currentSegment !== null) {
    segments.push(currentSegment)
  }

  return segments
} // end function buildSegments

function buildTransitions(orderedEvents: TraceNarrativeEvent[]): TraceNarrativeTransition[] {
  const transitions: TraceNarrativeTransition[] = []

  for (let index = 1; index < orderedEvents.length; index += 1) {
    const previous = orderedEvents[index - 1]
    const current = orderedEvents[index]
    if (previous === undefined || current === undefined) {
      continue
    }

    const gapMs = current.timeMs - previous.timeMs
    const kind: TraceNarrativeTransition['kind'] = previous.frame !== null && current.frame !== null && previous.frame === current.frame
      ? 'frame'
      : gapMs <= SHORT_WINDOW_MS
        ? 'window'
        : 'domain'

    if (
      previous.domain === current.domain &&
      previous.system === current.system &&
      previous.category === current.category
    ) {
      continue
    }

    transitions.push({
      fromIndex: previous.index,
      toIndex: current.index,
      fromDomain: previous.domain,
      toDomain: current.domain,
      fromSystem: previous.system ?? null,
      toSystem: current.system ?? null,
      fromCategory: previous.category,
      toCategory: current.category,
      kind
    })
  }

  return transitions
} // end function buildTransitions

function summarizeCombatHealthReduction(narrative: TraceNarrative): string | null {
  const hasCombatReduction = narrative.orderedEvents.some((event) => {
    if (event.category !== 'combat') {
      return false
    }

    return hasPayloadKey(event.payload, ['health', 'hp', 'damage', 'reduction']) || hasPayloadWord(event.payload, ['health', 'damage', 'reduction', 'wound'])
  })

  return hasCombatReduction ? 'Combat triggered a health reduction event.' : null
} // end function summarizeCombatHealthReduction

function summarizeAiPrecededCombat(narrative: TraceNarrative): string | null {
  const hasChain = narrative.inferredTransitions.some((transition) => transition.fromCategory === 'ai' && transition.toCategory === 'combat')
  return hasChain ? 'AI decision preceded combat engagement.' : null
} // end function summarizeAiPrecededCombat

function summarizeMovementSlowedAfterStateMutation(narrative: TraceNarrative): string | null {
  const hasChain = narrative.inferredTransitions.some((transition) => transition.fromCategory === 'state' && transition.toCategory === 'movement')
  if (!hasChain) {
    return null
  }

  const movementEvent = narrative.orderedEvents.find((event) => event.category === 'movement' && hasPayloadWord(event.payload, ['slow', 'slower', 'deceler', 'speed', 'velocity']))
  return movementEvent ? 'Movement slowed following state mutation.' : null
} // end function summarizeMovementSlowedAfterStateMutation

function summarizeTransition(transition: TraceNarrativeTransition): string {
  if (transition.fromCategory === 'ai' && transition.toCategory === 'combat') {
    return 'AI decision preceded combat engagement.'
  }

  if (transition.fromCategory === 'combat' && transition.toCategory === 'state') {
    return 'Combat triggered a health reduction event.'
  }

  if (transition.fromCategory === 'state' && transition.toCategory === 'movement') {
    return 'Movement slowed following state mutation.'
  }

  if (transition.fromCategory === 'scene' && transition.toCategory === 'movement') {
    return 'Scene transition led into movement update.'
  }

  return `${humanizeCategory(transition.fromCategory)} preceded ${humanizeCategory(transition.toCategory)}.`
} // end function summarizeTransition

export function buildTraceNarrative(events: TraceEvent[]): TraceNarrative {
  const orderedEvents = buildOrderedEvents(events)
  const groupedSegments = buildSegments(orderedEvents)
  const inferredTransitions = buildTransitions(orderedEvents)

  return {
    orderedEvents,
    groupedSegments,
    inferredTransitions
  }
} // end function buildTraceNarrative

export function summarizeTraceNarrative(narrative: TraceNarrative): string[] {
  const lines: string[] = []
  const pushUnique = (line: string | null): void => {
    if (!line || lines.includes(line)) {
      return
    }

    lines.push(line)
  }

  pushUnique(summarizeCombatHealthReduction(narrative))
  pushUnique(summarizeAiPrecededCombat(narrative))
  pushUnique(summarizeMovementSlowedAfterStateMutation(narrative))

  narrative.inferredTransitions.forEach((transition) => {
    pushUnique(summarizeTransition(transition))
  })

  return lines
} // end function summarizeTraceNarrative