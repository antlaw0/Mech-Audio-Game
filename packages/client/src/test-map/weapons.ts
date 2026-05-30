import {
  BULLET_MAX_DIST,
  BULLET_SPEED,
  HALF_FOV,
  MAX_LOOK_PITCH,
  MISSILE_DEFAULT_EXPLOSION_DAMAGE,
  MISSILE_DEFAULT_EXPLOSION_RADIUS,
  MISSILE_DEFAULT_LOCK_ON_TIME_MS,
  MISSILE_DEFAULT_SPEED,
  MISSILE_DEFAULT_TRACKING_RATING,
  WEAPON_DEFAULT_ACCURACY,
  WEAPON_LOCK_ON_RANGE
} from './constants.js'
import { loadPartCatalog } from '../data/parts/catalog.js'
import type { PartDefinition } from '../data/parts/types.js'
import type { MeleeWeaponStats, WeaponReloadDefinition, WeaponStats } from './types.js'

export interface PlayerWeaponDefinition extends WeaponStats {
  id: string
  name: string
  selectionKey: string
  fireSoundPath: string
} // end interface PlayerWeaponDefinition

export interface PlayerMeleeWeaponDefinition extends MeleeWeaponStats {
  id: string
  name: string
  swingSoundPaths: string[]
} // end interface PlayerMeleeWeaponDefinition

function createPistolReloadDefinition(): WeaponReloadDefinition {
  return {
    timeline: [
      { type: 'pause', durationMs: 100 },
      { type: 'audio', soundPath: 'assets/sounds/weapons/reload/pistol_reload_pt1.ogg' },
      { type: 'pause', durationMs: 260 },
      { type: 'audio', soundPath: 'assets/sounds/weapons/reload/pistol_reload_pt2.ogg' },
      { type: 'pause', durationMs: 40 }
    ],
    servoLoopSoundPath: 'assets/sounds/servoBed.ogg',
    servoEffects: [
      { type: 'pitch', startMs: 0, endMs: 100, magnitude: 0.5 },
      { type: 'pitch', startMs: 408, endMs: 668, magnitude: 0.5 },
      { type: 'pitch', startMs: 1082, endMs: 1122, magnitude: 0.5 }
    ]
  }
} // end function createPistolReloadDefinition

function createShotgunReloadDefinition(): WeaponReloadDefinition {
  return {
    timeline: [
      { type: 'pause', durationMs: 80 },
      { type: 'audio', soundPath: 'assets/sounds/weapons/reload/rifle_reload_pt1.ogg' },
      { type: 'pause', durationMs: 280 },
      { type: 'audio', soundPath: 'assets/sounds/weapons/reload/shotgun_reload.ogg' },
      { type: 'pause', durationMs: 80 }
    ],
    servoLoopSoundPath: 'assets/sounds/servoBed.ogg',
    servoEffects: [
      { type: 'pitch', startMs: 0, endMs: 80, magnitude: 0.5 },
      { type: 'pitch', startMs: 80, endMs: 606, magnitude: -0.25 },
      { type: 'pitch', startMs: 606, endMs: 886, magnitude: 0.5 },
      { type: 'pitch', startMs: 886, endMs: 1410, magnitude: -0.25 },
      { type: 'pitch', startMs: 1410, endMs: 1490, magnitude: 0.5 }
    ]
  }
} // end function createShotgunReloadDefinition

function createAssaultRifleReloadDefinition(): WeaponReloadDefinition {
  return {
    timeline: [
      { type: 'pause', durationMs: 60 },
      { type: 'audio', soundPath: 'assets/sounds/weapons/reload/rifle_reload_pt1.ogg' },
      { type: 'pause', durationMs: 160 },
      { type: 'audio', soundPath: 'assets/sounds/weapons/reload/rifle_reload_pt2.ogg' },
      { type: 'pause', durationMs: 220 },
      { type: 'audio', soundPath: 'assets/sounds/weapons/reload/rifle_reload_pt3.ogg' },
      { type: 'pause', durationMs: 80 }
    ],
    servoLoopSoundPath: 'assets/sounds/servoBed.ogg',
    servoEffects: [
      { type: 'pitch', startMs: 0, endMs: 60, magnitude: 0.65 },
      { type: 'pitch', startMs: 586, endMs: 746, magnitude: 0.65 },
      { type: 'pitch', startMs: 1834, endMs: 2054, magnitude: 0.5 },
      { type: 'pitch', startMs: 2785, endMs: 2865, magnitude: 0.5 }
    ]
  }
} // end function createAssaultRifleReloadDefinition

function createSimpleReloadDefinition(soundPath: string): WeaponReloadDefinition {
  return {
    timeline: [{ type: 'audio', soundPath }],
    servoLoopSoundPath: 'assets/sounds/servoBed.ogg',
    servoEffects: []
  }
} // end function createSimpleReloadDefinition

const WEAPON_SELECTION_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const
const DEFAULT_FIRE_SOUND_FILENAME = 'pistol_fire.ogg'
const DEFAULT_SWING_SOUND_FILENAME = 'swing_medium.ogg'

const isWeaponPart = (definition: PartDefinition): boolean => {
  return definition.category === 'HandWeapon' || definition.category === 'ShoulderWeapon'
}

const isMeleePart = (definition: PartDefinition): boolean => {
  return !!definition.isMelee
}

const toWeaponSoundPath = (filename: string | undefined, fallbackFilename: string): string => {
  const cleaned = (filename ?? '').trim()
  const resolved = cleaned.length > 0 ? cleaned : fallbackFilename
  return `assets/sounds/weapons/${resolved}`
}

const toReloadSoundPath = (filename: string): string => {
  return `assets/sounds/weapons/reload/${filename.trim()}`
}

const resolveReloadDefinition = (definition: PartDefinition): WeaponReloadDefinition => {
  const explicitReload = (definition.reloadSound ?? '').trim()
  if (explicitReload.length > 0) {
    return createSimpleReloadDefinition(toReloadSoundPath(explicitReload))
  }

  switch (definition.id) {
    case 'basic.pistol':
    case 'basic.laser-pistol':
      return createPistolReloadDefinition()
    case 'basic.shotgun':
      return createShotgunReloadDefinition()
    case 'basic.assault-rifle':
      return createAssaultRifleReloadDefinition()
    case 'basic.sniper-rifle':
      return createSimpleReloadDefinition('assets/sounds/weapons/reload/sniper_reload.ogg')
    case 'basic.rocket-launcher':
    case 'basic.missile-launcher':
    case 'basic.plasma-cannon':
      return createSimpleReloadDefinition('assets/sounds/weapons/reload/reload.ogg')
    default:
      return createSimpleReloadDefinition('assets/sounds/weapons/reload/reload.ogg')
  }
}

const resolveWeaponType = (definition: PartDefinition): WeaponStats['weaponType'] => {
  const id = definition.id.toLowerCase()
  const damageType = (definition.damageType ?? '').toLowerCase()
  if (id.includes('missile') || id.includes('rocket')) {
    return 'missile'
  }
  if (damageType.includes('energy') || damageType.includes('plasma') || damageType.includes('electric') || (definition.energyPerShot ?? 0) > 0) {
    return 'energy'
  }
  return 'ballistic'
}

const resolveProjectileType = (
  definition: PartDefinition,
  weaponType: WeaponStats['weaponType']
): WeaponStats['projectileType'] => {
  const explicitProjectileType = (definition.projectileType ?? '').trim().toLowerCase()
  if (explicitProjectileType === 'bullet' || explicitProjectileType === 'rocket' || explicitProjectileType === 'missile') {
    return explicitProjectileType
  }
  if (explicitProjectileType === 'laser') {
    return 'laserBeam'
  }

  const id = definition.id.toLowerCase()
  const damageType = (definition.damageType ?? '').toLowerCase()
  if (id.includes('rocket')) {
    return 'rocket'
  }
  if (id.includes('missile')) {
    return 'missile'
  }
  if (weaponType === 'energy' || damageType.includes('energy') || damageType.includes('plasma') || damageType.includes('electric')) {
    return 'laserBeam'
  }
  return 'bullet'
}

const resolveIsFullAuto = (definition: PartDefinition): boolean => {
  const firingMode = (definition.firingMode ?? '').trim().toLowerCase()
  if (firingMode === 'fullauto') {
    return true
  }
  if (firingMode === 'semiauto') {
    return false
  }

  if (definition.id === 'basic.assault-rifle' || definition.id === 'basic.minigun') {
    return true
  }
  return (definition.passiveBonuses ?? []).some((bonus) => bonus.toLowerCase().includes('full auto'))
}

const clampLockAngleDegrees = (value: number): number => {
  return Math.max(0, Math.min(89, value))
}

const buildWeaponDefinition = (definition: PartDefinition, index: number): PlayerWeaponDefinition => {
  const weaponType = resolveWeaponType(definition)
  const projectileType = resolveProjectileType(definition, weaponType)
  const projectileCount = Math.max(1, Math.round(definition.projectileCount ?? 1))
  const spreadDegrees = projectileCount > 1
    ? Math.max(0, definition.spreadDegrees ?? 0)
    : 0
  const ammoConsumedPerShot = Math.max(0, definition.ammoConsumedPerShot ?? 0)
  const hasClip = ammoConsumedPerShot > 0
  const clipSize = hasClip ? Math.max(0, Math.round(definition.clipSize ?? 0)) : 0
  const lockOnTimeMs = weaponType === 'missile' ? MISSILE_DEFAULT_LOCK_ON_TIME_MS : 0
  const trackingRating = weaponType === 'missile' ? MISSILE_DEFAULT_TRACKING_RATING : 0
  const explosionRadius = weaponType === 'missile' ? MISSILE_DEFAULT_EXPLOSION_RADIUS : (projectileType === 'laserBeam' ? 1.2 : 0)
  const explosionDamage = weaponType === 'missile' ? MISSILE_DEFAULT_EXPLOSION_DAMAGE : (projectileType === 'laserBeam' ? Math.max(0, definition.damagePerShot ?? 0) : 0)

  return {
    id: definition.id,
    name: definition.name,
    selectionKey: WEAPON_SELECTION_KEYS[index % WEAPON_SELECTION_KEYS.length] ?? '1',
    fireSoundPath: toWeaponSoundPath(definition.fireSound, DEFAULT_FIRE_SOUND_FILENAME),
    weaponType,
    damageType: (definition.damageType ?? 'physical').trim() || 'physical',
    projectileType,
    accuracy: Math.max(0.01, Math.min(1, definition.accuracy ?? WEAPON_DEFAULT_ACCURACY)),
    lockOnRange: Math.max(1, definition.effectiveRange ?? WEAPON_LOCK_ON_RANGE),
    damagePerShot: Math.max(1, Math.round(definition.damagePerShot ?? 1)),
    stability: Math.max(0.1, definition.stability ?? 1),
    projectileCount,
    spreadDegrees,
    bulletSpeed: Math.max(1, definition.bulletSpeed ?? (weaponType === 'missile' ? MISSILE_DEFAULT_SPEED : BULLET_SPEED)),
    maxRange: Math.max(1, BULLET_MAX_DIST),
    isFullAuto: resolveIsFullAuto(definition),
    fireRateCooldownSeconds: Math.max(0, definition.fireRateCooldownSeconds ?? 0.2),
    projectileSize: projectileType === 'rocket' || projectileType === 'missile' ? 0.38 : (projectileType === 'laserBeam' ? 0.35 : 0.22),
    horizontalLockAngle: clampLockAngleDegrees(definition.horizontalLockAngle ?? ((HALF_FOV * 180) / Math.PI)),
    verticalLockAngle: clampLockAngleDegrees(definition.verticalLockAngle ?? ((MAX_LOOK_PITCH * 180) / Math.PI)),
    lockOnTimeMs,
    trackingRating,
    explosionRadius,
    explosionDamage,
    explosionSounds: weaponType === 'missile' || projectileType === 'laserBeam'
      ? [
          'assets/sounds/explosions/explosion_1A.ogg',
          'assets/sounds/explosions/explosion_2a.ogg',
          'assets/sounds/explosions/explosion3.ogg'
        ]
      : [],
    clipSize,
    ammoInClip: clipSize,
    ammoResourcePerRound: ammoConsumedPerShot,
    heatPerShot: Number.isFinite(definition.heatGeneration) ? Math.max(0, Number(definition.heatGeneration)) : undefined,
    energyCostPerShot: Math.max(0, definition.energyPerShot ?? 0),
    reloadDefinition: resolveReloadDefinition(definition)
  }
}

const buildMeleeDefinition = (definition: PartDefinition): PlayerMeleeWeaponDefinition => {
  const swingPath = toWeaponSoundPath(definition.fireSound, DEFAULT_SWING_SOUND_FILENAME)
  return {
    id: definition.id,
    name: definition.name,
    swingSoundPaths: [swingPath],
    damagePerSwing: Math.max(1, Math.round(definition.meleeDamage ?? definition.damagePerShot ?? 1)),
    meleeCooldownSeconds: Math.max(0, definition.fireRateCooldownSeconds ?? 0.8),
    reach: Math.max(0.5, definition.weaponReach ?? 2.5),
    coneAngleDegrees: 78
  }
}

const partCatalog = loadPartCatalog()

export const PLAYER_WEAPON_DEFINITIONS: readonly PlayerWeaponDefinition[] = partCatalog
  .filter((definition) => isWeaponPart(definition) && !isMeleePart(definition) && !definition.isPassive)
  .map(buildWeaponDefinition)

export const PLAYER_MELEE_WEAPON_DEFINITIONS: readonly PlayerMeleeWeaponDefinition[] = partCatalog
  .filter((definition) => isWeaponPart(definition) && isMeleePart(definition) && !definition.isPassive)
  .map(buildMeleeDefinition)
