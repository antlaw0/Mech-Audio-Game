export type UpdatePriority = 'critical' | 'high' | 'medium' | 'low' | 'dormant'

export interface FrameSchedulerConfig {
  frameBudgetMs: number
}

export interface FrameSchedulerBeginArgs {
  deltaSeconds: number
  nowMs: number
  frameBudgetMs?: number
}

export interface ScheduledTaskArgs {
  id: string
  priority: UpdatePriority
  run: () => void
  intervalFrames?: number
  maxDeferralFrames?: number
  eventToken?: number
  queueSize?: number
}

export interface ScheduledSliceArgs {
  id: string
  priority: UpdatePriority
  totalItems: number
  cursor: number
  processItem: (itemIndex: number) => void
  maxItemsPerRun: number
  intervalFrames?: number
  maxDeferralFrames?: number
  eventToken?: number
}

export interface FrameSchedulerTaskDiagnostics {
  id: string
  priority: UpdatePriority
  runs: number
  deferred: number
  skipped: number
  framesSinceRun: number
  lastCostMs: number
  averageCostMs: number
  maxCostMs: number
  queueSize: number
}

export interface FrameSchedulerDiagnostics {
  frame: {
    index: number
    budgetMs: number
    spentMs: number
    usageRatio: number
    executedCount: number
    deferredCount: number
    skippedCount: number
    overBudgetFrames: number
    worstFrameMs: number
    queueSizeTotal: number
  }
  tasks: FrameSchedulerTaskDiagnostics[]
}

interface TaskState {
  id: string
  priority: UpdatePriority
  lastRunFrame: number
  lastEventToken: number
  runs: number
  deferred: number
  skipped: number
  lastCostMs: number
  totalCostMs: number
  maxCostMs: number
  queueSize: number
}

interface FrameState {
  frameIndex: number
  budgetMs: number
  spentMs: number
  executedCount: number
  deferredCount: number
  skippedCount: number
  overBudgetFrames: number
  worstFrameMs: number
}

const DEFAULT_FRAME_BUDGET_MS = 6
const DEFAULT_INTERVAL_FRAMES = 1

const PRIORITY_ORDER: Readonly<Record<UpdatePriority, number>> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  dormant: 1
}

const DEFAULT_MAX_DEFERRAL_FRAMES: Readonly<Record<UpdatePriority, number>> = {
  critical: 0,
  high: 2,
  medium: 4,
  low: 8,
  dormant: 16
}

function clampPositive(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return value
}

export interface FrameUpdateScheduler {
  beginFrame: (args: FrameSchedulerBeginArgs) => void
  runTask: (args: ScheduledTaskArgs) => boolean
  runSlicedTask: (args: ScheduledSliceArgs) => { ran: boolean; nextCursor: number; processed: number }
  getDiagnostics: () => FrameSchedulerDiagnostics
  getFrameIndex: () => number
}

export function createFrameUpdateScheduler(config?: Partial<FrameSchedulerConfig>): FrameUpdateScheduler {
  const tasks = new Map<string, TaskState>()
  const frame: FrameState = {
    frameIndex: 0,
    budgetMs: clampPositive(config?.frameBudgetMs ?? DEFAULT_FRAME_BUDGET_MS, DEFAULT_FRAME_BUDGET_MS),
    spentMs: 0,
    executedCount: 0,
    deferredCount: 0,
    skippedCount: 0,
    overBudgetFrames: 0,
    worstFrameMs: 0
  }

  const getOrCreateTask = (id: string, priority: UpdatePriority): TaskState => {
    const existing = tasks.get(id)
    if (existing) {
      existing.priority = priority
      return existing
    }

    const created: TaskState = {
      id,
      priority,
      lastRunFrame: Number.NEGATIVE_INFINITY,
      lastEventToken: Number.NEGATIVE_INFINITY,
      runs: 0,
      deferred: 0,
      skipped: 0,
      lastCostMs: 0,
      totalCostMs: 0,
      maxCostMs: 0,
      queueSize: 0
    }
    tasks.set(id, created)
    return created
  }

  const shouldExecuteTask = (task: TaskState, args: {
    intervalFrames: number
    maxDeferralFrames: number
    eventToken: number | undefined
  }): { execute: boolean; deferred: boolean; skipped: boolean; dueNow: boolean } => {
    const framesSinceRun = frame.frameIndex - task.lastRunFrame
    const dueByInterval = framesSinceRun >= args.intervalFrames
    const dueByEvent = args.eventToken !== undefined && args.eventToken !== task.lastEventToken
    const dueNow = dueByInterval || dueByEvent

    if (!dueNow) {
      return { execute: false, deferred: false, skipped: true, dueNow: false }
    }

    const isStarved = framesSinceRun >= args.maxDeferralFrames
    const remainingBudgetMs = frame.budgetMs - frame.spentMs
    const canRunUnderBudget = remainingBudgetMs > 0
    const mustRun = task.priority === 'critical' || isStarved

    if (!mustRun && !canRunUnderBudget) {
      return { execute: false, deferred: true, skipped: false, dueNow: true }
    }

    return { execute: true, deferred: false, skipped: false, dueNow: true }
  }

  const commitTaskRun = (task: TaskState, args: {
    startedAtMs: number
    eventToken: number | undefined
  }): void => {
    const elapsedMs = performance.now() - args.startedAtMs
    task.lastRunFrame = frame.frameIndex
    if (args.eventToken !== undefined) {
      task.lastEventToken = args.eventToken
    }
    task.runs += 1
    task.lastCostMs = elapsedMs
    task.totalCostMs += elapsedMs
    task.maxCostMs = Math.max(task.maxCostMs, elapsedMs)

    frame.spentMs += elapsedMs
    frame.executedCount += 1
  }

  return {
    beginFrame(args: FrameSchedulerBeginArgs): void {
      frame.frameIndex += 1
      frame.budgetMs = clampPositive(args.frameBudgetMs ?? frame.budgetMs, DEFAULT_FRAME_BUDGET_MS)
      frame.spentMs = 0
      frame.executedCount = 0
      frame.deferredCount = 0
      frame.skippedCount = 0
    },
    runTask(args: ScheduledTaskArgs): boolean {
      const task = getOrCreateTask(args.id, args.priority)
      task.queueSize = Math.max(0, Math.floor(args.queueSize ?? task.queueSize))

      const intervalFrames = Math.max(1, Math.floor(args.intervalFrames ?? DEFAULT_INTERVAL_FRAMES))
      const defaultMaxDeferral = DEFAULT_MAX_DEFERRAL_FRAMES[args.priority]
      const maxDeferralFrames = Math.max(intervalFrames, Math.floor(args.maxDeferralFrames ?? defaultMaxDeferral))

      const decision = shouldExecuteTask(task, {
        intervalFrames,
        maxDeferralFrames,
        eventToken: args.eventToken
      })

      if (!decision.execute) {
        if (decision.deferred) {
          task.deferred += 1
          frame.deferredCount += 1
        }
        if (decision.skipped) {
          task.skipped += 1
          frame.skippedCount += 1
        }
        return false
      }

      const startedAtMs = performance.now()
      args.run()
      commitTaskRun(task, {
        startedAtMs,
        eventToken: args.eventToken
      })

      if (frame.spentMs > frame.budgetMs) {
        frame.overBudgetFrames += 1
      }
      frame.worstFrameMs = Math.max(frame.worstFrameMs, frame.spentMs)
      return true
    },
    runSlicedTask(args: ScheduledSliceArgs): { ran: boolean; nextCursor: number; processed: number } {
      const totalItems = Math.max(0, Math.floor(args.totalItems))
      if (totalItems <= 0) {
        const task = getOrCreateTask(args.id, args.priority)
        task.queueSize = 0
        return { ran: false, nextCursor: 0, processed: 0 }
      }

      const nextStart = Math.max(0, Math.min(totalItems - 1, Math.floor(args.cursor)))
      let processed = 0
      let cursor = nextStart
      const maxItemsPerRun = Math.max(1, Math.floor(args.maxItemsPerRun))

      const ran = this.runTask({
        id: args.id,
        priority: args.priority,
        intervalFrames: args.intervalFrames,
        maxDeferralFrames: args.maxDeferralFrames,
        eventToken: args.eventToken,
        queueSize: totalItems,
        run: () => {
          while (processed < maxItemsPerRun) {
            args.processItem(cursor)
            processed += 1
            cursor += 1
            if (cursor >= totalItems) {
              cursor = 0
              break
            }

            const budgetRemainingMs = frame.budgetMs - frame.spentMs
            if (PRIORITY_ORDER[args.priority] < PRIORITY_ORDER.high && budgetRemainingMs <= 0) {
              break
            }
          }
        }
      })

      const task = getOrCreateTask(args.id, args.priority)
      task.queueSize = Math.max(0, totalItems - processed)
      return {
        ran,
        nextCursor: ran ? cursor : nextStart,
        processed
      }
    },
    getDiagnostics(): FrameSchedulerDiagnostics {
      const taskDiagnostics: FrameSchedulerTaskDiagnostics[] = Array.from(tasks.values())
        .sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority] || a.id.localeCompare(b.id))
        .map((task) => ({
          id: task.id,
          priority: task.priority,
          runs: task.runs,
          deferred: task.deferred,
          skipped: task.skipped,
          framesSinceRun: Number.isFinite(task.lastRunFrame) ? Math.max(0, frame.frameIndex - task.lastRunFrame) : frame.frameIndex,
          lastCostMs: task.lastCostMs,
          averageCostMs: task.runs > 0 ? task.totalCostMs / task.runs : 0,
          maxCostMs: task.maxCostMs,
          queueSize: task.queueSize
        }))

      const queueSizeTotal = taskDiagnostics.reduce((total, task) => total + task.queueSize, 0)

      return {
        frame: {
          index: frame.frameIndex,
          budgetMs: frame.budgetMs,
          spentMs: frame.spentMs,
          usageRatio: frame.budgetMs <= 0 ? 0 : Math.min(10, frame.spentMs / frame.budgetMs),
          executedCount: frame.executedCount,
          deferredCount: frame.deferredCount,
          skippedCount: frame.skippedCount,
          overBudgetFrames: frame.overBudgetFrames,
          worstFrameMs: frame.worstFrameMs,
          queueSizeTotal
        },
        tasks: taskDiagnostics
      }
    },
    getFrameIndex(): number {
      return frame.frameIndex
    }
  }
}
