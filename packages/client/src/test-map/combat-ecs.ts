import {
  addComponent,
  addEntity,
  createWorld,
  defineComponent,
  defineQuery,
  removeEntity,
  Types,
  type IWorld
} from 'bitecs'
import {
  BULLET_MAX_DIST,
  BULLET_SPEED,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_LOOK_PITCH,
  PLAYER_RADIUS,
  PLAYER_HEIGHT,
  WEAPON_MAX_CONE_RADIANS,
  WEAPON_MOVEMENT_ACCURACY_PENALTY
} from './constants.js'
import {
  hasWorldLineOfSight3D,
  isPlayerBlocked,
  isWorldBlockedAtHeight,
  type WorldCollisionWorld
} from './world-collision.js'
import {
  ENEMY_NUMERIC_ID,
  getEnemyDefinition,
  getEnemyDefinitionFromNumericId
} from './enemies/index.js'
import type { EnemyDefinitionConfig, EnemyId } from './enemies/enemyTypes.js'
import type { AudioController, Bullet, EnemyRender, IncomingProjectileAudioState, Player, TankRender, TrailPoint } from './types.js'

const KIND_BULLET = 1
const KIND_ENEMY = 2
const KIND_TANK = 3
const KIND_TANK_PROJECTILE = 4
const KIND_MISSILE = 5
const PROJECTILE_OWNER_PLAYER = 1
const PROJECTILE_OWNER_ENEMY = 2
const BULLET_HIT_RADIUS = 0.25
const PLAYER_HIT_HALF_HEIGHT = 0.55
const TANK_HIT_HALF_HEIGHT = 0.6
const WORLD_CHUNK_SIZE = 64
const MAX_ACTIVE_ENEMIES = 20
const MAX_ACTIVE_AIR_ENEMIES = 5
const SPAWN_MIN_PLAYER_DISTANCE = 8
const SPAWN_MAX_PLAYER_DISTANCE = 50
const SPAWN_MIN_CHUNK_RING = 1
const SPAWN_MAX_CHUNK_RING = 4
const ENEMY_FULL_SIM_RANGE = 180
const ENEMY_BACKGROUND_SIM_RANGE = 360
const ENEMY_BACKGROUND_AI_TICK_SECONDS = 0.22
const ENEMY_DISTANT_AI_TICK_SECONDS = 0.55
const ENEMY_LOS_MAX_DISTANCE = 170

const Position = defineComponent({
  x: Types.f32,
  y: Types.f32
})

const Facing = defineComponent({
  angle: Types.f32,
  pitch: Types.f32
})

const Meta = defineComponent({
  kind: Types.ui8,
  radius: Types.f32,
  distance: Types.f32,
  alive: Types.ui8
})

const Health = defineComponent({
  hp: Types.i16
})

const EnemyProfile = defineComponent({
  id: Types.ui8
})

const Flight = defineComponent({
  airborne: Types.ui8,
  height: Types.f32
})

const Behavior = defineComponent({
  movementAngle: Types.f32,
  movementTimer: Types.f32,
  cannonFireCooldown: Types.f32,
  attackWindupSeconds: Types.f32,
  isMoving: Types.ui8,
  lodAccumulatorSeconds: Types.f32
})

const TankExplosion = defineComponent({
  timeRemaining: Types.f32,
  maxDuration: Types.f32
})

const ProjectileStats = defineComponent({
  speed: Types.f32,
  damage: Types.i16,
  maxDistance: Types.f32,
  originHeight: Types.f32,
  nearMissPlayed: Types.ui8,
  owner: Types.ui8
})

const MissileStats = defineComponent({
  targetId: Types.ui32,
  trackingRating: Types.f32,
  guidanceTimer: Types.f32,
  explosionRadius: Types.f32,
  explosionDamage: Types.f32
})

const CombatQuery = defineQuery([Position, Facing, Meta])
const TankQuery = defineQuery([Position, Facing, Meta, Health, Behavior, EnemyProfile])

type CombatEcsWorld = IWorld & {
  customConfigs: Map<number, EnemyDefinitionConfig>
  missileExplosionSounds: Map<number, string[]>
  missileTrails: Map<number, TrailPoint[]>
}

function addEnemy(world: CombatEcsWorld, x: number, y: number, radius = 0.33): void {
  const enemy = addEntity(world)
  addComponent(world, Position, enemy)
  addComponent(world, Facing, enemy)
  addComponent(world, Meta, enemy)
  Position.x[enemy] = x
  Position.y[enemy] = y
  Facing.angle[enemy] = 0
  Facing.pitch[enemy] = 0
  Meta.kind[enemy] = KIND_ENEMY
  Meta.radius[enemy] = radius
  Meta.distance[enemy] = 0
  Meta.alive[enemy] = 1
} // end function addEnemy

function addTank(world: CombatEcsWorld, x: number, y: number, enemyId: EnemyId = 'tank'): void {
  const definition = getEnemyDefinition(enemyId)

  const tank = addEntity(world)
  addComponent(world, Position, tank)
  addComponent(world, Facing, tank)
  addComponent(world, Meta, tank)
  addComponent(world, Health, tank)
  addComponent(world, Behavior, tank)
  addComponent(world, EnemyProfile, tank)
  addComponent(world, Flight, tank)
  addComponent(world, TankExplosion, tank)

  Position.x[tank] = x
  Position.y[tank] = y
  Facing.angle[tank] = 0
  Facing.pitch[tank] = 0
  Meta.kind[tank] = KIND_TANK
  Meta.radius[tank] = definition.collisionRadius
  Meta.distance[tank] = 0
  Meta.alive[tank] = 1
  Health.hp[tank] = definition.maxHp
  EnemyProfile.id[tank] = ENEMY_NUMERIC_ID[enemyId]
  Flight.airborne[tank] = definition.airborne ? 1 : 0
  Flight.height[tank] = definition.airborne ? Math.max(0, definition.flightHeight) : 0
  Behavior.movementAngle[tank] = Math.random() * Math.PI * 2
  Behavior.movementTimer[tank] = 0
  Behavior.cannonFireCooldown[tank] = 0
  Behavior.attackWindupSeconds[tank] = 0
  Behavior.isMoving[tank] = 1
  Behavior.lodAccumulatorSeconds[tank] = 0
  TankExplosion.timeRemaining[tank] = 0
  TankExplosion.maxDuration[tank] = 0.7
} // end function addTank

function spawnTankProjectile(
  world: CombatEcsWorld,
  tankEntity: number,
  tankX: number,
  tankY: number,
  targetX: number,
  targetY: number,
  targetZ: number
): void {
  const enemyProfileId = EnemyProfile.id[tankEntity] ?? ENEMY_NUMERIC_ID.tank
  const customConfig = world.customConfigs.get(tankEntity)
  const definition = customConfig ?? getEnemyDefinitionFromNumericId(enemyProfileId)
  const angle = Math.atan2(targetY - tankY, targetX - tankX)
  const originHeight = Math.max(0, Flight.height[tankEntity] ?? 0) + PLAYER_HEIGHT
  const horizontalDistance = Math.hypot(targetX - tankX, targetY - tankY)
  const pitch = Math.atan2(targetZ - originHeight, Math.max(horizontalDistance, 0.0001))
  const bullet = addEntity(world)
  addComponent(world, Position, bullet)
  addComponent(world, Facing, bullet)
  addComponent(world, Meta, bullet)
  addComponent(world, ProjectileStats, bullet)
  Position.x[bullet] = tankX
  Position.y[bullet] = tankY
  Facing.angle[bullet] = angle
  Facing.pitch[bullet] = pitch
  Meta.kind[bullet] = KIND_TANK_PROJECTILE
  Meta.radius[bullet] = 0.2
  Meta.distance[bullet] = 0
  Meta.alive[bullet] = 1
  ProjectileStats.speed[bullet] = definition.projectileSpeed
  ProjectileStats.damage[bullet] = definition.shotDamage
  ProjectileStats.maxDistance[bullet] = definition.projectileMaxDistance
  ProjectileStats.originHeight[bullet] = originHeight
  ProjectileStats.nearMissPlayed[bullet] = 0
  ProjectileStats.owner[bullet] = PROJECTILE_OWNER_ENEMY
} // end function spawnTankProjectile

export function createCombatEcsWorld(): CombatEcsWorld {
  const world = createWorld() as CombatEcsWorld
  world.customConfigs = new Map()
  world.missileExplosionSounds = new Map()
  world.missileTrails = new Map()
  return world
} // end function createCombatEcsWorld

function canSpawnTankAt(world: CombatEcsWorld, collisionWorld: WorldCollisionWorld, x: number, y: number, player: Player, collisionRadius?: number): boolean {
  const tankRadius = collisionRadius ?? getEnemyDefinition('tank').collisionRadius
  const collisionPadding = 0.18

  if (
    x <= tankRadius + collisionPadding ||
    y <= tankRadius + collisionPadding ||
    x >= MAP_WIDTH - (tankRadius + collisionPadding) ||
    y >= MAP_HEIGHT - (tankRadius + collisionPadding)
  ) {
    return false
  } // end if too close to map boundaries

  if (isPlayerBlocked(collisionWorld, x, y, 0, tankRadius, 1.2)) {
    return false
  } // end if spawn intersects world collision

  if (Math.hypot(x - player.x, y - player.y) < 4.5) {
    return false
  } // end if too close to player spawn area

  const distanceToPlayer = Math.hypot(x - player.x, y - player.y)
  if (distanceToPlayer < SPAWN_MIN_PLAYER_DISTANCE || distanceToPlayer > SPAWN_MAX_PLAYER_DISTANCE) {
    return false
  } // end if outside organic spawn distance band

  const tankEntities = TankQuery(world)
  for (const tank of tankEntities) {
    if ((Meta.alive[tank] ?? 0) !== 1) {
      continue
    } // end if tank is not alive

    const tankX = getNumber(Position.x, tank)
    const tankY = getNumber(Position.y, tank)
    const radius = getNumber(Meta.radius, tank)
    if (tankX === null || tankY === null || radius === null) {
      continue
    } // end if missing tank positional data

    if (Math.hypot(x - tankX, y - tankY) < tankRadius + radius + 0.8) {
      return false
    } // end if overlaps existing tank
  } // end for each existing tank

  return true
} // end function canSpawnTankAt

function getActiveEnemyCounts(world: CombatEcsWorld): { total: number; airborne: number } {
  let total = 0
  let airborne = 0
  const tankEntities = TankQuery(world)

  for (const tank of tankEntities) {
    if ((Meta.alive[tank] ?? 0) !== 1) {
      continue
    } // end if tank is not alive

    total += 1
    if ((Flight.airborne[tank] ?? 0) === 1) {
      airborne += 1
    } // end if tank is airborne
  } // end for each tank

  return { total, airborne }
} // end function getActiveEnemyCounts

function canSpawnEnemyByBudget(world: CombatEcsWorld, enemyId: EnemyId): boolean {
  const counts = getActiveEnemyCounts(world)
  const definition = getEnemyDefinition(enemyId)

  if (counts.total >= MAX_ACTIVE_ENEMIES) {
    return false
  } // end if max active enemy budget reached

  if (definition.airborne && counts.airborne >= MAX_ACTIVE_AIR_ENEMIES) {
    return false
  } // end if max airborne enemy budget reached

  return true
} // end function canSpawnEnemyByBudget

function chooseChunkLocalSpawnCandidate(player: Player): { x: number; y: number } {
  const anchorChunkX = Math.floor(player.x / WORLD_CHUNK_SIZE)
  const anchorChunkY = Math.floor(player.y / WORLD_CHUNK_SIZE)
  const chunkRing = SPAWN_MIN_CHUNK_RING + Math.floor(Math.random() * (SPAWN_MAX_CHUNK_RING - SPAWN_MIN_CHUNK_RING + 1))
  const side = Math.floor(Math.random() * 4)
  const edgeOffset = -chunkRing + Math.floor(Math.random() * ((chunkRing * 2) + 1))

  let chunkX = anchorChunkX
  let chunkY = anchorChunkY

  if (side === 0) {
    chunkX = anchorChunkX + chunkRing
    chunkY = anchorChunkY + edgeOffset
  } else if (side === 1) {
    chunkX = anchorChunkX - chunkRing
    chunkY = anchorChunkY + edgeOffset
  } else if (side === 2) {
    chunkY = anchorChunkY + chunkRing
    chunkX = anchorChunkX + edgeOffset
  } else {
    chunkY = anchorChunkY - chunkRing
    chunkX = anchorChunkX + edgeOffset
  } // end if chunk ring side pick

  const baseX = chunkX * WORLD_CHUNK_SIZE
  const baseY = chunkY * WORLD_CHUNK_SIZE
  const jitterX = 3 + Math.random() * (WORLD_CHUNK_SIZE - 6)
  const jitterY = 3 + Math.random() * (WORLD_CHUNK_SIZE - 6)
  const candidateX = Math.max(1.25, Math.min(MAP_WIDTH - 1.25, baseX + jitterX))
  const candidateY = Math.max(1.25, Math.min(MAP_HEIGHT - 1.25, baseY + jitterY))

  return { x: candidateX, y: candidateY }
} // end function chooseChunkLocalSpawnCandidate

function chooseSpawnCandidateNearPlayer(player: Player): { x: number; y: number } {
  // Always use distance-based radial spawning to ensure spawn band is respected
  const angle = Math.random() * Math.PI * 2
  const radius = SPAWN_MIN_PLAYER_DISTANCE + Math.random() * (SPAWN_MAX_PLAYER_DISTANCE - SPAWN_MIN_PLAYER_DISTANCE)
  const candidateX = Math.max(1.25, Math.min(MAP_WIDTH - 1.25, player.x + Math.cos(angle) * radius))
  const candidateY = Math.max(1.25, Math.min(MAP_HEIGHT - 1.25, player.y + Math.sin(angle) * radius))
  return { x: candidateX, y: candidateY }
} // end function chooseSpawnCandidateNearPlayer

export function spawnRandomTank(world: CombatEcsWorld, collisionWorld: WorldCollisionWorld, player: Player): boolean {
  if (!canSpawnEnemyByBudget(world, 'tank')) {
    return false
  } // end if enemy budget does not allow spawning a tank

  const maxAttempts = 90
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { x, y } = chooseSpawnCandidateNearPlayer(player)
    if (!canSpawnTankAt(world, collisionWorld, x, y, player)) {
      continue
    } // end if random spawn candidate invalid

    addTank(world, x, y)
    return true
  } // end for each spawn attempt

  return false
} // end function spawnRandomTank

function addTankFromConfig(world: CombatEcsWorld, x: number, y: number, config: EnemyDefinitionConfig): void {
  const tank = addEntity(world)
  addComponent(world, Position, tank)
  addComponent(world, Facing, tank)
  addComponent(world, Meta, tank)
  addComponent(world, Health, tank)
  addComponent(world, Behavior, tank)
  addComponent(world, EnemyProfile, tank)
  addComponent(world, Flight, tank)
  addComponent(world, TankExplosion, tank)
  Position.x[tank] = x
  Position.y[tank] = y
  Facing.angle[tank] = 0
  Facing.pitch[tank] = 0
  Meta.kind[tank] = KIND_TANK
  Meta.radius[tank] = config.collisionRadius
  Meta.distance[tank] = 0
  Meta.alive[tank] = 1
  Health.hp[tank] = config.maxHp
  EnemyProfile.id[tank] = ENEMY_NUMERIC_ID[config.id]
  Flight.airborne[tank] = config.airborne ? 1 : 0
  Flight.height[tank] = config.airborne ? Math.max(0, config.flightHeight ?? 0) : 0
  Behavior.movementAngle[tank] = Math.random() * Math.PI * 2
  Behavior.movementTimer[tank] = 0
  Behavior.cannonFireCooldown[tank] = 0
  Behavior.attackWindupSeconds[tank] = 0
  Behavior.isMoving[tank] = 1
  Behavior.lodAccumulatorSeconds[tank] = 0
  TankExplosion.timeRemaining[tank] = 0
  TankExplosion.maxDuration[tank] = 0.7
  world.customConfigs.set(tank, config)
} // end function addTankFromConfig

export function spawnRandomEnemy(world: CombatEcsWorld, collisionWorld: WorldCollisionWorld, player: Player, enemyId: EnemyId = 'tank'): boolean {
  if (!canSpawnEnemyByBudget(world, enemyId)) {
    return false
  } // end if enemy budget does not allow spawning this enemy type

  const definition = getEnemyDefinition(enemyId)
  const maxAttempts = 90
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { x, y } = chooseSpawnCandidateNearPlayer(player)
    if (!canSpawnTankAt(world, collisionWorld, x, y, player, definition.collisionRadius)) {
      continue
    } // end if random spawn candidate invalid
    addTank(world, x, y, enemyId)
    return true
  } // end for each spawn attempt
  return false
} // end function spawnRandomEnemy

export function spawnRandomTankFromConfig(world: CombatEcsWorld, collisionWorld: WorldCollisionWorld, player: Player, config: EnemyDefinitionConfig): boolean {
  if (!canSpawnEnemyByBudget(world, config.id)) {
    return false
  } // end if enemy budget does not allow spawning this config

  const maxAttempts = 90
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { x, y } = chooseSpawnCandidateNearPlayer(player)
    if (!canSpawnTankAt(world, collisionWorld, x, y, player, config.collisionRadius)) {
      continue
    } // end if random spawn candidate invalid
    addTankFromConfig(world, x, y, config)
    return true
  } // end for each spawn attempt
  return false
} // end function spawnRandomTankFromConfig

export function syncDynamicFlightHeights(world: CombatEcsWorld): void {
  const tankEntities = TankQuery(world)

  for (const tank of tankEntities) {
    if ((Flight.airborne[tank] ?? 0) !== 1) {
      continue
    } // end if tank is not airborne

    const customConfig = world.customConfigs.get(tank)
    if (customConfig) {
      Flight.height[tank] = customConfig.airborne ? Math.max(0, customConfig.flightHeight ?? 0) : 0
      continue
    } // end if spawned from custom config

    const definition = getEnemyDefinitionFromNumericId(EnemyProfile.id[tank] ?? ENEMY_NUMERIC_ID.tank)
    Flight.height[tank] = definition.airborne ? Math.max(0, definition.flightHeight) : 0
  } // end for each tank
} // end function syncDynamicFlightHeights

export function spawnPlayerBullet(
  world: CombatEcsWorld,
  player: Player,
  damage = 10,
  speed = BULLET_SPEED,
  maxDistance = BULLET_MAX_DIST,
  projectileSize = BULLET_HIT_RADIUS,
  accuracy = 1,
  playerSpeedFraction = 0,
  projectileCount = 1,
  spreadDegrees = 0
): void {
  spawnPlayerProjectileBurst(
    world,
    player,
    player.angle,
    player.pitch,
    accuracy,
    playerSpeedFraction,
    projectileCount,
    spreadDegrees,
    damage,
    speed,
    maxDistance,
    projectileSize
  )
} // end function spawnPlayerBullet

function spawnPlayerProjectile(
  world: CombatEcsWorld,
  player: Player,
  angle: number,
  pitch: number,
  damage: number,
  speed: number,
  maxDistance: number,
  projectileSize: number
): void {
  const bullet = addEntity(world)
  addComponent(world, Position, bullet)
  addComponent(world, Facing, bullet)
  addComponent(world, Meta, bullet)
  addComponent(world, ProjectileStats, bullet)
  Position.x[bullet] = player.x
  Position.y[bullet] = player.y
  Facing.angle[bullet] = angle
  Facing.pitch[bullet] = pitch
  Meta.kind[bullet] = KIND_BULLET
  Meta.radius[bullet] = Math.max(0.03, projectileSize)
  Meta.distance[bullet] = 0
  Meta.alive[bullet] = 1
  ProjectileStats.speed[bullet] = speed
  ProjectileStats.damage[bullet] = damage
  ProjectileStats.maxDistance[bullet] = maxDistance
  ProjectileStats.originHeight[bullet] = (player.z ?? 0) + PLAYER_HEIGHT
  ProjectileStats.nearMissPlayed[bullet] = 0
  ProjectileStats.owner[bullet] = PROJECTILE_OWNER_PLAYER
} // end function spawnPlayerProjectile

function sampleConeOffset(halfAngleRadians: number): { yawOffset: number; pitchOffset: number } {
  if (halfAngleRadians <= 0) {
    return { yawOffset: 0, pitchOffset: 0 }
  } // end if cone has no width

  const radius = Math.sqrt(Math.random()) * halfAngleRadians
  const azimuth = Math.random() * Math.PI * 2
  return {
    yawOffset: Math.cos(azimuth) * radius,
    pitchOffset: Math.sin(azimuth) * radius
  } // end sampled cone offset
} // end function sampleConeOffset

function clampProjectilePitch(pitch: number): number {
  return Math.max(-MAX_LOOK_PITCH, Math.min(MAX_LOOK_PITCH, pitch))
} // end function clampProjectilePitch

function spawnPlayerProjectileBurst(
  world: CombatEcsWorld,
  player: Player,
  baseAngle: number,
  basePitch: number,
  accuracy: number,
  playerSpeedFraction: number,
  projectileCount: number,
  spreadDegrees: number,
  damage: number,
  speed: number,
  maxDistance: number,
  projectileSize: number
): void {
  const clampedAccuracy = Math.max(0, Math.min(1, accuracy))
  const baseHalfAngle = WEAPON_MAX_CONE_RADIANS * Math.max(0, 1 - clampedAccuracy)
  const accuracyHalfAngle = baseHalfAngle * (1 + Math.min(1, playerSpeedFraction) * WEAPON_MOVEMENT_ACCURACY_PENALTY)
  const accuracyOffset = sampleConeOffset(accuracyHalfAngle)
  const spreadHalfAngle = Math.max(0, spreadDegrees) * (Math.PI / 180)
  const projectileTotal = Math.max(1, Math.round(projectileCount))
  const adjustedBaseAngle = baseAngle + accuracyOffset.yawOffset
  const adjustedBasePitch = clampProjectilePitch(basePitch + accuracyOffset.pitchOffset)

  for (let projectileIndex = 0; projectileIndex < projectileTotal; projectileIndex += 1) {
    const pelletOffset = sampleConeOffset(spreadHalfAngle)
    spawnPlayerProjectile(
      world,
      player,
      adjustedBaseAngle + pelletOffset.yawOffset,
      clampProjectilePitch(adjustedBasePitch + pelletOffset.pitchOffset),
      damage,
      speed,
      maxDistance,
      projectileSize
    )
  } // end for each projectile in burst
} // end function spawnPlayerProjectileBurst

/**
 * Fires a player bullet aimed at (targetX, targetY) with an accuracy cone.
 * accuracy: 0.0 = widest cone, 1.0 = perfect aim.
 * playerSpeedFraction: 0.0 = standing still, 1.0 = full speed (widens cone).
 */
export function spawnPlayerBulletToward(
  world: CombatEcsWorld,
  player: Player,
  targetX: number,
  targetY: number,
  targetZ: number,
  accuracy: number,
  playerSpeedFraction: number,
  damage = 10,
  speed = BULLET_SPEED,
  maxDistance = BULLET_MAX_DIST,
  projectileSize = BULLET_HIT_RADIUS,
  projectileCount = 1,
  spreadDegrees = 0
): void {
  const baseAngle = Math.atan2(targetY - player.y, targetX - player.x)
  // Player-fired projectiles should follow the current look pitch, even with lock-on enabled.
  const basePitch = player.pitch
  spawnPlayerProjectileBurst(
    world,
    player,
    baseAngle,
    basePitch,
    accuracy,
    playerSpeedFraction,
    projectileCount,
    spreadDegrees,
    damage,
    speed,
    maxDistance,
    projectileSize
  )
} // end function spawnPlayerBulletToward

export function spawnPlayerMissile(
  world: CombatEcsWorld,
  player: Player,
  targetTankId: number,
  damage: number,
  speed: number,
  maxDistance: number,
  projectileSize: number,
  trackingRating: number,
  explosionRadius: number,
  explosionDamage: number,
  explosionSounds: string[]
): void {
  const targetX = getNumber(Position.x, targetTankId) ?? player.x
  const targetY = getNumber(Position.y, targetTankId) ?? player.y
  const targetZ = Math.max(0, getNumber(Flight.height, targetTankId) ?? (player.z ?? 0)) + PLAYER_HEIGHT
  const angle = Math.atan2(targetY - player.y, targetX - player.x)
  const originHeight = (player.z ?? 0) + PLAYER_HEIGHT
  const missile = addEntity(world)
  addComponent(world, Position, missile)
  addComponent(world, Facing, missile)
  addComponent(world, Meta, missile)
  addComponent(world, ProjectileStats, missile)
  addComponent(world, MissileStats, missile)

  Position.x[missile] = player.x
  Position.y[missile] = player.y
  Facing.angle[missile] = angle
  Facing.pitch[missile] = getPitchToTarget(player.x, player.y, originHeight, targetX, targetY, targetZ)
  Meta.kind[missile] = KIND_MISSILE
  Meta.radius[missile] = Math.max(0.08, projectileSize)
  Meta.distance[missile] = 0
  Meta.alive[missile] = 1
  ProjectileStats.speed[missile] = Math.max(1, speed)
  ProjectileStats.damage[missile] = Math.max(1, Math.round(damage))
  ProjectileStats.maxDistance[missile] = Math.max(1, maxDistance)
  ProjectileStats.originHeight[missile] = originHeight
  ProjectileStats.nearMissPlayed[missile] = 0
  ProjectileStats.owner[missile] = PROJECTILE_OWNER_PLAYER
  MissileStats.targetId[missile] = targetTankId
  MissileStats.trackingRating[missile] = Math.max(0, Math.min(1, trackingRating))
  MissileStats.guidanceTimer[missile] = 0
  MissileStats.explosionRadius[missile] = Math.max(0.2, explosionRadius)
  MissileStats.explosionDamage[missile] = Math.max(1, explosionDamage)
  world.missileExplosionSounds.set(missile, explosionSounds)
  world.missileTrails.set(missile, [
    { x: player.x, y: (player.z ?? 0) + PLAYER_HEIGHT, z: player.y }
  ])
} // end function spawnPlayerMissile

function computeFloorCeilHitDistance(originHeight: number, pitch: number): number {
  const absPitch = Math.abs(pitch)
  if (absPitch < 0.001) {
    return BULLET_MAX_DIST
  } // end if no pitch

  if (pitch < 0) {
    // No artificial ceiling: upward shots should only expire by max range or world collisions.
    return BULLET_MAX_DIST
  } // end if upward pitch

  return originHeight / Math.tan(pitch)
} // end function computeFloorCeilHitDistance

function getProjectileHeight(originHeight: number, distance: number, pitch: number): number {
  return originHeight - Math.tan(pitch) * distance
} // end function getProjectileHeight

function getPitchToTarget(
  originX: number,
  originY: number,
  originZ: number,
  targetX: number,
  targetY: number,
  targetZ: number
): number {
  const horizontalDistance = Math.hypot(targetX - originX, targetY - originY)
  return clampProjectilePitch(Math.atan2(originZ - targetZ, Math.max(horizontalDistance, 0.0001)))
} // end function getPitchToTarget

function getFirstContactFraction(
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  targetX: number,
  targetY: number,
  targetZ: number,
  horizontalHitRadius: number,
  verticalHitHalfHeight: number
): number {
  const segmentX = endX - startX
  const segmentY = endY - startY
  const segmentZ = endZ - startZ
  const segmentLengthSquared = (segmentX * segmentX) + (segmentY * segmentY) + (segmentZ * segmentZ)
  if (segmentLengthSquared <= 0.000001) {
    const horizontalDistance = Math.hypot(startX - targetX, startY - targetY)
    return horizontalDistance < horizontalHitRadius && Math.abs(startZ - targetZ) <= verticalHitHalfHeight ? 0 : -1
  } // end if projectile did not move this frame

  const segmentLength = Math.sqrt(segmentLengthSquared)
  const stepCount = Math.max(2, Math.ceil(segmentLength / Math.max(0.05, horizontalHitRadius * 0.35)))
  for (let stepIndex = 1; stepIndex <= stepCount; stepIndex += 1) {
    const fraction = stepIndex / stepCount
    const sampleX = startX + (segmentX * fraction)
    const sampleY = startY + (segmentY * fraction)
    const sampleZ = startZ + (segmentZ * fraction)
    const horizontalDistance = Math.hypot(sampleX - targetX, sampleY - targetY)
    if (horizontalDistance < horizontalHitRadius && Math.abs(sampleZ - targetZ) <= verticalHitHalfHeight) {
      return fraction
    } // end if projectile first overlaps target volume
  } // end for each segment sample

  return -1
} // end function getFirstContactFraction

function getNumber(store: ArrayLike<number>, entity: number): number | null {
  const value = store[entity]
  if (value === undefined) {
    return null
  } // end if missing store value
  return value
} // end function getNumber

export function stepCombatEcsWorld(
  world: CombatEcsWorld,
  collisionWorld: WorldCollisionWorld,
  audio: AudioController,
  player: Player,
  deltaSeconds: number
): void {
  player.maxHp = Math.max(1, player.maxHp ?? 100)
  player.hp = Math.max(0, Math.min(player.maxHp, player.hp ?? player.maxHp))

  const allEntities = CombatQuery(world)
  let impactFrameCount = 0
  const IMPACT_STAGGER_SECONDS = 0.001
  const incomingProjectileAudioStates: IncomingProjectileAudioState[] = []
  const tankEntities = TankQuery(world)

  // --- Update tanks ---
  for (const tank of tankEntities) {
    const enemyProfileId = EnemyProfile.id[tank] ?? ENEMY_NUMERIC_ID.tank
    const customConfig = world.customConfigs.get(tank)
    const enemyDefinition = customConfig ?? getEnemyDefinitionFromNumericId(enemyProfileId)

    const tankX = getNumber(Position.x, tank)
    const tankY = getNumber(Position.y, tank)
    const tankHp = Health.hp[tank]
    if (tankX === null || tankY === null || tankHp === undefined) {
      continue
    } // end if tank invalid

    if (tankHp <= 0) {
      const timeLeft = TankExplosion.timeRemaining[tank] ?? 0
      if (timeLeft > 0) {
        TankExplosion.timeRemaining[tank] = Math.max(0, timeLeft - deltaSeconds)
      } // end if explosion in progress
      continue
    } // end if tank dead

    const movementAngle = getNumber(Behavior.movementAngle, tank)
    const movementTimer = getNumber(Behavior.movementTimer, tank)
    const cannonCooldown = getNumber(Behavior.cannonFireCooldown, tank)
    const attackWindup = getNumber(Behavior.attackWindupSeconds, tank)
    const lodAccumulator = getNumber(Behavior.lodAccumulatorSeconds, tank)
    if (
      movementAngle === null ||
      movementTimer === null ||
      cannonCooldown === null ||
      attackWindup === null ||
      lodAccumulator === null
    ) {
      continue
    } // end if behavior missing

    const distanceToPlayer = Math.hypot(tankX - player.x, tankY - player.y)
    let simulationStepSeconds = deltaSeconds
    let accumulatedLodSeconds = lodAccumulator + deltaSeconds

    if (distanceToPlayer > ENEMY_BACKGROUND_SIM_RANGE) {
      if (accumulatedLodSeconds < ENEMY_DISTANT_AI_TICK_SECONDS) {
        Behavior.lodAccumulatorSeconds[tank] = accumulatedLodSeconds
        continue
      } // end if distant AI tick budget not reached

      simulationStepSeconds = accumulatedLodSeconds
      accumulatedLodSeconds = 0
      Behavior.lodAccumulatorSeconds[tank] = 0
    } else if (distanceToPlayer > ENEMY_FULL_SIM_RANGE) {
      if (accumulatedLodSeconds < ENEMY_BACKGROUND_AI_TICK_SECONDS) {
        Behavior.lodAccumulatorSeconds[tank] = accumulatedLodSeconds
        continue
      } // end if background AI tick budget not reached

      simulationStepSeconds = accumulatedLodSeconds
      accumulatedLodSeconds = 0
      Behavior.lodAccumulatorSeconds[tank] = 0
    } else {
      Behavior.lodAccumulatorSeconds[tank] = 0
    } // end if LOD simulation gating

    // --- Tank movement ---
    const moveStep = enemyDefinition.movementSpeed * simulationStepSeconds
    const nextX = tankX + Math.cos(movementAngle) * moveStep
    const nextY = tankY + Math.sin(movementAngle) * moveStep

    const tankRadius = Math.max(0.15, enemyDefinition.collisionRadius)
    const canMove = !isPlayerBlocked(
      collisionWorld,
      nextX,
      nextY,
      Math.max(0, Flight.height[tank] ?? 0),
      tankRadius,
      1.2
    )

    if (!canMove) {
      Behavior.isMoving[tank] = 0
      Behavior.movementAngle[tank] = Math.random() * Math.PI * 2
      Behavior.movementTimer[tank] = 0
    } else {
      Position.x[tank] = nextX
      Position.y[tank] = nextY
      Facing.angle[tank] = movementAngle
      Behavior.movementTimer[tank] = movementTimer + simulationStepSeconds

      // Retarget movement heading using enemy behavior settings.
      if (movementTimer > enemyDefinition.behavior.retargetIntervalSeconds) {
        Behavior.movementAngle[tank] = Math.random() * Math.PI * 2
        Behavior.movementTimer[tank] = 0
      } // end if time to change direction

      Behavior.isMoving[tank] = 1
    } // end if can move

    // --- LOS check and cannon fire ---
    const dist = Math.hypot(nextX - player.x, nextY - player.y)
    const tankHeight = Math.max(0, Flight.height[tank] ?? 0)
    const hasLos = dist <= ENEMY_LOS_MAX_DISTANCE
      ? hasWorldLineOfSight3D(
          collisionWorld,
          { x: nextX, y: nextY, z: tankHeight + PLAYER_HEIGHT },
          { x: player.x, y: player.y, z: (player.z ?? 0) + PLAYER_HEIGHT }
        )
      : false
    const canShootByLos = enemyDefinition.behavior.lineOfSightRequiredToShoot ? hasLos : true
    const threatDelaySeconds = enemyDefinition.threatDelaySeconds

    if (attackWindup > 0) {
      const newWindup = Math.max(0, attackWindup - simulationStepSeconds)
      Behavior.attackWindupSeconds[tank] = newWindup
      if (newWindup <= 0 && canShootByLos && dist < enemyDefinition.behavior.preferredEngageRange) {
        spawnTankProjectile(world, tank, nextX, nextY, player.x, player.y, (player.z ?? 0) + PLAYER_HEIGHT)
        audio.playEnemyAttack(`tank-${tank}`, enemyDefinition.id)
      } // end if windup completed and target valid
    } else {
      const newCooldown = Math.max(0, cannonCooldown - simulationStepSeconds)
      Behavior.cannonFireCooldown[tank] = newCooldown
      if (canShootByLos && dist < enemyDefinition.behavior.preferredEngageRange && newCooldown <= 0) {
        Behavior.attackWindupSeconds[tank] = threatDelaySeconds
        Behavior.cannonFireCooldown[tank] = enemyDefinition.fireRateSeconds
        audio.playEnemyThreatCue(`tank-${tank}`, enemyDefinition.id)
      } // end if tank can start cannon telegraph
    } // end if cannon windup or cooldown path
  } // end for each tank

  const triggerMissileExplosion = (entity: number, worldX: number, worldY: number, worldZ: number): void => {
    const explosionRadius = getNumber(MissileStats.explosionRadius, entity) ?? 1.6
    const explosionDamage = getNumber(MissileStats.explosionDamage, entity) ?? 20
    const sounds = world.missileExplosionSounds.get(entity) ?? []

    for (const tank of tankEntities) {
      const tankAlive = Meta.alive[tank] ?? 0
      if (tankAlive !== 1) {
        continue
      } // end if tank already dead

      const tankX = getNumber(Position.x, tank)
      const tankY = getNumber(Position.y, tank)
      const tankRadius = getNumber(Meta.radius, tank)
      if (tankX === null || tankY === null || tankRadius === null) {
        continue
      } // end if tank is missing data

      const tankZ = Math.max(0, Flight.height[tank] ?? 0) + PLAYER_HEIGHT
      const horizontalDistance = Math.hypot(tankX - worldX, tankY - worldY)
      const edgeDistance = Math.max(0, horizontalDistance - tankRadius)
      const verticalDistance = Math.abs(tankZ - worldZ)
      const distance = Math.hypot(edgeDistance, verticalDistance)
      if (distance > explosionRadius) {
        continue
      } // end if tank out of explosion radius

      const falloff = Math.max(0, 1 - (distance / Math.max(0.001, explosionRadius)))
      const appliedDamage = Math.max(1, Math.round(explosionDamage * falloff))
      Health.hp[tank] = (Health.hp[tank] ?? 0) - appliedDamage
      audio.playTankHitConfirm(tankX, tankY, player.x, player.y, player.angle)
      if ((Health.hp[tank] ?? 0) <= 0) {
        Meta.alive[tank] = 0
        TankExplosion.maxDuration[tank] = 0.7
        TankExplosion.timeRemaining[tank] = 0.7
        audio.playTankDeathConfirm(tankX, tankY, player.x, player.y, player.angle)
      } // end if tank killed by explosion
    } // end for each tank in explosion radius

    const playerZ = (player.z ?? 0) + PLAYER_HEIGHT
    const playerHorizontalDistance = Math.hypot(player.x - worldX, player.y - worldY)
    const playerEdgeDistance = Math.max(0, playerHorizontalDistance - PLAYER_RADIUS)
    const playerVerticalDistance = Math.abs(playerZ - worldZ)
    const playerDistance = Math.hypot(playerEdgeDistance, playerVerticalDistance)
    if (playerDistance <= explosionRadius) {
      const playerFalloff = Math.max(0, 1 - (playerDistance / Math.max(0.001, explosionRadius)))
      const playerDamage = Math.max(1, Math.round(explosionDamage * playerFalloff))
      player.hp = Math.max(0, player.hp - playerDamage)
      audio.playPlayerMechHit()
    } // end if player was inside explosion radius

    audio.playImpact(worldX, worldY, player.x, player.y, player.angle, impactFrameCount * IMPACT_STAGGER_SECONDS)
    audio.playExplosion(worldX, worldY, player.x, player.y, player.angle, sounds)
    impactFrameCount++
    Meta.alive[entity] = 0
  } // end function triggerMissileExplosion

  // --- Update all projectiles (player bullets + tank projectiles + missiles) ---
  for (const entity of allEntities) {
    const kind = Meta.kind[entity] ?? 0
    if ((kind !== KIND_BULLET && kind !== KIND_TANK_PROJECTILE && kind !== KIND_MISSILE) || (Meta.alive[entity] ?? 0) !== 1) {
      continue
    } // end if not projectile or dead

    let angle = getNumber(Facing.angle, entity)
    let pitch = getNumber(Facing.pitch, entity)
    const currentX = getNumber(Position.x, entity)
    const currentY = getNumber(Position.y, entity)
    const currentDist = getNumber(Meta.distance, entity)
    const bulletRadius = getNumber(Meta.radius, entity)
    if (
      angle === null ||
      pitch === null ||
      currentX === null ||
      currentY === null ||
      currentDist === null ||
      bulletRadius === null
    ) {
      Meta.alive[entity] = 0
      continue
    } // end if missing projectile data

    const speed = getNumber(ProjectileStats.speed, entity) ?? (kind === KIND_TANK_PROJECTILE ? getEnemyDefinition('tank').projectileSpeed : BULLET_SPEED)
    const maxDist = getNumber(ProjectileStats.maxDistance, entity) ?? BULLET_MAX_DIST
    const originHeight = getNumber(ProjectileStats.originHeight, entity) ?? PLAYER_HEIGHT

    if (kind === KIND_MISSILE) {
      const trackingRating = Math.max(0, Math.min(1, getNumber(MissileStats.trackingRating, entity) ?? 0.4))
      const targetId = MissileStats.targetId[entity] ?? 0
      const targetAlive = (Meta.alive[targetId] ?? 0) === 1
      const targetX = getNumber(Position.x, targetId)
      const targetY = getNumber(Position.y, targetId)
      const targetHeight = getNumber(Flight.height, targetId)
      if (targetAlive && targetX !== null && targetY !== null && targetHeight !== null) {
        const desiredAngle = Math.atan2(targetY - currentY, targetX - currentX)
        const currentHeight = originHeight
        const desiredPitch = getPitchToTarget(
          currentX,
          currentY,
          currentHeight,
          targetX,
          targetY,
          targetHeight + PLAYER_HEIGHT
        )
        let deltaAngle = desiredAngle - angle
        while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2
        while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2
        let deltaPitch = desiredPitch - pitch
        while (deltaPitch > Math.PI) deltaPitch -= Math.PI * 2
        while (deltaPitch < -Math.PI) deltaPitch += Math.PI * 2
        const maxTurnRate = 2.4 + trackingRating * 6.4
        const maxTurn = maxTurnRate * deltaSeconds
        const appliedTurn = Math.max(-maxTurn, Math.min(maxTurn, deltaAngle))
        const appliedPitchTurn = Math.max(-maxTurn, Math.min(maxTurn, deltaPitch))
        angle += appliedTurn
        pitch = clampProjectilePitch(pitch + appliedPitchTurn)
        Facing.angle[entity] = angle
        Facing.pitch[entity] = pitch
      } // end if valid target for guidance
    } // end if missile guidance path

    const step = speed * deltaSeconds
  const pitchCos = Math.cos(pitch)
  const horizontalStep = kind === KIND_MISSILE ? step * Math.max(0, pitchCos) : step
    const cosA = Math.cos(angle)
    const sinA = Math.sin(angle)
  const nextX = currentX + cosA * horizontalStep
  const nextY = currentY + sinA * horizontalStep
  const nextDist = currentDist + horizontalStep

    // For missiles, originHeight tracks actual Z per frame; for ballistics use straight-line formula.
    const currentHeight = kind === KIND_MISSILE
      ? originHeight
      : getProjectileHeight(originHeight, currentDist, pitch)
    const nextHeight = kind === KIND_MISSILE
      ? originHeight - Math.sin(pitch) * step
      : getProjectileHeight(originHeight, nextDist, pitch)

    if (kind === KIND_MISSILE) {
      // guidanceTimer doubles as total-range accumulator for max-distance expiry.
      const totalRange = (MissileStats.guidanceTimer[entity] ?? 0) + step
      MissileStats.guidanceTimer[entity] = totalRange
      if (totalRange >= maxDist) {
        triggerMissileExplosion(entity, nextX, nextY, Math.max(0, nextHeight))
        continue
      } // end if missile exceeded max range
      if (nextHeight <= 0) {
        triggerMissileExplosion(entity, nextX, nextY, 0)
        continue
      } // end if missile hit ground
    } else {
      const floorCeilDist = computeFloorCeilHitDistance(originHeight, pitch)
      if (nextDist >= floorCeilDist) {
        const hitFraction = (floorCeilDist - currentDist) / Math.max(0.0001, step)
        const hitX = currentX + cosA * step * hitFraction
        const hitY = currentY + sinA * step * hitFraction
        Meta.alive[entity] = 0
        audio.playImpact(hitX, hitY, player.x, player.y, player.angle, impactFrameCount * IMPACT_STAGGER_SECONDS)
        impactFrameCount++
        continue
      } // end if floor or ceiling impact
      if (nextDist >= maxDist) {
        Meta.alive[entity] = 0
        continue
      } // end if max distance reached
    }
    if (isWorldBlockedAtHeight(collisionWorld, nextX, nextY, nextHeight, Math.max(0.02, bulletRadius * 0.55))) {
      if (kind === KIND_MISSILE) {
        triggerMissileExplosion(entity, nextX, nextY, Math.max(0, nextHeight))
      } else {
        Meta.alive[entity] = 0
        audio.playImpact(nextX, nextY, player.x, player.y, player.angle, impactFrameCount * IMPACT_STAGGER_SECONDS)
        impactFrameCount++
      } // end if missile or non-missile world collision
      continue
    } // end if wall hit

    // --- Player bullets hitting tanks ---
    if (kind === KIND_BULLET) {
      for (const tank of tankEntities) {
        const tankAlive = Meta.alive[tank] ?? 0
        if (tankAlive !== 1) {
          continue
        } // end if tank dead

        const targetX = getNumber(Position.x, tank)
        const targetY = getNumber(Position.y, tank)
        const targetRadius = getNumber(Meta.radius, tank)
        if (targetX === null || targetY === null || targetRadius === null) {
          continue
        } // end if target data missing

        const dx = nextX - targetX
        const dy = nextY - targetY
        const tankCenterHeight = Math.max(0, Flight.height[tank] ?? 0) + PLAYER_HEIGHT
        if (Math.hypot(dx, dy) < targetRadius + bulletRadius && Math.abs(nextHeight - tankCenterHeight) <= TANK_HIT_HALF_HEIGHT) {
          Meta.alive[entity] = 0
          const projectileDamage = getNumber(ProjectileStats.damage, entity) ?? 10
          Health.hp[tank] = (Health.hp[tank] ?? 0) - Math.max(1, Math.round(projectileDamage))
          audio.playImpact(targetX, targetY, player.x, player.y, player.angle, impactFrameCount * IMPACT_STAGGER_SECONDS)
          impactFrameCount++
          audio.playTankHitConfirm(targetX, targetY, player.x, player.y, player.angle)

          if ((Health.hp[tank] ?? 0) <= 0) {
            Meta.alive[tank] = 0
            TankExplosion.maxDuration[tank] = 0.7
            TankExplosion.timeRemaining[tank] = 0.7
            audio.playTankDeathConfirm(targetX, targetY, player.x, player.y, player.angle)
          } // end if tank died

          break
        } // end if tank hit
      } // end for each tank
    } // end if player bullet

    if (kind === KIND_MISSILE) {
      let exploded = false
      for (const tank of tankEntities) {
        const tankAlive = Meta.alive[tank] ?? 0
        if (tankAlive !== 1) {
          continue
        } // end if tank dead
        const targetX = getNumber(Position.x, tank)
        const targetY = getNumber(Position.y, tank)
        const targetRadius = getNumber(Meta.radius, tank)
        if (targetX === null || targetY === null || targetRadius === null) {
          continue
        } // end if missing tank collision data
        const tankCenterHeight = Math.max(0, Flight.height[tank] ?? 0) + PLAYER_HEIGHT
        const impactFraction = getFirstContactFraction(
          currentX,
          currentY,
          currentHeight,
          nextX,
          nextY,
          nextHeight,
          targetX,
          targetY,
          tankCenterHeight,
          targetRadius + bulletRadius,
          TANK_HIT_HALF_HEIGHT
        )
        if (impactFraction < 0) {
          continue
        } // end if missile did not contact tank this frame
        const impactX = currentX + ((nextX - currentX) * impactFraction)
        const impactY = currentY + ((nextY - currentY) * impactFraction)
        const impactHeight = currentHeight + ((nextHeight - currentHeight) * impactFraction)
        triggerMissileExplosion(entity, impactX, impactY, Math.max(0, impactHeight))
        exploded = true
        break
      } // end for each tank for missile impact

      if (!exploded && (ProjectileStats.owner[entity] ?? 0) !== PROJECTILE_OWNER_PLAYER) {
        const playerCenterHeight = (player.z ?? 0) + PLAYER_HEIGHT
        const impactFraction = getFirstContactFraction(
          currentX,
          currentY,
          currentHeight,
          nextX,
          nextY,
          nextHeight,
          player.x,
          player.y,
          playerCenterHeight,
          PLAYER_RADIUS + bulletRadius,
          PLAYER_HIT_HALF_HEIGHT
        )
        if (impactFraction >= 0) {
          const impactX = currentX + ((nextX - currentX) * impactFraction)
          const impactY = currentY + ((nextY - currentY) * impactFraction)
          const impactHeight = currentHeight + ((nextHeight - currentHeight) * impactFraction)
          triggerMissileExplosion(entity, impactX, impactY, Math.max(0, impactHeight))
          exploded = true
        } // end if missile impacted player
      } // end if no missile impact yet

      if (exploded) {
        continue
      } // end if missile consumed by explosion
    } // end if missile collision checks

    // --- Tank projectiles hitting player ---
    if (kind === KIND_TANK_PROJECTILE) {
      const dx = nextX - player.x
      const dy = nextY - player.y
      const playerRadius = PLAYER_RADIUS
      const playerDistance = Math.hypot(dx, dy)
      const playerCenterHeight = (player.z ?? 0) + PLAYER_HEIGHT
      if (playerDistance < playerRadius + bulletRadius && Math.abs(nextHeight - playerCenterHeight) <= PLAYER_HIT_HALF_HEIGHT) {
        const projectileDamage = Math.max(0, Math.round(getNumber(ProjectileStats.damage, entity) ?? 0))
        if (projectileDamage > 0) {
          player.hp = Math.max(0, player.hp - projectileDamage)
        } // end if projectile has damage
        Meta.alive[entity] = 0
        ProjectileStats.nearMissPlayed[entity] = 1
        audio.playImpact(nextX, nextY, player.x, player.y, player.angle, impactFrameCount * IMPACT_STAGGER_SECONDS)
        impactFrameCount++
        audio.playPlayerMechHit()
        continue
      } // end if player hit

      incomingProjectileAudioStates.push({
        id: entity,
        x: nextX,
        y: nextY,
        velocityX: cosA * speed,
        velocityY: sinA * speed,
        distanceToPlayer: playerDistance
      })
    } // end if tank projectile

    if ((Meta.alive[entity] ?? 0) !== 1) {
      continue
    } // end if projectile consumed this step

    Position.x[entity] = nextX
    Position.y[entity] = nextY
    Meta.distance[entity] = nextDist

    if (kind === KIND_MISSILE) {
      // Store actual height for next frame; reset distance so renderer uses zOrigin as true height.
      ProjectileStats.originHeight[entity] = Math.max(0.02, nextHeight)
      Meta.distance[entity] = 0
      const trail = world.missileTrails.get(entity) ?? []
      trail.push({ x: nextX, y: Math.max(0.04, nextHeight), z: nextY })
      while (trail.length > 36) {
        trail.shift()
      } // end while trim trail length
      world.missileTrails.set(entity, trail)
    } // end if storing missile trail
  } // end for each projectile

  audio.updateIncomingProjectileAudio(incomingProjectileAudioStates, player.x, player.y, player.angle)

  // --- Cleanup dead entities ---
  for (const entity of allEntities) {
    if ((Meta.alive[entity] ?? 0) !== 1) {
      const kind = Meta.kind[entity] ?? 0
      if (kind === KIND_TANK) {
        const timeRemaining = TankExplosion.timeRemaining[entity] ?? 0
        if (timeRemaining > 0) {
          continue
        } // end if waiting for explosion animation to finish
      } // end if tank entity
      world.customConfigs.delete(entity)
      world.missileExplosionSounds.delete(entity)
      world.missileTrails.delete(entity)
      removeEntity(world, entity)
    } // end if dead
  } // end for cleanup
} // end function stepCombatEcsWorld

export function getCombatRenderState(world: CombatEcsWorld): {
  bullets: Bullet[]
  enemies: EnemyRender[]
  tanks: TankRender[]
} {
  const bullets: Bullet[] = []
  const enemies: EnemyRender[] = []
  const tanks: TankRender[] = []
  const allEntities = CombatQuery(world)
  const tankEntities = TankQuery(world)

  for (const entity of allEntities) {
    if ((Meta.alive[entity] ?? 0) !== 1) {
      continue
    } // end if dead

    const kind = Meta.kind[entity] ?? 0

    if (kind === KIND_BULLET || kind === KIND_MISSILE) {
      const x = getNumber(Position.x, entity)
      const y = getNumber(Position.y, entity)
      const angle = getNumber(Facing.angle, entity)
      const pitch = getNumber(Facing.pitch, entity)
      const distance = getNumber(Meta.distance, entity)
      const radius = getNumber(Meta.radius, entity)
      if (x === null || y === null || angle === null || pitch === null || distance === null) {
        continue
      } // end if missing bullet render data

      bullets.push({
        x,
        y,
        angle,
        pitch,
        zOrigin: getNumber(ProjectileStats.originHeight, entity) ?? PLAYER_HEIGHT,
        distance,
        radius: Math.max(0.03, radius ?? BULLET_HIT_RADIUS),
        kind: kind === KIND_MISSILE ? 'missile' : 'bullet',
        trail: kind === KIND_MISSILE ? [...(world.missileTrails.get(entity) ?? [])] : [],
        alive: true
      })
      continue
    } // end if bullet entity

    if (kind === KIND_ENEMY) {
      const x = getNumber(Position.x, entity)
      const y = getNumber(Position.y, entity)
      const radius = getNumber(Meta.radius, entity)
      if (x === null || y === null || radius === null) {
        continue
      } // end if missing enemy render data

      enemies.push({
        x,
        y,
        radius,
        alive: true
      })
      continue
    } // end if enemy entity
  } // end for each basic entity

  // --- Gather tank render state ---
  for (const tank of tankEntities) {
    const alive = (Meta.alive[tank] ?? 0) === 1
    const explosionTimeRemaining = TankExplosion.timeRemaining[tank] ?? 0
    const explosionMaxDuration = TankExplosion.maxDuration[tank] ?? 0.7
    if (!alive && explosionTimeRemaining <= 0) {
      continue
    } // end if tank dead

    const x = getNumber(Position.x, tank)
    const y = getNumber(Position.y, tank)
    const radius = getNumber(Meta.radius, tank)
    const angle = getNumber(Facing.angle, tank)
    const movementAngle = getNumber(Behavior.movementAngle, tank)
    const isMoving = (Behavior.isMoving[tank] ?? 0) === 1
    const hp = Health.hp[tank]
    if (x === null || y === null || radius === null || angle === null || movementAngle === null || hp === undefined) {
      continue
    } // end if missing tank render data

    const profile = getEnemyDefinitionFromNumericId(EnemyProfile.id[tank] ?? ENEMY_NUMERIC_ID.tank)
    const velocityX = isMoving ? Math.cos(movementAngle) * profile.movementSpeed : 0
    const velocityY = isMoving ? Math.sin(movementAngle) * profile.movementSpeed : 0

    tanks.push({
      id: tank,
      enemyType: profile.id,
      x,
      y,
      radius,
      angle,
      velocityX,
      velocityY,
      airborne: (Flight.airborne[tank] ?? 0) === 1,
      height: Math.max(0, Flight.height[tank] ?? 0),
      health: Math.max(0, hp),
      maxHealth: profile.maxHp,
      alive,
      explosionIntensity: !alive && explosionMaxDuration > 0
        ? Math.max(0, Math.min(1, explosionTimeRemaining / explosionMaxDuration))
        : 0
    })
  } // end for each tank

  return { bullets, enemies, tanks }
} // end function getCombatRenderState
