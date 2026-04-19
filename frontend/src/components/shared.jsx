export function getUtilClass(util) {
  if (util >= 70) return 'util-high'
  if (util >= 40) return 'util-medium'
  return 'util-low'
}

export function UtilBadge({ value }) {
  return (
    <span className={`util-badge ${getUtilClass(value)}`}>
      {value}%
    </span>
  )
}

export function EventBadge({ type }) {
  const labels = {
    working:       'Working',
    idle:          'Idle',
    absent:        'Absent',
    product_count: 'Production',
  }
  return (
    <span className={`event-badge event-${type}`}>
      {labels[type] ?? type}
    </span>
  )
}

export function MiniBar({ value, max = 100, color = 'bg-blue-500' }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function SkeletonRow({ cols = 6 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-100 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  )
}
