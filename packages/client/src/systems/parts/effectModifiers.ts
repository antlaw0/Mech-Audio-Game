import type { PartEffectModifier, PartEffectTarget } from '../../data/parts/types.js'

export type PartEffectRuntimeContext = {
  epRatio: number
  heatRatio: number
  isFlying: boolean
  isMoving: boolean
  isStandingStill: boolean
  currentWeaponType?: 'ballistic' | 'energy' | 'missile'
  targetEnemyType?: string
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value))
}

export const isPartEffectModifierActive = (
  modifier: PartEffectModifier,
  context: PartEffectRuntimeContext
): boolean => {
  const conditions = modifier.conditions
  if (!conditions) {
    return true
  }

  if (typeof conditions.epPercentGte === 'number' && (context.epRatio * 100) < conditions.epPercentGte) {
    return false
  }
  if (typeof conditions.epPercentLte === 'number' && (context.epRatio * 100) > conditions.epPercentLte) {
    return false
  }
  if (typeof conditions.heatPercentGte === 'number' && (context.heatRatio * 100) < conditions.heatPercentGte) {
    return false
  }
  if (typeof conditions.heatPercentLte === 'number' && (context.heatRatio * 100) > conditions.heatPercentLte) {
    return false
  }
  if (typeof conditions.isFlying === 'boolean' && conditions.isFlying !== context.isFlying) {
    return false
  }
  if (typeof conditions.isMoving === 'boolean' && conditions.isMoving !== context.isMoving) {
    return false
  }
  if (typeof conditions.isStandingStill === 'boolean' && conditions.isStandingStill !== context.isStandingStill) {
    return false
  }
  if (Array.isArray(conditions.weaponTypeIn) && conditions.weaponTypeIn.length > 0) {
    if (!context.currentWeaponType || !conditions.weaponTypeIn.includes(context.currentWeaponType)) {
      return false
    }
  }
  if (Array.isArray(conditions.targetEnemyTypeIn) && conditions.targetEnemyTypeIn.length > 0) {
    if (!context.targetEnemyType || !conditions.targetEnemyTypeIn.includes(context.targetEnemyType)) {
      return false
    }
  }

  return true
}

export const applyPartEffectModifiers = (
  baseValue: number,
  modifiers: PartEffectModifier[],
  target: PartEffectTarget,
  context: PartEffectRuntimeContext
): number => {
  let addSum = 0
  let multiplier = 1

  modifiers.forEach((modifier) => {
    if (modifier.target !== target || !isPartEffectModifierActive(modifier, context)) {
      return
    }

    if (modifier.op === 'add') {
      addSum += modifier.value
      return
    }

    multiplier *= (1 + modifier.value)
  })

  const value = (baseValue + addSum) * multiplier
  return Number(clamp(value, 0, Number.MAX_SAFE_INTEGER).toFixed(4))
}
