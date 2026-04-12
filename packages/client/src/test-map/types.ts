export interface Player {
  x: number
  y: number
  angle: number
  pitch: number
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
  firePending: boolean
  sonarPingPending: boolean
  snapNorthPending: boolean
  snapEastPending: boolean
  snapSouthPending: boolean
  snapWestPending: boolean
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
  /** 0.0 (chaotic) – 1.0 (perfect): controls the accuracy cone half-angle. */
  accuracy: number
  /** World-unit radius within which target lock engages. */
  lockOnRange: number
  /** Hit damage applied per shot. */
  damagePerShot: number
  /** Bullet travel speed in world units per second. */
  bulletSpeed: number
  /** Maximum bullet travel distance in world units. */
  maxRange: number
  /** Minimum seconds between player shots (0 = unlimited). */
  fireRateCooldownSeconds: number
  /** Horizontal lock-on window as percent of full FOV (0–100, default 100). */
  lockOnWindowWidthPercent: number
  /** Vertical lock-on window as percent of full pitch range (0–100, default 100). */
  lockOnWindowHeightPercent: number
} // end interface WeaponStats

export interface Bullet {
  x: number
  y: number
  angle: number
  pitch: number
  distance: number
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
  fireGunshot: () => void
  playCollisionThud: (direction: number) => void
  playCardinalOrientationCue: (newFacing: number) => void
  setAimAssistEnabled: (enabled: boolean) => void
  isAimAssistEnabled: () => boolean
  updateFrameAudio: (dt: number, player: PlayerAudioState, enemies: EnemyAudioState[], mapData: Uint8Array, sprites: SpriteObject[]) => void
  triggerActiveSonar: (player: PlayerAudioState, enemies: EnemyAudioState[], mapData: Uint8Array, sprites: SpriteObject[]) => void
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
  getCategoryEnabled: (name: AudioCategory) => boolean
  playLockOnChirp: () => void
  playLockLostChirp: () => void
} // end interface AudioController
