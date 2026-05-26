import * as Tone from 'tone'
import { AUDIO_CONFIG, AUDIO_NAVIGATION_CONFIG } from './audio-config.js'
import {
  clamp,
  distanceToFilter,
  distanceToVolume,
  filterClosest,
  findNearestObstacleContact,
  getBearing,
  initializeAudioCueUtilities,
  normalizeAngle,
  playCardinalOrientationCue as playCardinalOrientationCueUtility,
  playCollisionThud as playCollisionThudUtility,
  playWallProximityCue,
  scanSonarContact,
  silenceWallProximityCue,
  worldToListenerSpace
} from './audio-utils.js'
import { getEnemyDefinition } from './enemies/index.js'
import type { EnemyAutomaticFireDefinition, EnemyId } from './enemies/enemyTypes.js'
import { AudioOcclusionSystem } from './audio-occlusion.js'
import { type SpatialAudioEmitter, createSharedSpatialAudioScene } from './spatial-audio.js'
import type {
  AudioCategory,
  AudioController,
  ImpactAudioOptions,
  MinigunSuppressionImpactEvent,
  MissileWarningType,
  FrontBackSpatialDiagnostics,
  FrontBackSpatialSettings,
  AudioVolumeChannel,
  EnemyAudioState,
  FlightLoopStartParams,
  FlightLoopStopParams,
  FlightLoopUpdateParams,
  FootstepTerrainLayer,
  IncomingProjectileAudioState,
  ObstructionAwareness,
  PlayerAudioState,
  ReloadServoEffect,
  WeaponReloadDefinition,
  SonarEcho,
  SpriteObject,
  WorldPosition
} from './types.js'
import { findNearestDropEdgeContact, getTopSurfaceHeight, type WorldCollisionWorld } from './world-collision.js'
import { SURFACE_MATERIAL, resolveWorldSurfaceMaterial, type SurfaceMaterial } from './surface-material.js'

const AUDIO_BROWSER_DEBUG_LOGS_ENABLED = false

function audioDebugLog(...args: unknown[]): void {
  if (!AUDIO_BROWSER_DEBUG_LOGS_ENABLED) {
    return
  } // end if browser debug logs are disabled
  console.log(...args)
} // end function audioDebugLog

function audioDebugWarn(...args: unknown[]): void {
  if (!AUDIO_BROWSER_DEBUG_LOGS_ENABLED) {
    return
  } // end if browser debug logs are disabled
  console.warn(...args)
} // end function audioDebugWarn

const MATERIAL_IMPACT_SOUND_PATHS: Readonly<Record<SurfaceMaterial, readonly string[]>> = {
  dirt: [
    'assets/sounds/bulletHitsDirt1.ogg',
    'assets/sounds/bulletHitsDirt2.ogg',
    'assets/sounds/bulletHitsDirt3.ogg'
  ],
  stone: [
    'assets/sounds/bullethitsstone1.ogg',
    'assets/sounds/bullethitsstone2.ogg',
    'assets/sounds/bullethitsstone3.ogg'
  ],
  wood: [
    'assets/sounds/bullethitswood1.ogg',
    'assets/sounds/bullethitswood2.ogg',
    'assets/sounds/bullethitswood3.ogg',
    'assets/sounds/bullethitswood4.ogg'
  ],
  water: [
    'assets/sounds/bulletHitsWater1.ogg',
    'assets/sounds/BulletHitsWater2.ogg',
    'assets/sounds/bulletHitsWater3.ogg',
    'assets/sounds/BulletHitsWater4.ogg'
  ],
  metal: [
    'assets/sounds/ricMetal1.ogg',
    'assets/sounds/ricMetal2.ogg',
    'assets/sounds/ricMetal3.ogg',
    'assets/sounds/ricMetal4.ogg',
    'assets/sounds/ricMetal5.ogg'
  ],
  energy: ['assets/sounds/energy.ogg'],
  shield: ['assets/sounds/energy.ogg'],
  flesh: ['assets/sounds/damageSmall1.ogg', 'assets/sounds/damageSmall2.ogg'],
  unknown: ['assets/sounds/tankHit.ogg']
}

const MATERIAL_IMPACT_PROJECTILE_GAIN_SCALE: Readonly<Partial<Record<SurfaceMaterial, number>>> = {
  dirt: 2.1
}

const MATERIAL_IMPACT_PROJECTILE_PRIORITY_BOOST: Readonly<Partial<Record<SurfaceMaterial, number>>> = {
  dirt: 0.22
}

const SUPPRESSION_LOOP_BY_MATERIAL: Readonly<Partial<Record<SurfaceMaterial, string>>> = {
  dirt: 'assets/sounds/dirt_suppression_loop.ogg',
  stone: 'assets/sounds/stone_suppression_loop.ogg',
  wood: 'assets/sounds/wood_suppression_loop.ogg',
  metal: 'assets/sounds/metal_suppression_loop.ogg'
}

const IMPACT_VOICE_POOL_SIZE = 6
const PROJECTILE_IMPACT_GLOBAL_GAIN = 2.2
const PROJECTILE_IMPACT_GAIN_COMPENSATION_MIN_DISTANCE = 6
const PROJECTILE_IMPACT_GAIN_COMPENSATION_MAX_DISTANCE = 72
const PROJECTILE_IMPACT_GAIN_COMPENSATION_MAX_GAIN = 2.4
const IMPACT_CLUSTER_RADIUS = 2.6
const IMPACT_CLUSTER_RETENTION_SECONDS = 0.45
const IMPACT_DENSITY_WINDOW_SECONDS = 1
const IMPACT_DENSITY_WINDOW_LIMIT = 28
const MAX_IMPACT_CLUSTERS = 48
const MAX_SUPPRESSION_REGIONS = 6
const SUPPRESSION_REGION_MERGE_RADIUS = 6.5
const SUPPRESSION_REGION_SCORE_ACTIVATION = 6
const SUPPRESSION_REGION_SCORE_DECAY_PER_SECOND = 2.2
const SUPPRESSION_REGION_IDLE_FADE_SECONDS = 0.24
const SUPPRESSION_REGION_ACTIVE_FADE_SECONDS = 0.12
const SUPPRESSION_REGION_IDLE_TIMEOUT_SECONDS = 0.34

interface EnemySoundSet {
  idleLoop: Tone.Player
  movementLoop: Tone.Player
  passivePing: Tone.Player
  threatCue: Tone.Player
  attackSound: Tone.Player
  attackVariants: Map<number, Tone.Player>
  hurtSound: Tone.Player
  deathSound: Tone.Player
} // end interface EnemySoundSet

interface EnemyEffects {
  filter: Tone.Filter
  gain: Tone.Gain
  emitter: SpatialAudioEmitter
} // end interface EnemyEffects

interface EnemyAudioParams {
  baseVolume: number
  passivePingRateMs: number
  movementVariance: number
  threatCueDelayMs: number
  loopSoundMaxDistance: number
  loopSoundPauseIntervalMs: number
  stopLoopSoundWhileStationary: boolean
} // end interface EnemyAudioParams

interface EnemySoundOverrides {
  positionalLoopSound?: string
  loopSoundMaxDistance?: number
  loopSoundPauseIntervalMs?: number
  stopLoopSoundWhileStationary?: boolean
} // end interface EnemySoundOverrides

interface EnemyAudioProfile {
  id: string
  type: string
  category: string
  loopSoundPath: string
  sounds: EnemySoundSet
  effects: EnemyEffects
  params: EnemyAudioParams
} // end interface EnemyAudioProfile

function createSilentEnemySoundSet(): EnemySoundSet {
  return {
    idleLoop: new Tone.Player(),
    movementLoop: new Tone.Player(),
    passivePing: new Tone.Player(),
    threatCue: new Tone.Player(),
    attackSound: new Tone.Player(),
    attackVariants: new Map(),
    hurtSound: new Tone.Player(),
    deathSound: new Tone.Player()
  }
} // end function createSilentEnemySoundSet

interface IncomingProjectileVoice {
  id: number | null
  projectilePlayer: Tone.Player
  missilePlayer: Tone.Player
  gain: Tone.Gain
  emitter: SpatialAudioEmitter
} // end interface IncomingProjectileVoice

interface MaterialImpactVoicePool {
  material: SurfaceMaterial
  emitter: SpatialAudioEmitter
  gain: Tone.Gain
  voices: Tone.Player[]
  cursor: number
} // end interface MaterialImpactVoicePool

interface ImpactClusterState {
  x: number
  y: number
  lastTimeSeconds: number
  recentCount: number
} // end interface ImpactClusterState

interface SuppressionRegionRuntime {
  id: string
  material: SurfaceMaterial
  emitter: SpatialAudioEmitter
  gain: Tone.Gain
  filter: Tone.Filter
  loopPlayer: Tone.Player | null
  loopPath: string
  loopLoaded: boolean
  loopLoadingPromise: Promise<void> | null
  active: boolean
  score: number
  impactsThisWindow: number
  centroidX: number
  centroidY: number
  centroidZ: number
  lastImpactTimeSeconds: number
  lastAccentTimeSeconds: number
  nextOcclusionImportance: number
} // end interface SuppressionRegionRuntime

interface CardinalHeadingCue {
  id: 'north' | 'east' | 'south' | 'west'
  angle: number
  path: string
} // end interface CardinalHeadingCue

type PlayerMobilityType = 'Wheels' | 'Treads' | 'Hover' | 'Walker' | 'Flight' | 'Placeholder'

type BaseMovementEventId =
  | 'move_start'
  | 'move_stop'
  | 'move_idle'
  | 'move_loop'
  | 'move_accelerate'
  | 'move_decelerate'
  | 'move_skid'
  | 'move_boost'

type WheelsMovementEventId = 'wheel_idle' | 'wheel_roll' | 'wheel_accelerate' | 'wheel_brake' | 'wheel_skid'
type TreadsMovementEventId = 'tread_idle' | 'tread_roll' | 'tread_turn' | 'tread_brake'
type HoverMovementEventId = 'hover_idle' | 'hover_move' | 'hover_strafe' | 'hover_boost'
type WalkerMovementEventId = 'servo_idle' | 'servo_step' | 'servo_turn' | 'servo_jump'
type FlightMovementEventId = 'thruster_start' | 'thruster_loop' | 'thruster_stop'

type MovementAudioEventId =
  | BaseMovementEventId
  | WheelsMovementEventId
  | TreadsMovementEventId
  | HoverMovementEventId
  | WalkerMovementEventId
  | FlightMovementEventId

const MOVEMENT_EVENT_CONTRACTS = {
  base: ['move_start', 'move_stop', 'move_idle', 'move_loop', 'move_accelerate', 'move_decelerate', 'move_skid', 'move_boost'],
  Wheels: ['wheel_idle', 'wheel_roll', 'wheel_accelerate', 'wheel_brake', 'wheel_skid'],
  Treads: ['tread_idle', 'tread_roll', 'tread_turn', 'tread_brake'],
  Hover: ['hover_idle', 'hover_move', 'hover_strafe', 'hover_boost'],
  Walker: ['servo_idle', 'servo_step', 'servo_turn', 'servo_jump'],
  Flight: ['thruster_start', 'thruster_loop', 'thruster_stop'],
  Placeholder: []
} as const

const MOVEMENT_EVENT_CONTRACT_SET = new Set<MovementAudioEventId>([
  ...MOVEMENT_EVENT_CONTRACTS.base,
  ...MOVEMENT_EVENT_CONTRACTS.Wheels,
  ...MOVEMENT_EVENT_CONTRACTS.Treads,
  ...MOVEMENT_EVENT_CONTRACTS.Hover,
  ...MOVEMENT_EVENT_CONTRACTS.Walker,
  ...MOVEMENT_EVENT_CONTRACTS.Flight
])

class EnemyAudioRuntime {
  readonly profile: EnemyAudioProfile

  private readonly idleGain: Tone.Gain
  private readonly movementGain: Tone.Gain
  private readonly oneshotGain: Tone.Gain
  private readonly turnCueSynth: Tone.Synth
  private readonly radarEchoSynth: Tone.FMSynth
  private passivePingTimerSeconds = 0
  private attackDuckingTimerSeconds = 0
  private activeSonarStamp = -1
  private alive = true
  private lastTurnCueTime = -1
  private loopPauseTimerSeconds = 0
  private loopIsInPause = false
  private loopWasMoving = false
  private loopHasStartedSinceMove = false

  constructor(profile: EnemyAudioProfile) {
    this.profile = profile

    this.idleGain = new Tone.Gain(0)
    this.movementGain = new Tone.Gain(0)
    this.oneshotGain = new Tone.Gain(1)

    profile.sounds.idleLoop.loop = true
    profile.sounds.movementLoop.loop = profile.params.loopSoundPauseIntervalMs <= 0

    // Route every source through a single enemy chain.
    profile.sounds.idleLoop.connect(this.idleGain)
    profile.sounds.movementLoop.connect(this.movementGain)
    this.idleGain.connect(profile.effects.filter)
    this.movementGain.connect(profile.effects.filter)
    this.oneshotGain.connect(profile.effects.filter)

    profile.sounds.passivePing.connect(this.oneshotGain)
    profile.sounds.threatCue.connect(this.oneshotGain)
    profile.sounds.attackSound.connect(this.oneshotGain)
    for (const variant of profile.sounds.attackVariants.values()) {
      variant.connect(this.oneshotGain)
    } // end for each burst attack variant
    profile.sounds.hurtSound.connect(this.oneshotGain)
    profile.sounds.deathSound.connect(this.oneshotGain)

    profile.effects.filter.connect(profile.effects.gain)
    profile.effects.gain.connect(profile.effects.emitter.input)

    this.turnCueSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.002, decay: 0.05, sustain: 0, release: 0.03 }
    })
    this.turnCueSynth.connect(this.oneshotGain)

    this.radarEchoSynth = new Tone.FMSynth({
      harmonicity: 1.8,
      modulationIndex: 4,
      envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.04 }
    })
    this.radarEchoSynth.connect(this.oneshotGain)

    this.passivePingTimerSeconds = this.randomPassiveIntervalSeconds()
  } // end constructor

  initializeLoops(): void {
    // Start once and keep running so enemy loops remain trackable in 3D space.
    if (!this.profile.params.stopLoopSoundWhileStationary) {
      this.safeStart(this.profile.sounds.movementLoop)
    } // end if loop should run regardless of movement
    this.idleGain.gain.rampTo(0, AUDIO_CONFIG.enemy.idleFadeSeconds)
    this.movementGain.gain.rampTo(1, AUDIO_CONFIG.enemy.movementFadeSeconds)
  } // end method initializeLoops

  updateAudio(dt: number, enemy: EnemyAudioState, player: PlayerAudioState, occlusionAmount: number, volumeScale: number): void {
    // Handle movement-gated and pause-interval loop logic.
    this.updateMovementLoop(dt, enemy)

    this.profile.effects.emitter.setPosition(enemy.position.x, enemy.position.y, enemy.position.z)

    const distance = Math.hypot(
      enemy.position.x - player.position.x,
      enemy.position.y - player.position.y,
      enemy.position.z - player.position.z
    )
    const enemyMaxDistance = Math.max(0.001, this.profile.params.loopSoundMaxDistance)
    const distanceVolume = distanceToVolume(distance, enemyMaxDistance)
    const clampedOcclusion = clamp(occlusionAmount, 0, 1)
    const occlusionVolumeScale = 1 + ((AUDIO_CONFIG.enemy.occlusionVolumeMultiplier - 1) * clampedOcclusion)
    const targetVolume = distance <= enemyMaxDistance
      ? this.profile.params.baseVolume * Math.pow(distanceVolume, AUDIO_NAVIGATION_CONFIG.enemyAudioDistanceExponent) * volumeScale * occlusionVolumeScale
      : 0
    this.profile.effects.gain.gain.rampTo(targetVolume, 0.08)

    const clearFilterTarget = distanceToFilter(distance) + enemy.height * AUDIO_CONFIG.enemy.altitudeFilterScale
    const occludedFilterTarget = Math.min(clearFilterTarget, AUDIO_CONFIG.enemy.occlusionLowpassHz)
    const filterTarget = clearFilterTarget + ((occludedFilterTarget - clearFilterTarget) * clampedOcclusion)
    this.profile.effects.filter.frequency.rampTo(filterTarget, AUDIO_CONFIG.enemy.occlusionTransitionSeconds)

    const isHelicopter = this.profile.type === AUDIO_CONFIG.helicopter.type
    if (!isHelicopter) {
      this.setPlaybackRateSafely(
        this.profile.sounds.movementLoop,
        clamp(0.9 + Math.hypot(enemy.velocity.x, enemy.velocity.y, enemy.velocity.z) * 0.08, 0.9, 1.35)
      )
    } // end if non-helicopter movement rate

    this.idleGain.gain.rampTo(0, AUDIO_CONFIG.enemy.idleFadeSeconds)
    this.movementGain.gain.rampTo(enemy.isAlive ? 1 : 0, AUDIO_CONFIG.enemy.movementFadeSeconds)
    this.attackDuckingTimerSeconds = Math.max(0, this.attackDuckingTimerSeconds - dt)

    this.alive = enemy.isAlive
  } // end method updateAudio

  onSonarPing(stamp: number, height: number): void {
    if (this.activeSonarStamp === stamp || !this.alive) {
      return
    } // end if sonar already consumed

    this.activeSonarStamp = stamp
    this.setPlaybackRateSafely(
      this.profile.sounds.passivePing,
      clamp(1.2 + height * AUDIO_CONFIG.enemy.altitudePitchScale, 0.75, 2)
    )
    this.safeRetrigger(this.profile.sounds.passivePing)
  } // end method onSonarPing

  playPassiveRadarEcho(): void {
    if (!this.alive) {
      return
    } // end if enemy not alive
    this.radarEchoSynth.triggerAttackRelease('C5', '16n')
  } // end method playPassiveRadarEcho

  playThreatCue(): void {
    if (!this.alive) {
      return
    } // end if enemy not alive
    this.setPlaybackRateSafely(this.profile.sounds.threatCue, 1)
    this.safeRetrigger(this.profile.sounds.threatCue)
  } // end method playThreatCue

  playAttack(burstProjectileCount?: number): void {
    if (!this.alive) {
      return
    } // end if enemy not alive
    this.attackDuckingTimerSeconds = AUDIO_CONFIG.enemy.attackDuckingSeconds
    const burstVariant = burstProjectileCount !== undefined
      ? this.profile.sounds.attackVariants.get(Math.max(1, Math.round(burstProjectileCount)))
      : undefined
    const attackPlayer = burstVariant?.loaded
      ? burstVariant
      : this.profile.sounds.attackSound
    this.setPlaybackRateSafely(attackPlayer, 0.9)
    this.safeRetrigger(attackPlayer)
  } // end method playAttack

  playHurt(): void {
    if (!this.alive) {
      return
    } // end if enemy not alive
    this.setPlaybackRateSafely(this.profile.sounds.hurtSound, 1 + (Math.random() * 0.14 - 0.07))
    this.safeRetrigger(this.profile.sounds.hurtSound)
    this.triggerTurnCue('A4', '64n')
  } // end method playHurt

  playDeath(): void {
    this.idleGain.gain.rampTo(0, AUDIO_CONFIG.enemy.idleFadeSeconds)
    this.movementGain.gain.rampTo(0, AUDIO_CONFIG.enemy.movementFadeSeconds)
    this.setPlaybackRateSafely(this.profile.sounds.deathSound, 0.8)
    this.safeRetrigger(this.profile.sounds.deathSound)
    this.alive = false
  } // end method playDeath

  dispose(): void {
    this.profile.sounds.idleLoop.stop()
    this.profile.sounds.movementLoop.stop()
    this.turnCueSynth.dispose()
    this.radarEchoSynth.dispose()
    this.idleGain.dispose()
    this.movementGain.dispose()
    this.oneshotGain.dispose()
    this.profile.sounds.idleLoop.dispose()
    this.profile.sounds.movementLoop.dispose()
    this.profile.sounds.passivePing.dispose()
    this.profile.sounds.threatCue.dispose()
    this.profile.sounds.attackSound.dispose()
    for (const variant of this.profile.sounds.attackVariants.values()) {
      variant.dispose()
    } // end for each burst attack variant
    this.profile.sounds.attackVariants.clear()
    this.profile.sounds.hurtSound.dispose()
    this.profile.sounds.deathSound.dispose()
    this.profile.effects.filter.dispose()
    this.profile.effects.gain.dispose()
    this.profile.effects.emitter.dispose()
  } // end method dispose

  private triggerPassivePing(height: number): void {
    this.setPlaybackRateSafely(
      this.profile.sounds.passivePing,
      clamp(0.9 + height * AUDIO_CONFIG.enemy.altitudePitchScale, 0.75, 2)
    )
    this.safeRetrigger(this.profile.sounds.passivePing)
  } // end method triggerPassivePing

  private updateMovementLoop(dt: number, enemy: EnemyAudioState): void {
    const { stopLoopSoundWhileStationary, loopSoundPauseIntervalMs } = this.profile.params
    const player = this.profile.sounds.movementLoop

    if (stopLoopSoundWhileStationary) {
      const justStartedMoving = enemy.isMoving && !this.loopWasMoving
      const justStoppedMoving = !enemy.isMoving && this.loopWasMoving
      this.loopWasMoving = enemy.isMoving

      if (justStoppedMoving) {
        // Immediately stop the loop when the enemy halts.
        if (player.state === 'started') {
          try { player.stop() } catch { /* ignore race */ }
        } // end if player running
        this.loopIsInPause = false
        this.loopPauseTimerSeconds = 0
        this.loopHasStartedSinceMove = false
        return
      } // end if just stopped moving

      if (!enemy.isMoving) {
        return
      } // end if enemy is stationary

      if (justStartedMoving) {
        // Reset pause state so the loop starts immediately.
        this.loopIsInPause = false
        this.loopPauseTimerSeconds = 0
        this.loopHasStartedSinceMove = false
      } // end if just started moving
    } // end if stop-while-stationary

    if (loopSoundPauseIntervalMs > 0) {
      if (this.loopIsInPause) {
        this.loopPauseTimerSeconds -= dt
        if (this.loopPauseTimerSeconds <= 0) {
          this.loopIsInPause = false
          this.safeStart(player)
          if (player.state === 'started') {
            this.loopHasStartedSinceMove = true
          } // end if resumed from pause
        } // end if pause elapsed
      } else {
        if (!this.loopHasStartedSinceMove) {
          // Initial start after movement/load.
          this.safeStart(player)
          if (player.state === 'started') {
            this.loopHasStartedSinceMove = true
          } // end if first play successfully started
        } else if (player.loaded && player.state === 'stopped') {
          // A play has completed, so enter pause phase before the next play.
          this.loopIsInPause = true
          this.loopPauseTimerSeconds = loopSoundPauseIntervalMs / 1000
        } else {
          // Buffer may not be loaded yet — keep trying to start.
          this.safeStart(player)
        } // end if player stopped
      } // end if not in pause
    } else {
      // Continuous loop (existing behaviour).
      this.safeStart(player)
    } // end if pause interval
  } // end method updateMovementLoop

  private setPlaybackRateSafely(player: Tone.Player, playbackRate: number): void {
    try {
      player.playbackRate = playbackRate
    } catch {
      // Ignore timeline ordering errors from rapid rescheduling.
    } // end try/catch playbackRate set
  } // end method setPlaybackRateSafely

  private safeStart(player: Tone.Player): void {
    if (!player.loaded) {
      return
    } // end if player buffer not loaded

    if (player.state !== 'started') {
      player.start()
    } // end if player not started
  } // end method safeStart

  private safeRetrigger(player: Tone.Player): void {
    if (!player.loaded) {
      return
    } // end if player buffer not loaded

    try {
      if (player.state === 'started') {
        player.stop()
      } // end if player started
      player.start()
    } catch {
      // Ignore dense stop/start race conditions under heavy enemy fire.
    } // end try/catch retrigger
  } // end method safeRetrigger

  private randomPassiveIntervalSeconds(): number {
    const minMs = AUDIO_CONFIG.enemy.passivePingMinMs
    const maxMs = AUDIO_CONFIG.enemy.passivePingMaxMs
    return (minMs + Math.random() * (maxMs - minMs)) / 1000
  } // end method randomPassiveIntervalSeconds

  private triggerTurnCue(note: string, duration: Tone.Unit.Time): void {
    const now = Tone.now()
    const triggerTime = this.lastTurnCueTime >= 0
      ? Math.max(now, this.lastTurnCueTime + 0.002)
      : now

    try {
      this.turnCueSynth.triggerAttackRelease(note, duration, triggerTime)
      this.lastTurnCueTime = triggerTime
    } catch {
      // Ignore tightly-packed cue scheduling conflicts.
    } // end try/catch cue schedule
  } // end method triggerTurnCue
} // end class EnemyAudioRuntime

function isEnemyId(enemyType: string): enemyType is EnemyId {
  return enemyType === 'tank' || enemyType === 'striker' || enemyType === 'brute' || enemyType === 'helicopter' || enemyType === 'bruiser' || enemyType === 'test-dummy'
} // end function isEnemyId

function createAttackVariantPlayers(automaticFire?: EnemyAutomaticFireDefinition): Map<number, Tone.Player> {
  const variants = new Map<number, Tone.Player>()
  if (!automaticFire?.enabled) {
    return variants
  } // end if enemy does not use burst attack variants

  for (const configuredRoundCount of automaticFire.burstRoundCounts) {
    const roundedRoundCount = Math.max(1, Math.round(configuredRoundCount))
    if (variants.has(roundedRoundCount)) {
      continue
    } // end if this burst-count variant already exists

    const variantPath = `${automaticFire.burstAudioPrefix}${roundedRoundCount}.ogg`
    const variantPlayer = new Tone.Player(variantPath)
    // Kick off variant loading immediately so the first burst can use the intended SFX.
    void variantPlayer.load(variantPath).catch((error) => {
      audioDebugWarn('Failed to load burst attack variant.', { variantPath, error })
    })
    variants.set(roundedRoundCount, variantPlayer)
  } // end for each configured burst round count

  return variants
} // end function createAttackVariantPlayers

function getEnemyAutomaticFireDefinition(definition: unknown): EnemyAutomaticFireDefinition | undefined {
  if (typeof definition !== 'object' || definition === null || !('automaticFire' in definition)) {
    return undefined
  } // end if definition cannot expose automatic-fire config

  return definition.automaticFire as EnemyAutomaticFireDefinition | undefined
} // end function getEnemyAutomaticFireDefinition

type SpatialEmitterFactory = (minDistance: number, maxDistance: number) => SpatialAudioEmitter

function createTankProfile(
  enemyId: string,
  enemyType: string,
  emitterFactory: SpatialEmitterFactory,
  overrides?: EnemySoundOverrides
): EnemyAudioProfile {
  const definition = isEnemyId(enemyType) ? getEnemyDefinition(enemyType) : null
  const loopSoundPath = overrides?.positionalLoopSound ?? definition?.sounds.positionalLoopSound ?? 'assets/sounds/tankMoving.ogg'
  const filter = new Tone.Filter({ type: 'lowpass', frequency: 2600, Q: 0.7 })
  const gain = new Tone.Gain(0)
  const maxDistance = Math.max(1, overrides?.loopSoundMaxDistance ?? definition?.sounds.loopSoundMaxDistance ?? AUDIO_NAVIGATION_CONFIG.enemyAudioMaxDistance)
  const emitter = emitterFactory(8, maxDistance)

  return {
    id: enemyId,
    type: enemyType,
    category: AUDIO_CONFIG.tank.category,
    loopSoundPath,
    sounds: {
      idleLoop: new Tone.Player(loopSoundPath),
      movementLoop: new Tone.Player(loopSoundPath),
      passivePing: new Tone.Player('assets/sounds/servomotor.ogg'),
      threatCue: new Tone.Player(definition?.sounds.startupSound ?? 'assets/sounds/weapons/reload/reloadCannon.ogg'),
      attackSound: new Tone.Player(definition?.sounds.attackSound ?? 'assets/sounds/explosions/explosion_1A.ogg'),
      attackVariants: createAttackVariantPlayers(getEnemyAutomaticFireDefinition(definition)),
      hurtSound: new Tone.Player(definition?.sounds.hurtSound ?? 'assets/sounds/explosions/explosion_1B.ogg'),
      deathSound: new Tone.Player(definition?.sounds.deathSound ?? 'assets/sounds/explosions/explosion_2a.ogg')
    },
    effects: {
      filter,
      gain,
      emitter
    },
    params: {
      baseVolume: AUDIO_CONFIG.tank.baseVolume,
      passivePingRateMs: AUDIO_CONFIG.tank.passivePingRateMs,
      movementVariance: AUDIO_CONFIG.tank.movementVariance,
      threatCueDelayMs: AUDIO_CONFIG.tank.threatCueDelayMs,
      loopSoundMaxDistance: maxDistance,
      loopSoundPauseIntervalMs: overrides?.loopSoundPauseIntervalMs ?? definition?.sounds.loopSoundPauseIntervalMs ?? 0,
      stopLoopSoundWhileStationary: overrides?.stopLoopSoundWhileStationary ?? definition?.sounds.stopLoopSoundWhileStationary ?? false
    }
  } // end object enemy profile
} // end function createTankProfile

function createHelicopterProfile(
  enemyId: string,
  enemyType: string,
  emitterFactory: SpatialEmitterFactory,
  overrides?: EnemySoundOverrides
): EnemyAudioProfile {
  const definition = isEnemyId(enemyType) ? getEnemyDefinition(enemyType) : null
  const loopSoundPath = overrides?.positionalLoopSound ?? definition?.sounds.positionalLoopSound ?? 'assets/sounds/helicopterLoop.ogg'
  const filter = new Tone.Filter({ type: 'lowpass', frequency: 3400, Q: 0.5 })
  const gain = new Tone.Gain(0)
  const maxDistance = Math.max(1, overrides?.loopSoundMaxDistance ?? definition?.sounds.loopSoundMaxDistance ?? AUDIO_CONFIG.enemy.maxDistance)
  const emitter = emitterFactory(1, maxDistance)

  return {
    id: enemyId,
    type: enemyType,
    category: AUDIO_CONFIG.helicopter.category,
    loopSoundPath,
    sounds: {
      idleLoop: new Tone.Player(loopSoundPath),
      movementLoop: new Tone.Player(loopSoundPath),
      passivePing: new Tone.Player('assets/sounds/servomotor.ogg'),
      threatCue: new Tone.Player(definition?.sounds.startupSound ?? 'assets/sounds/weapons/reload/reload.ogg'),
      attackSound: new Tone.Player(definition?.sounds.attackSound ?? 'assets/sounds/weapons/pistol_fire.ogg'),
      attackVariants: createAttackVariantPlayers(getEnemyAutomaticFireDefinition(definition)),
      hurtSound: new Tone.Player(definition?.sounds.hurtSound ?? 'assets/sounds/tankHit.ogg'),
      deathSound: new Tone.Player(definition?.sounds.deathSound ?? 'assets/sounds/explosions/explosion_2a.ogg')
    },
    effects: {
      filter,
      gain,
      emitter
    },
    params: {
      baseVolume: AUDIO_CONFIG.helicopter.baseVolume,
      passivePingRateMs: AUDIO_CONFIG.helicopter.passivePingRateMs,
      movementVariance: AUDIO_CONFIG.helicopter.movementVariance,
      threatCueDelayMs: AUDIO_CONFIG.helicopter.threatCueDelayMs,
      loopSoundMaxDistance: maxDistance,
      loopSoundPauseIntervalMs: overrides?.loopSoundPauseIntervalMs ?? definition?.sounds.loopSoundPauseIntervalMs ?? 0,
      stopLoopSoundWhileStationary: overrides?.stopLoopSoundWhileStationary ?? definition?.sounds.stopLoopSoundWhileStationary ?? false
    }
  }
} // end function createHelicopterProfile

function createEnemyProfile(
  enemyId: string,
  enemyType: string,
  emitterFactory: SpatialEmitterFactory,
  overrides?: EnemySoundOverrides
): EnemyAudioProfile {
  if (enemyType === AUDIO_CONFIG.helicopter.type) {
    return createHelicopterProfile(enemyId, enemyType, emitterFactory, overrides)
  } // end if helicopter
  return createTankProfile(enemyId, enemyType, emitterFactory, overrides)
} // end function createEnemyProfile

function createFallbackEnemyProfile(
  enemyId: string,
  enemyType: string,
  emitterFactory: SpatialEmitterFactory
): EnemyAudioProfile {
  const filter = new Tone.Filter({ type: 'lowpass', frequency: 2600, Q: 0.7 })
  const gain = new Tone.Gain(0)
  const emitter = emitterFactory(8, AUDIO_NAVIGATION_CONFIG.enemyAudioMaxDistance)

  const isHelicopter = enemyType === AUDIO_CONFIG.helicopter.type
  return {
    id: enemyId,
    type: enemyType,
    category: isHelicopter ? AUDIO_CONFIG.helicopter.category : AUDIO_CONFIG.tank.category,
    loopSoundPath: '',
    sounds: createSilentEnemySoundSet(),
    effects: {
      filter,
      gain,
      emitter
    },
    params: {
      baseVolume: isHelicopter ? AUDIO_CONFIG.helicopter.baseVolume : AUDIO_CONFIG.tank.baseVolume,
      passivePingRateMs: isHelicopter ? AUDIO_CONFIG.helicopter.passivePingRateMs : AUDIO_CONFIG.tank.passivePingRateMs,
      movementVariance: isHelicopter ? AUDIO_CONFIG.helicopter.movementVariance : AUDIO_CONFIG.tank.movementVariance,
      threatCueDelayMs: isHelicopter ? AUDIO_CONFIG.helicopter.threatCueDelayMs : AUDIO_CONFIG.tank.threatCueDelayMs,
      loopSoundMaxDistance: AUDIO_NAVIGATION_CONFIG.enemyAudioMaxDistance,
      loopSoundPauseIntervalMs: 0,
      stopLoopSoundWhileStationary: false
    }
  }
} // end function createFallbackEnemyProfile

export function createAudioController(): AudioController {
  let audioStarted = false
  let audioPaused = false
  let servoPlaying = false
  let servoWasPlayingBeforePause = false
  let servoTimeBeforePause = 0
  let footstepWasPlayingBeforePause = false
  let footstepTimeBeforePause = 0
  let ambienceWasPlayingBeforePause = false
  let ambienceTimeBeforePause = 0
  let cityAmbienceWasPlayingBeforePause = false
  let cityAmbienceTimeBeforePause = 0
  let cityAmbienceMix = 0
  let flightLoopWasPlayingBeforePause = false
  let contextWasRunningBeforePause = false
  let aimAssistEnabled = true
  let previousPlayerX = 0
  let previousPlayerY = 0
  let previousPlayerZ = 0
  let passiveRadarTimerSeconds: number = AUDIO_CONFIG.player.passiveRadarMinIntervalSeconds
  let activeSonarStamp = 0
  let passiveSweepAccumulatorSeconds = 0
  let passiveSweepAngle = 0
  let lastPassiveSweepTriggerTime = -1
  let obstructionCueCooldownSeconds = 0
  let obstructionWasBlocked = false
  let sonarEchoVoiceCursor = 0
  let enemyPingVoiceCursor = 0
  let boundaryWarningTimerSeconds = 0
  let boundaryPulseCooldownSeconds = 0
  let aimAssistCueTimerSeconds = 0
  let bulletNearMissVoiceCursor = 0
  let projectileNearMissVoiceCursor = 0
  let playerMechHitBaseVoiceCursor = 0
  let playerMechHitDetailVoiceCursor = 0
  let energyStatusLoopStarted = false
  let energyStatusCrackleStarted = false
  let heatStatusSizzleStarted = false
  let hoverMobilityTremoloStarted = false
  let radarDetectionTremoloStarted = false
  let lastImpactTimeSeconds = -1
  let lastTankHitConfirmTimeSeconds = -1
  let suppressedImpactCount = 0
  let voicePriorityDrops = 0
  let impactPlaybackWindowSeconds = 0
  let impactPlaybackCountWindow = 0
  let impactPlaybackDensityPerSecond = 0
  let suppressObjectNavigationIndicators = false
  const impactClusters: ImpactClusterState[] = []
  const materialHitCounts: Record<SurfaceMaterial, number> = {
    dirt: 0,
    stone: 0,
    wood: 0,
    metal: 0,
    water: 0,
    energy: 0,
    shield: 0,
    flesh: 0,
    unknown: 0
  }
  const suppressionRegions: SuppressionRegionRuntime[] = []
  const materialImpactPools = new Map<SurfaceMaterial, MaterialImpactVoicePool>()
  const movementSemanticState: {
    initialized: boolean
    activeMode: PlayerMobilityType
    wasMoving: boolean
    wasAccelerating: boolean
    wasGrounded: boolean
  } = {
    initialized: false,
    activeMode: 'Placeholder',
    wasMoving: false,
    wasAccelerating: false,
    wasGrounded: true
  }

  let categoryProximity = true
  let categoryObjects = true
  let categoryEnemies = true
  let categoryNavigation = true
  let radarDetectionOscStarted = false
  let destinationToneOscStarted = false
  let masterVolume = 1
  let ambienceVolume = 0
  let musicVolume = 0
  let servoVolume = 1
  let servoMotionIntensity = 0
  let footstepsVolume = 1
  let debugPitchScale = 1
  let flightLoopVolume = 0.5
  let energyStatusVolume = 1.35
  let proximityVolume = 1
  let objectsVolume = 1
  let enemiesVolume = 1
  let navigationVolume = 1

  const aimAssistProjectileRadius = 0.25

  const rawContext = Tone.getContext().rawContext as AudioContext
  const spatialScene = createSharedSpatialAudioScene(rawContext)
  spatialScene.setFrontBackEnhancementEnabled(AUDIO_CONFIG.enemy.frontBackEnhancement.enabled)
  spatialScene.setFrontBackRearCueLayerEnabled(AUDIO_CONFIG.enemy.frontBackEnhancement.rearCueLayerEnabled)
  spatialScene.setFrontBackEnhancementIntensity(AUDIO_CONFIG.enemy.frontBackEnhancement.intensity)
  const audioOcclusionSystem = new AudioOcclusionSystem({
    debugLogging: AUDIO_BROWSER_DEBUG_LOGS_ENABLED
  })

  const createWorldEmitter = (minDistance: number, maxDistance: number): SpatialAudioEmitter => {
    return spatialScene.createEmitter({
      minDistance,
      maxDistance,
      positionSmoothing: 1,
      gain: 1,
      directivity: { alpha: 0, sharpness: 1 }
    })
  } // end function createWorldEmitter

  const enemyRuntimes = new Map<string, EnemyAudioRuntime>()

  const clampVolumeScalar = (value: number): number => clamp(value, 0, 2)

  const gainToDbSafe = (value: number): number => value <= 0.0001 ? -80 : Tone.gainToDb(value)
  const elevatedSurfaceMinHeight = 0.2
  const elevatedSurfaceTolerance = 0.25

  const smoothstep01 = (value: number): number => {
    const t = clamp(value, 0, 1)
    return (t * t) * (3 - (2 * t))
  } // end function smoothstep01

  const resolveElevatedSurfaceHeight = (player: PlayerAudioState, collisionWorld: WorldCollisionWorld): number | null => {
    if (player.isFlying || player.position.z <= elevatedSurfaceMinHeight) {
      return null
    } // end if player cannot be standing on an elevated object

    const supportHeight = getTopSurfaceHeight(collisionWorld, player.position.x, player.position.y, 0.35)
    if (supportHeight <= elevatedSurfaceMinHeight) {
      return null
    } // end if no elevated support under player footprint

    if (player.position.z + elevatedSurfaceTolerance < supportHeight) {
      return null
    } // end if player's feet are below the supporting surface sample

    return supportHeight
  } // end function resolveElevatedSurfaceHeight

  const getDistanceToRect = (
    x: number,
    y: number,
    xMin: number,
    yMin: number,
    xMax: number,
    yMax: number
  ): number => {
    const dx = x < xMin ? xMin - x : x > xMax ? x - xMax : 0
    const dy = y < yMin ? yMin - y : y > yMax ? y - yMax : 0
    return Math.hypot(dx, dy)
  } // end function getDistanceToRect

  const updateZoneAmbienceMix = (player: PlayerAudioState, dt: number): void => {
    const zone = AUDIO_CONFIG.player.novaCityZone
    const xMin = zone.colStart
    const yMin = zone.rowStart
    const xMax = zone.colStart + zone.width - 1
    const yMax = zone.rowStart + zone.height - 1
    const distanceToCity = getDistanceToRect(player.position.x, player.position.y, xMin, yMin, xMax, yMax)
    const targetMix = smoothstep01(1 - (distanceToCity / Math.max(0.001, zone.blendDistance)))
    const blendSeconds = Math.max(0.001, AUDIO_CONFIG.player.zoneAmbienceBlendSeconds)
    const blendAmount = clamp(dt / blendSeconds, 0, 1)
    cityAmbienceMix += (targetMix - cityAmbienceMix) * blendAmount
    cityAmbienceMix = clamp(cityAmbienceMix, 0, 1)
  } // end function updateZoneAmbienceMix

  const applyFlightLoopVolume = (): void => {
    flightLoopGain.gain.value = 0.78 * flightLoopVolume
  } // end function applyFlightLoopVolume

  const applyHtmlAudioVolumes = (): void => {
    const ambienceBaseVolume = AUDIO_CONFIG.player.ambienceVolume * masterVolume * ambienceVolume
    ambienceAudio.volume = ambienceBaseVolume * (1 - cityAmbienceMix)
    cityAmbienceAudio.volume = ambienceBaseVolume * cityAmbienceMix
    musicAudio.volume = AUDIO_CONFIG.player.musicVolume * masterVolume * musicVolume
    servoAudio.volume = AUDIO_CONFIG.player.servoVolume * masterVolume * servoVolume
    footstepAudio.volume = 0.25 * masterVolume * footstepsVolume
    allTerrainStepAudios.forEach((audio) => {
      audio.volume = AUDIO_CONFIG.player.terrainStepVolume * masterVolume * footstepsVolume
    })
  } // end function applyHtmlAudioVolumes

  const applyServoPlaybackRate = (): void => {
    const baseRate = Math.max(0.5, Math.min(2, debugPitchScale))
    const motionRateScale = 1 + (Math.max(0, Math.min(1, servoMotionIntensity)) * 0.9)
    servoAudio.playbackRate = Math.max(0.5, Math.min(2, baseRate * motionRateScale))
  } // end function applyServoPlaybackRate

  const applyHtmlAudioPitchScale = (): void => {
    const playbackRate = Math.max(0.5, Math.min(2, debugPitchScale))
    ambienceAudio.playbackRate = playbackRate
    cityAmbienceAudio.playbackRate = playbackRate
    musicAudio.playbackRate = playbackRate
    applyServoPlaybackRate()
    footstepAudio.playbackRate = playbackRate
    allTerrainStepAudios.forEach((audio) => {
      audio.playbackRate = playbackRate
    })
  } // end function applyHtmlAudioPitchScale

  const setServoMotionIntensity = (normalizedMotion: number): void => {
    servoMotionIntensity = Math.max(0, Math.min(1, normalizedMotion))
    applyServoPlaybackRate()
  } // end function setServoMotionIntensity

  const setDebugPitchScale = (value: number): number => {
    const nextValue = Math.max(0.5, Math.min(2, Number.isFinite(value) ? value : 1))
    debugPitchScale = nextValue
    applyHtmlAudioPitchScale()
    return debugPitchScale
  } // end function setDebugPitchScale

  const getDebugPitchScale = (): number => debugPitchScale

  const getFrontBackDiagnostics = (emitterId: string): FrontBackSpatialDiagnostics | null => spatialScene.getFrontBackDiagnostics(emitterId)

  const getAllFrontBackDiagnostics = (): FrontBackSpatialDiagnostics[] => spatialScene.getAllFrontBackDiagnostics()

  const getFrontBackSettings = (): FrontBackSpatialSettings => spatialScene.getFrontBackSettings()

  const getCategoryVolume = (name: AudioCategory): number => {
    if (name === 'proximity') return proximityVolume
    if (name === 'objects') return objectsVolume
    if (name === 'enemies') return enemiesVolume
    return navigationVolume
  } // end function getCategoryVolume

  const setCategoryEnabled = (name: AudioCategory, enabled: boolean): boolean => {
    if (name === 'proximity') {
      categoryProximity = enabled
      return categoryProximity
    } // end if proximity
    if (name === 'objects') {
      categoryObjects = enabled
      return categoryObjects
    } // end if objects
    if (name === 'enemies') {
      categoryEnemies = enabled
      if (!enabled) {
        radarDetectionGain.gain.rampTo(0, 0.08)
        aimAssistGain.gain.rampTo(0, 0.08)
        aimAssistCueTimerSeconds = 0
      } // end if enemies category was disabled
      return categoryEnemies
    } // end if enemies
    categoryNavigation = enabled
    return categoryNavigation
  } // end function setCategoryEnabled

  const setVolumeChannel = (name: AudioVolumeChannel, value: number): number => {
    const nextValue = clampVolumeScalar(value)
    if (name === 'master') {
      masterVolume = nextValue
      Tone.getDestination().volume.value = gainToDbSafe(masterVolume)
      applyHtmlAudioVolumes()
      return masterVolume
    } // end if master volume
    if (name === 'ambience') {
      ambienceVolume = nextValue
      applyHtmlAudioVolumes()
      return ambienceVolume
    } // end if ambience volume
    if (name === 'music') {
      musicVolume = nextValue
      applyHtmlAudioVolumes()
      return musicVolume
    } // end if music volume
    if (name === 'servo') {
      servoVolume = nextValue
      applyHtmlAudioVolumes()
      return servoVolume
    } // end if servo volume
    if (name === 'footsteps') {
      footstepsVolume = nextValue
      applyHtmlAudioVolumes()
      return footstepsVolume
    } // end if footsteps volume
    if (name === 'flightLoop') {
      flightLoopVolume = nextValue
      applyFlightLoopVolume()
      return flightLoopVolume
    } // end if flight-loop volume
    if (name === 'energyStatus') {
      energyStatusVolume = nextValue
      return energyStatusVolume
    } // end if energy-status volume
    if (name === 'proximity') {
      proximityVolume = nextValue
      return proximityVolume
    } // end if proximity volume
    if (name === 'objects') {
      objectsVolume = nextValue
      return objectsVolume
    } // end if objects volume
    if (name === 'enemies') {
      enemiesVolume = nextValue
      return enemiesVolume
    } // end if enemies volume
    navigationVolume = nextValue
    return navigationVolume
  } // end function setVolumeChannel

  const getVolumeChannel = (name: AudioVolumeChannel): number => {
    if (name === 'master') return masterVolume
    if (name === 'ambience') return ambienceVolume
    if (name === 'music') return musicVolume
    if (name === 'servo') return servoVolume
    if (name === 'footsteps') return footstepsVolume
    if (name === 'flightLoop') return flightLoopVolume
    if (name === 'energyStatus') return energyStatusVolume
    return getCategoryVolume(name)
  } // end function getVolumeChannel

  const footstepAudio = new Audio('assets/sounds/footstep.ogg')
  footstepAudio.preload = 'auto'
  footstepAudio.volume = 0.25

  const defaultTerrainStepFiles = Array.from(
    { length: AUDIO_CONFIG.player.terrainStepVariantCount },
    (_, index) => `assets/sounds/steps/${AUDIO_CONFIG.player.terrainType}/${index + 1}.ogg`
  )
  const defaultTerrainStepAudios = defaultTerrainStepFiles.map((file) => {
    const audio = new Audio(file)
    audio.preload = 'auto'
    audio.volume = AUDIO_CONFIG.player.terrainStepVolume
    return audio
  })

  const buildingTerrainStepFiles = Array.from(
    { length: AUDIO_CONFIG.player.buildingStepVariantCount },
    (_, index) => `assets/sounds/steps/building/${index + 1}.ogg`
  )
  const buildingTerrainStepAudios = buildingTerrainStepFiles.map((file) => {
    const audio = new Audio(file)
    audio.preload = 'auto'
    audio.volume = AUDIO_CONFIG.player.terrainStepVolume
    return audio
  })

  const cityTerrainStepFiles = Array.from(
    { length: AUDIO_CONFIG.player.cityStepVariantCount },
    (_, index) => `assets/sounds/steps/city/${index + 1}.ogg`
  )
  const cityTerrainStepAudios = cityTerrainStepFiles.map((file) => {
    const audio = new Audio(file)
    audio.preload = 'auto'
    audio.volume = AUDIO_CONFIG.player.terrainStepVolume
    return audio
  })

  const townTerrainStepFiles = Array.from(
    { length: AUDIO_CONFIG.player.townStepVariantCount },
    (_, index) => `assets/sounds/steps/town/${index + 1}.ogg`
  )
  const townTerrainStepAudios = townTerrainStepFiles.map((file) => {
    const audio = new Audio(file)
    audio.preload = 'auto'
    audio.volume = AUDIO_CONFIG.player.terrainStepVolume
    return audio
  })

  const allTerrainStepAudios = [
    ...defaultTerrainStepAudios,
    ...buildingTerrainStepAudios,
    ...cityTerrainStepAudios,
    ...townTerrainStepAudios
  ]

  const getTerrainStepAudios = (terrainLayer: FootstepTerrainLayer): HTMLAudioElement[] => {
    if (terrainLayer === 'building') {
      return buildingTerrainStepAudios
    }
    if (terrainLayer === 'city') {
      return cityTerrainStepAudios
    }
    if (terrainLayer === 'town') {
      return townTerrainStepAudios
    }
    return defaultTerrainStepAudios
  } // end function getTerrainStepAudios

  const ambienceAudio = new Audio(`assets/sounds/ambience/${AUDIO_CONFIG.player.terrainType}/${AUDIO_CONFIG.player.ambienceTrack}.ogg`)
  ambienceAudio.preload = 'auto'
  ambienceAudio.loop = true
  ambienceAudio.volume = AUDIO_CONFIG.player.ambienceVolume

  const cityAmbienceAudio = new Audio(`assets/sounds/ambience/city/${AUDIO_CONFIG.player.cityAmbienceTrack}`)
  cityAmbienceAudio.preload = 'auto'
  cityAmbienceAudio.loop = true
  cityAmbienceAudio.volume = 0

  const musicTrackPaths = {
    slowDrone: 'assets/music/slowDrone.ogg',
    scary: 'assets/music/scary.ogg',
    suspense: 'assets/music/suspense.ogg',
    dark: 'assets/music/dark.ogg',
    hunting: 'assets/music/hunting.ogg',
    alleyWay: 'assets/music/alleyWay.ogg',
    futuristicCity: 'assets/music/CfuturisticCity.ogg'
  } as const

  const musicTrackAliases = new Map<string, keyof typeof musicTrackPaths>([
    ['slowdrone', 'slowDrone'],
    ['scary', 'scary'],
    ['suspense', 'suspense'],
    ['dark', 'dark'],
    ['hunting', 'hunting'],
    ['alleyway', 'alleyWay'],
    ['alleyway.ogg', 'alleyWay'],
    ['futuristiccity', 'futuristicCity'],
    ['cfuturisticcity', 'futuristicCity']
  ])
  let currentMusicTrackName: keyof typeof musicTrackPaths = 'slowDrone'

  const musicAudio = new Audio(musicTrackPaths[currentMusicTrackName])
  musicAudio.preload = 'auto'
  musicAudio.loop = true
  musicAudio.volume = AUDIO_CONFIG.player.musicVolume

  const getMusicTracks = (): string[] => Object.keys(musicTrackPaths)

  const resolveMusicTrackName = (input: string): keyof typeof musicTrackPaths | null => {
    const trimmed = input.trim()
    if (trimmed.length === 0) {
      return null
    } // end if input is empty

    const directMatch = getMusicTracks().find((name) => name.toLowerCase() === trimmed.toLowerCase())
    if (directMatch) {
      return directMatch as keyof typeof musicTrackPaths
    } // end if track name matches exactly

    const normalized = trimmed.replace(/\.ogg$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase()
    return musicTrackAliases.get(normalized) ?? null
  } // end function resolveMusicTrackName

  const setMusicTrack = (trackName: string): string => {
    const resolvedTrackName = resolveMusicTrackName(trackName)
    if (!resolvedTrackName) {
      const available = getMusicTracks().join(', ')
      throw new Error(`Unknown music track: ${trackName}. Available tracks: ${available}`)
    } // end if track name is unknown

    if (resolvedTrackName === currentMusicTrackName) {
      return currentMusicTrackName
    } // end if track is unchanged

    const shouldResumePlayback = !musicAudio.paused
    musicAudio.pause()
    musicAudio.src = musicTrackPaths[resolvedTrackName]
    musicAudio.currentTime = 0
    currentMusicTrackName = resolvedTrackName
    applyHtmlAudioVolumes()

    if (shouldResumePlayback) {
      void musicAudio.play().catch(() => undefined)
    } // end if music should continue after track switch

    return currentMusicTrackName
  } // end function setMusicTrack

  const getMusicTrack = (): string => currentMusicTrackName

  const servoAudio = new Audio('assets/sounds/servomotor.ogg')
  servoAudio.preload = 'auto'
  servoAudio.loop = true
  servoAudio.volume = AUDIO_CONFIG.player.servoVolume

  const impactFallbackEmitter = createWorldEmitter(2.5, 220)
  const impactSynth = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.16, release: 0.25 },
    harmonicity: 5.1,
    modulationIndex: 14,
    resonance: 2800,
    octaves: 1.2
  }).connect(impactFallbackEmitter.input)

  const createImpactVoicePool = (material: SurfaceMaterial): MaterialImpactVoicePool => {
    const emitter = createWorldEmitter(2.5, 260)
    const gain = new Tone.Gain(0.001).connect(emitter.input)
    const candidates = MATERIAL_IMPACT_SOUND_PATHS[material]
    const voices: Tone.Player[] = Array.from({ length: IMPACT_VOICE_POOL_SIZE }, (_, voiceIndex) => {
      const clip = candidates[voiceIndex % Math.max(1, candidates.length)] ?? MATERIAL_IMPACT_SOUND_PATHS.unknown[0]!
      return new Tone.Player(clip).connect(gain)
    })
    return {
      material,
      emitter,
      gain,
      voices,
      cursor: 0
    }
  }

  const ensureImpactPool = (material: SurfaceMaterial): MaterialImpactVoicePool => {
    const existing = materialImpactPools.get(material)
    if (existing) {
      return existing
    }
    const created = createImpactVoicePool(material)
    materialImpactPools.set(material, created)
    return created
  }

  const createSuppressionRegionRuntime = (id: string, material: SurfaceMaterial, loopPath: string): SuppressionRegionRuntime => {
    const emitter = createWorldEmitter(1.5, 130)
    const gain = new Tone.Gain(0.001).connect(emitter.input)
    const filter = new Tone.Filter({ type: 'lowpass', frequency: 16000, Q: 0.7 }).connect(gain)
    const loopPlayer = new Tone.Player(loopPath).connect(filter)
    loopPlayer.loop = true
    return {
      id,
      material,
      emitter,
      gain,
      filter,
      loopPlayer,
      loopPath,
      loopLoaded: false,
      loopLoadingPromise: null,
      active: false,
      score: 0,
      impactsThisWindow: 0,
      centroidX: 0,
      centroidY: 0,
      centroidZ: 0,
      lastImpactTimeSeconds: Number.NEGATIVE_INFINITY,
      lastAccentTimeSeconds: Number.NEGATIVE_INFINITY,
      nextOcclusionImportance: 0.1
    }
  }

  const CARDINAL_HEADING_CUES: readonly CardinalHeadingCue[] = [
    { id: 'north', angle: -Math.PI / 2, path: 'assets/sounds/nav/north.ogg' },
    { id: 'east', angle: 0, path: 'assets/sounds/nav/east.ogg' },
    { id: 'south', angle: Math.PI / 2, path: 'assets/sounds/nav/south.ogg' },
    { id: 'west', angle: Math.PI, path: 'assets/sounds/nav/west.ogg' }
  ]

  const ENEMY_AUDIO_PREWARM_PATHS: readonly string[] = [
    'assets/sounds/tankMoving.ogg',
    'assets/sounds/helicopterLoop.ogg',
    'assets/sounds/servomotor.ogg',
    'assets/sounds/weapons/reload/reloadCannon.ogg',
    'assets/sounds/weapons/reload/reload.ogg',
    'assets/sounds/weapons/pistol_fire.ogg',
    'assets/sounds/weapons/sniper_fire.ogg',
    'assets/sounds/weapons/rocket_fire.OGG',
    'assets/sounds/weapons/swing_heavy1.ogg',
    'assets/sounds/weapons/swing_heavy2.ogg',
    'assets/sounds/weapons/swing_medium.ogg',
    'assets/sounds/weapons/swing_medium1.ogg',
    'assets/sounds/weapons/swing_medium2.ogg',
    'assets/sounds/weapons/arBurst3.ogg',
    'assets/sounds/weapons/arBurst4.ogg',
    'assets/sounds/weapons/arBurst5.ogg',
    'assets/sounds/weapons/missileFlyLoop1.ogg',
    'assets/sounds/energy.ogg',
    'assets/sounds/tankHit.ogg',
    'assets/sounds/explosions/explosion_1A.ogg',
    'assets/sounds/explosions/explosion_1B.ogg',
    'assets/sounds/explosions/explosion_2a.ogg'
  ]

  const cardinalHeadingGain = new Tone.Gain(0.95).toDestination()
  const cardinalHeadingPanner = new Tone.Panner3D({
    panningModel: 'HRTF',
    distanceModel: 'inverse',
    refDistance: 0.8,
    maxDistance: 12,
    rolloffFactor: 0.7
  }).connect(cardinalHeadingGain)
  const cardinalHeadingPlayerCache = new Map<string, Tone.Player>()

  const defaultPlayerFireSoundPath = 'assets/sounds/weapons/pistol_fire.ogg'
  const minigunSpinUpPath = 'assets/sounds/weapons/minigun_spinUp.ogg'
  const minigunLoopPath = 'assets/sounds/weapons/minigun_loop.ogg'
  const minigunSpinDownPath = 'assets/sounds/weapons/minigun_spinDown.ogg'
  const playerFireSound = new Tone.Player(defaultPlayerFireSoundPath).toDestination()
  const playerFireSoundCache = new Map<string, Tone.Player>([[defaultPlayerFireSoundPath, playerFireSound]])
  const playerFireSoundVoicePools = new Map<string, Tone.Player[]>()
  const playerFireSoundVoiceCursors = new Map<string, number>()
  const playerFireSoundPendingLoads = new Set<string>()
  const minigunLoopGain = new Tone.Gain(0.001).toDestination()
  const minigunSpinUpPlayer = new Tone.Player(minigunSpinUpPath).connect(minigunLoopGain)
  const minigunLoopPlayer = new Tone.Player(minigunLoopPath).connect(minigunLoopGain)
  const minigunSpinDownPlayer = new Tone.Player(minigunSpinDownPath).connect(minigunLoopGain)
  minigunLoopPlayer.loop = true
  let minigunLoaded = false
  let minigunLoadPromise: Promise<void> | null = null
  let minigunLoopMode: 'idle' | 'spooling' | 'sustain' = 'idle'
  let minigunStartLoopTimeoutId: number | null = null
  const reloadClipDurationMsCache = new Map<string, number>()
  const reloadServoLoopFallbackPath = 'assets/sounds/servomotor.ogg'
  const reloadServoPlayerCache = new Map<string, Tone.Player>()
  const reloadServoGain = new Tone.Gain(0.001).toDestination()
  const reloadServoPitch = new Tone.PitchShift(0).connect(reloadServoGain)
  const reloadServoDistortion = new Tone.Distortion({ distortion: 0.2, wet: 0 }).connect(reloadServoPitch)
  const reloadServoLowpass = new Tone.Filter({ type: 'lowpass', frequency: 18000, Q: 0.8 }).connect(reloadServoDistortion)
  const flightLoopGain = new Tone.Gain(0.78).toDestination()
  // Boost effect chain sits between rotor players and the main gain so effects
  // can be ramped without touching user-configurable volume levels.
  const flightBoostGain = new Tone.Gain(1).connect(flightLoopGain)
  // Lowpass filter: bypass at 20 kHz, ramps lower for heavier rotor/boost coloration.
  const flightBoostFilter = new Tone.Filter({ type: 'lowpass', frequency: 20000, Q: 2 }).connect(flightBoostGain)
  // Distortion: wet=0 (dry) at idle, ramps up during aggressive flight.
  const flightBoostDistortion = new Tone.Distortion({ distortion: 0.45, wet: 0 }).connect(flightBoostFilter)
  const rotorFlightLoopPlayers: Tone.Player[] = Array.from({ length: 4 }, () => {
    const player = new Tone.Player('assets/sounds/helicopterLoop.ogg').connect(flightBoostDistortion)
    player.loop = true
    return player
  })
  const jetFlightLoopPlayer = new Tone.Player('assets/sounds/jetLoop.ogg').connect(flightBoostDistortion)
  jetFlightLoopPlayer.loop = true
  let activeFlightLoopCount = 1
  let activeFlightType: 'jet' | 'rotor' = 'jet'
  let lastFlightSpinUpSeconds = 5
  let flightSpinDownTimeoutId: number | null = null
  applyFlightLoopVolume()

  const energyStatusGain = new Tone.Gain(0.17).toDestination()
  const energyStatusTremolo = new Tone.Tremolo({ frequency: 0.45, depth: 0, type: 'sine', spread: 0 }).connect(energyStatusGain)
  const energyStatusFilter = new Tone.Filter({ type: 'lowpass', frequency: 12000, Q: 0.7 }).connect(energyStatusTremolo)
  const energyStatusDistortion = new Tone.Distortion({ distortion: 0.12, wet: 0 }).connect(energyStatusFilter)
  const energyStatusLoop = new Tone.Player('assets/sounds/energy.ogg').connect(energyStatusDistortion)
  energyStatusLoop.loop = true

  const energyStatusCrackleFilter = new Tone.Filter({ type: 'highpass', frequency: 2200, Q: 0.9 }).connect(energyStatusGain)
  const energyStatusCrackleGain = new Tone.Gain(0.001).connect(energyStatusCrackleFilter)
  const energyStatusCrackleNoise = new Tone.Noise('pink').connect(energyStatusCrackleGain)

  const heatStatusSizzleGain = new Tone.Gain(0.001).toDestination()
  const heatStatusSizzleHighpass = new Tone.Filter({ type: 'highpass', frequency: 1600, Q: 0.8 }).connect(heatStatusSizzleGain)
  const heatStatusSizzleBandpass = new Tone.Filter({ type: 'bandpass', frequency: 2500, Q: 0.8 }).connect(heatStatusSizzleHighpass)
  const heatStatusSizzleDrive = new Tone.Distortion({ distortion: 0.08, wet: 0.05 }).connect(heatStatusSizzleBandpass)
  const heatStatusSizzleNoise = new Tone.Noise('white').connect(heatStatusSizzleDrive)

  const mobilityPlaceholderMasterGain = new Tone.Gain(0).toDestination()

  const wheelMobilityGain = new Tone.Gain(0).connect(mobilityPlaceholderMasterGain)

  const wheelMobilityIdleGain = new Tone.Gain(0).connect(wheelMobilityGain)
  const wheelMobilityIdleFilter = new Tone.Filter({ type: 'lowpass', frequency: 220, Q: 0.75 }).connect(wheelMobilityIdleGain)
  const wheelMobilityIdleOsc = new Tone.Oscillator({ frequency: 58, type: 'sawtooth' }).connect(wheelMobilityIdleFilter)

  const wheelMobilityPitchGain = new Tone.Gain(0).connect(wheelMobilityGain)
  const wheelMobilityPitchFilter = new Tone.Filter({ type: 'bandpass', frequency: 420, Q: 1.1 }).connect(wheelMobilityPitchGain)
  const wheelMobilityPitchOsc = new Tone.Oscillator({ frequency: 96, type: 'triangle' }).connect(wheelMobilityPitchFilter)

  const wheelMobilitySkidGain = new Tone.Gain(0).connect(wheelMobilityGain)
  const wheelMobilitySkidFilter = new Tone.Filter({ type: 'highpass', frequency: 1300, Q: 0.9 }).connect(wheelMobilitySkidGain)
  const wheelMobilitySkidNoise = new Tone.Noise('pink').connect(wheelMobilitySkidFilter)

  const treadMobilityGain = new Tone.Gain(0).connect(mobilityPlaceholderMasterGain)
  const treadMobilityNoiseFilter = new Tone.Filter({ type: 'bandpass', frequency: 150, Q: 1.1 }).connect(treadMobilityGain)
  const treadMobilityNoise = new Tone.Noise('brown').connect(treadMobilityNoiseFilter)
  const treadMobilityPulseGain = new Tone.Gain(0.11).connect(treadMobilityGain)
  const treadMobilityPulseOsc = new Tone.Oscillator({ frequency: 14, type: 'square' }).connect(treadMobilityPulseGain)

  const hoverMobilityGain = new Tone.Gain(0).connect(mobilityPlaceholderMasterGain)
  const hoverMobilityTremolo = new Tone.Tremolo({ frequency: 5, depth: 0.3, type: 'sine', spread: 0 }).connect(hoverMobilityGain)
  const hoverMobilityOsc = new Tone.Oscillator({ frequency: 140, type: 'triangle' }).connect(hoverMobilityTremolo)
  const hoverMobilityHissGain = new Tone.Gain(0.04).connect(hoverMobilityGain)
  const hoverMobilityHissFilter = new Tone.Filter({ type: 'highpass', frequency: 1050, Q: 0.85 }).connect(hoverMobilityHissGain)
  const hoverMobilityHissNoise = new Tone.Noise('white').connect(hoverMobilityHissFilter)

  const walkerMobilityGain = new Tone.Gain(0).connect(mobilityPlaceholderMasterGain)
  const walkerMobilityStepOsc = new Tone.Oscillator({ frequency: 3.5, type: 'square' }).connect(walkerMobilityGain)
  const walkerMobilityBodyGain = new Tone.Gain(0.04).connect(walkerMobilityGain)
  const walkerMobilityBodyFilter = new Tone.Filter({ type: 'bandpass', frequency: 520, Q: 0.95 }).connect(walkerMobilityBodyGain)
  const walkerMobilityBodyNoise = new Tone.Noise('brown').connect(walkerMobilityBodyFilter)

  const flightMobilityGain = new Tone.Gain(0).connect(mobilityPlaceholderMasterGain)
  const flightMobilityToneGain = new Tone.Gain(0.025).connect(flightMobilityGain)
  const flightMobilityToneOsc = new Tone.Oscillator({ frequency: 155, type: 'sawtooth' }).connect(flightMobilityToneGain)
  const flightMobilityNoiseGain = new Tone.Gain(0.045).connect(flightMobilityGain)
  const flightMobilityNoiseFilter = new Tone.Filter({ type: 'highpass', frequency: 1300, Q: 0.9 }).connect(flightMobilityNoiseGain)
  const flightMobilityNoise = new Tone.Noise('white').connect(flightMobilityNoiseFilter)

  let mobilityPlaceholderSourcesStarted = false

  const boostEngageGain = new Tone.Gain(0.9).toDestination()
  const boostEngageSound = new Tone.Player('assets/sounds/boostEngage.ogg').connect(boostEngageGain)
  const hardLandingGain = new Tone.Gain(0.92).toDestination()
  const hardLandingSound = new Tone.Player('assets/sounds/hardLanding.ogg').connect(hardLandingGain)

  const bulletNearMissEmitter = createWorldEmitter(0.8, 8)
  const bulletNearMissGain = new Tone.Gain(0.001).connect(bulletNearMissEmitter.input)
  const bulletNearMissVoices = [
    new Tone.Player('assets/sounds/bulletWiz.ogg').connect(bulletNearMissGain),
    new Tone.Player('assets/sounds/bulletWiz.ogg').connect(bulletNearMissGain),
    new Tone.Player('assets/sounds/bulletWiz.ogg').connect(bulletNearMissGain),
    new Tone.Player('assets/sounds/bulletWiz.ogg').connect(bulletNearMissGain)
  ]

  const projectileNearMissEmitter = createWorldEmitter(1.1, 10)
  const projectileNearMissGain = new Tone.Gain(0.001).connect(projectileNearMissEmitter.input)
  const projectileNearMissVoices = [
    new Tone.Player('assets/sounds/projectileWiz.ogg').connect(projectileNearMissGain),
    new Tone.Player('assets/sounds/projectileWiz.ogg').connect(projectileNearMissGain),
    new Tone.Player('assets/sounds/projectileWiz.ogg').connect(projectileNearMissGain),
    new Tone.Player('assets/sounds/projectileWiz.ogg').connect(projectileNearMissGain)
  ]

  const incomingProjectileVoices: IncomingProjectileVoice[] = Array.from({ length: 8 }, () => {
    const emitter = createWorldEmitter(0.9, 36)
    const gain = new Tone.Gain(0.001).connect(emitter.input)
    const projectilePlayer = new Tone.Player('assets/sounds/projectileWiz.ogg').connect(gain)
    projectilePlayer.loop = true
    const missilePlayer = new Tone.Player('assets/sounds/weapons/missileFlyLoop1.ogg').connect(gain)
    missilePlayer.loop = true
    return {
      id: null,
      projectilePlayer,
      missilePlayer,
      gain,
      emitter
    }
  })

  const waitForMs = (durationMs: number): Promise<void> => {
    return new Promise((resolve) => {
      window.setTimeout(resolve, Math.max(0, durationMs))
    })
  } // end function waitForMs

  const resetReloadServoEffectNodes = (): void => {
    reloadServoPitch.pitch = 0
    reloadServoDistortion.wet.value = 0
    reloadServoDistortion.distortion = 0.2
    reloadServoGain.gain.value = 0.001
    reloadServoLowpass.frequency.value = 18000
  } // end function resetReloadServoEffectNodes

  const getOrCreateWeaponSoundPlayer = async (soundPath: string): Promise<Tone.Player | null> => {
    const cachedPlayer = playerFireSoundCache.get(soundPath)
    if (cachedPlayer) {
      if (!cachedPlayer.loaded) {
        try {
          await cachedPlayer.load(soundPath)
        } catch {
          return null
        }
      } // end if cached player needs loading

      return cachedPlayer
    } // end if sound player already exists

    const dynamicPlayer = new Tone.Player(soundPath).toDestination()
    playerFireSoundCache.set(soundPath, dynamicPlayer)
    try {
      await dynamicPlayer.load(soundPath)
      return dynamicPlayer
    } catch {
      playerFireSoundCache.delete(soundPath)
      dynamicPlayer.dispose()
      return null
    }
  } // end function getOrCreateWeaponSoundPlayer

  const getReloadClipDurationMs = async (soundPath: string): Promise<number> => {
    const cachedDuration = reloadClipDurationMsCache.get(soundPath)
    if (cachedDuration !== undefined) {
      return cachedDuration
    } // end if duration is cached

    const player = await getOrCreateWeaponSoundPlayer(soundPath)
    if (!player?.buffer.loaded) {
      return 0
    } // end if player buffer could not be loaded

    const durationMs = Math.max(0, player.buffer.duration * 1000)
    reloadClipDurationMsCache.set(soundPath, durationMs)
    return durationMs
  } // end function getReloadClipDurationMs

  const getOrCreateReloadServoPlayer = async (soundPath: string): Promise<Tone.Player | null> => {
    const cachedPlayer = reloadServoPlayerCache.get(soundPath)
    if (cachedPlayer) {
      if (!cachedPlayer.loaded) {
        try {
          await cachedPlayer.load(soundPath)
        } catch {
          return null
        }
      } // end if cached servo player needs loading
      return cachedPlayer
    } // end if servo player already cached

    const player = new Tone.Player(soundPath).connect(reloadServoLowpass)
    player.loop = true
    reloadServoPlayerCache.set(soundPath, player)
    try {
      await player.load(soundPath)
      return player
    } catch {
      reloadServoPlayerCache.delete(soundPath)
      player.dispose()
      return null
    }
  } // end function getOrCreateReloadServoPlayer

  const playerMechHitGain = new Tone.Gain(0.9).toDestination()
  const playerMechHitBaseFilter = new Tone.Filter(1200, 'bandpass').connect(playerMechHitGain)
  const playerMechHitBasePitch = new Tone.PitchShift(0).connect(playerMechHitBaseFilter)
  const playerMechHitBaseVoices = [
    new Tone.Player('assets/sounds/mechHit.ogg').connect(playerMechHitBasePitch),
    new Tone.Player('assets/sounds/mechHit.ogg').connect(playerMechHitBasePitch),
    new Tone.Player('assets/sounds/mechHit.ogg').connect(playerMechHitBasePitch),
    new Tone.Player('assets/sounds/mechHit.ogg').connect(playerMechHitBasePitch)
  ]
  const playerMechHitBaseRates = [0.88, 0.95, 1, 1.06]
  for (let voiceIndex = 0; voiceIndex < playerMechHitBaseVoices.length; voiceIndex += 1) {
    const voice = playerMechHitBaseVoices[voiceIndex]
    const rate = playerMechHitBaseRates[voiceIndex]
    if (!voice || rate === undefined) {
      continue
    } // end if missing voice/rate
    voice.playbackRate = rate
  } // end for each base mech-hit voice

  const playerMechHitDetailFilter = new Tone.Filter(1800, 'highpass').connect(playerMechHitGain)
  const playerMechHitDetailDrive = new Tone.Distortion(0.1).connect(playerMechHitDetailFilter)
  const playerMechHitDetailPitch = new Tone.PitchShift(0).connect(playerMechHitDetailDrive)
  const playerMechHitDetailVoices = [
    new Tone.Player('assets/sounds/damageSmall1.ogg').connect(playerMechHitDetailPitch),
    new Tone.Player('assets/sounds/damageSmall1.ogg').connect(playerMechHitDetailPitch),
    new Tone.Player('assets/sounds/damageSmall1.ogg').connect(playerMechHitDetailPitch),
    new Tone.Player('assets/sounds/damageSmall2.ogg').connect(playerMechHitDetailPitch),
    new Tone.Player('assets/sounds/damageSmall2.ogg').connect(playerMechHitDetailPitch),
    new Tone.Player('assets/sounds/damageSmall2.ogg').connect(playerMechHitDetailPitch)
  ]
  const playerMechHitDetailRateOffsets = [0.9, 0.97, 1.04, 0.92, 1, 1.07]
  for (let voiceIndex = 0; voiceIndex < playerMechHitDetailVoices.length; voiceIndex += 1) {
    const voice = playerMechHitDetailVoices[voiceIndex]
    const rate = playerMechHitDetailRateOffsets[voiceIndex]
    if (!voice || rate === undefined) {
      continue
    } // end if missing voice/rate
    voice.playbackRate = rate
  } // end for each detail mech-hit voice

  const pitchCenterConfirmSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 }
  }).toDestination()

  const pauseOpenChirpSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 }
  }).toDestination()

  const pauseCloseChirpSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 }
  }).toDestination()

  // Lock-on: clean ascending sine tones (root → 5th → octave)
  const lockOnChirpSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.04 }
  }).toDestination()

  // Lock-lost: descending triangle tones – inverse of lock-on
  const lockLostChirpSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.04 }
  }).toDestination()

  const missileLockToneSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 }
  }).toDestination()

  const missileLockConfirmSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
  }).toDestination()

  const missileWarningPanner = new Tone.Panner(0).toDestination()
  const missileWarningGain = new Tone.Gain(0.001).connect(missileWarningPanner)
  const missileWarningDetectionSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.03 }
  }).connect(missileWarningGain)
  const missileWarningTerminalSynth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.025 }
  }).connect(missileWarningGain)

  const missileFlybyPanner = new Tone.Panner(0).toDestination()
  const missileFlybySynth = new Tone.Synth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.03 }
  }).connect(missileFlybyPanner)

  const targetLockPresencePanner = new Tone.Panner(0).toDestination()
  const targetLockPresenceGain = new Tone.Gain(0).connect(targetLockPresencePanner)
  const targetLockPresenceOsc = new Tone.Oscillator({ frequency: 312, type: 'triangle' }).connect(targetLockPresenceGain)
  let targetLockPresenceOscStarted = false
  const targetLockTransitionChirpSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.07, sustain: 0, release: 0.035 }
  }).toDestination()

  const bullseyeGuidancePanner = new Tone.Panner(0).toDestination()
  const bullseyeGuidanceSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.055, sustain: 0, release: 0.025 }
  }).connect(bullseyeGuidancePanner)

  // 3D panner for lock milestone tones anchored to the target position when available.
  const targetLockProgressPanner = new Tone.Panner3D({ panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 1, maxDistance: 96, rolloffFactor: 1.8 }).toDestination()

  const targetLockStageSuccessSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 }
  }).connect(targetLockProgressPanner)

  const targetLockFullSuccessSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.06 }
  }).connect(targetLockProgressPanner)

  const negativeActionSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 }
  }).toDestination()

  const healthStatusSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.08 }
  }).toDestination()
  const lowHealthAlarmSynth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.05 }
  }).toDestination()

  const sonarSweepSynth = new Tone.FMSynth({
    harmonicity: 0.5,
    modulationIndex: 10,
    envelope: { attack: 0.01, decay: 0.18, sustain: 0, release: 0.1 }
  }).toDestination()

  // Mid-range radar detection: directional tone with stable loudness and stereo pan.
  const radarDetectionPanner = new Tone.Panner(0).toDestination()
  const radarDetectionGain = new Tone.Gain(0).connect(radarDetectionPanner)
  const radarDetectionBoost = new Tone.Gain(1.2).connect(radarDetectionGain)
  const radarDetectionFilter = new Tone.Filter({ frequency: 2400, type: 'lowpass', rolloff: -24 }).connect(radarDetectionBoost)
  const radarDetectionDistortion = new Tone.Distortion(0.55).connect(radarDetectionFilter)
  const radarDetectionTremolo = new Tone.Tremolo({ frequency: 1, depth: 1.0, type: 'sine', spread: 0 }).connect(radarDetectionDistortion)
  const radarDetectionOsc = new Tone.Oscillator({ frequency: 180, type: 'triangle' }).connect(radarDetectionTremolo)

  const destinationTonePanner = new Tone.Panner(0).toDestination()
  const destinationToneGain = new Tone.Gain(0).connect(destinationTonePanner)
  const destinationToneOsc = new Tone.Oscillator({ frequency: AUDIO_NAVIGATION_CONFIG.destinationToneFarFrequency, type: 'sine' }).connect(destinationToneGain)

  const activePingSynth = new Tone.FMSynth({
    harmonicity: 1.2,
    modulationIndex: 6,
    envelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.08 }
  }).toDestination()

  const passiveRadarSweepSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.22, sustain: 0, release: 0.05 }
  }).toDestination()

  const aimAssistPanner = new Tone.Panner(0).toDestination()
  const aimAssistGain = new Tone.Gain(0.22).connect(aimAssistPanner)
  const aimAssistFilter = new Tone.Filter(900, 'lowpass').connect(aimAssistGain)
  const aimAssistTrackingSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.002, decay: 0.11, sustain: 0, release: 0.05 }
  }).connect(aimAssistFilter)

  const environmentalSonarScanSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.08 }
  }).toDestination()

  const sonarEchoVoices = Array.from({ length: 12 }, () => {
    const panner = new Tone.Panner(0).toDestination()
    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.05 }
    }).connect(panner)
    return { synth, panner }
  })

  const enemyPingVoices = Array.from({ length: 6 }, () => {
    const panner = new Tone.Panner(0).toDestination()
    const synth = new Tone.FMSynth({
      harmonicity: 1.4,
      modulationIndex: 7,
      envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.05 }
    }).connect(panner)
    return { synth, panner }
  })

  const obstructionPanner = new Tone.Panner(0).toDestination()
  const obstructionBlockedSynth = new Tone.Synth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0.02, release: 0.06 }
  }).connect(obstructionPanner)
  const obstructionClearSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 }
  }).toDestination()

  const boundaryWarningGain = new Tone.Gain(0.16).toDestination()
  const boundaryWarningSynth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.06 }
  }).connect(boundaryWarningGain)
  const boundaryUrgencySynth = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.08, release: 0.08 },
    harmonicity: 4,
    modulationIndex: 10,
    resonance: 2500,
    octaves: 1
  }).connect(boundaryWarningGain)

  const tankHitConfirmPanner = new Tone.Panner(0).toDestination()
  const tankHitConfirmGain = new Tone.Gain(0.95).connect(tankHitConfirmPanner)
  const tankHitConfirmSound = new Tone.Player('assets/sounds/explosions/explosion_1B.ogg').connect(tankHitConfirmGain)

  const tankDeathConfirmPanner = new Tone.Panner(0).toDestination()
  const tankDeathConfirmGain = new Tone.Gain(1).connect(tankDeathConfirmPanner)
  const tankDeathConfirmSound = new Tone.Player('assets/sounds/explosions/explosion_2a.ogg').connect(tankDeathConfirmGain)
  const explosionPlayerCache = new Map<string, Tone.Player>()

  const isAudioContextRunning = (): boolean => Tone.getContext().state === 'running'

  const computePanForWorldPosition = (
    worldX: number,
    worldY: number,
    playerX: number,
    playerY: number,
    playerAngle: number
  ): number => {
    const bearing = Math.atan2(worldY - playerY, worldX - playerX)
    const delta = normalizeAngle(bearing - playerAngle)
    return clamp(delta / (Math.PI * 0.5), -1, 1)
  } // end function computePanForWorldPosition

  const retriggerLoadedPlayer = (player: Tone.Player): void => {
    if (!player.loaded) {
      return
    } // end if player buffer not loaded

    if (player.state === 'started') {
      player.stop()
    } // end if player already started
    player.start()
  } // end function retriggerLoadedPlayer

  const getOrCreateCardinalHeadingPlayer = (path: string): Tone.Player => {
    const existing = cardinalHeadingPlayerCache.get(path)
    if (existing) {
      return existing
    } // end if cardinal heading player already cached

    const player = new Tone.Player(path).connect(cardinalHeadingPanner)
    cardinalHeadingPlayerCache.set(path, player)
    return player
  } // end function getOrCreateCardinalHeadingPlayer

  const playCardinalHeadingCue = (playerAngle: number): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning() || !categoryNavigation) {
      return
    } // end if cardinal heading cue cannot play

    const now = Tone.now()
    const cardinalHeadingCueDebounceSeconds = 0.16
    if (now - lastCardinalHeadingCueTimeSeconds < cardinalHeadingCueDebounceSeconds) {
      return
    } // end if heading cue debounce has not elapsed
    lastCardinalHeadingCueTimeSeconds = now

    let bestCue = CARDINAL_HEADING_CUES[0]
    let bestDelta = Number.POSITIVE_INFINITY
    for (const cue of CARDINAL_HEADING_CUES) {
      const delta = Math.abs(normalizeAngle(cue.angle - playerAngle))
      if (delta < bestDelta) {
        bestDelta = delta
        bestCue = cue
      } // end if this cue is closer to current facing
    } // end for each heading cue

    if (!bestCue) {
      return
    } // end if no heading cue selected

    const turnDelta = normalizeAngle(bestCue.angle - playerAngle)
    const distance = 2.4
    const right = Math.sin(turnDelta) * distance
    const forward = Math.cos(turnDelta) * distance
    cardinalHeadingPanner.positionX.value = right
    cardinalHeadingPanner.positionY.value = 0
    cardinalHeadingPanner.positionZ.value = -forward
    cardinalHeadingGain.gain.value = clamp(0.9 * navigationVolume, 0, 1.2)

    const player = getOrCreateCardinalHeadingPlayer(bestCue.path)
    if (player.loaded) {
      retriggerLoadedPlayer(player)
      return
    } // end if heading player already loaded

    void player.load(bestCue.path)
      .then(() => {
        retriggerLoadedPlayer(player)
      })
      .catch((error) => {
        audioDebugWarn('Failed to load cardinal heading cue.', { path: bestCue.path, error })
      })
  } // end function playCardinalHeadingCue

  const setPlaybackRateSafely = (player: Tone.Player, playbackRate: number): void => {
    try {
      player.playbackRate = Math.max(0.5, Math.min(2, playbackRate * debugPitchScale))
    } catch {
      // Ignore timeline ordering collisions from rapid rate updates.
    } // end try/catch playbackRate set
  } // end function setPlaybackRateSafely

  const clearFlightSpinDownTimeout = (): void => {
    if (flightSpinDownTimeoutId !== null) {
      window.clearTimeout(flightSpinDownTimeoutId)
      flightSpinDownTimeoutId = null
    } // end if spin-down timeout exists
  } // end function clearFlightSpinDownTimeout

  const isAnyFlightLoopPlaying = (): boolean => {
    if (jetFlightLoopPlayer.state === 'started') {
      return true
    }
    return rotorFlightLoopPlayers.some((player) => player.state === 'started')
  } // end function isAnyFlightLoopPlaying

  const stopAllFlightLoopPlayers = (): void => {
    if (jetFlightLoopPlayer.state === 'started') {
      jetFlightLoopPlayer.stop()
    }
    for (const player of rotorFlightLoopPlayers) {
      if (player.state === 'started') {
        player.stop()
      }
    } // end for each rotor player
  } // end function stopAllFlightLoopPlayers

  const setActiveFlightLoopCount = (requestedCount: number, ensureStarted: boolean): void => {
    const nextCount = Math.max(1, Math.min(rotorFlightLoopPlayers.length, Math.round(requestedCount)))
    activeFlightLoopCount = nextCount

    if (activeFlightType === 'jet') {
      if (jetFlightLoopPlayer.loaded && ensureStarted && jetFlightLoopPlayer.state !== 'started') {
        jetFlightLoopPlayer.start()
      }
      for (const player of rotorFlightLoopPlayers) {
        if (player.state === 'started') {
          player.stop()
        }
      }
      return
    }

    if (jetFlightLoopPlayer.state === 'started') {
      jetFlightLoopPlayer.stop()
    }

    for (let index = 0; index < rotorFlightLoopPlayers.length; index += 1) {
      const player = rotorFlightLoopPlayers[index]
      if (!player) {
        continue
      }
      const shouldBeActive = index < nextCount
      if (!shouldBeActive && player.state === 'started') {
        player.stop()
      }
      if (shouldBeActive && ensureStarted && player.loaded && player.state !== 'started') {
        player.start()
      }
    } // end for each rotor player
  } // end function setActiveFlightLoopCount

  const startActiveFlightLoopPlayers = (): void => {
    if (activeFlightType === 'jet') {
      if (jetFlightLoopPlayer.loaded && jetFlightLoopPlayer.state !== 'started') {
        jetFlightLoopPlayer.start()
      }
      return
    }

    for (let index = 0; index < activeFlightLoopCount; index += 1) {
      const player = rotorFlightLoopPlayers[index]
      if (!player || !player.loaded || player.state === 'started') {
        continue
      }
      player.start()
    } // end for each active rotor player
  } // end function startActiveFlightLoopPlayers

  const setActiveFlightPlaybackRate = (playbackRate: number): void => {
    if (activeFlightType === 'jet') {
      setPlaybackRateSafely(jetFlightLoopPlayer, playbackRate)
      return
    }

    for (let index = 0; index < activeFlightLoopCount; index += 1) {
      const player = rotorFlightLoopPlayers[index]
      if (!player) {
        continue
      }
      setPlaybackRateSafely(player, playbackRate)
    } // end for each active rotor player
  } // end function setActiveFlightPlaybackRate

  const ensureEnergyStatusLoopStarted = (): void => {
    if (energyStatusLoopStarted || !audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if loop is already running or audio graph not ready

    if (energyStatusLoop.loaded) {
      energyStatusLoop.start()
      energyStatusLoopStarted = true
      return
    } // end if loop player is already loaded

    void energyStatusLoop.load('assets/sounds/energy.ogg')
      .then(() => {
        if (energyStatusLoopStarted || !audioStarted || audioPaused || !isAudioContextRunning()) {
          return
        } // end if energy loop should not start after async load
        energyStatusLoop.start()
        energyStatusLoopStarted = true
      })
      .catch((error) => {
        audioDebugWarn('Failed to load player energy status loop.', { error })
      })
  } // end function ensureEnergyStatusLoopStarted

  const ensureHeatStatusSizzleStarted = (): void => {
    if (heatStatusSizzleStarted || !audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if heat sizzle is already running or audio graph not ready

    heatStatusSizzleNoise.start()
    heatStatusSizzleStarted = true
  } // end function ensureHeatStatusSizzleStarted

  const ensureMobilityPlaceholderSourcesStarted = (): void => {
    if (mobilityPlaceholderSourcesStarted || !audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if mobility placeholder sources cannot start

    wheelMobilityIdleOsc.start()
    wheelMobilityPitchOsc.start()
    wheelMobilitySkidNoise.start()
    treadMobilityNoise.start()
    treadMobilityPulseOsc.start()
    hoverMobilityOsc.start()
    hoverMobilityHissNoise.start()
    walkerMobilityStepOsc.start()
    walkerMobilityBodyNoise.start()
    flightMobilityToneOsc.start()
    flightMobilityNoise.start()
    mobilityPlaceholderSourcesStarted = true
  } // end function ensureMobilityPlaceholderSourcesStarted

  const playFromVoicePool = (voices: Tone.Player[], cursor: number): number => {
    if (voices.length === 0) {
      return cursor
    } // end if no voices in pool

    for (let offset = 0; offset < voices.length; offset += 1) {
      const index = (cursor + offset) % voices.length
      const voice = voices[index]
      if (!voice || !voice.loaded || voice.state === 'started') {
        continue
      } // end if voice not playable

      voice.start()
      return (index + 1) % voices.length
    } // end for each pooled voice

    return cursor
  } // end function playFromVoicePool

  const releaseIncomingProjectileVoice = (voice: IncomingProjectileVoice): void => {
    voice.id = null
    if (voice.projectilePlayer.state === 'started') {
      voice.projectilePlayer.stop()
    } // end if projectile loop is currently playing
    if (voice.missilePlayer.state === 'started') {
      voice.missilePlayer.stop()
    } // end if missile loop is currently playing
    voice.gain.gain.value = 0.001
  } // end function releaseIncomingProjectileVoice

  const acquireIncomingProjectileVoice = (projectileId: number): IncomingProjectileVoice | null => {
    const existingVoice = incomingProjectileVoices.find((voice) => voice.id === projectileId)
    if (existingVoice) {
      return existingVoice
    } // end if voice already assigned

    const freeVoice = incomingProjectileVoices.find((voice) => voice.id === null)
    if (!freeVoice) {
      return null
    } // end if no free voice available

    freeVoice.id = projectileId
    return freeVoice
  } // end function acquireIncomingProjectileVoice

  const setIncomingProjectileVoiceLoop = (voice: IncomingProjectileVoice, isMissile: boolean): void => {
    const activePlayer = isMissile ? voice.missilePlayer : voice.projectilePlayer
    const inactivePlayer = isMissile ? voice.projectilePlayer : voice.missilePlayer
    if (inactivePlayer.state === 'started') {
      inactivePlayer.stop()
    } // end if inactive loop is still playing
    if (activePlayer.loaded && activePlayer.state !== 'started') {
      activePlayer.start()
    } // end if active loop is ready to start
  } // end function setIncomingProjectileVoiceLoop

  const ensureAudio = async (): Promise<void> => {
    try {
      if (Tone.getContext().state !== 'running') {
        await Tone.start()
      } // end if context not running

      if (!audioStarted) {
        await Tone.loaded()
        footstepAudio.muted = true
        servoAudio.muted = true
        ambienceAudio.muted = true
        musicAudio.muted = true
        cityAmbienceAudio.muted = true
        allTerrainStepAudios.forEach((audio) => {
          audio.muted = true
        })
        await footstepAudio.play().catch(() => undefined)
        footstepAudio.pause()
        footstepAudio.currentTime = 0
        await servoAudio.play().catch(() => undefined)
        servoAudio.pause()
        servoAudio.currentTime = 0
        await ambienceAudio.play().catch(() => undefined)
        ambienceAudio.pause()
        ambienceAudio.currentTime = 0
        await musicAudio.play().catch(() => undefined)
        musicAudio.pause()
        musicAudio.currentTime = 0
        await cityAmbienceAudio.play().catch(() => undefined)
        cityAmbienceAudio.pause()
        cityAmbienceAudio.currentTime = 0
        const firstTerrainStep = defaultTerrainStepAudios[0]
        if (firstTerrainStep) {
          await firstTerrainStep.play().catch(() => undefined)
          firstTerrainStep.pause()
          firstTerrainStep.currentTime = 0
        }
        const firstBuildingTerrainStep = buildingTerrainStepAudios[0]
        if (firstBuildingTerrainStep) {
          await firstBuildingTerrainStep.play().catch(() => undefined)
          firstBuildingTerrainStep.pause()
          firstBuildingTerrainStep.currentTime = 0
        }
        const firstCityTerrainStep = cityTerrainStepAudios[0]
        if (firstCityTerrainStep) {
          await firstCityTerrainStep.play().catch(() => undefined)
          firstCityTerrainStep.pause()
          firstCityTerrainStep.currentTime = 0
        }
        const firstTownTerrainStep = townTerrainStepAudios[0]
        if (firstTownTerrainStep) {
          await firstTownTerrainStep.play().catch(() => undefined)
          firstTownTerrainStep.pause()
          firstTownTerrainStep.currentTime = 0
        }
        initializeAudioCueUtilities()
        if (!hoverMobilityTremoloStarted) {
          hoverMobilityTremolo.start()
          hoverMobilityTremoloStarted = true
        } // end if hover mobility tremolo not started
        if (!radarDetectionTremoloStarted) {
          radarDetectionTremolo.start()
          radarDetectionTremoloStarted = true
        } // end if radar detection tremolo not started
        if (!radarDetectionOscStarted) {
          radarDetectionOsc.start()
          radarDetectionOscStarted = true
        } // end if radar detection oscillator not started
        if (!destinationToneOscStarted) {
          destinationToneOsc.start()
          destinationToneOscStarted = true
        } // end if destination oscillator not started
        if (!targetLockPresenceOscStarted) {
          targetLockPresenceOsc.start()
          targetLockPresenceOscStarted = true
        } // end if lock presence oscillator not started
        if (!energyStatusCrackleStarted) {
          energyStatusCrackleNoise.start()
          energyStatusCrackleStarted = true
        } // end if energy crackle noise source not started
        footstepAudio.muted = false
        servoAudio.muted = false
        ambienceAudio.muted = false
        musicAudio.muted = false
        cityAmbienceAudio.muted = false
        allTerrainStepAudios.forEach((audio) => {
          audio.muted = false
        })
        applyHtmlAudioVolumes()
        void ambienceAudio.play().catch(() => undefined)
        void musicAudio.play().catch(() => undefined)
        void cityAmbienceAudio.play().catch(() => undefined)
        audioStarted = true
        energyStatusTremolo.start()
        ensureEnergyStatusLoopStarted()
        prewarmEnemyAudioAssets()
      } // end if audio graph not initialized
    } catch {
      // Browser may reject resume when not triggered by a user gesture.
    } // end try/catch ensureAudio
  } // end function ensureAudio

  const playPauseOpenChirp = (): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not started
    const start = strictlyIncreasingStartTime(Tone.now(), pauseOpenChirpLastStartSeconds)
    pauseOpenChirpLastStartSeconds = start
    pauseOpenChirpSynth.triggerAttackRelease('A5', '64n', start)
  } // end function playPauseOpenChirp

  const playPauseCloseChirp = (): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not started
    const start = strictlyIncreasingStartTime(Tone.now(), pauseCloseChirpLastStartSeconds)
    pauseCloseChirpLastStartSeconds = start
    pauseCloseChirpSynth.triggerAttackRelease('E6', '64n', start)
  } // end function playPauseCloseChirp

  let pauseOpenChirpLastStartSeconds = -Infinity
  let pauseCloseChirpLastStartSeconds = -Infinity
  let lockOnChirpLastStartSeconds = -Infinity
  let lockLostChirpLastStartSeconds = -Infinity
  let missileLockToneLastStartSeconds = -Infinity
  let missileLockConfirmLastStartSeconds = -Infinity
  let missileWarningLastPulseSeconds = -Infinity
  let missileWarningLastScheduledSeconds = -Infinity
  let missileWarningActiveType: MissileWarningType | null = null
  let missileWarningLastDirection = 0
  let missileWarningLastIntensity = 0
  let missileFlybyLastStartSeconds = -Infinity
  let targetLockStageLastStartSeconds = -Infinity
  let bullseyeGuidanceLastStartSeconds = -Infinity
  let targetLockTransitionChirpLastStartSeconds = -Infinity
  let bullseyePulseTimerSeconds = 0
  let smoothedCenterError = 1
  let smoothedHorizontalOffset = 0
  let targetLockHasAcquiredTarget = false
  let targetLockPresenceActive = false
  let targetLockGuidanceActive = false
  let targetLockMilestonesReached = { at25: false, at50: false, at75: false, at100: false }
  let targetLockAudioState: 'NoTarget' | 'TargetInLockBox' | 'Refining' | 'Locked' = 'NoTarget'
  let aimAssistTrackingLastStartSeconds = -Infinity
  let negativeActionLastStartSeconds = -Infinity
  let lastCardinalHeadingCueTimeSeconds = -Infinity
  let lowHealthAlarmTimerSeconds = 0

  const strictlyIncreasingStartTime = (requestedSeconds: number, previousSeconds: number): number => {
    return Math.max(requestedSeconds, previousSeconds + 0.001)
  } // end function strictlyIncreasingStartTime

  const scheduleMissileWarningNote = (
    synth: Tone.Synth,
    note: string,
    duration: string,
    requestedStartSeconds: number
  ): void => {
    const start = strictlyIncreasingStartTime(requestedStartSeconds, missileWarningLastScheduledSeconds)
    missileWarningLastScheduledSeconds = start
    synth.triggerAttackRelease(note, duration, start)
  } // end function scheduleMissileWarningNote

  const playLockOnChirp = (): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not ready
    const firstStart = strictlyIncreasingStartTime(Tone.now(), lockOnChirpLastStartSeconds)
    const secondStart = strictlyIncreasingStartTime(firstStart + 0.06, firstStart)
    const thirdStart = strictlyIncreasingStartTime(firstStart + 0.12, secondStart)
    lockOnChirpLastStartSeconds = thirdStart
    lockOnChirpSynth.volume.value = Tone.gainToDb(0.5)
    lockOnChirpSynth.triggerAttackRelease('C5', '32n', firstStart)
    lockOnChirpSynth.triggerAttackRelease('G5', '32n', secondStart)
    lockOnChirpSynth.triggerAttackRelease('C6', '16n', thirdStart)
  } // end function playLockOnChirp

  const playLockLostChirp = (): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not ready
    const firstStart = strictlyIncreasingStartTime(Tone.now(), lockLostChirpLastStartSeconds)
    const secondStart = strictlyIncreasingStartTime(firstStart + 0.06, firstStart)
    const thirdStart = strictlyIncreasingStartTime(firstStart + 0.13, secondStart)
    lockLostChirpLastStartSeconds = thirdStart
    lockLostChirpSynth.volume.value = Tone.gainToDb(0.45)
    lockLostChirpSynth.triggerAttackRelease('C6', '64n', firstStart)
    lockLostChirpSynth.triggerAttackRelease('G4', '64n', secondStart)
    lockLostChirpSynth.triggerAttackRelease('C4', '64n', thirdStart)
  } // end function playLockLostChirp

  const playMissileLockTone = (): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not ready
    const firstStart = strictlyIncreasingStartTime(Tone.now(), missileLockToneLastStartSeconds)
    const secondStart = strictlyIncreasingStartTime(firstStart + 0.12, firstStart)
    missileLockToneLastStartSeconds = secondStart
    missileLockToneSynth.volume.value = Tone.gainToDb(0.2)
    missileLockToneSynth.triggerAttackRelease('B5', '32n', firstStart)
    missileLockToneSynth.triggerAttackRelease('D6', '32n', secondStart)
  } // end function playMissileLockTone

  const playMissileLockConfirmTone = (): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not ready
    const firstStart = strictlyIncreasingStartTime(Tone.now(), missileLockConfirmLastStartSeconds)
    const secondStart = strictlyIncreasingStartTime(firstStart + 0.07, firstStart)
    const thirdStart = strictlyIncreasingStartTime(firstStart + 0.14, secondStart)
    missileLockConfirmLastStartSeconds = thirdStart
    missileLockConfirmSynth.volume.value = Tone.gainToDb(0.58)
    missileLockConfirmSynth.triggerAttackRelease('E5', '32n', firstStart)
    missileLockConfirmSynth.triggerAttackRelease('A5', '32n', secondStart)
    missileLockConfirmSynth.triggerAttackRelease('E6', '16n', thirdStart)
  } // end function playMissileLockConfirmTone

  // Helper to set 3D panner position for lock milestone tones.
  function setTargetLockProgressPanner(x: number, y: number, z: number) {
    targetLockProgressPanner.positionX.value = x
    targetLockProgressPanner.positionY.value = y
    targetLockProgressPanner.positionZ.value = z
  }

  const setTargetLockPresenceToneActive = (active: boolean): void => {
    if (targetLockPresenceActive === active) {
      return
    }
    targetLockPresenceActive = active
    targetLockPresenceGain.gain.rampTo(active ? 0.15 : 0, active ? 0.01 : 0.02)
  }

  const updateTargetLockPresencePitch = (centerError: number): void => {
    const clampedCenterError = clamp(centerError, 0, 1)
    const minPresenceFrequency = 240
    const maxPresenceFrequency = 760
    const targetFrequency = minPresenceFrequency + ((1 - clampedCenterError) * (maxPresenceFrequency - minPresenceFrequency))
    targetLockPresenceOsc.frequency.rampTo(targetFrequency, 0.05)
  }

  const updateTargetLockPresencePan = (horizontalOffset: number): void => {
    const clampedHorizontalOffset = clamp(horizontalOffset, -1, 1)
    targetLockPresencePanner.pan.rampTo(clampedHorizontalOffset, 0.04)
  }

  const playTargetLockTransitionChirp = (enteringLockBox: boolean): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    }
    const firstStart = strictlyIncreasingStartTime(Tone.now(), targetLockTransitionChirpLastStartSeconds)
    const secondStart = strictlyIncreasingStartTime(firstStart + 0.075, firstStart)
    targetLockTransitionChirpLastStartSeconds = secondStart
    targetLockTransitionChirpSynth.volume.value = Tone.gainToDb(0.4)
    if (enteringLockBox) {
      targetLockTransitionChirpSynth.triggerAttackRelease('A4', '32n', firstStart)
      targetLockTransitionChirpSynth.triggerAttackRelease('E5', '32n', secondStart)
      return
    }
    targetLockTransitionChirpSynth.triggerAttackRelease('E5', '32n', firstStart)
    targetLockTransitionChirpSynth.triggerAttackRelease('A4', '32n', secondStart)
  }

  const setBullseyeGuidanceActive = (active: boolean): void => {
    if (targetLockGuidanceActive === active) {
      return
    }
    targetLockGuidanceActive = active
    if (!active) {
      bullseyePulseTimerSeconds = 0
      smoothedCenterError = 1
      smoothedHorizontalOffset = 0
      bullseyeGuidancePanner.pan.rampTo(0, 0.04)
    }
  }

  const playTargetLockMilestoneTone = (threshold: 25 | 50 | 75 | 100, pos?: { x: number, y: number, z: number }): void => {
    if (pos) {
      setTargetLockProgressPanner(pos.x, pos.y, pos.z)
    }
    const firstStart = strictlyIncreasingStartTime(Tone.now(), targetLockStageLastStartSeconds)
    if (threshold === 100) {
      const secondStart = strictlyIncreasingStartTime(firstStart + 0.07, firstStart)
      const thirdStart = strictlyIncreasingStartTime(firstStart + 0.14, secondStart)
      targetLockStageLastStartSeconds = thirdStart
      targetLockFullSuccessSynth.volume.value = Tone.gainToDb(0.52)
      targetLockFullSuccessSynth.triggerAttackRelease('G5', '32n', firstStart)
      targetLockFullSuccessSynth.triggerAttackRelease('B5', '32n', secondStart)
      targetLockFullSuccessSynth.triggerAttackRelease('D6', '16n', thirdStart)
      return
    }

    if (threshold === 25) {
      targetLockStageLastStartSeconds = firstStart
      targetLockStageSuccessSynth.volume.value = Tone.gainToDb(0.34)
      targetLockStageSuccessSynth.triggerAttackRelease('A4', '32n', firstStart)
      return
    }

    const secondStart = strictlyIncreasingStartTime(firstStart + 0.08, firstStart)
    if (threshold === 50) {
      targetLockStageLastStartSeconds = secondStart
      targetLockStageSuccessSynth.volume.value = Tone.gainToDb(0.36)
      targetLockStageSuccessSynth.triggerAttackRelease('A4', '32n', firstStart)
      targetLockStageSuccessSynth.triggerAttackRelease('C5', '32n', secondStart)
      return
    }

    const thirdStart = strictlyIncreasingStartTime(firstStart + 0.16, secondStart)
    targetLockStageLastStartSeconds = thirdStart
    targetLockStageSuccessSynth.volume.value = Tone.gainToDb(0.38)
    targetLockStageSuccessSynth.triggerAttackRelease('A4', '32n', firstStart)
    targetLockStageSuccessSynth.triggerAttackRelease('C5', '32n', secondStart)
    targetLockStageSuccessSynth.triggerAttackRelease('E5', '32n', thirdStart)
  }

  const resetTargetLockProgressAudio = (): void => {
    const hadAcquiredTarget = targetLockHasAcquiredTarget
    bullseyePulseTimerSeconds = 0
    smoothedCenterError = 1
    smoothedHorizontalOffset = 0
    targetLockHasAcquiredTarget = false
    targetLockMilestonesReached = { at25: false, at50: false, at75: false, at100: false }
    targetLockAudioState = 'NoTarget'
    setTargetLockPresenceToneActive(false)
    targetLockPresencePanner.pan.rampTo(0, 0.04)
    setBullseyeGuidanceActive(false)
    if (hadAcquiredTarget) {
      playTargetLockTransitionChirp(false)
    }
  } // end function resetTargetLockProgressAudio

  const updateTargetLockProgressAudio = (
    deltaSeconds: number,
    isTargetInLockBox: boolean,
    lockProgress: number,
    maxLockProgress: number,
    centerError: number,
    horizontalOffset: number,
    lockRateMultiplier: number,
    targetPos?: { x: number, y: number, z: number }
  ): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    }

    if (!isTargetInLockBox || maxLockProgress <= 0) {
      resetTargetLockProgressAudio()
      return
    }

    const clampedMaxProgress = Math.max(1, maxLockProgress)
    const clampedProgress = clamp(lockProgress, 0, clampedMaxProgress)
    const normalizedProgress = clamp(clampedProgress / clampedMaxProgress, 0, 1)
    const clampedCenterError = clamp(centerError, 0, 1)
    const clampedHorizontalOffset = clamp(horizontalOffset, -1, 1)
    const clampedLockRateMultiplier = clamp(lockRateMultiplier, 0, 1)
    const isLocked = normalizedProgress >= 0.999

    if (!targetLockHasAcquiredTarget) {
      playTargetLockTransitionChirp(true)
      targetLockHasAcquiredTarget = true
    }

    const desiredAudioState: 'NoTarget' | 'TargetInLockBox' | 'Refining' | 'Locked' = isLocked
      ? 'Locked'
      : (clampedLockRateMultiplier > 0.001 ? 'Refining' : 'TargetInLockBox')

    if (targetLockAudioState !== desiredAudioState) {
      targetLockAudioState = desiredAudioState
    }

    const shouldEnableGuidance = desiredAudioState === 'TargetInLockBox' || desiredAudioState === 'Refining'
    setTargetLockPresenceToneActive(shouldEnableGuidance)
    setBullseyeGuidanceActive(shouldEnableGuidance)
    updateTargetLockPresencePitch(clampedCenterError)
    updateTargetLockPresencePan(clampedHorizontalOffset)

    if (!targetLockMilestonesReached.at25 && normalizedProgress >= 0.25) {
      targetLockMilestonesReached.at25 = true
      playTargetLockMilestoneTone(25, targetPos)
    }
    if (!targetLockMilestonesReached.at50 && normalizedProgress >= 0.5) {
      targetLockMilestonesReached.at50 = true
      playTargetLockMilestoneTone(50, targetPos)
    }
    if (!targetLockMilestonesReached.at75 && normalizedProgress >= 0.75) {
      targetLockMilestonesReached.at75 = true
      playTargetLockMilestoneTone(75, targetPos)
    }
    if (!targetLockMilestonesReached.at100 && normalizedProgress >= 1) {
      targetLockMilestonesReached.at100 = true
      playTargetLockMilestoneTone(100, targetPos)
      setBullseyeGuidanceActive(false)
      setTargetLockPresenceToneActive(false)
    }

    if (!targetLockGuidanceActive) {
      return
    }

    const centerSmoothing = clamp(deltaSeconds * 8, 0, 1)
    const panSmoothing = clamp(deltaSeconds * 10, 0, 1)
    smoothedCenterError += (clampedCenterError - smoothedCenterError) * centerSmoothing
    smoothedHorizontalOffset += (clampedHorizontalOffset - smoothedHorizontalOffset) * panSmoothing
    bullseyeGuidancePanner.pan.rampTo(smoothedHorizontalOffset, 0.05)

    const minPulseIntervalSeconds = 0.05
    const maxPulseIntervalSeconds = 0.48
    const pulseIntervalSeconds = minPulseIntervalSeconds + ((maxPulseIntervalSeconds - minPulseIntervalSeconds) * smoothedCenterError)
    bullseyePulseTimerSeconds += Math.max(0, deltaSeconds)

    while (bullseyePulseTimerSeconds >= pulseIntervalSeconds) {
      bullseyePulseTimerSeconds -= pulseIntervalSeconds
      const start = strictlyIncreasingStartTime(Tone.now(), bullseyeGuidanceLastStartSeconds)
      bullseyeGuidanceLastStartSeconds = start
      const pulseFrequency = 820 + ((1 - smoothedCenterError) * 220)
      bullseyeGuidanceSynth.volume.value = Tone.gainToDb(0.18)
      bullseyeGuidanceSynth.triggerAttackRelease(pulseFrequency, '64n', start)
    }
  }

  const playNegativeActionTone = (): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not ready
    const firstStart = strictlyIncreasingStartTime(Tone.now(), negativeActionLastStartSeconds)
    const secondStart = strictlyIncreasingStartTime(firstStart + 0.08, firstStart)
    negativeActionLastStartSeconds = secondStart
    negativeActionSynth.volume.value = Tone.gainToDb(0.45)
    negativeActionSynth.triggerAttackRelease('G4', '64n', firstStart)
    negativeActionSynth.triggerAttackRelease('E4', '32n', secondStart)
  } // end function playNegativeActionTone

  const playExplosion = (
    worldX: number,
    worldY: number,
    playerX: number,
    playerY: number,
    playerAngle: number,
    soundCandidates: string[]
  ): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not ready

    const defaultSounds = [
      'assets/sounds/explosions/explosion_1A.ogg',
      'assets/sounds/explosions/explosion_2a.ogg',
      'assets/sounds/explosions/explosion3.ogg'
    ]
    const choices = soundCandidates.length > 0 ? soundCandidates : defaultSounds
    const path = choices[Math.floor(Math.random() * choices.length)] ?? defaultSounds[0]
    if (!path) {
      return
    } // end if no sound path

    const pan = computePanForWorldPosition(worldX, worldY, playerX, playerY, playerAngle)
    tankDeathConfirmPanner.pan.rampTo(pan, 0.01)
    tankDeathConfirmGain.gain.value = enemiesVolume

    const existingPlayer = explosionPlayerCache.get(path)
    if (existingPlayer) {
      retriggerLoadedPlayer(existingPlayer)
      return
    } // end if cached explosion player exists

    const player = new Tone.Player(path).connect(tankDeathConfirmGain)
    explosionPlayerCache.set(path, player)
    void player.load(path)
      .then(() => {
        retriggerLoadedPlayer(player)
      })
      .catch(() => undefined)
  } // end function playExplosion

  const pauseAllAudio = async (): Promise<void> => {
    if (audioPaused) {
      return
    } // end if already paused

    audioPaused = true
    contextWasRunningBeforePause = isAudioContextRunning()

    servoWasPlayingBeforePause = servoPlaying && !servoAudio.paused
    servoTimeBeforePause = servoAudio.currentTime
    if (servoWasPlayingBeforePause) {
      servoAudio.pause()
    } // end if servo was playing
    servoPlaying = false

    footstepWasPlayingBeforePause = !footstepAudio.paused
    footstepTimeBeforePause = footstepAudio.currentTime
    if (footstepWasPlayingBeforePause) {
      footstepAudio.pause()
    } // end if footstep was playing
    mobilityPlaceholderMasterGain.gain.value = 0

    ambienceWasPlayingBeforePause = !ambienceAudio.paused
    ambienceTimeBeforePause = ambienceAudio.currentTime
    if (ambienceWasPlayingBeforePause) {
      ambienceAudio.pause()
    } // end if ambience was playing

    cityAmbienceWasPlayingBeforePause = !cityAmbienceAudio.paused
    cityAmbienceTimeBeforePause = cityAmbienceAudio.currentTime
    if (cityAmbienceWasPlayingBeforePause) {
      cityAmbienceAudio.pause()
    } // end if city ambience was playing

    flightLoopWasPlayingBeforePause = isAnyFlightLoopPlaying()
    if (flightLoopWasPlayingBeforePause) {
      stopAllFlightLoopPlayers()
    } // end if player flight loop was playing

    stopMinigunLoopInternal(false)

    if (contextWasRunningBeforePause) {
      try {
        await rawContext.suspend()
      } catch {
        // Ignore suspend failures and keep gameplay paused regardless.
      } // end try/catch context suspend
    } // end if context was running before pause

    resetTargetLockProgressAudio()
  } // end function pauseAllAudio

  const resumeAllAudio = async (): Promise<void> => {
    if (!audioPaused) {
      return
    } // end if not paused

    if (contextWasRunningBeforePause && Tone.getContext().state !== 'running') {
      try {
        await rawContext.resume()
      } catch {
        // Ignore resume failures; interaction can re-arm audio later.
      } // end try/catch context resume
    } // end if context should resume

    if (servoWasPlayingBeforePause) {
      servoAudio.currentTime = servoTimeBeforePause
      void servoAudio.play().catch(() => undefined)
      servoPlaying = true
    } // end if servo should resume

    if (footstepWasPlayingBeforePause) {
      footstepAudio.currentTime = footstepTimeBeforePause
      void footstepAudio.play().catch(() => undefined)
    } // end if footstep should resume

    if (ambienceWasPlayingBeforePause) {
      ambienceAudio.currentTime = ambienceTimeBeforePause
      void ambienceAudio.play().catch(() => undefined)
    } // end if ambience should resume

    if (cityAmbienceWasPlayingBeforePause) {
      cityAmbienceAudio.currentTime = cityAmbienceTimeBeforePause
      void cityAmbienceAudio.play().catch(() => undefined)
    } // end if city ambience should resume

    if (flightLoopWasPlayingBeforePause) {
      startActiveFlightLoopPlayers()
    } // end if player flight loop should resume

    servoWasPlayingBeforePause = false
    footstepWasPlayingBeforePause = false
    ambienceWasPlayingBeforePause = false
    cityAmbienceWasPlayingBeforePause = false
    flightLoopWasPlayingBeforePause = false
    contextWasRunningBeforePause = false
    audioPaused = false
  } // end function resumeAllAudio

  const startFlightLoop = (params?: FlightLoopStartParams): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if player flight loop cannot start
    clearFlightSpinDownTimeout()
    activeFlightType = params?.flightType === 'jet' ? 'jet' : 'rotor'
    activeFlightLoopCount = Math.max(1, Math.round(params?.rotorCount ?? activeFlightLoopCount))
    lastFlightSpinUpSeconds = Math.max(0.4, params?.spinUpSeconds ?? lastFlightSpinUpSeconds)

    emitSemanticMovementEvent('thruster_start')
    emitSemanticMovementEvent('thruster_loop')
    const primaryLoopLoaded = activeFlightType === 'jet'
      ? jetFlightLoopPlayer.loaded
      : !!rotorFlightLoopPlayers[0]?.loaded
    if (!primaryLoopLoaded) {
      return
    } // end if loop asset missing; placeholder contract remains active
    setActiveFlightLoopCount(activeFlightLoopCount, false)
    startActiveFlightLoopPlayers()
    setActiveFlightPlaybackRate(0.56)
    flightBoostFilter.frequency.rampTo(1900, 0.2)
    flightBoostDistortion.wet.rampTo(0.04, 0.2)
    flightBoostGain.gain.rampTo(0.9 + ((activeFlightLoopCount - 1) * 0.12), 0.22)
  } // end function startFlightLoop

  const stopFlightLoop = (params?: FlightLoopStopParams): void => {
    emitSemanticMovementEvent('thruster_stop')
    clearFlightSpinDownTimeout()
    if (!isAnyFlightLoopPlaying()) {
      return
    } // end if no flight loop voice is active

    if (params?.quickSpinDown) {
      setActiveFlightPlaybackRate(0.62)
      flightBoostFilter.frequency.rampTo(800, 0.12)
      flightBoostDistortion.wet.rampTo(0.18, 0.09)
      flightBoostGain.gain.rampTo(0.55, 0.14)
      flightSpinDownTimeoutId = window.setTimeout(() => {
        stopAllFlightLoopPlayers()
        flightBoostFilter.frequency.rampTo(20000, 0.26)
        flightBoostDistortion.wet.rampTo(0, 0.22)
        flightBoostGain.gain.rampTo(1, 0.22)
        flightSpinDownTimeoutId = null
      }, 170)
      return
    } // end if quick spin-down requested

    stopAllFlightLoopPlayers()
  } // end function stopFlightLoop

  const updateFlightLoopAudio = (params: FlightLoopUpdateParams): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio graph is inactive

    if (!isAnyFlightLoopPlaying()) {
      return
    } // end if there is no active flight loop to shape

    const requestedFlightType = params.flightType === 'rotor' ? 'rotor' : 'jet'
    if (requestedFlightType !== activeFlightType) {
      activeFlightType = requestedFlightType
      setActiveFlightLoopCount(activeFlightLoopCount, true)
    }

    const rotorCount = Math.max(1, Math.min(rotorFlightLoopPlayers.length, Math.round(params.rotorCount ?? activeFlightLoopCount)))
    setActiveFlightLoopCount(rotorCount, true)

    const normalizedSpeed = clamp(params.normalizedSpeed, 0, 1)
    const spinProgress = clamp(params.spinProgress ?? (params.flightState === 'grounded' ? 0 : 1), 0, 1)
    const spinUpSeconds = Math.max(0.4, params.spinUpSeconds ?? lastFlightSpinUpSeconds)
    lastFlightSpinUpSeconds = spinUpSeconds

    const spinupSpeedBias = clamp(5 / spinUpSeconds, 0.7, 1.35)
    const baseRate = 0.54 + (spinProgress * 0.53)
    const movementRate = normalizedSpeed * (params.boosting ? 0.8 : 0.58)
    const targetPlaybackRate = clamp((baseRate + movementRate) * spinupSpeedBias, 0.5, 1.85)

    setActiveFlightPlaybackRate(targetPlaybackRate)

    const rotorGain = 0.86 + ((rotorCount - 1) * 0.14)
    const boostGain = params.boosting ? 0.2 : 0
    flightBoostGain.gain.rampTo(rotorGain + boostGain + (normalizedSpeed * 0.12), 0.09)
    flightBoostFilter.frequency.rampTo(900 + (normalizedSpeed * 4200) + (spinProgress * 1700), 0.11)
    flightBoostDistortion.wet.rampTo((normalizedSpeed * 0.14) + (params.boosting ? 0.18 : 0.02), 0.1)
  } // end function updateFlightLoopAudio

  const startBoostAudio = (): void => {
    emitSemanticMovementEvent('move_boost')
    emitSemanticMovementEvent('thruster_loop')
    // Play the one-shot engage cue
    if (audioStarted && !audioPaused && isAudioContextRunning() && boostEngageSound.loaded) {
      if (boostEngageSound.state === 'started') {
        boostEngageSound.stop()
      } // end if engage sound already playing
      boostEngageSound.start()
    } // end if engage sound can play

    if (activeFlightType === 'rotor') {
      setActiveFlightPlaybackRate(1.2)
      flightBoostFilter.frequency.rampTo(620, 0.34)
      flightBoostDistortion.wet.rampTo(0.28, 0.32)
      flightBoostGain.gain.rampTo(1.24 + ((activeFlightLoopCount - 1) * 0.1), 0.3)
      return
    }

    setActiveFlightPlaybackRate(0.65)
    flightBoostFilter.frequency.rampTo(500, 0.6)
    flightBoostDistortion.wet.rampTo(0.75, 0.6)
    flightBoostGain.gain.rampTo(1.2, 0.6)
  } // end function startBoostAudio

  const stopBoostAudio = (): void => {
    emitSemanticMovementEvent('move_decelerate')
    if (activeFlightType === 'rotor') {
      setActiveFlightPlaybackRate(1)
      flightBoostFilter.frequency.rampTo(1800, 0.25)
      flightBoostDistortion.wet.rampTo(0.04, 0.25)
      flightBoostGain.gain.rampTo(0.94 + ((activeFlightLoopCount - 1) * 0.1), 0.25)
      return
    }

    // Gradually return jet-profile loops to normal
    setActiveFlightPlaybackRate(1.0)
    flightBoostFilter.frequency.rampTo(20000, 1.5)
    flightBoostDistortion.wet.rampTo(0, 1.5)
    flightBoostGain.gain.rampTo(1.0, 1.5)
  } // end function stopBoostAudio

  const playHardLanding = (): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning() || !hardLandingSound.loaded) {
      return
    } // end if hard landing cue unavailable
    if (hardLandingSound.state === 'started') {
      hardLandingSound.stop()
    } // end if hard landing cue is already active
    hardLandingSound.start()
  } // end function playHardLanding

  const getAudioContextState = (): AudioContextState => Tone.getContext().state

  const setAimAssistEnabled = (enabled: boolean): void => {
    aimAssistEnabled = enabled
    if (!enabled) {
      aimAssistCueTimerSeconds = 0
    } // end if disabling aim assist
  } // end function setAimAssistEnabled

  const playObstacleContact = (distance: number, bearing: number, kind: 'wall' | 'boundary' | 'tree' | 'rock' | 'pillar', lowVolume = false): void => {
    const voice = sonarEchoVoices[sonarEchoVoiceCursor % sonarEchoVoices.length]
    sonarEchoVoiceCursor += 1
    if (!voice) {
      return
    } // end if no obstacle voice available

    const frequency = kind === 'boundary'
      ? 400
      : kind === 'wall'
        ? 480
        : kind === 'tree'
          ? 520
          : kind === 'pillar'
            ? 610
          : 420
    const oscillatorType = kind === 'boundary'
      ? 'sawtooth'
      : kind === 'wall'
        ? 'sine'
        : kind === 'tree'
          ? 'triangle'
          : kind === 'pillar'
            ? 'sawtooth'
          : 'square'
    voice.panner.pan.rampTo(clamp(Math.sin(bearing), -1, 1), 0.01)
    voice.synth.volume.value = gainToDbSafe(clamp(distanceToVolume(distance, AUDIO_NAVIGATION_CONFIG.obstacleAudioMaxDistance) * (lowVolume ? 0.18 : 0.42) * objectsVolume, 0, 2))
    voice.synth.oscillator.type = oscillatorType
    voice.synth.triggerAttackRelease(frequency, lowVolume ? '64n' : '32n')
  } // end function playObstacleContact

  const playEnemyContact = (distance: number, bearing: number, enemyId?: string, enemyType?: string, lowVolume = false): void => {
    const voice = enemyPingVoices[enemyPingVoiceCursor % enemyPingVoices.length]
    enemyPingVoiceCursor += 1
    if (!voice) {
      return
    } // end if no enemy voice available

    voice.panner.pan.rampTo(clamp(Math.sin(bearing), -1, 1), 0.01)
    voice.synth.volume.value = gainToDbSafe(clamp(distanceToVolume(distance, AUDIO_NAVIGATION_CONFIG.activePingEnemyDistance) * (lowVolume ? 0.22 : 0.55) * enemiesVolume, 0, 2))
    voice.synth.triggerAttackRelease(760 - distance * 8, lowVolume ? '64n' : '16n')

    if (enemyId) {
      getOrCreateEnemyRuntime(enemyId, resolveEnemyRuntimeType(enemyId, enemyType)).onSonarPing(activeSonarStamp, 0)
    } // end if enemy runtime should react to ping
  } // end function playEnemyContact

  const updateNearFieldNavigation = (
    player: PlayerAudioState,
    collisionWorld: WorldCollisionWorld,
    sprites: SpriteObject[],
    elevatedSurfaceHeight: number | null
  ): void => {
    if (!categoryProximity) {
      silenceWallProximityCue()
      return
    } // end if proximity category disabled

    if (elevatedSurfaceHeight !== null) {
      const nearestEdge = findNearestDropEdgeContact(
        collisionWorld,
        player.position.x,
        player.position.y,
        elevatedSurfaceHeight,
        AUDIO_NAVIGATION_CONFIG.nearFieldRadius
      )

      if (!nearestEdge || nearestEdge.distance > AUDIO_NAVIGATION_CONFIG.nearFieldRadius) {
        silenceWallProximityCue()
        return
      } // end if no nearby drop edge detected

      const edgeWorldAngle = Math.atan2(nearestEdge.worldY - player.position.y, nearestEdge.worldX - player.position.x)
      const edgeBearing = getBearing(player.angle, edgeWorldAngle)
      const edgeIntensity = clamp(1 - nearestEdge.distance / AUDIO_NAVIGATION_CONFIG.nearFieldRadius, 0, 1)
      playWallProximityCue(edgeBearing, edgeIntensity, proximityVolume)
      return
    } // end if elevated near-field mode

    const nearest = findNearestObstacleContact(
      collisionWorld,
      { x: player.position.x, y: player.position.y },
      player.angle,
      sprites,
      AUDIO_NAVIGATION_CONFIG.nearFieldRadius
    )

    if (!nearest || nearest.distance > AUDIO_NAVIGATION_CONFIG.nearFieldRadius) {
      silenceWallProximityCue()
      return
    } // end if no near-field obstacle detected

    const intensity = clamp(1 - nearest.distance / AUDIO_NAVIGATION_CONFIG.nearFieldRadius, 0, 1)
    playWallProximityCue(nearest.bearing, intensity, proximityVolume)
  } // end function updateNearFieldNavigation

  const updateNavigationDestinationCue = (player: PlayerAudioState, destination: WorldPosition | null): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning() || !categoryNavigation || destination === null) {
      destinationToneGain.gain.rampTo(0, 0.06)
      return
    } // end if destination cue should be silent

    const dx = destination.x - player.position.x
    const dy = destination.y - player.position.y
    const distance = Math.hypot(dx, dy)
    const bearing = Math.atan2(dy, dx)
    const relativeBearing = normalizeAngle(bearing - player.angle)
    const pan = clamp(Math.sin(relativeBearing), -1, 1)
    destinationTonePanner.pan.rampTo(pan, 0.04)

    const normalizedDistance = clamp(
      distance / Math.max(1, AUDIO_NAVIGATION_CONFIG.destinationToneRange),
      0,
      1
    )
    const frequency = AUDIO_NAVIGATION_CONFIG.destinationToneNearFrequency
      + (AUDIO_NAVIGATION_CONFIG.destinationToneFarFrequency - AUDIO_NAVIGATION_CONFIG.destinationToneNearFrequency) * normalizedDistance
    destinationToneOsc.frequency.rampTo(frequency, 0.05)

    const targetGain = AUDIO_NAVIGATION_CONFIG.destinationToneGain * navigationVolume
    destinationToneGain.gain.rampTo(targetGain, 0.07)
  } // end function updateNavigationDestinationCue

  const triggerPassiveSweepTone = (frequency: number, gain: number): void => {
    const now = Tone.now()
    const triggerTime = lastPassiveSweepTriggerTime >= 0
      ? Math.max(now, lastPassiveSweepTriggerTime + 0.002)
      : now

    sonarSweepSynth.volume.value = gainToDbSafe(gain * navigationVolume)

    try {
      sonarSweepSynth.triggerAttackRelease(frequency, '64n', triggerTime)
      lastPassiveSweepTriggerTime = triggerTime
    } catch {
      // Ignore tightly-packed passive sweep scheduling conflicts.
    } // end try/catch passive sweep schedule
  } // end function triggerPassiveSweepTone

  const runPassiveSweepTick = (
    player: PlayerAudioState,
    enemies: EnemyAudioState[],
    collisionWorld: WorldCollisionWorld,
    sprites: SpriteObject[],
    suppressObstacleContacts: boolean
  ): void => {
    const stepAngle = (Math.PI * 2) / (AUDIO_NAVIGATION_CONFIG.passiveSweepRotationSeconds * AUDIO_NAVIGATION_CONFIG.passiveSweepTickRateHz)
    const currentAngle = passiveSweepAngle
    const contact = scanSonarContact(
      collisionWorld,
      { x: player.position.x, y: player.position.y },
      player.angle,
      currentAngle,
      sprites,
      enemies,
      AUDIO_NAVIGATION_CONFIG.obstacleAudioMaxDistance,
      AUDIO_NAVIGATION_CONFIG.obstacleAudioMaxDistance
    )

    if (contact?.kind === 'enemy' && categoryEnemies) {
      const normalizedSweep = ((currentAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      const sweepFrequency = AUDIO_NAVIGATION_CONFIG.sweepBaseFrequency + (normalizedSweep / (Math.PI * 2)) * AUDIO_NAVIGATION_CONFIG.sweepPitchSpan
      triggerPassiveSweepTone(sweepFrequency, 0.04)
      playEnemyContact(contact.distance, contact.bearing, contact.enemyId, contact.enemyType, true)
    } else if (!suppressObstacleContacts && contact && contact.kind !== 'enemy' && categoryObjects) {
      const normalizedSweep = ((currentAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      const sweepFrequency = AUDIO_NAVIGATION_CONFIG.sweepBaseFrequency + (normalizedSweep / (Math.PI * 2)) * AUDIO_NAVIGATION_CONFIG.sweepPitchSpan
      triggerPassiveSweepTone(sweepFrequency, 0.035)
      playObstacleContact(contact.distance, contact.bearing, contact.kind, true)
    } // end if passive sweep contact found

    passiveSweepAngle = normalizeAngle(passiveSweepAngle + stepAngle)
  } // end function runPassiveSweepTick

  const updateSuppressionRegions = (
    dt: number,
    player: PlayerAudioState
  ): Array<{ entityId: string; position: WorldPosition; importance: number }> => {
    if (suppressionRegions.length <= 0) {
      return []
    }

    const now = Tone.now()
    const occlusionInputs: Array<{ entityId: string; position: WorldPosition; importance: number }> = []

    for (let regionIndex = suppressionRegions.length - 1; regionIndex >= 0; regionIndex -= 1) {
      const region = suppressionRegions[regionIndex]
      if (!region) {
        continue
      }

      region.score = Math.max(0, region.score - (dt * SUPPRESSION_REGION_SCORE_DECAY_PER_SECOND))
      region.impactsThisWindow = Math.max(0, region.impactsThisWindow - Math.ceil(dt * 32))

      const timeSinceImpact = now - region.lastImpactTimeSeconds
      const shouldBeActive = timeSinceImpact <= SUPPRESSION_REGION_IDLE_TIMEOUT_SECONDS
        && region.score >= SUPPRESSION_REGION_SCORE_ACTIVATION

      if (shouldBeActive) {
        region.active = true
        void ensureSuppressionLoopLoaded(region).then(() => {
          if (!region.loopPlayer || !region.loopLoaded || audioPaused || !isAudioContextRunning()) {
            return
          }
          try {
            if (region.loopPlayer.state !== 'started') {
              region.loopPlayer.start()
            }
          } catch {
            // Ignore loop start race.
          }
        })
      } else if (timeSinceImpact > 2.4 && !region.active) {
        region.emitter.dispose()
        region.gain.dispose()
        region.filter.dispose()
        region.loopPlayer?.dispose()
        suppressionRegions.splice(regionIndex, 1)
        continue
      }

      const blend = clamp(dt * 9.5, 0, 1)
      const targetX = region.centroidX
      const targetY = region.centroidY
      const targetZ = region.centroidZ
      region.centroidX = (region.centroidX * (1 - blend)) + (targetX * blend)
      region.centroidY = (region.centroidY * (1 - blend)) + (targetY * blend)
      region.centroidZ = (region.centroidZ * (1 - blend)) + (targetZ * blend)
      region.emitter.setPosition(region.centroidX, region.centroidY, Math.max(0, region.centroidZ))

      const distanceToListener = Math.hypot(
        region.centroidX - player.position.x,
        region.centroidY - player.position.y,
        region.centroidZ - player.position.z
      )
      const distanceGain = clamp(1 - (distanceToListener / 130), 0, 1)
      const scoreGain = clamp((region.score - SUPPRESSION_REGION_SCORE_ACTIVATION) / 9, 0, 1)
      const suppressionGain = shouldBeActive
        ? clamp(objectsVolume * (0.16 + (scoreGain * 0.38)) * (0.24 + (distanceGain * 0.76)), 0.001, 0.85)
        : 0.001

      region.gain.gain.rampTo(
        suppressionGain,
        shouldBeActive ? SUPPRESSION_REGION_ACTIVE_FADE_SECONDS : SUPPRESSION_REGION_IDLE_FADE_SECONDS
      )

      if (!shouldBeActive && region.loopPlayer?.state === 'started') {
        try {
          region.loopPlayer.stop()
        } catch {
          // Ignore loop stop race.
        }
        region.active = false
      }

      if (region.active) {
        occlusionInputs.push({
          entityId: region.id,
          position: {
            x: region.centroidX,
            y: region.centroidY,
            z: Math.max(0, region.centroidZ)
          },
          importance: clamp(region.nextOcclusionImportance * (0.35 + (distanceGain * 0.65)), 0.12, 1)
        })
      }
    }

    return occlusionInputs
  }

  const applySuppressionOcclusion = (): void => {
    for (const region of suppressionRegions) {
      if (!region.active) {
        continue
      }
      const occlusionAmount = audioOcclusionSystem.getOcclusionAmount(region.id)
      const lowpassHz = 16000 + ((4200 - 16000) * clamp(occlusionAmount, 0, 1))
      region.filter.frequency.rampTo(lowpassHz, 0.12)
    }
  }

  const updateFrameAudio = (
    dt: number,
    player: PlayerAudioState,
    enemies: EnemyAudioState[],
    collisionWorld: WorldCollisionWorld,
    sprites: SpriteObject[]
  ): void => {
    updateZoneAmbienceMix(player, dt)
    applyHtmlAudioVolumes()

    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started

    spatialScene.updateListenerFromCamera({
      position: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z
      },
      orientation: {
        forwardX: Math.cos(player.angle),
        forwardY: Math.sin(player.angle),
        forwardZ: 0,
        upX: 0,
        upY: 0,
        upZ: 1
      }
    })

    const elevatedSurfaceHeight = resolveElevatedSurfaceHeight(player, collisionWorld)
    const isOnElevatedSurface = elevatedSurfaceHeight !== null
    suppressObjectNavigationIndicators = isOnElevatedSurface

    const nearestEnemyDistance = enemies
      .filter((enemy) => enemy.isAlive)
      .map((enemy) => Math.hypot(
        enemy.position.x - player.position.x,
        enemy.position.y - player.position.y,
        enemy.position.z - player.position.z
      ))
      .sort((a, b) => a - b)[0] ?? Number.POSITIVE_INFINITY
    const nearestObstacleContact = isOnElevatedSurface
      ? null
      : findNearestObstacleContact(
          collisionWorld,
          { x: player.position.x, y: player.position.y },
          player.angle,
          sprites,
          AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance,
          32
        )
    const nearestDropEdgeContact = isOnElevatedSurface
      ? findNearestDropEdgeContact(
          collisionWorld,
          player.position.x,
          player.position.y,
          elevatedSurfaceHeight,
          AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance,
          24,
          0.25
        )
      : null
    const hasNearbySonarContact = (
      nearestEnemyDistance <= AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance ||
      (nearestObstacleContact !== null && nearestObstacleContact.distance <= AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance) ||
      (nearestDropEdgeContact !== null && nearestDropEdgeContact.distance <= AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance)
    )

    const suppressionOcclusionInputs = updateSuppressionRegions(dt, player)

    audioOcclusionSystem.update({
      dtSeconds: dt,
      world: collisionWorld,
      listener: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z
      },
      emitters: [
        ...enemies
          .filter((enemy) => enemy.isAlive)
          .map((enemy) => {
            const distance = Math.hypot(
              enemy.position.x - player.position.x,
              enemy.position.y - player.position.y,
              enemy.position.z - player.position.z
            )

            return {
              entityId: enemy.id,
              position: enemy.position,
              importance: clamp(1 - (distance / 52), 0.12, 1)
            }
          }),
        ...suppressionOcclusionInputs
      ]
    })

    applySuppressionOcclusion()

    const liveEnemyIds = new Set<string>()
    for (const enemy of enemies) {
      liveEnemyIds.add(enemy.id)
      const runtime = getOrCreateEnemyRuntime(enemy.id, enemy.type, {
        positionalLoopSound: enemy.positionalLoopSound,
        loopSoundMaxDistance: enemy.loopSoundMaxDistance,
        loopSoundPauseIntervalMs: enemy.loopSoundPauseIntervalMs,
        stopLoopSoundWhileStationary: enemy.stopLoopSoundWhileStationary
      })
      const occlusionAmount = audioOcclusionSystem.getOcclusionAmount(enemy.id)
      // Always call updateAudio so movement/firing/reloading are never silenced by the combat audio toggle.
      // Only LOS ticks, threat cues, and pings are gated by the toggle.
      // Movement/firing/reloading always use full volume.
      runtime.updateAudio(
        dt,
        enemy,
        player,
        /*occlusionAmount*/ occlusionAmount,
        /*volumeScale*/ enemiesVolume > 0 ? enemiesVolume : 1
      )
    } // end for each enemy

    for (const [enemyId, runtime] of enemyRuntimes.entries()) {
      if (!liveEnemyIds.has(enemyId)) {
        runtime.dispose()
        enemyRuntimes.delete(enemyId)
      } // end if runtime not active this frame
    } // end for each runtime

    if (player.isFlying || !hasNearbySonarContact) {
      silenceWallProximityCue()
      passiveSweepAccumulatorSeconds = 0
    } else {
      updateNearFieldNavigation(player, collisionWorld, sprites, elevatedSurfaceHeight)

      passiveSweepAccumulatorSeconds += dt
      const sweepTickSeconds = 1 / AUDIO_NAVIGATION_CONFIG.passiveSweepTickRateHz
      while (passiveSweepAccumulatorSeconds >= sweepTickSeconds) {
        passiveSweepAccumulatorSeconds -= sweepTickSeconds
        runPassiveSweepTick(player, enemies, collisionWorld, sprites, isOnElevatedSurface)
      } // end while passive sweep ticks are due
    } // end if sonar should be active

    updatePassiveRadar(dt)
    updateRadarDetection(player, enemies)
    updateAimAssist(dt, player, enemies)

    previousPlayerX = player.position.x
    previousPlayerY = player.position.y
    previousPlayerZ = player.position.z
  } // end function updateFrameAudio

  const triggerActiveSonar = (
    player: PlayerAudioState,
    enemies: EnemyAudioState[],
    collisionWorld: WorldCollisionWorld,
    sprites: SpriteObject[]
  ): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started

    if (player.isFlying) {
      return
    } // end if active sonar disabled while flying

    const elevatedSurfaceHeight = resolveElevatedSurfaceHeight(player, collisionWorld)
    const isOnElevatedSurface = elevatedSurfaceHeight !== null

    playCardinalHeadingCue(player.angle)

    const nearestEnemyDistance = enemies
      .filter((enemy) => enemy.isAlive)
      .map((enemy) => Math.hypot(
        enemy.position.x - player.position.x,
        enemy.position.y - player.position.y,
        enemy.position.z - player.position.z
      ))
      .sort((a, b) => a - b)[0] ?? Number.POSITIVE_INFINITY
    const nearestObstacleContact = isOnElevatedSurface
      ? null
      : findNearestObstacleContact(
          collisionWorld,
          { x: player.position.x, y: player.position.y },
          player.angle,
          sprites,
          AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance,
          32
        )
    const nearestDropEdgeContact = isOnElevatedSurface
      ? findNearestDropEdgeContact(
          collisionWorld,
          player.position.x,
          player.position.y,
          elevatedSurfaceHeight,
          AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance,
          24,
          0.25
        )
      : null
    const hasNearbySonarContact = (
      nearestEnemyDistance <= AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance ||
      (nearestObstacleContact !== null && nearestObstacleContact.distance <= AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance) ||
      (nearestDropEdgeContact !== null && nearestDropEdgeContact.distance <= AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance)
    )
    if (!hasNearbySonarContact) {
      return
    } // end if no nearby sonar-worthy contact

    activeSonarStamp += 1
    activePingSynth.volume.value = gainToDbSafe(0.12 * navigationVolume)
    activePingSynth.triggerAttackRelease('C4', AUDIO_CONFIG.player.sonarActiveDurationSeconds)

    const contacts = []
    for (let index = 0; index < 16; index += 1) {
      const angle = player.angle + (index / 16) * Math.PI * 2
      const contact = scanSonarContact(
        collisionWorld,
        { x: player.position.x, y: player.position.y },
        player.angle,
        angle,
        sprites,
        enemies,
        AUDIO_NAVIGATION_CONFIG.activePingObstacleDistance,
        AUDIO_NAVIGATION_CONFIG.activePingEnemyDistance
      )
      if (contact) {
        contacts.push(contact)
      } // end if manual ping ray returned a hit
    } // end for each starburst ray

    const obstacleContacts = filterClosest(
      contacts.filter((contact) => contact.kind !== 'enemy'),
      AUDIO_NAVIGATION_CONFIG.maxSimultaneousObstacleTones
    )
    const uniqueEnemyContacts = new Map<string, typeof contacts[number]>()
    for (const contact of contacts) {
      if (contact.kind !== 'enemy' || !contact.enemyId || uniqueEnemyContacts.has(contact.enemyId)) {
        continue
      } // end if contact is not a unique enemy hit
      uniqueEnemyContacts.set(contact.enemyId, contact)
    } // end for each contact

    for (const contact of obstacleContacts) {
      if (contact.kind === 'enemy') {
        continue
      } // end if contact is not an obstacle tone

      if (categoryObjects && !isOnElevatedSurface) {
        playObstacleContact(contact.distance, contact.bearing, contact.kind)
      } // end if objects category enabled
    } // end for each filtered obstacle contact

    for (const contact of uniqueEnemyContacts.values()) {
      if (categoryEnemies) {
        playEnemyContact(contact.distance, contact.bearing, contact.enemyId, contact.enemyType)
      } // end if enemies category enabled
    } // end for each enemy sonar contact
  } // end function triggerActiveSonar

  const emitEnvironmentalSonar = (echoes: SonarEcho[]): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning() || !categoryObjects || suppressObjectNavigationIndicators) {
      return
    } // end if audio not started or objects category disabled

    const now = Tone.now()
    environmentalSonarScanSynth.volume.value = gainToDbSafe(objectsVolume)
    environmentalSonarScanSynth.triggerAttackRelease('E4', '16n', now)

    for (const echo of echoes) {
      const delaySeconds = clamp(
        echo.distance * AUDIO_CONFIG.player.environmentalSonarEchoDelayPerUnit,
        0.02,
        0.9
      )
      const pan = clamp(echo.relativeAngle / (Math.PI * 0.5), -1, 1)
      const baseFrequency = echo.obstacleType === 'wall'
        ? 220
        : echo.obstacleType === 'pillar'
          ? 350
        : echo.obstacleType === 'rock'
          ? 300
          : 380
      const frequency = baseFrequency + clamp((12 - echo.distance) * 9, -70, 120)
      const duration = echo.obstacleType === 'wall' ? '32n' : '64n'

      const voice = sonarEchoVoices[sonarEchoVoiceCursor % sonarEchoVoices.length]
      sonarEchoVoiceCursor += 1
      if (!voice) {
        continue
      } // end if missing sonar voice

      voice.panner.pan.rampTo(pan, 0.01)
      voice.synth.volume.value = gainToDbSafe(objectsVolume)
      voice.synth.oscillator.type = echo.obstacleType === 'wall'
        ? 'sine'
        : echo.obstacleType === 'pillar'
          ? 'sawtooth'
          : 'triangle'
      voice.synth.triggerAttackRelease(frequency, duration, now + delaySeconds)
    } // end for each sonar echo
  } // end function emitEnvironmentalSonar

  const resolveEnemyRuntimeType = (enemyId: string, requestedType?: string): string => {
    if (requestedType) {
      return requestedType
    } // end if caller provided an explicit enemy type

    return enemyRuntimes.get(enemyId)?.profile.type ?? AUDIO_CONFIG.tank.type
  } // end function resolveEnemyRuntimeType

  const playEnemyThreatCue = (enemyId: string, enemyType: string = AUDIO_CONFIG.tank.type): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning() || !categoryEnemies) {
      return
    } // end if audio not started or enemies category disabled
    getOrCreateEnemyRuntime(enemyId, resolveEnemyRuntimeType(enemyId, enemyType)).playThreatCue()
  } // end function playEnemyThreatCue

  const playEnemyAttack = (enemyId: string, enemyType: string = AUDIO_CONFIG.tank.type, burstProjectileCount?: number): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning() || !categoryEnemies) {
      return
    } // end if audio not started or enemies category disabled
    getOrCreateEnemyRuntime(enemyId, resolveEnemyRuntimeType(enemyId, enemyType)).playAttack(burstProjectileCount)
  } // end function playEnemyAttack

  const playEnemyHurt = (enemyId: string, enemyType: string = AUDIO_CONFIG.tank.type): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning() || !categoryEnemies) {
      return
    } // end if audio not started or enemies category disabled
    getOrCreateEnemyRuntime(enemyId, resolveEnemyRuntimeType(enemyId, enemyType)).playHurt()
  } // end function playEnemyHurt

  const playEnemyDeath = (enemyId: string, enemyType: string = AUDIO_CONFIG.tank.type): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning() || !categoryEnemies) {
      return
    } // end if audio not started or enemies category disabled
    getOrCreateEnemyRuntime(enemyId, resolveEnemyRuntimeType(enemyId, enemyType)).playDeath()
  } // end function playEnemyDeath

  const applyReloadServoEffect = (effect: ReloadServoEffect): void => {
    if (effect.type === 'pitch') {
      const ratio = Math.max(0.05, 1 + effect.magnitude)
      reloadServoPitch.pitch = 12 * Math.log2(ratio)
      return
    } // end if pitch effect

    if (effect.type === 'distortion') {
      const normalized = clamp(effect.magnitude, 0, 1)
      reloadServoDistortion.wet.value = normalized
      reloadServoDistortion.distortion = 0.05 + normalized * 0.9
      return
    } // end if distortion effect

    if (effect.type === 'gain' || effect.type === 'volume') {
      reloadServoGain.gain.value = Math.max(0.001, 0.001 + effect.magnitude)
      return
    } // end if gain/volume effect

    if (effect.type === 'lowpass') {
      reloadServoLowpass.frequency.value = Math.max(120, effect.magnitude)
    } // end if lowpass effect
  } // end function applyReloadServoEffect

  const playWeaponReloadSequence = async (definition: WeaponReloadDefinition): Promise<void> => {
    if (definition.timeline.length <= 0) {
      return
    } // end if reload timeline is empty

    const clipEvents: Array<{ soundPath: string; startMs: number }> = []
    let cursorMs = 0
    for (const segment of definition.timeline) {
      if (segment.type === 'pause') {
        cursorMs += Math.max(0, segment.durationMs)
        continue
      } // end if segment is pause

      const durationMs = await getReloadClipDurationMs(segment.soundPath)
      clipEvents.push({ soundPath: segment.soundPath, startMs: cursorMs })
      cursorMs += durationMs
    } // end for each timeline segment

    const totalDurationMs = Math.max(0, cursorMs)
    if (totalDurationMs <= 0) {
      return
    } // end if timeline has no audible duration

    let servoPlayer = await getOrCreateReloadServoPlayer(definition.servoLoopSoundPath)
    if (!servoPlayer) {
      servoPlayer = await getOrCreateReloadServoPlayer(reloadServoLoopFallbackPath)
    } // end if requested servo bed could not be loaded

    resetReloadServoEffectNodes()
    const servoBaseGain = Math.max(0.001, AUDIO_CONFIG.player.servoVolume * masterVolume * servoVolume)
    reloadServoGain.gain.value = servoBaseGain

    if (servoPlayer) {
      try {
        if (servoPlayer.state === 'started') {
          servoPlayer.stop()
        } // end if servo player is already running
      } catch {
        // Ignore player stop races caused by overlapping user actions.
      }
      servoPlayer.loop = true
      servoPlayer.start()
    } // end if reload servo player exists

    const scheduledTimers: number[] = []
    for (const clipEvent of clipEvents) {
      const timerId = window.setTimeout(() => {
        fireGunshot(clipEvent.soundPath)
      }, Math.max(0, clipEvent.startMs))
      scheduledTimers.push(timerId)
    } // end for each reload clip event

    for (const effect of definition.servoEffects) {
      const effectStartMs = Math.max(0, effect.startMs)
      const effectEndMs = Math.max(effectStartMs, effect.endMs)
      const startTimerId = window.setTimeout(() => {
        applyReloadServoEffect(effect)
      }, effectStartMs)
      scheduledTimers.push(startTimerId)

      const endTimerId = window.setTimeout(() => {
        resetReloadServoEffectNodes()
        reloadServoGain.gain.value = servoBaseGain
      }, effectEndMs)
      scheduledTimers.push(endTimerId)
    } // end for each servo effect

    await waitForMs(totalDurationMs)

    for (const timerId of scheduledTimers) {
      window.clearTimeout(timerId)
    } // end for each scheduled timer

    if (servoPlayer) {
      try {
        if (servoPlayer.state === 'started') {
          servoPlayer.stop()
        } // end if reload servo is still running
      } catch {
        // Ignore stop races when sequence ends during a state transition.
      }
    } // end if servo player exists

    resetReloadServoEffectNodes()
  } // end function playWeaponReloadSequence

  const fireGunshot = (soundPath: string = defaultPlayerFireSoundPath): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started

    const cachedPool = playerFireSoundVoicePools.get(soundPath)
    if (cachedPool) {
      const currentCursor = playerFireSoundVoiceCursors.get(soundPath) ?? 0
      const nextCursor = playFromVoicePool(cachedPool, currentCursor)
      playerFireSoundVoiceCursors.set(soundPath, nextCursor)
      return
    } // end if cached fire sound voice pool exists

    if (playerFireSoundPendingLoads.has(soundPath)) {
      return
    } // end if this sound path is still loading

    playerFireSoundPendingLoads.add(soundPath)
    const poolSize = 8
    const voicePool = Array.from({ length: poolSize }, () => new Tone.Player(soundPath).toDestination())
    playerFireSoundVoicePools.set(soundPath, voicePool)
    playerFireSoundVoiceCursors.set(soundPath, 0)

    void Promise.all(voicePool.map((voice) => voice.load(soundPath)))
      .then(() => {
        const currentCursor = playerFireSoundVoiceCursors.get(soundPath) ?? 0
        const nextCursor = playFromVoicePool(voicePool, currentCursor)
        playerFireSoundVoiceCursors.set(soundPath, nextCursor)
      })
      .catch((error) => {
        audioDebugWarn('Failed to load player fire sound voice pool, falling back to default.', { soundPath, error })
        playerFireSoundVoicePools.delete(soundPath)
        playerFireSoundVoiceCursors.delete(soundPath)
        for (const voice of voicePool) {
          voice.dispose()
        } // end for each failed pooled voice
        retriggerLoadedPlayer(playerFireSound)
      })
      .finally(() => {
        playerFireSoundPendingLoads.delete(soundPath)
      })

  } // end function fireGunshot

  const updateMinigunLoopGain = (): void => {
    const targetGain = clamp(masterVolume * objectsVolume * 0.7, 0, 1.3)
    minigunLoopGain.gain.rampTo(targetGain, 0.03)
  } // end function updateMinigunLoopGain

  const ensureMinigunLoaded = (): Promise<void> => {
    if (minigunLoaded) {
      return Promise.resolve()
    }
    if (minigunLoadPromise) {
      return minigunLoadPromise
    }

    minigunLoadPromise = Promise.all([
      minigunSpinUpPlayer.load(minigunSpinUpPath),
      minigunLoopPlayer.load(minigunLoopPath),
      minigunSpinDownPlayer.load(minigunSpinDownPath)
    ])
      .then(() => {
        minigunLoaded = true
      })
      .catch((error) => {
        audioDebugWarn('Failed to load minigun loop audio.', { error })
      })
      .finally(() => {
        minigunLoadPromise = null
      })

    return minigunLoadPromise
  } // end function ensureMinigunLoaded

  const stopMinigunLoopInternal = (playSpinDown: boolean): void => {
    const hadActiveMinigunAudio = minigunLoopMode !== 'idle'
      || minigunSpinUpPlayer.state === 'started'
      || minigunLoopPlayer.state === 'started'

    if (minigunStartLoopTimeoutId !== null) {
      window.clearTimeout(minigunStartLoopTimeoutId)
      minigunStartLoopTimeoutId = null
    }

    try {
      if (minigunLoopPlayer.state === 'started') {
        minigunLoopPlayer.stop()
      }
    } catch {
      // Ignore stop races on browser audio threads.
    }

    try {
      if (minigunSpinUpPlayer.state === 'started') {
        minigunSpinUpPlayer.stop()
      }
    } catch {
      // Ignore stop races on browser audio threads.
    }

    if (playSpinDown && hadActiveMinigunAudio && minigunLoaded && !audioPaused && isAudioContextRunning()) {
      try {
        if (minigunSpinDownPlayer.state === 'started') {
          minigunSpinDownPlayer.stop()
        }
      } catch {
        // Ignore stop races on browser audio threads.
      }
      minigunSpinDownPlayer.start()
    }

    minigunLoopMode = 'idle'
    minigunLoopGain.gain.rampTo(0.001, 0.1)
  } // end function stopMinigunLoopInternal

  const startMinigunFiringLoop = (): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if minigun loop cannot start

    updateMinigunLoopGain()
    if (minigunLoopMode === 'sustain' || minigunLoopMode === 'spooling') {
      return
    }

    void ensureMinigunLoaded().then(() => {
      if (audioPaused || !isAudioContextRunning()) {
        return
      }

      updateMinigunLoopGain()
      if (minigunLoopMode === 'sustain' || minigunLoopMode === 'spooling') {
        return
      }

      if (minigunStartLoopTimeoutId !== null) {
        window.clearTimeout(minigunStartLoopTimeoutId)
        minigunStartLoopTimeoutId = null
      }

      try {
        if (minigunSpinDownPlayer.state === 'started') {
          minigunSpinDownPlayer.stop()
        }
      } catch {
        // Ignore stop races on browser audio threads.
      }

      try {
        if (minigunSpinUpPlayer.state === 'started') {
          minigunSpinUpPlayer.stop()
        }
      } catch {
        // Ignore stop races on browser audio threads.
      }
      minigunSpinUpPlayer.start()
      minigunLoopMode = 'spooling'

      const spinUpDurationMs = Math.max(40, Math.round((minigunSpinUpPlayer.buffer?.duration ?? 0.18) * 1000))
      minigunStartLoopTimeoutId = window.setTimeout(() => {
        minigunStartLoopTimeoutId = null
        if (audioPaused || !isAudioContextRunning()) {
          return
        }
        if (minigunLoopMode !== 'spooling') {
          return
        }

        try {
          if (minigunLoopPlayer.state === 'started') {
            minigunLoopPlayer.stop()
          }
        } catch {
          // Ignore stop races on browser audio threads.
        }
        minigunLoopPlayer.start()
        minigunLoopMode = 'sustain'
      }, spinUpDurationMs)
    })
  } // end function startMinigunFiringLoop

  const stopMinigunFiringLoop = (): void => {
    stopMinigunLoopInternal(true)
  } // end function stopMinigunFiringLoop

  const isMinigunLoopActive = (): boolean => {
    return minigunLoopMode === 'sustain' && minigunLoopPlayer.state === 'started'
  } // end function isMinigunLoopActive

  const playProjectileNearMiss = (
    projectileType: 'bullet' | 'projectile',
    worldX: number,
    worldY: number,
    playerX: number,
    playerY: number,
    playerAngle: number,
    closestDistance: number,
    nearMissRadius: number
  ): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started

    void playerX
    void playerY
    void playerAngle
    const clampedRadius = Math.max(nearMissRadius, 0.001)
    const closeness = clamp(1 - closestDistance / clampedRadius, 0, 1)
    if (projectileType === 'projectile') {
      projectileNearMissGain.gain.value = clamp((0.08 + closeness * 0.9) * enemiesVolume, 0, 1.4)
      projectileNearMissEmitter.setPosition(worldX, worldY, 0)
      projectileNearMissVoiceCursor = playFromVoicePool(projectileNearMissVoices, projectileNearMissVoiceCursor)
      return
    } // end if cannon projectile near miss

    bulletNearMissGain.gain.value = clamp((0.06 + closeness * 0.8) * enemiesVolume, 0, 1.3)
    bulletNearMissEmitter.setPosition(worldX, worldY, 0)
    bulletNearMissVoiceCursor = playFromVoicePool(bulletNearMissVoices, bulletNearMissVoiceCursor)
  } // end function playProjectileNearMiss

  const updateIncomingProjectileAudio = (
    projectiles: IncomingProjectileAudioState[],
    playerX: number,
    playerY: number,
    playerAngle: number
  ): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning() || !categoryEnemies) {
      for (const voice of incomingProjectileVoices) {
        releaseIncomingProjectileVoice(voice)
      } // end for each incoming voice
      return
    } // end if incoming projectile audio should not run

    const audibleProjectiles = projectiles
      .filter((projectile) => projectile.distanceToPlayer <= (projectile.isMissile ? 36 : 22))
      .sort((a, b) => a.distanceToPlayer - b.distanceToPlayer)
      .slice(0, incomingProjectileVoices.length)
    const audibleIds = new Set<number>(audibleProjectiles.map((projectile) => projectile.id))

    for (const voice of incomingProjectileVoices) {
      if (voice.id === null || audibleIds.has(voice.id)) {
        continue
      } // end if voice has no id or should remain active
      releaseIncomingProjectileVoice(voice)
    } // end for each active voice

    for (const projectile of audibleProjectiles) {
      const voice = acquireIncomingProjectileVoice(projectile.id)
      if (!voice) {
        continue
      } // end if no voice available

      const maxDistance = projectile.isMissile ? 36 : 22
      const distance = Math.max(projectile.distanceToPlayer, 0.001)
      const toPlayerX = playerX - projectile.x
      const toPlayerY = playerY - projectile.y
      const closingSpeed = (projectile.velocityX * toPlayerX + projectile.velocityY * toPlayerY) / distance
      const proximity = clamp(1 - distance / maxDistance, 0, 1)
      const approach = clamp(closingSpeed / 8, 0, 1)
      const baseGain = projectile.isMissile ? 0.03 : 0.015
      const proximityGain = projectile.isMissile ? 0.34 : 0.2
      const approachGain = projectile.isMissile ? 0.92 : 0.78
      const targetGain = clamp((baseGain + proximity * (proximityGain + approach * approachGain)) * enemiesVolume, 0, 1.3)

      voice.emitter.setPosition(projectile.x, projectile.y, projectile.z ?? 0)
      voice.gain.gain.value = targetGain
      setIncomingProjectileVoiceLoop(voice, projectile.isMissile === true)
    } // end for each audible projectile
  } // end function updateIncomingProjectileAudio

  const play_missile_warning = (type: MissileWarningType, intensity: number, direction: number): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning() || !categoryEnemies) {
      return
    } // end if missile warning audio should not run

    const warningIntensity = clamp(intensity, 0, 1)
    const warningPan = clamp(direction, -1, 1)
    const warningIntervalSeconds = (() => {
      if (type === 'terminal') {
        return 0.22 - (warningIntensity * 0.14)
      }
      if (type === 'tracking') {
        return 0.4 - (warningIntensity * 0.2)
      }
      return 0.68 - (warningIntensity * 0.24)
    })()

    missileWarningPanner.pan.rampTo(warningPan, 0.03)
    const targetGain = (0.1 + (warningIntensity * 0.55)) * enemiesVolume
    missileWarningGain.gain.rampTo(Math.max(0.001, targetGain), 0.02)

    const nowSeconds = Tone.now()
    const warningStateChanged = missileWarningActiveType !== type
    const warningDirectionShifted = Math.abs(warningPan - missileWarningLastDirection) > 0.24
    const warningIntensityShifted = Math.abs(warningIntensity - missileWarningLastIntensity) > 0.28
    const shouldPulse = warningStateChanged
      || warningDirectionShifted
      || warningIntensityShifted
      || (nowSeconds - missileWarningLastPulseSeconds) >= Math.max(0.08, warningIntervalSeconds)

    if (!shouldPulse) {
      return
    } // end if pulse interval has not elapsed

    const pulseStart = strictlyIncreasingStartTime(nowSeconds, missileWarningLastPulseSeconds)
    missileWarningLastPulseSeconds = pulseStart
    missileWarningActiveType = type
    missileWarningLastDirection = warningPan
    missileWarningLastIntensity = warningIntensity

    if (type === 'terminal') {
      missileWarningTerminalSynth.volume.value = gainToDbSafe(0.2 + (warningIntensity * 0.6))
      missileWarningDetectionSynth.volume.value = gainToDbSafe(0.16 + (warningIntensity * 0.35))
      scheduleMissileWarningNote(missileWarningTerminalSynth, 'G5', '32n', pulseStart)
      scheduleMissileWarningNote(missileWarningTerminalSynth, 'A5', '32n', pulseStart + 0.055)
      scheduleMissileWarningNote(missileWarningDetectionSynth, 'D6', '64n', pulseStart + 0.11)
      return
    } // end if terminal warning pulse

    if (type === 'tracking') {
      missileWarningDetectionSynth.volume.value = gainToDbSafe(0.14 + (warningIntensity * 0.42))
      scheduleMissileWarningNote(missileWarningDetectionSynth, 'C5', '32n', pulseStart)
      scheduleMissileWarningNote(missileWarningDetectionSynth, 'E5', '64n', pulseStart + 0.07)
      return
    } // end if tracking warning pulse

    missileWarningDetectionSynth.volume.value = gainToDbSafe(0.12 + (warningIntensity * 0.32))
    scheduleMissileWarningNote(missileWarningDetectionSynth, 'A4', '16n', pulseStart)
  } // end function play_missile_warning

  const stop_missile_warning = (): void => {
    missileWarningActiveType = null
    missileWarningLastIntensity = 0
    missileWarningLastScheduledSeconds = Math.max(missileWarningLastScheduledSeconds, Tone.now())
    missileWarningGain.gain.rampTo(0.001, 0.03)
  } // end function stop_missile_warning

  const play_flyby_sound = (direction: number, speed: number): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning() || !categoryEnemies) {
      return
    } // end if flyby audio should not run

    const nowSeconds = Tone.now()
    if (nowSeconds - missileFlybyLastStartSeconds < 0.09) {
      return
    } // end if flyby sound debounce has not elapsed

    const flybyPan = clamp(direction, -1, 1)
    const clampedSpeed = Math.max(0, speed)
    const speedNorm = clamp(clampedSpeed / 36, 0, 1)
    const baseGain = (0.16 + (speedNorm * 0.54)) * enemiesVolume
    const firstNote = 900 + (speedNorm * 560)
    const secondNote = 420 + (speedNorm * 220)

    missileFlybyPanner.pan.rampTo(flybyPan, 0.02)
    missileFlybySynth.volume.value = gainToDbSafe(baseGain)
    const firstStart = strictlyIncreasingStartTime(nowSeconds, missileFlybyLastStartSeconds)
    const secondStart = strictlyIncreasingStartTime(firstStart + 0.05, firstStart)
    missileFlybyLastStartSeconds = secondStart
    missileFlybySynth.triggerAttackRelease(firstNote, '32n', firstStart)
    missileFlybySynth.triggerAttackRelease(secondNote, '16n', secondStart)
  } // end function play_flyby_sound

  const playPlayerMechHit = (): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started

    playerMechHitBaseVoiceCursor = playFromVoicePool(playerMechHitBaseVoices, playerMechHitBaseVoiceCursor)
  } // end function playPlayerMechHit

  const playPlayerHealthStatusTone = (hpPercent: number): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started

    const normalized = clamp(hpPercent, 0, 1)
    const pitchSemitones = -14 + normalized * 30
    const baseRate = 0.68 + normalized * 0.74
    const detailFilterCutoff = normalized >= 0.6
      ? 1400
      : normalized >= 0.3
        ? 2200
        : 3200
    const detailDriveAmount = normalized >= 0.6
      ? 0.05
      : normalized >= 0.3
        ? 0.18
        : 0.34
    const cueNote = normalized >= 0.6
      ? 'E5'
      : normalized >= 0.3
        ? 'C5'
        : 'A4'
    const cueGain = normalized >= 0.6
      ? 0.12
      : normalized >= 0.3
        ? 0.2
        : 0.32

    playerMechHitDetailPitch.pitch = pitchSemitones
    playerMechHitDetailFilter.frequency.value = detailFilterCutoff
    playerMechHitDetailDrive.distortion = detailDriveAmount
    playerMechHitBasePitch.pitch = -2 + normalized * 6
    playerMechHitGain.gain.value = 0.82 + (1 - normalized) * 0.38

    for (let voiceIndex = 0; voiceIndex < playerMechHitDetailVoices.length; voiceIndex += 1) {
      const voice = playerMechHitDetailVoices[voiceIndex]
      const offset = playerMechHitDetailRateOffsets[voiceIndex]
      if (!voice || offset === undefined) {
        continue
      } // end if missing detail voice/rate offset
      setPlaybackRateSafely(voice, clamp(baseRate * offset, 0.5, 1.65))
    } // end for each detail voice

    playerMechHitDetailVoiceCursor = playFromVoicePool(playerMechHitDetailVoices, playerMechHitDetailVoiceCursor)
    healthStatusSynth.volume.value = gainToDbSafe(cueGain * masterVolume)
    healthStatusSynth.triggerAttackRelease(cueNote, '64n')
  } // end function playPlayerHealthStatusTone

  const updatePlayerHealthStatusAudio = (dt: number, hpPercent: number): void => {
    const normalized = clamp(hpPercent, 0, 1)
    const isLowHealth = normalized < 0.15

    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      lowHealthAlarmTimerSeconds = 0
      return
    } // end if audio not started

    if (!isLowHealth) {
      lowHealthAlarmTimerSeconds = 0
      return
    } // end if health not in critical zone

    const danger = clamp((0.15 - normalized) / 0.15, 0, 1)
    lowHealthAlarmTimerSeconds += dt
    const intervalSeconds = 0.52 - danger * 0.38
    if (lowHealthAlarmTimerSeconds < intervalSeconds) {
      return
    } // end if low-health alarm interval not reached
    lowHealthAlarmTimerSeconds -= intervalSeconds

    const gain = (0.22 + danger * 0.95) * masterVolume
    const frequency = 520 + danger * 420
    const now = Tone.now()
    lowHealthAlarmSynth.volume.value = gainToDbSafe(gain)
    lowHealthAlarmSynth.triggerAttackRelease(frequency, '16n', now)

    if (danger >= 0.75) {
      lowHealthAlarmSynth.triggerAttackRelease(frequency * 1.06, '32n', now + 0.08)
    } // end if critical double-pulse should play
  } // end function updatePlayerHealthStatusAudio

  const updatePlayerEnergyStatusAudio = (_dt: number, epPercent: number): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      energyStatusGain.gain.rampTo(0.001, 0.08)
      energyStatusCrackleGain.gain.rampTo(0.001, 0.08)
      return
    } // end if audio not started

    ensureEnergyStatusLoopStarted()

    const normalized = clamp(epPercent, 0, 1)
    const lowEnergyFactor = clamp((0.65 - normalized) / 0.65, 0, 1)
    const criticalFactor = clamp((0.15 - normalized) / 0.15, 0, 1)

    // Keep pitch change within +/-15% so energy state is noticeable without sounding detached.
    const playbackRate = 0.85 + (normalized * 0.30)
    setPlaybackRateSafely(energyStatusLoop, playbackRate)

    const tremoloRateHz = 0.45 + (lowEnergyFactor * 5.35)
    const tremoloDepth = 0.03 + (lowEnergyFactor * 0.86)
    energyStatusTremolo.frequency.rampTo(tremoloRateHz, 0.08)
    energyStatusTremolo.depth.rampTo(tremoloDepth, 0.08)

    energyStatusDistortion.distortion = 0.1 + (criticalFactor * 0.2)
    energyStatusDistortion.wet.rampTo(criticalFactor * 0.3, 0.08)

    const lowpassFrequencyHz = 12000 - (criticalFactor * 10800)
    energyStatusFilter.frequency.rampTo(lowpassFrequencyHz, 0.1)

    const baseGain = (0.17 + ((1 - normalized) * 0.05)) * energyStatusVolume
    energyStatusGain.gain.rampTo(baseGain, 0.08)
    energyStatusCrackleGain.gain.rampTo((0.001 + (criticalFactor * 0.045)) * energyStatusVolume, 0.08)
  } // end function updatePlayerEnergyStatusAudio

  const updatePlayerHeatStatusAudio = (_dt: number, heatPercent: number): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      heatStatusSizzleGain.gain.rampTo(0.001, 0.08)
      return
    } // end if audio not started

    ensureHeatStatusSizzleStarted()

    const normalized = clamp(heatPercent, 0, 1)
    const shaped = smoothstep01(normalized)
    const intensity = shaped * shaped

    // Heat sizzle should be subtle when cool and aggressively noisy near overheat.
    const sizzleGain = 0.001 + (intensity * 0.24)
    heatStatusSizzleGain.gain.rampTo(sizzleGain, 0.08)

    const highpassFrequencyHz = 1500 + (intensity * 2500)
    const bandpassFrequencyHz = 2400 + (intensity * 4300)
    const bandpassQ = 0.8 + (intensity * 3.8)
    heatStatusSizzleHighpass.frequency.rampTo(highpassFrequencyHz, 0.1)
    heatStatusSizzleBandpass.frequency.rampTo(bandpassFrequencyHz, 0.1)
    heatStatusSizzleBandpass.Q.rampTo(bandpassQ, 0.1)

    heatStatusSizzleDrive.distortion = 0.08 + (intensity * 0.64)
    heatStatusSizzleDrive.wet.rampTo(0.05 + (intensity * 0.9), 0.08)
  } // end function updatePlayerHeatStatusAudio

  const playPitchCenterConfirm = (): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started
    pitchCenterConfirmSynth.triggerAttackRelease('C6', '64n')
  } // end function playPitchCenterConfirm

  const playTankHitConfirm = (
    worldX: number,
    worldY: number,
    playerX: number,
    playerY: number,
    playerAngle: number
  ): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started

    const now = Tone.now()
    if (lastTankHitConfirmTimeSeconds >= 0 && (now - lastTankHitConfirmTimeSeconds) < 0.04) {
      return
    } // end if hit-confirm is being spammed this frame window
    lastTankHitConfirmTimeSeconds = now

    const pan = computePanForWorldPosition(worldX, worldY, playerX, playerY, playerAngle)
    tankHitConfirmPanner.pan.rampTo(pan, 0.01)
    tankHitConfirmGain.gain.value = enemiesVolume
    retriggerLoadedPlayer(tankHitConfirmSound)
  } // end function playTankHitConfirm

  const playTankDeathConfirm = (
    worldX: number,
    worldY: number,
    playerX: number,
    playerY: number,
    playerAngle: number
  ): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started

    const pan = computePanForWorldPosition(worldX, worldY, playerX, playerY, playerAngle)
    tankDeathConfirmPanner.pan.rampTo(pan, 0.01)
    tankDeathConfirmGain.gain.value = enemiesVolume
    retriggerLoadedPlayer(tankDeathConfirmSound)
  } // end function playTankDeathConfirm

  const playImpact = (
    worldX: number,
    worldY: number,
    playerX: number,
    playerY: number,
    playerAngle: number,
    timeOffsetSeconds = 0,
    options?: ImpactAudioOptions
  ): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started

    const now = Tone.now()
    const source = options?.source ?? 'projectile'
    const material = options?.surfaceMaterial ?? resolveWorldSurfaceMaterial(worldX, worldY)
    if (source !== 'minigun' && source !== 'suppressionAccent') {
      materialHitCounts[material] = (materialHitCounts[material] ?? 0) + 1
    }

    for (let clusterIndex = impactClusters.length - 1; clusterIndex >= 0; clusterIndex -= 1) {
      const cluster = impactClusters[clusterIndex]
      if (!cluster || (now - cluster.lastTimeSeconds) <= IMPACT_CLUSTER_RETENTION_SECONDS) {
        continue
      }
      impactClusters.splice(clusterIndex, 1)
    }

    let nearestCluster: ImpactClusterState | null = null
    let nearestClusterDistance = Number.POSITIVE_INFINITY
    for (const cluster of impactClusters) {
      const distance = Math.hypot(cluster.x - worldX, cluster.y - worldY)
      if (distance < IMPACT_CLUSTER_RADIUS && distance < nearestClusterDistance) {
        nearestCluster = cluster
        nearestClusterDistance = distance
      }
    }

    if (!nearestCluster) {
      if (impactClusters.length >= MAX_IMPACT_CLUSTERS) {
        impactClusters.shift()
      }
      nearestCluster = {
        x: worldX,
        y: worldY,
        lastTimeSeconds: now,
        recentCount: 0
      }
      impactClusters.push(nearestCluster)
    }

    nearestCluster.x = (nearestCluster.x * 0.7) + (worldX * 0.3)
    nearestCluster.y = (nearestCluster.y * 0.7) + (worldY * 0.3)
    nearestCluster.lastTimeSeconds = now
    nearestCluster.recentCount = Math.min(32, nearestCluster.recentCount + 1)

    const listenerDistance = Math.hypot(worldX - playerX, worldY - playerY)
    const distancePriority = clamp(1 - (listenerDistance / 80), 0, 1)
    const clusterPenalty = clamp((nearestCluster.recentCount - 3) / 18, 0, 1)
    const sourcePriority = source === 'suppressionAccent'
      ? 0.45
      : source === 'minigun'
        ? 0.38
        : source === 'explosion'
          ? 1
          : 0.7
    const targetPriority = options?.isPlayerEngagedTarget ? 0.3 : 0
    const enemyPriority = options?.isEnemyImpact ? 0.2 : 0
    const priorityBoost = clamp(options?.priorityBoost ?? 0, 0, 1)
    const materialPriorityBoost = source === 'projectile'
      ? clamp(MATERIAL_IMPACT_PROJECTILE_PRIORITY_BOOST[material] ?? 0, 0, 0.5)
      : 0
    const priorityScore = clamp(
      distancePriority + sourcePriority + targetPriority + enemyPriority + priorityBoost + materialPriorityBoost - (clusterPenalty * 0.65),
      0,
      1.5
    )

    if (impactPlaybackWindowSeconds <= 0) {
      impactPlaybackWindowSeconds = now
    }
    const playbackWindowElapsed = now - impactPlaybackWindowSeconds
    if (playbackWindowElapsed >= IMPACT_DENSITY_WINDOW_SECONDS) {
      impactPlaybackDensityPerSecond = impactPlaybackCountWindow / playbackWindowElapsed
      impactPlaybackCountWindow = 0
      impactPlaybackWindowSeconds = now
    }

    const underHardLimit = impactPlaybackCountWindow < IMPACT_DENSITY_WINDOW_LIMIT
    const shouldPlay = underHardLimit && (
      priorityScore > 0.82
      || source === 'explosion'
      || Math.random() < clamp(priorityScore, 0.05, 0.95)
    )

    if (!shouldPlay) {
      suppressedImpactCount += 1
      if (!underHardLimit) {
        voicePriorityDrops += 1
      }
      return
    }

    if (lastImpactTimeSeconds >= 0 && (now - lastImpactTimeSeconds) < 0.006 && source !== 'explosion') {
      suppressedImpactCount += 1
      return
    }
    lastImpactTimeSeconds = now
    impactPlaybackCountWindow += 1

    const pool = ensureImpactPool(material)
    const voiceCount = Math.max(1, pool.voices.length)
    const randomVoiceIndex = Math.floor(Math.random() * voiceCount)
    let voice = pool.voices[randomVoiceIndex] ?? pool.voices[pool.cursor]
    if (!voice) {
      voice = pool.voices[0]
    }
    pool.cursor = (pool.cursor + 1) % voiceCount

    if (!voice || !voice.loaded) {
      impactFallbackEmitter.setPosition(worldX, worldY, 0)
      impactSynth.volume.value = gainToDbSafe(objectsVolume * clamp(0.7 + (priorityScore * 0.22), 0.5, 1.15))
      impactSynth.triggerAttackRelease(220, '16n', now + timeOffsetSeconds)
      return
    }

    const pitchJitter = source === 'minigun'
      ? (Math.random() * 0.1 - 0.05)
      : (Math.random() * 0.14 - 0.07)
    const volumeJitter = source === 'minigun'
      ? (Math.random() * 0.08 - 0.05)
      : (Math.random() * 0.12 - 0.06)
    const sourceGainScale = source === 'suppressionAccent'
      ? 0.62
      : source === 'minigun'
        ? 0.55
        : 1
    const projectileGlobalGain = source === 'projectile' ? PROJECTILE_IMPACT_GLOBAL_GAIN : 1
    const projectileDistanceCompensation = source === 'projectile'
      ? 1 + (clamp(
        (listenerDistance - PROJECTILE_IMPACT_GAIN_COMPENSATION_MIN_DISTANCE)
        / Math.max(0.001, PROJECTILE_IMPACT_GAIN_COMPENSATION_MAX_DISTANCE - PROJECTILE_IMPACT_GAIN_COMPENSATION_MIN_DISTANCE),
        0,
        1
      ) * (PROJECTILE_IMPACT_GAIN_COMPENSATION_MAX_GAIN - 1))
      : 1
    const materialProjectileGainScale = source === 'projectile'
      ? clamp(MATERIAL_IMPACT_PROJECTILE_GAIN_SCALE[material] ?? 1, 0.6, 3)
      : 1

    pool.emitter.setPosition(worldX, worldY, 0)
    pool.gain.gain.value = clamp(
      objectsVolume
      * sourceGainScale
      * projectileGlobalGain
      * projectileDistanceCompensation
      * materialProjectileGainScale
      * (0.86 + volumeJitter),
      0.001,
      3
    )
    setPlaybackRateSafely(voice, 1 + pitchJitter)
    voice.volume.value = gainToDbSafe(0.94 + volumeJitter)

    try {
      if (voice.state === 'started') {
        voice.stop()
      }
      voice.start(now + Math.max(0, timeOffsetSeconds))
    } catch {
      impactFallbackEmitter.setPosition(worldX, worldY, 0)
      impactSynth.volume.value = gainToDbSafe(objectsVolume * clamp(0.68 + (priorityScore * 0.25), 0.45, 1.1))
      impactSynth.triggerAttackRelease(220, '16n', now + timeOffsetSeconds)
    }
  } // end function playImpact

  let suppressionRegionIdSequence = 0

  const getOrCreateSuppressionRegion = (
    material: SurfaceMaterial,
    worldX: number,
    worldY: number,
    worldZ: number,
    now: number
  ): SuppressionRegionRuntime | null => {
    const loopPath = SUPPRESSION_LOOP_BY_MATERIAL[material]
    if (!loopPath) {
      return null
    }

    let bestRegion: SuppressionRegionRuntime | null = null
    let bestDistance = Number.POSITIVE_INFINITY
    for (const region of suppressionRegions) {
      if (region.material !== material) {
        continue
      }
      const distance = Math.hypot(region.centroidX - worldX, region.centroidY - worldY)
      if (distance <= SUPPRESSION_REGION_MERGE_RADIUS && distance < bestDistance) {
        bestDistance = distance
        bestRegion = region
      }
    }

    if (bestRegion) {
      return bestRegion
    }

    if (suppressionRegions.length >= MAX_SUPPRESSION_REGIONS) {
      suppressionRegions.sort((a, b) => a.lastImpactTimeSeconds - b.lastImpactTimeSeconds)
      const recycled = suppressionRegions.shift()
      if (recycled) {
        try {
          recycled.loopPlayer?.stop()
        } catch {
          // Ignore stop races when reclaiming suppression slots.
        }
        recycled.emitter.dispose()
        recycled.gain.dispose()
        recycled.filter.dispose()
        recycled.loopPlayer?.dispose()
      }
    }

    const region = createSuppressionRegionRuntime(`suppression-region-${suppressionRegionIdSequence++}`, material, loopPath)
    region.centroidX = worldX
    region.centroidY = worldY
    region.centroidZ = worldZ
    region.lastImpactTimeSeconds = now
    suppressionRegions.push(region)
    return region
  }

  const ensureSuppressionLoopLoaded = (region: SuppressionRegionRuntime): Promise<void> => {
    if (!region.loopPlayer) {
      return Promise.resolve()
    }
    if (region.loopLoaded) {
      return Promise.resolve()
    }
    if (region.loopLoadingPromise) {
      return region.loopLoadingPromise
    }

    region.loopLoadingPromise = region.loopPlayer.load(region.loopPath)
      .then(() => {
        region.loopLoaded = true
      })
      .catch((error) => {
        audioDebugWarn('Failed to load suppression loop.', { regionId: region.id, path: region.loopPath, error })
      })
      .finally(() => {
        region.loopLoadingPromise = null
      })

    return region.loopLoadingPromise
  }

  const reportMinigunSuppressionImpact = (event: MinigunSuppressionImpactEvent): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    }

    const now = Tone.now()
    const worldZ = event.worldZ ?? 0
    const material = event.surfaceMaterial
    materialHitCounts[material] = (materialHitCounts[material] ?? 0) + 1
    const region = getOrCreateSuppressionRegion(material, event.worldX, event.worldY, worldZ, now)

    if (region) {
      const impactWeight = 1
        + (event.isEnemyImpact ? 0.6 : 0)
        + (event.isPlayerEngagedTarget ? 0.4 : 0)
      region.score = Math.min(20, region.score + impactWeight)
      region.impactsThisWindow = Math.min(200, region.impactsThisWindow + 1)
      region.lastImpactTimeSeconds = now
      region.nextOcclusionImportance = clamp(0.2 + (region.score * 0.03), 0.15, 1)
      const centroidBlend = clamp(0.18 + (impactWeight * 0.08), 0.2, 0.45)
      region.centroidX = (region.centroidX * (1 - centroidBlend)) + (event.worldX * centroidBlend)
      region.centroidY = (region.centroidY * (1 - centroidBlend)) + (event.worldY * centroidBlend)
      region.centroidZ = (region.centroidZ * (1 - centroidBlend)) + (worldZ * centroidBlend)
    }

    const shouldPlayTransient = region === null || region.score < SUPPRESSION_REGION_SCORE_ACTIVATION
    if (shouldPlayTransient) {
      playImpact(
        event.worldX,
        event.worldY,
        event.listenerX,
        event.listenerY,
        event.listenerAngle,
        0,
        {
          source: 'minigun',
          surfaceMaterial: material,
          isEnemyImpact: event.isEnemyImpact,
          isPlayerEngagedTarget: event.isPlayerEngagedTarget,
          priorityBoost: event.isEnemyImpact ? 0.15 : 0
        }
      )
      return
    }

    if ((now - region.lastAccentTimeSeconds) >= 0.12 && Math.random() < 0.22) {
      region.lastAccentTimeSeconds = now
      playImpact(
        event.worldX,
        event.worldY,
        event.listenerX,
        event.listenerY,
        event.listenerAngle,
        0,
        {
          source: 'suppressionAccent',
          surfaceMaterial: material,
          isEnemyImpact: event.isEnemyImpact,
          isPlayerEngagedTarget: event.isPlayerEngagedTarget,
          priorityBoost: 0.08
        }
      )
    }
  }

  const startServo = (): void => {
    if (audioPaused || servoPlaying) {
      return
    } // end if servo already playing

    servoPlaying = true
    servoAudio.currentTime = 0
    void servoAudio.play().catch(() => undefined)
  } // end function startServo

  const stopServo = (): void => {
    if (!servoPlaying) {
      return
    } // end if servo not playing

    servoPlaying = false
    servoAudio.pause()
    servoAudio.currentTime = 0
  } // end function stopServo

  const playFootstep = (terrainLayer: FootstepTerrainLayer = 'default'): void => {
    if (!audioStarted || audioPaused) {
      return
    } // end if audio not started

    footstepAudio.currentTime = 0
    void footstepAudio.play().catch(() => undefined)

    const terrainStepAudios = getTerrainStepAudios(terrainLayer)
    if (terrainStepAudios.length > 0) {
      const randomIndex = Math.floor(Math.random() * terrainStepAudios.length)
      const terrainStep = terrainStepAudios[randomIndex]
      if (terrainStep) {
        terrainStep.currentTime = 0
        void terrainStep.play().catch(() => undefined)
      }
    }
  } // end function playFootstep

  const stopFootstep = (): void => {
    if (!audioStarted) {
      return
    } // end if audio not started

    footstepAudio.pause()
    footstepAudio.currentTime = 0
  } // end function stopFootstep

  const resolveActiveMobilityMode = (mobilityType: PlayerMobilityType, grounded: boolean): PlayerMobilityType => {
    if (mobilityType === 'Flight') {
      return 'Flight'
    } // end if flight mode always uses thruster contract
    return grounded ? mobilityType : 'Placeholder'
  } // end function resolveActiveMobilityMode

  const getMobilitySpecificEvent = (mode: PlayerMobilityType, semanticEvent: BaseMovementEventId): MovementAudioEventId | null => {
    if (mode === 'Wheels') {
      if (semanticEvent === 'move_idle') return 'wheel_idle'
      if (semanticEvent === 'move_loop' || semanticEvent === 'move_start') return 'wheel_roll'
      if (semanticEvent === 'move_accelerate') return 'wheel_accelerate'
      if (semanticEvent === 'move_decelerate') return 'wheel_brake'
      if (semanticEvent === 'move_skid') return 'wheel_skid'
    }

    if (mode === 'Treads') {
      if (semanticEvent === 'move_idle') return 'tread_idle'
      if (semanticEvent === 'move_loop' || semanticEvent === 'move_start') return 'tread_roll'
      if (semanticEvent === 'move_accelerate') return 'tread_turn'
      if (semanticEvent === 'move_decelerate' || semanticEvent === 'move_skid') return 'tread_brake'
    }

    if (mode === 'Hover') {
      if (semanticEvent === 'move_idle') return 'hover_idle'
      if (semanticEvent === 'move_loop' || semanticEvent === 'move_start') return 'hover_move'
      if (semanticEvent === 'move_accelerate' || semanticEvent === 'move_decelerate') return 'hover_strafe'
      if (semanticEvent === 'move_boost') return 'hover_boost'
    }

    if (mode === 'Walker') {
      if (semanticEvent === 'move_idle') return 'servo_idle'
      if (semanticEvent === 'move_loop' || semanticEvent === 'move_start') return 'servo_step'
      if (semanticEvent === 'move_accelerate' || semanticEvent === 'move_decelerate') return 'servo_turn'
      if (semanticEvent === 'move_boost') return 'servo_jump'
    }

    if (mode === 'Flight') {
      if (semanticEvent === 'move_start') return 'thruster_start'
      if (semanticEvent === 'move_loop' || semanticEvent === 'move_boost') return 'thruster_loop'
      if (semanticEvent === 'move_stop') return 'thruster_stop'
    }

    return null
  } // end function getMobilitySpecificEvent

  const emitSemanticMovementEvent = (eventId: MovementAudioEventId): void => {
    if (!MOVEMENT_EVENT_CONTRACT_SET.has(eventId)) {
      return
    } // end if event is outside ticket movement contract

    // Event emission currently drives placeholder movement synthesis only.
    if (eventId === 'move_stop') {
      mobilityPlaceholderMasterGain.gain.rampTo(0, 0.1)
    }
  } // end function emitSemanticMovementEvent

  const updatePlayerMobilityAudio = (
    mobilityType: PlayerMobilityType,
    normalizedSpeed: number,
    normalizedForward: number,
    accelerating: boolean,
    grounded: boolean
  ): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      mobilityPlaceholderMasterGain.gain.rampTo(0, 0.04)
      return
    } // end if mobility placeholder audio cannot update

    ensureMobilityPlaceholderSourcesStarted()

    const clampedSpeed = clamp(normalizedSpeed, 0, 1)
    const clampedForward = clamp(normalizedForward, -1, 1)
    const activeMode = resolveActiveMobilityMode(mobilityType, grounded)
    const usePlaceholderLayer = activeMode === 'Wheels' || activeMode === 'Treads' || activeMode === 'Hover' || activeMode === 'Flight'
    const targetMasterGain = usePlaceholderLayer
      ? clamp((0.08 + (clampedSpeed * 0.3) + (accelerating ? 0.06 : 0)) * masterVolume * footstepsVolume, 0, 0.9)
      : 0
    mobilityPlaceholderMasterGain.gain.rampTo(targetMasterGain, 0.08)

    wheelMobilityGain.gain.rampTo(activeMode === 'Wheels' ? 1 : 0, 0.09)
    treadMobilityGain.gain.rampTo(activeMode === 'Treads' ? 1 : 0, 0.09)
    hoverMobilityGain.gain.rampTo(activeMode === 'Hover' ? 1 : 0, 0.09)
    walkerMobilityGain.gain.rampTo(activeMode === 'Walker' ? 1 : 0, 0.09)
    flightMobilityGain.gain.rampTo(activeMode === 'Flight' ? 1 : 0, 0.09)

    const pitchScale = clamp(debugPitchScale, 0.6, 1.8)
    const speedCurve = Math.pow(clampedSpeed, 0.55)
    const wheelIdleLevel = clamp(0.08 + ((1 - speedCurve) * 0.14) + (accelerating ? 0.015 : 0), 0, 0.22)
    const wheelDriveLevel = clamp(0.04 + (speedCurve * 0.24) + (accelerating ? 0.05 : 0), 0, 0.42)
    const wheelSkidLevel = clampedForward < -0.08
      ? 0.02 + (Math.abs(clampedForward) * 0.11)
      : (!accelerating && clampedSpeed > 0.12 ? 0.01 + (clampedSpeed * 0.04) : 0)

    wheelMobilityIdleOsc.frequency.rampTo((48 + (speedCurve * 36)) * pitchScale, 0.08)
    wheelMobilityPitchOsc.frequency.rampTo((92 + (speedCurve * 240) + (accelerating ? 28 : 0)) * pitchScale, 0.08)
    wheelMobilityIdleGain.gain.rampTo(wheelIdleLevel * masterVolume * footstepsVolume, 0.08)
    wheelMobilityPitchGain.gain.rampTo(wheelDriveLevel * masterVolume * footstepsVolume, 0.08)
    wheelMobilitySkidGain.gain.rampTo(wheelSkidLevel * masterVolume * footstepsVolume, 0.07)
    wheelMobilityIdleFilter.frequency.rampTo(170 + (clampedSpeed * 70) + (accelerating ? 28 : 0), 0.08)
    wheelMobilityPitchFilter.frequency.rampTo(360 + (clampedSpeed * 920) + (accelerating ? 160 : 0), 0.09)
    wheelMobilitySkidFilter.frequency.rampTo(1300 + (clampedSpeed * 1300) + (accelerating ? 180 : 0), 0.09)

    treadMobilityPulseOsc.frequency.rampTo((8 + (clampedSpeed * 26) + (accelerating ? 4 : 0)) * pitchScale, 0.08)
    treadMobilityPulseGain.gain.rampTo(0.09 + (clampedSpeed * 0.18), 0.08)
    treadMobilityNoiseFilter.frequency.rampTo(95 + (clampedSpeed * 190) + (accelerating ? 45 : 0), 0.1)

    hoverMobilityOsc.frequency.rampTo((125 + (clampedSpeed * 140) + (accelerating ? 25 : 0)) * pitchScale, 0.09)
    hoverMobilityTremolo.frequency.rampTo(4 + (clampedSpeed * 11), 0.1)
    hoverMobilityHissGain.gain.rampTo(0.02 + (clampedSpeed * 0.09) + (accelerating ? 0.03 : 0), 0.09)

    walkerMobilityStepOsc.frequency.rampTo((2.2 + (clampedSpeed * 8) + (accelerating ? 0.8 : 0)) * pitchScale, 0.08)
    walkerMobilityBodyGain.gain.rampTo((0.018 + (clampedSpeed * 0.12)) * masterVolume * footstepsVolume, 0.08)
    walkerMobilityBodyFilter.frequency.rampTo(420 + (clampedSpeed * 680), 0.09)

    flightMobilityToneOsc.frequency.rampTo((135 + (clampedSpeed * 420) + (accelerating ? 70 : 0)) * pitchScale, 0.08)
    flightMobilityToneGain.gain.rampTo((0.02 + (clampedSpeed * 0.05) + (accelerating ? 0.02 : 0)) * masterVolume * footstepsVolume, 0.08)
    flightMobilityNoiseGain.gain.rampTo((0.02 + (clampedSpeed * 0.1) + (accelerating ? 0.03 : 0)) * masterVolume * footstepsVolume, 0.08)
    flightMobilityNoiseFilter.frequency.rampTo(1200 + (clampedSpeed * 1900) + (accelerating ? 200 : 0), 0.1)

    const moving = clampedSpeed > 0.05
    if (!movementSemanticState.initialized || movementSemanticState.activeMode !== activeMode) {
      if (movementSemanticState.initialized && movementSemanticState.wasMoving) {
        emitSemanticMovementEvent('move_stop')
      } // end if prior mode was moving
      movementSemanticState.initialized = true
      movementSemanticState.activeMode = activeMode
      movementSemanticState.wasMoving = false
      movementSemanticState.wasAccelerating = false
    } // end if mobility mode changed

    if (moving && !movementSemanticState.wasMoving) {
      emitSemanticMovementEvent('move_start')
      const specificStart = getMobilitySpecificEvent(activeMode, 'move_start')
      if (specificStart) {
        emitSemanticMovementEvent(specificStart)
      }
    }

    if (!moving && movementSemanticState.wasMoving) {
      emitSemanticMovementEvent('move_stop')
      const specificStop = getMobilitySpecificEvent(activeMode, 'move_stop')
      if (specificStop) {
        emitSemanticMovementEvent(specificStop)
      }
    }

    emitSemanticMovementEvent(moving ? 'move_loop' : 'move_idle')
    const mobilityIdleOrLoop = getMobilitySpecificEvent(activeMode, moving ? 'move_loop' : 'move_idle')
    if (mobilityIdleOrLoop) {
      emitSemanticMovementEvent(mobilityIdleOrLoop)
    }

    if (accelerating && !movementSemanticState.wasAccelerating) {
      emitSemanticMovementEvent('move_accelerate')
      const specificAccelerate = getMobilitySpecificEvent(activeMode, 'move_accelerate')
      if (specificAccelerate) {
        emitSemanticMovementEvent(specificAccelerate)
      }
    }

    if (!accelerating && movementSemanticState.wasAccelerating && moving) {
      emitSemanticMovementEvent('move_decelerate')
      const specificDecelerate = getMobilitySpecificEvent(activeMode, 'move_decelerate')
      if (specificDecelerate) {
        emitSemanticMovementEvent(specificDecelerate)
      }
    }

    if (moving && clampedForward < -0.12) {
      emitSemanticMovementEvent('move_skid')
      const specificSkid = getMobilitySpecificEvent(activeMode, 'move_skid')
      if (specificSkid) {
        emitSemanticMovementEvent(specificSkid)
      }
    }

    if (accelerating && moving && clampedSpeed > 0.7) {
      emitSemanticMovementEvent('move_boost')
      const specificBoost = getMobilitySpecificEvent(activeMode, 'move_boost')
      if (specificBoost) {
        emitSemanticMovementEvent(specificBoost)
      }
    }

    movementSemanticState.wasMoving = moving
    movementSemanticState.wasAccelerating = accelerating
    movementSemanticState.wasGrounded = grounded
  } // end function updatePlayerMobilityAudio

  const playBump = (): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started
    if (!categoryProximity) {
      return
    } // end if proximity category disabled
    playCollisionThudUtility(0, proximityVolume)
  } // end function playBump

  const playCollisionThud = (direction: number): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started

    if (!categoryProximity) {
      return
    } // end if proximity category disabled
    playCollisionThudUtility(direction, proximityVolume)
  } // end function playCollisionThud

  const playCardinalOrientationCue = (newFacing: number): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started

    if (!categoryNavigation) {
      return
    } // end if navigation category disabled
    playCardinalOrientationCueUtility(newFacing, navigationVolume)
  } // end function playCardinalOrientationCue

  const updatePassiveRadar = (dt: number): void => {
    passiveRadarTimerSeconds = Math.max(0, passiveRadarTimerSeconds - dt)
    void passiveRadarSweepSynth
  } // end function updatePassiveRadar

  const updateRadarDetection = (player: PlayerAudioState, enemies: EnemyAudioState[]): void => {
    if (!categoryEnemies) {
      radarDetectionGain.gain.rampTo(0, 0.2)
      return
    } // end if enemies category disabled

    const nearExclusionRange = AUDIO_NAVIGATION_CONFIG.radarNearExclusionRange
    const detectionRange = AUDIO_NAVIGATION_CONFIG.radarDetectionRange

    const contacts = enemies.filter((enemy) => {
      if (!enemy.isAlive) {
        return false
      } // end if enemy is dead
      const dist = Math.hypot(
        enemy.position.x - player.position.x,
        enemy.position.y - player.position.y,
        enemy.position.z - player.position.z
      )
      const inRange = dist > nearExclusionRange && dist <= detectionRange
      if (inRange) {
        audioDebugLog(`[RADAR] Contact: id=${enemy.id}, type=${enemy.type}, dist=${dist.toFixed(1)}, range=[${nearExclusionRange}, ${detectionRange}]`)
      } // end if log radar contact
      return inRange
    })

    audioDebugLog(`[RADAR] Frame: totalEnemies=${enemies.length}, contacts=${contacts.length}, playerPos=(${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)})`)

    if (contacts.length === 0) {
      radarDetectionGain.gain.rampTo(0, 0.4)
      return
    } // end if no radar contacts this frame

    // Compute inverse-distance-weighted center of mass for the cluster.
    let sumX = 0
    let sumY = 0
    let sumZ = 0
    let totalWeight = 0
    for (const contact of contacts) {
      const dist = Math.hypot(
        contact.position.x - player.position.x,
        contact.position.y - player.position.y,
        contact.position.z - player.position.z
      )
      const weight = 1 / Math.max(dist, 0.1)
      sumX += contact.position.x * weight
      sumY += contact.position.y * weight
      sumZ += contact.position.z * weight
      totalWeight += weight
    } // end for each radar contact

    const centerX = sumX / totalWeight
    const centerY = sumY / totalWeight
    const centerZ = sumZ / totalWeight

    const clusterDist = Math.hypot(
      centerX - player.position.x,
      centerY - player.position.y,
      centerZ - player.position.z
    )

    if (!Number.isFinite(clusterDist)) {
      radarDetectionGain.gain.rampTo(0, 0.2)
      return
    } // end if cluster distance is invalid

    // Pan only by left-right bearing so the radar cue does not lose level with range.
    const listenerPos = worldToListenerSpace(
      { x: centerX, y: centerY, z: centerZ },
      player.position,
      player.angle
    )
    const listenerMag = Math.hypot(listenerPos.x, listenerPos.y, listenerPos.z)
    if (listenerMag > 0.001) {
      const stereoPan = clamp(listenerPos.x / listenerMag, -1, 1)
      radarDetectionPanner.pan.rampTo(stereoPan, 0.12)
    } else {
      radarDetectionPanner.pan.rampTo(0, 0.12)
    } // end if listener position has nonzero magnitude

    // Pitch = closeness: farther cluster yields lower tone.
    const rangeSpan = Math.max(detectionRange - nearExclusionRange, 1)
    const distFraction = clamp(1 - (clusterDist - nearExclusionRange) / rangeSpan, 0, 1)
    const targetFreq = clamp(
      AUDIO_NAVIGATION_CONFIG.radarPitchFar + (AUDIO_NAVIGATION_CONFIG.radarPitchNear - AUDIO_NAVIGATION_CONFIG.radarPitchFar) * distFraction,
      Math.min(AUDIO_NAVIGATION_CONFIG.radarPitchFar, AUDIO_NAVIGATION_CONFIG.radarPitchNear),
      Math.max(AUDIO_NAVIGATION_CONFIG.radarPitchFar, AUDIO_NAVIGATION_CONFIG.radarPitchNear)
    )
    radarDetectionOsc.frequency.rampTo(targetFreq, 0.25)

    // Tremolo rate = density: more enemies pulse faster.
    const countFraction = clamp((contacts.length - 1) / 9, 0, 1)
    const tremoloRate = AUDIO_NAVIGATION_CONFIG.radarTremoloMin + (AUDIO_NAVIGATION_CONFIG.radarTremoloMax - AUDIO_NAVIGATION_CONFIG.radarTremoloMin) * countFraction
    radarDetectionTremolo.frequency.rampTo(tremoloRate, 0.3)

    const targetGain = clamp(AUDIO_NAVIGATION_CONFIG.radarGain * enemiesVolume, 0, 0.35)
    audioDebugLog(`[RADAR] Cluster: clusterDist=${clusterDist.toFixed(1)}, freq=${targetFreq.toFixed(1)}, tremolo=${tremoloRate.toFixed(2)}, gain=${targetGain.toFixed(3)}, enemiesVolume=${enemiesVolume.toFixed(2)}`)
    radarDetectionGain.gain.rampTo(targetGain, 0.3)
  } // end function updateRadarDetection

  const updateAimAssist = (dt: number, player: PlayerAudioState, enemies: EnemyAudioState[]): void => {
    const safeDt = Number.isFinite(dt) ? dt : 0
    aimAssistCueTimerSeconds = Math.max(0, aimAssistCueTimerSeconds - safeDt)

    if (!aimAssistEnabled || !categoryEnemies) {
      aimAssistCueTimerSeconds = 0
      return
    } // end if aim assist tracking is disabled

    const trackingRange = Math.min(AUDIO_NAVIGATION_CONFIG.radarDetectionRange, 42)

    let bestEnemy: EnemyAudioState | null = null
    let bestScore = Number.NEGATIVE_INFINITY
    let bestDistance = Number.POSITIVE_INFINITY
    let bestBearingDelta = 0

    for (const enemy of enemies) {
      if (!enemy.isAlive) {
        continue
      } // end if enemy is dead

      const dx = enemy.position.x - player.position.x
      const dy = enemy.position.y - player.position.y
      const dz = enemy.position.z - player.position.z
      const distance = Math.hypot(dx, dy, dz)
      if (distance > trackingRange) {
        continue
      } // end if enemy is outside tracking range

      const bearingDelta = normalizeAngle(Math.atan2(dy, dx) - player.angle)
      const alignment = 1 - clamp(Math.abs(bearingDelta) / Math.PI, 0, 1)
      const proximity = 1 - clamp(distance / trackingRange, 0, 1)
      const score = alignment * 0.72 + proximity * 0.28
      if (score <= bestScore) {
        continue
      } // end if current enemy is not a better tracking candidate

      bestEnemy = enemy
      bestScore = score
      bestDistance = distance
      bestBearingDelta = bearingDelta
    } // end for each enemy

    if (!bestEnemy) {
      aimAssistCueTimerSeconds = 0
      return
    } // end if no enemy is suitable for aim-assist tracking

    const relative = worldToListenerSpace(bestEnemy.position, player.position, player.angle)
    const relativeMagnitude = Math.hypot(relative.x, relative.y, relative.z)
    const stereoPan = relativeMagnitude > 0.001
      ? clamp(relative.x / relativeMagnitude, -1, 1)
      : 0
    const normalizedDistance = clamp(bestDistance / trackingRange, 0, 1)
    const closeness = 1 - normalizedDistance
    const alignmentStrength = 1 - clamp(Math.abs(bestBearingDelta) / (Math.PI * 0.75), 0, 1)

    aimAssistPanner.pan.rampTo(stereoPan, 0.05)
    aimAssistFilter.frequency.rampTo(850 + closeness * 2400, 0.08)

    if (aimAssistCueTimerSeconds > 0) {
      return
    } // end if aim assist ping interval has not elapsed

    const baseFrequencyUnclamped = AUDIO_NAVIGATION_CONFIG.radarPitchFar
      + (AUDIO_CONFIG.player.aimAssistMaxFrequency - AUDIO_NAVIGATION_CONFIG.radarPitchFar) * Math.pow(closeness, 0.7)
    const baseFrequency = clamp(baseFrequencyUnclamped, 180, 900)
    const secondFrequency = clamp(baseFrequency * (1.16 + alignmentStrength * 0.08), 220, 980)
    const cueGain = clamp((0.06 + closeness * 0.12 + alignmentStrength * 0.08) * enemiesVolume, 0, 0.32)
    const firstStart = strictlyIncreasingStartTime(Tone.now(), aimAssistTrackingLastStartSeconds)
    const secondStart = strictlyIncreasingStartTime(firstStart + 0.14, firstStart)

    aimAssistTrackingLastStartSeconds = secondStart
    aimAssistGain.gain.value = cueGain
    aimAssistTrackingSynth.volume.value = gainToDbSafe(1)
    aimAssistTrackingSynth.triggerAttackRelease(baseFrequency, '32n', firstStart)
    aimAssistTrackingSynth.triggerAttackRelease(secondFrequency, '16n', secondStart)
    aimAssistCueTimerSeconds = 1
    void aimAssistProjectileRadius
  } // end function updateAimAssist

  const updateObstructionAwareness = (dt: number, awareness: ObstructionAwareness): void => {
    obstructionCueCooldownSeconds = Math.max(0, obstructionCueCooldownSeconds - dt)
    obstructionWasBlocked = awareness.isBlocked && awareness.hasTarget
  } // end function updateObstructionAwareness

  const updateBoundaryZoneCue = (distanceToBoundary: number, dt: number): void => {
    if (!categoryNavigation) {
      return
    } // end if navigation category disabled
    boundaryWarningTimerSeconds = Math.max(0, boundaryWarningTimerSeconds - dt)
    boundaryPulseCooldownSeconds = Math.max(0, boundaryPulseCooldownSeconds - dt)
    void distanceToBoundary
    void boundaryWarningSynth
    void boundaryUrgencySynth
  } // end function updateBoundaryZoneCue

  const toggleCategory = (name: AudioCategory): boolean => {
    return setCategoryEnabled(name, !getCategoryEnabled(name))
  } // end function toggleCategory

  const getCategoryEnabled = (name: AudioCategory): boolean => {
    if (name === 'proximity') return categoryProximity
    if (name === 'objects') return categoryObjects
    if (name === 'enemies') return categoryEnemies
    return categoryNavigation
  } // end function getCategoryEnabled

  const getOrCreateEnemyRuntime = (enemyId: string, enemyType: string, overrides?: EnemySoundOverrides): EnemyAudioRuntime => {
    const existing = enemyRuntimes.get(enemyId)
    if (existing) {
      const typeChanged = existing.profile.type !== enemyType
      const pauseChanged = overrides?.loopSoundPauseIntervalMs !== undefined &&
        existing.profile.params.loopSoundPauseIntervalMs !== overrides.loopSoundPauseIntervalMs
      const maxDistanceChanged = overrides?.loopSoundMaxDistance !== undefined &&
        existing.profile.params.loopSoundMaxDistance !== overrides.loopSoundMaxDistance
      const stationaryChanged = overrides?.stopLoopSoundWhileStationary !== undefined &&
        existing.profile.params.stopLoopSoundWhileStationary !== overrides.stopLoopSoundWhileStationary
      const loopPathChanged = overrides?.positionalLoopSound !== undefined &&
        existing.profile.loopSoundPath !== overrides.positionalLoopSound
      if (typeChanged || pauseChanged || maxDistanceChanged || stationaryChanged || loopPathChanged) {
        existing.dispose()
        enemyRuntimes.delete(enemyId)
      } else {
        return existing
      } // end if runtime params match
    } // end if runtime already exists

    let profile: EnemyAudioProfile
    try {
      profile = createEnemyProfile(enemyId, enemyType, createWorldEmitter, overrides)
    } catch (error) {
      // Keep frame-audio updates alive when a late-loaded enemy clip fails to fetch.
      audioDebugWarn('Enemy audio asset load failed, using silent fallback runtime.', { enemyId, enemyType, error })
      profile = createFallbackEnemyProfile(enemyId, enemyType, createWorldEmitter)
    }

    const runtime = new EnemyAudioRuntime(profile)
    runtime.initializeLoops()
    enemyRuntimes.set(enemyId, runtime)
    return runtime
  } // end function getOrCreateEnemyRuntime

  let prewarmRequested = false
  const prewarmEnemyAudioAssets = (): void => {
    if (prewarmRequested) {
      return
    } // end if prewarm already requested
    prewarmRequested = true

    for (const path of ENEMY_AUDIO_PREWARM_PATHS) {
      const tempPlayer = new Tone.Player(path)
      void tempPlayer
        .load(path)
        .catch((error) => {
          audioDebugWarn('Failed to prewarm enemy audio asset.', { path, error })
        })
        .finally(() => {
          tempPlayer.dispose()
        })
    } // end for each enemy prewarm asset
  } // end function prewarmEnemyAudioAssets

  return {
    ensureAudio,
    playPauseOpenChirp,
    playPauseCloseChirp,
    pauseAllAudio,
    resumeAllAudio,
    startServo,
    stopServo,
    setServoMotionIntensity,
    playFootstep,
    stopFootstep,
    updatePlayerMobilityAudio,
    playBump,
    startFlightLoop,
    stopFlightLoop,
    updateFlightLoopAudio,
    startBoostAudio,
    stopBoostAudio,
    playHardLanding,
    playCollisionThud,
    playPitchCenterConfirm,
    fireGunshot,
    startMinigunFiringLoop,
    stopMinigunFiringLoop,
    isMinigunLoopActive,
    playWeaponReloadSequence,
    playCardinalOrientationCue,
    setAimAssistEnabled,
    isAimAssistEnabled: () => aimAssistEnabled,
    updateFrameAudio,
    updateNavigationDestinationCue,
    triggerActiveSonar,
    playEnemyThreatCue,
    playEnemyAttack,
    playEnemyHurt,
    playEnemyDeath,
    updateObstructionAwareness,
    updateBoundaryZoneCue,
    emitEnvironmentalSonar,
    playTankHitConfirm,
    playTankDeathConfirm,
    playImpact,
    reportMinigunSuppressionImpact,
    playPlayerMechHit,
    playPlayerHealthStatusTone,
    updatePlayerHealthStatusAudio,
    updatePlayerEnergyStatusAudio,
    updatePlayerHeatStatusAudio,
    setOcclusionDebugLogging: (enabled: boolean) => {
      audioOcclusionSystem.setDebugLogging(enabled)
    },
    setOcclusionDebugVisualizationHook: (hook) => {
      audioOcclusionSystem.setDebugVisualizationHook(hook)
    },
    getOcclusionDiagnostics: (emitterId) => audioOcclusionSystem.getEmitterDiagnostics(emitterId),
    getAllOcclusionDiagnostics: () => audioOcclusionSystem.getAllDiagnostics(),
    setFrontBackEnhancementEnabled: (enabled: boolean) => {
      spatialScene.setFrontBackEnhancementEnabled(enabled)
    },
    isFrontBackEnhancementEnabled: () => spatialScene.isFrontBackEnhancementEnabled(),
    setFrontBackRearCueLayerEnabled: (enabled: boolean) => {
      spatialScene.setFrontBackRearCueLayerEnabled(enabled)
    },
    isFrontBackRearCueLayerEnabled: () => spatialScene.isFrontBackRearCueLayerEnabled(),
    setFrontBackEnhancementIntensity: (intensity: number) => {
      spatialScene.setFrontBackEnhancementIntensity(intensity)
      return spatialScene.getFrontBackEnhancementIntensity()
    },
    getFrontBackEnhancementIntensity: () => spatialScene.getFrontBackEnhancementIntensity(),
    setFrontBackDebugLogging: (enabled: boolean) => {
      spatialScene.setFrontBackDebugLogging(enabled)
      spatialScene.setListenerDebugLogging(enabled)
    },
    getFrontBackSettings,
    getFrontBackDiagnostics,
    getAllFrontBackDiagnostics,
    getAudioDiagnostics: () => ({
      activeEnemyRuntimes: enemyRuntimes.size,
      occlusionEmitters: audioOcclusionSystem.getAllDiagnostics().length,
      minigunLoopNodes: (minigunLoopMode === 'sustain' ? 1 : 0)
        + (minigunSpinUpPlayer.state === 'started' ? 1 : 0)
        + (minigunSpinDownPlayer.state === 'started' ? 1 : 0),
      activeSuppressionRegions: suppressionRegions.length,
      activeSuppressionLoops: suppressionRegions.filter((region) => region.active).length,
      impactClusterCount: impactClusters.length,
      suppressedImpacts: suppressedImpactCount,
      activeImpactEmitters: materialImpactPools.size,
      impactPlaybackDensityPerSecond,
      voicePriorityDrops,
      materialHitCounts: {
        dirt: materialHitCounts.dirt,
        stone: materialHitCounts.stone,
        wood: materialHitCounts.wood,
        metal: materialHitCounts.metal,
        water: materialHitCounts.water,
        energy: materialHitCounts.energy,
        shield: materialHitCounts.shield,
        flesh: materialHitCounts.flesh,
        unknown: materialHitCounts.unknown
      }
    }),
    updateIncomingProjectileAudio,
    play_missile_warning,
    stop_missile_warning,
    play_flyby_sound,
    playProjectileNearMiss,
    isAudioStarted: () => audioStarted,
    getAudioContextState,
    isServoPlaying: () => servoPlaying,
    toggleCategory,
    setCategoryEnabled,
    getCategoryEnabled,
    setVolumeChannel,
    getVolumeChannel,
    setDebugPitchScale,
    getDebugPitchScale,
    setMusicTrack,
    getMusicTrack,
    getMusicTracks,
    playLockOnChirp,
    playLockLostChirp,
    playMissileLockTone,
    playMissileLockConfirmTone,
    updateTargetLockProgressAudio,
    resetTargetLockProgressAudio,
    playNegativeActionTone,
    playExplosion,
    playCardinalHeadingCueForFacing: (playerAngle: number) => playCardinalHeadingCue(playerAngle),
    prewarmEnemyAudioAssets
  } // end object audio controller
} // end function createAudioController

