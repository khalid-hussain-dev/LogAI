import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Gauge,
  Layers3,
  Pause,
  Play,
  Radio,
  Search,
  Server as ServerIcon,
  ShieldCheck,
  Sparkles,
  Terminal,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import DashboardLayout from '../components/DashboardLayout'
import { SkeletonCard } from '../components/Skeleton'
import { authFetch } from '../services/auth'
import { useLogStream } from '../services/logStream'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''
const MAX_LIVE_LOGS = 22

const COLORS = {
  background: '#050914',
  card: 'rgba(10, 18, 32, 0.76)',
  cardStrong: 'rgba(12, 22, 39, 0.92)',
  accentBlue: '#38BDF8',
  accentPurple: '#A78BFA',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#FB7185',
  aiCyan: '#22D3EE',
}

const LEVEL_STYLES = {
  critical: {
    label: 'CRITICAL',
    border: 'rgba(251,113,133,0.55)',
    bg: 'rgba(251,113,133,0.16)',
    text: '#FB7185',
    glow: '0 0 28px rgba(251,113,133,0.16)',
  },
  error: {
    label: 'ERROR',
    border: 'rgba(248,113,113,0.45)',
    bg: 'rgba(248,113,113,0.13)',
    text: '#F87171',
    glow: '0 0 22px rgba(248,113,113,0.12)',
  },
  warn: {
    label: 'WARN',
    border: 'rgba(251,191,36,0.42)',
    bg: 'rgba(251,191,36,0.13)',
    text: '#FBBF24',
    glow: '0 0 20px rgba(251,191,36,0.1)',
  },
  warning: {
    label: 'WARN',
    border: 'rgba(251,191,36,0.42)',
    bg: 'rgba(251,191,36,0.13)',
    text: '#FBBF24',
    glow: '0 0 20px rgba(251,191,36,0.1)',
  },
  info: {
    label: 'INFO',
    border: 'rgba(56,189,248,0.35)',
    bg: 'rgba(56,189,248,0.12)',
    text: '#38BDF8',
    glow: 'none',
  },
  debug: {
    label: 'DEBUG',
    border: 'rgba(148,163,184,0.28)',
    bg: 'rgba(148,163,184,0.08)',
    text: '#94A3B8',
    glow: 'none',
  },
}

const REPLAY_LOGS = [
  { level: 'info', message: 'checkout-api received POST /checkout from production website', service: 'checkout-api' },
  { level: 'info', message: 'payment-service created transaction intent for cart session', service: 'payment-service' },
  { level: 'warn', message: 'database query latency crossed 620ms on orders table', service: 'postgres-primary' },
  { level: 'error', message: 'checkout-api timeout while waiting for payment confirmation', service: 'checkout-api', anomaly: true },
  { level: 'critical', message: 'AI anomaly detected: checkout error burst above baseline', service: 'logai-ai', anomaly: true },
  { level: 'info', message: 'root cause hypothesis: database lock contention during checkout flow', service: 'logai-ai', anomaly: true },
  { level: 'warn', message: 'Slack alert dispatched to incident-response channel', service: 'alerts' },
  { level: 'info', message: 'recommended fix: inspect long-running orders transaction and restart worker pool', service: 'logai-ai' },
]

const SPARKLINE = [
  { t: '00', logs: 18, errors: 1, latency: 170 },
  { t: '05', logs: 32, errors: 2, latency: 210 },
  { t: '10', logs: 27, errors: 1, latency: 180 },
  { t: '15', logs: 46, errors: 4, latency: 260 },
  { t: '20', logs: 61, errors: 5, latency: 320 },
  { t: '25', logs: 54, errors: 2, latency: 240 },
  { t: '30', logs: 72, errors: 7, latency: 390 },
  { t: '35', logs: 66, errors: 3, latency: 270 },
  { t: '40', logs: 88, errors: 8, latency: 430 },
  { t: '45', logs: 73, errors: 4, latency: 310 },
]

function normalizeHourlyData(buckets = []) {
  return buckets.map((bucket, index) => {
    const rawTime = bucket.hour || bucket.time || bucket.label || bucket.t || ''
    const parsed = rawTime ? new Date(rawTime) : null
    const time = parsed && !Number.isNaN(parsed.getTime())
      ? parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : rawTime || `${String(index * 5).padStart(2, '0')}m`

    return {
      t: time,
      logs: bucket.count || bucket.logs || 0,
      errors: bucket.errors || 0,
      anomalies: bucket.anomalies || 0,
      latency: bucket.latency || bucket.duration_ms || 120,
    }
  })
}

function buildFallbackMetrics({ liveLogs, totalLogs, totalErrors, totalAnomalies, servers }) {
  const serverLogs = servers.reduce((sum, server) => sum + (server.log_count_24h || 0), 0)
  const serverErrors = servers.reduce((sum, server) => sum + (server.error_count_24h || 0), 0)
  const serverAnomalies = servers.reduce((sum, server) => sum + (server.anomaly_count_24h || 0), 0)
  const logsBase = Math.max(totalLogs, serverLogs, liveLogs.length)
  const errorsBase = Math.max(totalErrors, serverErrors, liveLogs.filter(log => ['error', 'critical'].includes((log.level || '').toLowerCase())).length)
  const anomaliesBase = Math.max(totalAnomalies, serverAnomalies, liveLogs.filter(log => log.anomaly).length)

  if (logsBase === 0) {
    return SPARKLINE.map(point => ({ ...point, logs: 0, errors: 0, anomalies: 0, latency: 120 }))
  }

  const maxWeight = Math.max(...SPARKLINE.map(point => point.logs))
  return SPARKLINE.map((point, index) => {
    const weight = point.logs / maxWeight
    const liveBoost = liveLogs[index % Math.max(liveLogs.length, 1)] ? 1 : 0
    return {
      ...point,
      logs: Math.max(1, Math.round((logsBase / SPARKLINE.length) * (0.55 + weight))),
      errors: Math.round((errorsBase / SPARKLINE.length) * (0.35 + weight)),
      anomalies: Math.round((anomaliesBase / SPARKLINE.length) * (0.25 + weight)),
      latency: Math.round(130 + weight * 220 + liveBoost * 35 + errorsBase * 2),
    }
  })
}

function mergeLiveLog(prevLogs, incomingLog) {
  if (!incomingLog?.id) return prevLogs
  return [incomingLog, ...prevLogs.filter(log => log.id !== incomingLog.id)].slice(0, MAX_LIVE_LOGS)
}

function formatTime(timestamp) {
  if (!timestamp) return new Date().toLocaleTimeString()
  const value = typeof timestamp === 'number' ? timestamp : parseInt(timestamp, 10)
  return Number.isNaN(value) ? '--:--:--' : new Date(value).toLocaleTimeString()
}

function commandStatus(connectionState, totalErrors, totalAnomalies) {
  if (connectionState === 'connected' && totalErrors === 0 && totalAnomalies === 0) {
    return { label: 'Operational', color: COLORS.success, tone: 'All monitored services are inside normal behavior.' }
  }
  if (totalAnomalies > 0) {
    return { label: 'AI Investigating', color: COLORS.warning, tone: 'Anomaly evidence detected. Intelligence layer is correlating symptoms.' }
  }
  if (totalErrors > 0) {
    return { label: 'Degraded', color: COLORS.danger, tone: 'Error activity detected. Watch the live stream and AI panel.' }
  }
  if (connectionState === 'reconnecting') {
    return { label: 'Reconnecting', color: COLORS.warning, tone: 'Live telemetry channel is restoring connection.' }
  }
  return { label: 'Syncing', color: COLORS.accentBlue, tone: 'Telemetry stream is preparing.' }
}

function StatCard({ icon: Icon, label, value, color, helper, delay = 0 }) {
  const hoverClass = color === COLORS.accentBlue 
    ? 'hover-glow-blue' 
    : color === COLORS.danger 
      ? 'hover-glow-purple' 
      : color === COLORS.warning 
        ? 'hover-glow-cyan' 
        : 'hover-glow-blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className={`group relative overflow-hidden rounded-2xl glass-card p-5 ${hoverClass}`}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
      <div
        className="absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-60"
        style={{ backgroundColor: `${color}25` }}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</p>
          <div className="mt-3 flex items-end gap-2">
            <motion.h3
              key={value}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-black tracking-tight text-white"
            >
              {value}
            </motion.h3>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">{helper}</p>
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 group-hover:scale-105"
          style={{ color, backgroundColor: `${color}12`, borderColor: `${color}25` }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-white/[0.04]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: value === '0' || value === '0.0%' ? '18%' : '78%' }}
          transition={{ duration: 1.1, delay: delay + 0.1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${COLORS.aiCyan})` }}
        />
      </div>
    </motion.div>
  )
}

function AiCore({ statusColor, totalAnomalies, replaying }) {
  const nodes = [0, 1, 2, 3, 4, 5, 6]
  return (
    <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035]">
      <div className="absolute inset-0 command-grid opacity-50" />
      <motion.div
        className="absolute h-36 w-36 rounded-full border border-cyan-300/20"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute h-24 w-24 rounded-full border border-purple-300/25"
        animate={{ rotate: -360 }}
        transition={{ duration: 13, repeat: Infinity, ease: 'linear' }}
      />
      {nodes.map((node) => {
        const angle = (node / nodes.length) * Math.PI * 2
        const x = Math.cos(angle) * 56
        const y = Math.sin(angle) * 42
        return (
          <motion.span
            key={node}
            className="absolute h-2.5 w-2.5 rounded-full"
            style={{
              x,
              y,
              backgroundColor: node % 2 ? COLORS.accentPurple : COLORS.aiCyan,
              boxShadow: `0 0 18px ${node % 2 ? COLORS.accentPurple : COLORS.aiCyan}`,
            }}
            animate={{ scale: [0.75, 1.25, 0.75], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: node * 0.16 }}
          />
        )
      })}
      <motion.div
        className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-slate-950/80 shadow-2xl"
        style={{ boxShadow: `0 0 44px ${statusColor}33` }}
        animate={{ scale: totalAnomalies > 0 || replaying ? [1, 1.08, 1] : [1, 1.03, 1] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      >
        <BrainCircuit className="h-9 w-9" style={{ color: statusColor }} />
      </motion.div>
    </div>
  )
}

function LiveLogRow({ log, index }) {
  const level = (log.level || 'debug').toLowerCase()
  const style = LEVEL_STYLES[level] || LEVEL_STYLES.debug
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.98 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.015, 0.12) }}
      className="group grid grid-cols-[76px_96px_minmax(0,1fr)_126px] items-center gap-3 border-b border-white/[0.055] px-4 py-3 transition-colors hover:bg-white/[0.035]"
      style={{ boxShadow: log.anomaly ? style.glow : 'none' }}
    >
      <span className="font-mono text-[12px] text-slate-500">{formatTime(log.timestamp)}</span>
      <span
        className="w-fit rounded-md border px-2.5 py-1 text-[11px] font-bold tracking-[0.12em]"
        style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}
      >
        {style.label}
      </span>
      <div className="min-w-0">
        <p className="truncate font-mono text-sm text-slate-200">{log.message}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{log.service || log.server_name || 'application'} / {log.host || 'live-node'}</p>
      </div>
      <span className="justify-self-end rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-400">
        {log.anomaly ? 'AI flagged' : 'streamed'}
      </span>
    </motion.div>
  )
}

function TimelineItem({ icon: Icon, title, detail, color, active }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="relative flex gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3"
    >
      <div
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
        style={{ color, borderColor: `${color}35`, backgroundColor: `${color}12` }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white">{title}</p>
          {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />}
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
      </div>
    </motion.div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedServer, setSelectedServer] = useState(null)
  const [streamPaused, setStreamPaused] = useState(false)
  const [logQuery, setLogQuery] = useState('')
  const [replaying, setReplaying] = useState(false)
  const [replayStep, setReplayStep] = useState(0)

  const [totalLogs, setTotalLogs] = useState(0)
  const [totalErrors, setTotalErrors] = useState(0)
  const [totalAnomalies, setTotalAnomalies] = useState(0)
  const [liveLogs, setLiveLogs] = useState([])
  const [hourlyActivity, setHourlyActivity] = useState([])

  const fetchAllServersOverview = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch servers list (independent)
      try {
        const serversResponse = await authFetch(`${BACKEND_URL}/api/v1/servers`)
        if (serversResponse?.ok) {
          const serverData = await serversResponse.json()
          setServers(serverData)
        }
      } catch (err) {
        console.error("Failed to load servers:", err)
      }

      // 2. Fetch overview data (independent)
      try {
        const overviewResponse = await authFetch(`${BACKEND_URL}/api/v1/servers/dashboard/overview`)
        if (overviewResponse?.ok) {
          const overview = await overviewResponse.json()
          setTotalLogs(overview.total_logs_24h || 0)
          setTotalErrors(overview.total_errors_24h || 0)
          setTotalAnomalies(overview.total_anomalies_24h || 0)
          setHourlyActivity(normalizeHourlyData(overview.hourly_activity || overview.hourly || []))
        }
      } catch (err) {
        console.error("Failed to load overview:", err)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSingleServerMetrics = useCallback(async (server) => {
    setLoading(true)
    try {
      // 1. Fetch servers list (independent)
      try {
        const serversResponse = await authFetch(`${BACKEND_URL}/api/v1/servers`)
        if (serversResponse?.ok) {
          const serverData = await serversResponse.json()
          setServers(serverData)
        }
      } catch (err) {
        console.error("Failed to load servers:", err)
      }

      // 2. Fetch single server metrics (independent)
      try {
        const metricsResponse = await authFetch(`${BACKEND_URL}/api/v1/servers/${server.id}/metrics`)
        if (metricsResponse?.ok) {
          const metrics = await metricsResponse.json()
          const severity = metrics.severity || {}
          setTotalLogs(metrics.total_logs || 0)
          setTotalAnomalies(metrics.total_anomalies || 0)
          setTotalErrors((severity.error || 0) + (severity.critical || 0))
          setHourlyActivity(normalizeHourlyData(metrics.hourly || metrics.hourly_activity || []))
        }
      } catch (err) {
        console.error("Failed to load metrics:", err)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLiveLogs = useCallback(async () => {
    try {
      const serverId = selectedServer?.id
      const url = serverId
        ? `${BACKEND_URL}/api/v1/logs?server_id=${serverId}&limit=${MAX_LIVE_LOGS}`
        : `${BACKEND_URL}/api/v1/logs?limit=${MAX_LIVE_LOGS}`

      const response = await authFetch(url)
      if (response?.ok) {
        const payload = await response.json()
        setLiveLogs(payload.logs || [])
      }
    } catch {
      setLiveLogs([])
    }
  }, [selectedServer?.id])

  useEffect(() => {
    fetchLiveLogs()
  }, [fetchLiveLogs])

  const handleStreamLog = useCallback((log) => {
    if (!log) return

    setTotalLogs(prev => prev + 1)
    if (log.level === 'error' || log.level === 'critical') setTotalErrors(prev => prev + 1)
    if (log.anomaly) setTotalAnomalies(prev => prev + 1)
    if (!streamPaused) setLiveLogs(prev => mergeLiveLog(prev, log))
  }, [streamPaused])

  const handleStreamAnomaly = useCallback((log) => {
    if (!log?.id) return
    setLiveLogs(prev => prev.map(item => (item.id === log.id ? { ...item, ...log } : item)))
  }, [])

  const { connectionState } = useLogStream({
    serverId: selectedServer?.id,
    onLog: handleStreamLog,
    onAnomaly: handleStreamAnomaly,
  })

  useEffect(() => {
    fetchAllServersOverview()
  }, [fetchAllServersOverview])

  useEffect(() => {
    if (!replaying) return undefined
    if (replayStep >= REPLAY_LOGS.length) {
      const stop = setTimeout(() => setReplaying(false), 900)
      return () => clearTimeout(stop)
    }

    const timer = setTimeout(() => {
      const replayLog = REPLAY_LOGS[replayStep]
      const nextLog = {
        ...replayLog,
        id: `incident-replay-${Date.now()}-${replayStep}`,
        timestamp: Date.now(),
        host: selectedServer?.name || 'github-pages-site',
      }
      setLiveLogs(prev => mergeLiveLog(prev, nextLog))
      setTotalLogs(prev => prev + 1)
      if (nextLog.level === 'error' || nextLog.level === 'critical') setTotalErrors(prev => prev + 1)
      if (nextLog.anomaly) setTotalAnomalies(prev => prev + 1)
      setReplayStep(prev => prev + 1)
    }, replayStep === 0 ? 150 : 850)

    return () => clearTimeout(timer)
  }, [replaying, replayStep, selectedServer?.name])

  const handleServerChange = (server) => {
    setSelectedServer(server)
    if (!server) fetchAllServersOverview()
    else fetchSingleServerMetrics(server)
  }

  const startReplay = () => {
    setReplayStep(0)
    setReplaying(true)
    setStreamPaused(false)
  }

  const viewLabel = selectedServer ? selectedServer.name : 'All Servers'
  const errorRate = totalLogs > 0 ? ((totalErrors / totalLogs) * 100).toFixed(1) : '0.0'
  const healthPct = totalLogs > 0 ? Math.max(0, ((1 - totalErrors / totalLogs) * 100)).toFixed(1) : '100.0'
  const activeServers = servers.filter(server => server.is_active).length
  const status = commandStatus(connectionState, totalErrors, totalAnomalies)
  const aiConfidence = Math.min(98, Math.max(totalAnomalies > 0 ? 78 : 31, totalAnomalies * 12 + totalErrors * 3 + 28))
  const liveStreamLabel = connectionState === 'connected'
    ? `Live telemetry active - ${viewLabel}`
    : connectionState === 'reconnecting'
      ? `Reconnecting telemetry - ${viewLabel}`
      : connectionState === 'unauthenticated'
        ? `Sign in to enable live telemetry - ${viewLabel}`
        : `Preparing telemetry - ${viewLabel}`

  const filteredLogs = useMemo(() => {
    const query = logQuery.trim().toLowerCase()
    if (!query) return liveLogs
    return liveLogs.filter(log => {
      return `${log.level || ''} ${log.message || ''} ${log.service || ''} ${log.server_name || ''}`.toLowerCase().includes(query)
    })
  }, [liveLogs, logQuery])

  const metricsChartData = useMemo(() => {
    const normalized = normalizeHourlyData(hourlyActivity)
    if (normalized.some(point => point.logs > 0 || point.errors > 0 || point.anomalies > 0)) return normalized
    return buildFallbackMetrics({ liveLogs, totalLogs, totalErrors, totalAnomalies, servers })
  }, [hourlyActivity, liveLogs, totalLogs, totalErrors, totalAnomalies, servers])

  const incidentTimeline = useMemo(() => [
    {
      icon: Radio,
      title: 'Telemetry Stream',
      detail: connectionState === 'connected' ? 'WebSocket channel is receiving real-time log frames.' : 'Waiting for live stream confirmation.',
      color: connectionState === 'connected' ? COLORS.success : COLORS.warning,
      active: connectionState === 'connected',
    },
    {
      icon: BrainCircuit,
      title: 'AI Correlation',
      detail: totalAnomalies > 0 ? `${totalAnomalies} anomaly signals are being correlated with error activity.` : 'Baseline is stable. No anomaly cluster currently active.',
      color: totalAnomalies > 0 ? COLORS.warning : COLORS.aiCyan,
      active: totalAnomalies > 0,
    },
    {
      icon: AlertCircle,
      title: 'Alert Routing',
      detail: totalErrors > 0 ? 'Errors are ready for Slack and email escalation policies.' : 'Alert channels standing by for incident thresholds.',
      color: totalErrors > 0 ? COLORS.danger : COLORS.accentBlue,
      active: totalErrors > 0,
    },
  ], [connectionState, totalAnomalies, totalErrors])

  return (
    <DashboardLayout
      servers={servers}
      selectedServer={selectedServer}
      onServerChange={handleServerChange}
    >
      {loading ? (
        <div className="space-y-6">
          <div>
            <div className="mb-2 h-8 w-64 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-80 animate-pulse rounded bg-white/10" />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="h-[520px] animate-pulse rounded-2xl bg-white/5" />
        </div>
      ) : (
        <div className="space-y-6">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl glass-card p-6"
          >
            <div className="absolute inset-0 command-grid opacity-30" />
            <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-3xl" />

            <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em]"
                    style={{ color: status.color, borderColor: `${status.color}35`, backgroundColor: `${status.color}10` }}
                  >
                    <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: status.color, boxShadow: `0 0 14px ${status.color}` }} />
                    {status.label}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300">
                    <Radio className="h-3.5 w-3.5 text-cyan-400" />
                    {connectionState === 'connected' ? 'Live WebSocket' : connectionState}
                  </span>
                </div>
                <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">
                  AI DevOps Command Center
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
                  Mission control for live logs, anomaly intelligence, incidents, and infrastructure health. Real telemetry keeps flowing while LogAI turns noisy system events into a clear operational story.
                </p>
              </div>

              <div className="grid min-w-[320px] grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500">Health</p>
                  <p className="mt-2 text-3xl font-black text-white">{healthPct}%</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500">AI State</p>
                  <p className="mt-2 text-lg font-black uppercase tracking-wider" style={{ color: totalAnomalies > 0 ? COLORS.warning : COLORS.aiCyan }}>
                    {totalAnomalies > 0 ? 'Detecting' : 'Monitoring'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startReplay}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-cyan-300 transition-all hover:bg-cyan-400/15 hover:border-cyan-400/35 cursor-pointer hover:scale-[1.01]"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  {replaying ? `Replaying Incident ${Math.min(replayStep + 1, REPLAY_LOGS.length)}/${REPLAY_LOGS.length}` : 'Run Incident Replay'}
                </button>
              </div>
            </div>
          </motion.section>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Layers3} label="Logs 24h" value={totalLogs.toLocaleString()} color={COLORS.accentBlue} helper={viewLabel} delay={0.02} />
            <StatCard icon={AlertCircle} label="Error Rate" value={`${errorRate}%`} color={COLORS.danger} helper={`${totalErrors.toLocaleString()} error events`} delay={0.08} />
            <StatCard icon={BrainCircuit} label="Anomalies" value={totalAnomalies.toString()} color={COLORS.warning} helper="AI-flagged signals" delay={0.14} />
            <StatCard icon={ShieldCheck} label="Active Nodes" value={`${activeServers}/${servers.length || 0}`} color={COLORS.success} helper="registered servers" delay={0.2} />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
            <section className="relative overflow-hidden rounded-3xl glass-card">
              <div className="absolute inset-0 data-scanlines opacity-20" />
              <div className="relative z-10 border-b border-white/5 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-400">
                      <Terminal className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Live Log Stream</h2>
                      <p className="text-xs text-slate-400">{streamPaused ? 'Visual stream paused. Metrics continue tracking.' : liveStreamLabel}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        value={logQuery}
                        onChange={(event) => setLogQuery(event.target.value)}
                        placeholder="Filter stream"
                        className="h-10 w-56 rounded-xl border border-white/5 bg-white/[0.02] pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/30 focus:bg-white/[0.05]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setStreamPaused(prev => !prev)}
                      className="flex h-10 items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.05] cursor-pointer"
                    >
                      {streamPaused ? <Play className="h-4 w-4 text-emerald-400" /> : <Pause className="h-4 w-4 text-cyan-400" />}
                      {streamPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/logs')}
                      className="flex h-10 items-center gap-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 px-3.5 text-xs font-bold text-slate-950 transition-colors cursor-pointer"
                    >
                      Open Logs
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="relative z-10 max-h-[560px] min-h-[460px] overflow-hidden">
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-[#050914] to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-20 bg-gradient-to-t from-[#050914] to-transparent" />
                {filteredLogs.length === 0 ? (
                  <div className="flex h-[460px] flex-col items-center justify-center px-6 text-center">
                    <Terminal className="mb-4 h-10 w-10 text-slate-600" />
                    <p className="text-base font-bold text-slate-300">Waiting for telemetry</p>
                    <p className="mt-2 max-w-sm text-xs leading-5 text-slate-500">
                      Operate your website or run the incident replay to watch logs flow through the command center.
                    </p>
                  </div>
                ) : (
                  <div className="h-[560px] overflow-y-auto pr-1 scrollbar-thin">
                    <AnimatePresence initial={false}>
                      {filteredLogs.map((log, index) => (
                        <LiveLogRow key={log.id || `${log.timestamp}-${index}`} log={log} index={index} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-6">
              <section className="rounded-3xl glass-card p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">AI Intelligence</p>
                    <h2 className="mt-1 text-lg font-bold text-white">Anomaly Brain</h2>
                  </div>
                  <motion.span
                    animate={{ opacity: [0.65, 1, 0.65] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em]"
                    style={{ color: status.color, borderColor: `${status.color}35`, backgroundColor: `${status.color}10` }}
                  >
                    {totalAnomalies > 0 ? 'Thinking' : 'Learning'}
                  </motion.span>
                </div>

                <AiCore statusColor={status.color} totalAnomalies={totalAnomalies} replaying={replaying} />

                <div className="mt-5 space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                      <span className="text-slate-400">Confidence</span>
                      <span className="text-white">{aiConfidence}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${COLORS.aiCyan}, ${COLORS.accentPurple}, ${status.color})` }}
                        animate={{ width: `${aiConfidence}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                    <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-500">Hypothesis</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      {totalAnomalies > 0
                        ? 'A burst of high-severity events suggests a service-level failure path. Inspect recent errors, affected host, and alert timeline.'
                        : 'No active anomaly cluster. LogAI is building a healthy baseline from incoming events.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate('/chat')}
                    className="flex w-full items-center justify-between rounded-2xl border border-purple-400/20 bg-purple-400/10 px-4.5 py-3 text-left text-xs font-bold uppercase tracking-wider text-purple-300 transition-all hover:bg-purple-400/15 cursor-pointer hover:border-purple-400/35 hover:scale-[1.01]"
                  >
                    <span>Ask AI for root cause</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </section>

              <section className="rounded-3xl glass-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Incident Feed</p>
                    <h2 className="mt-1 text-lg font-bold text-white">Alert Timeline</h2>
                  </div>
                  <Zap className="h-5 w-5 text-yellow-300 animate-bounce-subtle" />
                </div>
                <div className="space-y-3">
                  {incidentTimeline.map(item => (
                    <TimelineItem key={item.title} {...item} />
                  ))}
                </div>
              </section>
            </aside>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
            <section className="rounded-3xl glass-card p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Metrics Wall</p>
                  <h2 className="mt-1 text-lg font-bold text-white font-black">Traffic, Errors, and Latency</h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/analytics')}
                  className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 transition-all hover:bg-white/[0.05] cursor-pointer hover:border-white/10"
                >
                  <BarChart3 className="h-4 w-4 text-cyan-400" />
                  <span>View Analytics</span>
                </button>
              </div>
              <div className="h-[260px] scrollbar-thin">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metricsChartData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="logsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.aiCyan} stopOpacity={0.42} />
                        <stop offset="95%" stopColor={COLORS.aiCyan} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.accentPurple} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={COLORS.accentPurple} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: 'rgba(5, 9, 20, 0.95)', border: '1px solid rgba(34,211,238,0.15)', borderRadius: 12, color: '#fff' }}
                      labelStyle={{ color: '#94A3B8', fontWeight: 600 }}
                    />
                    <Area type="monotone" dataKey="logs" stroke={COLORS.aiCyan} strokeWidth={3} fill="url(#logsGradient)" dot={false} />
                    <Area type="monotone" dataKey="latency" stroke={COLORS.accentPurple} strokeWidth={2} fill="url(#latencyGradient)" dot={false} />
                    <Area type="monotone" dataKey="errors" stroke={COLORS.danger} strokeWidth={2} fill="transparent" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-3xl glass-card p-5">
              <div className="mb-4 flex items-center gap-3">
                <ServerIcon className="h-5 w-5 text-cyan-400" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Fleet</p>
                  <h2 className="text-lg font-bold text-white font-black">Server Status</h2>
                </div>
              </div>

              {servers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-6 text-center">
                  <p className="text-xs text-slate-400">No servers registered yet.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/servers')}
                    className="mt-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 px-4 py-2 text-xs font-bold text-slate-950 transition-colors cursor-pointer"
                  >
                    Create server
                  </button>
                </div>
              ) : (
                <div className="max-h-[292px] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
                  {(selectedServer ? servers.filter(server => server.id === selectedServer.id) : servers).map(server => (
                    <motion.div
                      key={server.id}
                      whileHover={{ x: 4 }}
                      className="rounded-2xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-cyan-400/25 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{server.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{server.log_count_24h} logs / {server.error_count_24h} errors / {server.anomaly_count_24h} anomalies</p>
                        </div>
                        {server.is_active ? (
                          <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-400" />
                        ) : (
                          <XCircle className="h-4.5 w-4.5 shrink-0 text-rose-400" />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 backdrop-blur-xl hover:border-cyan-500/10 transition-colors">
              <Cpu className="mb-3 h-5 w-5 text-cyan-400" />
              <p className="text-sm font-bold text-white">Processing Core</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Ingestion, indexing, and anomaly scoring are represented as one live pipeline.</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 backdrop-blur-xl hover:border-emerald-500/10 transition-colors">
              <Activity className="mb-3 h-5 w-5 text-emerald-400" />
              <p className="text-sm font-bold text-white">Real System Signal</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Website events and backend logs land in the same operational stream.</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 backdrop-blur-xl hover:border-purple-500/10 transition-colors">
              <Gauge className="mb-3 h-5 w-5 text-purple-400" />
              <p className="text-sm font-bold text-white">Evaluator Mode Ready</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Incident replay gives a clean demo story when live traffic is quiet.</p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
