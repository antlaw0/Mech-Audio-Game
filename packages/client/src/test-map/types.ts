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
  x: number
  y: number
  angle: number
  velocityX: number
  velocityY: number
  health: number
  maxHealth: number
  alive: boolean
  explosionIntensity: number
} // end interface TankRender

export type SpriteType = 'tree' | 'rock'

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
  startServo: () => void
  stopServo: () => void
  playFootstep: () => void
  playBump: () => void
  playPitchCenterConfirm: () => void
  fireGunshot: () => void
  setAimAssistEnabled: (enabled: boolean) => void
  isAimAssistEnabled: () => boolean
  updateFrameAudio: (dt: number, player: PlayerAudioState, enemies: EnemyAudioState[]) => void
  triggerActiveSonar: () => void
  playEnemyThreatCue: (enemyId: string) => void
  playEnemyAttack: (enemyId: string) => void
  playEnemyHurt: (enemyId: string) => void
  playEnemyDeath: (enemyId: string) => void
  updateObstructionAwareness: (dt: number, awareness: ObstructionAwareness) => void
  updateBoundaryZoneCue: (distanceToBoundary: number, dt: number) => void
  emitEnvironmentalSonar: (echoes: SonarEcho[]) => void
  playTankHitConfirm: (worldX: number, worldY: number, playerX: number, playerY: number, playerAngle: number) => void
  playTankDeathConfirm: (worldX: number, worldY: number, playerX: number, playerY: number, playerAngle: number) => void
  playImpact: (worldX: number, worldY: number, playerX: number, playerY: number, playerAngle: number) => void
  isAudioStarted: () => boolean
  getAudioContextState: () => AudioContextState
  isServoPlaying: () => boolean
} // end interface AudioController
