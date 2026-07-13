import { BookOpen, Key, Database } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''
const COLORS = { card: '#111827', background: '#0B1220', accentBlue: '#3B82F6', aiCyan: '#22D3EE' }

const endpoints = [
  { method: 'POST', path: '/api/v1/ingest', auth: 'API Key', desc: 'Ingest a single log entry' },
  { method: 'POST', path: '/api/v1/ingest/batch', auth: 'API Key', desc: 'Ingest up to 1000 logs' },
  { method: 'GET', path: '/api/v1/logs', auth: 'JWT', desc: 'Search, filter, paginate logs' },
  { method: 'POST', path: '/api/v1/chat', auth: 'JWT', desc: 'AI chat over your logs' },
  { method: 'GET', path: '/api/v1/servers', auth: 'JWT', desc: 'List servers with 24h stats' },
  { method: 'POST', path: '/api/v1/servers', auth: 'JWT', desc: 'Create server (returns id, api_key)' },
  { method: 'DELETE', path: '/api/v1/servers/{id}', auth: 'JWT', desc: 'Delete server' },
  { method: 'POST', path: '/api/v1/servers/{id}/rotate-key', auth: 'JWT', desc: 'Rotate API key' },
  { method: 'GET', path: '/api/v1/servers/{id}/metrics', auth: 'JWT', desc: 'Server metrics' },
  { method: 'GET', path: '/api/v1/servers/dashboard/overview', auth: 'JWT', desc: 'Dashboard overview' },
]

export default function ApiDocs() {
  const methodColor = (m) => ({ POST: '#10B981', GET: '#3B82F6', DELETE: '#EF4444' }[m] || '#9CA3AF')
  return (
    <DashboardLayout title="API Reference" subtitle="REST endpoints for LogAI">
      <div className="space-y-6 max-w-4xl">
        <div className="rounded-2xl p-6 border border-white/5" style={{ backgroundColor: COLORS.card }}>
          <div className="flex items-center gap-3 mb-4">
            <BookOpen className="w-5 h-5" style={{ color: COLORS.aiCyan }} />
            <h3 className="text-xl font-bold text-white">Base URL</h3>
          </div>
          <code className="block p-4 rounded-lg font-mono text-base" style={{ backgroundColor: COLORS.background, color: '#e5e7eb' }}>{BACKEND_URL}</code>
        </div>

        <div className="rounded-2xl p-6 border border-white/5" style={{ backgroundColor: COLORS.card }}>
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5" style={{ color: COLORS.aiCyan }} />
            <h3 className="text-xl font-bold text-white">Authentication</h3>
          </div>
          <p className="text-base text-gray-400 mb-2">Ingest endpoints use <code className="px-2 py-1 rounded text-sm font-mono" style={{ backgroundColor: COLORS.background }}>x-api-key</code> header.</p>
          <p className="text-base text-gray-400">Other endpoints use <code className="px-2 py-1 rounded text-sm font-mono" style={{ backgroundColor: COLORS.background }}>Authorization: Bearer &lt;token&gt;</code></p>
        </div>

        <div className="rounded-2xl p-6 border border-white/5" style={{ backgroundColor: COLORS.card }}>
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5" style={{ color: COLORS.aiCyan }} />
            <h3 className="text-xl font-bold text-white">Endpoints</h3>
          </div>
          <div className="space-y-2">
            {endpoints.map((ep, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 py-4 border-b border-white/5 last:border-0">
                <span className="px-2.5 py-1 text-sm font-bold rounded" style={{ backgroundColor: `${methodColor(ep.method)}20`, color: methodColor(ep.method) }}>{ep.method}</span>
                <code className="font-mono text-base text-gray-300">{ep.path}</code>
                <span className="text-sm text-gray-500">({ep.auth})</span>
                <span className="text-base text-gray-400 ml-auto">{ep.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
