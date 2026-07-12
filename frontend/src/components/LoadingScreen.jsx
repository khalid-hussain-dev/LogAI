import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { brandAssets } from '../assets/brand'

const STATUS_MESSAGES = [
  'Initializing AI engine...',
  'Connecting to servers...',
  'Loading dashboard...',
  'Analyzing logs...',
  'Fetching metrics...',
]

const FAKE_LOGS = [
  { level: 'INFO', msg: 'Connection established to elasticsearch:9200' },
  { level: 'INFO', msg: 'Redis stream consumer group ready' },
  { level: 'OK', msg: 'Authentication service healthy' },
  { level: 'INFO', msg: 'Loading anomaly detection model...' },
  { level: 'OK', msg: 'Dashboard data pipeline connected' },
  { level: 'INFO', msg: 'WebSocket channel initialized' },
]

const LEVEL_COLOR = {
  INFO: '#3B82F6',
  OK: '#10B981',
  WARN: '#F59E0B',
}

export default function LoadingScreen({ message }) {
  const [statusIdx, setStatusIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [visibleLogs, setVisibleLogs] = useState([])

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIdx(prev => (prev + 1) % STATUS_MESSAGES.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100
        const jump = Math.random() * 15 + 5
        return Math.min(prev + jump, 98)
      })
    }, 400)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let idx = 0
    const interval = setInterval(() => {
      if (idx < FAKE_LOGS.length) {
        setVisibleLogs(prev => [...prev, { ...FAKE_LOGS[idx], id: idx }])
        idx++
      }
    }, 600)
    return () => clearInterval(interval)
  }, [])

  const displayMessage = message || STATUS_MESSAGES[statusIdx]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center dark"
      style={{ backgroundColor: '#0B1220' }}>

      {/* Grid background */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(to right, #3B82F6 1px, transparent 1px), linear-gradient(to bottom, #3B82F6 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

      {/* Radial glow */}
      <div className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 600px 400px at center, rgba(34,211,238,0.06) 0%, transparent 70%)',
        }} />

      <div className="relative flex flex-col items-center w-full max-w-md px-6">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <img src={brandAssets.loadingLogo} alt="LogAI" className="h-20 w-20 rounded-3xl object-contain shadow-2xl shadow-cyan-500/20" />
        </motion.div>

        {/* Spinner ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative w-20 h-20 mb-8"
        >
          {/* Outer ring */}
          <svg className="w-20 h-20 absolute inset-0" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(34,211,238,0.1)" strokeWidth="3" />
            <motion.circle
              cx="40" cy="40" r="34" fill="none"
              stroke="url(#spinnerGrad)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray="160 60"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
              style={{ transformOrigin: 'center' }}
            />
            <defs>
              <linearGradient id="spinnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#22D3EE" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
          </svg>

          {/* Inner pulse */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="w-8 h-8 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(34,211,238,0.3) 0%, transparent 70%)',
                boxShadow: '0 0 30px rgba(34,211,238,0.2)',
              }} />
          </motion.div>

          {/* Center loading logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={brandAssets.loadingLogo}
              alt=""
              className="h-9 w-9 rounded-xl object-contain"
              style={{ boxShadow: '0 0 22px rgba(34,211,238,0.26)' }}
            />
          </div>
        </motion.div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-xs mb-6"
        >
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #3B82F6, #22D3EE)' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </motion.div>

        {/* Status text */}
        <div className="h-6 flex items-center justify-center mb-8">
          <AnimatePresence mode="wait">
            <motion.p
              key={displayMessage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="text-sm font-medium"
              style={{ color: '#22D3EE' }}
            >
              {displayMessage}
              <motion.span
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              > ...</motion.span>
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Simulated log lines */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="w-full max-w-sm rounded-xl overflow-hidden border"
          style={{ backgroundColor: 'rgba(17,24,39,0.6)', borderColor: 'rgba(255,255,255,0.05)' }}
        >
          <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <div className="w-2 h-2 rounded-full bg-red-500 opacity-60" />
            <div className="w-2 h-2 rounded-full bg-yellow-500 opacity-60" />
            <div className="w-2 h-2 rounded-full bg-green-500 opacity-60" />
            <span className="text-[10px] text-gray-500 ml-2 font-mono">logai - boot sequence</span>
          </div>
          <div className="p-3 h-[140px] overflow-hidden font-mono text-[11px] leading-relaxed">
            <AnimatePresence>
              {visibleLogs.map(log => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex gap-2"
                >
                  <span className="text-gray-600 select-none">{String(log.id + 1).padStart(2, '0')}</span>
                  <span style={{ color: LEVEL_COLOR[log.level] || '#6B7280' }}>[{log.level}]</span>
                  <span className="text-gray-400">{log.msg}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {visibleLogs.length === 0 && (
              <div className="flex items-center gap-1.5 text-gray-600">
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }}>|</motion.span>
                waiting...
              </div>
            )}
          </div>
        </motion.div>

        {/* Skeleton placeholders */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 1.2 }}
          className="w-full max-w-sm mt-6 grid grid-cols-3 gap-2"
        >
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg h-16 overflow-hidden" style={{ backgroundColor: 'rgba(17,24,39,0.5)' }}>
              <motion.div
                className="h-full w-full"
                style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.04) 50%, transparent 100%)' }}
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
              />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
