import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authFetch } from '../services/auth'
import ConfirmModal from './ConfirmModal'
import { LayoutDashboard, BarChart3, Terminal, Server, Settings, Bell, LogOut, ChevronDown, Plus, MessageCircle, AlertTriangle, Plug, BookOpen, Check, Network } from 'lucide-react'
import { brandAssets } from '../assets/brand'
import { useLogStream } from '../services/logStream'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''

const COLORS = {
  background: '#050914',
  card: '#081120',
  cardStrong: '#0B1628',
  accentBlue: '#38BDF8',
  danger: '#FB7185',
  aiCyan: '#22D3EE',
  purple: '#A78BFA',
}

const MAX_ALERT_PREVIEW = 10

function mergeAlertPreview(prevAlerts, incomingAlert) {
  if (!incomingAlert?.id) return prevAlerts
  return [incomingAlert, ...prevAlerts.filter(alert => alert.id !== incomingAlert.id)].slice(0, MAX_ALERT_PREVIEW)
}

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick}
      className="group relative w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 cursor-pointer hover:translate-x-0.5"
      style={{
        backgroundColor: active ? 'rgba(34,211,238,0.06)' : 'transparent',
        color: active ? '#E0F2FE' : '#64748B',
        boxShadow: active ? 'inset 0 0 0 1px rgba(34,211,238,0.12), 0 0 20px rgba(34,211,238,0.04)' : 'none',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = active ? 'rgba(34,211,238,0.06)' : 'transparent' }}
    >
      <Icon className="w-[18px] h-[18px] flex-shrink-0" />
      <span className="flex-1 text-left text-sm font-semibold">{label}</span>
      {active && <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />}
      {badge != null && <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-white shadow-md" style={{ backgroundColor: COLORS.danger }}>{badge}</span>}
    </button>
  )
}

export default function DashboardLayout({ children, title, subtitle, servers: propServers, selectedServer, onServerChange }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const activeNav = location.pathname.replace('/', '') || 'dashboard'

  const [logoutModal, setLogoutModal] = useState(false)
  const [servers, setServers] = useState(propServers || [])
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false)
  const [currentServer, setCurrentServer] = useState(selectedServer || null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertCount, setAlertCount] = useState(0)
  const knownAlertIdsRef = useRef(new Set())

  useEffect(() => {
    if (propServers) {
      setServers(propServers)
      return
    }

    let ignore = false

    authFetch(`${BACKEND_URL}/api/v1/servers`).then(async (response) => {
      if (response?.ok && !ignore) {
        const data = await response.json()
        if (ignore) return
        setServers(data)
      }
    }).catch(() => {})

    return () => {
      ignore = true
    }
  }, [propServers])

  useEffect(() => {
    setCurrentServer(selectedServer || null)
  }, [selectedServer])

  useEffect(() => {
    authFetch(`${BACKEND_URL}/api/v1/servers/dashboard/overview`).then(async (response) => {
      if (response?.ok) {
        const data = await response.json()
        setAlertCount(data.total_anomalies_24h || 0)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const close = () => {
      setServerDropdownOpen(false)
      setProfileOpen(false)
      setAlertsOpen(false)
    }

    if (serverDropdownOpen || profileOpen || alertsOpen) {
      document.addEventListener('click', close)
      return () => document.removeEventListener('click', close)
    }

    return undefined
  }, [serverDropdownOpen, profileOpen, alertsOpen])

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true)
    try {
      const response = await authFetch(`${BACKEND_URL}/api/v1/logs?anomaly_only=true&limit=${MAX_ALERT_PREVIEW}`)
      if (response?.ok) {
        const data = await response.json()
        const nextAlerts = data.logs || []
        knownAlertIdsRef.current = new Set(nextAlerts.map(alert => alert.id).filter(Boolean))
        setAlerts(nextAlerts)
      } else {
        knownAlertIdsRef.current = new Set()
        setAlerts([])
      }
    } catch {
      knownAlertIdsRef.current = new Set()
      setAlerts([])
    } finally {
      setAlertsLoading(false)
    }
  }, [])

  const handleIncomingAnomaly = useCallback((alert) => {
    if (!alert?.id) return

    const isNewAlert = !knownAlertIdsRef.current.has(alert.id)
    knownAlertIdsRef.current.add(alert.id)

    if (isNewAlert) {
      setAlertCount(prev => prev + 1)
    }

    setAlerts(prevAlerts => mergeAlertPreview(prevAlerts, alert))
  }, [])

  useLogStream({
    serverId: null,
    onAnomaly: handleIncomingAnomaly,
  })

  const handleAlertsClick = (e) => {
    e.stopPropagation()
    if (!alertsOpen) fetchAlerts()
    setAlertsOpen(!alertsOpen)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/auth', { replace: true })
  }

  const handleServerSelect = (server) => {
    setCurrentServer(server)
    setServerDropdownOpen(false)
    if (onServerChange) onServerChange(server)
  }

  const getInitials = () => user?.name?.split(' ').map(name => name[0]).join('').toUpperCase().slice(0, 2) || 'U'

  return (
    <div className="flex h-screen dark" style={{ backgroundColor: COLORS.background }}>
      <ConfirmModal open={logoutModal} onClose={() => setLogoutModal(false)} onConfirm={handleLogout}
        title="Sign out?" description="You will be logged out of your account and redirected to the login page."
        confirmText="Sign out" variant="logout" />

      <div className="w-72 border-r flex flex-col" style={{ background: 'linear-gradient(180deg, #07101f 0%, #050914 100%)', borderColor: 'rgba(34,211,238,0.12)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'rgba(34,211,238,0.12)', backgroundColor: '#050B16' }}>
          <div className="flex items-center justify-center cursor-pointer rounded-2xl overflow-hidden border border-cyan-300/10 bg-white/[0.03] px-3 py-3 shadow-2xl shadow-cyan-950/20" onClick={() => navigate('/dashboard')}>
            <img src={brandAssets.dashboardLogo} alt="LogAI" className="h-14 w-auto object-contain" />
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem icon={Network} label="System Map" active={activeNav === 'architecture'} onClick={() => navigate('/architecture')} />
          <NavItem icon={LayoutDashboard} label="Dashboard" active={activeNav === 'dashboard'} onClick={() => navigate('/dashboard')} />
          <NavItem icon={BarChart3} label="Analytics" active={activeNav === 'analytics'} onClick={() => navigate('/analytics')} />
          <NavItem icon={Server} label="Servers" active={activeNav === 'servers'} onClick={() => navigate('/servers')} />
          <NavItem icon={Terminal} label="Logs" active={activeNav === 'logs'} onClick={() => navigate('/logs')} />
          <NavItem icon={AlertTriangle} label="Alerts" active={activeNav === 'alerts'} onClick={() => navigate('/alerts')} badge={alertCount > 0 ? alertCount : null} />
          <NavItem icon={MessageCircle} label="AI Chat" active={activeNav === 'chat'} onClick={() => navigate('/chat')} />
          <div className="pt-2 mt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            <NavItem icon={Plug} label="Integrations" active={activeNav === 'integrations'} onClick={() => navigate('/integrations')} />
            <NavItem icon={BookOpen} label="API Docs" active={activeNav === 'docs'} onClick={() => navigate('/docs')} />
          </div>
        </nav>
        <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'rgba(34,211,238,0.1)' }}>
          <NavItem icon={Settings} label="Settings" active={activeNav === 'settings'} onClick={() => navigate('/settings')} />
        </div>
      </div>

      <div className="relative flex-1 flex min-w-0 flex-col overflow-visible">
        <div className="relative z-[100] border-b backdrop-blur-xl" style={{ backgroundColor: 'rgba(5, 9, 20, 0.72)', borderColor: 'rgba(34,211,238,0.08)' }}>
          <div className="h-16 px-6 flex items-center gap-4">
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setServerDropdownOpen(!serverDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer border hover-glow-cyan hover:bg-cyan-500/5"
                style={{ color: '#BAE6FD', backgroundColor: 'rgba(56,189,248,0.04)', borderColor: 'rgba(56,189,248,0.2)' }}>
                <Server className="w-4 h-4 text-cyan-400" />
                <span>{currentServer?.name || 'All Servers'}</span>
                <ChevronDown className={`w-4 h-4 text-cyan-400/70 transition-transform duration-300 ${serverDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {serverDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 rounded-2xl border z-[140] min-w-[240px] py-1.5 overflow-hidden glass-dropdown"
                  style={{ borderColor: 'rgba(34,211,238,0.12)' }}>
                  <button onClick={() => handleServerSelect(null)}
                    className="w-full px-4.5 py-3 text-left text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center justify-between"
                    style={{ color: !currentServer ? COLORS.aiCyan : '#94a3b8', backgroundColor: !currentServer ? 'rgba(34,211,238,0.06)' : 'transparent' }}
                    onMouseEnter={(e) => { if (currentServer) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={(e) => { if (currentServer) e.currentTarget.style.backgroundColor = 'transparent' }}>
                    <span>All Servers</span>
                    {!currentServer && <Check className="w-4 h-4 text-cyan-400" />}
                  </button>
                  <div className="border-t my-1" style={{ borderColor: 'rgba(255,255,255,0.05)' }}></div>
                  <div className="max-h-[220px] overflow-y-auto scrollbar-thin">
                    {servers.map(server => (
                      <button key={server.id} onClick={() => handleServerSelect(server)}
                        className="w-full px-4.5 py-3 text-left text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center justify-between"
                        style={{ color: currentServer?.id === server.id ? COLORS.aiCyan : '#94a3b8', backgroundColor: currentServer?.id === server.id ? 'rgba(34,211,238,0.06)' : 'transparent' }}
                        onMouseEnter={(e) => { if (currentServer?.id !== server.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)' }}
                        onMouseLeave={(e) => { if (currentServer?.id !== server.id) e.currentTarget.style.backgroundColor = 'transparent' }}>
                        <span>{server.name}</span>
                        {currentServer?.id === server.id && <Check className="w-4 h-4 text-cyan-400" />}
                      </button>
                    ))}
                  </div>
                  {servers.length === 0 && <p className="px-4.5 py-3 text-sm text-slate-500">No active servers</p>}
                  <div className="border-t mt-1 pt-1.5" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <button onClick={() => { setServerDropdownOpen(false); navigate('/servers') }}
                      className="w-full px-4.5 py-3 text-left text-sm font-bold flex items-center gap-2 transition-all duration-200 cursor-pointer hover:bg-white/[0.04]"
                      style={{ color: COLORS.aiCyan }}>
                      <Plus className="w-4 h-4" /> Add new server
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 flex justify-center items-center">
              <button onClick={() => navigate('/dashboard')} className="flex items-center gap-3 cursor-pointer group transition-opacity duration-200 hover:opacity-90">
                <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee] animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400 group-hover:text-white transition-colors">AI Ops Command System</span>
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={handleAlertsClick} className="p-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 cursor-pointer relative text-slate-400 hover:text-white">
                  <Bell className="w-4.5 h-4.5" />
                  {alertCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full text-[9px] font-black flex items-center justify-center px-1 shadow-lg shadow-rose-950/50" style={{ backgroundColor: COLORS.danger, color: '#fff' }}>
                      {alertCount > 9 ? '9+' : alertCount}
                    </span>
                  )}
                </button>
                {alertsOpen && (
                  <div className="absolute top-full right-0 mt-2 rounded-2xl border z-[140] min-w-[320px] max-w-[380px] max-h-[420px] overflow-hidden flex flex-col glass-dropdown"
                    style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                    <div className="px-4.5 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Alert Notifications</h3>
                      <button onClick={() => { setAlertsOpen(false); navigate('/alerts') }} className="text-xs font-bold transition-colors hover:underline text-cyan-400">View all</button>
                    </div>
                    <div className="overflow-y-auto flex-1 py-1.5 divide-y divide-white/5 scrollbar-thin">
                      {alertsLoading ? (
                        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-400"></div></div>
                      ) : alerts.length === 0 ? (
                        <p className="px-4.5 py-8 text-sm text-slate-500 text-center font-medium">All monitored systems are operational.</p>
                      ) : (
                        alerts.map((alert) => (
                          <div key={alert.id} onClick={() => { setAlertsOpen(false); navigate('/alerts') }}
                            className="px-4.5 py-3.5 cursor-pointer transition-colors hover:bg-white/[0.03]">
                            <div className="flex items-start gap-2.5">
                              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shadow-[0_0_8px_#f43f5e] animate-pulse" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-slate-200 line-clamp-2 leading-relaxed">{alert.message}</p>
                                <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">{alert.server_name || 'Server'} - {alert.level}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-3 pl-3 pr-2.5 py-1.5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300 cursor-pointer">
                  {user?.picture ? (
                    <img src={user.picture} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10" />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-md">
                      {getInitials()}
                    </div>
                  )}
                  <div className="hidden lg:block text-left min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate max-w-[120px]">{user?.name || 'User'}</p>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-300 ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {profileOpen && (
                  <div className="absolute top-full right-0 mt-2 rounded-2xl border z-[140] min-w-[240px] overflow-hidden glass-dropdown"
                    style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                    <div className="px-4.5 py-3 border-b bg-white/[0.01]" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <p className="text-sm font-bold text-white">{user?.name || 'User'}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{user?.email}</p>
                    </div>
                    <div className="py-1 bg-white/[0.01]">
                      <button onClick={() => { setProfileOpen(false); setLogoutModal(true) }}
                        className="w-full px-4.5 py-3 text-left text-sm font-bold text-rose-400 hover:bg-rose-500/10 transition-all duration-200 cursor-pointer flex items-center gap-3">
                        <LogOut className="w-4.5 h-4.5" /> Sign out session
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-0 flex-1 overflow-auto p-6 command-surface">
          <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-0" style={{ left: '288px' }}>
            <img src={brandAssets.dashboardLogo} alt="" className="w-[680px] h-auto select-none" style={{ opacity: 0.015, filter: 'blur(0.5px)' }} />
          </div>
          <div className="max-w-[1440px] mx-auto relative z-10">
            {(title || subtitle) && (
              <div className="mb-6">
                <h2 className="text-3xl font-black text-white tracking-tight">{title}</h2>
                {subtitle && <p className="text-slate-400 mt-2 text-sm font-medium tracking-wide">{subtitle}</p>}
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
