import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { X, Clock, Package, TrendingUp, Activity } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { UtilBadge, EventBadge } from './shared'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api'
});
const fetchWorker = id => api.get(`/metrics/workers/${id}`).then(r => r.data)

function MiniStat({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
      <div className={`p-1.5 rounded-md ${color}`}>
        <Icon size={14} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500 leading-tight">{label}</p>
        <p className="font-semibold text-gray-800 text-sm">{value}</p>
      </div>
    </div>
  )
}

// Build a simple hourly distribution from recentEvents timestamps
function buildHourlyChart(events) {
  const hours = {}
  for (let h = 8; h <= 16; h++) hours[h] = { hour: `${h}:00`, working: 0, idle: 0, absent: 0 }

  for (const ev of events) {
    const h = new Date(ev.timestamp).getUTCHours()
    if (hours[h] && ev.eventType !== 'product_count') {
      hours[h][ev.eventType] = (hours[h][ev.eventType] || 0) + 1
    }
  }
  return Object.values(hours)
}

export default function WorkerDetail({ workerId, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['worker-detail', workerId],
    queryFn: () => fetchWorker(workerId),
    enabled: !!workerId,
  })

  // Close on Escape key
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!workerId) return null

  const chartData = data?.recentEvents ? buildHourlyChart(data.recentEvents) : []

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gray-900 text-white px-5 py-4 flex items-center gap-3 flex-shrink-0">
          {data && (
            <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
              {data.name?.split(' ').map(n => n[0]).join('')}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {isLoading
              ? <div className="h-4 w-32 bg-gray-700 rounded animate-pulse" />
              : <p className="font-semibold">{data?.name}</p>
            }
            <p className="text-xs text-gray-400">{workerId} · Worker Detail</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : data ? (
            <>
              {/* Utilization badge */}
              <div className="flex items-center gap-3">
                <UtilBadge value={data.utilization} />
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${data.utilization >= 70 ? 'bg-green-400'
                        : data.utilization >= 40 ? 'bg-amber-400'
                          : 'bg-red-400'
                      }`}
                    style={{ width: `${data.utilization}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-700">{data.utilization}%</span>
              </div>

              {/* Mini stats */}
              <div className="grid grid-cols-2 gap-3">
                <MiniStat icon={Clock} label="Active Time" value={data.activeTime} color="bg-green-500" />
                <MiniStat icon={Activity} label="Idle Time" value={data.idleTime} color="bg-amber-500" />
                <MiniStat icon={Package} label="Units Produced" value={data.unitCount} color="bg-blue-500" />
                <MiniStat icon={TrendingUp} label="Units / Hour" value={`${data.unitsPerHour}/hr`} color="bg-violet-500" />
              </div>

              {/* Hourly distribution chart */}
              {chartData.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Activity Distribution (by hour)
                  </h3>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        itemStyle={{ padding: '1px 0' }}
                      />
                      <Bar dataKey="working" name="Working" fill="#22c55e" radius={[2, 2, 0, 0]} stackId="a" />
                      <Bar dataKey="idle" name="Idle" fill="#f59e0b" radius={[0, 0, 0, 0]} stackId="a" />
                      <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[2, 2, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Recent events feed */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Recent Events ({data.recentEvents?.length ?? 0})
                </h3>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {(data.recentEvents || []).map(ev => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-2.5 bg-gray-50 rounded-lg px-3 py-2 text-xs"
                    >
                      <EventBadge type={ev.eventType} />
                      <span className="text-gray-500 flex-1 truncate">{ev.workstationName}</span>
                      {ev.count > 0 && (
                        <span className="text-blue-600 font-medium">+{ev.count} units</span>
                      )}
                      <span className="text-gray-400 whitespace-nowrap">
                        {new Date(ev.timestamp).toISOString().slice(11, 16)} UTC
                      </span>
                      <span
                        className="text-gray-300"
                        title={`Confidence: ${(ev.confidence * 100).toFixed(0)}%`}
                      >
                        {(ev.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No data available</p>
          )}
        </div>
      </div>
    </>
  )
}
