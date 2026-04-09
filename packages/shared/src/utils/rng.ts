export interface Rng {
  nextFloat: () => number
} // end interface Rng

export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0

  return {
    nextFloat: () => {
      state = (1664525 * state + 1013904223) >>> 0
      return state / 0xffffffff
    } // end function nextFloat
  } // end object return
} // end function createSeededRng
