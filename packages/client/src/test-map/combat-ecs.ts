import {
  addComponent,
  addEntity,
  createWorld,
  defineComponent,
  defineQuery,
  hasComponent,
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
  traceWorldHit3D,
  type WorldCollisionWorld
} from './world-collision.js'
import {
  ENEMY_NUMERIC_ID,
  getEnemyDefinition,
  getEnemyDefinitionFromNumericId
} from './enemies/index.js'
import type { EnemyDefinitionConfig, EnemyId } from './enemies/enemyTypes.js'
import type { AudioController, Bullet, EnemyRender, IncomingProjectileAudioState, MissileExplosionRender, Player, CombatEnemyRender, TrailPoint } from './types.js'
import { getMissileTypeDefinition, type MissileTypeDefinition, type MissileTypeId } from './missile-types.js'
import { MissileThreatManager, type MissileThreatSample } from './missile-threat-manager.js'
import { getLayoutIdForEntityType } from './target-layout.js'
import { SURFACE_MATERIAL, resolveWorldSurfaceMaterial } from './surface-material.js'

function getAutomaticFireDefinition(definition: unknown): EnemyDefinitionConfig['automaticFire'] {
  if (typeof definition !== 'object' || definition === null || !('automaticFire' in definition)) {
    return undefined
  } // end if definition cannot expose automatic-fire config

  return definition.automaticFire as EnemyDefinitionConfig['automaticFire']
} // end function getAutomaticFireDefinition

const KIND_BULLET = 1
const KIND_ENEMY = 2
const KIND_TANK = 3
const KIND_TANK_PROJECTILE = 4
const KIND_MISSILE = 5
const PROJECTILE_VISUAL_BULLET = 1
const PROJECTILE_VISUAL_ROCKET = 2
const PROJECTILE_VISUAL_MISSILE = 3
const PROJECTILE_VISUAL_LASER_BEAM = 4
const PROJECTILE_OWNER_PLAYER = 1
const PROJECTILE_OWNER_ENEMY = 2
const MISSILE_TARGET_NONE = 0
const MISSILE_TARGET_PLAYER = 0xffffffff
const BULLET_HIT_RADIUS = 0.25
const PLAYER_HIT_HALF_HEIGHT = 0.55
const TANK_HIT_HALF_HEIGHT = 0.6
const WORLD_CHUNK_SIZE = 64
const MISSILE_SPEED_GLOBAL_SCALE = 0.28
const MISSILE_LIFETIME_GUIDANCE_BUFFER_SECONDS = 0.45
const MISSILE_LIFETIME_GUIDANCE_SCALE = 1.45
const MISSILE_MAX_LIFETIME_SECONDS = 6.5
const MISSILE_INTERCEPT_MAX_LEAD_SECONDS = 0.75
const MISSILE_INTERCEPT_LEAD_FACTOR = 0
const MISSILE_GUIDANCE_SMOOTHING_FACTOR = 0.45
const MISSILE_PITCH_TURN_RATE_SCALE = 0.9
const MISSILE_GIVE_UP_MIN_DISTANCE = 2.5
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
const EXPLOSION_LOS_TRACE_RADIUS = 0.06
const NATO_CALLSIGNS = [
  'Alpha',
  'Bravo',
  'Charlie',
  'Delta',
  'Echo',
  'Foxtrot',
  'Golf',
  'Hotel',
  'India',
  'Juliett',
  'Kilo',
  'Lima',
  'Mike',
  'November',
  'Oscar',
  'Papa',
  'Quebec',
  'Romeo',
  'Sierra',
  'Tango',
  'Uniform',
  'Victor',
  'Whiskey',
  'X-ray',
  'Yankee',
  'Zulu'
] as const

export type IncomingDamageType = 'physical' | 'energy' | 'explosive' | 'incoming'

export interface PlayerDamageEvent {
  amount: number
  damageType: IncomingDamageType
}

export interface CombatSimulationOptions {
  shouldSimulateTank?: (x: number, y: number) => boolean
  shouldSimulateProjectile?: (x: number, y: number) => boolean
}

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
  burstShotsRemaining: Types.ui8,
  burstShotTimerSeconds: Types.f32,
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
  visualType: Types.ui8,
  owner: Types.ui8
})

const MissileStats = defineComponent({
  ownerId: Types.ui32,
  targetId: Types.ui32,
  velocityX: Types.f32,
  velocityY: Types.f32,
  directionX: Types.f32,
  directionY: Types.f32,
  speed: Types.f32,
  turnRate: Types.f32,
  damage: Types.f32,
  blastRadius: Types.f32,
  collisionRadius: Types.f32,
  proximityFuseDistance: Types.f32,
  lifetime: Types.f32,
  active: Types.ui8,
  detonated: Types.ui8
})

const CombatQuery = defineQuery([Position, Facing, Meta])
const TankQuery = defineQuery([Position, Facing, Meta, Health, Behavior, EnemyProfile])

interface MissileExplosionBurstState {
  x: number
  y: number
  z: number
  radius: number
  timeRemaining: number
  maxDuration: number
}

interface MissileGuidanceDirectionState {
  x: number
  y: number
}

interface MissileTargetVelocityState {
  x: number
  y: number
  z: number
  velocityX: number
  velocityY: number
  velocityZ: number
}

type CombatEcsWorld = IWorld & {
  customConfigs: Map<number, EnemyDefinitionConfig>
  missileExplosionSounds: Map<number, string[]>
  missileTrails: Map<number, TrailPoint[]>
  missileExplosionBursts: MissileExplosionBurstState[]
  missileGuidanceDirections: Map<number, MissileGuidanceDirectionState>
  missileTargetVelocityById: Map<number, MissileTargetVelocityState>
  missileThreatManager: MissileThreatManager
  enemyCallsignByEntity: Map<number, string>
  enemyCallsignReservationsByArchetype: Map<string, Set<string>>
  enemyCallsignNextIndexByArchetype: Map<string, number>
}

function formatCallsignByIndex(index: number): string {
  const normalizedIndex = Math.max(0, Math.floor(index))
  const base = NATO_CALLSIGNS[normalizedIndex % NATO_CALLSIGNS.length] ?? 'Zulu'
  const cycle = Math.floor(normalizedIndex / NATO_CALLSIGNS.length)
  if (cycle <= 0) {
    return base
  }
  return `${base} ${cycle + 1}`
} // end function formatCallsignByIndex

function assignEnemyCallsign(world: CombatEcsWorld, entity: number, archetypeId: string): void {
  if (world.enemyCallsignByEntity.has(entity)) {
    return
  } // end if callsign already assigned

  const normalizedArchetypeId = archetypeId.trim().length > 0 ? archetypeId : 'enemy'
  const reserved = world.enemyCallsignReservationsByArchetype.get(normalizedArchetypeId) ?? new Set<string>()
  let nextIndex = world.enemyCallsignNextIndexByArchetype.get(normalizedArchetypeId) ?? 0
  let callsign = formatCallsignByIndex(nextIndex)

  while (reserved.has(callsign)) {
    nextIndex += 1
    callsign = formatCallsignByIndex(nextIndex)
  } // end while searching next available callsign

  world.enemyCallsignByEntity.set(entity, callsign)
  reserved.add(callsign)
  world.enemyCallsignReservationsByArchetype.set(normalizedArchetypeId, reserved)
  world.enemyCallsignNextIndexByArchetype.set(normalizedArchetypeId, nextIndex + 1)
} // end function assignEnemyCallsign

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
  assignEnemyCallsign(world, enemy, 'enemy')
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
  Behavior.burstShotsRemaining[tank] = 0
  Behavior.burstShotTimerSeconds[tank] = 0
  Behavior.isMoving[tank] = 1
  Behavior.lodAccumulatorSeconds[tank] = 0
  TankExplosion.timeRemaining[tank] = 0
  TankExplosion.maxDuration[tank] = 0.7
  assignEnemyCallsign(world, tank, enemyId)
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
  ProjectileStats.visualType[bullet] = PROJECTILE_VISUAL_BULLET
  ProjectileStats.owner[bullet] = PROJECTILE_OWNER_ENEMY
} // end function spawnTankProjectile

function spawnEnemyMissile(
  world: CombatEcsWorld,
  tankEntity: number,
  tankX: number,
  tankY: number,
  player: Player
): void {
  const enemyProfileId = EnemyProfile.id[tankEntity] ?? ENEMY_NUMERIC_ID.tank
  const customConfig = world.customConfigs.get(tankEntity)
  const definition = customConfig ?? getEnemyDefinitionFromNumericId(enemyProfileId)
  const launcher = definition.missileLauncher
  if (!launcher?.enabled) {
    return
  } // end if enemy does not have missile launcher enabled

  const originHeight = Math.max(0, Flight.height[tankEntity] ?? 0) + PLAYER_HEIGHT
  const angle = Math.atan2(player.y - tankY, player.x - tankX)
  const targetZ = (player.z ?? 0) + PLAYER_HEIGHT
  const pitchToTarget = getPitchToTarget(tankX, tankY, originHeight, player.x, player.y, targetZ)
  const launcherSpeed = Math.max(1, (launcher.speed ?? getMissileTypeDefinition(launcher.missileType).speed) * MISSILE_SPEED_GLOBAL_SCALE)
  const distanceToTarget = Math.hypot(player.x - tankX, player.y - tankY, targetZ - originHeight)
  const guidedLifetime = (distanceToTarget / launcherSpeed) * MISSILE_LIFETIME_GUIDANCE_SCALE + MISSILE_LIFETIME_GUIDANCE_BUFFER_SECONDS
  const lifetimeOverride = Math.min(
    MISSILE_MAX_LIFETIME_SECONDS,
    Math.max(launcher.lifetime ?? 0, guidedLifetime)
  )
  const pitch = pitchToTarget
  spawn_missile(
    world,
    PROJECTILE_OWNER_ENEMY,
    MISSILE_TARGET_PLAYER,
    launcher.missileType,
    {
      x: tankX,
      y: tankY,
      z: originHeight,
      angle,
      pitch
    },
    {
      projectileVisualType: launcher.projectileVisualType ?? 'missile',
      explosionSounds: launcher.explosionSounds,
      overrides: {
        speed: launcher.speed,
        turnRate: launcher.turnRate,
        damage: launcher.damage,
        blastRadius: launcher.blastRadius,
        collisionRadius: launcher.collisionRadius,
        proximityFuseDistance: launcher.proximityFuseDistance,
        lifetime: lifetimeOverride
      }
    }
  )
} // end function spawnEnemyMissile

function chooseAutomaticBurstRoundCount(definition: EnemyDefinitionConfig): number {
  const automaticFire = getAutomaticFireDefinition(definition)
  if (!automaticFire?.enabled) {
    return 1
  } // end if enemy does not use automatic burst fire

  const validRoundCounts = automaticFire.burstRoundCounts.filter((count) => Number.isFinite(count) && count >= 1)
  if (validRoundCounts.length <= 0) {
    return 1
  } // end if burst round count list is not valid

  const burstIndex = Math.floor(Math.random() * validRoundCounts.length)
  return Math.max(1, Math.round(validRoundCounts[burstIndex] ?? 1))
} // end function chooseAutomaticBurstRoundCount

export function createCombatEcsWorld(): CombatEcsWorld {
  const world = createWorld() as CombatEcsWorld
  world.customConfigs = new Map()
  world.missileExplosionSounds = new Map()
  world.missileTrails = new Map()
  world.missileExplosionBursts = []
  world.missileGuidanceDirections = new Map()
  world.missileTargetVelocityById = new Map()
  world.missileThreatManager = new MissileThreatManager()
  world.enemyCallsignByEntity = new Map()
  world.enemyCallsignReservationsByArchetype = new Map()
  world.enemyCallsignNextIndexByArchetype = new Map()
  return world
} // end function createCombatEcsWorld

function canSpawnTankAt(
  world: CombatEcsWorld,
  collisionWorld: WorldCollisionWorld,
  x: number,
  y: number,
  player: Player,
  collisionRadius?: number,
  allowCloseToPlayer = false
): boolean {
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

  const distanceToPlayer = Math.hypot(x - player.x, y - player.y)
  if (!allowCloseToPlayer && distanceToPlayer < 4.5) {
    return false
  } // end if too close to player spawn area

  if (!allowCloseToPlayer && (distanceToPlayer < SPAWN_MIN_PLAYER_DISTANCE || distanceToPlayer > SPAWN_MAX_PLAYER_DISTANCE)) {
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

export function spawnEnemyAtPosition(world: CombatEcsWorld, x: number, y: number, enemyId: EnemyId = 'tank'): void {
  addTank(world, x, y, enemyId)
} // end function spawnEnemyAtPosition

export function spawnEnemyFromConfigAtPosition(world: CombatEcsWorld, x: number, y: number, config: EnemyDefinitionConfig): void {
  addTankFromConfig(world, x, y, config)
} // end function spawnEnemyFromConfigAtPosition

function chooseCloseSpawnCandidateInFront(player: Player, distance: number): { x: number; y: number } {
  const candidateX = Math.max(1.25, Math.min(MAP_WIDTH - 1.25, player.x + Math.cos(player.angle) * distance))
  const candidateY = Math.max(1.25, Math.min(MAP_HEIGHT - 1.25, player.y + Math.sin(player.angle) * distance))
  return { x: candidateX, y: candidateY }
} // end function chooseCloseSpawnCandidateInFront

export function spawnEnemyCloseInFront(world: CombatEcsWorld, collisionWorld: WorldCollisionWorld, player: Player, enemyId: EnemyId): boolean {
  if (!canSpawnEnemyByBudget(world, enemyId)) {
    return false
  } // end if enemy budget does not allow spawning this enemy type

  const definition = getEnemyDefinition(enemyId)
  const candidateDistances = [3.2, 4.2, 5.2, 6.4]
  for (const distance of candidateDistances) {
    const { x, y } = chooseCloseSpawnCandidateInFront(player, distance)
    if (!canSpawnTankAt(world, collisionWorld, x, y, player, definition.collisionRadius, true)) {
      continue
    } // end if candidate is blocked
    addTank(world, x, y, enemyId)
    Facing.angle[TankQuery(world)[TankQuery(world).length - 1] ?? 0] = player.angle + Math.PI
    return true
  } // end for each close spawn candidate

  return false
} // end function spawnEnemyCloseInFront

export function spawnEnemyConfigCloseInFront(world: CombatEcsWorld, collisionWorld: WorldCollisionWorld, player: Player, config: EnemyDefinitionConfig): boolean {
  if (!canSpawnEnemyByBudget(world, config.id)) {
    return false
  } // end if enemy budget does not allow spawning this config

  const candidateDistances = [3.2, 4.2, 5.2, 6.4]
  for (const distance of candidateDistances) {
    const { x, y } = chooseCloseSpawnCandidateInFront(player, distance)
    if (!canSpawnTankAt(world, collisionWorld, x, y, player, config.collisionRadius, true)) {
      continue
    } // end if candidate is blocked
    addTankFromConfig(world, x, y, config)
    Facing.angle[TankQuery(world)[TankQuery(world).length - 1] ?? 0] = player.angle + Math.PI
    return true
  } // end for each close spawn candidate

  return false
} // end function spawnEnemyConfigCloseInFront

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
  Behavior.burstShotsRemaining[tank] = 0
  Behavior.burstShotTimerSeconds[tank] = 0
  Behavior.isMoving[tank] = 1
  Behavior.lodAccumulatorSeconds[tank] = 0
  TankExplosion.timeRemaining[tank] = 0
  TankExplosion.maxDuration[tank] = 0.7
  world.customConfigs.set(tank, config)
  assignEnemyCallsign(world, tank, config.id)
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
  projectileVisualType: 'bullet' | 'rocket' | 'missile' | 'laserBeam' = 'bullet',
  accuracy = 1,
  playerSpeedFraction = 0,
  stability = 1,
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
    stability,
    projectileCount,
    spreadDegrees,
    damage,
    speed,
    maxDistance,
    projectileSize,
    projectileVisualType
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
  projectileSize: number,
  projectileVisualType: 'bullet' | 'rocket' | 'missile' | 'laserBeam'
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
  if (projectileVisualType === 'laserBeam') {
    ProjectileStats.visualType[bullet] = PROJECTILE_VISUAL_LASER_BEAM
  } else if (projectileVisualType === 'rocket') {
    ProjectileStats.visualType[bullet] = PROJECTILE_VISUAL_ROCKET
  } else if (projectileVisualType === 'missile') {
    ProjectileStats.visualType[bullet] = PROJECTILE_VISUAL_MISSILE
  } else {
    ProjectileStats.visualType[bullet] = PROJECTILE_VISUAL_BULLET
  }
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
  stability: number,
  projectileCount: number,
  spreadDegrees: number,
  damage: number,
  speed: number,
  maxDistance: number,
  projectileSize: number,
  projectileVisualType: 'bullet' | 'rocket' | 'missile' | 'laserBeam'
): void {
  const clampedAccuracy = Math.max(0, Math.min(1, accuracy))
  const clampedSpeedFraction = Math.max(0, Math.min(1, playerSpeedFraction))
  const clampedStability = Math.max(0.1, stability)
  const baseHalfAngle = WEAPON_MAX_CONE_RADIANS * Math.max(0, 1 - clampedAccuracy)
  const movementPenaltyFactor = clampedSpeedFraction <= 0
    ? 0
    : clampedSpeedFraction * (WEAPON_MOVEMENT_ACCURACY_PENALTY / clampedStability)
  const accuracyHalfAngle = baseHalfAngle * (1 + movementPenaltyFactor)
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
      projectileSize,
      projectileVisualType
    )
  } // end for each projectile in burst
} // end function spawnPlayerProjectileBurst

interface MissileSpawnPosition {
  x: number
  y: number
  z: number
  angle: number
  pitch: number
}

interface MissileSpawnOptions {
  projectileVisualType?: 'rocket' | 'missile'
  explosionSounds?: string[]
  overrides?: Partial<MissileTypeDefinition>
}

function normalizeAngleRadians(radians: number): number {
  let normalized = radians
  while (normalized > Math.PI) normalized -= Math.PI * 2
  while (normalized < -Math.PI) normalized += Math.PI * 2
  return normalized
} // end function normalizeAngleRadians

function resolveSpawnHeadingToTarget(
  targetId: number,
  fallbackAngle: number,
  spawnX: number,
  spawnY: number
): number {
  if (targetId === MISSILE_TARGET_NONE || targetId === MISSILE_TARGET_PLAYER) {
    return fallbackAngle
  } // end if target is non-entity sentinel

  if ((Meta.alive[targetId] ?? 0) !== 1) {
    return fallbackAngle
  } // end if target entity no longer valid

  const targetX = getNumber(Position.x, targetId)
  const targetY = getNumber(Position.y, targetId)
  if (targetX === null || targetY === null) {
    return fallbackAngle
  } // end if target position is unavailable

  return Math.atan2(targetY - spawnY, targetX - spawnX)
} // end function resolveSpawnHeadingToTarget

export function spawn_missile(
  world: CombatEcsWorld,
  owner_id: number,
  target_id: number,
  missile_type: MissileTypeId | string,
  spawn_position: MissileSpawnPosition,
  options?: MissileSpawnOptions
): number {
  const baseStats = getMissileTypeDefinition(missile_type)
  const overrideStats = options?.overrides ?? {}
  const speed = Math.max(1, (overrideStats.speed ?? baseStats.speed) * MISSILE_SPEED_GLOBAL_SCALE)
  const turnRate = Math.max(0, overrideStats.turnRate ?? baseStats.turnRate)
  const damage = Math.max(0, overrideStats.damage ?? baseStats.damage)
  const blastRadius = Math.max(0.2, overrideStats.blastRadius ?? baseStats.blastRadius)
  const collisionRadius = Math.max(0.08, overrideStats.collisionRadius ?? baseStats.collisionRadius)
  const proximityFuseDistance = Math.max(0, overrideStats.proximityFuseDistance ?? baseStats.proximityFuseDistance)
  const lifetime = Math.max(0.05, overrideStats.lifetime ?? baseStats.lifetime)

  const initialAngle = resolveSpawnHeadingToTarget(target_id, spawn_position.angle, spawn_position.x, spawn_position.y)
  const directionX = Math.cos(initialAngle)
  const directionY = Math.sin(initialAngle)
  const velocityX = directionX * speed
  const velocityY = directionY * speed
  const missile = addEntity(world)
  addComponent(world, Position, missile)
  addComponent(world, Facing, missile)
  addComponent(world, Meta, missile)
  addComponent(world, ProjectileStats, missile)
  addComponent(world, MissileStats, missile)

  Position.x[missile] = spawn_position.x
  Position.y[missile] = spawn_position.y
  Facing.angle[missile] = initialAngle
  Facing.pitch[missile] = clampProjectilePitch(spawn_position.pitch)
  Meta.kind[missile] = KIND_MISSILE
  Meta.radius[missile] = collisionRadius
  Meta.distance[missile] = 0
  Meta.alive[missile] = 1
  ProjectileStats.speed[missile] = speed
  ProjectileStats.damage[missile] = Math.max(0, Math.round(damage))
  ProjectileStats.maxDistance[missile] = speed * lifetime
  ProjectileStats.originHeight[missile] = Math.max(0.02, spawn_position.z)
  ProjectileStats.nearMissPlayed[missile] = 0
  ProjectileStats.visualType[missile] = (options?.projectileVisualType ?? 'missile') === 'rocket'
    ? PROJECTILE_VISUAL_ROCKET
    : PROJECTILE_VISUAL_MISSILE
  ProjectileStats.owner[missile] = owner_id

  MissileStats.ownerId[missile] = owner_id
  MissileStats.targetId[missile] = target_id
  MissileStats.velocityX[missile] = velocityX
  MissileStats.velocityY[missile] = velocityY
  MissileStats.directionX[missile] = directionX
  MissileStats.directionY[missile] = directionY
  MissileStats.speed[missile] = speed
  MissileStats.turnRate[missile] = turnRate
  MissileStats.damage[missile] = damage
  MissileStats.blastRadius[missile] = blastRadius
  MissileStats.collisionRadius[missile] = collisionRadius
  MissileStats.proximityFuseDistance[missile] = proximityFuseDistance
  MissileStats.lifetime[missile] = lifetime
  MissileStats.active[missile] = 1
  MissileStats.detonated[missile] = 0

  const explosionSounds = options?.explosionSounds ?? baseStats.explosionSounds
  world.missileExplosionSounds.set(missile, [...explosionSounds])
  world.missileTrails.set(missile, [
    { x: spawn_position.x, y: Math.max(0.02, spawn_position.z), z: spawn_position.y }
  ])
  return missile
}

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
  stability = 1,
  damage = 10,
  speed = BULLET_SPEED,
  maxDistance = BULLET_MAX_DIST,
  projectileSize = BULLET_HIT_RADIUS,
  projectileVisualType: 'bullet' | 'rocket' | 'missile' | 'laserBeam' = 'bullet',
  projectileCount = 1,
  spreadDegrees = 0
): void {
  const baseAngle = Math.atan2(targetY - player.y, targetX - player.x)
  const originHeight = (player.z ?? 0) + PLAYER_HEIGHT
  const basePitch = getPitchToTarget(player.x, player.y, originHeight, targetX, targetY, targetZ)
  spawnPlayerProjectileBurst(
    world,
    player,
    baseAngle,
    basePitch,
    accuracy,
    playerSpeedFraction,
    stability,
    projectileCount,
    spreadDegrees,
    damage,
    speed,
    maxDistance,
    projectileSize,
    projectileVisualType
  )
} // end function spawnPlayerBulletToward

export function spawnPlayerMissile(
  world: CombatEcsWorld,
  player: Player,
  targetTankId: number | null,
  damage: number,
  speed: number,
  maxDistance: number,
  projectileSize: number,
  trackingRating: number,
  explosionRadius: number,
  explosionDamage: number,
  explosionSounds: string[],
  projectileVisualType: 'rocket' | 'missile' = 'missile',
  accuracy = 1,
  playerSpeedFraction = 0,
  stability = 1
): void {
  const hasValidTarget = targetTankId !== null && (Meta.alive[targetTankId] ?? 0) === 1
  const targetX = hasValidTarget ? (getNumber(Position.x, targetTankId) ?? player.x) : player.x
  const targetY = hasValidTarget ? (getNumber(Position.y, targetTankId) ?? player.y) : player.y
  const targetZ = hasValidTarget
    ? (Math.max(0, getNumber(Flight.height, targetTankId) ?? (player.z ?? 0)) + PLAYER_HEIGHT)
    : ((player.z ?? 0) + PLAYER_HEIGHT)
  const angle = hasValidTarget ? Math.atan2(targetY - player.y, targetX - player.x) : player.angle
  const originHeight = (player.z ?? 0) + PLAYER_HEIGHT
  const clampedAccuracy = Math.max(0, Math.min(1, accuracy))
  const clampedSpeedFraction = Math.max(0, Math.min(1, playerSpeedFraction))
  const clampedStability = Math.max(0.1, stability)
  const baseHalfAngle = WEAPON_MAX_CONE_RADIANS * Math.max(0, 1 - clampedAccuracy)
  const movementPenaltyFactor = clampedSpeedFraction <= 0
    ? 0
    : clampedSpeedFraction * (WEAPON_MOVEMENT_ACCURACY_PENALTY / clampedStability)
  const accuracyHalfAngle = baseHalfAngle * (1 + movementPenaltyFactor)
  const launchOffset = hasValidTarget
    ? { yawOffset: 0, pitchOffset: 0 }
    : sampleConeOffset(accuracyHalfAngle)
  const turnRate = Math.max(0, Math.min(1, trackingRating)) * 8.8
  const helicopterLauncherSpeed = getEnemyDefinition('helicopter').missileLauncher?.speed
  const homingSpeed = Math.max(1, helicopterLauncherSpeed ?? speed)
  const effectiveSpeed = Math.max(1, homingSpeed * MISSILE_SPEED_GLOBAL_SCALE)
  const baseLifetime = Math.max(0.08, Math.max(1, maxDistance) / effectiveSpeed)
  const targetDistance = Math.hypot(targetX - player.x, targetY - player.y, targetZ - originHeight)
  const guidedLifetime = (targetDistance / effectiveSpeed) * MISSILE_LIFETIME_GUIDANCE_SCALE + MISSILE_LIFETIME_GUIDANCE_BUFFER_SECONDS
  const lifetime = Math.min(MISSILE_MAX_LIFETIME_SECONDS, Math.max(baseLifetime, guidedLifetime))
  spawn_missile(
    world,
    PROJECTILE_OWNER_PLAYER,
    targetTankId ?? MISSILE_TARGET_NONE,
    'medium',
    {
      x: player.x,
      y: player.y,
      z: originHeight,
      angle: angle + launchOffset.yawOffset,
      pitch: (hasValidTarget
        ? getPitchToTarget(player.x, player.y, originHeight, targetX, targetY, targetZ)
        : player.pitch) + launchOffset.pitchOffset
    },
    {
      projectileVisualType,
      explosionSounds,
      overrides: {
        speed: homingSpeed,
        turnRate,
        damage: Math.max(0, explosionDamage > 0 ? explosionDamage : damage),
        blastRadius: explosionRadius,
        collisionRadius: projectileSize,
        proximityFuseDistance: Math.max(0.25, projectileSize * 1.4),
        lifetime
      }
    }
  )
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

function applyDirectFireDamageToTankCore(tank: number, rawDamage: number): number {
  // Ticket 23: direct-fire damage routes to Core while subsystem routing is not yet implemented.
  const appliedDamage = Math.max(1, Math.round(rawDamage))
  Health.hp[tank] = (Health.hp[tank] ?? 0) - appliedDamage
  return appliedDamage
} // end function applyDirectFireDamageToTankCore

export function applyDirectHitscanDamage(
  world: CombatEcsWorld,
  entity: number,
  rawDamage: number,
  audio: AudioController,
  player: Player,
  suppressHitConfirm = false
): {
  appliedDamage: number
  killed: boolean
  position: { x: number; y: number }
} | null {
  const kind = Meta.kind[entity] ?? 0
  if (kind !== KIND_TANK && kind !== KIND_ENEMY) {
    return null
  } // end if entity is not damageable by direct hitscan

  if ((Meta.alive[entity] ?? 0) !== 1) {
    return null
  } // end if entity is already dead

  const targetX = getNumber(Position.x, entity)
  const targetY = getNumber(Position.y, entity)
  if (targetX === null || targetY === null) {
    return null
  } // end if entity has no position data

  const appliedDamage = Math.max(1, Math.round(rawDamage))
  Health.hp[entity] = (Health.hp[entity] ?? 0) - appliedDamage
  const killed = (Health.hp[entity] ?? 0) <= 0

  if (kind === KIND_TANK && !suppressHitConfirm) {
    audio.playTankHitConfirm(targetX, targetY, player.x, player.y, player.angle)
  }

  if (killed) {
    Meta.alive[entity] = 0
    if (kind === KIND_TANK) {
      TankExplosion.maxDuration[entity] = 0.7
      TankExplosion.timeRemaining[entity] = 0.7
      audio.playTankDeathConfirm(targetX, targetY, player.x, player.y, player.angle)
    }
  }

  void world
  return {
    appliedDamage,
    killed,
    position: { x: targetX, y: targetY }
  }
} // end function applyDirectHitscanDamage

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

function getFirstSphereContactFraction(
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
  targetX: number,
  targetY: number,
  targetZ: number,
  hitRadius: number
): number {
  const segmentX = endX - startX
  const segmentY = endY - startY
  const segmentZ = endZ - startZ
  const originToCenterX = startX - targetX
  const originToCenterY = startY - targetY
  const originToCenterZ = startZ - targetZ
  const radius = Math.max(0.0001, hitRadius)

  const a = (segmentX * segmentX) + (segmentY * segmentY) + (segmentZ * segmentZ)
  const b = 2 * ((originToCenterX * segmentX) + (originToCenterY * segmentY) + (originToCenterZ * segmentZ))
  const c = (originToCenterX * originToCenterX) + (originToCenterY * originToCenterY) + (originToCenterZ * originToCenterZ) - (radius * radius)

  if (a <= 0.000001) {
    return c <= 0 ? 0 : -1
  } // end if segment has no meaningful length

  const discriminant = (b * b) - (4 * a * c)
  if (discriminant < 0) {
    return -1
  } // end if no line-sphere intersection

  const sqrtDiscriminant = Math.sqrt(discriminant)
  const t0 = (-b - sqrtDiscriminant) / (2 * a)
  const t1 = (-b + sqrtDiscriminant) / (2 * a)

  if (t0 >= 0 && t0 <= 1) {
    return t0
  } // end if first intersection point is within this frame segment
  if (t1 >= 0 && t1 <= 1) {
    return t1
  } // end if second intersection point is within this frame segment

  return -1
} // end function getFirstSphereContactFraction

function getExplosionExposureMultiplier(obstacleType: 'wall' | 'tree' | 'rock' | 'pillar' | null): number {
  if (obstacleType === null) {
    return 1
  }

  // Hard cover fully blocks blast; softer obstacles heavily attenuate exposure.
  if (obstacleType === 'wall' || obstacleType === 'pillar') {
    return 0
  }
  if (obstacleType === 'rock') {
    return 0.25
  }
  return 0.4
} // end function getExplosionExposureMultiplier

function computeExplosionDamageMultiplier(distance: number, radius: number): number {
  const normalizedDistance = Math.max(0, Math.min(1, distance / Math.max(0.0001, radius)))
  const inverseDistance = Math.max(0, 1 - normalizedDistance)
  return inverseDistance * inverseDistance
} // end function computeExplosionDamageMultiplier

function getNumber(store: ArrayLike<number>, entity: number): number | null {
  const value = store[entity]
  if (value === undefined) {
    return null
  } // end if missing store value
  return value
} // end function getNumber

function normalizeAngleDelta(angle: number): number {
  let wrapped = angle
  while (wrapped > Math.PI) {
    wrapped -= Math.PI * 2
  } // end while angle above positive wrap
  while (wrapped < -Math.PI) {
    wrapped += Math.PI * 2
  } // end while angle below negative wrap
  return wrapped
} // end function normalizeAngleDelta

function isTargetInsideMeleeCone(
  attackerX: number,
  attackerY: number,
  attackerAngle: number,
  targetX: number,
  targetY: number,
  targetRadius: number,
  range: number,
  coneAngleDegrees: number
): boolean {
  const dx = targetX - attackerX
  const dy = targetY - attackerY
  const targetDistance = Math.max(0, Math.hypot(dx, dy) - Math.max(0, targetRadius))
  if (targetDistance > range) {
    return false
  } // end if target is outside melee reach

  const targetAngle = Math.atan2(dy, dx)
  const halfAngleRadians = Math.max(0, coneAngleDegrees) * (Math.PI / 360)
  return Math.abs(normalizeAngleDelta(targetAngle - attackerAngle)) <= halfAngleRadians
} // end function isTargetInsideMeleeCone

export function performPlayerMeleeAttack(
  world: CombatEcsWorld,
  audio: AudioController,
  player: Player,
  damage: number,
  range: number,
  coneAngleDegrees: number
): number {
  let hits = 0

  for (const tank of TankQuery(world)) {
    if ((Meta.alive[tank] ?? 0) !== 1) {
      continue
    } // end if tank already dead

    const tankX = getNumber(Position.x, tank)
    const tankY = getNumber(Position.y, tank)
    const tankRadius = getNumber(Meta.radius, tank)
    if (tankX === null || tankY === null || tankRadius === null) {
      continue
    } // end if tank is missing collision data

    if (!isTargetInsideMeleeCone(player.x, player.y, player.angle, tankX, tankY, tankRadius, range, coneAngleDegrees)) {
      continue
    } // end if tank is outside player melee cone

    hits += 1
    Health.hp[tank] = (Health.hp[tank] ?? 0) - Math.max(1, Math.round(damage))
    audio.playTankHitConfirm(tankX, tankY, player.x, player.y, player.angle)

    if ((Health.hp[tank] ?? 0) <= 0) {
      Meta.alive[tank] = 0
      TankExplosion.maxDuration[tank] = 0.7
      TankExplosion.timeRemaining[tank] = 0.7
      audio.playTankDeathConfirm(tankX, tankY, player.x, player.y, player.angle)
    } // end if tank died from melee attack
  } // end for each tank

  return hits
} // end function performPlayerMeleeAttack

export function stepCombatEcsWorld(
  world: CombatEcsWorld,
  collisionWorld: WorldCollisionWorld,
  audio: AudioController,
  player: Player,
  deltaSeconds: number,
  onPlayerDamaged?: (event: PlayerDamageEvent) => void,
  options?: CombatSimulationOptions
): void {
  player.maxHp = Math.max(1, player.maxHp ?? 100)
  player.hp = Math.max(0, Math.min(player.maxHp, player.hp ?? player.maxHp))

  const allEntities = CombatQuery(world)
  let impactFrameCount = 0
  const IMPACT_STAGGER_SECONDS = 0.001
  const incomingProjectileAudioStates: IncomingProjectileAudioState[] = []
  const missileThreatSamples: MissileThreatSample[] = []
  const tankEntities = TankQuery(world)
  const safeDeltaSeconds = Math.max(0.0001, deltaSeconds)

  const updateTargetVelocitySample = (targetId: number, worldX: number, worldY: number, worldZ: number): void => {
    const previousSample = world.missileTargetVelocityById.get(targetId)
    const velocityX = previousSample ? (worldX - previousSample.x) / safeDeltaSeconds : 0
    const velocityY = previousSample ? (worldY - previousSample.y) / safeDeltaSeconds : 0
    const velocityZ = previousSample ? (worldZ - previousSample.z) / safeDeltaSeconds : 0
    world.missileTargetVelocityById.set(targetId, {
      x: worldX,
      y: worldY,
      z: worldZ,
      velocityX,
      velocityY,
      velocityZ
    })
  } // end function updateTargetVelocitySample

  updateTargetVelocitySample(MISSILE_TARGET_PLAYER, player.x, player.y, (player.z ?? 0) + PLAYER_HEIGHT)
  for (const candidate of tankEntities) {
    if ((Meta.alive[candidate] ?? 0) !== 1) {
      continue
    }
    const targetX = getNumber(Position.x, candidate)
    const targetY = getNumber(Position.y, candidate)
    if (targetX === null || targetY === null) {
      continue
    }
    updateTargetVelocitySample(candidate, targetX, targetY, Math.max(0, getNumber(Flight.height, candidate) ?? 0) + PLAYER_HEIGHT)
  }

  for (let burstIndex = world.missileExplosionBursts.length - 1; burstIndex >= 0; burstIndex -= 1) {
    const burst = world.missileExplosionBursts[burstIndex]
    if (!burst) {
      world.missileExplosionBursts.splice(burstIndex, 1)
      continue
    } // end if burst entry is invalid

    burst.timeRemaining = Math.max(0, burst.timeRemaining - deltaSeconds)
    if (burst.timeRemaining <= 0) {
      world.missileExplosionBursts.splice(burstIndex, 1)
    } // end if burst visual has expired
  } // end for each missile explosion burst

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

    if (options?.shouldSimulateTank && !options.shouldSimulateTank(tankX, tankY)) {
      continue
    } // end if tank chunk is not active this frame

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
    const burstShotsRemaining = getNumber(Behavior.burstShotsRemaining, tank)
    const burstShotTimerSeconds = getNumber(Behavior.burstShotTimerSeconds, tank)
    const lodAccumulator = getNumber(Behavior.lodAccumulatorSeconds, tank)
    if (
      movementAngle === null ||
      movementTimer === null ||
      cannonCooldown === null ||
      attackWindup === null ||
      burstShotsRemaining === null ||
      burstShotTimerSeconds === null ||
      lodAccumulator === null
    ) {
      continue
    } // end if behavior missing

    const distanceToPlayer = Math.hypot(tankX - player.x, tankY - player.y)
    const meleeDefinition = enemyDefinition.melee
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
    const directionToPlayer = Math.atan2(player.y - tankY, player.x - tankX)
    let targetMovementAngle = meleeDefinition
      ? directionToPlayer
      : movementAngle
    const meleeCooldownRemaining = meleeDefinition
      ? Math.max(0, cannonCooldown - simulationStepSeconds)
      : 0
    const meleeCanReposition = meleeDefinition !== undefined && meleeCooldownRemaining > 0
    let meleeRepositionAngle = movementAngle
    let meleeRepositionTimer = movementTimer
    const meleeRepositionDistance = meleeDefinition
      ? meleeDefinition.range * 1.35
      : 0
    const shouldMeleeReposition = meleeCanReposition && distanceToPlayer <= meleeRepositionDistance

    if (shouldMeleeReposition) {
      meleeRepositionTimer = Math.max(0, movementTimer - simulationStepSeconds)
      if (meleeRepositionTimer <= 0) {
        const strafeSide = Math.random() < 0.5 ? -1 : 1
        const jitter = (Math.random() - 0.5) * 0.35
        meleeRepositionAngle = directionToPlayer + (strafeSide * Math.PI / 2) + jitter
        meleeRepositionTimer = 0.22 + (Math.random() * 0.34)
      } // end if choosing a new reposition vector
      targetMovementAngle = meleeRepositionAngle
    } // end if melee enemy should reposition this frame

    const isStationary = enemyDefinition.behavior.stationary
    const movementScale = shouldMeleeReposition ? 0.62 : 1
    const moveStep = isStationary ? 0 : enemyDefinition.movementSpeed * simulationStepSeconds * movementScale
    const nextX = tankX + Math.cos(targetMovementAngle) * moveStep
    const nextY = tankY + Math.sin(targetMovementAngle) * moveStep

    const tankRadius = Math.max(0.15, enemyDefinition.collisionRadius)
    const canMove = !isPlayerBlocked(
      collisionWorld,
      nextX,
      nextY,
      Math.max(0, Flight.height[tank] ?? 0),
      tankRadius,
      1.2
    )

    if (isStationary) {
      Position.x[tank] = tankX
      Position.y[tank] = tankY
      Facing.angle[tank] = meleeDefinition ? Math.atan2(player.y - tankY, player.x - tankX) : movementAngle
      Behavior.isMoving[tank] = 0
      Behavior.movementTimer[tank] = 0
      if (meleeDefinition) {
        Behavior.movementAngle[tank] = directionToPlayer
      } // end if stationary melee should still keep facing update
    } else if (!canMove) {
      Behavior.isMoving[tank] = 0
      Behavior.movementAngle[tank] = meleeDefinition ? directionToPlayer : (Math.random() * Math.PI * 2)
      Behavior.movementTimer[tank] = meleeDefinition ? movementTimer : 0
    } else {
      Position.x[tank] = nextX
      Position.y[tank] = nextY
      Facing.angle[tank] = targetMovementAngle
      Behavior.movementTimer[tank] = movementTimer + simulationStepSeconds

      // Retarget movement heading using enemy behavior settings.
      if (!meleeDefinition && movementTimer > enemyDefinition.behavior.retargetIntervalSeconds) {
        Behavior.movementAngle[tank] = Math.random() * Math.PI * 2
        Behavior.movementTimer[tank] = 0
      } // end if time to change direction

      if (meleeDefinition) {
        Behavior.movementAngle[tank] = shouldMeleeReposition ? meleeRepositionAngle : directionToPlayer
        Behavior.movementTimer[tank] = shouldMeleeReposition ? meleeRepositionTimer : 0
      } // end if melee enemy should continue closing distance

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

    if (meleeDefinition) {
      const newCooldown = meleeCooldownRemaining
      Behavior.cannonFireCooldown[tank] = newCooldown
      Behavior.attackWindupSeconds[tank] = 0
      Behavior.burstShotsRemaining[tank] = 0
      Behavior.burstShotTimerSeconds[tank] = 0
      Facing.angle[tank] = Math.atan2(player.y - nextY, player.x - nextX)

      if (
        canShootByLos &&
        newCooldown <= 0 &&
        isTargetInsideMeleeCone(
          nextX,
          nextY,
          Facing.angle[tank] ?? 0,
          player.x,
          player.y,
          PLAYER_RADIUS,
          meleeDefinition.range,
          meleeDefinition.coneAngleDegrees
        )
      ) {
        Behavior.cannonFireCooldown[tank] = Math.max(0.05, meleeDefinition.cooldownSeconds)
        const postAttackStrafeSide = Math.random() < 0.5 ? -1 : 1
        Behavior.movementAngle[tank] = Facing.angle[tank] + (postAttackStrafeSide * Math.PI / 2)
        Behavior.movementTimer[tank] = 0.26 + (Math.random() * 0.34)
        audio.playEnemyAttack(`tank-${tank}`, enemyDefinition.id)
        const meleeDamage = Math.max(1, Math.round(meleeDefinition.damage))
        player.hp = Math.max(0, player.hp - meleeDamage)
        onPlayerDamaged?.({ amount: meleeDamage, damageType: 'physical' })
        audio.playPlayerMechHit()
      } // end if melee strike landed this frame

      continue
    } // end if enemy uses melee combat

    if (attackWindup > 0) {
      const newWindup = Math.max(0, attackWindup - simulationStepSeconds)
      Behavior.attackWindupSeconds[tank] = newWindup
      if (newWindup <= 0 && canShootByLos && dist < enemyDefinition.behavior.preferredEngageRange) {
        const automaticFire = getAutomaticFireDefinition(enemyDefinition)
        if (automaticFire?.enabled) {
          const roundsInBurst = chooseAutomaticBurstRoundCount(enemyDefinition)
          Behavior.burstShotsRemaining[tank] = roundsInBurst
          Behavior.burstShotTimerSeconds[tank] = 0
          audio.playEnemyAttack(`tank-${tank}`, enemyDefinition.id, roundsInBurst)
        } else {
          if (enemyDefinition.missileLauncher?.enabled) {
            spawnEnemyMissile(world, tank, nextX, nextY, player)
          } else {
            spawnTankProjectile(world, tank, nextX, nextY, player.x, player.y, (player.z ?? 0) + PLAYER_HEIGHT)
          }
          audio.playEnemyAttack(`tank-${tank}`, enemyDefinition.id)
        } // end if automatic or single-shot fire mode
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

    let remainingBurstShots = Math.max(0, Math.round(Behavior.burstShotsRemaining[tank] ?? 0))
    let burstTimerSeconds = Math.max(0, Behavior.burstShotTimerSeconds[tank] ?? 0)
    const automaticFire = getAutomaticFireDefinition(enemyDefinition)

    if (remainingBurstShots > 0) {
      const burstIntervalSeconds = automaticFire?.enabled
        ? Math.max(0.01, automaticFire.burstIntervalSeconds)
        : enemyDefinition.fireRateSeconds
      burstTimerSeconds = Math.max(0, burstTimerSeconds - simulationStepSeconds)

      while (remainingBurstShots > 0 && burstTimerSeconds <= 0) {
        if (enemyDefinition.missileLauncher?.enabled) {
          spawnEnemyMissile(world, tank, nextX, nextY, player)
        } else {
          spawnTankProjectile(world, tank, nextX, nextY, player.x, player.y, (player.z ?? 0) + PLAYER_HEIGHT)
        }
        remainingBurstShots -= 1
        burstTimerSeconds += burstIntervalSeconds
      } // end while burst can fire another round this frame
    } // end if burst is active

    Behavior.burstShotsRemaining[tank] = remainingBurstShots
    Behavior.burstShotTimerSeconds[tank] = remainingBurstShots > 0
      ? Math.max(0, burstTimerSeconds)
      : 0
  } // end for each tank

  const create_explosion = (
    position: { x: number; y: number; z: number },
    radius: number,
    damage: number,
    owner_id: number,
    sounds: string[]
  ): void => {
    const effectiveRadius = Math.max(0.001, radius)
    const effectiveDamage = Math.max(0, damage)
    const burstDuration = Math.max(0.7, Math.min(1.9, 0.75 + (effectiveRadius * 0.22)))
    world.missileExplosionBursts.push({
      x: position.x,
      y: position.y,
      z: Math.max(0, position.z),
      radius: effectiveRadius,
      timeRemaining: burstDuration,
      maxDuration: burstDuration
    })

    for (const candidate of allEntities) {
      if ((Meta.alive[candidate] ?? 0) !== 1 || !hasComponent(world, Health, candidate)) {
        continue
      } // end if entity cannot receive HP damage

      const targetX = getNumber(Position.x, candidate)
      const targetY = getNumber(Position.y, candidate)
      if (targetX === null || targetY === null) {
        continue
      } // end if target lacks position

      const targetZ = Math.max(0, hasComponent(world, Flight, candidate)
        ? (getNumber(Flight.height, candidate) ?? 0)
        : 0) + PLAYER_HEIGHT
      const distance = Math.hypot(targetX - position.x, targetY - position.y, targetZ - position.z)
      if (distance > effectiveRadius) {
        continue
      } // end if outside explosion radius

      const occlusionHit = traceWorldHit3D(
        collisionWorld,
        { x: position.x, y: position.y, z: position.z },
        { x: targetX, y: targetY, z: targetZ },
        EXPLOSION_LOS_TRACE_RADIUS
      )
      const exposureMultiplier = getExplosionExposureMultiplier(occlusionHit?.obstacleType ?? null)
      if (exposureMultiplier <= 0) {
        continue
      } // end if hard cover fully blocked blast

      const damageMultiplier = computeExplosionDamageMultiplier(distance, effectiveRadius) * exposureMultiplier
      const finalDamage = Math.max(0, effectiveDamage * damageMultiplier)
      const appliedDamage = Math.max(0, Math.round(finalDamage))
      if (appliedDamage <= 0) {
        continue
      } // end if falloff rounded damage to zero

      Health.hp[candidate] = (Health.hp[candidate] ?? 0) - appliedDamage
      const candidateKind = Meta.kind[candidate] ?? 0
      const candidateIsCombatant = candidateKind === KIND_TANK || candidateKind === KIND_ENEMY
      if (candidateIsCombatant) {
        audio.playTankHitConfirm(targetX, targetY, player.x, player.y, player.angle)
      }
      if ((Health.hp[candidate] ?? 0) <= 0) {
        Meta.alive[candidate] = 0
        if (hasComponent(world, TankExplosion, candidate)) {
          TankExplosion.maxDuration[candidate] = 0.7
          TankExplosion.timeRemaining[candidate] = 0.7
        }
        if (candidateIsCombatant) {
          audio.playTankDeathConfirm(targetX, targetY, player.x, player.y, player.angle)
        }
      } // end if explosion killed target
    } // end for each damageable entity

    const playerDistance = Math.hypot(player.x - position.x, player.y - position.y, ((player.z ?? 0) + PLAYER_HEIGHT) - position.z)
    if (playerDistance <= effectiveRadius) {
      const playerOcclusionHit = traceWorldHit3D(
        collisionWorld,
        { x: position.x, y: position.y, z: position.z },
        { x: player.x, y: player.y, z: (player.z ?? 0) + PLAYER_HEIGHT },
        EXPLOSION_LOS_TRACE_RADIUS
      )
      const playerExposureMultiplier = getExplosionExposureMultiplier(playerOcclusionHit?.obstacleType ?? null)
      const damageMultiplier = computeExplosionDamageMultiplier(playerDistance, effectiveRadius) * playerExposureMultiplier
      const finalDamage = Math.max(0, effectiveDamage * damageMultiplier)
      const playerDamage = Math.max(0, Math.round(finalDamage))
      if (playerDamage > 0) {
        player.hp = Math.max(0, player.hp - playerDamage)
        onPlayerDamaged?.({ amount: playerDamage, damageType: 'explosive' })
        audio.playPlayerMechHit()
      }
    } // end if player is in blast radius

    audio.playImpact(
      position.x,
      position.y,
      player.x,
      player.y,
      player.angle,
      impactFrameCount * IMPACT_STAGGER_SECONDS,
      {
        source: 'explosion',
        surfaceMaterial: resolveWorldSurfaceMaterial(position.x, position.y),
        isEnemyImpact: owner_id !== PROJECTILE_OWNER_PLAYER,
        priorityBoost: 0.35
      }
    )
    audio.playExplosion(position.x, position.y, player.x, player.y, player.angle, sounds)
    impactFrameCount++
  } // end function create_explosion

  const detonateMissile = (entity: number, worldX: number, worldY: number, worldZ: number): void => {
    if ((MissileStats.active[entity] ?? 0) !== 1) {
      return
    } // end if missile already consumed

    MissileStats.active[entity] = 0
    MissileStats.detonated[entity] = 1
    const blastRadius = Math.max(0.2, getNumber(MissileStats.blastRadius, entity) ?? 1.6)
    const damage = Math.max(0, getNumber(MissileStats.damage, entity) ?? 0)
    const ownerId = MissileStats.ownerId[entity] ?? (ProjectileStats.owner[entity] ?? PROJECTILE_OWNER_PLAYER)
    const sounds = world.missileExplosionSounds.get(entity) ?? []
    create_explosion({ x: worldX, y: worldY, z: Math.max(0, worldZ) }, blastRadius, damage, ownerId, sounds)
    Meta.alive[entity] = 0
  } // end function detonateMissile

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

    if (options?.shouldSimulateProjectile && !options.shouldSimulateProjectile(currentX, currentY)) {
      Meta.alive[entity] = 0
      continue
    } // end if projectile left streamed simulation region

    const originHeight = getNumber(ProjectileStats.originHeight, entity) ?? PLAYER_HEIGHT
    const speed = kind === KIND_MISSILE
      ? Math.max(0, getNumber(MissileStats.speed, entity) ?? getNumber(ProjectileStats.speed, entity) ?? BULLET_SPEED)
      : (getNumber(ProjectileStats.speed, entity) ?? (kind === KIND_TANK_PROJECTILE ? getEnemyDefinition('tank').projectileSpeed : BULLET_SPEED))
    const maxDist = getNumber(ProjectileStats.maxDistance, entity) ?? BULLET_MAX_DIST

    let missileTargetX = 0
    let missileTargetY = 0
    let missileTargetZ = 0
    let missileTargetVelocityX = 0
    let missileTargetVelocityY = 0
    let missileTargetVelocityZ = 0
    let missileHasValidTarget = false

    if (kind === KIND_MISSILE) {
      if ((MissileStats.active[entity] ?? 0) !== 1) {
        Meta.alive[entity] = 0
        continue
      } // end if missile is no longer active

      const targetId = MissileStats.targetId[entity] ?? MISSILE_TARGET_NONE
      if (targetId === MISSILE_TARGET_PLAYER && player.hp > 0) {
        missileHasValidTarget = true
        missileTargetX = player.x
        missileTargetY = player.y
        missileTargetZ = (player.z ?? 0) + PLAYER_HEIGHT
        const playerVelocitySample = world.missileTargetVelocityById.get(MISSILE_TARGET_PLAYER)
        missileTargetVelocityX = playerVelocitySample?.velocityX ?? 0
        missileTargetVelocityY = playerVelocitySample?.velocityY ?? 0
        missileTargetVelocityZ = playerVelocitySample?.velocityZ ?? 0
      } else if (targetId !== MISSILE_TARGET_NONE && (Meta.alive[targetId] ?? 0) === 1) {
        const targetX = getNumber(Position.x, targetId)
        const targetY = getNumber(Position.y, targetId)
        if (targetX !== null && targetY !== null) {
          missileHasValidTarget = true
          missileTargetX = targetX
          missileTargetY = targetY
          missileTargetZ = Math.max(0, getNumber(Flight.height, targetId) ?? 0) + PLAYER_HEIGHT
          const targetVelocitySample = world.missileTargetVelocityById.get(targetId)
          missileTargetVelocityX = targetVelocitySample?.velocityX ?? 0
          missileTargetVelocityY = targetVelocitySample?.velocityY ?? 0
          missileTargetVelocityZ = targetVelocitySample?.velocityZ ?? 0
        }
      } // end if resolving missile entity target

      if (missileHasValidTarget) {
        const toTargetX = missileTargetX - currentX
        const toTargetY = missileTargetY - currentY
        const toTargetZ = missileTargetZ - originHeight
        const distanceToTarget = Math.hypot(toTargetX, toTargetY, toTargetZ)
        const velocityX = getNumber(MissileStats.velocityX, entity) ?? (Math.cos(angle) * speed)
        const velocityY = getNumber(MissileStats.velocityY, entity) ?? (Math.sin(angle) * speed)
        const velocityZ = -Math.sin(pitch) * speed
        const closingSpeed = distanceToTarget > 0.0001
          ? ((velocityX * toTargetX) + (velocityY * toTargetY) + (velocityZ * toTargetZ)) / distanceToTarget
          : 0
        const giveUpDistance = Math.max(
          MISSILE_GIVE_UP_MIN_DISTANCE,
          (getNumber(MissileStats.proximityFuseDistance, entity) ?? 0) * 4,
          (getNumber(MissileStats.blastRadius, entity) ?? 0) * 2.4
        )
        if (closingSpeed <= 0 && distanceToTarget <= giveUpDistance) {
          missileHasValidTarget = false
          MissileStats.targetId[entity] = MISSILE_TARGET_NONE
          world.missileGuidanceDirections.delete(entity)
        } // end if missile has passed target and should stop homing
      } // end if missile target validity resolved

      if (missileHasValidTarget) {
        const distanceToTarget = Math.hypot(
          missileTargetX - currentX,
          missileTargetY - currentY,
          missileTargetZ - originHeight
        )
        const interceptTimeSeconds = Math.min(
          MISSILE_INTERCEPT_MAX_LEAD_SECONDS,
          Math.max(0, distanceToTarget / Math.max(0.01, speed))
        )
        const predictedTargetX = missileTargetX + (missileTargetVelocityX * interceptTimeSeconds * MISSILE_INTERCEPT_LEAD_FACTOR)
        const predictedTargetY = missileTargetY + (missileTargetVelocityY * interceptTimeSeconds * MISSILE_INTERCEPT_LEAD_FACTOR)
        const predictedTargetZ = missileTargetZ + (missileTargetVelocityZ * interceptTimeSeconds * MISSILE_INTERCEPT_LEAD_FACTOR)

        const desiredDirectionXRaw = predictedTargetX - currentX
        const desiredDirectionYRaw = predictedTargetY - currentY
        const desiredDirectionLength = Math.hypot(desiredDirectionXRaw, desiredDirectionYRaw, predictedTargetZ - originHeight)
        const desiredDirectionX = desiredDirectionLength > 0.0001
          ? desiredDirectionXRaw / desiredDirectionLength
          : Math.cos(angle)
        const desiredDirectionY = desiredDirectionLength > 0.0001
          ? desiredDirectionYRaw / desiredDirectionLength
          : Math.sin(angle)

        const previousGuidance = world.missileGuidanceDirections.get(entity)
        const previousDirectionX = previousGuidance?.x ?? desiredDirectionX
        const previousDirectionY = previousGuidance?.y ?? desiredDirectionY
        const blendedDirectionX = previousDirectionX + ((desiredDirectionX - previousDirectionX) * MISSILE_GUIDANCE_SMOOTHING_FACTOR)
        const blendedDirectionY = previousDirectionY + ((desiredDirectionY - previousDirectionY) * MISSILE_GUIDANCE_SMOOTHING_FACTOR)
        const blendedLength = Math.hypot(blendedDirectionX, blendedDirectionY)
        const smoothedDirectionX = blendedLength > 0.0001 ? blendedDirectionX / blendedLength : desiredDirectionX
        const smoothedDirectionY = blendedLength > 0.0001 ? blendedDirectionY / blendedLength : desiredDirectionY
        world.missileGuidanceDirections.set(entity, { x: smoothedDirectionX, y: smoothedDirectionY })

        const desiredAngle = Math.atan2(smoothedDirectionY, smoothedDirectionX)
        const deltaAngle = normalizeAngleRadians(desiredAngle - angle)
        const turnRate = Math.max(0, getNumber(MissileStats.turnRate, entity) ?? 0)
        const maxTurnThisTick = turnRate * deltaSeconds
        angle += Math.max(-maxTurnThisTick, Math.min(maxTurnThisTick, deltaAngle))
        angle = normalizeAngleRadians(angle)

        const desiredPitchRaw = getPitchToTarget(
          currentX,
          currentY,
          originHeight,
          predictedTargetX,
          predictedTargetY,
          predictedTargetZ
        )
        const desiredPitch = desiredPitchRaw
        const maxPitchTurnThisTick = maxTurnThisTick * MISSILE_PITCH_TURN_RATE_SCALE
        const pitchDelta = desiredPitch - pitch
        pitch += Math.max(-maxPitchTurnThisTick, Math.min(maxPitchTurnThisTick, pitchDelta))
        pitch = clampProjectilePitch(pitch)

        Facing.angle[entity] = angle
        Facing.pitch[entity] = pitch
      } // end if target-guided heading update

      const directionX = Math.cos(angle)
      const directionY = Math.sin(angle)
      MissileStats.directionX[entity] = directionX
      MissileStats.directionY[entity] = directionY
      MissileStats.velocityX[entity] = directionX * speed
      MissileStats.velocityY[entity] = directionY * speed
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
      const lifetimeRemaining = (MissileStats.lifetime[entity] ?? 0) - deltaSeconds
      MissileStats.lifetime[entity] = lifetimeRemaining
      if (lifetimeRemaining <= 0) {
        detonateMissile(entity, nextX, nextY, Math.max(0, nextHeight))
        continue
      } // end if missile lifetime expired
      if (nextHeight <= 0) {
        detonateMissile(entity, nextX, nextY, 0)
        continue
      } // end if missile hit ground
    } else {
      const floorCeilDist = computeFloorCeilHitDistance(originHeight, pitch)
      if (nextDist >= floorCeilDist) {
        const hitFraction = (floorCeilDist - currentDist) / Math.max(0.0001, step)
        const hitX = currentX + cosA * step * hitFraction
        const hitY = currentY + sinA * step * hitFraction
        Meta.alive[entity] = 0
        audio.playImpact(
          hitX,
          hitY,
          player.x,
          player.y,
          player.angle,
          impactFrameCount * IMPACT_STAGGER_SECONDS,
          {
            source: 'projectile',
            surfaceMaterial: resolveWorldSurfaceMaterial(hitX, hitY),
            isEnemyImpact: false
          }
        )
        impactFrameCount++
        continue
      } // end if floor or ceiling impact
      if (nextDist >= maxDist) {
        Meta.alive[entity] = 0
        continue
      } // end if max distance reached
    }
    const worldHit = traceWorldHit3D(
      collisionWorld,
      { x: currentX, y: currentY, z: currentHeight },
      { x: nextX, y: nextY, z: nextHeight },
      Math.max(0.02, bulletRadius * 0.55)
    )
    if (worldHit) {
      if (kind === KIND_MISSILE) {
        detonateMissile(entity, worldHit.x, worldHit.y, Math.max(0, worldHit.z))
      } else {
        Meta.alive[entity] = 0
        audio.playImpact(
          worldHit.x,
          worldHit.y,
          player.x,
          player.y,
          player.angle,
          impactFrameCount * IMPACT_STAGGER_SECONDS,
          {
            source: 'projectile',
            surfaceMaterial: resolveWorldSurfaceMaterial(worldHit.x, worldHit.y, worldHit.obstacleType),
            isEnemyImpact: (ProjectileStats.owner[entity] ?? 0) !== PROJECTILE_OWNER_PLAYER
          }
        )
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
          applyDirectFireDamageToTankCore(tank, projectileDamage)
          audio.playImpact(
            targetX,
            targetY,
            player.x,
            player.y,
            player.angle,
            impactFrameCount * IMPACT_STAGGER_SECONDS,
            {
              source: 'projectile',
              surfaceMaterial: SURFACE_MATERIAL.metal,
              isEnemyImpact: true,
              isPlayerEngagedTarget: true,
              priorityBoost: 0.25
            }
          )
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
      const targetId = MissileStats.targetId[entity] ?? MISSILE_TARGET_NONE

      if (missileHasValidTarget) {
        const targetRadius = targetId === MISSILE_TARGET_PLAYER
          ? PLAYER_RADIUS
          : Math.max(0.08, getNumber(Meta.radius, targetId) ?? 0.3)
        const contactRadius = targetId === MISSILE_TARGET_PLAYER
          ? Math.max(0.03, targetRadius * 0.16)
          : Math.max(0.04, targetRadius * 0.22)
        const impactFraction = getFirstSphereContactFraction(
          currentX,
          currentY,
          currentHeight,
          nextX,
          nextY,
          nextHeight,
          missileTargetX,
          missileTargetY,
          missileTargetZ,
          contactRadius
        )
        if (impactFraction >= 0) {
          const impactX = currentX + ((nextX - currentX) * impactFraction)
          const impactY = currentY + ((nextY - currentY) * impactFraction)
          const impactHeight = currentHeight + ((nextHeight - currentHeight) * impactFraction)
          detonateMissile(entity, impactX, impactY, Math.max(0, impactHeight))
          continue
        } // end if missile directly collided with target
      } // end if valid target exists for collision checks
    } // end if missile collision checks

    // --- Tank projectiles hitting player ---
    if (kind === KIND_TANK_PROJECTILE) {
      const playerCenterHeight = (player.z ?? 0) + PLAYER_HEIGHT
      const playerDistance = Math.hypot(nextX - player.x, nextY - player.y)
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
        const projectileDamage = Math.max(0, Math.round(getNumber(ProjectileStats.damage, entity) ?? 0))
        if (projectileDamage > 0) {
          player.hp = Math.max(0, player.hp - projectileDamage)
          onPlayerDamaged?.({ amount: projectileDamage, damageType: 'incoming' })
        } // end if projectile has damage
        Meta.alive[entity] = 0
        ProjectileStats.nearMissPlayed[entity] = 1
        const impactX = currentX + ((nextX - currentX) * impactFraction)
        const impactY = currentY + ((nextY - currentY) * impactFraction)
        audio.playImpact(
          impactX,
          impactY,
          player.x,
          player.y,
          player.angle,
          impactFrameCount * IMPACT_STAGGER_SECONDS,
          {
            source: 'projectile',
            surfaceMaterial: SURFACE_MATERIAL.metal,
            isEnemyImpact: true,
            priorityBoost: 0.2
          }
        )
        impactFrameCount++
        audio.playPlayerMechHit()
        continue
      } // end if player hit

      incomingProjectileAudioStates.push({
        id: entity,
        x: nextX,
        y: nextY,
        z: nextHeight,
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
      const ownerId = MissileStats.ownerId[entity] ?? (ProjectileStats.owner[entity] ?? PROJECTILE_OWNER_PLAYER)
      if (ownerId !== PROJECTILE_OWNER_PLAYER) {
        const playerCenterHeight = (player.z ?? 0) + PLAYER_HEIGHT
        const missileVelocityX = getNumber(MissileStats.velocityX, entity) ?? (Math.cos(angle) * speed)
        const missileVelocityY = getNumber(MissileStats.velocityY, entity) ?? (Math.sin(angle) * speed)
        incomingProjectileAudioStates.push({
          id: entity,
          x: nextX,
          y: nextY,
          z: nextHeight,
          velocityX: missileVelocityX,
          velocityY: missileVelocityY,
          distanceToPlayer: Math.hypot(nextX - player.x, nextY - player.y, nextHeight - playerCenterHeight),
          isMissile: true
        })
      } // end if hostile missile should emit tracking audio

      // Store actual height for next frame; reset distance so renderer uses zOrigin as true height.
      ProjectileStats.originHeight[entity] = Math.max(0.02, nextHeight)
      Meta.distance[entity] = 0
      const trail = world.missileTrails.get(entity) ?? []
      trail.push({ x: nextX, y: Math.max(0.04, nextHeight), z: nextY })
      while (trail.length > 36) {
        trail.shift()
      } // end while trim trail length
      world.missileTrails.set(entity, trail)

      missileThreatSamples.push({
        id: entity,
        x: nextX,
        y: nextY,
        speed: Math.max(0, getNumber(MissileStats.speed, entity) ?? speed),
        velocityX: getNumber(MissileStats.velocityX, entity) ?? (Math.cos(angle) * speed),
        velocityY: getNumber(MissileStats.velocityY, entity) ?? (Math.sin(angle) * speed),
        damage: Math.max(0, getNumber(MissileStats.damage, entity) ?? getNumber(ProjectileStats.damage, entity) ?? 0),
        blastRadius: Math.max(0, getNumber(MissileStats.blastRadius, entity) ?? 0),
        targetsPlayer: (MissileStats.targetId[entity] ?? MISSILE_TARGET_NONE) === MISSILE_TARGET_PLAYER
      })
    } // end if storing missile trail
  } // end for each projectile

  world.missileThreatManager.update(
    {
      missiles: missileThreatSamples,
      playerX: player.x,
      playerY: player.y,
      playerAngle: player.angle,
      deltaSeconds
    },
    audio
  )

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
      world.missileGuidanceDirections.delete(entity)
      world.enemyCallsignByEntity.delete(entity)
      removeEntity(world, entity)
    } // end if dead
  } // end for cleanup
} // end function stepCombatEcsWorld

export function getCombatRenderState(world: CombatEcsWorld): {
  bullets: Bullet[]
  enemies: EnemyRender[]
  tanks: CombatEnemyRender[]
  missileExplosions: MissileExplosionRender[]
} {
  const bullets: Bullet[] = []
  const enemies: EnemyRender[] = []
  const tanks: CombatEnemyRender[] = []
  const missileExplosions: MissileExplosionRender[] = []
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
        kind: (() => {
          const visualType = ProjectileStats.visualType[entity] ?? 0
          if (visualType === PROJECTILE_VISUAL_LASER_BEAM) {
            return 'laserBeam'
          }
          if (visualType === PROJECTILE_VISUAL_ROCKET) {
            return 'rocket'
          }
          if (visualType === PROJECTILE_VISUAL_MISSILE) {
            return 'missile'
          }
          return kind === KIND_MISSILE ? 'missile' : 'bullet'
        })(),
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
        id: entity,
        enemyClass: 'enemy',
        enemyType: 'enemy',
        callsign: world.enemyCallsignByEntity.get(entity) ?? null,
        layoutId: getLayoutIdForEntityType('enemy'),
        x,
        y,
        radius,
        height: 0,
        surfaceMaterial: SURFACE_MATERIAL.metal,
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
    const customSounds = world.customConfigs.get(tank)?.sounds

    tanks.push({
      id: tank,
      enemyClass: 'enemy',
      enemyType: profile.id,
      callsign: world.enemyCallsignByEntity.get(tank) ?? null,
      layoutId: getLayoutIdForEntityType(profile.id),
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
      surfaceMaterial: SURFACE_MATERIAL.metal,
      explosionIntensity: !alive && explosionMaxDuration > 0
        ? Math.max(0, Math.min(1, explosionTimeRemaining / explosionMaxDuration))
        : 0,
      positionalLoopSound: customSounds?.positionalLoopSound,
      loopSoundPauseIntervalMs: customSounds?.loopSoundPauseIntervalMs,
      loopSoundMaxDistance: customSounds?.loopSoundMaxDistance,
      stopLoopSoundWhileStationary: customSounds?.stopLoopSoundWhileStationary
    })
  } // end for each tank

  for (const burst of world.missileExplosionBursts) {
    const intensity = burst.maxDuration > 0
      ? Math.max(0, Math.min(1, burst.timeRemaining / burst.maxDuration))
      : 0
    if (intensity <= 0) {
      continue
    } // end if burst has faded out

    missileExplosions.push({
      x: burst.x,
      y: burst.y,
      z: burst.z,
      radius: burst.radius,
      intensity
    })
  } // end for each active missile explosion burst

  return { bullets, enemies, tanks, missileExplosions }
} // end function getCombatRenderState

export function getCombatEntityCounts(world: CombatEcsWorld): {
  enemies: number
  projectiles: number
  total: number
} {
  let enemies = 0
  let projectiles = 0
  let total = 0

  const allEntities = CombatQuery(world)
  for (const entity of allEntities) {
    if ((Meta.alive[entity] ?? 0) !== 1) {
      continue
    } // end if entity is not alive

    total += 1
    const kind = Meta.kind[entity] ?? 0
    if (kind === KIND_TANK || kind === KIND_ENEMY) {
      enemies += 1
      continue
    } // end if hostile entity counted

    if (kind === KIND_BULLET || kind === KIND_TANK_PROJECTILE || kind === KIND_MISSILE) {
      projectiles += 1
    } // end if projectile entity counted
  } // end for each entity

  return { enemies, projectiles, total }
} // end function getCombatEntityCounts

export function clearCombatEntities(world: CombatEcsWorld): number {
  let removed = 0
  const allEntities = CombatQuery(world)

  for (const entity of allEntities) {
    const kind = Meta.kind[entity] ?? 0
    const isHostile = kind === KIND_TANK || kind === KIND_ENEMY
    const isProjectile = kind === KIND_BULLET || kind === KIND_TANK_PROJECTILE || kind === KIND_MISSILE
    if (!isHostile && !isProjectile) {
      continue
    } // end if entity is not removable by clear command

    world.customConfigs.delete(entity)
    world.missileExplosionSounds.delete(entity)
    world.missileTrails.delete(entity)
    world.enemyCallsignByEntity.delete(entity)
    removeEntity(world, entity)
    removed += 1
  } // end for each entity

  world.enemyCallsignReservationsByArchetype.clear()
  world.enemyCallsignNextIndexByArchetype.clear()

  return removed
} // end function clearCombatEntities
