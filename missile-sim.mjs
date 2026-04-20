// Missile simulation test — mirrors the combat-ecs.ts logic exactly
const PLAYER_HEIGHT = 0.5
const MAX_LOOK_PITCH = 0.7
const BULLET_MAX_DIST = 48
const TANK_HIT_HALF_HEIGHT = 0.6

function clampProjectilePitch(p) {
  return Math.max(-MAX_LOOK_PITCH, Math.min(MAX_LOOK_PITCH, p))
}

function getPitchToTarget(ox, oy, oz, tx, ty, tz) {
  const hd = Math.hypot(tx - ox, ty - oy)
  return clampProjectilePitch(Math.atan2(oz - tz, Math.max(hd, 0.0001)))
}

function getFirstContactFraction(sx, sy, sz, ex, ey, ez, tx, ty, tz, hRadius, vHalf) {
  const segX = ex - sx, segY = ey - sy, segZ = ez - sz
  const sqLen = segX*segX + segY*segY + segZ*segZ
  if (sqLen <= 0.000001) {
    return Math.hypot(sx-tx,sy-ty) < hRadius && Math.abs(sz-tz) <= vHalf ? 0 : -1
  }
  const len = Math.sqrt(sqLen)
  const steps = Math.max(2, Math.ceil(len / Math.max(0.05, hRadius * 0.35)))
  for (let i = 1; i <= steps; i++) {
    const f = i / steps
    const samX = sx + segX*f, samY = sy + segY*f, samZ = sz + segZ*f
    if (Math.hypot(samX-tx, samY-ty) < hRadius && Math.abs(samZ-tz) <= vHalf) return f
  }
  return -1
}

function simulate(label, {
  playerX, playerY, playerZ,
  targetX, targetY, targetFlightHeight,
  speed = 8, trackingRating = 0.9, maxDist = BULLET_MAX_DIST,
  tankRadius = 0.5, missileRadius = 0.08,
  fps = 60, maxFrames = 600
}) {
  const dt = 1 / fps
  const originHeight = (playerZ ?? 0) + PLAYER_HEIGHT
  const targetZ = Math.max(0, targetFlightHeight) + PLAYER_HEIGHT

  let x = playerX, y = playerY, height = originHeight
  let angle = Math.atan2(targetY - playerY, targetX - playerX)
  let pitch = getPitchToTarget(playerX, playerY, originHeight, targetX, targetY, targetZ)
  let totalRange = 0
  const maxTurnRate = 2.4 + trackingRating * 6.4

  console.log(`\n=== ${label} ===`)
  console.log(`  Launch:  pos=(${x.toFixed(2)},${y.toFixed(2)}) h=${height.toFixed(2)}  angle=${angle.toFixed(3)}  pitch=${pitch.toFixed(3)}`)
  console.log(`  Target:  pos=(${targetX.toFixed(2)},${targetY.toFixed(2)}) h=${targetZ.toFixed(2)}  tankRadius=${tankRadius}  vHalf=${TANK_HIT_HALF_HEIGHT}`)
  console.log(`  Speed=${speed}  trackingRating=${trackingRating}  maxTurnRate=${maxTurnRate.toFixed(2)} rad/s`)

  for (let frame = 1; frame <= maxFrames; frame++) {
    // Guidance
    const desiredAngle = Math.atan2(targetY - y, targetX - x)
    const desiredPitch = getPitchToTarget(x, y, height, targetX, targetY, targetZ)
    let dA = desiredAngle - angle
    while (dA > Math.PI) dA -= Math.PI*2
    while (dA < -Math.PI) dA += Math.PI*2
    let dP = desiredPitch - pitch
    while (dP > Math.PI) dP -= Math.PI*2
    while (dP < -Math.PI) dP += Math.PI*2
    const maxTurn = maxTurnRate * dt
    angle += Math.max(-maxTurn, Math.min(maxTurn, dA))
    pitch = clampProjectilePitch(pitch + Math.max(-maxTurn, Math.min(maxTurn, dP)))

    const step = speed * dt
    const cosA = Math.cos(angle), sinA = Math.sin(angle)
    const horizontalStep = step * Math.max(0, Math.cos(pitch))
    const nx = x + cosA * horizontalStep
    const ny = y + sinA * horizontalStep
    const nh = height - Math.sin(pitch) * step
    totalRange += step

    // Range expiry
    if (totalRange >= maxDist) {
      console.log(`  Frame ${frame}: EXPIRED at range ${totalRange.toFixed(2)}  pos=(${nx.toFixed(2)},${ny.toFixed(2)}) h=${nh.toFixed(2)}`)
      return
    }
    if (nh <= 0) {
      console.log(`  Frame ${frame}: HIT GROUND  pos=(${nx.toFixed(2)},${ny.toFixed(2)}) h=${nh.toFixed(3)}`)
      return
    }

    // Hit check
    const hRadius = tankRadius + missileRadius
    const frac = getFirstContactFraction(x, y, height, nx, ny, nh, targetX, targetY, targetZ, hRadius, TANK_HIT_HALF_HEIGHT)
    if (frac >= 0) {
      const ix = x + (nx-x)*frac, iy = y + (ny-y)*frac, iz = height + (nh-height)*frac
      const hDist = Math.hypot(ix-targetX, iy-targetY)
      const vDist = Math.abs(iz-targetZ)
      console.log(`  Frame ${frame} (t=${(frame/fps).toFixed(2)}s): HIT!  impactPos=(${ix.toFixed(2)},${iy.toFixed(2)}) h=${iz.toFixed(2)}  hDist=${hDist.toFixed(3)}  vDist=${vDist.toFixed(3)}  range=${totalRange.toFixed(2)}`)
      return
    }

    // Log every 30 frames
    if (frame % 30 === 0) {
      const hdToTarget = Math.hypot(nx-targetX, ny-targetY)
      const vdToTarget = Math.abs(nh-targetZ)
      console.log(`  Frame ${frame} (t=${(frame/fps).toFixed(2)}s): pos=(${nx.toFixed(2)},${ny.toFixed(2)}) h=${nh.toFixed(2)}  pitch=${pitch.toFixed(3)}  angle=${angle.toFixed(3)}  hdToTarget=${hdToTarget.toFixed(2)}  vdToTarget=${vdToTarget.toFixed(2)}`)
    }

    x = nx; y = ny; height = nh
  }
  console.log(`  NEVER HIT after ${maxFrames} frames`)
}

// --- Test cases ---

// Case 1: Ground player, ground tank straight ahead
simulate('1. Ground vs ground, straight ahead', {
  playerX: 0, playerY: 0, playerZ: 0,
  targetX: 20, targetY: 0, targetFlightHeight: 0
})

// Case 2: Ground player, ground tank at 45 degrees
simulate('2. Ground vs ground, 45 degrees', {
  playerX: 0, playerY: 0, playerZ: 0,
  targetX: 14, targetY: 14, targetFlightHeight: 0
})

// Case 3: Player at height 8, ground tank
simulate('3. Flying player (h=8) vs ground tank', {
  playerX: 0, playerY: 0, playerZ: 8,
  targetX: 20, targetY: 0, targetFlightHeight: 0
})

// Case 4: Ground player, helicopter at height 8
simulate('4. Ground player vs helicopter (h=8)', {
  playerX: 0, playerY: 0, playerZ: 0,
  targetX: 15, targetY: 0, targetFlightHeight: 8,
  tankRadius: 0.46
})

// Case 5: Missile fired when target is behind player (180 deg off)
simulate('5. Target directly behind (180 deg off at launch)', {
  playerX: 20, playerY: 0, playerZ: 0,
  targetX: 0, targetY: 0, targetFlightHeight: 0
})

// Case 6: Very close target (3 units)
simulate('6. Very close target (3 units)', {
  playerX: 0, playerY: 0, playerZ: 0,
  targetX: 3, targetY: 0, targetFlightHeight: 0
})

// Case 7: Pitch clamp edge case — player very high, target on ground close
simulate('7. Steep dive needed (h=12, target 5 units away)', {
  playerX: 0, playerY: 0, playerZ: 12,
  targetX: 5, targetY: 0, targetFlightHeight: 0
})
