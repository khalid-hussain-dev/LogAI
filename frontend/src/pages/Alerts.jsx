import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { authFetch } from '../services/auth'
import { SkeletonTable } from '../components/Skeleton'
import { useLogStream } from '../services/logStream'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''
const COLORS = { card: '#111827', background: '#0B1220', accentBlue: '#3B82F6', danger: '#EF4444', warning: '#F59E0B', aiCyan: '#22D3EE' }

const LEVEL_COLORS = {
  critical: { bg: 'rgba(239,68,68,0.2)', text: '#EF4444' },
  error: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
  warn: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  info: { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6' },
  debug: { bg: 'rgba(255,255,255,0.05)', text: '#9CA3AF' },
}

function mergeAlertList(prevAlerts, incomingAlert, limit) {
  if (!incomingAlert?.id) return prevAlerts
  return [incomingAlert, ...prevAlerts.filter(alert => alert.id !== incomingAlert.id)].slice(0, limit)
}

export default function Alerts() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [servers, setServers] = useState([])
  const [filters, setFilters] = useState({ server_id: '', limit: 50, offset: 0 })
  const knownAlertIdsRef = useRef(new Set())

  useEffect(() => {
    authFetch(`${BACKEND_URL}/api/v1/servers`).then(async response => {
      if (response?.ok) setServers(await response.json())
    }).catch(() => {})
  }, [])

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('anomaly_only', 'true')
      if (filters.server_id) params.set('server_id', filters.server_id)
      params.set('limit', String(filters.limit))
      params.set('offset', String(filters.offset))

      const response = await authFetch(`${BACKEND_URL}/api/v1/logs?${params.toString()}`)
      if (response?.ok) {
        const data = await response.json()
        const nextAlerts = data.logs || []
        knownAlertIdsRef.current = new Set(nextAlerts.map(log => log.id).filter(Boolean))
        setAlerts(nextAlerts)
        setTotal(data.total || 0)
      } else {
        knownAlertIdsRef.current = new Set()
        setAlerts([])
        setTotal(0)
      }
    } catch {
      knownAlertIdsRef.current = new Set()
      setAlerts([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const handleIncomingAnomaly = useCallback((log) => {
    if (!log?.id) return
    if (filters.server_id && log.server_id !== filters.server_id) return

    const isNewAlert = !knownAlertIdsRef.current.has(log.id)
    knownAlertIdsRef.current.add(log.id)

    if (isNewAlert) {
      setTotal(prev => prev + 1)
    }

    if (filters.offset !== 0) return

    setAlerts(prevAlerts => mergeAlertList(prevAlerts, log, filters.limit))
  }, [filters.server_id, filters.offset, filters.limit])

  useLogStream({
    serverId: filters.server_id || null,
    onAnomaly: handleIncomingAnomaly,
  })

  const handleFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value, offset: 0 }))
  const formatTime = (timestamp) => timestamp ? new Date(typeof timestamp === 'number' ? timestamp : parseInt(timestamp, 10)).toLocaleString() : '--'
  const currentPage = Math.floor(filters.offset / filters.limit) + 1
  const totalPages = Math.ceil(total / filters.limit)
  const inputStyle = { backgroundColor: COLORS.background, borderColor: 'rgba(255,255,255,0.1)' }

  return (
    <DashboardLayout title="Alert Intelligence" subtitle="AI-detected anomalies and unusual behavioral patterns">
      <div className="glass-card rounded-2xl p-5 mb-6 flex flex-wrap gap-4 items-center">
        <select value={filters.server_id} onChange={e => handleFilter('server_id', e.target.value)}
          className="px-4 py-2.5 text-sm rounded-xl border text-slate-300 focus:outline-none bg-transparent focus:border-cyan-500/30 transition-all cursor-pointer" style={inputStyle}>
          <option value="" className="bg-[#0B1220]">All Servers</option>
          {servers.map(server => <option key={server.id} value={server.id} className="bg-[#0B1220]">{server.name}</option>)}
        </select>
        <button onClick={fetchAlerts} className="p-2.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 rounded-xl transition-all duration-200 cursor-pointer">
          <RefreshCw className="w-4.5 h-4.5" />
        </button>
        <button onClick={() => navigate('/logs')} className="ml-auto flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer">
          View all logs <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="text-sm font-semibold tracking-wider uppercase text-slate-500 mb-3">{loading ? 'Scanning signals...' : `${total.toLocaleString()} anomal${total !== 1 ? 'ies' : 'y'} detected`}</div>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <SkeletonTable rows={10} />
        ) : alerts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cyan-500/10 bg-cyan-950/20 shadow-xl shadow-cyan-950/40">
              <AlertTriangle className="w-8 h-8 text-cyan-400" />
            </div>
            <p className="text-slate-300 font-bold mb-1.5 text-lg">No anomalies detected</p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">Your systems look healthy. Anomalies will appear here when AI detects unusual patterns.</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5" style={{ backgroundColor: 'rgba(5, 9, 20, 0.4)' }}>
                  <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Timestamp</th>
                  <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Severity</th>
                  <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Alert Description</th>
                  <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Source</th>
                  <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {alerts.map(log => {
                  const levelColors = LEVEL_COLORS[log.level] || LEVEL_COLORS.debug
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors bg-rose-500/[0.015] relative">
                      <td className="py-3.5 px-5 text-xs text-slate-500 font-mono whitespace-nowrap relative">
                        <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: levelColors.text }} />
                        {formatTime(log.timestamp)}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-md border"
                          style={{ backgroundColor: levelColors.bg, color: levelColors.text, borderColor: `${levelColors.text}25` }}>
                          {log.level}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-200 font-mono text-sm max-w-[480px] truncate" title={log.message}>{log.message}</td>
                      <td className="py-3.5 px-5 text-slate-400 text-sm font-medium">{log.server_name || '--'}</td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shadow-[0_0_8px_#f43f5e]" />
                          {(log.anomaly_score * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-sm font-medium text-slate-500">Page {currentPage} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setFilters(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))} disabled={filters.offset === 0}
              className="px-4 py-2 text-sm font-bold rounded-xl border border-white/10 text-slate-300 bg-[#0B1220]/40 hover:bg-[#0B1220] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">Previous</button>
            <button onClick={() => setFilters(prev => ({ ...prev, offset: prev.offset + prev.limit }))} disabled={filters.offset + filters.limit >= total}
              className="px-4 py-2 text-sm font-bold rounded-xl border border-white/10 text-slate-300 bg-[#0B1220]/40 hover:bg-[#0B1220] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">Next</button>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
