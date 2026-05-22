import { isInsideUrbanDistrictAtPosition } from './scene-layout.js'

export const SURFACE_MATERIAL = {
  dirt: 'dirt',
  stone: 'stone',
  wood: 'wood',
  metal: 'metal',
  water: 'water',
  energy: 'energy',
  shield: 'shield',
  flesh: 'flesh',
  unknown: 'unknown'
} as const

export type SurfaceMaterial = typeof SURFACE_MATERIAL[keyof typeof SURFACE_MATERIAL]

export type WorldObstacleMaterialHint = 'wall' | 'tree' | 'rock' | 'pillar' | null | undefined

export function resolveSurfaceMaterialFromObstacleHint(obstacleType: WorldObstacleMaterialHint): SurfaceMaterial {
  if (obstacleType === 'tree') {
    return SURFACE_MATERIAL.wood
  }
  if (obstacleType === 'pillar') {
    return SURFACE_MATERIAL.stone
  }
  if (obstacleType === 'rock' || obstacleType === 'wall') {
    return SURFACE_MATERIAL.stone
  }
  return SURFACE_MATERIAL.unknown
}

export function resolveSurfaceMaterialAtPosition(x: number, y: number): SurfaceMaterial {
  if (isInsideUrbanDistrictAtPosition(x, y)) {
    return SURFACE_MATERIAL.stone
  }
  return SURFACE_MATERIAL.dirt
}

export function resolveWorldSurfaceMaterial(x: number, y: number, obstacleType?: WorldObstacleMaterialHint): SurfaceMaterial {
  const fromObstacle = resolveSurfaceMaterialFromObstacleHint(obstacleType)
  if (fromObstacle !== SURFACE_MATERIAL.unknown) {
    return fromObstacle
  }
  return resolveSurfaceMaterialAtPosition(x, y)
}