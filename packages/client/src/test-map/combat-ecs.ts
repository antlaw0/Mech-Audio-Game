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
  PLAYER_HEIGHT,
} from './constants.js'
import { isWall } from './collision.js'
import {
  ENEMY_NUMERIC_ID,
  getEnemyDefinition,
  getEnemyDefinitionFromNumericId
} from './enemies/index.js'
import type { EnemyDefinitionConfig, EnemyId } from './enemies/enemyTypes.js'
import type { AudioController, Bullet, EnemyRender, Player, TankRender } from './types.js'

const KIND_BULLET = 1
const KIND_ENEMY = 2
const KIND_TANK = 3
const KIND_TANK_PROJECTILE = 4
const BULLET_HIT_RADIUS = 0.25

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

const Behavior = defineComponent({
  movementAngle: Types.f32,
  movementTimer: Types.f32,
  cannonFireCooldown: Types.f32,
  attackWindupSeconds: Types.f32,
  isMoving: Types.ui8
})

const TankExplosion = defineComponent({
  timeRemaining: Types.f32,
  maxDuration: Types.f32
})

const ProjectileStats = defineComponent({
  speed: Types.f32,
  damage: Types.i16,
  maxDistance: Types.f32
})

const CombatQuery = defineQuery([Position, Facing, Meta])
const TankQuery = defineQuery([Position, Facing, Meta, Health, Behavior, EnemyProfile])

type CombatEcsWorld = IWorld & {
  customConfigs: Map<number, EnemyDefinitionConfig>
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
  Behavior.movementAngle[tank] = Math.random() * Math.PI * 2
  Behavior.movementTimer[tank] = 0
  Behavior.cannonFireCooldown[tank] = 0
  Behavior.attackWindupSeconds[tank] = 0
  Behavior.isMoving[tank] = 1
  TankExplosion.timeRemaining[tank] = 0
  TankExplosion.maxDuration[tank] = 0.7
} // end function addTank

function hasLineOfSight(
  mapData: Uint8Array,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): boolean {
  // Simple LOS using DDA raycasting
  const dx = toX - fromX
  const dy = toY - fromY
  const dist = Math.hypot(dx, dy)
  if (dist < 0.01) {
    return true
  } // end if at same position

  const steps = Math.ceil(dist * 4)
  for (let i = 0; i <= steps; i++) {
    const t = steps > 0 ? i / steps : 0
    const checkX = fromX + dx * t
    const checkY = fromY + dy * t
    if (isWall(mapData, checkX, checkY)) {
      // Check if wall is interposing (not start or end pos)
      if (i > 0 && i < steps) {
        return false
      } // end if wall blocks path
    } // end if wall found
  } // end for each step

  return true
} // end function hasLineOfSight

function spawnTankProjectile(
  world: CombatEcsWorld,
  tankEntity: number,
  tankX: number,
  tankY: number,
  targetX: number,
  targetY: number
): void {
  const enemyProfileId = EnemyProfile.id[tankEntity] ?? ENEMY_NUMERIC_ID.tank
  const customConfig = world.customConfigs.get(tankEntity)
  const definition = customConfig ?? getEnemyDefinitionFromNumericId(enemyProfileId)
  const angle = Math.atan2(targetY - tankY, targetX - tankX)
  const bullet = addEntity(world)
  addComponent(world, Position, bullet)
  addComponent(world, Facing, bullet)
  addComponent(world, Meta, bullet)
  addComponent(world, ProjectileStats, bullet)
  Position.x[bullet] = tankX
  Position.y[bullet] = tankY
  Facing.angle[bullet] = angle
  Facing.pitch[bullet] = 0
  Meta.kind[bullet] = KIND_TANK_PROJECTILE
  Meta.radius[bullet] = 0.2
  Meta.distance[bullet] = 0
  Meta.alive[bullet] = 1
  ProjectileStats.speed[bullet] = definition.projectileSpeed
  ProjectileStats.damage[bullet] = definition.shotDamage
  ProjectileStats.maxDistance[bullet] = definition.projectileMaxDistance
} // end function spawnTankProjectile

export function createCombatEcsWorld(): CombatEcsWorld {
  const world = createWorld() as CombatEcsWorld
  world.customConfigs = new Map()
  addTank(world, 32.5, 30.5)
  return world
} // end function createCombatEcsWorld

function canSpawnTankAt(world: CombatEcsWorld, mapData: Uint8Array, x: number, y: number, player: Player, collisionRadius?: number): boolean {
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

  if (
    isWall(mapData, x, y) ||
    isWall(mapData, x + tankRadius, y) ||
    isWall(mapData, x - tankRadius, y) ||
    isWall(mapData, x, y + tankRadius) ||
    isWall(mapData, x, y - tankRadius)
  ) {
    return false
  } // end if spawn intersects a wall tile

  if (Math.hypot(x - player.x, y - player.y) < 4.5) {
    return false
  } // end if too close to player spawn area

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

export function spawnRandomTank(world: CombatEcsWorld, mapData: Uint8Array, player: Player): boolean {
  const maxAttempts = 90
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const x = 1.25 + Math.random() * (MAP_WIDTH - 2.5)
    const y = 1.25 + Math.random() * (MAP_HEIGHT - 2.5)
    if (!canSpawnTankAt(world, mapData, x, y, player)) {
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
  Behavior.movementAngle[tank] = Math.random() * Math.PI * 2
  Behavior.movementTimer[tank] = 0
  Behavior.cannonFireCooldown[tank] = 0
  Behavior.attackWindupSeconds[tank] = 0
  Behavior.isMoving[tank] = 1
  TankExplosion.timeRemaining[tank] = 0
  TankExplosion.maxDuration[tank] = 0.7
  world.customConfigs.set(tank, config)
} // end function addTankFromConfig

export function spawnRandomEnemy(world: CombatEcsWorld, mapData: Uint8Array, player: Player, enemyId: EnemyId = 'tank'): boolean {
  const definition = getEnemyDefinition(enemyId)
  const maxAttempts = 90
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const x = 1.25 + Math.random() * (MAP_WIDTH - 2.5)
    const y = 1.25 + Math.random() * (MAP_HEIGHT - 2.5)
    if (!canSpawnTankAt(world, mapData, x, y, player, definition.collisionRadius)) {
      continue
    } // end if random spawn candidate invalid
    addTank(world, x, y, enemyId)
    return true
  } // end for each spawn attempt
  return false
} // end function spawnRandomEnemy

export function spawnRandomTankFromConfig(world: CombatEcsWorld, mapData: Uint8Array, player: Player, config: EnemyDefinitionConfig): boolean {
  const maxAttempts = 90
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const x = 1.25 + Math.random() * (MAP_WIDTH - 2.5)
    const y = 1.25 + Math.random() * (MAP_HEIGHT - 2.5)
    if (!canSpawnTankAt(world, mapData, x, y, player, config.collisionRadius)) {
      continue
    } // end if random spawn candidate invalid
    addTankFromConfig(world, x, y, config)
    return true
  } // end for each spawn attempt
  return false
} // end function spawnRandomTankFromConfig

export function spawnPlayerBullet(world: CombatEcsWorld, player: Player): void {
  const bullet = addEntity(world)
  addComponent(world, Position, bullet)
  addComponent(world, Facing, bullet)
  addComponent(world, Meta, bullet)
  addComponent(world, ProjectileStats, bullet)
  Position.x[bullet] = player.x
  Position.y[bullet] = player.y
  Facing.angle[bullet] = player.angle
  Facing.pitch[bullet] = player.pitch
  Meta.kind[bullet] = KIND_BULLET
  Meta.radius[bullet] = BULLET_HIT_RADIUS
  Meta.distance[bullet] = 0
  Meta.alive[bullet] = 1
  ProjectileStats.speed[bullet] = BULLET_SPEED
  ProjectileStats.damage[bullet] = 10
  ProjectileStats.maxDistance[bullet] = BULLET_MAX_DIST
} // end function spawnPlayerBullet

function computeFloorCeilHitDistance(pitch: number): number {
  const absPitch = Math.abs(pitch)
  if (absPitch < 0.001) {
    return BULLET_MAX_DIST
  } // end if no pitch

  if (pitch > 0) {
    return (1 - PLAYER_HEIGHT) / Math.tan(pitch)
  } // end if upward pitch

  return PLAYER_HEIGHT / Math.tan(-pitch)
} // end function computeFloorCeilHitDistance

function getNumber(store: ArrayLike<number>, entity: number): number | null {
  const value = store[entity]
  if (value === undefined) {
    return null
  } // end if missing store value
  return value
} // end function getNumber

export function stepCombatEcsWorld(
  world: CombatEcsWorld,
  mapData: Uint8Array,
  audio: AudioController,
  player: Player,
  deltaSeconds: number
): void {
  const allEntities = CombatQuery(world)
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
    if (
      movementAngle === null ||
      movementTimer === null ||
      cannonCooldown === null ||
      attackWindup === null
    ) {
      continue
    } // end if behavior missing

    // --- Tank movement ---
    const moveStep = enemyDefinition.movementSpeed * deltaSeconds
    const nextX = tankX + Math.cos(movementAngle) * moveStep
    const nextY = tankY + Math.sin(movementAngle) * moveStep

    let canMove = true
    if (isWall(mapData, nextX, nextY)) {
      canMove = false
    } // end if wall

    if (!canMove) {
      Behavior.isMoving[tank] = 0
      Behavior.movementAngle[tank] = Math.random() * Math.PI * 2
      Behavior.movementTimer[tank] = 0
    } else {
      Position.x[tank] = nextX
      Position.y[tank] = nextY
      Facing.angle[tank] = movementAngle
      Behavior.movementTimer[tank] = movementTimer + deltaSeconds

      // Retarget movement heading using enemy behavior settings.
      if (movementTimer > enemyDefinition.behavior.retargetIntervalSeconds) {
        Behavior.movementAngle[tank] = Math.random() * Math.PI * 2
        Behavior.movementTimer[tank] = 0
      } // end if time to change direction

      Behavior.isMoving[tank] = 1
    } // end if can move

    // --- LOS check and cannon fire ---
    const dist = Math.hypot(nextX - player.x, nextY - player.y)
    const hasLos = hasLineOfSight(mapData, nextX, nextY, player.x, player.y)
    const canShootByLos = enemyDefinition.behavior.lineOfSightRequiredToShoot ? hasLos : true
    const threatDelaySeconds = enemyDefinition.threatDelaySeconds

    if (attackWindup > 0) {
      const newWindup = Math.max(0, attackWindup - deltaSeconds)
      Behavior.attackWindupSeconds[tank] = newWindup
      if (newWindup <= 0 && canShootByLos && dist < enemyDefinition.behavior.preferredEngageRange) {
        spawnTankProjectile(world, tank, nextX, nextY, player.x, player.y)
        audio.playEnemyAttack(`tank-${tank}`)
      } // end if windup completed and target valid
    } else {
      const newCooldown = Math.max(0, cannonCooldown - deltaSeconds)
      Behavior.cannonFireCooldown[tank] = newCooldown
      if (canShootByLos && dist < enemyDefinition.behavior.preferredEngageRange && newCooldown <= 0) {
        Behavior.attackWindupSeconds[tank] = threatDelaySeconds
        Behavior.cannonFireCooldown[tank] = enemyDefinition.fireRateSeconds
        audio.playEnemyThreatCue(`tank-${tank}`)
      } // end if tank can start cannon telegraph
    } // end if cannon windup or cooldown path
  } // end for each tank

  // --- Update all projectiles (player bullets + tank projectiles) ---
  for (const entity of allEntities) {
    const kind = Meta.kind[entity] ?? 0
    if ((kind !== KIND_BULLET && kind !== KIND_TANK_PROJECTILE) || (Meta.alive[entity] ?? 0) !== 1) {
      continue
    } // end if not projectile or dead

    const angle = getNumber(Facing.angle, entity)
    const pitch = getNumber(Facing.pitch, entity)
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

    const speed = getNumber(ProjectileStats.speed, entity) ?? (kind === KIND_BULLET ? BULLET_SPEED : getEnemyDefinition('tank').projectileSpeed)
    const maxDist = getNumber(ProjectileStats.maxDistance, entity) ?? (kind === KIND_BULLET ? BULLET_MAX_DIST : BULLET_MAX_DIST * 1.2)
    const step = speed * deltaSeconds
    const cosA = Math.cos(angle)
    const sinA = Math.sin(angle)
    const nextX = currentX + cosA * step
    const nextY = currentY + sinA * step
    const nextDist = currentDist + step

    const floorCeilDist = computeFloorCeilHitDistance(pitch)
    if (nextDist >= floorCeilDist) {
      const hitFraction = (floorCeilDist - currentDist) / step
      const hitX = currentX + cosA * step * hitFraction
      const hitY = currentY + sinA * step * hitFraction
      Meta.alive[entity] = 0
      audio.playImpact(hitX, hitY, player.x, player.y, player.angle)
      continue
    } // end if floor or ceiling impact

    if (nextDist >= maxDist) {
      Meta.alive[entity] = 0
      continue
    } // end if max distance reached

    if (isWall(mapData, nextX, nextY)) {
      Meta.alive[entity] = 0
      audio.playImpact(nextX, nextY, player.x, player.y, player.angle)
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
        if (Math.hypot(dx, dy) < targetRadius + bulletRadius) {
          // Tank hit by player bullet
          Meta.alive[entity] = 0
          const projectileDamage = getNumber(ProjectileStats.damage, entity) ?? 10
          Health.hp[tank] = (Health.hp[tank] ?? 0) - Math.max(1, Math.round(projectileDamage))
          audio.playImpact(targetX, targetY, player.x, player.y, player.angle)
          audio.playTankHitConfirm(targetX, targetY, player.x, player.y, player.angle)

          // Check if tank died
          if ((Health.hp[tank] ?? 0) <= 0) {
            // Kill tank
            Meta.alive[tank] = 0
            TankExplosion.maxDuration[tank] = 0.7
            TankExplosion.timeRemaining[tank] = 0.7
            audio.playTankDeathConfirm(targetX, targetY, player.x, player.y, player.angle)
          } // end if tank died

          break
        } // end if tank hit
      } // end for each tank
    } // end if player bullet

    // --- Tank projectiles hitting player ---
    if (kind === KIND_TANK_PROJECTILE) {
      const dx = nextX - player.x
      const dy = nextY - player.y
      const playerRadius = 0.25
      if (Math.hypot(dx, dy) < playerRadius + bulletRadius) {
        // Player hit
        Meta.alive[entity] = 0
        audio.playImpact(nextX, nextY, player.x, player.y, player.angle)
        // TODO: Player damage / hitstun feedback not implemented yet
        continue
      } // end if player hit
    } // end if tank projectile

    if ((Meta.alive[entity] ?? 0) !== 1) {
      continue
    } // end if projectile consumed this step

    Position.x[entity] = nextX
    Position.y[entity] = nextY
    Meta.distance[entity] = nextDist
  } // end for each projectile

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

    if (kind === KIND_BULLET) {
      const x = getNumber(Position.x, entity)
      const y = getNumber(Position.y, entity)
      const angle = getNumber(Facing.angle, entity)
      const pitch = getNumber(Facing.pitch, entity)
      const distance = getNumber(Meta.distance, entity)
      if (x === null || y === null || angle === null || pitch === null || distance === null) {
        continue
      } // end if missing bullet render data

      bullets.push({
        x,
        y,
        angle,
        pitch,
        distance,
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
      x,
      y,
      radius,
      angle,
      velocityX,
      velocityY,
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
