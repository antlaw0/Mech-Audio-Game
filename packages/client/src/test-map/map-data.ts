import { MAP_HEIGHT, MAP_WIDTH } from './constants.js'
import { createSceneMapData } from './scene-layout.js'

export function createMapData(): Uint8Array {
  return createSceneMapData()
} // end function createMapData

export function getCell(mapData: Uint8Array, col: number, row: number): number {
  if (col < 0 || col >= MAP_WIDTH || row < 0 || row >= MAP_HEIGHT) {
    return 1
  } // end if out of bounds

  return mapData[row * MAP_WIDTH + col] ?? 1
} // end function getCell

export function isBoundaryCell(col: number, row: number): boolean {
  return col === 0 || col === MAP_WIDTH - 1 || row === 0 || row === MAP_HEIGHT - 1
} // end function isBoundaryCell
