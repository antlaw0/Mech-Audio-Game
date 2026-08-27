export const toChunkCoordinate = (value: number, chunkSize: number): number => {
  if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
    throw new Error('chunkSize must be a positive finite number.')
  } // end if invalid chunk size
  return Math.floor(value / chunkSize)
} // end function toChunkCoordinate

export const toChunkKey = (chunkX: number, chunkY: number): string => {
  return `${chunkX},${chunkY}`
} // end function toChunkKey

export const getChunkDistance = (
  observerX: number,
  observerY: number,
  chunkX: number,
  chunkY: number
): number => {
  return Math.max(Math.abs(chunkX - observerX), Math.abs(chunkY - observerY))
} // end function getChunkDistance
