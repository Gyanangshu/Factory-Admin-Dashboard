const express = require('express')
const cors    = require('cors')

const eventsRouter  = require('./routes/events')
const metricsRouter = require('./routes/metrics')
const seedRouter    = require('./routes/seed')

const app  = express()
const PORT = process.env.PORT || 3001

// Middleware 
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }))
app.use(express.json({ limit: '10mb' }))

// Request logger (lightweight, no dependency needed)
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`)
  next()
})

// Routes 
app.use('/api/events',  eventsRouter)
app.use('/api/metrics', metricsRouter)
app.use('/api/seed',    seedRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' })
})

// 404 / Error handlers 
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

// Start 
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏭 Factory Dashboard API running on http://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/api/health\n`)
})
