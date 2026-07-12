import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ─────────────────────────────────────────────
   NODE DEFINITIONS
   Each node has: id, label, sublabel (tech), x/y (%), layer, color
───────────────────────────────────────────────*/
const NODES = [
  // ── Layer 0: Sources
  { id: 'app',       label: 'App / cURL',       sub: 'HTTP REST',       layer: 0, col: 0, row: 0, color: '#F59E0B', icon: '⚡' },
  { id: 'shipper',   label: 'Python Shipper',    sub: 'SDK / Script',    layer: 0, col: 0, row: 1, color: '#F59E0B', icon: '🐍' },
  { id: 'fluentd',   label: 'Fluentd',           sub: 'Forward/Syslog',  layer: 0, col: 0, row: 2, color: '#FBBF24', icon: '🔁' },

  // ── Layer 1: Entry
  { id: 'nginx',     label: 'NGINX',             sub: 'Reverse Proxy',   layer: 1, col: 1, row: 1, color: '#38BDF8', icon: '🌐' },

  // ── Layer 2: Core Backend
  { id: 'fastapi',   label: 'FastAPI',            sub: 'REST + WebSocket',layer: 2, col: 2, row: 0, color: '#22D3EE', icon: '⚙️' },
  { id: 'auth',      label: 'Auth Service',       sub: 'Node.js OAuth',   layer: 2, col: 2, row: 2, color: '#A78BFA', icon: '🔑' },

  // ── Layer 3: Data stores & processing
  { id: 'postgres',  label: 'PostgreSQL',         sub: 'Users & Servers', layer: 3, col: 3, row: 0, color: '#60A5FA', icon: '🗄️' },
  { id: 'redis',     label: 'Redis',              sub: 'Streams & PubSub',layer: 3, col: 3, row: 1, color: '#FB7185', icon: '⚡' },
  { id: 'worker',    label: 'Stream Worker',      sub: 'Python Pipeline', layer: 3, col: 3, row: 2, color: '#34D399', icon: '⚙️' },

  // ── Layer 4: Intelligence
  { id: 'anomaly',   label: 'Anomaly Engine',     sub: 'Isolation Forest',layer: 4, col: 4, row: 0, color: '#C084FC', icon: '🧠' },
  { id: 'elastic',   label: 'Elasticsearch',      sub: 'Log Index / Search',layer: 4, col: 4, row: 1, color: '#FBBF24', icon: '🔍' },
  { id: 'notify',    label: 'Notifications',      sub: 'SMTP / Webhook',  layer: 4, col: 4, row: 2, color: '#F97316', icon: '🔔' },

  // ── Layer 5: Outputs
  { id: 'ws',        label: 'WebSocket',          sub: 'Live Events',     layer: 5, col: 5, row: 0, color: '#4ADE80', icon: '📡' },
  { id: 'dashboard', label: 'Dashboard',          sub: 'React UI',        layer: 5, col: 5, row: 1, color: '#38BDF8', icon: '📊' },
  { id: 'slack',     label: 'Slack / Email',      sub: 'Alert Delivery',  layer: 5, col: 5, row: 2, color: '#4ADE80', icon: '📨' },
]

/* ─────────────────────────────────────────────
   EDGE DEFINITIONS
   flow: which named flow this edge belongs to (for highlighting)
───────────────────────────────────────────────*/
const EDGES = [
  // Ingestion paths
  { from: 'app',      to: 'nginx',    flow: 'ingest',   label: 'REST' },
  { from: 'shipper',  to: 'nginx',    flow: 'ingest',   label: 'batch' },
  { from: 'fluentd',  to: 'redis',    flow: 'collector', label: 'list' },
  { from: 'nginx',    to: 'fastapi',  flow: 'ingest',   label: 'proxy' },
  { from: 'nginx',    to: 'auth',     flow: 'auth',     label: 'OAuth' },

  // FastAPI internals
  { from: 'fastapi',  to: 'postgres', flow: 'auth',     label: 'users/servers' },
  { from: 'fastapi',  to: 'anomaly',  flow: 'ingest',   label: 'score' },
  { from: 'fastapi',  to: 'redis',    flow: 'ingest',   label: 'pub/sub' },
  { from: 'auth',     to: 'postgres', flow: 'auth',     label: 'JWT' },

  // Collector pipeline
  { from: 'redis',    to: 'worker',   flow: 'collector', label: 'consume' },
  { from: 'worker',   to: 'anomaly',  flow: 'collector', label: 'score' },
  { from: 'worker',   to: 'elastic',  flow: 'collector', label: 'index' },
  { from: 'worker',   to: 'redis',    flow: 'collector', label: 'publish' },

  // Anomaly → outputs
  { from: 'anomaly',  to: 'elastic',  flow: 'ingest',   label: 'store' },
  { from: 'anomaly',  to: 'notify',   flow: 'alert',    label: 'trigger' },

  // Live updates
  { from: 'redis',    to: 'ws',       flow: 'live',     label: 'pub/sub' },
  { from: 'ws',       to: 'dashboard',flow: 'live',     label: 'stream' },

  // Query path
  { from: 'elastic',  to: 'fastapi',  flow: 'query',    label: 'search' },
  { from: 'fastapi',  to: 'dashboard',flow: 'query',    label: 'REST' },

  // Alert delivery
  { from: 'notify',   to: 'slack',    flow: 'alert',    label: 'deliver' },
]

/* ─────────────────────────────────────────────
   FLOW SEQUENCES  (cycle through these)
───────────────────────────────────────────────*/
const FLOWS = [
  { id: 'ingest',    label: 'Direct Ingest →  Score →  Store →  Live Update', color: '#22D3EE' },
  { id: 'collector', label: 'Fluentd Collector →  Stream Worker →  Index',    color: '#34D399' },
  { id: 'alert',     label: 'Anomaly Detected →  Notify →  Deliver',          color: '#F97316' },
  { id: 'query',     label: 'Dashboard Query →  Elasticsearch →  REST',       color: '#A78BFA' },
  { id: 'auth',      label: 'OAuth Login →  Auth Service →  PostgreSQL',      color: '#FBBF24' },
]

const COLS = 6
const ROWS = 3
const FLOW_DURATION = 5000 // ms per flow

/* ─────────────────────────────────────────────
   LAYOUT HELPER  → pixel coords from (col, row)
───────────────────────────────────────────────*/
function getNodePos(node, W, H) {
  const padX = W * 0.04
  const padY = H * 0.14
  const cellW = (W - padX * 2) / (COLS - 1)
  const cellH = (H - padY * 2) / (ROWS - 1)
  return {
    x: padX + node.col * cellW,
    y: padY + node.row * cellH,
  }
}

/* ─────────────────────────────────────────────
   PACKET  component – a glowing dot along a path
───────────────────────────────────────────────*/
function Packet({ path, color, delay, duration }) {
  return (
    <motion.circle
      r={5}
      fill={color}
      style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      initial={{ offsetDistance: '0%', opacity: 0 }}
      animate={{ offsetDistance: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  )
}

/* ─────────────────────────────────────────────
   TOOLTIP CARD
───────────────────────────────────────────────*/
const DESCRIPTIONS = {
  app:      'External applications send logs directly via REST API using their server API key.',
  shipper:  'Python shipper script for batch log forwarding from monitored services.',
  fluentd:  'Collects logs from forward, HTTP, and syslog sources; pushes to Redis list.',
  nginx:    'Unified reverse proxy routing all traffic — REST, WebSocket, and OAuth.',
  fastapi:  'Core REST and WebSocket API: auth, ingest, search, analytics, chat.',
  auth:     'Node.js service handling Google and GitHub OAuth flows with Passport.js.',
  postgres: 'Stores users, server records, API keys, and alert integration settings.',
  redis:    'Message broker: Redis Streams for ingest queue, Pub/Sub for live events.',
  worker:   'Async Python worker that consumes the Redis queue, parses, scores, and indexes logs.',
  anomaly:  'Isolation Forest ML model with statistical fallback for real-time anomaly scoring.',
  elastic:  'Full-text search engine for log storage, filtering, aggregations, and chat context.',
  notify:   'Dispatches outbound alerts to Slack, email, and custom webhooks on anomaly events.',
  ws:       'FastAPI WebSocket endpoint subscribing to Redis Pub/Sub and pushing live events.',
  dashboard:'React 18 frontend — dashboard, logs, analytics, alerts, chat, integrations.',
  slack:    'Outbound alert delivery: Slack webhook, SMTP email, or custom HTTP webhook.',
}

function TooltipCard({ node, x, y, W, H }) {
  const tipW = 220
  const tipH = 110
  // keep tooltip inside canvas
  const tx = Math.min(x + 18, W - tipW - 10)
  const ty = Math.min(y - 10, H - tipH - 10)

  return (
    <motion.foreignObject
      x={tx} y={ty}
      width={tipW} height={tipH}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      style={{ pointerEvents: 'none', overflow: 'visible' }}
    >
      <div xmlns="http://www.w3.org/1999/xhtml"
        style={{
          background: 'rgba(8,17,32,0.97)',
          border: `1px solid ${node.color}50`,
          borderRadius: 12,
          padding: '10px 14px',
          boxShadow: `0 0 24px ${node.color}30, 0 8px 32px rgba(0,0,0,0.6)`,
          width: tipW,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16 }}>{node.icon}</span>
          <span style={{ color: node.color, fontWeight: 700, fontSize: 13 }}>{node.label}</span>
        </div>
        <div style={{ color: '#94A3B8', fontSize: 11, marginBottom: 4, fontStyle: 'italic' }}>{node.sub}</div>
        <div style={{ color: '#CBD5E1', fontSize: 11, lineHeight: 1.4 }}>{DESCRIPTIONS[node.id]}</div>
      </div>
    </motion.foreignObject>
  )
}

/* ─────────────────────────────────────────────
   MAIN CANVAS
───────────────────────────────────────────────*/
export default function ArchitectureCanvas() {
  const containerRef = useRef(null)
  const [dims, setDims] = useState({ W: 1100, H: 520 })
  const [activeFlow, setActiveFlow] = useState(0)
  const [hoveredNode, setHoveredNode] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [paused, setPaused] = useState(false)

  const [mapSpeed, setMapSpeed] = useState(() => {
    try {
      return localStorage.getItem('logai_map_speed') || 'normal'
    } catch {
      return 'normal'
    }
  })

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setDims({ W: Math.max(width, 600), H: Math.max(height, 380) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Listen for settings page updates
  useEffect(() => {
    const handleStorage = () => {
      try {
        setMapSpeed(localStorage.getItem('logai_map_speed') || 'normal')
      } catch (err) {
        console.warn('Failed to read map speed preference:', err)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Cycle flows
  useEffect(() => {
    if (paused) return
    const speedMs = mapSpeed === 'slow' ? 8000 : mapSpeed === 'fast' ? 2500 : 5000
    const id = setInterval(() => setActiveFlow(f => (f + 1) % FLOWS.length), speedMs)
    return () => clearInterval(id)
  }, [paused, mapSpeed])

  const { W, H } = dims
  const flow = FLOWS[activeFlow]

  // Compute positions
  const positions = {}
  NODES.forEach(n => { positions[n.id] = getNodePos(n, W, H) })

  // Active edges for current flow
  const activeEdges = EDGES.filter(e => e.flow === flow.id)
  const dimmedEdges = EDGES.filter(e => e.flow !== flow.id)

  const handleMouseMove = useCallback((e) => {
    const svgEl = e.currentTarget
    const rect = svgEl.getBoundingClientRect()
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])

  const NODE_R = Math.max(28, Math.min(36, W / 34))

  const hNode = hoveredNode ? NODES.find(n => n.id === hoveredNode) : null

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Flow selector pills */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center',
        zIndex: 10, padding: '6px 0',
      }}>
        {FLOWS.map((f, i) => (
          <button key={f.id} onClick={() => { setActiveFlow(i); setPaused(true) }}
            style={{
              padding: '4px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: `1px solid ${i === activeFlow ? f.color : 'rgba(255,255,255,0.1)'}`,
              background: i === activeFlow ? `${f.color}22` : 'rgba(0,0,0,0.3)',
              color: i === activeFlow ? f.color : '#64748B',
              backdropFilter: 'blur(8px)',
            }}
          >
            {f.id.charAt(0).toUpperCase() + f.id.slice(1)}
          </button>
        ))}
        <button onClick={() => setPaused(p => !p)}
          style={{
            padding: '4px 14px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.15)',
            background: paused ? 'rgba(251,113,133,0.15)' : 'rgba(52,211,153,0.15)',
            color: paused ? '#FB7185' : '#34D399',
          }}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
      </div>

      {/* Active flow label */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        fontSize: 12, color: flow.color, fontWeight: 500, letterSpacing: '0.04em',
        textShadow: `0 0 12px ${flow.color}80`,
        whiteSpace: 'nowrap', zIndex: 10,
      }}>
        ▶ {flow.label}
      </div>

      <svg
        width={W} height={H}
        onMouseMove={handleMouseMove}
        style={{ display: 'block', cursor: 'crosshair' }}
      >
        <defs>
          {/* Glow filters */}
          <filter id="glow-node" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-edge" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Arrowhead markers per flow color */}
          {FLOWS.map(f => (
            <marker key={f.id} id={`arrow-${f.id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill={f.color} />
            </marker>
          ))}
          <marker id="arrow-dim" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgba(255,255,255,0.08)" />
          </marker>
        </defs>

        {/* ── Background grid dots */}
        {Array.from({ length: Math.ceil(W / 40) }).map((_, ci) =>
          Array.from({ length: Math.ceil(H / 40) }).map((_, ri) => (
            <circle key={`${ci}-${ri}`}
              cx={ci * 40} cy={ri * 40} r={1}
              fill="rgba(255,255,255,0.04)"
            />
          ))
        )}

        {/* ── Layer labels */}
        {[
          { label: 'Sources', col: 0 },
          { label: 'Entry', col: 1 },
          { label: 'Backend', col: 2 },
          { label: 'Pipeline', col: 3 },
          { label: 'Intelligence', col: 4 },
          { label: 'Outputs', col: 5 },
        ].map(({ label, col }) => {
          const padX = W * 0.04
          const cellW = (W - padX * 2) / (COLS - 1)
          return (
            <text key={label}
              x={padX + col * cellW} y={32}
              textAnchor="middle"
              fill="rgba(148,163,184,0.5)"
              fontSize={11}
              fontWeight={600}
              letterSpacing={2}
              style={{ textTransform: 'uppercase' }}
            >
              {label}
            </text>
          )
        })}

        {/* ── Dimmed edges (other flows) */}
        {dimmedEdges.map((e, i) => {
          const from = positions[e.from]
          const to = positions[e.to]
          if (!from || !to) return null
          const mx = (from.x + to.x) / 2
          const my = (from.y + to.y) / 2 - 18
          return (
            <path key={`dim-${i}`}
              d={`M${from.x},${from.y} Q${mx},${my} ${to.x},${to.y}`}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth={1.5}
              markerEnd="url(#arrow-dim)"
            />
          )
        })}

        {/* ── Active edges (current flow) */}
        {activeEdges.map((e, i) => {
          const from = positions[e.from]
          const to = positions[e.to]
          if (!from || !to) return null
          const mx = (from.x + to.x) / 2
          const my = (from.y + to.y) / 2 - 20
          const pathD = `M${from.x},${from.y} Q${mx},${my} ${to.x},${to.y}`
          const pathId = `path-${e.from}-${e.to}-${activeFlow}`

          const pDuration = mapSpeed === 'slow' ? 3.6 : mapSpeed === 'fast' ? 0.9 : 1.8
          const pDelay = mapSpeed === 'slow' ? i * 0.7 : mapSpeed === 'fast' ? i * 0.175 : i * 0.35

          return (
            <g key={`active-${i}`} filter="url(#glow-edge)">
              <defs>
                <path id={pathId} d={pathD} />
              </defs>
              {/* glowing edge line */}
              <path
                d={pathD}
                fill="none"
                stroke={flow.color}
                strokeWidth={2.5}
                strokeDasharray="6 4"
                strokeOpacity={0.8}
                markerEnd={`url(#arrow-${flow.id})`}
              />
              {/* animated packet along path */}
              <motion.circle
                r={5}
                fill={flow.color}
                style={{ filter: `drop-shadow(0 0 8px ${flow.color})` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: pDuration,
                  delay: pDelay,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              >
                <animateMotion
                  dur={`${pDuration}s`}
                  begin={`${pDelay}s`}
                  repeatCount="indefinite"
                  path={pathD}
                />
              </motion.circle>
              {/* edge label */}
              <text x={mx} y={my - 5}
                textAnchor="middle" fill={flow.color}
                fontSize={9.5} fontWeight={600} opacity={0.85}
              >{e.label}</text>
            </g>
          )
        })}

        {/* ── Nodes */}
        {NODES.map(node => {
          const pos = positions[node.id]
          const isHovered = hoveredNode === node.id
          const isActive = activeEdges.some(e => e.from === node.id || e.to === node.id)
          const r = isHovered ? NODE_R + 4 : NODE_R

          return (
            <g key={node.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              filter={isActive || isHovered ? 'url(#glow-node)' : undefined}
            >
              {/* outer pulse ring */}
              {isActive && (
                <motion.circle
                  cx={pos.x} cy={pos.y} r={r + 8}
                  fill="none"
                  stroke={node.color}
                  strokeWidth={1.5}
                  initial={{ opacity: 0.6, scale: 1 }}
                  animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ transformOrigin: `${pos.x}px ${pos.y}px` }}
                />
              )}
              {/* hovered ring */}
              {isHovered && (
                <circle
                  cx={pos.x} cy={pos.y} r={r + 6}
                  fill="none"
                  stroke={node.color}
                  strokeWidth={1}
                  strokeOpacity={0.4}
                />
              )}
              {/* node circle */}
              <circle
                cx={pos.x} cy={pos.y} r={r}
                fill={isActive || isHovered ? `${node.color}25` : 'rgba(8,17,32,0.85)'}
                stroke={node.color}
                strokeWidth={isActive || isHovered ? 2 : 1.5}
                strokeOpacity={isActive || isHovered ? 1 : 0.45}
                style={{ transition: 'all 0.3s' }}
              />
              {/* icon */}
              <text
                x={pos.x} y={pos.y - 4}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={NODE_R * 0.7}
                style={{ userSelect: 'none' }}
              >
                {node.icon}
              </text>
              {/* label */}
              <text
                x={pos.x} y={pos.y + r + 14}
                textAnchor="middle"
                fill={isActive || isHovered ? node.color : '#94A3B8'}
                fontSize={10.5}
                fontWeight={isActive || isHovered ? 700 : 500}
                style={{ transition: 'all 0.2s' }}
              >
                {node.label}
              </text>
              {/* sub-label */}
              <text
                x={pos.x} y={pos.y + r + 26}
                textAnchor="middle"
                fill="rgba(100,116,139,0.75)"
                fontSize={9}
              >
                {node.sub}
              </text>
            </g>
          )
        })}

        {/* ── Tooltip */}
        <AnimatePresence>
          {hNode && (
            <TooltipCard
              key={hNode.id}
              node={hNode}
              x={mousePos.x}
              y={mousePos.y}
              W={W} H={H}
            />
          )}
        </AnimatePresence>
      </svg>
    </div>
  )
}
