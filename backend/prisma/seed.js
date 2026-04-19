const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const prisma = new PrismaClient()

const WORKERS = [
  { id: 'W1', name: 'Alice Kumar' },
  { id: 'W2', name: 'Bob Singh' },
  { id: 'W3', name: 'Carol Mehta' },
  { id: 'W4', name: 'David Sharma' },
  { id: 'W5', name: 'Eva Patel' },
  { id: 'W6', name: 'Frank Joshi' },
]

const WORKSTATIONS = [
  { id: 'S1', name: 'Assembly Line A', type: 'Assembly' },
  { id: 'S2', name: 'Assembly Line B', type: 'Assembly' },
  { id: 'S3', name: 'Quality Control', type: 'QC' },
  { id: 'S4', name: 'Packaging', type: 'Packaging' },
  { id: 'S5', name: 'Welding Station', type: 'Welding' },
  { id: 'S6', name: 'Inspection Bay', type: 'Inspection' },
]

// Primary station per worker
const WORKER_STATION = {
  W1: 'S1', W2: 'S2', W3: 'S3',
  W4: 'S4', W5: 'S5', W6: 'S6',
}

function makeHash(isoTs, workerId, stationId, eventType) {
  return crypto
    .createHash('sha256')
    .update(`${isoTs}|${workerId}|${stationId}|${eventType}`)
    .digest('hex')
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Deterministically generate events for a worker across one shift
function generateWorkerEvents(workerId, stationId, shiftStartMs, shiftEndMs) {
  const isLowPerformer = workerId === 'W6'
  const events = []
  let t = shiftStartMs
  let productTimer = randInt(12, 22) // minutes until first product count

  while (t < shiftEndMs) {
    const ts = new Date(t)
    const isoTs = ts.toISOString()
    let eventType
    let count = 0

    if (productTimer <= 0) {
      // Time for a product count
      eventType = 'product_count'
      count = isLowPerformer ? randInt(1, 3) : randInt(2, 7)
      productTimer = randInt(15, 28)
    } else {
      const r = Math.random()
      if (isLowPerformer) {
        // Frank has higher idle/absent rate - ~55% active, ~25% idle, ~20% absent
        if (r < 0.55)      eventType = 'working'
        else if (r < 0.80) eventType = 'idle'
        else               eventType = 'absent'
      } else {
        // Normal workers: ~78% working, ~17% idle, ~5% absent
        if (r < 0.78)      eventType = 'working'
        else if (r < 0.95) eventType = 'idle'
        else               eventType = 'absent'
      }
    }

    const confidence = parseFloat((0.76 + Math.random() * 0.22).toFixed(3))
    const hash = makeHash(isoTs, workerId, stationId, eventType)

    events.push({
      eventHash: hash,
      timestamp: ts,
      workerId,
      workstationId: stationId,
      eventType,
      confidence,
      count,
    })

    const step = randInt(5, 11) // 5–11 minutes between events
    t += step * 60 * 1000
    productTimer -= step
  }

  return events
}

async function main() {
  console.log('🌱 Seeding factory database...')

  // Clear existing data
  await prisma.event.deleteMany({})
  await prisma.worker.deleteMany({})
  await prisma.workstation.deleteMany({})

  // Insert workers and workstations
  await prisma.worker.createMany({ data: WORKERS })
  await prisma.workstation.createMany({ data: WORKSTATIONS })
  console.log('✓ 6 workers and 6 workstations created')

  // Shift: 08:00 – 16:00 on 2026-01-15
  const shiftStart = new Date('2026-01-15T08:00:00.000Z').getTime()
  const shiftEnd   = new Date('2026-01-15T16:00:00.000Z').getTime()

  let totalEvents = 0

  for (const worker of WORKERS) {
    const stationId = WORKER_STATION[worker.id]
    const events = generateWorkerEvents(worker.id, stationId, shiftStart, shiftEnd)

    // Upsert so running seed twice is safe
    for (const event of events) {
      await prisma.event.upsert({
        where:  { eventHash: event.eventHash },
        update: {},
        create: event,
      })
    }

    totalEvents += events.length
    console.log(`  ✓ ${worker.name} (${worker.id}) → ${stationId}: ${events.length} events`)
  }

  console.log(`\n Seed complete — ${totalEvents} events across 6 workers`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
