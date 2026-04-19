import { useState } from 'react'
import { ChevronUp, ChevronDown, Cpu } from 'lucide-react'
import { UtilBadge, MiniBar, SkeletonRow } from './shared'

const COLS = [
  { key: 'name',          label: 'Station' },
  { key: 'type',          label: 'Type' },
  { key: 'utilization',   label: 'Utilization' },
  { key: 'occupancyTime', label: 'Occupancy' },
  { key: 'unitCount',     label: 'Units' },
  { key: 'throughputRate',label: 'Throughput' },
]

const TYPE_COLORS = {
  Assembly:   'bg-blue-100 text-blue-700',
  QC:         'bg-purple-100 text-purple-700',
  Packaging:  'bg-green-100 text-green-700',
  Welding:    'bg-orange-100 text-orange-700',
  Inspection: 'bg-teal-100 text-teal-700',
}

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <ChevronUp size={12} className="text-gray-300" />
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="text-blue-500" />
    : <ChevronDown size={12} className="text-blue-500" />
}

export default function WorkstationTable({ workstations, isLoading }) {
  const [sortKey, setSortKey] = useState('utilization')
  const [sortDir, setSortDir] = useState('desc')

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...(workstations || [])].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const maxUnits = Math.max(...(workstations || []).map(w => w.unitCount), 1)

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Cpu size={14} className="text-violet-500" />
          Workstations
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              {COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="px-4 py-2.5 text-left font-medium cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
              : sorted.map(ws => (
                  <tr key={ws.workstationId} className="hover:bg-purple-50 transition-colors duration-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 whitespace-nowrap">{ws.name}</p>
                      <p className="text-xs text-gray-400">{ws.workstationId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[ws.type] || 'bg-gray-100 text-gray-700'}`}>
                        {ws.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 min-w-[80px]">
                        <UtilBadge value={ws.utilization} />
                        <MiniBar
                          value={ws.utilization}
                          color={ws.utilization >= 70 ? 'bg-green-400' : ws.utilization >= 40 ? 'bg-amber-400' : 'bg-red-400'}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{ws.occupancyTime}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-gray-800">{ws.unitCount.toLocaleString()}</span>
                        <MiniBar value={ws.unitCount} max={maxUnits} color="bg-violet-400" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{ws.throughputRate}/hr</td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </section>
  )
}
