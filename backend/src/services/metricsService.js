const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Constants 
const SHIFT_DURATION_MS      = 8 * 60 * 60 * 1000  // 8-hour shift
const MAX_INTERVAL_MS        = 30 * 60 * 1000       // cap any gap at 30 min
const DEFAULT_LAST_INTERVAL  = 15 * 60 * 1000       // assume 15 min for last event

// Simple in-memory cache (10-second TTL) 
const cache = new Map()
const CACHE_TTL = 10 * 1000

function getCached(key) {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data
  return null
}
function setCached(key, data) {
  cache.set(key, { data, ts: Date.now() })
}
function invalidateCache() {
  cache.clear()
}

// Helpers 
function msToHours(ms) {
  return ms / 3_600_000
}

function formatDuration(ms) {
  if (ms <= 0) return '0h 0m'
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${m}m`
}

function isActiveType(type) {
  // product_count events indicate the worker is actively producing
  return type === 'working' || type === 'product_count'
}

// Worker Metrics
/*
 * Algorithm:
 *  1. Fetch all events for the worker, sorted ASC by timestamp
 *     → handles out-of-order events from edge devices
 *  2. Walk consecutive pairs. Interval = next.ts - curr.ts, capped at 30 min
 *     → prevents a long gap (lunch, missing events) from distorting metrics
 *  3. Attribute interval to curr.eventType
 *  4. Last event gets a default 15-min duration
 *  5. Units: sum of .count on product_count events
 */
async function computeWorkerMetrics(workerId) {
  const cacheKey = `worker:${workerId}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const worker = await prisma.worker.findUnique({ where: { id: workerId } })
  if (!worker) return null

  const events = await prisma.event.findMany({
    where: { workerId },
    orderBy: { timestamp: 'asc' },
  })

  let activeMs = 0
  let idleMs   = 0
  let absentMs = 0
  let unitCount = 0

  for (let i = 0; i < events.length; i++) {
    const curr = events[i]
    const next = events[i + 1]

    if (curr.eventType === 'product_count') {
      unitCount += curr.count || 0
    }

    let intervalMs
    if (next) {
      intervalMs = new Date(next.timestamp) - new Date(curr.timestamp)
      intervalMs = Math.min(intervalMs, MAX_INTERVAL_MS)
    } else {
      intervalMs = DEFAULT_LAST_INTERVAL
    }

    if (isActiveType(curr.eventType))   activeMs  += intervalMs
    else if (curr.eventType === 'idle') idleMs    += intervalMs
    else if (curr.eventType === 'absent') absentMs += intervalMs
  }

  const utilization   = parseFloat(Math.min(100, (activeMs / SHIFT_DURATION_MS) * 100).toFixed(1))
  const activeHours   = msToHours(activeMs)
  const unitsPerHour  = activeHours > 0 ? parseFloat((unitCount / activeHours).toFixed(2)) : 0

  const result = {
    workerId:     worker.id,
    name:         worker.name,
    activeTime:   formatDuration(activeMs),
    activeMs,
    idleTime:     formatDuration(idleMs),
    idleMs,
    absentTime:   formatDuration(absentMs),
    absentMs,
    utilization,
    unitCount,
    unitsPerHour,
    eventCount:   events.length,
  }

  setCached(cacheKey, result)
  return result
}

async function getAllWorkerMetrics() {
  const cacheKey = 'all:workers'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const workers = await prisma.worker.findMany()
  const metrics = await Promise.all(workers.map(w => computeWorkerMetrics(w.id)))
  const result  = metrics.filter(Boolean)

  setCached(cacheKey, result)
  return result
}

// Workstation Metrics
/*
 * Occupancy = total time any worker was in an active state at this station.
 * We process each worker's events at this station independently, then sum.
 * If multiple workers share a station, their active times are summed
 * (can exceed SHIFT_DURATION_MS — documented assumption).
 */
async function computeWorkstationMetrics(workstationId) {
  const cacheKey = `station:${workstationId}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  const workstation = await prisma.workstation.findUnique({ where: { id: workstationId } })
  if (!workstation) return null

  const events = await prisma.event.findMany({
    where: { workstationId },
    orderBy: { timestamp: 'asc' },
  })

  // Group events by worker
  const byWorker = {}
  for (const ev of events) {
    if (!byWorker[ev.workerId]) byWorker[ev.workerId] = []
    byWorker[ev.workerId].push(ev)
  }

  let occupancyMs = 0
  let unitCount   = 0

  for (const workerEvents of Object.values(byWorker)) {
    const sorted = [...workerEvents].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    )

    for (let i = 0; i < sorted.length; i++) {
      const curr = sorted[i]
      const next = sorted[i + 1]

      if (curr.eventType === 'product_count') {
        unitCount += curr.count || 0
      }

      let intervalMs
      if (next) {
        intervalMs = new Date(next.timestamp) - new Date(curr.timestamp)
        intervalMs = Math.min(intervalMs, MAX_INTERVAL_MS)
      } else {
        intervalMs = DEFAULT_LAST_INTERVAL
      }

      if (isActiveType(curr.eventType)) occupancyMs += intervalMs
    }
  }

  const utilization    = parseFloat(Math.min(100, (occupancyMs / SHIFT_DURATION_MS) * 100).toFixed(1))
  const occupancyHours = msToHours(occupancyMs)
  const throughputRate = occupancyHours > 0 ? parseFloat((unitCount / occupancyHours).toFixed(2)) : 0

  const result = {
    workstationId: workstation.id,
    name:          workstation.name,
    type:          workstation.type,
    occupancyTime: formatDuration(occupancyMs),
    occupancyMs,
    utilization,
    unitCount,
    throughputRate,
    eventCount:    events.length,
  }

  setCached(cacheKey, result)
  return result
}

async function getAllWorkstationMetrics() {
  const cacheKey = 'all:stations'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const workstations = await prisma.workstation.findMany()
  const metrics = await Promise.all(workstations.map(w => computeWorkstationMetrics(w.id)))
  const result  = metrics.filter(Boolean)

  setCached(cacheKey, result)
  return result
}

// Factory Metrics
async function getFactoryMetrics() {
  const cacheKey = 'factory'
  const cached = getCached(cacheKey)
  if (cached) return cached

  const [workerMetrics, workstationMetrics] = await Promise.all([
    getAllWorkerMetrics(),
    getAllWorkstationMetrics(),
  ])

  const totalActiveMs      = workerMetrics.reduce((s, w) => s + w.activeMs, 0)
  const totalUnits         = workerMetrics.reduce((s, w) => s + w.unitCount, 0)
  const avgUtilization     = workerMetrics.length > 0
    ? parseFloat((workerMetrics.reduce((s, w) => s + w.utilization, 0) / workerMetrics.length).toFixed(1))
    : 0
  const activeHoursTotal   = msToHours(totalActiveMs)
  const avgProductionRate  = activeHoursTotal > 0
    ? parseFloat((totalUnits / activeHoursTotal).toFixed(2))
    : 0

  const result = {
    totalActiveTime:      formatDuration(totalActiveMs),
    totalActiveMs,
    totalProductionCount: totalUnits,
    avgUtilization,
    avgProductionRate,
    totalWorkers:         workerMetrics.length,
    totalWorkstations:    workstationMetrics.length,
  }

  setCached(cacheKey, result)
  return result
}

module.exports = {
  computeWorkerMetrics,
  getAllWorkerMetrics,
  computeWorkstationMetrics,
  getAllWorkstationMetrics,
  getFactoryMetrics,
  invalidateCache,
}
