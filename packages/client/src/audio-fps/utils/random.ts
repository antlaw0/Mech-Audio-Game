export class SeededRandom {
  private state: number

  constructor(seed = 1337) {
    this.state = seed >>> 0
  }

  next(): number {
    this.state ^= this.state << 13
    this.state ^= this.state >>> 17
    this.state ^= this.state << 5
    return (this.state >>> 0) / 4294967295
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  pick<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty array.')
    }
    const index = Math.floor(this.next() * items.length)
    return items[Math.max(0, Math.min(items.length - 1, index))] as T
  }
}
