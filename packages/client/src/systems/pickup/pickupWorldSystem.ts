import * as THREE from 'three'
import type { LoosePickup, LootContainerPickup } from './pickupSystem.js'
import type { ItemDatabase } from '../inventory/itemDatabase.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PickupBeaconHandle {
  setPosition(x: number, y: number, z: number): void
  ping(): void
  dispose(): void
} // end interface PickupBeaconHandle

export type PickupBeaconFactory = (
  soundPath: string,
  minDist: number,
  maxDist: number
) => PickupBeaconHandle

export interface PickupWorldAudioCuePaths {
  metallic: string
  electrical: string
  heavyThunk: string
  rareResonant: string
  industrial: string
  equip: string
} // end interface PickupWorldAudioCuePaths

export interface PickupWorldSystemOptions {
  /** Registers a mesh with the Three.js scene (from ThreeRenderSystem.addPickupMesh). */
  addMesh: (id: string, object: THREE.Object3D) => void
  /** Removes and disposes a mesh from the Three.js scene (from ThreeRenderSystem.removePickupMesh). */
  removeMesh: (id: string) => void
  beaconFactory: PickupBeaconFactory
  itemDatabase: ItemDatabase
  audioCuePaths: PickupWorldAudioCuePaths
} // end interface PickupWorldSystemOptions

export interface PickupWorldSystem {
  update(
    loosePickups: LoosePickup[],
    containers: LootContainerPickup[],
    deltaSeconds: number,
    beaconMaxDistance: number
  ): void
  dispose(): void
} // end interface PickupWorldSystem

// ---------------------------------------------------------------------------
// Internal classification helpers
// ---------------------------------------------------------------------------

type PickupVisualClass =
  | 'container'
  | 'ammo'
  | 'rocket'
  | 'energyCell'
  | 'part'
  | 'rare'
  | 'default'

function classifyLoosePickup(
  itemDatabase: ItemDatabase,
  itemId: string
): PickupVisualClass {
  const def = itemDatabase.getById(itemId)
  if (!def) return 'default'
  if (def.rarity >= 4) return 'rare'
  if (def.category === 'parts') return 'part'
  const lower = itemId.toLowerCase()
  if (lower === 'ammo_resource') return 'ammo'
  if (lower === 'energy_cell') return 'energyCell'
  if (lower.includes('rocket') || lower.includes('missile')) return 'rocket'
  return 'default'
} // end function classifyLoosePickup

function getLooseAudioPath(
  itemDatabase: ItemDatabase,
  itemId: string,
  paths: PickupWorldAudioCuePaths
): string {
  const def = itemDatabase.getById(itemId)
  if (!def) return paths.metallic
  if (def.rarity >= 4) return paths.rareResonant
  if (def.category === 'parts') return paths.equip
  const lower = itemId.toLowerCase()
  if (lower === 'ammo_resource') return paths.metallic
  if (lower === 'energy_cell') return paths.electrical
  if (lower.includes('rocket') || lower.includes('missile')) return paths.heavyThunk
  return paths.metallic
} // end function getLooseAudioPath

// ---------------------------------------------------------------------------
// Mesh factory helpers
// ---------------------------------------------------------------------------

// Containers: brown box 1m wide × 1m deep × 0.9m tall (~half player height 1.8m)
function createContainerMesh(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1, 0.9, 1)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x7b4f2e,
    roughness: 0.85,
    metalness: 0.05
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 0.45 // half height above parent origin
  return mesh
} // end function createContainerMesh

// Ammo: gold box 0.5m × 0.5m × 0.25m
function createAmmoMesh(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(0.5, 0.25, 0.5)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    roughness: 0.5,
    metalness: 0.6
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 0.125
  return mesh
} // end function createAmmoMesh

// Rocket/missile: gray cylinder on its side — 0.5m long, 0.1m diameter
function createRocketMesh(): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 12)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.6,
    metalness: 0.4
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.z = Math.PI / 2 // lay cylinder along X axis
  mesh.position.y = 0.05 // radius above ground
  return mesh
} // end function createRocketMesh

// Energy cell: light blue box 0.25m × 0.25m × 0.1m
function createEnergyCellMesh(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(0.25, 0.1, 0.25)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x7fc8e8,
    roughness: 0.4,
    metalness: 0.2,
    emissive: 0x1a4a6a,
    emissiveIntensity: 0.35
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 0.05
  return mesh
} // end function createEnergyCellMesh

// Parts: white box 0.25m × 0.25m × 0.25m
function createPartMesh(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(0.25, 0.25, 0.25)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf0f0f0,
    roughness: 0.7,
    metalness: 0.1
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 0.125
  return mesh
} // end function createPartMesh

// Rare: purple box 0.25m × 0.25m × 0.25m
function createRareMesh(): THREE.Mesh {
  const geo = new THREE.BoxGeometry(0.25, 0.25, 0.25)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x9b30ff,
    roughness: 0.5,
    metalness: 0.3,
    emissive: 0x4a0080,
    emissiveIntensity: 0.4
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 0.125
  return mesh
} // end function createRareMesh

// Default fallback: orange sphere 0.25m diameter (0.125m radius)
function createDefaultMesh(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.125, 12, 8)
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff7700,
    roughness: 0.6,
    metalness: 0.1
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.y = 0.125
  return mesh
} // end function createDefaultMesh

function createMeshForClass(cls: PickupVisualClass): THREE.Mesh {
  switch (cls) {
    case 'container': return createContainerMesh()
    case 'ammo': return createAmmoMesh()
    case 'rocket': return createRocketMesh()
    case 'energyCell': return createEnergyCellMesh()
    case 'part': return createPartMesh()
    case 'rare': return createRareMesh()
    default: return createDefaultMesh()
  }
} // end function createMeshForClass

// (Mesh disposal is handled by ThreeRenderSystem.removePickupMesh)

// ---------------------------------------------------------------------------
// Internal record type
// ---------------------------------------------------------------------------

interface WorldRecord {
  beacon: PickupBeaconHandle
  beaconTimerSeconds: number
} // end interface WorldRecord

const BEACON_INTERVAL_SECONDS = 5
const BEACON_MIN_DISTANCE = 1

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPickupWorldSystem(
  options: PickupWorldSystemOptions
): PickupWorldSystem {
  const { addMesh, removeMesh, beaconFactory, itemDatabase, audioCuePaths } = options
  const records = new Map<string, WorldRecord>()

  // Place a mesh+beacon for an object at game-world coordinates.
  // Game world: x/y = horizontal plane, z = height (altitude).
  // Three.js mapping:  X = game.x,  Z = game.y,  Y = game.z (height) + mesh_halfH
  const addRecord = (
    id: string,
    gameX: number,
    gameY: number,
    gameZ: number,
    mesh: THREE.Mesh,
    beacon: PickupBeaconHandle
  ): void => {
    const floorY = Math.max(0, gameZ)
    const wrapper = new THREE.Group()
    // Three.js mapping: X=gameX, Y=height(floorY), Z=gameY
    wrapper.position.set(gameX, floorY, gameY)
    wrapper.add(mesh)
    addMesh(id, wrapper)

    // Audio emitter uses game coords (audio system handles internal transform)
    beacon.setPosition(gameX, gameY, floorY)

    records.set(id, { beacon, beaconTimerSeconds: BEACON_INTERVAL_SECONDS })
    // Timer starts at interval so first ping fires at 5s (not immediately on spawn)
  } // end function addRecord

  const removeRecord = (id: string): void => {
    const rec = records.get(id)
    if (!rec) {
      return
    } // end if no record
    removeMesh(id) // three-render disposes geometry/materials
    rec.beacon.dispose()
    records.delete(id)
  } // end function removeRecord

  const update = (
    loosePickups: LoosePickup[],
    containers: LootContainerPickup[],
    deltaSeconds: number,
    beaconMaxDistance: number
  ): void => {
    const dt = Math.max(0, deltaSeconds)

    // Build current-ID set for diffing
    const currentIds = new Set<string>()
    for (const p of loosePickups) currentIds.add(p.id)
    for (const c of containers) currentIds.add(c.id)

    // Remove stale records
    for (const id of records.keys()) {
      if (!currentIds.has(id)) {
        removeRecord(id)
      }
    } // end for each stale record

    // Add new loose pickups
    for (const loose of loosePickups) {
      if (records.has(loose.id)) {
        continue
      } // end if already tracked
      const cls = classifyLoosePickup(itemDatabase, loose.stack.itemId)
      const audioPath = getLooseAudioPath(itemDatabase, loose.stack.itemId, audioCuePaths)
      const mesh = createMeshForClass(cls)
      const beacon = beaconFactory(audioPath, BEACON_MIN_DISTANCE, beaconMaxDistance)
      addRecord(
        loose.id,
        loose.position.x,
        loose.position.y,
        loose.position.z,
        mesh,
        beacon
      )
    } // end for each loose pickup

    // Add new containers
    for (const container of containers) {
      if (records.has(container.id)) {
        continue
      } // end if already tracked
      const mesh = createContainerMesh()
      const beacon = beaconFactory(audioCuePaths.industrial, BEACON_MIN_DISTANCE, beaconMaxDistance)
      addRecord(
        container.id,
        container.position.x,
        container.position.y,
        container.position.z,
        mesh,
        beacon
      )
    } // end for each container

    // Tick beacon timers — ping when interval elapsed
    for (const rec of records.values()) {
      rec.beaconTimerSeconds += dt
      if (rec.beaconTimerSeconds >= BEACON_INTERVAL_SECONDS) {
        rec.beaconTimerSeconds = 0
        rec.beacon.ping()
      }
    } // end for each record
  } // end function update

  const dispose = (): void => {
    for (const id of Array.from(records.keys())) {
      removeRecord(id)
    }
  } // end function dispose

  return { update, dispose }
} // end function createPickupWorldSystem
