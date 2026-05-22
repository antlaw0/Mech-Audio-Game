import * as THREE from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { MAP_HEIGHT, MAP_WIDTH } from './constants.js'
import { getCell } from './map-data.js'
import type { SpriteObject } from './types.js'

export const WORLD_WALL_HEIGHT = 3.2
export const PLAYER_COLLISION_HEIGHT = 1.7
export const PLAYER_EYE_HEIGHT = 0.66

const WORLD_COLLISION_CHUNK_SIZE = 32
const COLLISION_RAY_EPSILON = 0.0001
const TERRAIN_RAY_START_PADDING = 0.6

interface Point3D {
  x: number
  y: number
  z: number
} // end interface Point3D

type ObstacleType = 'wall' | 'tree' | 'rock' | 'pillar'

export interface WorldTraceHit {
  distance: number
  x: number
  y: number
  z: number
  obstacleType: ObstacleType
} // end interface WorldTraceHit

interface WallCollider {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  zMin: number
  zMax: number
} // end interface WallCollider

interface RoundCollider {
  x: number
  y: number
  radius: number
  zMin: number
  zMax: number
  type: 'tree' | 'rock' | 'pillar'
} // end interface RoundCollider

interface FaceTypeRange {
  faceStart: number
  faceEnd: number
  obstacleType: ObstacleType
}

interface CollisionChunk {
  key: string
  chunkX: number
  chunkY: number
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  collisionMesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>
  faceTypeRanges: FaceTypeRange[]
  triangleCount: number
  bvhBuildMs: number
}

interface CollisionRayMetric {
  count: number
  totalMs: number
  maxMs: number
  lastMs: number
}

interface CollisionFrameMetric {
  raycastCount: number
  raycastTotalMs: number
  raycastMaxMs: number
  activeChunkCount: number
  activeChunkKeys: string[]
}

interface CollisionLifetimeMetric {
  raycastCount: number
  raycastTotalMs: number
  raycastMaxMs: number
}

export interface WorldCollisionDiagnostics {
  bvhEnabled: boolean
  chunkSize: number
  totalChunks: number
  totalTriangles: number
  bvhBuildMs: number
  frame: {
    raycastCount: number
    raycastTotalMs: number
    raycastAverageMs: number
    raycastMaxMs: number
    activeChunkCount: number
    activeChunkKeys: string[]
  }
  lifetime: {
    raycastCount: number
    raycastTotalMs: number
    raycastAverageMs: number
    raycastMaxMs: number
  }
  observerChunk: {
    chunkX: number
    chunkY: number
  }
}

interface DebugRaySample {
  start: Point3D
  end: Point3D
  hit: WorldTraceHit | null
}

type DebugRayVisualizationHook = (sample: DebugRaySample) => void

type BufferGeometryWithBvh = THREE.BufferGeometry & {
  computeBoundsTree?: (options?: { maxLeafTris?: number }) => void
  disposeBoundsTree?: () => void
}

export interface WorldCollisionWorld {
  walls: WallCollider[]
  roundObstacles: RoundCollider[]
  wallSet: Set<number>
  chunks: CollisionChunk[]
  chunkSize: number
  maxObstacleHeight: number
  observerChunkX: number
  observerChunkY: number
  chunkLookup: Map<string, CollisionChunk>
  roundObstacleChunkLookup: Map<string, RoundCollider[]>
  raycaster: THREE.Raycaster
  rayMetricFrame: CollisionRayMetric
  rayMetricLifetime: CollisionRayMetric
  frameMetric: CollisionFrameMetric
  lifetimeMetric: CollisionLifetimeMetric
  bvhBuildMs: number
  bvhTriangleCount: number
  debugRayHook: DebugRayVisualizationHook | null
  activeChunkKeySet: Set<string>
} // end interface WorldCollisionWorld

export interface SurfaceEdgeContact {
  distance: number
  worldX: number
  worldY: number
} // end interface SurfaceEdgeContact

let hasPatchedThreeMeshRaycast = false

function patchThreeRaycastingWithBvh(): void {
  if (hasPatchedThreeMeshRaycast) {
    return
  }

  ;(THREE.Mesh.prototype as unknown as { raycast: THREE.Mesh['raycast'] }).raycast = acceleratedRaycast
  ;(THREE.BufferGeometry.prototype as unknown as BufferGeometryWithBvh).computeBoundsTree = computeBoundsTree
  ;(THREE.BufferGeometry.prototype as unknown as BufferGeometryWithBvh).disposeBoundsTree = disposeBoundsTree
  hasPatchedThreeMeshRaycast = true
}

function toChunkCoordinate(value: number, chunkSize: number): number {
  return Math.floor(value / chunkSize)
}

function toChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function toRoundObstacle(sprite: SpriteObject): RoundCollider {
  if (sprite.type === 'tree') {
    return {
      x: sprite.x,
      y: sprite.y,
      radius: Math.max(0.25, sprite.radius),
      zMin: 0,
      zMax: 2.4,
      type: 'tree'
    }
  }

  if (sprite.type === 'pillar') {
    return {
      x: sprite.x,
      y: sprite.y,
      radius: Math.max(0.3, sprite.radius),
      zMin: 0,
      zMax: 3.1,
      type: 'pillar'
    }
  }

  return {
    x: sprite.x,
    y: sprite.y,
    radius: Math.max(0.25, sprite.radius),
    zMin: 0,
    zMax: 1.05,
    type: 'rock'
  }
}

function pushTriangle(positions: number[], a: Point3D, b: Point3D, c: Point3D): void {
  positions.push(a.x, a.z, a.y)
  positions.push(b.x, b.z, b.y)
  positions.push(c.x, c.z, c.y)
}

function addBoxTriangles(positions: number[], box: WallCollider): number {
  const p000 = { x: box.xMin, y: box.yMin, z: box.zMin }
  const p100 = { x: box.xMax, y: box.yMin, z: box.zMin }
  const p010 = { x: box.xMin, y: box.yMax, z: box.zMin }
  const p110 = { x: box.xMax, y: box.yMax, z: box.zMin }
  const p001 = { x: box.xMin, y: box.yMin, z: box.zMax }
  const p101 = { x: box.xMax, y: box.yMin, z: box.zMax }
  const p011 = { x: box.xMin, y: box.yMax, z: box.zMax }
  const p111 = { x: box.xMax, y: box.yMax, z: box.zMax }

  // Bottom
  pushTriangle(positions, p000, p100, p110)
  pushTriangle(positions, p000, p110, p010)
  // Top
  pushTriangle(positions, p001, p011, p111)
  pushTriangle(positions, p001, p111, p101)
  // Front/back
  pushTriangle(positions, p000, p001, p101)
  pushTriangle(positions, p000, p101, p100)
  pushTriangle(positions, p010, p110, p111)
  pushTriangle(positions, p010, p111, p011)
  // Left/right
  pushTriangle(positions, p000, p010, p011)
  pushTriangle(positions, p000, p011, p001)
  pushTriangle(positions, p100, p101, p111)
  pushTriangle(positions, p100, p111, p110)

  return 12
}

function addCylinderTriangles(positions: number[], obstacle: RoundCollider, radialSegments = 10): number {
  const segments = Math.max(6, radialSegments)
  let triangles = 0
  const centerTop = { x: obstacle.x, y: obstacle.y, z: obstacle.zMax }
  const centerBottom = { x: obstacle.x, y: obstacle.y, z: obstacle.zMin }

  for (let index = 0; index < segments; index += 1) {
    const a0 = (index / segments) * Math.PI * 2
    const a1 = ((index + 1) / segments) * Math.PI * 2

    const bottom0 = {
      x: obstacle.x + Math.cos(a0) * obstacle.radius,
      y: obstacle.y + Math.sin(a0) * obstacle.radius,
      z: obstacle.zMin
    }
    const bottom1 = {
      x: obstacle.x + Math.cos(a1) * obstacle.radius,
      y: obstacle.y + Math.sin(a1) * obstacle.radius,
      z: obstacle.zMin
    }
    const top0 = {
      x: bottom0.x,
      y: bottom0.y,
      z: obstacle.zMax
    }
    const top1 = {
      x: bottom1.x,
      y: bottom1.y,
      z: obstacle.zMax
    }

    // Side surface
    pushTriangle(positions, bottom0, top0, top1)
    pushTriangle(positions, bottom0, top1, bottom1)
    triangles += 2

    // Top and bottom caps
    pushTriangle(positions, centerTop, top0, top1)
    pushTriangle(positions, centerBottom, bottom1, bottom0)
    triangles += 2
  }

  return triangles
}

function circleIntersectsAabb(x: number, y: number, radius: number, box: WallCollider): boolean {
  const clampedX = Math.max(box.xMin, Math.min(x, box.xMax))
  const clampedY = Math.max(box.yMin, Math.min(y, box.yMax))
  const dx = x - clampedX
  const dy = y - clampedY
  return (dx * dx) + (dy * dy) <= radius * radius
}

function hasVerticalOverlap(zMinA: number, zMaxA: number, zMinB: number, zMaxB: number): boolean {
  return zMinA < zMaxB && zMaxA > zMinB
}

function isWallCellFilled(world: WorldCollisionWorld, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= MAP_WIDTH || row >= MAP_HEIGHT) {
    return false
  }
  return world.wallSet.has(row * MAP_WIDTH + col)
}

function getChunksInAabb(world: WorldCollisionWorld, xMin: number, xMax: number, yMin: number, yMax: number): CollisionChunk[] {
  const chunkXMin = toChunkCoordinate(xMin, world.chunkSize)
  const chunkXMax = toChunkCoordinate(xMax, world.chunkSize)
  const chunkYMin = toChunkCoordinate(yMin, world.chunkSize)
  const chunkYMax = toChunkCoordinate(yMax, world.chunkSize)

  const chunks: CollisionChunk[] = []
  for (let chunkY = chunkYMin; chunkY <= chunkYMax; chunkY += 1) {
    for (let chunkX = chunkXMin; chunkX <= chunkXMax; chunkX += 1) {
      const chunk = world.chunkLookup.get(toChunkKey(chunkX, chunkY))
      if (chunk && world.activeChunkKeySet.has(chunk.key)) {
        chunks.push(chunk)
      }
    }
  }
  return chunks
}

function forEachNearbyRoundObstacle(
  world: WorldCollisionWorld,
  x: number,
  y: number,
  radius: number,
  callback: (obstacle: RoundCollider) => boolean
): boolean {
  const searchRadius = Math.max(0.5, radius + 0.5)
  const chunkXMin = toChunkCoordinate(x - searchRadius, world.chunkSize)
  const chunkXMax = toChunkCoordinate(x + searchRadius, world.chunkSize)
  const chunkYMin = toChunkCoordinate(y - searchRadius, world.chunkSize)
  const chunkYMax = toChunkCoordinate(y + searchRadius, world.chunkSize)

  for (let chunkY = chunkYMin; chunkY <= chunkYMax; chunkY += 1) {
    for (let chunkX = chunkXMin; chunkX <= chunkXMax; chunkX += 1) {
      const obstacles = world.roundObstacleChunkLookup.get(toChunkKey(chunkX, chunkY))
      if (!obstacles) {
        continue
      }

      for (const obstacle of obstacles) {
        if (callback(obstacle)) {
          return true
        }
      }
    }
  }

  return false
}

function collidesWithWallCells(world: WorldCollisionWorld, x: number, y: number, radius: number, zMin: number, zMax: number): boolean {
  if (!hasVerticalOverlap(zMin, zMax, 0, WORLD_WALL_HEIGHT)) {
    return false
  }

  const colMin = Math.max(0, Math.floor(x - radius))
  const colMax = Math.min(MAP_WIDTH - 1, Math.floor(x + radius))
  const rowMin = Math.max(0, Math.floor(y - radius))
  const rowMax = Math.min(MAP_HEIGHT - 1, Math.floor(y + radius))

  for (let row = rowMin; row <= rowMax; row += 1) {
    for (let col = colMin; col <= colMax; col += 1) {
      if (!isWallCellFilled(world, col, row)) {
        continue
      }

      const wallBox: WallCollider = {
        xMin: col,
        xMax: col + 1,
        yMin: row,
        yMax: row + 1,
        zMin: 0,
        zMax: WORLD_WALL_HEIGHT
      }

      if (circleIntersectsAabb(x, y, radius, wallBox)) {
        return true
      }
    }
  }

  return false
}

function getObstacleType(world: WorldCollisionWorld, x: number, y: number, z: number, radius: number): ObstacleType | null {
  const traceZMin = z
  const traceZMax = z + 0.001

  if (collidesWithWallCells(world, x, y, radius, traceZMin, traceZMax)) {
    return 'wall'
  }

  let hitType: ObstacleType | null = null
  forEachNearbyRoundObstacle(world, x, y, radius, (obstacle) => {
    if (!hasVerticalOverlap(traceZMin, traceZMax, obstacle.zMin, obstacle.zMax)) {
      return false
    }

    const dx = x - obstacle.x
    const dy = y - obstacle.y
    const minDist = radius + obstacle.radius
    if ((dx * dx) + (dy * dy) <= minDist * minDist) {
      hitType = obstacle.type
      return true
    }

    return false
  })

  return hitType
}

function resolveObstacleTypeFromFaceIndex(chunk: CollisionChunk, faceIndex: number | undefined): ObstacleType {
  if (faceIndex === undefined || !Number.isFinite(faceIndex)) {
    return 'wall'
  }

  for (const range of chunk.faceTypeRanges) {
    if (faceIndex >= range.faceStart && faceIndex <= range.faceEnd) {
      return range.obstacleType
    }
  }
  return 'wall'
}

function updateRayMetrics(world: WorldCollisionWorld, elapsedMs: number, activeChunkKeys: string[]): void {
  world.rayMetricFrame.count += 1
  world.rayMetricFrame.totalMs += elapsedMs
  world.rayMetricFrame.maxMs = Math.max(world.rayMetricFrame.maxMs, elapsedMs)
  world.rayMetricFrame.lastMs = elapsedMs

  world.rayMetricLifetime.count += 1
  world.rayMetricLifetime.totalMs += elapsedMs
  world.rayMetricLifetime.maxMs = Math.max(world.rayMetricLifetime.maxMs, elapsedMs)
  world.rayMetricLifetime.lastMs = elapsedMs

  world.frameMetric.raycastCount = world.rayMetricFrame.count
  world.frameMetric.raycastTotalMs = world.rayMetricFrame.totalMs
  world.frameMetric.raycastMaxMs = world.rayMetricFrame.maxMs
  world.frameMetric.activeChunkCount = activeChunkKeys.length
  world.frameMetric.activeChunkKeys = activeChunkKeys.slice(0, 10)

  world.lifetimeMetric.raycastCount = world.rayMetricLifetime.count
  world.lifetimeMetric.raycastTotalMs = world.rayMetricLifetime.totalMs
  world.lifetimeMetric.raycastMaxMs = world.rayMetricLifetime.maxMs
}

function traceWorldHitRaycast(world: WorldCollisionWorld, from: Point3D, to: Point3D): WorldTraceHit | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z
  const distance = Math.hypot(dx, dy, dz)
  if (distance < COLLISION_RAY_EPSILON) {
    return null
  }

  const direction = new THREE.Vector3(dx, dz, dy).normalize()
  const origin = new THREE.Vector3(from.x, from.z, from.y)
  const ray = world.raycaster
  ray.set(origin, direction)
  ray.near = 0
  ray.far = distance
  ;(ray as unknown as { firstHitOnly?: boolean }).firstHitOnly = true

  const margin = 0.2
  const xMin = Math.min(from.x, to.x) - margin
  const xMax = Math.max(from.x, to.x) + margin
  const yMin = Math.min(from.y, to.y) - margin
  const yMax = Math.max(from.y, to.y) + margin
  const chunks = getChunksInAabb(world, xMin, xMax, yMin, yMax)

  let nearestHit: WorldTraceHit | null = null
  const startMs = performance.now()

  for (const chunk of chunks) {
    const intersections = ray.intersectObject(chunk.collisionMesh, false)
    if (intersections.length <= 0) {
      continue
    }

    const hit = intersections[0]
    if (!hit) {
      continue
    }

    const hitPoint = hit.point
    const hitDistance = Math.max(0, hit.distance)
    if (nearestHit !== null && hitDistance >= nearestHit.distance) {
      continue
    }

    nearestHit = {
      distance: hitDistance,
      x: hitPoint.x,
      y: hitPoint.z,
      z: hitPoint.y,
      obstacleType: resolveObstacleTypeFromFaceIndex(chunk, hit.faceIndex ?? undefined)
    }
  }

  const elapsedMs = performance.now() - startMs
  updateRayMetrics(world, elapsedMs, chunks.map((chunk) => chunk.key))
  return nearestHit
}

function buildCollisionChunks(
  walls: WallCollider[],
  roundObstacles: RoundCollider[],
  chunkSize: number
): {
  chunks: CollisionChunk[]
  chunkLookup: Map<string, CollisionChunk>
  roundObstacleChunkLookup: Map<string, RoundCollider[]>
  bvhBuildMs: number
  totalTriangles: number
} {
  const chunkLookup = new Map<string, CollisionChunk>()
  const chunkWallLookup = new Map<string, WallCollider[]>()
  const roundObstacleChunkLookup = new Map<string, RoundCollider[]>()

  for (const wall of walls) {
    const chunkX = toChunkCoordinate((wall.xMin + wall.xMax) * 0.5, chunkSize)
    const chunkY = toChunkCoordinate((wall.yMin + wall.yMax) * 0.5, chunkSize)
    const key = toChunkKey(chunkX, chunkY)
    const entry = chunkWallLookup.get(key)
    if (entry) {
      entry.push(wall)
    } else {
      chunkWallLookup.set(key, [wall])
    }
  }

  for (const obstacle of roundObstacles) {
    const chunkX = toChunkCoordinate(obstacle.x, chunkSize)
    const chunkY = toChunkCoordinate(obstacle.y, chunkSize)
    const key = toChunkKey(chunkX, chunkY)
    const entry = roundObstacleChunkLookup.get(key)
    if (entry) {
      entry.push(obstacle)
    } else {
      roundObstacleChunkLookup.set(key, [obstacle])
    }
  }

  const allKeys = new Set<string>([...chunkWallLookup.keys(), ...roundObstacleChunkLookup.keys()])
  const chunkMaterial = new THREE.MeshBasicMaterial({ visible: false })

  let totalTriangles = 0
  let bvhBuildMs = 0

  for (const key of allKeys) {
    const [chunkXText, chunkYText] = key.split(',')
    const chunkX = Number(chunkXText)
    const chunkY = Number(chunkYText)
    if (!Number.isFinite(chunkX) || !Number.isFinite(chunkY)) {
      continue
    }

    const positions: number[] = []
    const faceTypeRanges: FaceTypeRange[] = []
    let currentFace = 0

    for (const wall of chunkWallLookup.get(key) ?? []) {
      const triangles = addBoxTriangles(positions, wall)
      faceTypeRanges.push({
        faceStart: currentFace,
        faceEnd: currentFace + triangles - 1,
        obstacleType: 'wall'
      })
      currentFace += triangles
      totalTriangles += triangles
    }

    for (const obstacle of roundObstacleChunkLookup.get(key) ?? []) {
      const triangles = addCylinderTriangles(positions, obstacle)
      faceTypeRanges.push({
        faceStart: currentFace,
        faceEnd: currentFace + triangles - 1,
        obstacleType: obstacle.type
      })
      currentFace += triangles
      totalTriangles += triangles
    }

    if (positions.length <= 0) {
      continue
    }

    const geometry = new THREE.BufferGeometry() as BufferGeometryWithBvh
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.computeVertexNormals()

    const buildStartMs = performance.now()
    geometry.computeBoundsTree?.({ maxLeafTris: 12 })
    bvhBuildMs += performance.now() - buildStartMs

    const collisionMesh = new THREE.Mesh(geometry, chunkMaterial)
    collisionMesh.visible = false
    collisionMesh.frustumCulled = false
    collisionMesh.matrixAutoUpdate = false
    collisionMesh.updateMatrix()

    const chunk: CollisionChunk = {
      key,
      chunkX,
      chunkY,
      xMin: chunkX * chunkSize,
      xMax: (chunkX + 1) * chunkSize,
      yMin: chunkY * chunkSize,
      yMax: (chunkY + 1) * chunkSize,
      collisionMesh,
      faceTypeRanges,
      triangleCount: currentFace,
      bvhBuildMs: bvhBuildMs
    }
    chunkLookup.set(key, chunk)
  }

  return {
    chunks: [...chunkLookup.values()],
    chunkLookup,
    roundObstacleChunkLookup,
    bvhBuildMs,
    totalTriangles
  }
}

export function createWorldCollisionWorld(mapData: Uint8Array, sprites: SpriteObject[]): WorldCollisionWorld {
  patchThreeRaycastingWithBvh()

  const walls: WallCollider[] = []
  const wallSet = new Set<number>()
  for (let row = 0; row < MAP_HEIGHT; row += 1) {
    for (let col = 0; col < MAP_WIDTH; col += 1) {
      if (getCell(mapData, col, row) === 0) {
        continue
      }

      walls.push({
        xMin: col,
        xMax: col + 1,
        yMin: row,
        yMax: row + 1,
        zMin: 0,
        zMax: WORLD_WALL_HEIGHT
      })
      wallSet.add(row * MAP_WIDTH + col)
    }
  }

  const roundObstacles = sprites.map((sprite) => toRoundObstacle(sprite))
  const maxObstacleHeight = roundObstacles.reduce((maxHeight, obstacle) => Math.max(maxHeight, obstacle.zMax), WORLD_WALL_HEIGHT)

  const { chunks, chunkLookup, roundObstacleChunkLookup, bvhBuildMs, totalTriangles } = buildCollisionChunks(
    walls,
    roundObstacles,
    WORLD_COLLISION_CHUNK_SIZE
  )

  const world: WorldCollisionWorld = {
    walls,
    roundObstacles,
    wallSet,
    chunks,
    chunkSize: WORLD_COLLISION_CHUNK_SIZE,
    maxObstacleHeight,
    observerChunkX: toChunkCoordinate(MAP_WIDTH * 0.5, WORLD_COLLISION_CHUNK_SIZE),
    observerChunkY: toChunkCoordinate(MAP_HEIGHT * 0.5, WORLD_COLLISION_CHUNK_SIZE),
    chunkLookup,
    roundObstacleChunkLookup,
    raycaster: new THREE.Raycaster(),
    rayMetricFrame: {
      count: 0,
      totalMs: 0,
      maxMs: 0,
      lastMs: 0
    },
    rayMetricLifetime: {
      count: 0,
      totalMs: 0,
      maxMs: 0,
      lastMs: 0
    },
    frameMetric: {
      raycastCount: 0,
      raycastTotalMs: 0,
      raycastMaxMs: 0,
      activeChunkCount: 0,
      activeChunkKeys: []
    },
    lifetimeMetric: {
      raycastCount: 0,
      raycastTotalMs: 0,
      raycastMaxMs: 0
    },
    bvhBuildMs,
    bvhTriangleCount: totalTriangles,
    debugRayHook: null,
    activeChunkKeySet: new Set(chunks.map((chunk) => chunk.key))
  }

  console.info('[WorldCollision][BVH] built static chunk BVHs', {
    chunkCount: world.chunks.length,
    triangleCount: world.bvhTriangleCount,
    buildMs: Number(world.bvhBuildMs.toFixed(2))
  })

  return world
}

export function setWorldCollisionObserverPosition(world: WorldCollisionWorld, x: number, y: number): void {
  world.observerChunkX = toChunkCoordinate(x, world.chunkSize)
  world.observerChunkY = toChunkCoordinate(y, world.chunkSize)
}

export function setWorldCollisionActiveChunks(world: WorldCollisionWorld, activeChunkKeys: readonly string[]): void {
  world.activeChunkKeySet = new Set(activeChunkKeys)
}

export function setWorldCollisionDebugRayHook(world: WorldCollisionWorld, hook: DebugRayVisualizationHook | null): void {
  world.debugRayHook = hook
}

export function resetWorldCollisionFrameMetrics(world: WorldCollisionWorld): void {
  world.rayMetricFrame.count = 0
  world.rayMetricFrame.totalMs = 0
  world.rayMetricFrame.maxMs = 0
  world.rayMetricFrame.lastMs = 0
  world.frameMetric.raycastCount = 0
  world.frameMetric.raycastTotalMs = 0
  world.frameMetric.raycastMaxMs = 0
  world.frameMetric.activeChunkCount = 0
  world.frameMetric.activeChunkKeys = []
}

export function getWorldCollisionDiagnostics(world: WorldCollisionWorld): WorldCollisionDiagnostics {
  const frameAvg = world.frameMetric.raycastCount > 0
    ? world.frameMetric.raycastTotalMs / world.frameMetric.raycastCount
    : 0
  const lifetimeAvg = world.lifetimeMetric.raycastCount > 0
    ? world.lifetimeMetric.raycastTotalMs / world.lifetimeMetric.raycastCount
    : 0

  return {
    bvhEnabled: true,
    chunkSize: world.chunkSize,
    totalChunks: world.chunks.length,
    totalTriangles: world.bvhTriangleCount,
    bvhBuildMs: world.bvhBuildMs,
    frame: {
      raycastCount: world.frameMetric.raycastCount,
      raycastTotalMs: world.frameMetric.raycastTotalMs,
      raycastAverageMs: frameAvg,
      raycastMaxMs: world.frameMetric.raycastMaxMs,
      activeChunkCount: world.frameMetric.activeChunkCount,
      activeChunkKeys: [...world.frameMetric.activeChunkKeys]
    },
    lifetime: {
      raycastCount: world.lifetimeMetric.raycastCount,
      raycastTotalMs: world.lifetimeMetric.raycastTotalMs,
      raycastAverageMs: lifetimeAvg,
      raycastMaxMs: world.lifetimeMetric.raycastMaxMs
    },
    observerChunk: {
      chunkX: world.observerChunkX,
      chunkY: world.observerChunkY
    }
  }
}

export function isWorldBlockedAtHeight(world: WorldCollisionWorld, x: number, y: number, z: number, radius = 0.02): boolean {
  return getObstacleType(world, x, y, z, radius) !== null
}

export function getTopSurfaceHeight(world: WorldCollisionWorld, x: number, y: number, radius: number): number {
  const safeRadius = Math.max(0.05, radius)
  const samples: Array<{ x: number; y: number }> = [
    { x, y },
    { x: x + safeRadius, y },
    { x: x - safeRadius, y },
    { x, y: y + safeRadius },
    { x, y: y - safeRadius }
  ]

  let topSurfaceHeight = 0
  const rayStartZ = world.maxObstacleHeight + TERRAIN_RAY_START_PADDING
  const rayEndZ = -0.5

  for (const sample of samples) {
    if (sample.x < 0 || sample.y < 0 || sample.x >= MAP_WIDTH || sample.y >= MAP_HEIGHT) {
      continue
    }

    const hit = traceWorldHitRaycast(
      world,
      { x: sample.x, y: sample.y, z: rayStartZ },
      { x: sample.x, y: sample.y, z: rayEndZ }
    )
    if (hit) {
      topSurfaceHeight = Math.max(topSurfaceHeight, hit.z)
    }
  }

  return topSurfaceHeight
}

export function findNearestDropEdgeContact(
  world: WorldCollisionWorld,
  x: number,
  y: number,
  surfaceHeight: number,
  maxDistance: number,
  rayCount = 24,
  sampleStep = 0.2,
  sampleRadius = 0.12
): SurfaceEdgeContact | null {
  const safeRayCount = Math.max(8, Math.floor(rayCount))
  const safeStep = Math.max(0.05, sampleStep)
  const requiredSurfaceHeight = Math.max(0.1, surfaceHeight - 0.2)
  let nearest: SurfaceEdgeContact | null = null

  for (let rayIndex = 0; rayIndex < safeRayCount; rayIndex += 1) {
    const angle = (rayIndex / safeRayCount) * Math.PI * 2
    const dirX = Math.cos(angle)
    const dirY = Math.sin(angle)

    for (let distance = safeStep; distance <= maxDistance; distance += safeStep) {
      const sampleX = x + dirX * distance
      const sampleY = y + dirY * distance
      const outsideWorld = sampleX < 0 || sampleY < 0 || sampleX >= MAP_WIDTH || sampleY >= MAP_HEIGHT
      if (outsideWorld) {
        if (nearest === null || distance < nearest.distance) {
          nearest = { distance, worldX: sampleX, worldY: sampleY }
        }
        break
      }

      const sampleSurfaceHeight = getTopSurfaceHeight(world, sampleX, sampleY, sampleRadius)
      if (sampleSurfaceHeight < requiredSurfaceHeight) {
        if (nearest === null || distance < nearest.distance) {
          nearest = { distance, worldX: sampleX, worldY: sampleY }
        }
        break
      }
    }
  }

  return nearest
}

export function traceWorldHit3D(world: WorldCollisionWorld, from: Point3D, to: Point3D, radius = 0.02): WorldTraceHit | null {
  const bvhHit = traceWorldHitRaycast(world, from, to)
  if (bvhHit) {
    world.debugRayHook?.({ start: from, end: to, hit: bvhHit })
    return bvhHit
  }

  // Keep a thin-radius fallback for compatibility with existing gameplay code that
  // historically used swept sampling for slightly thicker traces.
  if (radius > 0.02) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dz = to.z - from.z
    const totalDistance = Math.hypot(dx, dy, dz)
    const steps = Math.max(1, Math.ceil(totalDistance / Math.max(0.08, radius * 1.6)))
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps
      const sampleX = from.x + dx * t
      const sampleY = from.y + dy * t
      const sampleZ = from.z + dz * t
      const obstacleType = getObstacleType(world, sampleX, sampleY, sampleZ, radius)
      if (obstacleType !== null) {
        const hit: WorldTraceHit = {
          distance: totalDistance * t,
          x: sampleX,
          y: sampleY,
          z: sampleZ,
          obstacleType
        }
        world.debugRayHook?.({ start: from, end: to, hit })
        return hit
      }
    }
  }

  world.debugRayHook?.({ start: from, end: to, hit: null })
  return null
}

export function hasWorldLineOfSight3D(world: WorldCollisionWorld, from: Point3D, to: Point3D): boolean {
  return traceWorldHit3D(world, from, to) === null
}

export function isPlayerBlocked(
  world: WorldCollisionWorld,
  x: number,
  y: number,
  feetZ: number,
  radius: number,
  collisionHeight: number = PLAYER_COLLISION_HEIGHT
): boolean {
  if (x - radius < 0 || y - radius < 0 || x + radius > MAP_WIDTH || y + radius > MAP_HEIGHT) {
    return true
  }

  const playerZMin = Math.max(0, feetZ)
  const playerZMax = playerZMin + Math.max(0.1, collisionHeight)

  if (collidesWithWallCells(world, x, y, radius, playerZMin, playerZMax)) {
    return true
  }

  let collided = false
  forEachNearbyRoundObstacle(world, x, y, radius, (obstacle) => {
    if (!hasVerticalOverlap(playerZMin, playerZMax, obstacle.zMin, obstacle.zMax)) {
      return false
    }

    const dx = x - obstacle.x
    const dy = y - obstacle.y
    const distSq = (dx * dx) + (dy * dy)
    const minDist = radius + obstacle.radius
    if (distSq < minDist * minDist) {
      collided = true
      return true
    }

    return false
  })

  return collided
}
