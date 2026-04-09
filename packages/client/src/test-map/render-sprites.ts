import type { SpriteObject } from './types.js'

interface SpriteRenderArgs {
  ctx: CanvasRenderingContext2D
  screenX: number
  dist: number
  projectionPlane: number
  zBuffer: Float32Array
  canvasWidth: number
  canvasHeight: number
  centerY: number
  sprite: SpriteObject
} // end interface SpriteRenderArgs

export function renderTree(args: SpriteRenderArgs): void {
  const { ctx, screenX, dist, projectionPlane, zBuffer, canvasWidth, canvasHeight, centerY } = args
  if (dist < 0.1) {
    return
  } // end if too close

  const scale = projectionPlane / dist
  const trunkWidth = Math.floor(0.15 * scale)
  const trunkHeight = Math.floor(0.85 * scale)
  const trunkTop = Math.floor(centerY - trunkHeight * 0.6)
  const trunkLeft = screenX - Math.floor(trunkWidth / 2)

  const canopyRadius = Math.floor(0.35 * scale)
  const canopyCenterX = screenX
  const canopyCenterY = trunkTop - Math.floor(canopyRadius * 0.3)

  const totalWidth = Math.max(trunkWidth, canopyRadius * 2) + 4
  const startCol = screenX - Math.floor(totalWidth / 2)
  const endCol = screenX + Math.floor(totalWidth / 2)

  for (let col = startCol; col <= endCol; col += 1) {
    if (col < 0 || col >= canvasWidth) {
      continue
    } // end if out of view

    const wallDistance = zBuffer[col]
    if (wallDistance !== undefined && wallDistance < dist) {
      continue
    } // end if occluded

    const canopyDx = col - canopyCenterX
    if (Math.abs(canopyDx) <= canopyRadius) {
      const canopyHalfHeight = Math.floor(Math.sqrt(canopyRadius * canopyRadius - canopyDx * canopyDx))
      const canopyTop = canopyCenterY - canopyHalfHeight
      const canopyBottom = canopyCenterY + canopyHalfHeight
      const shade = canopyDx < 0 ? 0.7 : 1.0
      const red = Math.floor(30 * shade)
      const green = Math.floor(140 * shade)
      const blue = Math.floor(30 * shade)

      ctx.fillStyle = `rgb(${red},${green},${blue})`
      ctx.fillRect(col, Math.max(canopyTop, 0), 1, Math.min(canopyBottom, canvasHeight) - Math.max(canopyTop, 0))
    } // end if in canopy

    if (col >= trunkLeft && col < trunkLeft + trunkWidth) {
      const trunkBottom = Math.floor(centerY + trunkHeight * 0.4)
      ctx.fillStyle = '#5C3A1E'
      ctx.fillRect(col, Math.max(trunkTop, 0), 1, Math.min(trunkBottom, canvasHeight) - Math.max(trunkTop, 0))
    } // end if in trunk
  } // end for sprite columns
} // end function renderTree

export function renderRock(args: SpriteRenderArgs): void {
  const { ctx, screenX, dist, projectionPlane, zBuffer, canvasWidth, canvasHeight, centerY } = args
  if (dist < 0.1) {
    return
  } // end if too close

  const scale = projectionPlane / dist
  const ellipseWidth = Math.floor(0.7 * scale)
  const ellipseHeight = Math.floor(0.5 * scale)
  if (ellipseWidth < 1 || ellipseHeight < 1) {
    return
  } // end if too small

  const wallHeight = Math.floor(projectionPlane / dist)
  const floorLine = Math.floor(centerY + wallHeight * 0.5)
  const ellipseTop = floorLine - ellipseHeight

  const startCol = screenX - ellipseWidth
  const endCol = screenX + ellipseWidth

  for (let col = startCol; col <= endCol; col += 1) {
    if (col < 0 || col >= canvasWidth) {
      continue
    } // end if out of bounds

    const wallDistance = zBuffer[col]
    if (wallDistance !== undefined && wallDistance < dist) {
      continue
    } // end if occluded

    const dx = (col - screenX) / ellipseWidth
    const halfHeight = Math.floor(ellipseHeight * Math.sqrt(Math.max(0, 1 - dx * dx)))
    if (halfHeight < 1) {
      continue
    } // end if no visible slice

    const top = ellipseTop
    const bottom = ellipseTop + halfHeight * 2
    const shade = 0.6 + 0.4 * (dx + 1) / 2
    const value = Math.floor(130 * shade)

    ctx.fillStyle = `rgb(${value},${value},${value})`
    ctx.fillRect(col, Math.max(top, 0), 1, Math.min(bottom, canvasHeight) - Math.max(top, 0))
  } // end for rock columns
} // end function renderRock
