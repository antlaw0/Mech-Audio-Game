import {
  MAP_HEIGHT,
  MAP_WIDTH,
  PLAYER_HEIGHT,
  type SpriteObject,
  type WorldState
} from '@mech-audio/shared'

function setCell(mapData: Uint8Array, col: number, row: number, value: number): void {
  if (col >= 0 && col < MAP_WIDTH && row >= 0 && row < MAP_HEIGHT) {
    mapData[row * MAP_WIDTH + col] = value
  } // end if in bounds
} // end function setCell

function createMapData(): Uint8Array {
  const mapData = new Uint8Array(MAP_WIDTH * MAP_HEIGHT)

  for (let i = 0; i < MAP_WIDTH; i += 1) {
    setCell(mapData, i, 0, 1)
    setCell(mapData, i, MAP_HEIGHT - 1, 1)
    setCell(mapData, 0, i, 1)
    setCell(mapData, MAP_WIDTH - 1, i, 1)
  } // end for i

  for (let col = 4; col <= 12; col += 1) {
    setCell(mapData, col, 8, 1)
  } // end for col

  for (let col = 18; col <= 28; col += 1) {
    setCell(mapData, col, 22, 1)
  } // end for col

  for (let row = 4; row <= 14; row += 1) {
    setCell(mapData, 16, row, 1)
  } // end for row

  for (let row = 14; row <= 24; row += 1) {
    setCell(mapData, 6, row, 1)
  } // end for row

  for (let row = 5; row <= 10; row += 1) {
    setCell(mapData, 24, row, 1)
  } // end for row

  return mapData
} // end function createMapData

function createSprites(): SpriteObject[] {
  return [
    { id: 't1', x: 5.5, y: 5.5, z: 0, type: 'tree', radius: 0.35 },
    { id: 't2', x: 10.5, y: 12.5, z: 0, type: 'tree', radius: 0.35 },
    { id: 't3', x: 20.5, y: 6.5, z: 0, type: 'tree', radius: 0.35 },
    { id: 't4', x: 27.5, y: 14.5, z: 0, type: 'tree', radius: 0.35 },
    { id: 't5', x: 14.5, y: 20.5, z: 0, type: 'tree', radius: 0.35 },
    { id: 't6', x: 22.5, y: 27.5, z: 0, type: 'tree', radius: 0.35 },
    { id: 't7', x: 8.5, y: 26.5, z: 0, type: 'tree', radius: 0.35 },
    { id: 't8', x: 17.5, y: 17.5, z: 0, type: 'tree', radius: 0.35 },
    { id: 'r1', x: 12.5, y: 5.5, z: 0, type: 'rock', radius: 0.45 },
    { id: 'r2', x: 7.5, y: 11.5, z: 0, type: 'rock', radius: 0.45 },
    { id: 'r3', x: 19.5, y: 14.5, z: 0, type: 'rock', radius: 0.45 },
    { id: 'r4', x: 25.5, y: 20.5, z: 0, type: 'rock', radius: 0.45 },
    { id: 'r5', x: 13.5, y: 25.5, z: 0, type: 'rock', radius: 0.45 },
    { id: 'r6', x: 28.5, y: 8.5, z: 0, type: 'rock', radius: 0.45 }
  ]
} // end function createSprites

export function createWorldState(): WorldState {
  return {
    tick: 0,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    mapData: createMapData(),
    sprites: createSprites(),
    players: {
      host: {
        id: 'host',
        x: 16.5,
        y: 16.5,
        z: PLAYER_HEIGHT,
        angle: 0,
        pitch: 0
      } // end object host
    } // end object players
  } // end object world state
} // end function createWorldState
