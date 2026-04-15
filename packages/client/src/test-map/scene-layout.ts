import { MAP_HEIGHT, MAP_WIDTH } from './constants.js'
import type { SpriteObject } from './types.js'

interface SceneWallSpan {
  colStart: number
  colEnd: number
  rowStart: number
  rowEnd: number
} // end interface SceneWallSpan

const INTERIOR_WALL_SPANS: SceneWallSpan[] = [
  { colStart: 4, colEnd: 12, rowStart: 8, rowEnd: 8 },
  { colStart: 18, colEnd: 28, rowStart: 22, rowEnd: 22 },
  { colStart: 16, colEnd: 16, rowStart: 4, rowEnd: 14 },
  { colStart: 6, colEnd: 6, rowStart: 14, rowEnd: 24 },
  { colStart: 24, colEnd: 24, rowStart: 5, rowEnd: 10 }
]

const SCENE_SPRITES: SpriteObject[] = [
  { x: 5.5, y: 5.5, type: 'tree', radius: 0.35 },
  { x: 10.5, y: 12.5, type: 'tree', radius: 0.35 },
  { x: 20.5, y: 6.5, type: 'tree', radius: 0.35 },
  { x: 27.5, y: 14.5, type: 'tree', radius: 0.35 },
  { x: 14.5, y: 20.5, type: 'tree', radius: 0.35 },
  { x: 22.5, y: 27.5, type: 'tree', radius: 0.35 },
  { x: 8.5, y: 26.5, type: 'tree', radius: 0.35 },
  { x: 17.5, y: 17.5, type: 'tree', radius: 0.35 },
  { x: 12.5, y: 5.5, type: 'rock', radius: 0.45 },
  { x: 7.5, y: 11.5, type: 'rock', radius: 0.45 },
  { x: 19.5, y: 14.5, type: 'rock', radius: 0.45 },
  { x: 25.5, y: 20.5, type: 'rock', radius: 0.45 },
  { x: 13.5, y: 25.5, type: 'rock', radius: 0.45 },
  { x: 28.5, y: 8.5, type: 'rock', radius: 0.45 }
]

function setCell(mapData: Uint8Array, col: number, row: number, value: number): void {
  if (col >= 0 && col < MAP_WIDTH && row >= 0 && row < MAP_HEIGHT) {
    mapData[row * MAP_WIDTH + col] = value
  } // end if in bounds
} // end function setCell

export function createSceneMapData(): Uint8Array {
  const mapData = new Uint8Array(MAP_WIDTH * MAP_HEIGHT)

  for (let col = 0; col < MAP_WIDTH; col += 1) {
    setCell(mapData, col, 0, 1)
    setCell(mapData, col, MAP_HEIGHT - 1, 1)
  } // end for map width boundaries

  for (let row = 0; row < MAP_HEIGHT; row += 1) {
    setCell(mapData, 0, row, 1)
    setCell(mapData, MAP_WIDTH - 1, row, 1)
  } // end for map height boundaries

  for (const span of INTERIOR_WALL_SPANS) {
    for (let row = span.rowStart; row <= span.rowEnd; row += 1) {
      for (let col = span.colStart; col <= span.colEnd; col += 1) {
        setCell(mapData, col, row, 1)
      } // end for each wall col
    } // end for each wall row
  } // end for each interior wall span

  return mapData
} // end function createSceneMapData

export function createSceneSprites(): SpriteObject[] {
  return SCENE_SPRITES.map((sprite) => ({ ...sprite }))
} // end function createSceneSprites
