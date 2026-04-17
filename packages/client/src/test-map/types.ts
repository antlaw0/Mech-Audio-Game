export type PlayerFlightState = 'grounded' | 'ascending' | 'airborne' | 'descending'
import { type WorldCollisionWorld } from './world-collision.js'


export interface Player {
  x: number
  y: number
  angle: number
  pitch: number
  z?: number
  flightState?: PlayerFlightState
  isFlying?: boolean
} // end interface Player

export interface InputState {
  moveForward: boolean
  moveBack: boolean
  strafeLeft: boolean
  strafeRight: boolean
  turnLeft: boolean
  turnRight: boolean
  lookUp: boolean
  lookDown: boolean
  pitchResetPending: boolean
  fireHeld: boolean
  firePending: boolean
  flightTogglePending: boolean
  sonarPingPending: boolean
  snapNorthPending: boolean
  snapEastPending: boolean
  snapSouthPending: boolean
  snapWestPending: boolean
  cycleWeaponPending: boolean
  selectedWeaponSlot: number | null
  spawnTankPending: boolean
  spawnStrikerPending: boolean
  spawnBrutePending: boolean
  spawnHelicopterPending: boolean
} // end interface InputState

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

export interface TargetLockState {
  lockedTankId: number | null
} // end interface TargetLockState

export interface WeaponStats {
  /** Weapon archetype affects firing behavior and lock requirements. */
  weaponType: 'ballistic' | 'missile'
  /** 0.0 (chaotic) – 1.0 (perfect): offsets the entire projectile spread cone from the aim direction. */
  accuracy: number
  /** World-unit radius within which target lock engages. */
  lockOnRange: number
  /** Hit damage applied per shot. */
  damagePerShot: number
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
} // end interface WeaponStats

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
  kind: 'bullet' | 'missile'
  trail: TrailPoint[]
  alive: boolean
} // end interface Bullet

export interface EnemyRender {
  x: number
  y: number
  radius: number
  alive: boolean
} // end interface EnemyRender

export interface TankRender {
  id: number
  enemyType: string
  x: number
  y: number
  radius: number
  angle: number
  velocityX: number
  velocityY: number
  airborne: boolean
  height: number
  health: number
  maxHealth: number
  alive: boolean
  explosionIntensity: number
} // end interface TankRender

export interface IncomingProjectileAudioState {
  id: number
  x: number
  y: number
  velocityX: number
  velocityY: number
  distanceToPlayer: number
} // end interface IncomingProjectileAudioState

export type SpriteType = 'tree' | 'rock'

export type AudioCategory = 'proximity' | 'objects' | 'enemies' | 'navigation'

export type AudioVolumeChannel = AudioCategory | 'master' | 'ambience' | 'servo' | 'footsteps' | 'flightLoop'

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

export interface AudioController {
  ensureAudio: () => Promise<void>
  playPauseOpenChirp: () => void
  playPauseCloseChirp: () => void
  pauseAllAudio: () => Promise<void>
  resumeAllAudio: () => Promise<void>
  startServo: () => void
  stopServo: () => void
  playFootstep: () => void
  stopFootstep: () => void
  playBump: () => void
  playPitchCenterConfirm: () => void
  fireGunshot: (soundPath?: string) => void
  startFlightLoop: () => void
  stopFlightLoop: () => void
  playHardLanding: () => void
  playCollisionThud: (direction: number) => void
  playCardinalOrientationCue: (newFacing: number) => void
  setAimAssistEnabled: (enabled: boolean) => void
  isAimAssistEnabled: () => boolean
  updateFrameAudio: (dt: number, player: PlayerAudioState, enemies: EnemyAudioState[], collisionWorld: WorldCollisionWorld, sprites: SpriteObject[]) => void
  triggerActiveSonar: (player: PlayerAudioState, enemies: EnemyAudioState[], collisionWorld: WorldCollisionWorld, sprites: SpriteObject[]) => void
  playEnemyThreatCue: (enemyId: string, enemyType?: string) => void
  playEnemyAttack: (enemyId: string, enemyType?: string) => void
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
  playLockOnChirp: () => void
  playLockLostChirp: () => void
  playMissileLockTone: () => void
  playMissileLockConfirmTone: () => void
  playNegativeActionTone: () => void
  playExplosion: (
    worldX: number,
    worldY: number,
    playerX: number,
    playerY: number,
    playerAngle: number,
    soundCandidates: string[]
  ) => void
} // end interface AudioController
