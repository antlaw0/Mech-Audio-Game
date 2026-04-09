export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const inverseLerp = (a: number, b: number, value: number): number => {
  if (Math.abs(b - a) < 0.000001) {
    return 0
  }
  return (value - a) / (b - a)
}

export const remap = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number => {
  const t = inverseLerp(inMin, inMax, value)
  return lerp(outMin, outMax, t)
}

export const normalizeAngle = (radians: number): number => {
  let angle = radians
  while (angle > Math.PI) {
    angle -= Math.PI * 2
  }
  while (angle < -Math.PI) {
    angle += Math.PI * 2
  }
  return angle
}

export const shortestAngleBetween = (target: number, source: number): number =>
  normalizeAngle(target - source)
