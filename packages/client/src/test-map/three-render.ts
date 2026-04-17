import * as THREE from 'three'
import { MAP_HEIGHT, MAP_WIDTH } from './constants.js'
import { getCell } from './map-data.js'
import type { Bullet, EnemyRender, Player, SpriteObject, TankRender } from './types.js'
import { PLAYER_EYE_HEIGHT, WORLD_WALL_HEIGHT } from './world-collision.js'

interface ThreeRendererCreateArgs {
  canvas: HTMLCanvasElement
  canvasWidth: number
  canvasHeight: number
  mapData: Uint8Array
  sprites: SpriteObject[]
} // end interface ThreeRendererCreateArgs

interface ThreeRenderFrameArgs {
  enemies: EnemyRender[]
  tanks: TankRender[]
  bullets: Bullet[]
  player: Player
  muzzleFlashAlpha: number
  lockedTankId: number | null
  lockOnWindowWidthPercent: number
  lockOnWindowHeightPercent: number
} // end interface ThreeRenderFrameArgs

interface ThreeRenderSystem {
  renderFrame: (args: ThreeRenderFrameArgs) => void
  resize: (canvasWidth: number, canvasHeight: number) => void
  dispose: () => void
} // end interface ThreeRenderSystem

function createTreeMesh(radius: number): THREE.Group {
  const group = new THREE.Group()

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.24, radius * 0.3, 1.1, 10),
    new THREE.MeshStandardMaterial({ color: 0x4d3626, roughness: 0.95 })
  )
  trunk.position.y = 0.55
  group.add(trunk)

  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 1.45, 1.6, 12),
    new THREE.MeshStandardMaterial({ color: 0x1f8d45, roughness: 0.92 })
  )
  canopy.position.y = 1.75
  group.add(canopy)

  return group
} // end function createTreeMesh

function createRockMesh(radius: number): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.DodecahedronGeometry(Math.max(0.2, radius)),
    new THREE.MeshStandardMaterial({ color: 0x6b7078, roughness: 0.98 })
  )
} // end function createRockMesh

function createTankMesh(): THREE.Group {
  const group = new THREE.Group()

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.44, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x8f1a1a, roughness: 0.8, metalness: 0.2 })
  )
  body.position.y = 0.2
  group.add(body)

  const turret = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x6f1111, roughness: 0.75, metalness: 0.3 })
  )
  turret.position.y = 0.5
  turret.rotation.x = Math.PI / 2
  group.add(turret)

  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.85),
    new THREE.MeshStandardMaterial({ color: 0x6f1111, roughness: 0.65, metalness: 0.35 })
  )
  barrel.position.set(0, 0.48, 0.5)
  group.add(barrel)

  const explosion = new THREE.Mesh(
    new THREE.SphereGeometry(0.65, 18, 16),
    new THREE.MeshBasicMaterial({
      color: 0xff9f37,
      transparent: true,
      opacity: 0,
      depthWrite: false
    })
  )
  explosion.visible = false
  explosion.position.y = 0.35
  explosion.name = 'explosion'
  group.add(explosion)

  return group
} // end function createTankMesh

function createEnemyMesh(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.CapsuleGeometry(0.2, 0.55, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xd83e3e, roughness: 0.7 })
  )
} // end function createEnemyMesh

function createBulletMesh(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 })
  )
} // end function createBulletMesh

function createMissileTrailPuffs(): THREE.Group {
  const group = new THREE.Group()
  group.visible = false
  group.frustumCulled = false

  for (let puffIndex = 0; puffIndex < 32; puffIndex += 1) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 10),
      new THREE.MeshBasicMaterial({
        color: 0xc8d0d8,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        depthTest: false
      })
    )
    puff.visible = false
    puff.renderOrder = 3
    group.add(puff)
  } // end for each trail puff

  return group
} // end function createMissileTrailPuffs

function syncPool<T extends THREE.Object3D>(
  targetCount: number,
  pool: T[],
  parent: THREE.Object3D,
  factory: () => T
): void {
  while (pool.length < targetCount) {
    const mesh = factory()
    pool.push(mesh)
    parent.add(mesh)
  } // end while grow pool

  while (pool.length > targetCount) {
    const mesh = pool.pop()
    if (mesh) {
      parent.remove(mesh)
    } // end if removed mesh exists
  } // end while shrink pool
} // end function syncPool

function toScreenPoint(vector: THREE.Vector3, width: number, height: number): { x: number; y: number } {
  return {
    x: (vector.x * 0.5 + 0.5) * width,
    y: (1 - (vector.y * 0.5 + 0.5)) * height
  }
} // end function toScreenPoint

function drawCornerBox(ctx: CanvasRenderingContext2D, left: number, top: number, right: number, bottom: number): void {
  const width = Math.max(4, right - left)
  const height = Math.max(4, bottom - top)
  const arm = Math.max(8, Math.min(width, height) * 0.24)

  ctx.beginPath()
  // top-left
  ctx.moveTo(left + arm, top)
  ctx.lineTo(left, top)
  ctx.lineTo(left, top + arm)
  // top-right
  ctx.moveTo(right - arm, top)
  ctx.lineTo(right, top)
  ctx.lineTo(right, top + arm)
  // bottom-left
  ctx.moveTo(left, bottom - arm)
  ctx.lineTo(left, bottom)
  ctx.lineTo(left + arm, bottom)
  // bottom-right
  ctx.moveTo(right, bottom - arm)
  ctx.lineTo(right, bottom)
  ctx.lineTo(right - arm, bottom)
  ctx.stroke()
} // end function drawCornerBox

function drawHudOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: THREE.PerspectiveCamera,
  tanks: TankRender[],
  lockedTankId: number | null,
  lockOnWindowWidthPercent: number,
  lockOnWindowHeightPercent: number
): void {
  ctx.clearRect(0, 0, width, height)

  const centerX = width * 0.5
  const centerY = height * 0.5

  // Center crosshair
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.8)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(centerX - 8, centerY)
  ctx.lineTo(centerX + 8, centerY)
  ctx.moveTo(centerX, centerY - 8)
  ctx.lineTo(centerX, centerY + 8)
  ctx.stroke()

  // Lockbox defined by current lock-on window percentages.
  const lockWidth = Math.max(4, width * Math.max(0, Math.min(100, lockOnWindowWidthPercent)) / 100)
  const lockHeight = Math.max(4, height * Math.max(0, Math.min(100, lockOnWindowHeightPercent)) / 100)
  const lockLeft = centerX - lockWidth * 0.5
  const lockTop = centerY - lockHeight * 0.5
  const lockRight = centerX + lockWidth * 0.5
  const lockBottom = centerY + lockHeight * 0.5
  ctx.strokeStyle = 'rgba(0, 180, 255, 0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(lockLeft, lockTop, lockWidth, lockHeight)

  if (lockedTankId === null) {
    return
  } // end if no lock target

  const lockedTank = tanks.find((tank) => tank.id === lockedTankId && tank.alive)
  if (!lockedTank) {
    return
  } // end if locked tank unavailable

  const hitboxHalfHeight = 0.6
  const hitboxCenterY = lockedTank.height + 0.5
  const hitboxTop = hitboxCenterY + hitboxHalfHeight
  const hitboxBottom = hitboxCenterY - hitboxHalfHeight
  const r = Math.max(0.08, lockedTank.radius)

  const corners = [
    new THREE.Vector3(lockedTank.x - r, hitboxTop, lockedTank.y - r),
    new THREE.Vector3(lockedTank.x + r, hitboxTop, lockedTank.y - r),
    new THREE.Vector3(lockedTank.x - r, hitboxTop, lockedTank.y + r),
    new THREE.Vector3(lockedTank.x + r, hitboxTop, lockedTank.y + r),
    new THREE.Vector3(lockedTank.x - r, hitboxBottom, lockedTank.y - r),
    new THREE.Vector3(lockedTank.x + r, hitboxBottom, lockedTank.y - r),
    new THREE.Vector3(lockedTank.x - r, hitboxBottom, lockedTank.y + r),
    new THREE.Vector3(lockedTank.x + r, hitboxBottom, lockedTank.y + r)
  ]

  const projected = corners
    .map((corner) => corner.clone().project(camera))
    .filter((point) => point.z >= -1 && point.z <= 1)

  if (projected.length === 0) {
    return
  } // end if not visible

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const point of projected) {
    const screen = toScreenPoint(point, width, height)
    minX = Math.min(minX, screen.x)
    maxX = Math.max(maxX, screen.x)
    minY = Math.min(minY, screen.y)
    maxY = Math.max(maxY, screen.y)
  } // end for each projected point

  if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) {
    return
  } // end if invalid screen bounds

  const minBoxSize = 14
  if (maxX - minX < minBoxSize) {
    const pad = (minBoxSize - (maxX - minX)) * 0.5
    minX -= pad
    maxX += pad
  } // end if too narrow
  if (maxY - minY < minBoxSize) {
    const pad = (minBoxSize - (maxY - minY)) * 0.5
    minY -= pad
    maxY += pad
  } // end if too short

  ctx.strokeStyle = 'rgba(255, 220, 0, 0.95)'
  ctx.lineWidth = 2
  drawCornerBox(ctx, minX, minY, maxX, maxY)
} // end function drawHudOverlay

export function createThreeRenderSystem(createArgs: ThreeRendererCreateArgs): ThreeRenderSystem {
  const { canvas, canvasWidth, canvasHeight, mapData, sprites } = createArgs

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setSize(canvasWidth, canvasHeight, false)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)

  const camera = new THREE.PerspectiveCamera(70, canvasWidth / canvasHeight, 0.05, 220)

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  const keyLight = new THREE.DirectionalLight(0x90d6ff, 0.55)
  keyLight.position.set(8, 12, 4)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0xb2ffe0, 0.35)
  fillLight.position.set(-8, 5, -6)
  scene.add(fillLight)

  const muzzleFlashLight = new THREE.PointLight(0xffdd88, 0, 6, 2)
  scene.add(muzzleFlashLight)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x070707, roughness: 1.0, metalness: 0 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.set(MAP_WIDTH / 2, 0, MAP_HEIGHT / 2)
  scene.add(ground)

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d57f0,
    roughness: 0.85,
    metalness: 0.1
  })
  const boundaryMaterial = new THREE.MeshStandardMaterial({
    color: 0x173fb8,
    roughness: 0.88,
    metalness: 0.08
  })

  const wallGeometry = new THREE.BoxGeometry(1, WORLD_WALL_HEIGHT, 1)
  for (let row = 0; row < MAP_HEIGHT; row += 1) {
    for (let col = 0; col < MAP_WIDTH; col += 1) {
      if (getCell(mapData, col, row) === 0) {
        continue
      } // end if empty map cell

      const boundary = row === 0 || col === 0 || row === MAP_HEIGHT - 1 || col === MAP_WIDTH - 1
      const wall = new THREE.Mesh(wallGeometry, boundary ? boundaryMaterial : wallMaterial)
      wall.position.set(col + 0.5, WORLD_WALL_HEIGHT / 2, row + 0.5)
      scene.add(wall)
    } // end for each column
  } // end for each row

  const decorGroup = new THREE.Group()
  scene.add(decorGroup)
  for (const sprite of sprites) {
    if (sprite.type === 'tree') {
      const tree = createTreeMesh(sprite.radius)
      tree.position.set(sprite.x, 0, sprite.y)
      decorGroup.add(tree)
      continue
    } // end if tree

    const rock = createRockMesh(sprite.radius)
    rock.position.set(sprite.x, Math.max(0.15, sprite.radius * 0.55), sprite.y)
    decorGroup.add(rock)
  } // end for each sprite

  const enemyGroup = new THREE.Group()
  scene.add(enemyGroup)
  const enemyPool: THREE.Mesh[] = []

  const tankGroup = new THREE.Group()
  scene.add(tankGroup)
  const tankMeshes = new Map<number, THREE.Group>()

  const bulletGroup = new THREE.Group()
  scene.add(bulletGroup)
  const bulletPool: THREE.Mesh[] = []

  const missileTrailGroup = new THREE.Group()
  scene.add(missileTrailGroup)
  const missileTrailPool: THREE.Group[] = []

  const hudCanvas = document.createElement('canvas')
  hudCanvas.width = canvasWidth
  hudCanvas.height = canvasHeight
  hudCanvas.style.position = 'absolute'
  hudCanvas.style.pointerEvents = 'none'
  hudCanvas.style.left = `${canvas.offsetLeft}px`
  hudCanvas.style.top = `${canvas.offsetTop}px`
  hudCanvas.style.zIndex = '4'
  hudCanvas.setAttribute('aria-hidden', 'true')
  canvas.insertAdjacentElement('afterend', hudCanvas)

  const hudCtx = hudCanvas.getContext('2d')
  if (!hudCtx) {
    throw new Error('Failed to acquire HUD 2D context.')
  } // end if no HUD context

  const scratchVec = new THREE.Vector3()

  return {
    resize(nextWidth: number, nextHeight: number): void {
      camera.aspect = nextWidth / Math.max(1, nextHeight)
      camera.updateProjectionMatrix()
      renderer.setSize(nextWidth, nextHeight, false)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      hudCanvas.width = nextWidth
      hudCanvas.height = nextHeight
      hudCanvas.style.left = `${canvas.offsetLeft}px`
      hudCanvas.style.top = `${canvas.offsetTop}px`
    },
    renderFrame(args: ThreeRenderFrameArgs): void {
      const {
        enemies,
        tanks,
        bullets,
        player,
        muzzleFlashAlpha,
        lockedTankId,
        lockOnWindowWidthPercent,
        lockOnWindowHeightPercent
      } = args

      const playerZ = Math.max(0, player.z ?? 0)
      const cameraY = playerZ + PLAYER_EYE_HEIGHT
      const cosPitch = Math.cos(player.pitch)

      camera.position.set(player.x, cameraY, player.y)
      scratchVec.set(
        Math.cos(player.angle) * cosPitch,
        -Math.sin(player.pitch),
        Math.sin(player.angle) * cosPitch
      )
      camera.lookAt(camera.position.clone().add(scratchVec))

      muzzleFlashLight.position.set(camera.position.x, camera.position.y - 0.03, camera.position.z)
      muzzleFlashLight.intensity = Math.max(0, muzzleFlashAlpha) * 2.2

      const aliveEnemies = enemies.filter((enemy) => enemy.alive)
      syncPool(aliveEnemies.length, enemyPool, enemyGroup, createEnemyMesh)
      for (const [index, enemy] of aliveEnemies.entries()) {
        const mesh = enemyPool[index]
        if (!mesh) {
          continue
        } // end if pool mismatch

        mesh.position.set(enemy.x, 0.55, enemy.y)
      } // end for each enemy

      const liveTankIds = new Set<number>()
      for (const tank of tanks) {
        if (!tank.alive && tank.explosionIntensity <= 0) {
          continue
        } // end if tank fully inactive

        liveTankIds.add(tank.id)
        let tankMesh = tankMeshes.get(tank.id)
        if (!tankMesh) {
          tankMesh = createTankMesh()
          tankMeshes.set(tank.id, tankMesh)
          tankGroup.add(tankMesh)
        } // end if tank mesh needs creation

        const baseHeight = Math.max(0, tank.height)
        tankMesh.position.set(tank.x, baseHeight, tank.y)
        tankMesh.rotation.y = -tank.angle + Math.PI / 2
        tankMesh.visible = tank.alive || tank.explosionIntensity > 0

        const body = tankMesh.children[0] as THREE.Mesh
        const bodyMaterial = body.material as THREE.MeshStandardMaterial
        bodyMaterial.color.setHex(tank.id === lockedTankId ? 0xffcb2f : 0x8f1a1a)

        const explosionMesh = tankMesh.getObjectByName('explosion') as THREE.Mesh | null
        if (explosionMesh && explosionMesh.material instanceof THREE.MeshBasicMaterial) {
          if (tank.explosionIntensity > 0) {
            explosionMesh.visible = true
            explosionMesh.scale.setScalar(0.8 + (1 - tank.explosionIntensity) * 1.7)
            explosionMesh.material.opacity = Math.max(0, tank.explosionIntensity * 0.82)
          } else {
            explosionMesh.visible = false
            explosionMesh.material.opacity = 0
          } // end if explosion intensity active
        } // end if explosion mesh exists
      } // end for each tank

      for (const [tankId, tankMesh] of tankMeshes.entries()) {
        if (liveTankIds.has(tankId)) {
          continue
        } // end if still active this frame

        tankGroup.remove(tankMesh)
        tankMeshes.delete(tankId)
      } // end for each stale tank

      const aliveBullets = bullets.filter((bullet) => bullet.alive)
      syncPool(aliveBullets.length, bulletPool, bulletGroup, createBulletMesh)
      syncPool(aliveBullets.length, missileTrailPool, missileTrailGroup, createMissileTrailPuffs)
      for (const [index, bullet] of aliveBullets.entries()) {
        const mesh = bulletPool[index]
        const trailPuffs = missileTrailPool[index]
        if (!mesh) {
          continue
        } // end if pool mismatch

        if (mesh.material instanceof THREE.MeshBasicMaterial) {
          if (bullet.kind === 'missile') {
            mesh.material.color.setHex(0xffc96a)
          } else {
            mesh.material.color.setHex(0xfff2b0)
          } // end if missile or ballistic visual
        } // end if basic material

        const renderedRadius = bullet.kind === 'missile'
          ? Math.max(0.08, bullet.radius)
          : Math.max(0.03, bullet.radius * 0.55)
        mesh.scale.setScalar(renderedRadius / 0.05)

        const horizontalDist = bullet.distance
        const bulletY = bullet.zOrigin - Math.sin(bullet.pitch) * horizontalDist
        mesh.position.set(
          bullet.x,
          Math.max(0.04, bulletY),
          bullet.y
        )

        if (trailPuffs) {
          const trail = bullet.kind === 'missile' ? bullet.trail : []
          if (trail.length >= 2) {
            trailPuffs.visible = true
            for (let pointIndex = 0; pointIndex < trailPuffs.children.length; pointIndex += 1) {
              const puff = trailPuffs.children[pointIndex]
              if (!(puff instanceof THREE.Mesh) || !(puff.material instanceof THREE.MeshBasicMaterial)) {
                continue
              } // end if puff child invalid

              const sourceIndex = Math.max(0, trail.length - 1 - pointIndex)
              const point = trail[sourceIndex]
              if (!point) {
                puff.visible = false
                continue
              } // end if no matching trail point

              const age = pointIndex / Math.max(1, trailPuffs.children.length - 1)
              const puffScale = (renderedRadius / 0.12) * (1.05 + age * 2.4)
              puff.visible = true
              puff.position.set(point.x, point.y + 0.01 + age * 0.04, point.z)
              puff.scale.setScalar(puffScale)
              puff.material.opacity = Math.max(0.12, 0.55 - age * 0.34)
            } // end for each trail puff
          } else {
            trailPuffs.visible = false
            for (const puff of trailPuffs.children) {
              puff.visible = false
            } // end for each puff
          } // end if trail has enough points
        } // end if trail puffs exist
      } // end for each bullet

      renderer.render(scene, camera)
      drawHudOverlay(
        hudCtx,
        hudCanvas.width,
        hudCanvas.height,
        camera,
        tanks,
        lockedTankId,
        lockOnWindowWidthPercent,
        lockOnWindowHeightPercent
      )
    },
    dispose(): void {
      renderer.dispose()
      hudCanvas.remove()
    }
  }
} // end function createThreeRenderSystem
