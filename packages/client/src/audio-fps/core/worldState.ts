import worldConfig from '../config/worldConfig.json'
import { EnemyDrone, EnemyHelicopter, EnemyMech, EnemyTank } from '../entities/enemyTank.js'
import { createPlayer } from '../entities/player.js'
import type { EnemyState, EnemyType, Obstacle, ObstacleMaterial, WorldState } from './worldTypes.js'

const createEnemyByType = (id: string, type: EnemyType, x: number, y: number): EnemyState => {
  if (type === 'tank') {
    return new EnemyTank(id, x, y).state
  }
  if (type === 'mech') {
    return new EnemyMech(id, x, y).state
  }
  if (type === 'helicopter') {
    return new EnemyHelicopter(id, x, y).state
  }
  return new EnemyDrone(id, x, y).state
}

export const createWorldState = (devMode = true): WorldState => ({
  devMode,
  timeSeconds: 0,
  bounds: worldConfig.boundaries,
  objective: worldConfig.objective,
  player: createPlayer(worldConfig.playerSpawn.x, worldConfig.playerSpawn.y, worldConfig.playerSpawn.heading),
  enemies: worldConfig.enemySpawns.map((spawn) => createEnemyByType(spawn.id, spawn.type as EnemyType, spawn.x, spawn.y)),
  obstacles: worldConfig.obstacles.map((obstacle) => ({
    ...obstacle,
    material: obstacle.material as ObstacleMaterial
  })) as Obstacle[],
  bullets: [],
  debug: {
    fps: 0,
    playerX: worldConfig.playerSpawn.x,
    playerY: worldConfig.playerSpawn.y,
    headingDeg: 0,
    nearestObstacleDistance: 0,
    enemyCount: worldConfig.enemySpawns.length,
    sonarSweepSeconds: 0
  }
})
