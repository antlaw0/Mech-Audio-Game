import worldConfig from '../config/worldConfig.json'
import { createEnemyControllerByType } from '../entities/enemyFactory.js'
import { createPlayer } from '../entities/player.js'
import type { EnemyState, EnemyType, Obstacle, ObstacleMaterial, WorldState } from './worldTypes.js'

const createEnemyByType = (id: string, type: EnemyType, x: number, y: number): EnemyState => {
  return createEnemyControllerByType(id, type, x, y, worldConfig.verticality.airLayerHeight).state
}

export const createWorldState = (devMode = true): WorldState => ({
  devMode,
  timeSeconds: 0,
  verticality: worldConfig.verticality,
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
