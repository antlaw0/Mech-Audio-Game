import type { NavigationPoi } from './scene-layout.js'
import type { EnemyRender, Player, SpriteObject, CombatEnemyRender } from './types.js'

interface WorldMapOverlayCreateArgs {
  mapData: Uint8Array
  sprites: SpriteObject[]
  pois: NavigationPoi[]
  mapWidth: number
  mapHeight: number
} // end interface WorldMapOverlayCreateArgs

interface WorldMapRenderArgs {
  player: Player
  enemies: EnemyRender[]
  tanks: CombatEnemyRender[]
} // end interface WorldMapRenderArgs

interface WorldMapOverlaySystem {
  isVisible: () => boolean
  setVisible: (visible: boolean) => void
  renderFrame: (args: WorldMapRenderArgs) => void
  dispose: () => void
} // end interface WorldMapOverlaySystem

interface ScreenPoint {
  x: number
  y: number
} // end interface ScreenPoint

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
} // end function clamp

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  color: string
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(length * 0.6, 0)
  ctx.lineTo(-length * 0.45, length * 0.33)
  ctx.lineTo(-length * 0.2, 0)
  ctx.lineTo(-length * 0.45, -length * 0.33)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
} // end function drawArrow

export function createWorldMapOverlay(args: WorldMapOverlayCreateArgs): WorldMapOverlaySystem {
  const { mapData, sprites, pois, mapWidth, mapHeight } = args

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.position = 'fixed'
  canvas.style.inset = '0'
  canvas.style.width = '100vw'
  canvas.style.height = '100vh'
  canvas.style.zIndex = '120'
  canvas.style.pointerEvents = 'none'
  canvas.style.cursor = 'default'
  canvas.style.display = 'none'
  canvas.style.background = '#000'
  document.body.appendChild(canvas)

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Expected world map overlay canvas context.')
  } // end if canvas context missing

  const staticLayer = document.createElement('canvas')
  staticLayer.width = mapWidth
  staticLayer.height = mapHeight
  const staticContext = staticLayer.getContext('2d')
  if (!staticContext) {
    throw new Error('Expected static world map canvas context.')
  } // end if static context missing

  const imageData = staticContext.createImageData(mapWidth, mapHeight)
  for (let index = 0; index < mapData.length; index += 1) {
    const pixelIndex = index * 4
    const isWall = mapData[index] !== 0
    const shade = isWall ? 40 : 0
    imageData.data[pixelIndex] = shade
    imageData.data[pixelIndex + 1] = shade
    imageData.data[pixelIndex + 2] = shade
    imageData.data[pixelIndex + 3] = 255
  } // end for each world cell
  staticContext.putImageData(imageData, 0, 0)

  for (const sprite of sprites) {
    const radius = Math.max(1.2, sprite.radius * 2.8)
    staticContext.fillStyle = sprite.type === 'tree'
      ? 'rgba(42, 123, 68, 0.88)'
      : sprite.type === 'rock'
        ? 'rgba(128, 132, 142, 0.9)'
        : 'rgba(218, 200, 128, 0.96)'
    staticContext.beginPath()
    staticContext.arc(sprite.x, sprite.y, radius, 0, Math.PI * 2)
    staticContext.fill()
  } // end for each sprite

  let isVisible = false

  const setVisible = (visible: boolean): void => {
    isVisible = visible
    canvas.style.display = visible ? 'block' : 'none'
    canvas.style.pointerEvents = visible ? 'auto' : 'none'
  } // end function setVisible

  const projectWorldPoint = (
    worldX: number,
    worldY: number,
    left: number,
    top: number,
    worldPixelWidth: number,
    worldPixelHeight: number
  ): ScreenPoint => {
    const clampedX = clamp(worldX, 0, mapWidth)
    const clampedY = clamp(worldY, 0, mapHeight)
    return {
      x: left + (clampedX / mapWidth) * worldPixelWidth,
      y: top + (clampedY / mapHeight) * worldPixelHeight
    }
  } // end function projectWorldPoint

  const renderFrame = (renderArgs: WorldMapRenderArgs): void => {
    if (!isVisible) {
      return
    } // end if hidden

    const cssWidth = Math.max(1, window.innerWidth)
    const cssHeight = Math.max(1, window.innerHeight)
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const requiredWidth = Math.round(cssWidth * dpr)
    const requiredHeight = Math.round(cssHeight * dpr)
    if (canvas.width !== requiredWidth || canvas.height !== requiredHeight) {
      canvas.width = requiredWidth
      canvas.height = requiredHeight
    } // end if canvas backing size changed

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, cssWidth, cssHeight)

    context.fillStyle = '#000'
    context.fillRect(0, 0, cssWidth, cssHeight)

    const outerPadding = 24
    const drawableWidth = Math.max(1, cssWidth - outerPadding * 2)
    const drawableHeight = Math.max(1, cssHeight - outerPadding * 2)
    const worldScale = Math.min(drawableWidth / mapWidth, drawableHeight / mapHeight)

    const worldPixelWidth = mapWidth * worldScale
    const worldPixelHeight = mapHeight * worldScale
    const left = (cssWidth - worldPixelWidth) * 0.5
    const top = (cssHeight - worldPixelHeight) * 0.5

    context.imageSmoothingEnabled = false
    context.drawImage(staticLayer, left, top, worldPixelWidth, worldPixelHeight)
    context.imageSmoothingEnabled = true

    context.strokeStyle = '#1f1f1f'
    context.lineWidth = 2
    context.strokeRect(left, top, worldPixelWidth, worldPixelHeight)

    for (const poi of pois) {
      if (poi.category !== 'cities' && poi.category !== 'towns') {
        continue
      } // end if not a requested map label category

      const marker = projectWorldPoint(poi.x, poi.y, left, top, worldPixelWidth, worldPixelHeight)
      context.fillStyle = poi.category === 'cities' ? '#8ac2ff' : '#b0d7ff'
      context.beginPath()
      context.arc(marker.x, marker.y, 2.8, 0, Math.PI * 2)
      context.fill()

      context.font = '600 13px monospace'
      context.fillStyle = '#d7ebff'
      context.textBaseline = 'bottom'
      context.fillText(poi.name, marker.x + 6, marker.y - 3)
    } // end for each city and town label

    for (const enemy of renderArgs.enemies) {
      if (!enemy.alive) {
        continue
      } // end if enemy is not active
      const point = projectWorldPoint(enemy.x, enemy.y, left, top, worldPixelWidth, worldPixelHeight)
      context.fillStyle = 'rgba(255, 92, 92, 0.78)'
      context.beginPath()
      context.arc(point.x, point.y, 2.2, 0, Math.PI * 2)
      context.fill()
    } // end for each non-directional enemy render point

    for (const tank of renderArgs.tanks) {
      if (!tank.alive) {
        continue
      } // end if tank is not active
      const point = projectWorldPoint(tank.x, tank.y, left, top, worldPixelWidth, worldPixelHeight)
      drawArrow(context, point.x, point.y, tank.angle, 14, '#ff3a3a')
    } // end for each directional enemy

    const playerPoint = projectWorldPoint(renderArgs.player.x, renderArgs.player.y, left, top, worldPixelWidth, worldPixelHeight)
    drawArrow(context, playerPoint.x, playerPoint.y, renderArgs.player.angle, 16, '#26e26a')

    context.fillStyle = '#d4d4d4'
    context.font = '600 14px monospace'
    context.textBaseline = 'top'
    context.fillText('WORLD MAP  |  F2 TO TOGGLE', 20, 14)

    context.font = '12px monospace'
    context.fillStyle = '#8ecf8e'
    context.fillText('PLAYER', 20, 34)
    context.fillStyle = '#ff7b7b'
    context.fillText(`ENEMIES ${renderArgs.tanks.filter((tank) => tank.alive).length}`, 88, 34)
  } // end function renderFrame

  const dispose = (): void => {
    if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas)
    } // end if attached to DOM
  } // end function dispose

  return {
    isVisible: () => isVisible,
    setVisible,
    renderFrame,
    dispose
  }
} // end function createWorldMapOverlay
