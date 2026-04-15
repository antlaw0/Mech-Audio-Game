export const CANVAS_WIDTH_LIMIT = 1280
export const CANVAS_HEIGHT_LIMIT = 1024
export const CANVAS_VERTICAL_MARGIN = 40
export const FOV = Math.PI / 3
export const HALF_FOV = FOV / 2
export const MAX_DEPTH = 64
export const MAP_WIDTH = 48
export const MAP_HEIGHT = 48
export const WALL_HEIGHT = 1
export const PLAYER_HEIGHT = 0.5
export const PLAYER_SPEED = 3.0
export const PLAYER_FLIGHT_SPEED = 5.2
export const PLAYER_FLIGHT_VERTICAL_SPEED = 3.4
export const DEFAULT_FLIGHT_HEIGHT = 3
export const TURN_SPEED = 1.8
export const LOOK_SPEED = 1.5
export const MAX_LOOK_PITCH = 0.7
export const PLAYER_RADIUS = 0.25
export const FOOTSTEP_INTERVAL_SECONDS = 0.38
export const BULLET_SPEED = 40
export const BULLET_MAX_DIST = 48
export const MUZZLE_FLASH_DURATION = 0.1
export const TANK_SPEED = 1.2
export const TANK_CANNON_RANGE = 20
export const TANK_CANNON_FIRE_INTERVAL = 2000
export const TANK_THREAT_DELAY_MS = 360
export const TANK_HEALTH = 30
export const TANK_PROJECTILE_SPEED = 30

// --- Target-lock / weapon accuracy ---
// Accuracy is 0.0 (chaotic) → 1.0 (perfect). Controls the half-angle of the
// accuracy cone used when auto-firing toward a locked target.
export const WEAPON_DEFAULT_ACCURACY = 0.65
// Maximum cone half-angle in radians when accuracy = 0 (≈24°).
export const WEAPON_MAX_CONE_RADIANS = 0.42
// At full movement speed the cone widens by this fraction of the base half-angle.
export const WEAPON_MOVEMENT_ACCURACY_PENALTY = 0.55
// World-unit radius within which lock-on is available.
export const WEAPON_LOCK_ON_RANGE = 20
// Seconds between auto-fire shots while locked.
export const WEAPON_AUTO_FIRE_RATE_SECONDS = 0.55
