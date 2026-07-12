import { useState, useEffect } from 'react'
import { Plus, Copy, Check, RotateCcw, Trash2, Server } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import DashboardLayout from '../components/DashboardLayout'
import ConfirmModal from '../components/ConfirmModal'
import { authFetch } from '../services/auth'
import { useToast } from '../context/ToastContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Skeleton } from '../components/Skeleton'

const BACKEND_URL = typeof window !== 'undefined' ? window.location.origin : ''
const COLORS = { card: '#111827', background: '#0B1220', accentBlue: '#3B82F6', success: '#10B981', danger: '#EF4444', warning: '#F59E0B' }

export default function Servers() {
  const { addToast } = useToast()
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)
  const [copiedKey, setCopiedKey] = useState(null)
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, name: '' })
  const [rotateModal, setRotateModal] = useState({ open: false, id: null })

  const fetchServers = async () => {
    try {
      setLoading(true)
      const res = await authFetch(`${BACKEND_URL}/api/v1/servers`)
      if (res?.ok) setServers(await res.json())
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  useEffect(() => { fetchServers() }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/servers`, { method: 'POST', body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }) })
      if (!res?.ok) { const d = await res?.json().catch(() => ({})); throw new Error(d.detail || 'Failed') }
      setNewName(''); setNewDesc(''); setShowCreate(false); await fetchServers()
      addToast('Server created successfully', 'success')
    } catch (err) { setError(err.message); addToast(err?.message || 'Failed to create server', 'error') } finally { setCreating(false) }
  }

  const handleDelete = async (id) => {
    try { await authFetch(`${BACKEND_URL}/api/v1/servers/${id}`, { method: 'DELETE' }); await fetchServers() } catch (err) { setError(err.message) }
  }

  const handleRotateKey = async (id) => {
    try { await authFetch(`${BACKEND_URL}/api/v1/servers/${id}/rotate-key`, { method: 'POST' }); await fetchServers() } catch (err) { setError(err.message) }
  }

  const copyKey = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(id)
    setTimeout(() => setCopiedKey(null), 2000)
    addToast('Copied to clipboard', 'success')
  }

  return (
    <DashboardLayout title="Server Fleet" subtitle="Manage infrastructure nodes and API credentials">
      <ConfirmModal open={deleteModal.open} onClose={() => setDeleteModal({ open: false, id: null, name: '' })}
        onConfirm={() => handleDelete(deleteModal.id)}
        title="Delete server?" description={`"${deleteModal.name}" will be permanently deleted. All associated data and API keys will stop working.`}
        confirmText="Delete" variant="delete" />
      <ConfirmModal open={rotateModal.open} onClose={() => setRotateModal({ open: false, id: null })}
        onConfirm={() => handleRotateKey(rotateModal.id)}
        title="Rotate API key?" description="The current API key will be invalidated immediately. Any integrations using it will stop working."
        confirmText="Rotate Key" variant="danger" />
      <div className="flex justify-end mb-6">
        <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm px-5 py-2.5 font-bold shadow-lg shadow-cyan-950/30">
          <Plus className="w-4 h-4 mr-2" /> Add Server
        </Button>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-base flex justify-between">{error}<button onClick={() => setError('')} className="text-xl">&times;</button></div>}

      <AnimatePresence>
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl"
            style={{ backgroundColor: 'rgba(17, 24, 39, 0.95)' }}
          >
            <h2 className="text-2xl font-bold text-white mb-4">Create New Server</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><Label className="text-slate-200">Server Name</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Production API" className="mt-1 h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500" autoFocus /></div>
              <div><Label className="text-slate-200">Description (optional)</Label><Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="e.g. Main production server" className="mt-1 h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500" /></div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setNewName(''); setNewDesc('') }} className="flex-1 border-white/10 text-white hover:bg-white/5">Cancel</Button>
                <Button type="submit" disabled={!newName.trim() || creating} className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white">{creating ? 'Creating...' : 'Create Server'}</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="rounded-2xl p-6 border border-white/5" style={{ backgroundColor: COLORS.card }}>
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48 mb-4" />
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
              <Skeleton className="h-14 rounded-xl mb-3" />
              <Skeleton className="h-14 rounded-xl mb-4" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${COLORS.accentBlue}20` }}>
            <Server className="w-10 h-10" style={{ color: COLORS.accentBlue }} />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No servers yet</h3>
          <p className="text-gray-400 mb-6 text-lg">Create your first server to start collecting logs</p>
          <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-base px-5 py-2.5">Create First Server</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {servers.map(srv => (
            <motion.div
              key={srv.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
              className="rounded-2xl p-6 glass-card hover-glow-cyan"
            >
              <div className="flex items-start justify-between mb-4">
                <div><h3 className="text-lg font-black text-white">{srv.name}</h3>{srv.description && <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{srv.description}</p>}</div>
                <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${srv.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>{srv.is_active ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl p-4 text-center border border-cyan-500/10 bg-cyan-950/10"><div className="text-xl font-black" style={{ color: COLORS.accentBlue }}>{srv.log_count_24h}</div><div className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">Logs</div></div>
                <div className="rounded-xl p-4 text-center border border-rose-500/10 bg-rose-950/10"><div className="text-xl font-black" style={{ color: COLORS.danger }}>{srv.error_count_24h}</div><div className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">Errors</div></div>
                <div className="rounded-xl p-4 text-center border border-amber-500/10 bg-amber-950/10"><div className="text-xl font-black" style={{ color: COLORS.warning }}>{srv.anomaly_count_24h}</div><div className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wider">Anomalies</div></div>
              </div>
              <div className="space-y-3 mb-4">
                <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.background }}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium text-gray-500 mb-1">Server ID</div><code className="text-sm text-gray-300 font-mono truncate block">{srv.id}</code></div>
                    <button onClick={() => copyKey(srv.id, `id-${srv.id}`)} className="ml-3 p-2 text-gray-400 hover:text-blue-400 rounded-lg transition-colors">
                      {copiedKey === `id-${srv.id}` ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.background }}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium text-gray-500 mb-1">API Key</div><code className="text-sm text-gray-300 font-mono truncate block">{srv.api_key}</code></div>
                    <button onClick={() => copyKey(srv.api_key, srv.id)} className="ml-3 p-2 text-gray-400 hover:text-blue-400 rounded-lg transition-colors">
                      {copiedKey === srv.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setRotateModal({ open: true, id: srv.id })}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-base font-medium rounded-lg transition-all duration-200 cursor-pointer hover:brightness-125"
                  style={{ color: COLORS.accentBlue, backgroundColor: `${COLORS.accentBlue}15` }}>
                  <RotateCcw className="w-4 h-4" /> Rotate Key
                </button>
                <button onClick={() => setDeleteModal({ open: true, id: srv.id, name: srv.name })}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-base font-medium rounded-lg transition-all duration-200 cursor-pointer hover:brightness-125"
                  style={{ color: COLORS.danger, backgroundColor: `${COLORS.danger}15` }}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 text-sm text-gray-500">Created {new Date(srv.created_at).toLocaleDateString()}</div>
            </motion.div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
