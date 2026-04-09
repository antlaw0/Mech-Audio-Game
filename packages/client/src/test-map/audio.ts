import * as Tone from 'tone'
import { AUDIO_CONFIG } from './audio-config.js'
import {
  bearingBetween,
  clamp,
  distanceToFilter,
  distanceToVolume,
  lerp,
  normalizeAngle,
  relativeVelocityForDoppler,
  worldToListenerSpace
} from './audio-utils.js'
import type { AudioController, EnemyAudioState, ObstructionAwareness, PlayerAudioState, SonarEcho } from './types.js'

interface EnemySoundSet {
  idleLoop: Tone.Player
  movementLoop: Tone.Player
  passivePing: Tone.Player
  threatCue: Tone.Player
  attackSound: Tone.Player
  hurtSound: Tone.Player
  deathSound: Tone.Player
} // end interface EnemySoundSet

interface EnemyEffects {
  doppler: Tone.PitchShift
  filter: Tone.Filter
  gain: Tone.Gain
  panner: PannerNode
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
  private activeSonarStamp = -1
  private alive = true

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
    profile.sounds.hurtSound.connect(this.oneshotGain)
    profile.sounds.deathSound.connect(this.oneshotGain)

    profile.effects.filter.connect(profile.effects.doppler)
    profile.effects.doppler.connect(profile.effects.gain)
    profile.effects.gain.connect(profile.effects.panner)
    profile.effects.panner.connect(Tone.getContext().rawContext.destination)

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
    this.safeStart(this.profile.sounds.idleLoop)
    this.safeStart(this.profile.sounds.movementLoop)
    this.idleGain.gain.rampTo(0.45, AUDIO_CONFIG.enemy.idleFadeSeconds)
    this.movementGain.gain.rampTo(0, AUDIO_CONFIG.enemy.movementFadeSeconds)
  } // end method initializeLoops

  updateAudio(dt: number, enemy: EnemyAudioState, player: PlayerAudioState): void {
    this.safeStart(this.profile.sounds.idleLoop)
    this.safeStart(this.profile.sounds.movementLoop)

    const relative = worldToListenerSpace(enemy.position, player.position, player.angle)
    this.profile.effects.panner.positionX.value = relative.x
    this.profile.effects.panner.positionY.value = relative.y
    this.profile.effects.panner.positionZ.value = relative.z

    const distance = Math.hypot(relative.x, relative.y, relative.z)
    const distanceVolume = distanceToVolume(distance)
    const targetVolume = this.profile.params.baseVolume * distanceVolume
    this.profile.effects.gain.gain.rampTo(targetVolume, 0.08)

    const filterTarget = distanceToFilter(distance) + enemy.height * AUDIO_CONFIG.enemy.altitudeFilterScale
    this.profile.effects.filter.frequency.rampTo(filterTarget, 0.08)

    const relSpeed = relativeVelocityForDoppler(enemy.velocity, player.velocity)
    const relSigned = enemy.velocity.x * Math.cos(player.angle) + enemy.velocity.y * Math.sin(player.angle)
    const signedSpeed = relSigned >= 0 ? relSpeed : -relSpeed
    const cents = clamp(signedSpeed * 16, AUDIO_CONFIG.enemy.dopplerCentsMin, AUDIO_CONFIG.enemy.dopplerCentsMax)
    this.profile.effects.doppler.pitch = cents / 100

    const motionGain = enemy.isMoving ? 1 : 0
    const ducking = this.attackDuckingTimerSeconds > 0 ? AUDIO_CONFIG.enemy.attackDucking : 1
    const idleTarget = enemy.isAlive ? (1 - motionGain * 0.55) * ducking : 0
    const movementTarget = enemy.isAlive ? motionGain * ducking : 0

    this.idleGain.gain.rampTo(idleTarget, AUDIO_CONFIG.enemy.idleFadeSeconds)
    this.movementGain.gain.rampTo(movementTarget, AUDIO_CONFIG.enemy.movementFadeSeconds)

    const facingDelta = Math.abs(normalizeAngle(enemy.facingAngle - this.lastFacingAngle))
    if (facingDelta > AUDIO_CONFIG.enemy.turnCueThresholdRadians && this.turnCueCooldownSeconds <= 0 && enemy.isAlive) {
      this.turnCueSynth.triggerAttackRelease('G5', '32n')
      this.turnCueCooldownSeconds = AUDIO_CONFIG.enemy.turnCueCooldownSeconds
    } // end if turn cue should play

    this.turnCueCooldownSeconds = Math.max(0, this.turnCueCooldownSeconds - dt)
    this.attackDuckingTimerSeconds = Math.max(0, this.attackDuckingTimerSeconds - dt)
    this.lastFacingAngle = enemy.facingAngle

    if (enemy.isAlive) {
      this.passivePingTimerSeconds -= dt
      if (this.passivePingTimerSeconds <= 0) {
        this.triggerPassivePing(enemy.height)
        this.passivePingTimerSeconds = this.randomPassiveIntervalSeconds()
      } // end if passive ping timer elapsed
    } // end if enemy alive

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

  playAttack(): void {
    if (!this.alive) {
      return
    } // end if enemy not alive
    this.attackDuckingTimerSeconds = AUDIO_CONFIG.enemy.attackDuckingSeconds
    this.setPlaybackRateSafely(this.profile.sounds.attackSound, 0.9)
    this.safeRetrigger(this.profile.sounds.attackSound)
  } // end method playAttack

  playHurt(): void {
    if (!this.alive) {
      return
    } // end if enemy not alive
    this.setPlaybackRateSafely(this.profile.sounds.hurtSound, 1 + (Math.random() * 0.14 - 0.07))
    this.safeRetrigger(this.profile.sounds.hurtSound)
    this.turnCueSynth.triggerAttackRelease('A4', '64n')
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
    this.profile.sounds.hurtSound.dispose()
    this.profile.sounds.deathSound.dispose()
    this.profile.effects.filter.dispose()
    this.profile.effects.doppler.dispose()
    this.profile.effects.gain.dispose()
    this.profile.effects.panner.disconnect()
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

    if (player.state === 'started') {
      player.stop()
    } // end if player started
    player.start()
  } // end method safeRetrigger

  private randomPassiveIntervalSeconds(): number {
    const minMs = AUDIO_CONFIG.enemy.passivePingMinMs
    const maxMs = AUDIO_CONFIG.enemy.passivePingMaxMs
    return (minMs + Math.random() * (maxMs - minMs)) / 1000
  } // end method randomPassiveIntervalSeconds
} // end class EnemyAudioRuntime

function createTankProfile(enemyId: string, context: AudioContext): EnemyAudioProfile {
  const filter = new Tone.Filter({ type: 'lowpass', frequency: 2600, Q: 0.7 })
  const doppler = new Tone.PitchShift(0)
  const gain = new Tone.Gain(0)
  const panner = context.createPanner()

  panner.panningModel = 'HRTF'
  panner.distanceModel = 'inverse'
  panner.refDistance = 1
  panner.maxDistance = AUDIO_CONFIG.enemy.maxDistance
  panner.rolloffFactor = 1.4
  panner.coneInnerAngle = 360
  panner.coneOuterAngle = 0
  panner.coneOuterGain = 0

  return {
    id: enemyId,
    type: AUDIO_CONFIG.tank.type,
    category: AUDIO_CONFIG.tank.category,
    sounds: {
      idleLoop: new Tone.Player('assets/sounds/tankMoving.ogg'),
      movementLoop: new Tone.Player('assets/sounds/tankMoving.ogg'),
      passivePing: new Tone.Player('assets/sounds/servomotor.ogg'),
      threatCue: new Tone.Player('assets/sounds/footstep.mp3'),
      attackSound: new Tone.Player('assets/sounds/explosion_1A.ogg'),
      hurtSound: new Tone.Player('assets/sounds/explosion_1B.ogg'),
      deathSound: new Tone.Player('assets/sounds/explosion_2a.ogg')
    },
    effects: {
      doppler,
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

export function createAudioController(): AudioController {
  let audioStarted = false
  let servoPlaying = false
  let aimAssistEnabled = true
  let previousPlayerX = 0
  let previousPlayerY = 0
  let previousPlayerZ = 0
  let passiveRadarTimerSeconds = AUDIO_CONFIG.player.passiveRadarMinIntervalSeconds
  let activeSonarStamp = 0
  let obstructionCueCooldownSeconds = 0
  let obstructionWasBlocked = false
  let sonarEchoVoiceCursor = 0
  let boundaryWarningTimerSeconds = 0
  let boundaryPulseCooldownSeconds = 0

  const rawContext = Tone.getContext().rawContext as AudioContext
  const enemyRuntimes = new Map<string, EnemyAudioRuntime>()

  const footstepAudio = new Audio('assets/sounds/footstep.mp3')
  footstepAudio.preload = 'auto'
  footstepAudio.volume = 0.5

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

  const playerFireSynth = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.04 }
  }).toDestination()

  const pitchCenterConfirmSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 }
  }).toDestination()

  const sonarSweepSynth = new Tone.FMSynth({
    harmonicity: 0.5,
    modulationIndex: 10,
    envelope: { attack: 0.01, decay: 0.18, sustain: 0, release: 0.1 }
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
  const tankHitConfirmSound = new Tone.Player('assets/sounds/explosion_1B.ogg').connect(tankHitConfirmGain)

  const tankDeathConfirmPanner = new Tone.Panner(0).toDestination()
  const tankDeathConfirmGain = new Tone.Gain(1).connect(tankDeathConfirmPanner)
  const tankDeathConfirmSound = new Tone.Player('assets/sounds/explosion_2a.ogg').connect(tankDeathConfirmGain)

  aimAssistOsc.start()

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

  const ensureAudio = async (): Promise<void> => {
    try {
      if (Tone.getContext().state !== 'running') {
        await Tone.start()
      } // end if context not running

      if (!audioStarted) {
        await Tone.loaded()
        footstepAudio.muted = true
        servoAudio.muted = true
        await footstepAudio.play().catch(() => undefined)
        footstepAudio.pause()
        footstepAudio.currentTime = 0
        await servoAudio.play().catch(() => undefined)
        servoAudio.pause()
        servoAudio.currentTime = 0
        footstepAudio.muted = false
        servoAudio.muted = false
        audioStarted = true
      } // end if audio graph not initialized
    } catch {
      // Browser may reject resume when not triggered by a user gesture.
    } // end try/catch ensureAudio
  } // end function ensureAudio

  const getAudioContextState = (): AudioContextState => Tone.getContext().state

  const setAimAssistEnabled = (enabled: boolean): void => {
    aimAssistEnabled = enabled
    if (!enabled) {
      aimAssistGain.gain.rampTo(0, 0.08)
    } // end if disabling aim assist
  } // end function setAimAssistEnabled

  const updateFrameAudio = (dt: number, player: PlayerAudioState, enemies: EnemyAudioState[]): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not started

    const liveEnemyIds = new Set<string>()
    for (const enemy of enemies) {
      liveEnemyIds.add(enemy.id)
      const runtime = getOrCreateEnemyRuntime(enemy.id, enemy.type)
      runtime.updateAudio(dt, enemy, player)
      runtime.onSonarPing(activeSonarStamp, enemy.height)
    } // end for each enemy

    for (const [enemyId, runtime] of enemyRuntimes.entries()) {
      if (!liveEnemyIds.has(enemyId)) {
        runtime.dispose()
        enemyRuntimes.delete(enemyId)
      } // end if runtime not active this frame
    } // end for each runtime

    updatePassiveRadar(dt)
    updateAimAssist(dt, player, enemies)

    previousPlayerX = player.position.x
    previousPlayerY = player.position.y
    previousPlayerZ = player.position.z
  } // end function updateFrameAudio

  const triggerActiveSonar = (): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not started

    activeSonarStamp += 1
    sonarSweepSynth.triggerAttackRelease('C3', AUDIO_CONFIG.player.sonarActiveDurationSeconds)
  } // end function triggerActiveSonar

  const emitEnvironmentalSonar = (echoes: SonarEcho[]): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not started

    const now = Tone.now()
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
      voice.synth.oscillator.type = echo.obstacleType === 'wall' ? 'sine' : 'triangle'
      voice.synth.triggerAttackRelease(frequency, duration, now + delaySeconds)
    } // end for each sonar echo
  } // end function emitEnvironmentalSonar

  const playEnemyThreatCue = (enemyId: string): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not started
    getOrCreateEnemyRuntime(enemyId, AUDIO_CONFIG.tank.type).playThreatCue()
  } // end function playEnemyThreatCue

  const playEnemyAttack = (enemyId: string): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not started
    getOrCreateEnemyRuntime(enemyId, AUDIO_CONFIG.tank.type).playAttack()
  } // end function playEnemyAttack

  const playEnemyHurt = (enemyId: string): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not started
    getOrCreateEnemyRuntime(enemyId, AUDIO_CONFIG.tank.type).playHurt()
  } // end function playEnemyHurt

  const playEnemyDeath = (enemyId: string): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not started
    getOrCreateEnemyRuntime(enemyId, AUDIO_CONFIG.tank.type).playDeath()
  } // end function playEnemyDeath

  const fireGunshot = (): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not started
    playerFireSynth.triggerAttackRelease('16n')
  } // end function fireGunshot

  const playPitchCenterConfirm = (): void => {
    if (!audioStarted || !isAudioContextRunning()) {
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
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not started

    const pan = computePanForWorldPosition(worldX, worldY, playerX, playerY, playerAngle)
    tankHitConfirmPanner.pan.rampTo(pan, 0.01)
    retriggerLoadedPlayer(tankHitConfirmSound)
  } // end function playTankHitConfirm

  const playTankDeathConfirm = (
    worldX: number,
    worldY: number,
    playerX: number,
    playerY: number,
    playerAngle: number
  ): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not started

    const pan = computePanForWorldPosition(worldX, worldY, playerX, playerY, playerAngle)
    tankDeathConfirmPanner.pan.rampTo(pan, 0.01)
    retriggerLoadedPlayer(tankDeathConfirmSound)
  } // end function playTankDeathConfirm

  const playImpact = (
    worldX: number,
    worldY: number,
    playerX: number,
    playerY: number,
    playerAngle: number
  ): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not started

    const relative = worldToListenerSpace(
      { x: worldX, y: worldY, z: 0 },
      { x: playerX, y: playerY, z: 0 },
      playerAngle
    )
    impactPanner.positionX.value = relative.x
    impactPanner.positionY.value = relative.y
    impactPanner.positionZ.value = relative.z
    impactSynth.triggerAttackRelease(220, '16n')
  } // end function playImpact

  const startServo = (): void => {
    if (servoPlaying) {
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
    if (!audioStarted) {
      return
    } // end if audio not started

    footstepAudio.currentTime = 0
    void footstepAudio.play().catch(() => undefined)
  } // end function playFootstep

  const playBump = (): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio not started
    impactSynth.triggerAttackRelease(180, '32n')
  } // end function playBump

  const updatePassiveRadar = (dt: number): void => {
    passiveRadarTimerSeconds -= dt
    if (passiveRadarTimerSeconds > 0) {
      return
    } // end if passive radar timer still running

    passiveRadarSweepSynth.triggerAttackRelease('E3', '8n')
    for (const runtime of enemyRuntimes.values()) {
      runtime.playPassiveRadarEcho()
    } // end for each enemy runtime

    const minSeconds = AUDIO_CONFIG.player.passiveRadarMinIntervalSeconds
    const maxSeconds = AUDIO_CONFIG.player.passiveRadarMaxIntervalSeconds
    passiveRadarTimerSeconds = minSeconds + Math.random() * (maxSeconds - minSeconds)
  } // end function updatePassiveRadar

  const updateAimAssist = (dt: number, player: PlayerAudioState, enemies: EnemyAudioState[]): void => {
    if (!aimAssistEnabled || enemies.length === 0) {
      aimAssistGain.gain.rampTo(0, 0.08)
      return
    } // end if aim assist disabled or no enemies

    let bestDelta = Number.POSITIVE_INFINITY
    for (const enemy of enemies) {
      if (!enemy.isAlive) {
        continue
      } // end if enemy is dead
      const bearing = bearingBetween(enemy.position, player.position)
      const delta = Math.abs(normalizeAngle(bearing - player.angle))
      if (delta < bestDelta) {
        bestDelta = delta
      } // end if better target delta
    } // end for each enemy

    if (!Number.isFinite(bestDelta)) {
      aimAssistGain.gain.rampTo(0, 0.08)
      return
    } // end if no finite target delta

    const clampedDelta = clamp(bestDelta, 0, Math.PI)
    const alignment = 1 - clampedDelta / Math.PI
    const targetFrequency = AUDIO_CONFIG.player.aimAssistBaseFrequency +
      alignment * (AUDIO_CONFIG.player.aimAssistMaxFrequency - AUDIO_CONFIG.player.aimAssistBaseFrequency)
    const currentFrequency = aimAssistOsc.frequency.value
    const currentFrequencyHz = typeof currentFrequency === 'number'
      ? currentFrequency
      : Tone.Frequency(currentFrequency).toFrequency()

    aimAssistOsc.frequency.value = lerp(currentFrequencyHz, targetFrequency, AUDIO_CONFIG.player.aimAssistUpdateLerp)
    aimAssistFilter.frequency.rampTo(600 + alignment * 3200, 0.08)
    aimAssistGain.gain.rampTo(alignment * AUDIO_CONFIG.player.aimAssistGain, 0.08)

    if (clampedDelta < AUDIO_CONFIG.player.aimAssistLockThresholdRadians && Math.abs(player.velocity.x) + Math.abs(player.velocity.y) > 0) {
      aimAssistLockClick.triggerAttackRelease('C6', '64n')
    } // end if aim lock threshold reached

    void dt
  } // end function updateAimAssist

  const updateObstructionAwareness = (dt: number, awareness: ObstructionAwareness): void => {
    if (!audioStarted || !isAudioContextRunning() || !awareness.hasTarget) {
      obstructionWasBlocked = false
      obstructionCueCooldownSeconds = 0
      return
    } // end if audio not started or no target

    obstructionCueCooldownSeconds = Math.max(0, obstructionCueCooldownSeconds - dt)

    if (awareness.isBlocked) {
      const pan = clamp(awareness.obstacleBearingDelta / (Math.PI * 0.5), -1, 1)
      obstructionPanner.pan.rampTo(pan, 0.05)

      if (obstructionCueCooldownSeconds <= 0) {
        const baseFrequency = awareness.obstacleType === 'wall'
          ? 165
          : awareness.obstacleType === 'rock'
            ? 210
            : 270
        const distanceBend = clamp(1.35 - awareness.obstacleDistance / 18, 0.75, 1.4)
        obstructionBlockedSynth.triggerAttackRelease(baseFrequency * distanceBend, '16n')
        obstructionCueCooldownSeconds = 0.24 + clamp(awareness.obstacleDistance * 0.03, 0.04, 0.42)
      } // end if obstacle cue should play
    } // end if target is blocked

    if (obstructionWasBlocked && !awareness.isBlocked) {
      obstructionClearSynth.triggerAttackRelease('C6', '64n')
    } // end if path just became clear

    obstructionWasBlocked = awareness.isBlocked
  } // end function updateObstructionAwareness

  const updateBoundaryZoneCue = (distanceToBoundary: number, dt: number): void => {
    if (!audioStarted || !isAudioContextRunning()) {
      return
    } // end if audio unavailable

    const warningDistance = AUDIO_CONFIG.player.boundaryWarningDistance
    if (distanceToBoundary > warningDistance) {
      boundaryWarningTimerSeconds = 0
      boundaryPulseCooldownSeconds = 0
      return
    } // end if not near map boundary

    const proximity = 1 - clamp(distanceToBoundary / warningDistance, 0, 1)
    const interval =
      AUDIO_CONFIG.player.boundaryWarningIntervalFarSeconds +
      (AUDIO_CONFIG.player.boundaryWarningIntervalNearSeconds - AUDIO_CONFIG.player.boundaryWarningIntervalFarSeconds) * proximity

    boundaryWarningTimerSeconds -= dt
    boundaryPulseCooldownSeconds = Math.max(0, boundaryPulseCooldownSeconds - dt)

    if (boundaryWarningTimerSeconds <= 0) {
      const frequency = 180 + proximity * 520
      const duration = proximity > 0.6 ? '32n' : '64n'
      boundaryWarningSynth.triggerAttackRelease(frequency, duration)
      boundaryWarningTimerSeconds = interval
    } // end if boundary pulse timer elapsed

    if (proximity > 0.78 && boundaryPulseCooldownSeconds <= 0) {
      boundaryUrgencySynth.triggerAttackRelease(220, '64n')
      boundaryPulseCooldownSeconds = 0.32
    } // end if urgent boundary proximity
  } // end function updateBoundaryZoneCue

  const getOrCreateEnemyRuntime = (enemyId: string, enemyType: string): EnemyAudioRuntime => {
    const existing = enemyRuntimes.get(enemyId)
    if (existing) {
      return existing
    } // end if runtime already exists

    const profile = enemyType === AUDIO_CONFIG.tank.type
      ? createTankProfile(enemyId, rawContext)
      : createTankProfile(enemyId, rawContext)
    const runtime = new EnemyAudioRuntime(profile)
    runtime.initializeLoops()
    enemyRuntimes.set(enemyId, runtime)
    return runtime
  } // end function getOrCreateEnemyRuntime

  return {
    ensureAudio,
    startServo,
    stopServo,
    playFootstep,
    playBump,
    playPitchCenterConfirm,
    fireGunshot,
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
    isAudioStarted: () => audioStarted,
    getAudioContextState,
    isServoPlaying: () => servoPlaying
  } // end object audio controller
} // end function createAudioController
