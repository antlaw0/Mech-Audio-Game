import * as Tone from 'tone'
import { AUDIO_CONFIG, AUDIO_NAVIGATION_CONFIG } from './audio-config.js'
import {
  clamp,
  distanceToFilter,
  distanceToVolume,
  filterClosest,
  findNearestObstacleContact,
  getBearing,
  hasLineOfSight,
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
import type { AudioCategory, AudioController, AudioVolumeChannel, EnemyAudioState, IncomingProjectileAudioState, ObstructionAwareness, PlayerAudioState, SonarEcho, SpriteObject } from './types.js'
import { type WorldCollisionWorld } from './world-collision.js'

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
  panner: Tone.Panner3D
} // end interface EnemyEffects

interface EnemyAudioParams {
  baseVolume: number
  passivePingRateMs: number
  movementVariance: number
  threatCueDelayMs: number
} // end interface EnemyAudioParams

interface EnemyAudioProfile {
  id: string
  type: string
  category: string
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
  player: Tone.Player
  gain: Tone.Gain
  panner: Tone.Panner3D
} // end interface IncomingProjectileVoice

interface CardinalHeadingCue {
  id: 'north' | 'east' | 'south' | 'west'
  angle: number
  path: string
} // end interface CardinalHeadingCue

class EnemyAudioRuntime {
  readonly profile: EnemyAudioProfile

  private readonly idleGain: Tone.Gain
  private readonly movementGain: Tone.Gain
  private readonly oneshotGain: Tone.Gain
  private readonly turnCueSynth: Tone.Synth
  private readonly radarEchoSynth: Tone.FMSynth
  private lastFacingAngle = 0
  private passivePingTimerSeconds = 0
  private turnCueCooldownSeconds = 0
  private attackDuckingTimerSeconds = 0
  private losTickCooldownSeconds = 0
  private activeSonarStamp = -1
  private alive = true
  private lastTurnCueTime = -1

  constructor(profile: EnemyAudioProfile) {
    this.profile = profile

    this.idleGain = new Tone.Gain(0)
    this.movementGain = new Tone.Gain(0)
    this.oneshotGain = new Tone.Gain(1)

    profile.sounds.idleLoop.loop = true
    profile.sounds.movementLoop.loop = true

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
    profile.effects.gain.connect(profile.effects.panner)

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

    this.lastFacingAngle = 0
    this.passivePingTimerSeconds = this.randomPassiveIntervalSeconds()
  } // end constructor

  initializeLoops(): void {
    // Start once and keep running so enemy loops remain trackable in 3D space.
    this.safeStart(this.profile.sounds.movementLoop)
    this.idleGain.gain.rampTo(0, AUDIO_CONFIG.enemy.idleFadeSeconds)
    this.movementGain.gain.rampTo(1, AUDIO_CONFIG.enemy.movementFadeSeconds)
  } // end method initializeLoops

  updateAudio(dt: number, enemy: EnemyAudioState, player: PlayerAudioState, hasSightLine: boolean, volumeScale: number): void {
    // Keep trying to start the loop until its buffer is loaded; safeStart is idempotent.
    this.safeStart(this.profile.sounds.movementLoop)

    const relative = worldToListenerSpace(enemy.position, player.position, player.angle)
    this.profile.effects.panner.positionX.value = relative.x
    this.profile.effects.panner.positionY.value = relative.y
    this.profile.effects.panner.positionZ.value = relative.z

    const distance = Math.hypot(relative.x, relative.y, relative.z)
    const distanceVolume = distanceToVolume(distance, AUDIO_NAVIGATION_CONFIG.enemyAudioMaxDistance)
    const targetVolume = distance <= AUDIO_NAVIGATION_CONFIG.enemyAudioMaxDistance
      ? this.profile.params.baseVolume * Math.pow(distanceVolume, AUDIO_NAVIGATION_CONFIG.enemyAudioDistanceExponent) * volumeScale
      : 0
    this.profile.effects.gain.gain.rampTo(targetVolume, 0.08)

    const filterTarget = (
      hasSightLine
        ? distanceToFilter(distance)
        : Math.max(240, distanceToFilter(distance) * 0.42)
    ) + enemy.height * AUDIO_CONFIG.enemy.altitudeFilterScale
    this.profile.effects.filter.frequency.rampTo(filterTarget, 0.08)

    const isHelicopter = this.profile.type === AUDIO_CONFIG.helicopter.type
    if (!isHelicopter) {
      this.setPlaybackRateSafely(
        this.profile.sounds.movementLoop,
        clamp(0.9 + Math.hypot(enemy.velocity.x, enemy.velocity.y, enemy.velocity.z) * 0.08, 0.9, 1.35)
      )
    } // end if non-helicopter movement rate

    this.idleGain.gain.rampTo(0, AUDIO_CONFIG.enemy.idleFadeSeconds)
    this.movementGain.gain.rampTo(enemy.isAlive ? 1 : 0, AUDIO_CONFIG.enemy.movementFadeSeconds)

    const facingDelta = Math.abs(normalizeAngle(enemy.facingAngle - this.lastFacingAngle))
    if (facingDelta > AUDIO_CONFIG.enemy.turnCueThresholdRadians && this.turnCueCooldownSeconds <= 0 && enemy.isAlive) {
      this.triggerTurnCue('G5', '32n')
      this.turnCueCooldownSeconds = AUDIO_CONFIG.enemy.turnCueCooldownSeconds
    } // end if turn cue should play

    this.turnCueCooldownSeconds = Math.max(0, this.turnCueCooldownSeconds - dt)
    this.attackDuckingTimerSeconds = Math.max(0, this.attackDuckingTimerSeconds - dt)
    this.losTickCooldownSeconds = Math.max(0, this.losTickCooldownSeconds - dt)
    this.lastFacingAngle = enemy.facingAngle

    if (enemy.isAlive && hasSightLine && distance <= AUDIO_NAVIGATION_CONFIG.enemyAudioMaxDistance && this.losTickCooldownSeconds <= 0) {
      this.triggerTurnCue('B5', '64n')
      this.losTickCooldownSeconds = AUDIO_NAVIGATION_CONFIG.losTickIntervalSeconds
    } // end if line-of-sight cue should play

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
    this.profile.effects.panner.dispose()
  } // end method dispose

  private triggerPassivePing(height: number): void {
    this.setPlaybackRateSafely(
      this.profile.sounds.passivePing,
      clamp(0.9 + height * AUDIO_CONFIG.enemy.altitudePitchScale, 0.75, 2)
    )
    this.safeRetrigger(this.profile.sounds.passivePing)
  } // end method triggerPassivePing

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
  return enemyType === 'tank' || enemyType === 'striker' || enemyType === 'brute' || enemyType === 'helicopter'
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
      console.warn('Failed to load burst attack variant.', { variantPath, error })
    })
    variants.set(roundedRoundCount, variantPlayer)
  } // end for each configured burst round count

  return variants
} // end function createAttackVariantPlayers

function createTankProfile(enemyId: string, enemyType: string): EnemyAudioProfile {
  const definition = isEnemyId(enemyType) ? getEnemyDefinition(enemyType) : null
  const filter = new Tone.Filter({ type: 'lowpass', frequency: 2600, Q: 0.7 })
  const gain = new Tone.Gain(0)
  const panner = new Tone.Panner3D({
    panningModel: 'equalpower',
    distanceModel: 'inverse',
    refDistance: 1,
    maxDistance: AUDIO_CONFIG.enemy.maxDistance,
    rolloffFactor: 1.4,
    coneInnerAngle: 360,
    coneOuterAngle: 0,
    coneOuterGain: 0
  }).toDestination()

  return {
    id: enemyId,
    type: enemyType,
    category: AUDIO_CONFIG.tank.category,
    sounds: {
      idleLoop: new Tone.Player(definition?.sounds.positionalLoopSound ?? 'assets/sounds/tankMoving.ogg'),
      movementLoop: new Tone.Player(definition?.sounds.positionalLoopSound ?? 'assets/sounds/tankMoving.ogg'),
      passivePing: new Tone.Player('assets/sounds/servomotor.ogg'),
      threatCue: new Tone.Player(definition?.sounds.startupSound ?? 'assets/sounds/weapons/reloadCannon.ogg'),
      attackSound: new Tone.Player(definition?.sounds.attackSound ?? 'assets/sounds/explosions/explosion_1A.ogg'),
      attackVariants: createAttackVariantPlayers(definition?.automaticFire),
      hurtSound: new Tone.Player(definition?.sounds.hurtSound ?? 'assets/sounds/explosions/explosion_1B.ogg'),
      deathSound: new Tone.Player(definition?.sounds.deathSound ?? 'assets/sounds/explosions/explosion_2a.ogg')
    },
    effects: {
      filter,
      gain,
      panner
    },
    params: {
      baseVolume: AUDIO_CONFIG.tank.baseVolume,
      passivePingRateMs: AUDIO_CONFIG.tank.passivePingRateMs,
      movementVariance: AUDIO_CONFIG.tank.movementVariance,
      threatCueDelayMs: AUDIO_CONFIG.tank.threatCueDelayMs
    }
  } // end object enemy profile
} // end function createTankProfile

function createHelicopterProfile(enemyId: string, enemyType: string): EnemyAudioProfile {
  const definition = isEnemyId(enemyType) ? getEnemyDefinition(enemyType) : null
  const filter = new Tone.Filter({ type: 'lowpass', frequency: 3400, Q: 0.5 })
  const gain = new Tone.Gain(0)
  const panner = new Tone.Panner3D({
    panningModel: 'equalpower',
    distanceModel: 'inverse',
    refDistance: 1,
    maxDistance: AUDIO_CONFIG.enemy.maxDistance,
    rolloffFactor: 1.2,
    coneInnerAngle: 360,
    coneOuterAngle: 0,
    coneOuterGain: 0
  }).toDestination()

  return {
    id: enemyId,
    type: enemyType,
    category: AUDIO_CONFIG.helicopter.category,
    sounds: {
      idleLoop: new Tone.Player(definition?.sounds.positionalLoopSound ?? 'assets/sounds/helicopterLoop.ogg'),
      movementLoop: new Tone.Player(definition?.sounds.positionalLoopSound ?? 'assets/sounds/helicopterLoop.ogg'),
      passivePing: new Tone.Player('assets/sounds/servomotor.ogg'),
      threatCue: new Tone.Player(definition?.sounds.startupSound ?? 'assets/sounds/weapons/reload.ogg'),
      attackSound: new Tone.Player(definition?.sounds.attackSound ?? 'assets/sounds/weapons/pistol_fire.ogg'),
      attackVariants: createAttackVariantPlayers(definition?.automaticFire),
      hurtSound: new Tone.Player(definition?.sounds.hurtSound ?? 'assets/sounds/tankHit.ogg'),
      deathSound: new Tone.Player(definition?.sounds.deathSound ?? 'assets/sounds/explosions/explosion_2a.ogg')
    },
    effects: {
      filter,
      gain,
      panner
    },
    params: {
      baseVolume: AUDIO_CONFIG.helicopter.baseVolume,
      passivePingRateMs: AUDIO_CONFIG.helicopter.passivePingRateMs,
      movementVariance: AUDIO_CONFIG.helicopter.movementVariance,
      threatCueDelayMs: AUDIO_CONFIG.helicopter.threatCueDelayMs
    }
  }
} // end function createHelicopterProfile

function createEnemyProfile(enemyId: string, enemyType: string): EnemyAudioProfile {
  if (enemyType === AUDIO_CONFIG.helicopter.type) {
    return createHelicopterProfile(enemyId, enemyType)
  } // end if helicopter
  return createTankProfile(enemyId, enemyType)
} // end function createEnemyProfile

function createFallbackEnemyProfile(enemyId: string, enemyType: string): EnemyAudioProfile {
  const filter = new Tone.Filter({ type: 'lowpass', frequency: 2600, Q: 0.7 })
  const gain = new Tone.Gain(0)
  const panner = new Tone.Panner3D({
    panningModel: 'equalpower',
    distanceModel: 'inverse',
    refDistance: 1,
    maxDistance: AUDIO_CONFIG.enemy.maxDistance,
    rolloffFactor: 1.4,
    coneInnerAngle: 360,
    coneOuterAngle: 0,
    coneOuterGain: 0
  }).toDestination()

  const isHelicopter = enemyType === AUDIO_CONFIG.helicopter.type
  return {
    id: enemyId,
    type: enemyType,
    category: isHelicopter ? AUDIO_CONFIG.helicopter.category : AUDIO_CONFIG.tank.category,
    sounds: createSilentEnemySoundSet(),
    effects: {
      filter,
      gain,
      panner
    },
    params: {
      baseVolume: isHelicopter ? AUDIO_CONFIG.helicopter.baseVolume : AUDIO_CONFIG.tank.baseVolume,
      passivePingRateMs: isHelicopter ? AUDIO_CONFIG.helicopter.passivePingRateMs : AUDIO_CONFIG.tank.passivePingRateMs,
      movementVariance: isHelicopter ? AUDIO_CONFIG.helicopter.movementVariance : AUDIO_CONFIG.tank.movementVariance,
      threatCueDelayMs: isHelicopter ? AUDIO_CONFIG.helicopter.threatCueDelayMs : AUDIO_CONFIG.tank.threatCueDelayMs
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
  let aimAssistWasCentered = false
  let aimAssistOscStarted = false
  let bulletNearMissVoiceCursor = 0
  let projectileNearMissVoiceCursor = 0
  let playerMechHitBaseVoiceCursor = 0
  let playerMechHitDetailVoiceCursor = 0
  let energyPulseTimerSeconds = 0
  let lastImpactTimeSeconds = -1
  let lastTankHitConfirmTimeSeconds = -1

  let categoryProximity = true
  let categoryObjects = true
  let categoryEnemies = true
  let categoryNavigation = true
  let masterVolume = 1
  let ambienceVolume = 1
  let servoVolume = 1
  let footstepsVolume = 1
  let flightLoopVolume = 0.5
  let proximityVolume = 1
  let objectsVolume = 1
  let enemiesVolume = 1
  let navigationVolume = 1

  const aimAssistProjectileRadius = 0.25

  const rawContext = Tone.getContext().rawContext as AudioContext
  const enemyRuntimes = new Map<string, EnemyAudioRuntime>()

  const clampVolumeScalar = (value: number): number => clamp(value, 0, 2)

  const gainToDbSafe = (value: number): number => value <= 0.0001 ? -80 : Tone.gainToDb(value)

  const applyFlightLoopVolume = (): void => {
    flightLoopGain.gain.value = 0.78 * flightLoopVolume
  } // end function applyFlightLoopVolume

  const applyHtmlAudioVolumes = (): void => {
    ambienceAudio.volume = AUDIO_CONFIG.player.ambienceVolume * masterVolume * ambienceVolume
    servoAudio.volume = AUDIO_CONFIG.player.servoVolume * masterVolume * servoVolume
    footstepAudio.volume = 0.25 * masterVolume * footstepsVolume
    terrainStepAudios.forEach((audio) => {
      audio.volume = AUDIO_CONFIG.player.terrainStepVolume * masterVolume * footstepsVolume
    })
  } // end function applyHtmlAudioVolumes

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
    if (name === 'servo') return servoVolume
    if (name === 'footsteps') return footstepsVolume
    if (name === 'flightLoop') return flightLoopVolume
    return getCategoryVolume(name)
  } // end function getVolumeChannel

  const footstepAudio = new Audio('assets/sounds/footstep.ogg')
  footstepAudio.preload = 'auto'
  footstepAudio.volume = 0.25

  const terrainStepFiles = Array.from(
    { length: 16 },
    (_, index) => `assets/sounds/steps/${AUDIO_CONFIG.player.terrainType}/${index + 1}.ogg`
  )
  const terrainStepAudios = terrainStepFiles.map((file) => {
    const audio = new Audio(file)
    audio.preload = 'auto'
    audio.volume = AUDIO_CONFIG.player.terrainStepVolume
    return audio
  })

  const ambienceAudio = new Audio(`assets/sounds/ambience/${AUDIO_CONFIG.player.terrainType}/${AUDIO_CONFIG.player.ambienceTrack}.ogg`)
  ambienceAudio.preload = 'auto'
  ambienceAudio.loop = true
  ambienceAudio.volume = AUDIO_CONFIG.player.ambienceVolume

  const servoAudio = new Audio('assets/sounds/servomotor.ogg')
  servoAudio.preload = 'auto'
  servoAudio.loop = true
  servoAudio.volume = AUDIO_CONFIG.player.servoVolume

  const impactPanner = new Tone.Panner3D({
    panningModel: 'HRTF',
    distanceModel: 'inverse',
    refDistance: 1,
    maxDistance: 96,
    rolloffFactor: 1.8
  }).toDestination()

  const impactSynth = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.16, release: 0.25 },
    harmonicity: 5.1,
    modulationIndex: 14,
    resonance: 2800,
    octaves: 1.2
  }).connect(impactPanner)

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
    'assets/sounds/weapons/reloadCannon.ogg',
    'assets/sounds/weapons/reload.ogg',
    'assets/sounds/weapons/pistol_fire.ogg',
    'assets/sounds/weapons/arBurst3.ogg',
    'assets/sounds/weapons/arBurst4.ogg',
    'assets/sounds/weapons/arBurst5.ogg',
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
  const playerFireSound = new Tone.Player(defaultPlayerFireSoundPath).toDestination()
  const playerFireSoundCache = new Map<string, Tone.Player>([[defaultPlayerFireSoundPath, playerFireSound]])
  const flightLoopGain = new Tone.Gain(0.78).toDestination()
  const flightLoopSound = new Tone.Player('assets/sounds/jetLoop.ogg').connect(flightLoopGain)
  flightLoopSound.loop = true
  applyFlightLoopVolume()
  const hardLandingGain = new Tone.Gain(0.92).toDestination()
  const hardLandingSound = new Tone.Player('assets/sounds/hardLanding.ogg').connect(hardLandingGain)

  const bulletNearMissPanner = new Tone.Panner3D({
    panningModel: 'HRTF',
    distanceModel: 'inverse',
    refDistance: 0.8,
    maxDistance: 8,
    rolloffFactor: 1.35
  }).toDestination()
  const bulletNearMissGain = new Tone.Gain(0.001).connect(bulletNearMissPanner)
  const bulletNearMissVoices = [
    new Tone.Player('assets/sounds/bulletWiz.ogg').connect(bulletNearMissGain),
    new Tone.Player('assets/sounds/bulletWiz.ogg').connect(bulletNearMissGain),
    new Tone.Player('assets/sounds/bulletWiz.ogg').connect(bulletNearMissGain),
    new Tone.Player('assets/sounds/bulletWiz.ogg').connect(bulletNearMissGain)
  ]

  const projectileNearMissPanner = new Tone.Panner3D({
    panningModel: 'HRTF',
    distanceModel: 'inverse',
    refDistance: 1.1,
    maxDistance: 10,
    rolloffFactor: 1.25
  }).toDestination()
  const projectileNearMissGain = new Tone.Gain(0.001).connect(projectileNearMissPanner)
  const projectileNearMissVoices = [
    new Tone.Player('assets/sounds/projectileWiz.ogg').connect(projectileNearMissGain),
    new Tone.Player('assets/sounds/projectileWiz.ogg').connect(projectileNearMissGain),
    new Tone.Player('assets/sounds/projectileWiz.ogg').connect(projectileNearMissGain),
    new Tone.Player('assets/sounds/projectileWiz.ogg').connect(projectileNearMissGain)
  ]

  const incomingProjectileVoices: IncomingProjectileVoice[] = Array.from({ length: 8 }, () => {
    const panner = new Tone.Panner3D({
      panningModel: 'HRTF',
      distanceModel: 'inverse',
      refDistance: 0.9,
      maxDistance: 22,
      rolloffFactor: 1.15
    }).toDestination()
    const gain = new Tone.Gain(0.001).connect(panner)
    const player = new Tone.Player('assets/sounds/projectileWiz.ogg').connect(gain)
    player.loop = true
    return {
      id: null,
      player,
      gain,
      panner
    }
  })

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
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 }
  }).toDestination()

  const missileLockConfirmSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
  }).toDestination()

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

  const energyPulseSynth = new Tone.FMSynth({
    harmonicity: 0.75,
    modulationIndex: 3.2,
    envelope: { attack: 0.004, decay: 0.2, sustain: 0, release: 0.12 }
  }).toDestination()

  const sonarSweepSynth = new Tone.FMSynth({
    harmonicity: 0.5,
    modulationIndex: 10,
    envelope: { attack: 0.01, decay: 0.18, sustain: 0, release: 0.1 }
  }).toDestination()

  const activePingSynth = new Tone.FMSynth({
    harmonicity: 1.2,
    modulationIndex: 6,
    envelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.08 }
  }).toDestination()

  const passiveRadarSweepSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.22, sustain: 0, release: 0.05 }
  }).toDestination()

  const aimAssistGain = new Tone.Gain(0).toDestination()
  const aimAssistFilter = new Tone.Filter(900, 'lowpass').connect(aimAssistGain)
  const aimAssistOsc = new Tone.Oscillator({ frequency: AUDIO_CONFIG.player.aimAssistBaseFrequency, type: 'triangle' }).connect(aimAssistFilter)
  const aimAssistLockClick = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 }
  }).toDestination()

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
        console.warn('Failed to load cardinal heading cue.', { path: bestCue.path, error })
      })
  } // end function playCardinalHeadingCue

  const setPlaybackRateSafely = (player: Tone.Player, playbackRate: number): void => {
    try {
      player.playbackRate = playbackRate
    } catch {
      // Ignore timeline ordering collisions from rapid rate updates.
    } // end try/catch playbackRate set
  } // end function setPlaybackRateSafely

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
    if (voice.player.state === 'started') {
      voice.player.stop()
    } // end if voice loop currently playing
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
    if (freeVoice.player.loaded && freeVoice.player.state !== 'started') {
      freeVoice.player.start()
    } // end if voice loop is ready to start
    return freeVoice
  } // end function acquireIncomingProjectileVoice

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
        terrainStepAudios.forEach((audio) => {
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
        const firstTerrainStep = terrainStepAudios[0]
        if (firstTerrainStep) {
          await firstTerrainStep.play().catch(() => undefined)
          firstTerrainStep.pause()
          firstTerrainStep.currentTime = 0
        }
        initializeAudioCueUtilities()
        if (!aimAssistOscStarted) {
          aimAssistOsc.start()
          aimAssistOscStarted = true
        } // end if aim assist oscillator not started
        footstepAudio.muted = false
        servoAudio.muted = false
        ambienceAudio.muted = false
        terrainStepAudios.forEach((audio) => {
          audio.muted = false
        })
        applyHtmlAudioVolumes()
        void ambienceAudio.play().catch(() => undefined)
        audioStarted = true
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
  let negativeActionLastStartSeconds = -Infinity
  let lastCardinalHeadingCueTimeSeconds = -Infinity
  let lowHealthAlarmTimerSeconds = 0

  const strictlyIncreasingStartTime = (requestedSeconds: number, previousSeconds: number): number => {
    return Math.max(requestedSeconds, previousSeconds + 0.001)
  } // end function strictlyIncreasingStartTime

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
    const start = strictlyIncreasingStartTime(Tone.now(), missileLockToneLastStartSeconds)
    missileLockToneLastStartSeconds = start
    missileLockToneSynth.volume.value = Tone.gainToDb(0.38)
    missileLockToneSynth.triggerAttackRelease('A5', '64n', start)
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

    ambienceWasPlayingBeforePause = !ambienceAudio.paused
    ambienceTimeBeforePause = ambienceAudio.currentTime
    if (ambienceWasPlayingBeforePause) {
      ambienceAudio.pause()
    } // end if ambience was playing

    flightLoopWasPlayingBeforePause = flightLoopSound.state === 'started'
    if (flightLoopWasPlayingBeforePause) {
      flightLoopSound.stop()
    } // end if player flight loop was playing

    if (contextWasRunningBeforePause) {
      try {
        await rawContext.suspend()
      } catch {
        // Ignore suspend failures and keep gameplay paused regardless.
      } // end try/catch context suspend
    } // end if context was running before pause
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

    if (flightLoopWasPlayingBeforePause && flightLoopSound.loaded && flightLoopSound.state !== 'started') {
      flightLoopSound.start()
    } // end if player flight loop should resume

    servoWasPlayingBeforePause = false
    footstepWasPlayingBeforePause = false
    ambienceWasPlayingBeforePause = false
    flightLoopWasPlayingBeforePause = false
    contextWasRunningBeforePause = false
    audioPaused = false
  } // end function resumeAllAudio

  const startFlightLoop = (): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning() || !flightLoopSound.loaded) {
      return
    } // end if player flight loop cannot start
    if (flightLoopSound.state !== 'started') {
      flightLoopSound.start()
    } // end if player flight loop not already running
  } // end function startFlightLoop

  const stopFlightLoop = (): void => {
    if (flightLoopSound.state === 'started') {
      flightLoopSound.stop()
    } // end if player flight loop should stop
  } // end function stopFlightLoop

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
      aimAssistGain.gain.rampTo(0, 0.08)
    } // end if disabling aim assist
  } // end function setAimAssistEnabled

  const playObstacleContact = (distance: number, bearing: number, kind: 'wall' | 'boundary' | 'tree' | 'rock', lowVolume = false): void => {
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
          : 420
    const oscillatorType = kind === 'boundary'
      ? 'sawtooth'
      : kind === 'wall'
        ? 'sine'
        : kind === 'tree'
          ? 'triangle'
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

  const updateNearFieldNavigation = (player: PlayerAudioState, collisionWorld: WorldCollisionWorld, sprites: SpriteObject[]): void => {
    if (!categoryProximity) {
      silenceWallProximityCue()
      return
    } // end if proximity category disabled

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

  const runPassiveSweepTick = (player: PlayerAudioState, enemies: EnemyAudioState[], collisionWorld: WorldCollisionWorld, sprites: SpriteObject[]): void => {
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
    } else if (contact && contact.kind !== 'enemy' && categoryObjects) {
      const normalizedSweep = ((currentAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      const sweepFrequency = AUDIO_NAVIGATION_CONFIG.sweepBaseFrequency + (normalizedSweep / (Math.PI * 2)) * AUDIO_NAVIGATION_CONFIG.sweepPitchSpan
      triggerPassiveSweepTone(sweepFrequency, 0.035)
      playObstacleContact(contact.distance, contact.bearing, contact.kind, true)
    } // end if passive sweep contact found

    passiveSweepAngle = normalizeAngle(passiveSweepAngle + stepAngle)
  } // end function runPassiveSweepTick

  const updateFrameAudio = (
    dt: number,
    player: PlayerAudioState,
    enemies: EnemyAudioState[],
    collisionWorld: WorldCollisionWorld,
    sprites: SpriteObject[]
  ): void => {
    const maxAudioLosDistance = 170

    applyHtmlAudioVolumes()

    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started

    const nearestEnemyDistance = enemies
      .filter((enemy) => enemy.isAlive)
      .map((enemy) => Math.hypot(
        enemy.position.x - player.position.x,
        enemy.position.y - player.position.y,
        enemy.position.z - player.position.z
      ))
      .sort((a, b) => a - b)[0] ?? Number.POSITIVE_INFINITY
    const nearestObstacleContact = findNearestObstacleContact(
      collisionWorld,
      { x: player.position.x, y: player.position.y },
      player.angle,
      sprites,
      AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance,
      32
    )
    const hasNearbySonarContact = (
      nearestEnemyDistance <= AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance ||
      (nearestObstacleContact !== null && nearestObstacleContact.distance <= AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance)
    )

    const losEnemyCandidates = enemies
      .filter((enemy) => enemy.isAlive)
      .map((enemy) => {
        const distance = Math.hypot(
          enemy.position.x - player.position.x,
          enemy.position.y - player.position.y,
          enemy.position.z - player.position.z
        )
        if (distance > maxAudioLosDistance) {
          return { enemyId: enemy.id, hasSightLine: false, distance }
        } // end if enemy is outside LOS audio trace range

        const hasSightLine = hasLineOfSight(
          collisionWorld,
          { x: enemy.position.x, y: enemy.position.y },
          { x: player.position.x, y: player.position.y }
        )

        return { enemyId: enemy.id, hasSightLine, distance }
      })
      .filter((entry) => entry.hasSightLine)
      .sort((a, b) => a.distance - b.distance)
    const primaryLosEnemyId = losEnemyCandidates[0]?.enemyId

    const liveEnemyIds = new Set<string>()
    for (const enemy of enemies) {
      liveEnemyIds.add(enemy.id)
      const runtime = getOrCreateEnemyRuntime(enemy.id, enemy.type)
      const hasSightLine = losEnemyCandidates.some((entry) => entry.enemyId === enemy.id)
      const shouldEmitLosTick = primaryLosEnemyId === enemy.id
      // Always call updateAudio so positional loops keep playing even when the
      // enemies-category is toggled off. Cue sounds (LOS ticks, turn cues) are
      // suppressed by passing false for the hasSightLine gate.
      runtime.updateAudio(
        dt,
        enemy,
        player,
        categoryEnemies && hasNearbySonarContact && hasSightLine && shouldEmitLosTick,
        categoryEnemies ? enemiesVolume : 0
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
      updateNearFieldNavigation(player, collisionWorld, sprites)

      passiveSweepAccumulatorSeconds += dt
      const sweepTickSeconds = 1 / AUDIO_NAVIGATION_CONFIG.passiveSweepTickRateHz
      while (passiveSweepAccumulatorSeconds >= sweepTickSeconds) {
        passiveSweepAccumulatorSeconds -= sweepTickSeconds
        runPassiveSweepTick(player, enemies, collisionWorld, sprites)
      } // end while passive sweep ticks are due
    } // end if sonar should be active

    updatePassiveRadar(dt)
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

    playCardinalHeadingCue(player.angle)

    const nearestEnemyDistance = enemies
      .filter((enemy) => enemy.isAlive)
      .map((enemy) => Math.hypot(
        enemy.position.x - player.position.x,
        enemy.position.y - player.position.y,
        enemy.position.z - player.position.z
      ))
      .sort((a, b) => a - b)[0] ?? Number.POSITIVE_INFINITY
    const nearestObstacleContact = findNearestObstacleContact(
      collisionWorld,
      { x: player.position.x, y: player.position.y },
      player.angle,
      sprites,
      AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance,
      32
    )
    const hasNearbySonarContact = (
      nearestEnemyDistance <= AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance ||
      (nearestObstacleContact !== null && nearestObstacleContact.distance <= AUDIO_NAVIGATION_CONFIG.sonarSilenceDistance)
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

      if (categoryObjects) {
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
    if (!audioStarted || audioPaused || !isAudioContextRunning() || !categoryObjects) {
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
      voice.synth.oscillator.type = echo.obstacleType === 'wall' ? 'sine' : 'triangle'
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

  const fireGunshot = (soundPath: string = defaultPlayerFireSoundPath): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started

    const cachedPlayer = playerFireSoundCache.get(soundPath)
    if (cachedPlayer) {
      retriggerLoadedPlayer(cachedPlayer)
      return
    } // end if cached fire sound exists

    const dynamicPlayer = new Tone.Player(soundPath).toDestination()
    playerFireSoundCache.set(soundPath, dynamicPlayer)
    void dynamicPlayer
      .load(soundPath)
      .then(() => {
        retriggerLoadedPlayer(dynamicPlayer)
      })
      .catch((error) => {
        console.warn('Failed to load player fire sound, falling back to default.', { soundPath, error })
        playerFireSoundCache.delete(soundPath)
        retriggerLoadedPlayer(playerFireSound)
      })
  } // end function fireGunshot

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

    const relative = worldToListenerSpace(
      { x: worldX, y: worldY, z: 0 },
      { x: playerX, y: playerY, z: 0 },
      playerAngle
    )
    const clampedRadius = Math.max(nearMissRadius, 0.001)
    const closeness = clamp(1 - closestDistance / clampedRadius, 0, 1)
    if (projectileType === 'projectile') {
      projectileNearMissGain.gain.value = clamp((0.08 + closeness * 0.9) * enemiesVolume, 0, 1.4)
      projectileNearMissPanner.positionX.value = relative.x
      projectileNearMissPanner.positionY.value = relative.y
      projectileNearMissPanner.positionZ.value = relative.z
      projectileNearMissVoiceCursor = playFromVoicePool(projectileNearMissVoices, projectileNearMissVoiceCursor)
      return
    } // end if cannon projectile near miss

    bulletNearMissGain.gain.value = clamp((0.06 + closeness * 0.8) * enemiesVolume, 0, 1.3)
    bulletNearMissPanner.positionX.value = relative.x
    bulletNearMissPanner.positionY.value = relative.y
    bulletNearMissPanner.positionZ.value = relative.z
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
      .filter((projectile) => projectile.distanceToPlayer <= 22)
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

      const relative = worldToListenerSpace(
        { x: projectile.x, y: projectile.y, z: 0 },
        { x: playerX, y: playerY, z: 0 },
        playerAngle
      )
      const distance = Math.max(projectile.distanceToPlayer, 0.001)
      const toPlayerX = playerX - projectile.x
      const toPlayerY = playerY - projectile.y
      const closingSpeed = (projectile.velocityX * toPlayerX + projectile.velocityY * toPlayerY) / distance
      const proximity = clamp(1 - distance / 22, 0, 1)
      const approach = clamp(closingSpeed / 8, 0, 1)
      const targetGain = clamp((0.015 + proximity * (0.2 + approach * 0.78)) * enemiesVolume, 0, 1.3)

      voice.panner.positionX.value = relative.x
      voice.panner.positionY.value = relative.y
      voice.panner.positionZ.value = relative.z
      voice.gain.gain.value = targetGain
      if (voice.player.loaded && voice.player.state !== 'started') {
        voice.player.start()
      } // end if voice not yet started
    } // end for each audible projectile
  } // end function updateIncomingProjectileAudio

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

  const updatePlayerEnergyStatusAudio = (dt: number, epPercent: number): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      energyPulseTimerSeconds = 0
      return
    } // end if audio not started

    const normalized = clamp(epPercent, 0, 1)
    if (normalized >= 0.999) {
      energyPulseTimerSeconds = 0
      return
    } // end if energy full

    energyPulseTimerSeconds += dt
    const intervalSeconds = 0.24 + normalized * 1.66
    if (energyPulseTimerSeconds < intervalSeconds) {
      return
    } // end if pulse interval not reached
    energyPulseTimerSeconds -= intervalSeconds

    const frequency = 85 + normalized * 110
    const gain = (0.34 + (1 - normalized) * 0.96) * masterVolume
    energyPulseSynth.volume.value = gainToDbSafe(gain)
    energyPulseSynth.triggerAttackRelease(frequency, '8n')
  } // end function updatePlayerEnergyStatusAudio

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
    timeOffsetSeconds = 0
  ): void => {
    if (!audioStarted || audioPaused || !isAudioContextRunning()) {
      return
    } // end if audio not started

    const now = Tone.now()
    if (lastImpactTimeSeconds >= 0 && (now - lastImpactTimeSeconds) < 0.012) {
      return
    } // end if impacts are being emitted too densely
    lastImpactTimeSeconds = now

    const relative = worldToListenerSpace(
      { x: worldX, y: worldY, z: 0 },
      { x: playerX, y: playerY, z: 0 },
      playerAngle
    )
    impactPanner.positionX.value = relative.x
    impactPanner.positionY.value = relative.y
    impactPanner.positionZ.value = relative.z
    impactSynth.volume.value = gainToDbSafe(objectsVolume)
    impactSynth.triggerAttackRelease(220, '16n', now + timeOffsetSeconds)
  } // end function playImpact

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

  const playFootstep = (): void => {
    if (!audioStarted || audioPaused) {
      return
    } // end if audio not started

    footstepAudio.currentTime = 0
    void footstepAudio.play().catch(() => undefined)

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

  const updateAimAssist = (dt: number, player: PlayerAudioState, enemies: EnemyAudioState[]): void => {
    // Target tracking now relies on enemy positional loop audio only.
    aimAssistGain.gain.rampTo(0, 0.08)
    aimAssistWasCentered = false
    void aimAssistEnabled
    void aimAssistProjectileRadius
    void player
    void enemies
    void dt
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

  const getOrCreateEnemyRuntime = (enemyId: string, enemyType: string): EnemyAudioRuntime => {
    const existing = enemyRuntimes.get(enemyId)
    if (existing) {
      if (existing.profile.type !== enemyType) {
        existing.dispose()
        enemyRuntimes.delete(enemyId)
      } else {
        return existing
      } // end if runtime already matches enemy type
    } // end if runtime already exists

    let profile: EnemyAudioProfile
    try {
      profile = createEnemyProfile(enemyId, enemyType)
    } catch (error) {
      // Keep frame-audio updates alive when a late-loaded enemy clip fails to fetch.
      console.warn('Enemy audio asset load failed, using silent fallback runtime.', { enemyId, enemyType, error })
      profile = createFallbackEnemyProfile(enemyId, enemyType)
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
          console.warn('Failed to prewarm enemy audio asset.', { path, error })
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
    playFootstep,
    stopFootstep,
    playBump,
    startFlightLoop,
    stopFlightLoop,
    playHardLanding,
    playCollisionThud,
    playPitchCenterConfirm,
    fireGunshot,
    playCardinalOrientationCue,
    setAimAssistEnabled,
    isAimAssistEnabled: () => aimAssistEnabled,
    updateFrameAudio,
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
    playPlayerMechHit,
    playPlayerHealthStatusTone,
    updatePlayerHealthStatusAudio,
    updatePlayerEnergyStatusAudio,
    updateIncomingProjectileAudio,
    playProjectileNearMiss,
    isAudioStarted: () => audioStarted,
    getAudioContextState,
    isServoPlaying: () => servoPlaying,
    toggleCategory,
    setCategoryEnabled,
    getCategoryEnabled,
    setVolumeChannel,
    getVolumeChannel,
    playLockOnChirp,
    playLockLostChirp,
    playMissileLockTone,
    playMissileLockConfirmTone,
    playNegativeActionTone,
    playExplosion,
    playCardinalHeadingCueForFacing: (playerAngle: number) => playCardinalHeadingCue(playerAngle),
    prewarmEnemyAudioAssets
  } // end object audio controller
} // end function createAudioController

