import { MAP_HEIGHT, MAP_WIDTH } from './constants.js'

function setCell(mapData: Uint8Array, col: number, row: number, value: number): void {
  if (col >= 0 && col < MAP_WIDTH && row >= 0 && row < MAP_HEIGHT) {
    mapData[row * MAP_WIDTH + col] = value
  } // end if in bounds
} // end function setCell

export function createMapData(): Uint8Array {
  const mapData = new Uint8Array(MAP_WIDTH * MAP_HEIGHT)

  for (let i = 0; i < MAP_WIDTH; i += 1) {
    setCell(mapData, i, 0, 1)
    setCell(mapData, i, MAP_HEIGHT - 1, 1)
    setCell(mapData, 0, i, 1)
    setCell(mapData, MAP_WIDTH - 1, i, 1)
  } // end for boundary walls

  for (let col = 4; col <= 12; col += 1) {
    setCell(mapData, col, 8, 1)
  } // end for blue wall segment 1

  for (let col = 18; col <= 28; col += 1) {
    setCell(mapData, col, 22, 1)
  } // end for blue wall segment 2

  for (let row = 4; row <= 14; row += 1) {
    setCell(mapData, 16, row, 1)
  } // end for vertical wall segment 1

  for (let row = 14; row <= 24; row += 1) {
    setCell(mapData, 6, row, 1)
  } // end for vertical wall segment 2

  for (let row = 5; row <= 10; row += 1) {
    setCell(mapData, 24, row, 1)
  } // end for vertical wall segment 3

  return mapData
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
