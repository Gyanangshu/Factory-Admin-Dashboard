const express = require('express')
const { PrismaClient } = require('@prisma/client')
const {
  getAllWorkerMetrics,
  computeWorkerMetrics,
  getAllWorkstationMetrics,
  computeWorkstationMetrics,
  getFactoryMetrics,
} = require('../services/metricsService')

const router = express.Router()
const prisma = new PrismaClient()

// GET /api/metrics/factory
router.get('/factory', async (_req, res) => {
  try {
    const metrics = await getFactoryMetrics()
    res.json(metrics)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/metrics/workers
router.get('/workers', async (_req, res) => {
  try {
    const metrics = await getAllWorkerMetrics()
    res.json(metrics)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/metrics/workers/:id  (includes recent events for detail panel)
router.get('/workers/:id', async (req, res) => {
  try {
    const metrics = await computeWorkerMetrics(req.params.id)
    if (!metrics) return res.status(404).json({ error: 'Worker not found' })

    // Fetch recent events for this worker
    const recentEvents = await prisma.event.findMany({
      where:   { workerId: req.params.id },
      orderBy: { timestamp: 'desc' },
      take:    25,
      include: { workstation: true },
    })

    res.json({
      ...metrics,
      recentEvents: recentEvents.map(e => ({
        id:             e.id,
        timestamp:      e.timestamp,
        workstationId:  e.workstationId,
        workstationName: e.workstation.name,
        eventType:      e.eventType,
        confidence:     e.confidence,
        count:          e.count,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/metrics/workstations
router.get('/workstations', async (_req, res) => {
  try {
    const metrics = await getAllWorkstationMetrics()
    res.json(metrics)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/metrics/workstations/:id
router.get('/workstations/:id', async (req, res) => {
  try {
    const metrics = await computeWorkstationMetrics(req.params.id)
    if (!metrics) return res.status(404).json({ error: 'Workstation not found' })
    res.json(metrics)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
