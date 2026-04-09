import type { Vec2 } from '../utils/vector.js'

export type ObstacleMaterial = 'metal' | 'concrete' | 'foliage'
export type EnemyType = 'tank' | 'mech' | 'helicopter' | 'drone'

export interface WorldBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Obstacle {
  id: string
  x: number
  y: number
  radius: number
  material: ObstacleMaterial
}

export interface Objective {
  x: number
  y: number
}

export interface PlayerState {
  position: Vec2
  velocity: Vec2
  heading: number
  health: number
}

export interface EnemyState {
  id: string
  type: EnemyType
  position: Vec2
  velocity: Vec2
  heading: number
  health: number
  alive: boolean
  inCover: boolean
  seesPlayer: boolean
  fireCooldown: number
}

export interface BulletState {
  id: string
  ownerId: string
  position: Vec2
  velocity: Vec2
  lifeSeconds: number
}

export interface SweepResult {
  nearestWallDistance: number
  nearestOpenCorridorAngle: number
  nearestObjectiveDistance: number
  nearestObjectiveAngle: number
  nearestEnemyDistance: number
  nearestEnemyAngle: number
}

export interface NavigationPingHit {
  distance: number
  angle: number
  material: ObstacleMaterial | 'none'
}

export interface CollisionResult {
  hit: boolean
  correctedPosition: Vec2
  normal: Vec2
}

export interface DebugValues {
  fps: number
  playerX: number
  playerY: number
  headingDeg: number
  nearestObstacleDistance: number
  enemyCount: number
  sonarSweepSeconds: number
}

export interface WorldState {
  devMode: boolean
  timeSeconds: number
  bounds: WorldBounds
  objective: Objective
  player: PlayerState
  enemies: EnemyState[]
  obstacles: Obstacle[]
  bullets: BulletState[]
  debug: DebugValues
}
