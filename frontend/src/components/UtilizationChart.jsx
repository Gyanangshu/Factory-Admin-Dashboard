import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'

function getUtilColor(util) {
  if (util >= 70) return '#22c55e'
  if (util >= 40) return '#f59e0b'
  return '#ef4444'
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-800 mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-500 w-28">{p.name}</span>
          <span className="font-medium text-gray-800">
            {p.name === 'Utilization %' ? `${p.value}%` : `${p.value} u/hr`}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function UtilizationChart({ workers, isLoading }) {
  const data = (workers || []).map(w => ({
    name:         w.name.split(' ')[0],  // first name only for axis
    fullName:     w.name,
    activeHours:  parseFloat((w.activeMs / 3_600_000).toFixed(2)),
    idleHours:    parseFloat((w.idleMs   / 3_600_000).toFixed(2)),
    utilization:  w.utilization,
    unitsPerHour: w.unitsPerHour,
    color:        getUtilColor(w.utilization),
  }))

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Worker Utilization</h2>
          <p className="text-xs text-gray-400 mt-0.5">Active vs Idle hours · Units per hour (line)</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> ≥70%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 40–70%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> &lt;40%</span>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 bg-gray-50 rounded-lg animate-pulse" />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="hours"
              label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="rate"
              orientation="right"
              label={{ value: 'Units/hr', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#9ca3af' } }}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar yAxisId="hours" dataKey="activeHours" name="Active hrs" stackId="a" radius={[0, 0, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Bar>
            <Bar yAxisId="hours" dataKey="idleHours" name="Idle hrs" stackId="a" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
            <Line
              yAxisId="rate"
              type="monotone"
              dataKey="unitsPerHour"
              name="Utilization %"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </section>
  )
}
