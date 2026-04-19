import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Factory, RefreshCw, Play, Wifi, WifiOff } from 'lucide-react'

import FactorySummary    from './components/FactorySummary'
import WorkerTable       from './components/WorkerTable'
import WorkstationTable  from './components/WorkstationTable'
import UtilizationChart  from './components/UtilizationChart'
import WorkerDetail      from './components/WorkerDetail'

// API helpers
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
})

const fetchFactory = () => api.get('/metrics/factory').then(r => r.data)
const fetchWorkers = () => api.get('/metrics/workers').then(r => r.data)
const fetchWorkstations = () => api.get('/metrics/workstations').then(r => r.data)

// Main App 
export default function App() {
  const queryClient   = useQueryClient()
  const [selectedWorkerId, setSelectedWorkerId] = useState(null)
  const [seeding, setSeeding]   = useState(false)
  const [seedMsg, setSeedMsg]   = useState('')

  const POLL = 30_000 // 30-second auto-refresh

  const factoryQuery      = useQuery({ queryKey: ['factory'],      queryFn: fetchFactory,      refetchInterval: POLL })
  const workersQuery      = useQuery({ queryKey: ['workers'],      queryFn: fetchWorkers,      refetchInterval: POLL })
  const workstationsQuery = useQuery({ queryKey: ['workstations'], queryFn: fetchWorkstations, refetchInterval: POLL })

  const isLoading = factoryQuery.isLoading || workersQuery.isLoading || workstationsQuery.isLoading
  const isError   = factoryQuery.isError   || workersQuery.isError   || workstationsQuery.isError

  function handleRefresh() {
    queryClient.invalidateQueries()
  }

  async function handleSeed() {
    setSeeding(true)
    setSeedMsg('')
    try {
      await api.post('/seed')
      setSeedMsg('✓ Database re-seeded!')
      queryClient.invalidateQueries()
    } catch {
      setSeedMsg('✗ Seed failed — check server logs')
    } finally {
      setSeeding(false)
      setTimeout(() => setSeedMsg(''), 4000)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Factory size={22} className="text-blue-400" />
            <div>
              <h1 className="text-base font-semibold leading-tight">Factory Productivity Dashboard</h1>
              <p className="text-xs text-gray-400 leading-tight">AI-powered CCTV monitoring • Shift: Jan 15, 2026</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live status indicator */}
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400">
              {isError
                ? <><WifiOff size={12} className="text-red-400" /> Disconnected</>
                : <><Wifi size={12} className="text-green-400" /> Live (30s)</>
              }
            </span>

            {seedMsg && (
              <span className="text-xs text-green-400 font-medium hidden sm:block">{seedMsg}</span>
            )}

            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
              title="Re-seed database with fresh dummy data"
            >
              <Play size={12} />
              {seeding ? 'Seeding…' : 'Reseed Data'}
            </button>

            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium transition-colors"
              title="Refresh all metrics"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            ⚠️ Could not connect to API. Please try again later.
          </div>
        )}

        {/* Factory summary cards */}
        <FactorySummary data={factoryQuery.data} isLoading={factoryQuery.isLoading} />

        {/* Utilization chart */}
        <UtilizationChart workers={workersQuery.data} isLoading={workersQuery.isLoading} />

        {/* Workers & Workstations tables */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <WorkerTable
            workers={workersQuery.data}
            isLoading={workersQuery.isLoading}
            onSelectWorker={setSelectedWorkerId}
          />
          <WorkstationTable
            workstations={workstationsQuery.data}
            isLoading={workstationsQuery.isLoading}
          />
        </div>

      </main>

      {/* Worker Detail Drawer */}
      <WorkerDetail
        workerId={selectedWorkerId}
        onClose={() => setSelectedWorkerId(null)}
      />
    </div>
  )
}
