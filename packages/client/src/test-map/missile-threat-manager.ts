import type { AudioController } from './types.js'

export type MissileWarningState = 'detection' | 'tracking' | 'terminal'

export interface MissileThreatSample {
  id: number
  x: number
  y: number
  speed: number
  velocityX: number
  velocityY: number
  damage: number
  blastRadius: number
  targetsPlayer: boolean
} // end interface MissileThreatSample

export interface MissileThreatManagerUpdateInput {
  missiles: MissileThreatSample[]
  playerX: number
  playerY: number
  playerAngle: number
  deltaSeconds: number
} // end interface MissileThreatManagerUpdateInput

interface MissileThreatTrackState {
  lastDistance: number
  closestDistance: number
  lastApproachSpeed: number
  lastDirection: number
  lastSpeed: number
  disqualified: boolean
  flybyPlayed: boolean
  lastSeenTick: number
} // end interface MissileThreatTrackState

interface MissileThreatCandidate {
  id: number
  score: number
  distance: number
  direction: number
  timeToImpact: number
} // end interface MissileThreatCandidate

export interface MissileThreatManagerOptions {
  threatDistance?: number
  trackingDistance?: number
  terminalDistance?: number
  trackingTtiSeconds?: number
  terminalTtiSeconds?: number
  detectionHoldSeconds?: number
  flybyDistanceThreshold?: number
} // end interface MissileThreatManagerOptions

const DEFAULT_THREAT_DISTANCE = 28
const DEFAULT_TRACKING_DISTANCE = 16
const DEFAULT_TERMINAL_DISTANCE = 8
const DEFAULT_TRACKING_TTI_SECONDS = 2.2
const DEFAULT_TERMINAL_TTI_SECONDS = 1.0
const DEFAULT_DETECTION_HOLD_SECONDS = 0.25
const DEFAULT_FLYBY_DISTANCE_THRESHOLD = 5.5
const DISTANCE_EPSILON = 0.04
const APPROACH_EPSILON = 0.05

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
} // end function clamp

function normalizeAngle(angle: number): number {
  let normalized = angle
  while (normalized > Math.PI) {
    normalized -= Math.PI * 2
  } // end while wrap positive angle
  while (normalized < -Math.PI) {
    normalized += Math.PI * 2
  } // end while wrap negative angle
  return normalized
} // end function normalizeAngle

function toDirectionPan(playerX: number, playerY: number, playerAngle: number, sourceX: number, sourceY: number): number {
  const bearing = Math.atan2(sourceY - playerY, sourceX - playerX)
  const delta = normalizeAngle(bearing - playerAngle)
  return clamp(Math.sin(delta), -1, 1)
} // end function toDirectionPan

export class MissileThreatManager {
  private readonly threatDistance: number
  private readonly trackingDistance: number
  private readonly terminalDistance: number
  private readonly trackingTtiSeconds: number
  private readonly terminalTtiSeconds: number
  private readonly detectionHoldSeconds: number
  private readonly flybyDistanceThreshold: number
  private readonly trackByMissileId = new Map<number, MissileThreatTrackState>()
  private activeThreatMissileId: number | null = null
  private activeWarningState: MissileWarningState | null = null
  private detectionHoldSecondsRemaining = 0
  private tickCounter = 0

  constructor(options?: MissileThreatManagerOptions) {
    this.threatDistance = Math.max(1, options?.threatDistance ?? DEFAULT_THREAT_DISTANCE)
    this.trackingDistance = Math.max(0.5, options?.trackingDistance ?? DEFAULT_TRACKING_DISTANCE)
    this.terminalDistance = Math.max(0.25, options?.terminalDistance ?? DEFAULT_TERMINAL_DISTANCE)
    this.trackingTtiSeconds = Math.max(0.1, options?.trackingTtiSeconds ?? DEFAULT_TRACKING_TTI_SECONDS)
    this.terminalTtiSeconds = Math.max(0.05, options?.terminalTtiSeconds ?? DEFAULT_TERMINAL_TTI_SECONDS)
    this.detectionHoldSeconds = Math.max(0, options?.detectionHoldSeconds ?? DEFAULT_DETECTION_HOLD_SECONDS)
    this.flybyDistanceThreshold = Math.max(0.1, options?.flybyDistanceThreshold ?? DEFAULT_FLYBY_DISTANCE_THRESHOLD)
  } // end constructor

  update(input: MissileThreatManagerUpdateInput, audio: AudioController): void {
    this.tickCounter += 1
    const currentTick = this.tickCounter
    const candidates: MissileThreatCandidate[] = []

    for (const missile of input.missiles) {
      const distance = Math.hypot(missile.x - input.playerX, missile.y - input.playerY)
      const direction = toDirectionPan(input.playerX, input.playerY, input.playerAngle, missile.x, missile.y)
      const safeDistance = Math.max(0.001, distance)
      const toPlayerX = input.playerX - missile.x
      const toPlayerY = input.playerY - missile.y
      const approachSpeed = ((missile.velocityX * toPlayerX) + (missile.velocityY * toPlayerY)) / safeDistance
      const track = this.trackByMissileId.get(missile.id) ?? {
        lastDistance: Number.POSITIVE_INFINITY,
        closestDistance: Number.POSITIVE_INFINITY,
        lastApproachSpeed: 0,
        lastDirection: direction,
        lastSpeed: Math.max(0, missile.speed),
        disqualified: false,
        flybyPlayed: false,
        lastSeenTick: currentTick
      }

      track.lastSeenTick = currentTick
      track.closestDistance = Math.min(track.closestDistance, distance)
      track.lastDirection = direction
      track.lastSpeed = Math.max(0, missile.speed)

      const distanceIncreasing = distance > (track.lastDistance + DISTANCE_EPSILON)
      const crossedPlayerVector = track.lastApproachSpeed > APPROACH_EPSILON && approachSpeed < -APPROACH_EPSILON
      const wasCloseToPlayer = track.closestDistance <= this.flybyDistanceThreshold
      const overshotPlayer = wasCloseToPlayer && (distanceIncreasing || crossedPlayerVector)

      if (overshotPlayer && !track.flybyPlayed) {
        track.disqualified = true
      } // end if missile overshot and should no longer be a threat target

      track.lastApproachSpeed = approachSpeed
      track.lastDistance = distance
      this.trackByMissileId.set(missile.id, track)

      const isThreat = missile.targetsPlayer || distance <= this.threatDistance
      if (!isThreat || track.disqualified) {
        continue
      } // end if missile is not eligible for warning selection

      const threatScore =
        (Math.max(0, missile.damage) * 2.0) +
        (Math.max(0, missile.speed) * 1.5) +
        (1 / safeDistance) +
        (Math.max(0, missile.blastRadius) * 1.2)
      const timeToImpact = safeDistance / Math.max(0.001, missile.speed)
      candidates.push({
        id: missile.id,
        score: threatScore,
        distance,
        direction,
        timeToImpact
      })
    } // end for each active missile sample

    for (const [missileId, track] of this.trackByMissileId.entries()) {
      if (track.lastSeenTick === currentTick) {
        continue
      } // end if missile still exists this tick
      this.trackByMissileId.delete(missileId)
    } // end for each cached missile track

    const selected = candidates.reduce<MissileThreatCandidate | null>((best, candidate) => {
      if (best === null || candidate.score > best.score) {
        return candidate
      }
      return best
    }, null)

    if (this.activeThreatMissileId !== null) {
      const activeTrack = this.trackByMissileId.get(this.activeThreatMissileId)
      if (activeTrack?.disqualified && !activeTrack.flybyPlayed) {
        audio.play_flyby_sound(activeTrack.lastDirection, activeTrack.lastSpeed)
        audio.stop_missile_warning()
        activeTrack.flybyPlayed = true
        this.activeThreatMissileId = null
        this.activeWarningState = null
        this.detectionHoldSecondsRemaining = 0
      }
    } // end if existing active threat may have overshot

    const hasSelection = selected !== null
    if (!hasSelection) {
      if (this.activeThreatMissileId !== null || this.activeWarningState !== null) {
        audio.stop_missile_warning()
      } // end if warning was active
      this.activeThreatMissileId = null
      this.activeWarningState = null
      this.detectionHoldSecondsRemaining = 0
      return
    } // end if no active missile should drive warnings

    const activeChanged = this.activeThreatMissileId !== selected.id
    this.activeThreatMissileId = selected.id

    let nextState: MissileWarningState
    if (activeChanged) {
      this.detectionHoldSecondsRemaining = this.detectionHoldSeconds
      nextState = 'detection'
    } else if (this.detectionHoldSecondsRemaining > 0) {
      this.detectionHoldSecondsRemaining = Math.max(0, this.detectionHoldSecondsRemaining - Math.max(0, input.deltaSeconds))
      nextState = 'detection'
    } else if (selected.distance <= this.terminalDistance || selected.timeToImpact <= this.terminalTtiSeconds) {
      nextState = 'terminal'
    } else if (selected.distance <= this.trackingDistance || selected.timeToImpact <= this.trackingTtiSeconds) {
      nextState = 'tracking'
    } else {
      nextState = 'detection'
    } // end if selecting warning state from urgency

    this.activeWarningState = nextState

    const proximityFactor = clamp(1 - (selected.distance / this.threatDistance), 0, 1)
    const urgencyFactor = clamp(1 - (selected.timeToImpact / this.trackingTtiSeconds), 0, 1)
    const intensity = nextState === 'terminal'
      ? clamp(0.75 + (proximityFactor * 0.25), 0, 1)
      : nextState === 'tracking'
        ? clamp(0.45 + (proximityFactor * 0.25) + (urgencyFactor * 0.15), 0, 1)
        : 0.35

    audio.play_missile_warning(nextState, intensity, selected.direction)
  } // end method update
} // end class MissileThreatManager
