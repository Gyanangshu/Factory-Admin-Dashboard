const express = require('express')
const crypto  = require('crypto')
const { z }   = require('zod')
const { PrismaClient } = require('@prisma/client')
const { invalidateCache } = require('../services/metricsService')

const router = express.Router()
const prisma = new PrismaClient()

//  Validation schema (accepts both snake_case and camelCase)
const EventSchema = z.object({
  timestamp:      z.string().datetime({ message: 'timestamp must be ISO 8601' }),
  worker_id:      z.string().optional(),
  workerId:       z.string().optional(),
  workstation_id: z.string().optional(),
  workstationId:  z.string().optional(),
  event_type:     z.string().optional(),
  eventType:      z.string().optional(),
  confidence:     z.number().min(0).max(1),
  count:          z.number().int().min(0).optional().default(0),
}).refine(d => d.worker_id || d.workerId, { message: 'worker_id is required' })
  .refine(d => d.workstation_id || d.workstationId, { message: 'workstation_id is required' })
  .refine(d => d.event_type || d.eventType, { message: 'event_type is required' })

const VALID_EVENT_TYPES = ['working', 'idle', 'absent', 'product_count']

// Normalize keys from snake_case → camelCase
function normalize(raw) {
  const workerId      = raw.worker_id      || raw.workerId
  const workstationId = raw.workstation_id || raw.workstationId
  const eventType     = raw.event_type     || raw.eventType

  if (!VALID_EVENT_TYPES.includes(eventType)) {
    throw new Error(`Invalid event_type "${eventType}". Must be one of: ${VALID_EVENT_TYPES.join(', ')}`)
  }

  return {
    timestamp:    new Date(raw.timestamp),
    workerId,
    workstationId,
    eventType,
    confidence:   raw.confidence,
    count:        raw.count || 0,
  }
}

// Generate deterministic hash for deduplication
function makeHash(isoTs, workerId, workstationId, eventType) {
  return crypto
    .createHash('sha256')
    .update(`${isoTs}|${workerId}|${workstationId}|${eventType}`)
    .digest('hex')
}

async function ingestOne(rawEvent) {
  const parsed     = EventSchema.parse(rawEvent)
  const normalized = normalize(parsed)
  const isoTs      = new Date(parsed.timestamp).toISOString()
  const eventHash  = makeHash(isoTs, normalized.workerId, normalized.workstationId, normalized.eventType)

  // Verify worker and workstation exist
  const [worker, workstation] = await Promise.all([
    prisma.worker.findUnique({ where: { id: normalized.workerId } }),
    prisma.workstation.findUnique({ where: { id: normalized.workstationId } }),
  ])
  if (!worker)      throw new Error(`Worker "${normalized.workerId}" not found`)
  if (!workstation) throw new Error(`Workstation "${normalized.workstationId}" not found`)

  // Upsert: duplicate events (same hash) are silently ignored
  const event = await prisma.event.upsert({
    where:  { eventHash },
    update: {},
    create: { ...normalized, eventHash },
  })

  return { event, isDuplicate: event.createdAt.getTime() !== event.createdAt.getTime() }
}

// POST /api/events — ingest a single event 
router.post('/', async (req, res) => {
  try {
    const { event } = await ingestOne(req.body)
    invalidateCache()
    res.status(201).json({ success: true, eventId: event.id })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.errors })
    }
    res.status(400).json({ error: err.message })
  }
})

// POST /api/events/batch — ingest an array of events 
router.post('/batch', async (req, res) => {
  const body = req.body
  if (!Array.isArray(body)) {
    return res.status(400).json({ error: 'Body must be an array of events' })
  }
  if (body.length > 500) {
    return res.status(400).json({ error: 'Max 500 events per batch' })
  }

  const results = { inserted: 0, duplicates: 0, errors: [] }

  for (let i = 0; i < body.length; i++) {
    try {
      await ingestOne(body[i])
      results.inserted++
    } catch (err) {
      // Track but don't fail the whole batch
      results.errors.push({ index: i, error: err.message })
    }
  }

  invalidateCache()
  res.status(200).json({ success: true, ...results })
})

// GET /api/events/recent — last N events (for live feed) 
router.get('/recent', async (req, res) => {
  try {
    const limit    = Math.min(parseInt(req.query.limit || '20', 10), 100)
    const workerId = req.query.workerId

    const events = await prisma.event.findMany({
      where:   workerId ? { workerId } : {},
      orderBy: { timestamp: 'desc' },
      take:    limit,
      include: { worker: true, workstation: true },
    })

    res.json(events.map(e => ({
      id:             e.id,
      timestamp:      e.timestamp,
      workerId:       e.workerId,
      workerName:     e.worker.name,
      workstationId:  e.workstationId,
      workstationName: e.workstation.name,
      eventType:      e.eventType,
      confidence:     e.confidence,
      count:          e.count,
    })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
