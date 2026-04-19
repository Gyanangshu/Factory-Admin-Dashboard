# 🏭 Factory Productivity Dashboard

An AI-powered worker productivity dashboard that ingests structured events from CCTV computer vision systems and displays real-time metrics across 6 workers and 6 workstations.

---

## Quick Start

### Option 1: Docker (recommended)

```bash
git clone https://github.com/Gyanangshu/Factory-Admin-Dashboard.git
cd factory-dashboard

# Build and start both services (auto-seeds on first boot)
docker compose up --build

App:     http://localhost:3000
API:     http://localhost:3001/api/health
```

### Option 2: Local development

**Backend**
```bash
cd backend
npm install
npx prisma db push          # creates SQLite DB
node prisma/seed.js         # loads dummy data
npm run dev                 # starts on port 3001
```

**Frontend** (in a separate terminal)
```bash
cd frontend
npm install
npm run dev                 # starts on port 5173 (proxies /api → 3001)
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/health` | Health check |
| `POST` | `/api/events` | Ingest a single event |
| `POST` | `/api/events/batch` | Ingest up to 500 events |
| `GET`  | `/api/events/recent?limit=20` | Last N events |
| `GET`  | `/api/metrics/factory` | Factory-level summary |
| `GET`  | `/api/metrics/workers` | All worker metrics |
| `GET`  | `/api/metrics/workers/:id` | Single worker + event history |
| `GET`  | `/api/metrics/workstations` | All workstation metrics |
| `GET`  | `/api/metrics/workstations/:id` | Single workstation detail |
| `POST` | `/api/seed` | Re-seed DB with fresh dummy data |

### Ingest a single event
```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": "2026-01-15T10:15:00Z",
    "worker_id": "W1",
    "workstation_id": "S3",
    "event_type": "working",
    "confidence": 0.93,
    "count": 0
  }'
```

### Ingest a batch
```bash
curl -X POST http://localhost:3001/api/events/batch \
  -H "Content-Type: application/json" \
  -d '[
    {"timestamp":"2026-01-15T10:15:00Z","worker_id":"W1","workstation_id":"S1","event_type":"working","confidence":0.91,"count":0},
    {"timestamp":"2026-01-15T10:15:00Z","worker_id":"W2","workstation_id":"S2","event_type":"product_count","confidence":0.88,"count":4}
  ]'
```

### Refresh dummy data (no DB editing required)
```bash
curl -X POST http://localhost:3001/api/seed
```

---

## Q1. Architecture Overview

```
CCTV Cameras → Edge Device → Backend API → SQLite DB
                                ↓
                         Metrics Engine
                                ↓
                       React Dashboard
```

### Edge → Backend
Camera events are POSTed to `/api/events` as JSON. The ingestion endpoint:
1. Validates the payload with Zod (type safety, enum checks)
2. Computes an `eventHash = sha256(timestamp|workerId|workstationId|eventType)` for deduplication
3. Upserts into SQLite — duplicate hashes are silently ignored (HTTP 200, not 409)

### Backend → Dashboard
The metrics engine (`metricsService.js`) computes all metrics on-demand with a 10-second in-memory cache. The React frontend polls every 30 seconds via React Query.

---

## Database Schema

```
Worker
  id       String  PK  (W1–W6)
  name     String
  events   Event[]

Workstation
  id       String  PK  (S1–S6)
  name     String
  type     String  (Assembly | QC | Packaging | Welding | Inspection)
  events   Event[]

Event
  id            String   PK  (cuid)
  eventHash     String   UNIQUE  ← deduplication key
  timestamp     DateTime
  workerId      String   FK → Worker
  workstationId String   FK → Workstation
  eventType     String   (working | idle | absent | product_count)
  confidence    Float    (0.0–1.0)
  count         Int      (units produced, for product_count events)
  createdAt     DateTime @default(now())
```

Indexes on `workerId`, `workstationId`, and `timestamp` for fast metric lookups.

---

## Metric Definitions

### Assumptions (documented)

1. **Interval attribution**: The time between two consecutive events for a worker is attributed to the *earlier* event's type. This is the most common convention in activity-based tracking.

2. **Gap cap**: Any interval longer than 30 minutes is capped at 30 minutes. This prevents a camera outage or lunch break from inflating idle/absent times.

3. **Last event**: The final event in a worker's day is assigned a default 15-minute duration.

4. **Out-of-order handling**: Events are sorted ascending by `timestamp` before processing — out-of-order delivery from edge devices is handled transparently.

5. **Shift duration**: 8 hours (used as the denominator for utilization %).

### Worker Metrics

| Metric | Formula |
|--------|---------|
| Active time | Sum of intervals where `eventType ∈ {working, product_count}` |
| Idle time | Sum of intervals where `eventType = idle` |
| Utilization % | `(activeMs / shiftDurationMs) × 100`, capped at 100 |
| Units produced | Sum of `count` on all `product_count` events |
| Units per hour | `unitCount / activeHours` |

### Workstation Metrics

| Metric | Formula |
|--------|---------|
| Occupancy time | Sum of active intervals across all workers at this station |
| Utilization % | `(occupancyMs / shiftDurationMs) × 100` |
| Units produced | Sum of `count` on `product_count` events at this station |
| Throughput rate | `unitCount / occupancyHours` |

*Note: If multiple workers share a station, their active times are summed — occupancy can exceed shift duration in that case (documented behavior).*

### Factory Metrics

| Metric | Formula |
|--------|---------|
| Total productive time | Sum of all workers' active time |
| Total production count | Sum of all units across all workers |
| Avg utilization | Mean of all worker utilization percentages |
| Avg production rate | `totalUnits / totalActiveHours` |

---

## Q2. Resilience & Production Considerations

### Intermittent Connectivity
Edge devices buffer events locally when the network is unavailable. On reconnect, they batch-send to `POST /api/events/batch`. The ingestion endpoint is fully idempotent — safe to retry any number of times. Each event carries a client-generated `eventHash` so the server can detect and silently discard duplicates without error.

If connectivity is lost for an extended period, events may arrive significantly out of order. The metrics engine sorts all events by `timestamp` before processing, so late-arriving events are automatically incorporated in the next metrics query.

### Duplicate Events
Every event gets a deterministic hash: `sha256(timestamp | workerId | workstationId | eventType)`. This is stored as a `UNIQUE` constraint in the database. Upserts on duplicate hashes do nothing (`ON CONFLICT DO NOTHING`). The API returns HTTP 200 (not 409) on duplicates so camera systems don't treat retries as errors.

### Out-of-Order Timestamps
Events are stored with their original `timestamp`, not the insertion time (`createdAt`). All metric computations sort events ascending by `timestamp` before interval calculation. A late-arriving event from 3 hours ago is correctly incorporated into the sorted sequence on the next query — no recomputation required.

---

## Q3. ML / CV Operations

### Model Versioning
Add a `modelVersion` field (e.g. `"v1.2.0"`) to every ingested event. Store it in the `Event` table. The dashboard can then:
- Filter metrics by model version to compare output quality over time
- Track confidence score distributions per version
- Alert when a new model version produces different event type distributions

### Detecting Model Drift
Monitor two signals per model version over rolling 7-day windows:
1. **Confidence degradation**: If the rolling p50 confidence drops more than 10% from the version's baseline, alert the ML team. This indicates the real-world scene has drifted away from the training distribution.
2. **Event distribution shift**: Track the ratio of `working / idle / absent` events. A sudden spike in `absent` events may mean lighting conditions changed or the model is miscalibrated for the current shift pattern.

Both signals can be detected with simple SQL aggregations — no additional ML infrastructure needed initially.

### Triggering Retraining
Three-stage trigger:
1. **Threshold rule**: If confidence p50 < 0.70 for 3+ consecutive days, automatically flag the model for review.
2. **Anomaly flagging**: Events with confidence < 0.6 or impossible sequences (e.g. a worker at two stations simultaneously) are routed to a human review queue.
3. **Active labelling**: Flagged events are shown to factory supervisors for quick confirmation/correction. Corrected labels accumulate in a `LabelledEvent` table. When a new batch exceeds N samples, a retraining job is triggered automatically.

---

## Q4. Scaling Strategy

### 5 cameras (current)
Single Node.js server + SQLite. No additional infrastructure needed.

### 100+ cameras
- **Database**: Replace SQLite with PostgreSQL. Add a connection pool (e.g. PgBouncer).
- **Ingestion**: Put a message queue (Redis Streams or Kafka) in front of `/api/events`. Camera pods write to the queue; a worker process consumes and writes to the DB. This decouples ingestion throughput from DB write speed.
- **Metrics**: Pre-aggregate metrics on write via a background worker, not on every read. Store aggregated results in a `MetricsSnapshot` table. Dashboard reads from snapshots, background job refreshes every 60 seconds.
- **API**: Horizontally scale Node.js pods behind a load balancer (e.g. NGINX or AWS ALB).

### Multi-site
- Add `siteId` to `Event` and `Workstation` tables.
- Deploy a lightweight edge collector per site that buffers events and syncs to a central cloud DB.
- Add a site selector to the dashboard. Factory-level metrics become site-scoped + global rollup.
- For sub-second metric queries at 1000+ cameras across 10+ sites, migrate to a time-series database (TimescaleDB or ClickHouse). These are optimized for exactly this query pattern.

---

## Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Backend | Node.js + Express | Lightweight, fast I/O for event streaming |
| ORM | Prisma | Clean schema migrations, type-safe queries |
| Database | SQLite | Zero-infrastructure, file-based — perfect for this scale |
| Validation | Zod | Schema validation with descriptive error messages |
| Frontend | React + Vite | Fast DX, component model fits dashboard pattern |
| Data fetching | React Query | Polling, caching, stale data handling built in |
| Charts | Recharts | Composable, lightweight, works with React without D3 overhead |
| Styling | Tailwind CSS | Utility-first, fast to iterate |
| Container | Docker + nginx | Multi-stage build, production-grade serving |

---

## Project Structure

```
factory-dashboard/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── package.json
│   ├── .env
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   └── src/
│       ├── server.js
│       ├── routes/
│       │   ├── events.js
│       │   ├── metrics.js
│       │   └── seed.js
│       └── services/
│           └── metricsService.js
└── frontend/
    ├── Dockerfile
    ├── vite.config.js
    ├── tailwind.config.js
    ├── index.html
    ├── nginx/
    │   └── default.conf
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        └── components/
            ├── FactorySummary.jsx
            ├── WorkerTable.jsx
            ├── WorkstationTable.jsx
            ├── UtilizationChart.jsx
            ├── WorkerDetail.jsx
            └── shared.jsx
```
