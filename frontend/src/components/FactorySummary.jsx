import { Clock, Package, TrendingUp, Users } from 'lucide-react'

function StatCard({ icon: Icon, label, value, sub, color, loading }) {
  return (
    <div className="stat-card flex items-start gap-4 shadow-md shadow-blue-100 border-2 border-gray-200">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{label}</p>
        {loading ? (
          <div className="h-7 w-24 bg-gray-100 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 mt-0.5 leading-none">{value ?? '—'}</p>
        )}
        {sub && !loading && (
          <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>
        )}
      </div>
    </div>
  )
}

export default function FactorySummary({ data, isLoading }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Factory Overview
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Total Productive Time"
          value={data?.totalActiveTime}
          sub={`Across ${data?.totalWorkers ?? 6} workers`}
          color="bg-blue-500"
          loading={isLoading}
        />
        <StatCard
          icon={Package}
          label="Units Produced"
          value={data?.totalProductionCount?.toLocaleString()}
          sub="This shift"
          color="bg-green-500"
          loading={isLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Utilization"
          value={data?.avgUtilization != null ? `${data.avgUtilization}%` : null}
          sub="Across all workers"
          color="bg-violet-500"
          loading={isLoading}
        />
        <StatCard
          icon={Users}
          label="Avg Production Rate"
          value={data?.avgProductionRate != null ? `${data.avgProductionRate}/hr` : null}
          sub="Units per active hour"
          color="bg-amber-500"
          loading={isLoading}
        />
      </div>
    </section>
  )
}
