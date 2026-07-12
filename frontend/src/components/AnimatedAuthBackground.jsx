import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const LOG_LINES = [
  { level: 'INFO', color: '#3B82F6', msg: 'Request processed successfully for /api/users in 42ms' },
  { level: 'OK', color: '#10B981', msg: 'Health check passed — all services healthy' },
  { level: 'WARN', color: '#F59E0B', msg: 'Slow query detected: /api/orders took 1203ms' },
  { level: 'INFO', color: '#3B82F6', msg: 'User usr_48291 authenticated successfully' },
  { level: 'ERROR', color: '#EF4444', msg: 'Database connection refused: timeout after 3000ms' },
  { level: 'INFO', color: '#3B82F6', msg: 'Cache hit for key: session:usr_73921' },
  { level: 'OK', color: '#10B981', msg: 'Anomaly detection model loaded (v2.4.1)' },
  { level: 'WARN', color: '#F59E0B', msg: 'Rate limit approaching for API key: logai-****' },
  { level: 'INFO', color: '#3B82F6', msg: 'WebSocket connection established from 10.0.1.42' },
  { level: 'CRIT', color: '#EF4444', msg: 'Memory usage at 94% — scaling triggered' },
  { level: 'OK', color: '#10B981', msg: 'Elasticsearch index logai-logs ready (3.2M docs)' },
  { level: 'INFO', color: '#3B82F6', msg: 'Metrics exported: cpu=23%, memory=45%, disk=67%' },
  { level: 'WARN', color: '#F59E0B', msg: 'SSL certificate expires in 7 days' },
  { level: 'INFO', color: '#3B82F6', msg: 'Batch ingest: 50 logs indexed in 12ms' },
  { level: 'OK', color: '#10B981', msg: 'Stream worker consumer group ready' },
  { level: 'ERROR', color: '#EF4444', msg: '500 Internal Server Error on /api/checkout' },
  { level: 'INFO', color: '#3B82F6', msg: 'Redis pub/sub channel logai:logs:* subscribed' },
  { level: 'OK', color: '#10B981', msg: 'AI anomaly score: 0.12 (normal)' },
]

function StreamingLogs() {
  const [logs, setLogs] = useState([])
  const counter = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const logLine = LOG_LINES[counter.current % LOG_LINES.length]
      const ts = new Date().toISOString().slice(11, 23)
      setLogs(prev => {
        const next = [...prev, { ...logLine, id: counter.current, ts }]
        return next.slice(-14)
      })
      counter.current++
    }, 800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden font-mono text-[11px] leading-[22px] px-6 pt-8 pb-4"
      style={{ maskImage: 'linear-gradient(to right, transparent 0%, transparent 42%, black 52%), linear-gradient(to bottom, transparent 0%, black 8%, black 85%, transparent 100%)', WebkitMaskComposite: 'source-in', maskComposite: 'intersect' }}>
      {logs.map((log, i) => (
        <motion.div
          key={log.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: i < logs.length - 3 ? 0.45 : 0.7, x: 0 }}
          transition={{ duration: 0.3 }}
          className="whitespace-nowrap overflow-hidden"
        >
          <span className="text-gray-500">{log.ts}</span>
          {' '}
          <span style={{ color: log.color }}>[{log.level.padEnd(5)}]</span>
          {' '}
          <span className="text-gray-400">{log.msg}</span>
        </motion.div>
      ))}
    </div>
  )
}

function FloatingNodes() {
  const nodes = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    x: 15 + Math.random() * 70,
    y: 10 + Math.random() * 80,
    size: 3 + Math.random() * 3,
    delay: Math.random() * 3,
  }))

  const lines = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
      if (dist < 40) lines.push({ id: `${i}-${j}`, x1: nodes[i].x, y1: nodes[i].y, x2: nodes[j].x, y2: nodes[j].y })
    }
  }

  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      {lines.map(l => (
        <motion.line
          key={l.id}
          x1={`${l.x1}%`} y1={`${l.y1}%`} x2={`${l.x2}%`} y2={`${l.y2}%`}
          stroke="rgba(34,211,238,0.25)"
          strokeWidth="0.25"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 1, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 2 }}
        />
      ))}
      {nodes.map(n => (
        <motion.circle
          key={n.id}
          cx={`${n.x}%`} cy={`${n.y}%`}
          r={n.size * 0.12}
          fill="rgba(34,211,238,0.35)"
          animate={{ r: [n.size * 0.1, n.size * 0.18, n.size * 0.1], opacity: [0.25, 0.5, 0.25] }}
          transition={{ duration: 3 + n.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </svg>
  )
}

function DataParticles() {
  const particles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    startX: Math.random() * 100,
    startY: Math.random() * 100,
    duration: 6 + Math.random() * 8,
    delay: Math.random() * 5,
    size: 1 + Math.random() * 2,
  }))

  return (
    <div className="absolute inset-0 overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.startX}%`,
            top: `${p.startY}%`,
            backgroundColor: p.id % 3 === 0 ? '#22D3EE' : p.id % 3 === 1 ? '#3B82F6' : '#10B981',
          }}
          animate={{
            y: [0, -200, -400],
            x: [0, (Math.random() - 0.5) * 80],
            opacity: [0, 0.65, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  )
}

function MetricsPulse() {
  return (
    <div className="absolute bottom-12 left-6 right-6 opacity-45">
      <svg viewBox="0 0 400 60" className="w-full h-16">
        <motion.path
          d="M0 30 Q25 30 50 25 T100 35 T150 15 T200 30 T250 10 T300 35 T350 20 T400 30"
          fill="none"
          stroke="#22D3EE"
          strokeWidth="1.5"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          d="M0 35 Q25 35 50 40 T100 30 T150 45 T200 35 T250 45 T300 30 T350 40 T400 35"
          fill="none"
          stroke="#3B82F6"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />
      </svg>
    </div>
  )
}

export default function AnimatedAuthBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: '#060d1a' }}>
      {/* Grid */}
      <div className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: 'linear-gradient(to right, #3B82F6 1px, transparent 1px), linear-gradient(to bottom, #3B82F6 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

      {/* Radial glows */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{ top: '10%', left: '20%', background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)' }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full"
        style={{ bottom: '15%', right: '10%', background: 'radial-gradient(circle, rgba(34,211,238,0.15) 0%, transparent 70%)' }}
        animate={{ scale: [1.1, 1, 1.1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Layers */}
      <FloatingNodes />
      <DataParticles />
      <StreamingLogs />
      <MetricsPulse />

      {/* Vignette overlay - lighter so animation stays visible */}
      <div className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(6,13,26,0.5) 100%)' }} />
    </div>
  )
}
