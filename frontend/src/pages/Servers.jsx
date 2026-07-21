import { useState, useEffect } from 'react'
import { Plus, Copy, Check, RotateCcw, Trash2, Server, Link2, Share2, Users, UserPlus, X, ShieldAlert } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import DashboardLayout from '../components/DashboardLayout'
import ConfirmModal from '../components/ConfirmModal'
import { authFetch } from '../services/auth'
import { useToast } from '../context/ToastContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Skeleton } from '../components/Skeleton'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''
const COLORS = { card: '#111827', background: '#0B1220', accentBlue: '#3B82F6', aiCyan: '#22D3EE', success: '#10B981', danger: '#EF4444', warning: '#F59E0B' }

export default function Servers() {
  const { addToast } = useToast()
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Create Modal
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Link Key Modal
  const [showLink, setShowLink] = useState(false)
  const [linkKeyInput, setLinkKeyInput] = useState('')
  const [linking, setLinking] = useState(false)

  // Share Modal
  const [shareModal, setShareModal] = useState({ open: false, server: null })
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviting, setInviting] = useState(false)

  // Copy / Confirm Modals
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

  const handleLinkKey = async (e) => {
    e.preventDefault()
    if (!linkKeyInput.trim()) return
    setLinking(true)
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/servers/link-key`, {
        method: 'POST',
        body: JSON.stringify({ api_key: linkKeyInput.trim() }),
      })
      if (!res?.ok) { const d = await res?.json().catch(() => ({})); throw new Error(d.detail || 'Failed to link key') }
      setLinkKeyInput(''); setShowLink(false); await fetchServers()
      addToast('Server linked successfully!', 'success')
    } catch (err) { setError(err.message); addToast(err?.message || 'Failed to link server key', 'error') } finally { setLinking(false) }
  }

  const openShareModal = async (server) => {
    setShareModal({ open: true, server })
    setMembersLoading(true)
    setInviteEmail('')
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/servers/${server.id}/members`)
      if (res?.ok) setMembers(await res.json())
      else setMembers([])
    } catch { setMembers([]) } finally { setMembersLoading(false) }
  }

  const handleInviteUser = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !shareModal.server) return
    setInviting(true)
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/servers/${shareModal.server.id}/share`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      if (!res?.ok) { const d = await res?.json().catch(() => ({})); throw new Error(d.detail || 'Failed to share server') }
      const newMember = await res.json()
      setMembers(prev => [...prev.filter(m => m.user_id !== newMember.user_id), newMember])
      setInviteEmail('')
      addToast(`Access shared with ${inviteEmail}`, 'success')
    } catch (err) { addToast(err?.message || 'Failed to share server', 'error') } finally { setInviting(false) }
  }

  const handleRemoveMember = async (targetUserId) => {
    if (!shareModal.server) return
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/servers/${shareModal.server.id}/members/${targetUserId}`, { method: 'DELETE' })
      if (res?.ok) {
        setMembers(prev => prev.filter(m => m.user_id !== targetUserId))
        addToast('Member access removed', 'success')
      }
    } catch { addToast('Failed to remove member', 'error') }
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
    <DashboardLayout title="Server Fleet" subtitle="Manage infrastructure nodes, team sharing, and API credentials">
      <ConfirmModal open={deleteModal.open} onClose={() => setDeleteModal({ open: false, id: null, name: '' })}
        onConfirm={() => handleDelete(deleteModal.id)}
        title="Delete server?" description={`"${deleteModal.name}" will be permanently deleted. All associated data and API keys will stop working.`}
        confirmText="Delete" variant="delete" />
      <ConfirmModal open={rotateModal.open} onClose={() => setRotateModal({ open: false, id: null })}
        onConfirm={() => handleRotateKey(rotateModal.id)}
        title="Rotate API key?" description="The current API key will be invalidated immediately. Any integrations using it will stop working."
        confirmText="Rotate Key" variant="danger" />

      {/* Top Action Bar */}
      <div className="flex flex-wrap justify-end gap-3 mb-6">
        <Button onClick={() => setShowLink(true)} className="border border-cyan-500/20 bg-cyan-950/20 hover:bg-cyan-900/30 text-cyan-300 text-sm px-4 py-2.5 font-bold transition-all cursor-pointer">
          <Link2 className="w-4 h-4 mr-2 text-cyan-400" /> Link Existing Key
        </Button>
        <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm px-5 py-2.5 font-bold shadow-lg shadow-cyan-950/30 cursor-pointer">
          <Plus className="w-4 h-4 mr-2" /> Add Server
        </Button>
      </div>

      {error && <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-base flex justify-between">{error}<button onClick={() => setError('')} className="text-xl">&times;</button></div>}

      {/* Create Server Modal */}
      <AnimatePresence>
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
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
                <Button type="submit" disabled={!newName.trim() || creating} className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 text-white">{creating ? 'Creating...' : 'Create Server'}</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Link Existing Key Modal */}
      <AnimatePresence>
      {showLink && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowLink(false)}>
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="rounded-2xl p-6 w-full max-w-md border border-cyan-500/20 shadow-2xl"
            style={{ backgroundColor: '#07101F' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-cyan-400">
                <Link2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Link Existing Server</h2>
                <p className="text-xs text-slate-400">Connect a server using its existing API key</p>
              </div>
            </div>
            <form onSubmit={handleLinkKey} className="space-y-4 mt-4">
              <div>
                <Label className="text-slate-200">Server API Key</Label>
                <Input
                  value={linkKeyInput}
                  onChange={e => setLinkKeyInput(e.target.value)}
                  placeholder="e.g. logai-H0pMKjP4seJ7OJzD..."
                  className="mt-1.5 h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-500 font-mono text-xs"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Paste an API key already deployed on a website. You will get immediate access to view its live telemetry.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowLink(false); setLinkKeyInput('') }} className="flex-1 border-white/10 text-white hover:bg-white/5">Cancel</Button>
                <Button type="submit" disabled={!linkKeyInput.trim() || linking} className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 text-white">{linking ? 'Linking...' : 'Link Server'}</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Share Server Modal */}
      <AnimatePresence>
      {shareModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShareModal({ open: false, server: null })}>
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="rounded-3xl p-6 w-full max-w-lg border border-cyan-500/20 shadow-2xl overflow-hidden"
            style={{ backgroundColor: '#07101F' }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-950/40 border border-blue-500/30 rounded-xl text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Share Access</h2>
                  <p className="text-xs text-slate-400 truncate max-w-[280px]">{shareModal.server?.name}</p>
                </div>
              </div>
              <button onClick={() => setShareModal({ open: false, server: null })} className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Invite Form */}
            <form onSubmit={handleInviteUser} className="mt-5 space-y-3">
              <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Invite Teammate by Email</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  className="flex-1 h-10 bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-sm"
                  required
                />
                <Button type="submit" disabled={!inviteEmail.trim() || inviting} className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold h-10 text-xs px-4">
                  {inviting ? 'Inviting...' : 'Invite'}
                </Button>
              </div>
            </form>

            {/* Members List */}
            <div className="mt-6 border-t border-white/10 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Server Members</h4>
              <div className="max-h-52 overflow-y-auto space-y-2 scrollbar-thin">
                {membersLoading ? (
                  <p className="text-xs text-slate-500 py-4 text-center">Loading members...</p>
                ) : members.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No shared members yet.</p>
                ) : (
                  members.map(m => (
                    <div key={m.user_id} className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]">
                      <div className="flex items-center gap-3 min-w-0">
                        {m.picture ? (
                          <img src={m.picture} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-black text-white">
                            {m.name?.[0]?.toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{m.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{m.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          m.is_owner ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        }`}>
                          {m.role}
                        </span>
                        {!m.is_owner && (
                          <button onClick={() => handleRemoveMember(m.user_id)} title="Remove member" className="p-1 text-slate-500 hover:text-rose-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Main List Grid */}
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
          <p className="text-gray-400 mb-6 text-lg">Create a server or link an existing API key to start collecting logs</p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => setShowLink(true)} className="border border-cyan-500/20 bg-cyan-950/20 text-cyan-300 font-bold px-5 py-2.5">Link Existing Key</Button>
            <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold px-5 py-2.5">Create First Server</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {servers.map(srv => (
            <motion.div
              key={srv.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
              className="rounded-2xl p-6 glass-card hover-glow-cyan relative"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white">{srv.name}</h3>
                    {srv.is_shared && (
                      <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20" title={`Owner: ${srv.owner_email}`}>
                        Shared
                      </span>
                    )}
                  </div>
                  {srv.description ? (
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{srv.description}</p>
                  ) : srv.is_shared && srv.owner_email ? (
                    <p className="text-xs text-slate-500 mt-0.5">Owner: {srv.owner_email}</p>
                  ) : null}
                </div>
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
                    <button onClick={() => copyKey(srv.id, `id-${srv.id}`)} className="ml-3 p-2 text-gray-400 hover:text-blue-400 rounded-lg transition-colors cursor-pointer">
                      {copiedKey === `id-${srv.id}` ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.background }}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium text-gray-500 mb-1">API Key</div><code className="text-sm text-gray-300 font-mono truncate block">{srv.api_key}</code></div>
                    <button onClick={() => copyKey(srv.api_key, srv.id)} className="ml-3 p-2 text-gray-400 hover:text-blue-400 rounded-lg transition-colors cursor-pointer">
                      {copiedKey === srv.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => openShareModal(srv)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer border border-cyan-500/20 bg-cyan-950/20 text-cyan-300 hover:bg-cyan-900/30">
                  <Share2 className="w-4 h-4 text-cyan-400" /> Share Access
                </button>

                {!srv.is_shared && (
                  <button onClick={() => setRotateModal({ open: true, id: srv.id })}
                    title="Rotate Key"
                    className="p-2.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}

                {!srv.is_shared && (
                  <button onClick={() => setDeleteModal({ open: true, id: srv.id, name: srv.name })}
                    title="Delete Server"
                    className="p-2.5 text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer border border-rose-500/20 bg-rose-950/20 text-rose-400 hover:bg-rose-900/30">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="mt-3 text-xs text-gray-500 flex justify-between items-center">
                <span>Created {new Date(srv.created_at).toLocaleDateString()}</span>
                <span>Role: <strong className="text-slate-300 uppercase">{srv.role}</strong></span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
