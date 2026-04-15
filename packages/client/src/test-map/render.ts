import { FOV, HALF_FOV } from './constants.js'
import { isBoundaryCell } from './map-data.js'
import { calculateProjectionPlane, castRay } from './raycast.js'
import { renderRock, renderTree } from './render-sprites.js'
import type { Bullet, EnemyRender, Player, SpriteObject, TankRender } from './types.js'

interface RenderFrameArgs {
  ctx: CanvasRenderingContext2D
  canvasWidth: number
  canvasHeight: number
  mapData: Uint8Array
  sprites: SpriteObject[]
  enemies: EnemyRender[]
  tanks: TankRender[]
  bullets: Bullet[]
  player: Player
  zBuffer: Float32Array
  muzzleFlashAlpha: number
  lockedTankId: number | null
} // end interface RenderFrameArgs

export function renderFrame(args: RenderFrameArgs): void {
  const { ctx, canvasWidth, canvasHeight, mapData, sprites, enemies, tanks, bullets, player, zBuffer, muzzleFlashAlpha, lockedTankId } = args
  const projectionPlane = calculateProjectionPlane(canvasWidth)
  const pitchOffset = Math.tan(player.pitch) * projectionPlane
  const centerY = canvasHeight / 2 + pitchOffset
  const crosshairY = canvasHeight / 2

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, canvasWidth, Math.max(0, centerY))

  ctx.fillStyle = '#111111'
  ctx.fillRect(0, Math.max(0, centerY), canvasWidth, Math.max(0, canvasHeight - centerY))

  for (let col = 0; col < canvasWidth; col += 1) {
    const rayAngle = player.angle - HALF_FOV + (col / canvasWidth) * FOV
    const ray = castRay(mapData, player, rayAngle)

    const distance = Math.max(ray.dist, 0.01)
    zBuffer[col] = distance

    const wallHeight = Math.floor(projectionPlane / distance)
    
    // When flying, anchor walls to the ground plane below altitude, not to centerY
    let wallBaseY = centerY
    if (player.isFlying && (player.z ?? 0) > 0.1) {
      wallBaseY = Math.floor(centerY + ((player.z ?? 0) / distance) * projectionPlane)
    }

    const top = Math.floor(wallBaseY - wallHeight)
    const bottom = wallBaseY

    let red = 0
    let green = 0
    let blue = 0

    if (ray.hit && isBoundaryCell(ray.mapCol, ray.mapRow)) {
      red = 220
      green = 200
      blue = 0
    } else if (ray.hit) {
      red = 30
      green = 80
      blue = 220
    } else {
      continue
    } // end if wall color

    if (ray.side === 1) {
      red = Math.floor(red * 0.65)
      green = Math.floor(green * 0.65)
      blue = Math.floor(blue * 0.65)
    } // end if y-side shade

    const clampedTop = Math.max(top, 0)
    const clampedBottom = Math.min(bottom, canvasHeight)
    const drawHeight = clampedBottom - clampedTop
    if (drawHeight <= 0) {
      continue
    } // end if nothing to draw

    if (player.isFlying) {
      // Distance-based alpha: walls fade with distance; nearby walls remain mostly opaque
      const MAX_WALL_FOG_DIST = 14
      const distAlpha = Math.max(0.12, 1.0 - distance / MAX_WALL_FOG_DIST)
      // Vertical gradient: top of wall fades to near-transparent, lower portion stays solid
      const grad = ctx.createLinearGradient(0, clampedTop, 0, clampedBottom)
      grad.addColorStop(0, `rgba(${red},${green},${blue},${(distAlpha * 0.15).toFixed(3)})`)
      grad.addColorStop(0.4, `rgba(${red},${green},${blue},${distAlpha.toFixed(3)})`)
      grad.addColorStop(1, `rgba(${red},${green},${blue},${distAlpha.toFixed(3)})`)
      ctx.fillStyle = grad
    } else {
      ctx.fillStyle = `rgb(${red},${green},${blue})`
    } // end if flying wall fog

    ctx.fillRect(col, clampedTop, 1, drawHeight)
  } // end for wall columns

  const sortedSprites = sprites
    .map((sprite) => {
      const dx = sprite.x - player.x
      const dy = sprite.y - player.y
      const dist = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx) - player.angle
      return { sprite, dist, angle }
    })
    .sort((a, b) => b.dist - a.dist)

  for (const entry of sortedSprites) {
    if (entry.dist < 0.1) {
      continue
    } // end if near zero distance

    let angle = entry.angle
    while (angle > Math.PI) {
      angle -= 2 * Math.PI
    } // end while normalize positive angle

    while (angle < -Math.PI) {
      angle += 2 * Math.PI
    } // end while normalize negative angle

    if (Math.abs(angle) > HALF_FOV + 0.3) {
      continue
    } // end if out of view

    const screenX = Math.floor((0.5 + angle / FOV) * canvasWidth)
    const spriteArgs = {
      ctx,
      screenX,
      dist: entry.dist,
      projectionPlane,
      zBuffer,
      canvasWidth,
      canvasHeight,
      centerY,
      playerAltitude: player.isFlying ? (player.z ?? 0) : 0,
      sprite: entry.sprite
    } // end object spriteArgs

    if (entry.sprite.type === 'tree') {
      renderTree(spriteArgs)
    } else {
      renderRock(spriteArgs)
    } // end if sprite type
  } // end for each sprite

  const sortedEnemies = enemies
    .filter((enemy) => enemy.alive)
    .map((enemy) => {
      const dx = enemy.x - player.x
      const dy = enemy.y - player.y
      const dist = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx) - player.angle
      return { enemy, dist, angle }
    })
    .sort((a, b) => b.dist - a.dist)

  for (const entry of sortedEnemies) {
    if (entry.dist < 0.08) {
      continue
    } // end if near zero distance

    let angle = entry.angle
    while (angle > Math.PI) {
      angle -= 2 * Math.PI
    } // end while normalize positive angle

    while (angle < -Math.PI) {
      angle += 2 * Math.PI
    } // end while normalize negative angle

    if (Math.abs(angle) > HALF_FOV + 0.22) {
      continue
    } // end if enemy out of view

    const screenX = Math.floor((0.5 + angle / FOV) * canvasWidth)
    const zAtCol = screenX >= 0 && screenX < canvasWidth ? zBuffer[screenX] : undefined
    if (zAtCol !== undefined && zAtCol < entry.dist) {
      continue
    } // end if enemy occluded by wall

    const bodyHeight = Math.max(14, (projectionPlane * 0.95) / entry.dist)
    const bodyWidth = Math.max(8, bodyHeight * 0.42)
    const bodyY = centerY + bodyHeight * 0.2

    ctx.fillStyle = 'rgba(210, 40, 40, 0.95)'
    ctx.beginPath()
    ctx.ellipse(screenX, bodyY, bodyWidth, bodyHeight, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(255, 215, 180, 0.95)'
    ctx.beginPath()
    ctx.arc(screenX, bodyY - bodyHeight * 0.95, Math.max(4, bodyWidth * 0.45), 0, Math.PI * 2)
    ctx.fill()
  } // end for each enemy

  // --- Render tanks ---
  const sortedTanks = tanks
    .filter((tank) => tank.alive || tank.explosionIntensity > 0)
    .map((tank) => {
      const dx = tank.x - player.x
      const dy = tank.y - player.y
      const dist = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx) - player.angle
      return { tank, dist, angle }
    })
    .sort((a, b) => b.dist - a.dist)

  for (const entry of sortedTanks) {
    if (entry.dist < 0.15) {
      continue
    } // end if tank too close

    let angle = entry.angle
    while (angle > Math.PI) {
      angle -= 2 * Math.PI
    } // end while normalize positive angle

    while (angle < -Math.PI) {
      angle += 2 * Math.PI
    } // end while normalize negative angle

    if (Math.abs(angle) > HALF_FOV + 0.3) {
      continue
    } // end if tank out of view

    const screenX = Math.floor((0.5 + angle / FOV) * canvasWidth)
    const zAtCol = screenX >= 0 && screenX < canvasWidth ? zBuffer[screenX] : undefined
    if (zAtCol !== undefined && zAtCol < entry.dist) {
      continue
    } // end if occluded by wall

    const bodyHeight = Math.max(20, (projectionPlane * 1.2) / entry.dist)
    const bodyWidth = Math.max(12, bodyHeight * 0.5)
    const bodyY = centerY + bodyHeight * 0.15 - (entry.tank.height / entry.dist) * projectionPlane

    if (entry.tank.alive) {
      // Tank body is larger than enemy.
      ctx.fillStyle = 'rgba(180, 30, 30, 0.95)'
      ctx.beginPath()
      ctx.ellipse(screenX, bodyY, bodyWidth, bodyHeight * 0.65, 0, 0, Math.PI * 2)
      ctx.fill()

      // Tank turret (smaller rectangle rotated by facing angle)
      const turretSize = bodyWidth * 0.6
      const turretY = bodyY - bodyHeight * 0.2
      ctx.save()
      ctx.translate(screenX, turretY)
      ctx.rotate(entry.tank.angle)
      ctx.fillStyle = 'rgba(160, 20, 20, 0.95)'
      ctx.fillRect(-turretSize * 0.3, -turretSize * 0.25, turretSize * 0.6, turretSize * 0.5)
      ctx.restore()

      if (entry.tank.health < entry.tank.maxHealth) {
        const healthPercent = entry.tank.health / entry.tank.maxHealth
        const barWidth = bodyWidth * 1.5
        const barHeight = 3
        ctx.fillStyle = 'rgba(100, 100, 100, 0.7)'
        ctx.fillRect(screenX - barWidth / 2, bodyY - bodyHeight * 0.8, barWidth, barHeight)
        ctx.fillStyle = 'rgba(220, 80, 80, 0.9)'
        ctx.fillRect(screenX - barWidth / 2, bodyY - bodyHeight * 0.8, barWidth * healthPercent, barHeight)
      } // end if tank not at full health
        if (entry.tank.id === lockedTankId) {
          const bHalf = bodyWidth * 1.4
          const bTop = bodyY - bodyHeight * 0.85
          const bBottom = bodyY + bodyHeight * 0.25
          const arm = bHalf * 0.4
          ctx.strokeStyle = 'rgba(255, 220, 0, 0.92)'
          ctx.lineWidth = 2
          ctx.beginPath()
          // top-left L
          ctx.moveTo(screenX - bHalf + arm, bTop)
          ctx.lineTo(screenX - bHalf, bTop)
          ctx.lineTo(screenX - bHalf, bTop + arm)
          // top-right L
          ctx.moveTo(screenX + bHalf - arm, bTop)
          ctx.lineTo(screenX + bHalf, bTop)
          ctx.lineTo(screenX + bHalf, bTop + arm)
          // bottom-left L
          ctx.moveTo(screenX - bHalf, bBottom - arm)
          ctx.lineTo(screenX - bHalf, bBottom)
          ctx.lineTo(screenX - bHalf + arm, bBottom)
          // bottom-right L
          ctx.moveTo(screenX + bHalf, bBottom - arm)
          ctx.lineTo(screenX + bHalf, bBottom)
          ctx.lineTo(screenX + bHalf - arm, bBottom)
          ctx.stroke()
        } // end if tank is locked on target
    } // end if alive tank model

    if (entry.tank.explosionIntensity > 0) {
      const t = entry.tank.explosionIntensity
      const blastRadius = Math.max(16, bodyWidth * (1.3 + (1 - t) * 1.9))

      const outer = ctx.createRadialGradient(screenX, bodyY, 0, screenX, bodyY, blastRadius)
      outer.addColorStop(0, `rgba(255,240,170,${0.6 * t})`)
      outer.addColorStop(0.4, `rgba(255,120,30,${0.7 * t})`)
      outer.addColorStop(1, 'rgba(90,20,0,0)')
      ctx.fillStyle = outer
      ctx.beginPath()
      ctx.arc(screenX, bodyY, blastRadius, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = `rgba(50,50,50,${0.45 * t})`
      ctx.beginPath()
      ctx.ellipse(screenX, bodyY + bodyHeight * 0.1, bodyWidth * 0.7, bodyHeight * 0.35, 0, 0, Math.PI * 2)
      ctx.fill()
    } // end if explosion active
  } // end for each tank

  const muzzleX = canvasWidth / 2
  const muzzleY = canvasHeight - 34
  for (const bullet of bullets) {
    if (!bullet || !bullet.alive) {
      continue
    } // end if dead bullet

    const dx = bullet.x - player.x
    const dy = bullet.y - player.y

    const forward = dx * Math.cos(player.angle) + dy * Math.sin(player.angle)
    if (forward <= 0.01) {
      continue
    } // end if bullet behind camera

    const right = dx * -Math.sin(player.angle) + dy * Math.cos(player.angle)
    const screenX = canvasWidth / 2 + (right / forward) * projectionPlane

    const bulletHeight = 0.5 + Math.tan(bullet.pitch) * bullet.distance
    const verticalOffset = (bulletHeight - 0.5) / forward
    const screenY = centerY - verticalOffset * projectionPlane

    if (screenX < -30 || screenX > canvasWidth + 30 || screenY < -30 || screenY > canvasHeight + 30) {
      continue
    } // end if bullet off-screen

    const xCol = Math.floor(screenX)
    const wallDistance = xCol >= 0 && xCol < canvasWidth ? zBuffer[xCol] : undefined
    if (wallDistance !== undefined && wallDistance < forward) {
      continue
    } // end if occluded by wall

    ctx.strokeStyle = 'rgba(255, 235, 160, 0.85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(muzzleX, muzzleY)
    ctx.lineTo(screenX, screenY)
    ctx.stroke()

    ctx.fillStyle = 'rgba(255, 255, 210, 0.95)'
    ctx.beginPath()
    ctx.arc(screenX, screenY, 3.2, 0, Math.PI * 2)
    ctx.fill()
  } // end for each bullet

  ctx.strokeStyle = 'rgba(0, 200, 255, 0.7)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(canvasWidth / 2 - 8, crosshairY)
  ctx.lineTo(canvasWidth / 2 + 8, crosshairY)
  ctx.moveTo(canvasWidth / 2, crosshairY - 8)
  ctx.lineTo(canvasWidth / 2, crosshairY + 8)
  ctx.stroke()

  if (muzzleFlashAlpha > 0) {
    const flashX = canvasWidth / 2
    const flashY = canvasHeight - 60
    const flashRadius = 70 * muzzleFlashAlpha
    const grad = ctx.createRadialGradient(flashX, flashY, 0, flashX, flashY, flashRadius)
    grad.addColorStop(0, `rgba(255,255,220,${muzzleFlashAlpha})`)
    grad.addColorStop(0.35, `rgba(255,160,20,${muzzleFlashAlpha * 0.85})`)
    grad.addColorStop(1, 'rgba(255,60,0,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(flashX, flashY, flashRadius * 1.6, flashRadius * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
  } // end if muzzle flash active
} // end function renderFrame
