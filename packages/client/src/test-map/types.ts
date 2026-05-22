export type PlayerFlightState = 'grounded' | 'ascending' | 'airborne' | 'descending'
import { type WorldCollisionWorld } from './world-collision.js'
import type { WeaponMountSlot } from '../data/parts/types.js'


export interface Player {
  name: string
  x: number
  y: number
  angle: number
  pitch: number
  hp: number
  maxHp: number
  ep: number
  maxEp: number
  z?: number
  flightState?: PlayerFlightState
  isFlying?: boolean
  isBoosting?: boolean
} // end interface Player

export interface InputState {
  moveForward: boolean
  moveBack: boolean
  strafeLeft: boolean
  strafeRight: boolean
  toggleWorldMapPending: boolean
  turnLeft: boolean
  turnRight: boolean
  lookUp: boolean
  lookDown: boolean
  subsystemSelectModifier: boolean
  pitchResetPending: boolean
  fireHeld: boolean
  firePending: boolean
  reloadPending: boolean
  meleePending: boolean
  flightTogglePending: boolean
  sonarPingPending: boolean
  snapNorthPending: boolean
  snapEastPending: boolean
  snapSouthPending: boolean
  snapWestPending: boolean
  snapLeftPending: boolean
  snapRightPending: boolean
  selectedWeaponSlot: WeaponMountSlot | null
  spawnTankPending: boolean
  spawnStrikerPending: boolean
  spawnBrutePending: boolean
  spawnHelicopterPending: boolean
  spawnBruiserPending: boolean
  spawnTestDummyPending: boolean
  refillEpPending: boolean
  refillHpPending: boolean
  speakHpPending: boolean
  speakEpPending: boolean
  speakCoordsPending: boolean
  speakDestinationPending: boolean
  boostTogglePending: boolean
} // end interface InputState

export type ReloadTimelineSegment =
  | {
      type: 'audio'
      soundPath: string
    }
  | {
      type: 'pause'
      durationMs: number
    }

export type ReloadServoEffectType = 'pitch' | 'distortion' | 'gain' | 'volume' | 'lowpass'

export interface ReloadServoEffect {
  type: ReloadServoEffectType
  startMs: number
  endMs: number
  magnitude: number
} // end interface ReloadServoEffect

export interface WeaponReloadDefinition {
  timeline: ReloadTimelineSegment[]
  servoLoopSoundPath: string
  servoEffects: ReloadServoEffect[]
} // end interface WeaponReloadDefinition

export interface WorldPosition {
  x: number
  y: number
  z: number
} // end interface WorldPosition

export interface WorldVelocity {
  x: number
  y: number
  z: number
} // end interface WorldVelocity

export interface PlayerAudioState {
  position: WorldPosition
  angle: number
  velocity: WorldVelocity
  isFlying: boolean
} // end interface PlayerAudioState

export type FlightAudioType = 'jet' | 'rotor'

export interface FlightLoopStartParams {
  flightType?: FlightAudioType
  rotorCount?: number
  spinUpSeconds?: number
} // end interface FlightLoopStartParams

export interface FlightLoopStopParams {
  quickSpinDown?: boolean
} // end interface FlightLoopStopParams

export interface FlightLoopUpdateParams {
  flightType?: FlightAudioType
  flightState: PlayerFlightState
  normalizedSpeed: number
  rotorCount?: number
  spinProgress?: number
  spinUpSeconds?: number
  boosting?: boolean
} // end interface FlightLoopUpdateParams

export interface EnemyAudioState {
  id: string
  type: string
  category: string
  position: WorldPosition
  radius: number
  velocity: WorldVelocity
  facingAngle: number
  isMoving: boolean
  isAlive: boolean
  height: number
  positionalLoopSound?: string
  loopSoundPauseIntervalMs?: number
  loopSoundMaxDistance?: number
  stopLoopSoundWhileStationary?: boolean
} // end interface EnemyAudioState

export interface ObstructionAwareness {
  hasTarget: boolean
  isBlocked: boolean
  obstacleType: 'wall' | SpriteType | null
  obstacleDistance: number
  obstacleBearingDelta: number
  targetDistance: number
} // end interface ObstructionAwareness

export interface SonarEcho {
  distance: number
  relativeAngle: number
  obstacleType: 'wall' | SpriteType
} // end interface SonarEcho

export interface AudioOcclusionRayDiagnostic {
  start: WorldPosition
  end: WorldPosition
  blockerCount: number
  thickness: number
  absorption: number
  occlusionAmount: number
} // end interface AudioOcclusionRayDiagnostic

export interface AudioOcclusionDiagnostics {
  entityId: string | number
  blockerCount: number
  blockerThickness: number
  materialAbsorption: number
  occlusionAmount: number
  smoothedOcclusionAmount: number
  sampledRayCount: number
  lastQueryTimeSeconds: number
  rays: AudioOcclusionRayDiagnostic[]
} // end interface AudioOcclusionDiagnostics

export interface FrontBackSpatialDiagnostics {
  emitterId: string
  distance: number
  behindSigned: number
  behindAmount: number
  targetBehindAmount: number
  turnBoost: number
  lowpassHz: number
  rearDiffuseGain: number
  rearReflectionGain: number
  rearWidthGain: number
  enhancementEnabled: boolean
  rearCueLayerEnabled: boolean
} // end interface FrontBackSpatialDiagnostics

export interface FrontBackSpatialSettings {
  enabled: boolean
  rearCueLayerEnabled: boolean
  intensity: number
  debugLogging: boolean
  debugFrameInterval: number
} // end interface FrontBackSpatialSettings

export interface TargetLockState {
  currentTargetId: number | null
  lockProgress: number
  targetScore: number
  retainedTargetId: number | null
  retentionActive: boolean
  selectedSubsystem: string | null
} // end interface TargetLockState

export interface WeaponStats {
  /** Weapon archetype affects firing behavior and lock requirements. */
  weaponType: 'ballistic' | 'missile' | 'energy'
  /** Damage channel used by this weapon profile. */
  damageType: string
  /** Projectile visual category used by renderer and combat spawning. */
  projectileType: 'bullet' | 'rocket' | 'missile' | 'laserBeam'
  /** 0.0 (chaotic) – 1.0 (perfect): offsets the entire projectile spread cone from the aim direction. */
  accuracy: number
  /** World-unit radius within which target lock engages. */
  lockOnRange: number
  /** Hit damage applied per shot. */
  damagePerShot: number
  /** Movement accuracy mitigation multiplier. Higher values reduce movement-induced inaccuracy. */
  stability: number
  /** Number of projectiles fired simultaneously for each shot. */
  projectileCount: number
  /** Half-angle of the per-projectile spread cone in degrees. */
  spreadDegrees: number
  /** Bullet travel speed in world units per second. */
  bulletSpeed: number
  /** Maximum bullet travel distance in world units. */
  maxRange: number
  /** Whether holding fire should continuously shoot while cooldown allows. */
  isFullAuto: boolean
  /** Minimum seconds between player shots (0 = unlimited). */
  fireRateCooldownSeconds: number
  /** Projectile collision radius in world units. */
  projectileSize: number
  /** Horizontal lock-on window as percent of full FOV (0–100, default 100). */
  lockOnWindowWidthPercent: number
  /** Vertical lock-on window as percent of full pitch range (0–100, default 100). */
  lockOnWindowHeightPercent: number
  /** Time in milliseconds a target must stay locked before missile fire is allowed. */
  lockOnTimeMs: number
  /** Missile guidance strength (0–1). */
  trackingRating: number
  /** Missile explosion radius in world units. */
  explosionRadius: number
  /** Base missile explosion damage before distance falloff. */
  explosionDamage: number
  /** Explosion sound candidates. One is picked per explosion. */
  explosionSounds: string[]
  /** Number of shots available in a full clip. */
  clipSize: number
  /** Current rounds available in this weapon's clip. */
  ammoInClip: number
  /** Universal ammo resource consumed per round loaded into this weapon's clip. */
  ammoResourcePerRound: number
  /** Optional explicit heat generated per trigger pull. Falls back to runtime-derived value when omitted. */
  heatPerShot?: number
  /** Optional EP consumed per trigger pull. */
  energyCostPerShot?: number
  /** Reload timeline that defines clip audio sequencing and synchronized servo automation. */
  reloadDefinition: WeaponReloadDefinition
} // end interface WeaponStats

export interface MeleeWeaponStats {
  damagePerSwing: number
  meleeCooldownSeconds: number
  reach: number
  coneAngleDegrees: number
} // end interface MeleeWeaponStats

export interface TrailPoint {
  x: number
  y: number
  z: number
} // end interface TrailPoint

export interface Bullet {
  x: number
  y: number
  angle: number
  pitch: number
  zOrigin: number
  distance: number
  radius: number
  kind: 'bullet' | 'rocket' | 'missile' | 'laserBeam'
  trail: TrailPoint[]
  alive: boolean
} // end interface Bullet

export interface TargetableEnemyRender {
  id: number
  enemyClass: string
  enemyType: string
  /** Ticket 23A: layout used for subsystem targeting navigation. */
  layoutId: import('./target-layout.js').TargetLayoutId
  x: number
  y: number
  radius: number
  height: number
  alive: boolean
} // end interface TargetableEnemyRender

export interface EnemyRender extends TargetableEnemyRender {
} // end interface EnemyRender

export interface CombatEnemyRender extends TargetableEnemyRender {
  angle: number
  velocityX: number
  velocityY: number
  airborne: boolean
  health: number
  maxHealth: number
  explosionIntensity: number
  positionalLoopSound?: string
  loopSoundPauseIntervalMs?: number
  loopSoundMaxDistance?: number
  stopLoopSoundWhileStationary?: boolean
} // end interface CombatEnemyRender

export interface IncomingProjectileAudioState {
  id: number
  x: number
  y: number
  velocityX: number
  velocityY: number
  distanceToPlayer: number
} // end interface IncomingProjectileAudioState

export type SpriteType = 'tree' | 'rock' | 'pillar'

export type AudioCategory = 'proximity' | 'objects' | 'enemies' | 'navigation'

export type AudioVolumeChannel = AudioCategory | 'master' | 'ambience' | 'music' | 'servo' | 'footsteps' | 'flightLoop' | 'energyStatus'

export interface SpriteObject {
  x: number
  y: number
  type: SpriteType
  radius: number
} // end interface SpriteObject

export interface RayHit {
  hit: boolean
  dist: number
  side: 0 | 1
  mapCol: number
  mapRow: number
} // end interface RayHit

export interface RenderContext {
  canvasWidth: number
  canvasHeight: number
  centerY: number
  projectionPlane: number
} // end interface RenderContext

export type FootstepTerrainLayer = 'default' | 'building' | 'city' | 'town'

export interface AudioController {
  ensureAudio: () => Promise<void>
  playPauseOpenChirp: () => void
  playPauseCloseChirp: () => void
  pauseAllAudio: () => Promise<void>
  resumeAllAudio: () => Promise<void>
  startServo: () => void
  stopServo: () => void
  playFootstep: (terrainLayer?: FootstepTerrainLayer) => void
  stopFootstep: () => void
  updatePlayerMobilityAudio: (
    mobilityType: 'Wheels' | 'Treads' | 'Hover' | 'Walker' | 'Flight' | 'Placeholder',
    normalizedSpeed: number,
    normalizedForward: number,
    accelerating: boolean,
    grounded: boolean
  ) => void
  playBump: () => void
  playPitchCenterConfirm: () => void
  fireGunshot: (soundPath?: string) => void
  playWeaponReloadSequence: (definition: WeaponReloadDefinition) => Promise<void>
  startFlightLoop: (params?: FlightLoopStartParams) => void
  stopFlightLoop: (params?: FlightLoopStopParams) => void
  updateFlightLoopAudio: (params: FlightLoopUpdateParams) => void
  startBoostAudio: () => void
  stopBoostAudio: () => void
  playHardLanding: () => void
  playCollisionThud: (direction: number) => void
  playCardinalOrientationCue: (newFacing: number) => void
  setAimAssistEnabled: (enabled: boolean) => void
  isAimAssistEnabled: () => boolean
  updateFrameAudio: (dt: number, player: PlayerAudioState, enemies: EnemyAudioState[], collisionWorld: WorldCollisionWorld, sprites: SpriteObject[]) => void
  updateNavigationDestinationCue: (player: PlayerAudioState, destination: WorldPosition | null) => void
  triggerActiveSonar: (player: PlayerAudioState, enemies: EnemyAudioState[], collisionWorld: WorldCollisionWorld, sprites: SpriteObject[]) => void
  playEnemyThreatCue: (enemyId: string, enemyType?: string) => void
  playEnemyAttack: (enemyId: string, enemyType?: string, burstProjectileCount?: number) => void
  playEnemyHurt: (enemyId: string, enemyType?: string) => void
  playEnemyDeath: (enemyId: string, enemyType?: string) => void
  updateObstructionAwareness: (dt: number, awareness: ObstructionAwareness) => void
  updateBoundaryZoneCue: (distanceToBoundary: number, dt: number) => void
  emitEnvironmentalSonar: (echoes: SonarEcho[]) => void
  playTankHitConfirm: (worldX: number, worldY: number, playerX: number, playerY: number, playerAngle: number) => void
  playTankDeathConfirm: (worldX: number, worldY: number, playerX: number, playerY: number, playerAngle: number) => void
  playImpact: (worldX: number, worldY: number, playerX: number, playerY: number, playerAngle: number, timeOffsetSeconds?: number) => void
  playPlayerMechHit: () => void
  updateIncomingProjectileAudio: (projectiles: IncomingProjectileAudioState[], playerX: number, playerY: number, playerAngle: number) => void
  playProjectileNearMiss: (
    projectileType: 'bullet' | 'projectile',
    worldX: number,
    worldY: number,
    playerX: number,
    playerY: number,
    playerAngle: number,
    closestDistance: number,
    nearMissRadius: number
  ) => void
  isAudioStarted: () => boolean
  getAudioContextState: () => AudioContextState
  isServoPlaying: () => boolean
  toggleCategory: (name: AudioCategory) => boolean
  setCategoryEnabled: (name: AudioCategory, enabled: boolean) => boolean
  getCategoryEnabled: (name: AudioCategory) => boolean
  setVolumeChannel: (name: AudioVolumeChannel, value: number) => number
  getVolumeChannel: (name: AudioVolumeChannel) => number
  setDebugPitchScale: (value: number) => number
  getDebugPitchScale: () => number
  setMusicTrack: (name: string) => string
  getMusicTrack: () => string
  getMusicTracks: () => string[]
  playLockOnChirp: () => void
  playLockLostChirp: () => void
  playMissileLockTone: () => void
  playMissileLockConfirmTone: () => void
  updateTargetLockProgressAudio: (
    deltaSeconds: number,
    hasActiveLock: boolean,
    hasRetentionLock: boolean,
    lockProgress: number,
    maxLockProgress: number,
    targetPos?: WorldPosition
  ) => void
  resetTargetLockProgressAudio: () => void
  playNegativeActionTone: () => void
  playExplosion: (
    worldX: number,
    worldY: number,
    playerX: number,
    playerY: number,
    playerAngle: number,
    soundCandidates: string[]
  ) => void
  playCardinalHeadingCueForFacing: (playerAngle: number) => void
  playPlayerHealthStatusTone: (hpPercent: number) => void
  updatePlayerHealthStatusAudio: (dt: number, hpPercent: number) => void
  updatePlayerEnergyStatusAudio: (dt: number, epPercent: number) => void
  updatePlayerHeatStatusAudio: (dt: number, heatPercent: number) => void
  prewarmEnemyAudioAssets: () => void
  setOcclusionDebugLogging: (enabled: boolean) => void
  setOcclusionDebugVisualizationHook: (hook: ((diagnostics: AudioOcclusionDiagnostics) => void) | null) => void
  getOcclusionDiagnostics: (emitterId: string | number) => AudioOcclusionDiagnostics | null
  getAllOcclusionDiagnostics: () => AudioOcclusionDiagnostics[]
  setFrontBackEnhancementEnabled: (enabled: boolean) => void
  isFrontBackEnhancementEnabled: () => boolean
  setFrontBackRearCueLayerEnabled: (enabled: boolean) => void
  isFrontBackRearCueLayerEnabled: () => boolean
  setFrontBackEnhancementIntensity: (intensity: number) => number
  getFrontBackEnhancementIntensity: () => number
  setFrontBackDebugLogging: (enabled: boolean) => void
  getFrontBackSettings: () => FrontBackSpatialSettings
  getFrontBackDiagnostics: (emitterId: string) => FrontBackSpatialDiagnostics | null
  getAllFrontBackDiagnostics: () => FrontBackSpatialDiagnostics[]
  getAudioDiagnostics: () => {
    activeEnemyRuntimes: number
    occlusionEmitters: number
  }
} // end interface AudioController
