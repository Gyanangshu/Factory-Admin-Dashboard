const express  = require('express')
const { execSync } = require('child_process')
const path = require('path')
const { invalidateCache } = require('../services/metricsService')

const router = express.Router()

// POST /api/seed — clears all data and re-seeds with fresh dummy data
// This lets evaluators refresh the dashboard without touching the DB directly
router.post('/', async (_req, res) => {
  try {
    console.log('🌱 Re-seeding database via API...')

    const seedPath = path.resolve(__dirname, '../../prisma/seed.js')
    execSync(`node ${seedPath}`, {
      stdio: 'inherit',
      timeout: 30_000,
    })

    invalidateCache()

    res.json({
      success: true,
      message: 'Database re-seeded with fresh dummy data',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Seed failed:', err.message)
    res.status(500).json({ error: 'Seed failed', message: err.message })
  }
})

module.exports = router
