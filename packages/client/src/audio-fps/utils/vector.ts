export interface Vec2 {
  x: number
  y: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export const vec2 = (x = 0, y = 0): Vec2 => ({ x, y })

export const addVec2 = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })

export const subVec2 = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })

export const scaleVec2 = (v: Vec2, scalar: number): Vec2 => ({ x: v.x * scalar, y: v.y * scalar })

export const lengthVec2 = (v: Vec2): number => Math.hypot(v.x, v.y)

export const normalizeVec2 = (v: Vec2): Vec2 => {
  const len = lengthVec2(v)
  if (len <= 0.00001) {
    return { x: 0, y: 0 }
  }
  return { x: v.x / len, y: v.y / len }
}

export const dotVec2 = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y

export const angleVec2 = (v: Vec2): number => Math.atan2(v.y, v.x)

export const fromAngle = (angle: number, magnitude = 1): Vec2 => ({
  x: Math.cos(angle) * magnitude,
  y: Math.sin(angle) * magnitude
})

export const toVec3 = (v: Vec2, z = 0): Vec3 => ({ x: v.x, y: v.y, z })
