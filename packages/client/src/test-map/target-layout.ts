// Ticket 23A — Entity Target Layout Definitions
// Data-driven targeting layout registry with deterministic grid-based subsystem navigation APIs.

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TargetLayoutId = 'HumanoidMech' | 'Tank' | 'Helicopter' | 'APC' | 'Drone'

export type TargetLayoutDirection = 'up' | 'down' | 'left' | 'right'

export interface TargetLayoutNode {
  nodeId: string
  partType: string
  /** Horizontal position in the targeting grid (negative = left, positive = right). */
  gridX: number
  /** Vertical position in the targeting grid (0 = top, increasing downward). */
  gridY: number
  /** True if this node starts visible to the targeting system. */
  initiallyExposed: boolean
  /** Node to fall back to when this node is destroyed/unavailable. Null = use layout fallbackNode. */
  destroyedFallbackNode: string | null
} // end interface TargetLayoutNode

export interface TargetLayoutEdge {
  from: string
  to: string
} // end interface TargetLayoutEdge

export interface TargetLayout {
  layoutId: TargetLayoutId
  nodes: TargetLayoutNode[]
  edges: TargetLayoutEdge[]
  /** Default node selected at lock-on start. */
  defaultNode: string
  /** Layout-wide fallback when the selected node becomes invalid and no destroyedFallbackNode is set. */
  fallbackNode: string
} // end interface TargetLayout

/** Minimum interface required by target layout APIs. An entity must expose its layoutId. */
export interface TargetLayoutEntity {
  layoutId: TargetLayoutId
} // end interface TargetLayoutEntity

// ─────────────────────────────────────────────────────────────────────────────
// Starter Layouts
// ─────────────────────────────────────────────────────────────────────────────

//  Grid orientation (top-down nav view):
//    gridX: −1 = left, 0 = center, +1 = right
//    gridY: 0 = top (head), increasing = lower (legs/internals)

const HUMANOID_MECH_LAYOUT: TargetLayout = {
  layoutId: 'HumanoidMech',
  defaultNode: 'Core',
  fallbackNode: 'Core',
  nodes: [
    // ── Row 0 – head + shoulders ──
    { nodeId: 'LeftShoulder',       partType: 'shoulder',          gridX: -1, gridY: 0, initiallyExposed: true,  destroyedFallbackNode: 'Core' },
    { nodeId: 'Head',               partType: 'head',              gridX:  0, gridY: 0, initiallyExposed: true,  destroyedFallbackNode: 'Core' },
    { nodeId: 'RightShoulder',      partType: 'shoulder',          gridX:  1, gridY: 0, initiallyExposed: true,  destroyedFallbackNode: 'Core' },
    // ── Row 1 – arms + core ──
    { nodeId: 'LeftArm',            partType: 'arm',               gridX: -1, gridY: 1, initiallyExposed: true,  destroyedFallbackNode: 'Core' },
    { nodeId: 'Core',               partType: 'core',              gridX:  0, gridY: 1, initiallyExposed: true,  destroyedFallbackNode: null   },
    { nodeId: 'RightArm',           partType: 'arm',               gridX:  1, gridY: 1, initiallyExposed: true,  destroyedFallbackNode: 'Core' },
    // ── Row 2 – legs ──
    { nodeId: 'LeftLeg',            partType: 'leg',               gridX: -1, gridY: 2, initiallyExposed: true,  destroyedFallbackNode: 'Core' },
    { nodeId: 'RightLeg',           partType: 'leg',               gridX:  1, gridY: 2, initiallyExposed: true,  destroyedFallbackNode: 'Core' },
    // ── Row 3 – internals (hidden until Core is destroyed; see Ticket 25) ──
    { nodeId: 'Generator',          partType: 'generator',         gridX: -1, gridY: 3, initiallyExposed: false, destroyedFallbackNode: 'Core' },
    { nodeId: 'Computer',           partType: 'computer',          gridX:  0, gridY: 3, initiallyExposed: false, destroyedFallbackNode: 'Core' },
    { nodeId: 'ThermalRegulator',   partType: 'thermalRegulator',  gridX:  1, gridY: 3, initiallyExposed: false, destroyedFallbackNode: 'Core' },
  ],
  edges: [
    { from: 'Head',          to: 'LeftShoulder' },
    { from: 'Head',          to: 'RightShoulder' },
    { from: 'Head',          to: 'Core' },
    { from: 'LeftShoulder',  to: 'LeftArm' },
    { from: 'RightShoulder', to: 'RightArm' },
    { from: 'Core',          to: 'LeftArm' },
    { from: 'Core',          to: 'RightArm' },
    { from: 'Core',          to: 'LeftLeg' },
    { from: 'Core',          to: 'RightLeg' },
    // Internal edges (active after Core breach – Ticket 25)
    { from: 'Core',          to: 'Generator' },
    { from: 'Core',          to: 'Computer' },
    { from: 'Core',          to: 'ThermalRegulator' },
  ],
} // end HUMANOID_MECH_LAYOUT

const TANK_LAYOUT: TargetLayout = {
  layoutId: 'Tank',
  defaultNode: 'Chassis',
  fallbackNode: 'Chassis',
  nodes: [
    // ── Row 0 – turret ──
    { nodeId: 'Turret',   partType: 'turret',  gridX:  0, gridY: 0, initiallyExposed: true,  destroyedFallbackNode: 'Chassis' },
    // ── Row 1 – hull + tracks ──
    { nodeId: 'LeftTrack',  partType: 'track', gridX: -1, gridY: 1, initiallyExposed: true,  destroyedFallbackNode: 'Chassis' },
    { nodeId: 'Chassis',    partType: 'core',  gridX:  0, gridY: 1, initiallyExposed: true,  destroyedFallbackNode: null      },
    { nodeId: 'RightTrack', partType: 'track', gridX:  1, gridY: 1, initiallyExposed: true,  destroyedFallbackNode: 'Chassis' },
    // ── Row 2 – internals ──
    { nodeId: 'Engine',     partType: 'engine', gridX: 0, gridY: 2, initiallyExposed: false, destroyedFallbackNode: 'Chassis' },
  ],
  edges: [
    { from: 'Turret',     to: 'Chassis' },
    { from: 'LeftTrack',  to: 'Chassis' },
    { from: 'RightTrack', to: 'Chassis' },
    { from: 'Chassis',    to: 'Engine' },
  ],
} // end TANK_LAYOUT

const HELICOPTER_LAYOUT: TargetLayout = {
  layoutId: 'Helicopter',
  defaultNode: 'Fuselage',
  fallbackNode: 'Fuselage',
  nodes: [
    // ── Row 0 – main rotor ──
    { nodeId: 'MainRotor',  partType: 'rotor',    gridX:  0, gridY: 0, initiallyExposed: true,  destroyedFallbackNode: 'Fuselage' },
    // ── Row 1 – wings + fuselage ──
    { nodeId: 'LeftWing',   partType: 'wing',     gridX: -1, gridY: 1, initiallyExposed: true,  destroyedFallbackNode: 'Fuselage' },
    { nodeId: 'Fuselage',   partType: 'core',     gridX:  0, gridY: 1, initiallyExposed: true,  destroyedFallbackNode: null       },
    { nodeId: 'RightWing',  partType: 'wing',     gridX:  1, gridY: 1, initiallyExposed: true,  destroyedFallbackNode: 'Fuselage' },
    // ── Row 2 – tail rotor ──
    { nodeId: 'TailRotor',  partType: 'rotor',    gridX:  0, gridY: 2, initiallyExposed: true,  destroyedFallbackNode: 'Fuselage' },
    // ── Row 3 – internals ──
    { nodeId: 'Engine',     partType: 'engine',   gridX:  0, gridY: 3, initiallyExposed: false, destroyedFallbackNode: 'Fuselage' },
  ],
  edges: [
    { from: 'MainRotor',  to: 'Fuselage' },
    { from: 'LeftWing',   to: 'Fuselage' },
    { from: 'RightWing',  to: 'Fuselage' },
    { from: 'TailRotor',  to: 'Fuselage' },
    { from: 'Fuselage',   to: 'Engine' },
  ],
} // end HELICOPTER_LAYOUT

const APC_LAYOUT: TargetLayout = {
  layoutId: 'APC',
  defaultNode: 'Hull',
  fallbackNode: 'Hull',
  nodes: [
    // ── Row 0 – armor plates + turret ──
    { nodeId: 'LeftArmor',  partType: 'armor',  gridX: -1, gridY: 0, initiallyExposed: true,  destroyedFallbackNode: 'Hull' },
    { nodeId: 'Turret',     partType: 'turret', gridX:  0, gridY: 0, initiallyExposed: true,  destroyedFallbackNode: 'Hull' },
    { nodeId: 'RightArmor', partType: 'armor',  gridX:  1, gridY: 0, initiallyExposed: true,  destroyedFallbackNode: 'Hull' },
    // ── Row 1 – wheels + hull ──
    { nodeId: 'LeftWheel',  partType: 'wheel',  gridX: -1, gridY: 1, initiallyExposed: true,  destroyedFallbackNode: 'Hull' },
    { nodeId: 'Hull',       partType: 'core',   gridX:  0, gridY: 1, initiallyExposed: true,  destroyedFallbackNode: null   },
    { nodeId: 'RightWheel', partType: 'wheel',  gridX:  1, gridY: 1, initiallyExposed: true,  destroyedFallbackNode: 'Hull' },
    // ── Row 2 – internals ──
    { nodeId: 'Engine',     partType: 'engine', gridX:  0, gridY: 2, initiallyExposed: false, destroyedFallbackNode: 'Hull' },
  ],
  edges: [
    { from: 'Turret',     to: 'Hull' },
    { from: 'LeftArmor',  to: 'Hull' },
    { from: 'RightArmor', to: 'Hull' },
    { from: 'LeftWheel',  to: 'Hull' },
    { from: 'RightWheel', to: 'Hull' },
    { from: 'Hull',       to: 'Engine' },
  ],
} // end APC_LAYOUT

const DRONE_LAYOUT: TargetLayout = {
  layoutId: 'Drone',
  defaultNode: 'CoreFrame',
  fallbackNode: 'CoreFrame',
  nodes: [
    // ── Row 0 – sensor array ──
    { nodeId: 'SensorArray', partType: 'sensor',    gridX:  0, gridY: 0, initiallyExposed: true, destroyedFallbackNode: 'CoreFrame' },
    // ── Row 1 – rotors + frame ──
    { nodeId: 'LeftRotor',   partType: 'rotor',     gridX: -1, gridY: 1, initiallyExposed: true, destroyedFallbackNode: 'CoreFrame' },
    { nodeId: 'CoreFrame',   partType: 'core',      gridX:  0, gridY: 1, initiallyExposed: true, destroyedFallbackNode: null        },
    { nodeId: 'RightRotor',  partType: 'rotor',     gridX:  1, gridY: 1, initiallyExposed: true, destroyedFallbackNode: 'CoreFrame' },
  ],
  edges: [
    { from: 'SensorArray', to: 'CoreFrame' },
    { from: 'LeftRotor',   to: 'CoreFrame' },
    { from: 'RightRotor',  to: 'CoreFrame' },
  ],
} // end DRONE_LAYOUT

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT_REGISTRY: Readonly<Record<TargetLayoutId, TargetLayout>> = {
  HumanoidMech: HUMANOID_MECH_LAYOUT,
  Tank:         TANK_LAYOUT,
  Helicopter:   HELICOPTER_LAYOUT,
  APC:          APC_LAYOUT,
  Drone:        DRONE_LAYOUT,
} // end LAYOUT_REGISTRY

// ─────────────────────────────────────────────────────────────────────────────
// Layout ID helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Maps a string enemyType (from EnemyId or a player sentinel) to a TargetLayoutId. */
export function getLayoutIdForEntityType(entityType: string): TargetLayoutId {
  switch (entityType) {
    case 'tank':
      return 'Tank'
    case 'helicopter':
      return 'Helicopter'
    case 'apc':
      return 'APC'
    case 'drone':
      return 'Drone'
    case 'striker':
    case 'brute':
    case 'bruiser':
    case 'test-dummy':
    case 'player':
    default:
      return 'HumanoidMech'
  } // end switch entityType
} // end function getLayoutIdForEntityType

// ─────────────────────────────────────────────────────────────────────────────
// APIs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the TargetLayout for the given entity.
 * Returns null if the layoutId is not registered (should never happen with valid data).
 */
export function getTargetLayout(entity: TargetLayoutEntity): TargetLayout | null {
  return LAYOUT_REGISTRY[entity.layoutId] ?? null
} // end function getTargetLayout

/**
 * Returns the adjacent TargetLayoutNode in `direction` from `nodeId` using grid coordinates.
 * Only returns exposed (initiallyExposed) nodes.
 * Returns null if no exposed node exists in that direction.
 *
 * NOTE: Ticket 25 will extend this to respect runtime-breached internal nodes.
 */
export function getAdjacentSubsystem(
  entity: TargetLayoutEntity,
  nodeId: string,
  direction: TargetLayoutDirection
): TargetLayoutNode | null {
  const layout = getTargetLayout(entity)
  if (layout === null) {
    return null
  } // end if no layout

  const current = layout.nodes.find(n => n.nodeId === nodeId)
  if (current === undefined) {
    return null
  } // end if node not found

  let targetX = current.gridX
  let targetY = current.gridY

  switch (direction) {
    case 'up':    targetY -= 1; break
    case 'down':  targetY += 1; break
    case 'left':  targetX -= 1; break
    case 'right': targetX += 1; break
  } // end switch direction

  // TODO Ticket 25: also consider runtime-exposed internal nodes here.
  return layout.nodes.find(n => n.gridX === targetX && n.gridY === targetY && n.initiallyExposed) ?? null
} // end function getAdjacentSubsystem

/**
 * Returns all nodes that are currently selectable for the given entity.
 * Currently returns only initiallyExposed nodes.
 *
 * TODO Ticket 25: merge with runtime state so Core-breached internals are included.
 */
export function getExposedSubsystems(entity: TargetLayoutEntity): TargetLayoutNode[] {
  const layout = getTargetLayout(entity)
  if (layout === null) {
    return []
  } // end if no layout

  // TODO Ticket 25: filter by runtime breach state, not just initiallyExposed.
  return layout.nodes.filter(n => n.initiallyExposed)
} // end function getExposedSubsystems

/**
 * Returns the layout-level fallback TargetLayoutNode for the given entity.
 * Returns null if the fallback nodeId is missing from the layout (should not occur with valid data).
 */
export function getFallbackSubsystem(entity: TargetLayoutEntity): TargetLayoutNode | null {
  const layout = getTargetLayout(entity)
  if (layout === null) {
    return null
  } // end if no layout

  return layout.nodes.find(n => n.nodeId === layout.fallbackNode) ?? null
} // end function getFallbackSubsystem
