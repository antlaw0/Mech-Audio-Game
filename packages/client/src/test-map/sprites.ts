import type { SpriteObject } from './types.js'

export function createSprites(): SpriteObject[] {
  return [
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
} // end function createSprites
