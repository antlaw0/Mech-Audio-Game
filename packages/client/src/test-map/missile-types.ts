export type MissileTypeId = 'light' | 'medium' | 'heavy'

export interface MissileTypeDefinition {
  speed: number
  turnRate: number
  damage: number
  blastRadius: number
  collisionRadius: number
  proximityFuseDistance: number
  lifetime: number
  explosionSounds: string[]
}

const DEFAULT_EXPLOSION_SOUNDS = [
  'assets/sounds/explosions/explosion_1A.ogg',
  'assets/sounds/explosions/explosion_2a.ogg'
] as const

export const MISSILE_TYPE_DEFINITIONS: Record<MissileTypeId, MissileTypeDefinition> = {
  light: {
    speed: 34,
    turnRate: 6.6,
    damage: 12,
    blastRadius: 1.25,
    collisionRadius: 0.12,
    proximityFuseDistance: 0.5,
    lifetime: 1.85,
    explosionSounds: [...DEFAULT_EXPLOSION_SOUNDS]
  },
  medium: {
    speed: 30,
    turnRate: 5.4,
    damage: 20,
    blastRadius: 1.6,
    collisionRadius: 0.14,
    proximityFuseDistance: 0.45,
    lifetime: 2,
    explosionSounds: [...DEFAULT_EXPLOSION_SOUNDS]
  },
  heavy: {
    speed: 24,
    turnRate: 4.2,
    damage: 32,
    blastRadius: 2.2,
    collisionRadius: 0.17,
    proximityFuseDistance: 0.4,
    lifetime: 2.3,
    explosionSounds: [...DEFAULT_EXPLOSION_SOUNDS]
  }
}

export function getMissileTypeDefinition(missileType: MissileTypeId | string): MissileTypeDefinition {
  const normalized = missileType.trim().toLowerCase()
  if (normalized === 'light' || normalized === 'medium' || normalized === 'heavy') {
    return MISSILE_TYPE_DEFINITIONS[normalized]
  }
  return MISSILE_TYPE_DEFINITIONS.medium
}