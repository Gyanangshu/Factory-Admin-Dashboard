import { useState } from 'react'
import { ChevronUp, ChevronDown, User } from 'lucide-react'
import { UtilBadge, MiniBar, SkeletonRow } from './shared'

const COLS = [
  { key: 'name',         label: 'Worker' },
  { key: 'utilization',  label: 'Utilization' },
  { key: 'activeTime',   label: 'Active Time' },
  { key: 'idleTime',     label: 'Idle Time' },
  { key: 'unitCount',    label: 'Units' },
  { key: 'unitsPerHour', label: 'Units/hr' },
]

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <ChevronUp size={12} className="text-gray-300" />
  return sortDir === 'asc'
    ? <ChevronUp size={12} className="text-blue-500" />
    : <ChevronDown size={12} className="text-blue-500" />
}

export default function WorkerTable({ workers, isLoading, onSelectWorker }) {
  const [sortKey, setSortKey] = useState('utilization')
  const [sortDir, setSortDir] = useState('desc')

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sorted = [...(workers || [])].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const maxUnits = Math.max(...(workers || []).map(w => w.unitCount), 1)

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <User size={14} className="text-blue-500" />
          Workers
          <span className="text-xs text-gray-400 font-normal ml-auto">Click row for detail</span>
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
              : sorted.map(w => (
                  <tr
                    key={w.workerId}
                    className="table-row-hover"
                    onClick={() => onSelectWorker(w.workerId)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {w.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 whitespace-nowrap">{w.name}</p>
                          <p className="text-xs text-gray-400">{w.workerId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 min-w-[80px]">
                        <UtilBadge value={w.utilization} />
                        <MiniBar
                          value={w.utilization}
                          color={w.utilization >= 70 ? 'bg-green-400' : w.utilization >= 40 ? 'bg-amber-400' : 'bg-red-400'}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{w.activeTime}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{w.idleTime}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-gray-800">{w.unitCount.toLocaleString()}</span>
                        <MiniBar value={w.unitCount} max={maxUnits} color="bg-violet-400" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{w.unitsPerHour}/hr</td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </section>
  )
}
