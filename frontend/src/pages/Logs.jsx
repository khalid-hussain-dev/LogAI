import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RefreshCw, FileText } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { authFetch } from '../services/auth'
import { SkeletonTable } from '../components/Skeleton'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''
const COLORS = { card: '#111827', background: '#0B1220', accentBlue: '#3B82F6', danger: '#EF4444', warning: '#F59E0B', success: '#10B981' }

const LEVEL_COLORS = {
  critical: { bg: `${COLORS.danger}20`, text: COLORS.danger },
  error: { bg: `${COLORS.danger}15`, text: '#f87171' },
  warn: { bg: `${COLORS.warning}15`, text: COLORS.warning },
  warning: { bg: `${COLORS.warning}15`, text: COLORS.warning },
  info: { bg: `${COLORS.accentBlue}15`, text: COLORS.accentBlue },
  debug: { bg: 'rgba(255,255,255,0.05)', text: '#9CA3AF' },
}

export default function Logs() {
  const [searchParams] = useSearchParams()
  const anomalyFromUrl = searchParams.get('anomaly_only') === 'true'
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [servers, setServers] = useState([])
  const [filters, setFilters] = useState({ server_id: '', level: '', search: '', anomaly_only: anomalyFromUrl, limit: 50, offset: 0 })

  useEffect(() => {
    setFilters(f => ({ ...f, anomaly_only: anomalyFromUrl, offset: 0 }))
  }, [anomalyFromUrl])

  useEffect(() => {
    authFetch(`${BACKEND_URL}/api/v1/servers`).then(async r => { if (r?.ok) setServers(await r.json()) }).catch(() => {})
  }, [])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (filters.server_id) p.set('server_id', filters.server_id)
      if (filters.level) p.set('level', filters.level)
      if (filters.search) p.set('search', filters.search)
      if (filters.anomaly_only) p.set('anomaly_only', 'true')
      p.set('limit', String(filters.limit)); p.set('offset', String(filters.offset))
      const res = await authFetch(`${BACKEND_URL}/api/v1/logs?${p.toString()}`)
      if (res?.ok) { const d = await res.json(); setLogs(d.logs || []); setTotal(d.total || 0) }
    } catch { setLogs([]); setTotal(0) } finally { setLoading(false) }
  }

  useEffect(() => { fetchLogs() }, [filters])

  const handleFilter = (key, val) => setFilters(f => ({ ...f, [key]: val, offset: 0 }))
  const formatTime = (ts) => ts ? new Date(typeof ts === 'number' ? ts : parseInt(ts)).toLocaleString() : '—'
  const currentPage = Math.floor(filters.offset / filters.limit) + 1
  const totalPages = Math.ceil(total / filters.limit)

  const inputStyle = { backgroundColor: COLORS.background, borderColor: 'rgba(255,255,255,0.1)' }

  return (
    <DashboardLayout title="Telemetry Archives" subtitle="Query, filter, and inspect processed system log streams">
      {/* Filters */}
      <div className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <svg className="w-4 h-4 text-cyan-400/60 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Search logs..." value={filters.search} onChange={e => handleFilter('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all duration-200" style={inputStyle} />
          </div>
          
          <select value={filters.server_id} onChange={e => handleFilter('server_id', e.target.value)}
            className="px-4 py-2.5 text-sm rounded-xl border text-slate-300 focus:outline-none bg-transparent focus:border-cyan-500/30 transition-all cursor-pointer" style={inputStyle}>
            <option value="" className="bg-[#0B1220]">All Servers</option>
            {servers.map(s => <option key={s.id} value={s.id} className="bg-[#0B1220]">{s.name}</option>)}
          </select>
          
          <select value={filters.level} onChange={e => handleFilter('level', e.target.value)}
            className="px-4 py-2.5 text-sm rounded-xl border text-slate-300 focus:outline-none bg-transparent focus:border-cyan-500/30 transition-all cursor-pointer" style={inputStyle}>
            <option value="" className="bg-[#0B1220]">All Levels</option>
            <option value="critical" className="bg-[#0B1220]">Critical</option>
            <option value="error" className="bg-[#0B1220]">Error</option>
            <option value="warn" className="bg-[#0B1220]">Warning</option>
            <option value="info" className="bg-[#0B1220]">Info</option>
            <option value="debug" className="bg-[#0B1220]">Debug</option>
          </select>
          
          <label className="flex items-center gap-2.5 text-sm text-slate-400 cursor-pointer select-none py-1.5 px-3 rounded-lg hover:bg-white/[0.02] transition-colors">
            <input type="checkbox" checked={filters.anomaly_only} onChange={e => handleFilter('anomaly_only', e.target.checked)} 
              className="w-4 h-4 rounded text-cyan-500 bg-transparent border-slate-700 accent-cyan-500 focus:ring-0 cursor-pointer" />
            <span>Anomalies only</span>
          </label>
          
          <button onClick={fetchLogs} 
            className="p-2.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 rounded-xl transition-all duration-200 cursor-pointer">
            <RefreshCw className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      <div className="text-sm font-semibold tracking-wider uppercase text-slate-500 mb-3">{loading ? 'Searching index...' : `${total.toLocaleString()} log events found`}</div>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <SkeletonTable rows={12} />
        ) : logs.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cyan-500/10 bg-cyan-950/20 shadow-xl shadow-cyan-950/40">
              <FileText className="w-8 h-8 text-cyan-400" />
            </div>
            <p className="text-slate-300 font-bold mb-1.5 text-lg">No logs matched criteria</p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">Adjust search string or check configuration settings to populate telemetry.</p>
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5" style={{ backgroundColor: 'rgba(5, 9, 20, 0.4)' }}>
                  <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Timestamp</th>
                  <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Level</th>
                  <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Message Payload</th>
                  <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Service</th>
                  <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500">Source Host</th>
                  <th className="py-4 px-5 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Anomaly Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map(log => {
                  const lc = LEVEL_COLORS[log.level] || LEVEL_COLORS.debug
                  const isAnomaly = !!log.anomaly
                  
                  return (
                    <tr key={log.id} 
                      className={`hover:bg-white/[0.02] transition-colors relative group ${
                        isAnomaly ? 'bg-rose-500/[0.015]' : ''
                      }`}>
                      <td className="py-3.5 px-5 text-xs text-slate-500 font-mono whitespace-nowrap relative">
                        {/* vertical line indicator of level */}
                        <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: lc.text }} />
                        {formatTime(log.timestamp)}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-md border" 
                          style={{ backgroundColor: lc.bg, color: lc.text, borderColor: `${lc.text}25` }}>
                          {log.level}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-200 font-mono text-sm max-w-[480px] truncate" title={log.message}>
                        {log.message}
                      </td>
                      <td className="py-3.5 px-5 text-slate-400 text-sm font-medium">{log.service || '—'}</td>
                      <td className="py-3.5 px-5 text-slate-400 text-sm font-medium">{log.server_name || '—'}</td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        {isAnomaly ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse shadow-[0_0_8px_#f43f5e]" />
                            {(log.anomaly_score * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600 font-semibold">—</span>
                        )}
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
            <button onClick={() => setFilters(f => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))} disabled={filters.offset === 0}
              className="px-4 py-2 text-sm font-bold rounded-xl border border-white/10 text-slate-300 bg-[#0B1220]/40 hover:bg-[#0B1220] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">Previous</button>
            <button onClick={() => setFilters(f => ({ ...f, offset: f.offset + f.limit }))} disabled={filters.offset + filters.limit >= total}
              className="px-4 py-2 text-sm font-bold rounded-xl border border-white/10 text-slate-300 bg-[#0B1220]/40 hover:bg-[#0B1220] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">Next</button>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
