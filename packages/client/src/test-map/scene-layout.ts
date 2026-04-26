import { MAP_HEIGHT, MAP_WIDTH } from './constants.js'
import type { SpriteObject } from './types.js'

interface SceneWallSpan {
  colStart: number
  colEnd: number
  rowStart: number
  rowEnd: number
} // end interface SceneWallSpan

interface RectArea {
  colStart: number
  colEnd: number
  rowStart: number
  rowEnd: number
} // end interface RectArea

interface CityDistrictSpec {
  colStart: number
  rowStart: number
  width: number
  height: number
  avenueWidth: number
  buildingSize: number
  streetWidth: number
} // end interface CityDistrictSpec

export type PoiCategory = 'cities' | 'towns' | 'outposts' | 'other'

export interface NavigationPoi {
  id: string
  name: string
  category: PoiCategory
  x: number
  y: number
} // end interface NavigationPoi

const CITY_DISTRICTS: CityDistrictSpec[] = [
  {
    colStart: 120,
    rowStart: 120,
    width: 250,
    height: 240,
    avenueWidth: 16,
    buildingSize: 20,
    streetWidth: 14
  },
  {
    colStart: 640,
    rowStart: 620,
    width: 230,
    height: 220,
    avenueWidth: 14,
    buildingSize: 18,
    streetWidth: 12
  }
]

const TEST_TOWN_DISTRICT: CityDistrictSpec = {
  colStart: 780,
  rowStart: 210,
  width: 110,
  height: 96,
  avenueWidth: 8,
  buildingSize: 10,
  streetWidth: 6
}

const ALL_URBAN_DISTRICTS: CityDistrictSpec[] = [...CITY_DISTRICTS, TEST_TOWN_DISTRICT]

const NOVA_CITY_CENTER = {
  x: CITY_DISTRICTS[0]!.colStart + CITY_DISTRICTS[0]!.width / 2,
  y: CITY_DISTRICTS[0]!.rowStart + CITY_DISTRICTS[0]!.height / 2
}

const TEST_TOWN_CENTER = {
  x: TEST_TOWN_DISTRICT.colStart + TEST_TOWN_DISTRICT.width / 2,
  y: TEST_TOWN_DISTRICT.rowStart + TEST_TOWN_DISTRICT.height / 2
}

const RADIO_STATION_ALPHA = {
  x: 566,
  y: 178
}

export const TEST_MAP_NAVIGATION_POIS: NavigationPoi[] = [
  {
    id: 'nova-city',
    name: 'NovaCity',
    category: 'cities',
    x: NOVA_CITY_CENTER.x,
    y: NOVA_CITY_CENTER.y
  },
  {
    id: 'test-town',
    name: 'Test Town',
    category: 'towns',
    x: TEST_TOWN_CENTER.x,
    y: TEST_TOWN_CENTER.y
  },
  {
    id: 'radio-station-alpha',
    name: 'Radio Station Alpha',
    category: 'other',
    x: RADIO_STATION_ALPHA.x,
    y: RADIO_STATION_ALPHA.y
  }
]

const DENSE_FOREST_AREA: RectArea = {
  colStart: 700,
  colEnd: 930,
  rowStart: 120,
  rowEnd: 360
}

const PLAYER_SAFE_AREA: RectArea = {
  colStart: 465,
  colEnd: 535,
  rowStart: 465,
  rowEnd: 535
}

const RANDOM_SEED = 0x5eeda11

function setCell(mapData: Uint8Array, col: number, row: number, value: number): void {
  if (col >= 0 && col < MAP_WIDTH && row >= 0 && row < MAP_HEIGHT) {
    mapData[row * MAP_WIDTH + col] = value
  } // end if in bounds
} // end function setCell

function fillWallRect(mapData: Uint8Array, span: SceneWallSpan): void {
  for (let row = span.rowStart; row <= span.rowEnd; row += 1) {
    for (let col = span.colStart; col <= span.colEnd; col += 1) {
      setCell(mapData, col, row, 1)
    } // end for each wall col
  } // end for each wall row
} // end function fillWallRect

function isPointInRect(x: number, y: number, area: RectArea): boolean {
  return x >= area.colStart && x <= area.colEnd && y >= area.rowStart && y <= area.rowEnd
} // end function isPointInRect

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state += 0x6d2b79f5
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  } // end function seeded random generator
} // end function createSeededRandom

function createCityWallSpans(): SceneWallSpan[] {
  const spans: SceneWallSpan[] = []

  for (const district of ALL_URBAN_DISTRICTS) {
    const innerColStart = district.colStart + district.avenueWidth
    const innerColEnd = district.colStart + district.width - district.avenueWidth - 1
    const innerRowStart = district.rowStart + district.avenueWidth
    const innerRowEnd = district.rowStart + district.height - district.avenueWidth - 1
    const step = district.buildingSize + district.streetWidth

    for (let row = innerRowStart; row + district.buildingSize - 1 <= innerRowEnd; row += step) {
      for (let col = innerColStart; col + district.buildingSize - 1 <= innerColEnd; col += step) {
        spans.push({
          colStart: col,
          colEnd: col + district.buildingSize - 1,
          rowStart: row,
          rowEnd: row + district.buildingSize - 1
        })
      } // end for each city block col
    } // end for each city block row
  } // end for each city district

  return spans
} // end function createCityWallSpans

function isInsideAnyUrbanDistrict(x: number, y: number): boolean {
  return ALL_URBAN_DISTRICTS.some((district) => {
    const districtArea: RectArea = {
      colStart: district.colStart,
      colEnd: district.colStart + district.width - 1,
      rowStart: district.rowStart,
      rowEnd: district.rowStart + district.height - 1
    }

    return isPointInRect(x, y, districtArea)
  })
} // end function isInsideAnyUrbanDistrict

function createRockSprites(random: () => number): SpriteObject[] {
  const sprites: SpriteObject[] = []
  const maxAttempts = 1400
  const targetCount = 230

  for (let attempts = 0; attempts < maxAttempts && sprites.length < targetCount; attempts += 1) {
    const x = 2 + random() * (MAP_WIDTH - 4)
    const y = 2 + random() * (MAP_HEIGHT - 4)

    if (isPointInRect(x, y, PLAYER_SAFE_AREA)) {
      continue
    } // end if inside player safe area

    if (isInsideAnyUrbanDistrict(x, y)) {
      continue
    } // end if inside city district

    sprites.push({ x, y, type: 'rock', radius: 0.45 })
  } // end for each random rock attempt

  return sprites
} // end function createRockSprites

function createForestSprites(random: () => number): SpriteObject[] {
  const sprites: SpriteObject[] = []

  for (let row = DENSE_FOREST_AREA.rowStart + 2; row <= DENSE_FOREST_AREA.rowEnd - 2; row += 4) {
    for (let col = DENSE_FOREST_AREA.colStart + 2; col <= DENSE_FOREST_AREA.colEnd - 2; col += 4) {
      if (random() < 0.2) {
        continue
      } // end if skipped forest slot

      const x = col + (random() - 0.5) * 1.5
      const y = row + (random() - 0.5) * 1.5
      sprites.push({ x, y, type: 'tree', radius: 0.35 })
    } // end for each forest col slot
  } // end for each forest row slot

  return sprites
} // end function createForestSprites

function createSparseOpenAreaTrees(random: () => number): SpriteObject[] {
  const sprites: SpriteObject[] = []
  const maxAttempts = 1600
  const targetCount = 140

  for (let attempts = 0; attempts < maxAttempts && sprites.length < targetCount; attempts += 1) {
    const x = 6 + random() * (MAP_WIDTH - 12)
    const y = 6 + random() * (MAP_HEIGHT - 12)

    if (isPointInRect(x, y, PLAYER_SAFE_AREA) || isPointInRect(x, y, DENSE_FOREST_AREA)) {
      continue
    } // end if blocked by reserved area

    if (isInsideAnyUrbanDistrict(x, y)) {
      continue
    } // end if blocked by town

    sprites.push({ x, y, type: 'tree', radius: 0.35 })
  } // end for each sparse tree attempt

  return sprites
} // end function createSparseOpenAreaTrees

export function createSceneMapData(): Uint8Array {
  const mapData = new Uint8Array(MAP_WIDTH * MAP_HEIGHT)
  const cityWallSpans = createCityWallSpans()

  for (let col = 0; col < MAP_WIDTH; col += 1) {
    setCell(mapData, col, 0, 1)
    setCell(mapData, col, MAP_HEIGHT - 1, 1)
  } // end for map width boundaries

  for (let row = 0; row < MAP_HEIGHT; row += 1) {
    setCell(mapData, 0, row, 1)
    setCell(mapData, MAP_WIDTH - 1, row, 1)
  } // end for map height boundaries

  for (const span of cityWallSpans) {
    fillWallRect(mapData, span)
  } // end for each city wall span

  return mapData
} // end function createSceneMapData

export function createSceneSprites(): SpriteObject[] {
  const random = createSeededRandom(RANDOM_SEED)
  const forestTrees = createForestSprites(random)
  const sparseTrees = createSparseOpenAreaTrees(random)
  const rocks = createRockSprites(random)
  const landmarks: SpriteObject[] = [
    {
      x: RADIO_STATION_ALPHA.x,
      y: RADIO_STATION_ALPHA.y,
      type: 'pillar',
      radius: 0.62
    }
  ]

  return [...forestTrees, ...sparseTrees, ...rocks, ...landmarks]
} // end function createSceneSprites
