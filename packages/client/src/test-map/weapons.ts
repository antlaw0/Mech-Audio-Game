import {
  BULLET_MAX_DIST,
  BULLET_SPEED,
  MISSILE_DEFAULT_EXPLOSION_DAMAGE,
  MISSILE_DEFAULT_EXPLOSION_RADIUS,
  MISSILE_DEFAULT_LOCK_ON_TIME_MS,
  MISSILE_DEFAULT_SPEED,
  MISSILE_DEFAULT_TRACKING_RATING,
  WEAPON_DEFAULT_ACCURACY,
  WEAPON_LOCK_ON_RANGE
} from './constants.js'
import type { MeleeWeaponStats, WeaponReloadDefinition, WeaponStats } from './types.js'

export interface PlayerWeaponDefinition extends WeaponStats {
  id: 'pistol' | 'laser-pistol' | 'shotgun' | 'assault-rifle' | 'missile-launcher' | 'rocket-launcher' | 'sniper-rifle'
  name: string
  selectionKey: '1' | '2' | '3' | '4' | '5' | '6' | '7'
  fireSoundPath: string
} // end interface PlayerWeaponDefinition

export interface PlayerMeleeWeaponDefinition extends MeleeWeaponStats {
  id: 'sword'
  name: string
  swingSoundPaths: string[]
} // end interface PlayerMeleeWeaponDefinition

function createPistolReloadDefinition(): WeaponReloadDefinition {
  // Exact durations: pistol_reload_pt1=308ms, pistol_reload_pt2=414ms
  // Timeline positions:
  //   Pause1:  0 – 100ms
  //   pt1:   100 – 408ms
  //   Pause2: 408 – 668ms
  //   pt2:   668 – 1082ms
  //   Pause3: 1082 – 1122ms
  // Servo: pitch +50% for the full duration of each pause, baseline during audio segments.
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
      { type: 'pitch', startMs: 0,    endMs: 100,  magnitude: 0.5 },
      { type: 'pitch', startMs: 408,  endMs: 668,  magnitude: 0.5 },
      { type: 'pitch', startMs: 1082, endMs: 1122, magnitude: 0.5 }
    ]
  }
} // end function createPistolReloadDefinition

function createShotgunReloadDefinition(): WeaponReloadDefinition {
  // Exact durations: rifle_reload_pt1=526ms, shotgun_reload=524ms
  // Timeline positions:
  //   Pause1:  0 – 80ms
  //   pt1:    80 – 606ms
  //   Pause2: 606 – 886ms
  //   shotgun: 886 – 1410ms
  //   Pause3: 1410 – 1490ms
  // Servo: pitch +50% for each pause window, pitch -25% during each audio segment.
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
      { type: 'pitch', startMs: 0,    endMs: 80,   magnitude: 0.5  },
      { type: 'pitch', startMs: 80,   endMs: 606,  magnitude: -0.25 },
      { type: 'pitch', startMs: 606,  endMs: 886,  magnitude: 0.5  },
      { type: 'pitch', startMs: 886,  endMs: 1410, magnitude: -0.25 },
      { type: 'pitch', startMs: 1410, endMs: 1490, magnitude: 0.5  }
    ]
  }
} // end function createShotgunReloadDefinition

function createAssaultRifleReloadDefinition(): WeaponReloadDefinition {
  // Exact durations: rifle_reload_pt1=526ms, rifle_reload_pt2=1088ms, rifle_reload_pt3=731ms
  // Timeline positions:
  //   Pause1:  0 – 60ms
  //   pt1:    60 – 586ms
  //   Pause2: 586 – 746ms
  //   pt2:   746 – 1834ms
  //   Pause3: 1834 – 2054ms
  //   pt3:   2054 – 2785ms
  //   Pause4: 2785 – 2865ms
  // Servo: +65% pitch for first two pauses, +50% for last two; baseline during all audio segments.
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
      { type: 'pitch', startMs: 0,    endMs: 60,   magnitude: 0.65 },
      { type: 'pitch', startMs: 586,  endMs: 746,  magnitude: 0.65 },
      { type: 'pitch', startMs: 1834, endMs: 2054, magnitude: 0.5  },
      { type: 'pitch', startMs: 2785, endMs: 2865, magnitude: 0.5  }
    ]
  }
} // end function createAssaultRifleReloadDefinition

function createSimpleReloadDefinition(soundPath: string): WeaponReloadDefinition {
  return {
    timeline: [
      { type: 'audio', soundPath }
    ],
    servoLoopSoundPath: 'assets/sounds/servoBed.ogg',
    servoEffects: []
  }
} // end function createSimpleReloadDefinition

export const PLAYER_WEAPON_DEFINITIONS: readonly PlayerWeaponDefinition[] = [
  {
    id: 'pistol',
    name: 'Pistol',
    selectionKey: '1',
    fireSoundPath: 'assets/sounds/weapons/pistol_fire.ogg',
    weaponType: 'ballistic',
    damageType: 'physical',
    projectileType: 'bullet',
    accuracy: Math.max(WEAPON_DEFAULT_ACCURACY, 0.94),
    lockOnRange: WEAPON_LOCK_ON_RANGE,
    damagePerShot: 18,
    projectileCount: 1,
    spreadDegrees: 1.4,
    bulletSpeed: BULLET_SPEED,
    maxRange: BULLET_MAX_DIST,
    isFullAuto: false,
    fireRateCooldownSeconds: 0.33,
    projectileSize: 0.22,
    lockOnWindowWidthPercent: 100,
    lockOnWindowHeightPercent: 100,
    lockOnTimeMs: 0,
    trackingRating: 0,
    explosionRadius: 0,
    explosionDamage: 0,
    explosionSounds: [],
    clipSize: 10,
    ammoInClip: 10,
    ammoResourcePerRound: 1,
    reloadDefinition: createPistolReloadDefinition()
  },
  {
    id: 'laser-pistol',
    name: 'Laser Pistol',
    selectionKey: '7',
    fireSoundPath: 'assets/sounds/weapons/laser_pistol.ogg',
    weaponType: 'energy',
    damageType: 'energy',
    projectileType: 'laserBeam',
    accuracy: Math.max(WEAPON_DEFAULT_ACCURACY, 0.94),
    lockOnRange: WEAPON_LOCK_ON_RANGE,
    damagePerShot: 18,
    projectileCount: 1,
    spreadDegrees: 1.4,
    bulletSpeed: BULLET_SPEED,
    maxRange: BULLET_MAX_DIST,
    isFullAuto: false,
    fireRateCooldownSeconds: 0.33,
    projectileSize: 0.22,
    lockOnWindowWidthPercent: 100,
    lockOnWindowHeightPercent: 100,
    lockOnTimeMs: 0,
    trackingRating: 0,
    explosionRadius: 0,
    explosionDamage: 0,
    explosionSounds: [],
    clipSize: 10,
    ammoInClip: 10,
    ammoResourcePerRound: 1,
    energyCostPerShot: 5,
    reloadDefinition: createPistolReloadDefinition()
  },
  {
    id: 'shotgun',
    name: 'Shotgun',
    selectionKey: '2',
    fireSoundPath: 'assets/sounds/weapons/shotgun_fire.ogg',
    weaponType: 'ballistic',
    damageType: 'physical',
    projectileType: 'bullet',
    accuracy: 0.82,
    lockOnRange: WEAPON_LOCK_ON_RANGE,
    damagePerShot: 11,
    projectileCount: 8,
    spreadDegrees: 9.5,
    bulletSpeed: BULLET_SPEED * 0.78,
    maxRange: BULLET_MAX_DIST * 0.58,
    isFullAuto: false,
    fireRateCooldownSeconds: 0.9,
    projectileSize: 0.2,
    lockOnWindowWidthPercent: 100,
    lockOnWindowHeightPercent: 100,
    lockOnTimeMs: 0,
    trackingRating: 0,
    explosionRadius: 0,
    explosionDamage: 0,
    explosionSounds: [],
    clipSize: 8,
    ammoInClip: 8,
    ammoResourcePerRound: 5,
    reloadDefinition: createShotgunReloadDefinition()
  },
  {
    id: 'assault-rifle',
    name: 'Assault Rifle',
    selectionKey: '3',
    fireSoundPath: 'assets/sounds/weapons/assault_fire.ogg',
    weaponType: 'ballistic',
    damageType: 'physical',
    projectileType: 'bullet',
    accuracy: 0.88,
    lockOnRange: WEAPON_LOCK_ON_RANGE,
    damagePerShot: 9,
    projectileCount: 1,
    spreadDegrees: 2.2,
    bulletSpeed: BULLET_SPEED * 1.08,
    maxRange: BULLET_MAX_DIST * 1.08,
    isFullAuto: true,
    fireRateCooldownSeconds: 0.09,
    projectileSize: 0.2,
    lockOnWindowWidthPercent: 100,
    lockOnWindowHeightPercent: 100,
    lockOnTimeMs: 0,
    trackingRating: 0,
    explosionRadius: 0,
    explosionDamage: 0,
    explosionSounds: [],
    clipSize: 30,
    ammoInClip: 30,
    ammoResourcePerRound: 2,
    reloadDefinition: createAssaultRifleReloadDefinition()
  },
  {
    id: 'missile-launcher',
    name: 'Missile Launcher',
    selectionKey: '4',
    fireSoundPath: 'assets/sounds/weapons/missileFire.ogg',
    weaponType: 'missile',
    damageType: 'explosive',
    projectileType: 'missile',
    accuracy: 1,
    lockOnRange: WEAPON_LOCK_ON_RANGE,
    damagePerShot: 20,
    projectileCount: 1,
    spreadDegrees: 0,
    bulletSpeed: MISSILE_DEFAULT_SPEED,
    maxRange: BULLET_MAX_DIST,
    isFullAuto: false,
    fireRateCooldownSeconds: 1.1,
    projectileSize: 0.38,
    lockOnWindowWidthPercent: 100,
    lockOnWindowHeightPercent: 100,
    lockOnTimeMs: MISSILE_DEFAULT_LOCK_ON_TIME_MS,
    trackingRating: MISSILE_DEFAULT_TRACKING_RATING,
    explosionRadius: MISSILE_DEFAULT_EXPLOSION_RADIUS,
    explosionDamage: MISSILE_DEFAULT_EXPLOSION_DAMAGE,
    explosionSounds: [
      'assets/sounds/explosions/explosion_1A.ogg',
      'assets/sounds/explosions/explosion_2a.ogg',
      'assets/sounds/explosions/explosion3.ogg'
    ],
    clipSize: 1,
    ammoInClip: 1,
    ammoResourcePerRound: 50,
    reloadDefinition: createSimpleReloadDefinition('assets/sounds/weapons/reload/reload.ogg')
  },
  {
    id: 'rocket-launcher',
    name: 'Rocket Launcher',
    selectionKey: '5',
    fireSoundPath: 'assets/sounds/weapons/rocket_fire.OGG',
    weaponType: 'missile',
    damageType: 'explosive',
    projectileType: 'rocket',
    accuracy: 0.72,
    lockOnRange: WEAPON_LOCK_ON_RANGE,
    damagePerShot: 20,
    projectileCount: 1,
    spreadDegrees: 0,
    bulletSpeed: MISSILE_DEFAULT_SPEED * 0.88,
    maxRange: BULLET_MAX_DIST,
    isFullAuto: false,
    fireRateCooldownSeconds: 1.7,
    projectileSize: 0.38,
    lockOnWindowWidthPercent: 100,
    lockOnWindowHeightPercent: 100,
    lockOnTimeMs: 0,
    trackingRating: 0,
    explosionRadius: MISSILE_DEFAULT_EXPLOSION_RADIUS,
    explosionDamage: 20,
    explosionSounds: [
      'assets/sounds/explosions/explosion_1A.ogg',
      'assets/sounds/explosions/explosion_2a.ogg',
      'assets/sounds/explosions/explosion3.ogg'
    ],
    clipSize: 1,
    ammoInClip: 1,
    ammoResourcePerRound: 25,
    reloadDefinition: createSimpleReloadDefinition('assets/sounds/weapons/reload/reload.ogg')
  },
  {
    id: 'sniper-rifle',
    name: 'Sniper Rifle',
    selectionKey: '6',
    fireSoundPath: 'assets/sounds/weapons/sniper_fire.ogg',
    weaponType: 'ballistic',
    damageType: 'physical',
    projectileType: 'bullet',
    accuracy: 0.995,
    lockOnRange: WEAPON_LOCK_ON_RANGE * 1.45,
    damagePerShot: 52,
    projectileCount: 1,
    spreadDegrees: 0.2,
    bulletSpeed: BULLET_SPEED * 1.5,
    maxRange: BULLET_MAX_DIST * 1.8,
    isFullAuto: false,
    fireRateCooldownSeconds: 1.35,
    projectileSize: 0.16,
    lockOnWindowWidthPercent: 35,
    lockOnWindowHeightPercent: 30,
    lockOnTimeMs: 0,
    trackingRating: 0,
    explosionRadius: 0,
    explosionDamage: 0,
    explosionSounds: [],
    clipSize: 5,
    ammoInClip: 5,
    ammoResourcePerRound: 10,
    reloadDefinition: createSimpleReloadDefinition('assets/sounds/weapons/reload/sniper_reload.ogg')
  }
]

export const PLAYER_MELEE_WEAPON_DEFINITIONS: readonly PlayerMeleeWeaponDefinition[] = [
  {
    id: 'sword',
    name: 'Sword',
    swingSoundPaths: [
      'assets/sounds/weapons/swing_medium.ogg',
      'assets/sounds/weapons/swing_medium1.ogg',
      'assets/sounds/weapons/swing_medium2.ogg'
    ],
    damagePerSwing: 26,
    meleeCooldownSeconds: 0.8,
    reach: 2.5,
    coneAngleDegrees: 78
  }
]
