import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authFetch } from '../services/auth'
import ConfirmModal from './ConfirmModal'
import TeamModal from './TeamModal'
import ContactModal from './ContactModal'
import Footer from './Footer'
import { LayoutDashboard, BarChart3, Terminal, Server, Settings, Bell, LogOut, ChevronDown, Plus, MessageCircle, AlertTriangle, Plug, BookOpen, Check, Network, Menu, X, Users } from 'lucide-react'
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

function NavItem({ icon: Icon, label, active, onClick, badge, collapsed }) {
  return (
    <button onClick={onClick}
      title={collapsed ? label : undefined}
      className="group relative w-full flex items-center gap-3 rounded-xl transition-all duration-300 cursor-pointer"
      style={{
        padding: collapsed ? '10px 0' : '10px 16px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        backgroundColor: active ? 'rgba(34,211,238,0.06)' : 'transparent',
        color: active ? '#E0F2FE' : '#64748B',
        boxShadow: active ? 'inset 0 0 0 1px rgba(34,211,238,0.12), 0 0 20px rgba(34,211,238,0.04)' : 'none',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      <Icon className="w-[18px] h-[18px] flex-shrink-0" />
      {!collapsed && <span className="flex-1 text-left text-sm font-semibold">{label}</span>}
      {!collapsed && active && <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />}
      {!collapsed && badge != null && <span className="px-2 py-0.5 rounded-full text-[10px] font-black text-white shadow-md" style={{ backgroundColor: COLORS.danger }}>{badge}</span>}
      {collapsed && badge != null && (
        <span className="absolute top-1 right-1 min-w-[14px] h-3.5 rounded-full text-[8px] font-black text-white flex items-center justify-center px-0.5"
          style={{ backgroundColor: COLORS.danger }}>{badge > 9 ? '9+' : badge}</span>
      )}
      {/* Tooltip for collapsed mode */}
      {collapsed && (
        <span className="absolute left-full ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50"
          style={{ backgroundColor: '#0B1628', border: '1px solid rgba(34,211,238,0.15)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {label}
        </span>
      )}
    </button>
  )
}

export default function DashboardLayout({ children, title, subtitle, servers: propServers, selectedServer, onServerChange }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const activeNav = location.pathname.replace('/', '') || 'dashboard'

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [logoutModal, setLogoutModal] = useState(false)
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [contactModalOpen, setContactModalOpen] = useState(false)
  const [servers, setServers] = useState(propServers || [])
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false)
  const [currentServer, setCurrentServer] = useState(selectedServer || null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertCount, setAlertCount] = useState(0)
  const knownAlertIdsRef = useRef(new Set())
  const [apiOnline, setApiOnline] = useState(true)

  // Check API health status
  useEffect(() => {
    const checkApiHealth = () => {
      fetch(`${BACKEND_URL}/health`)
        .then((res) => {
          setApiOnline(res.ok)
        })
        .catch(() => {
          setApiOnline(false)
        })
    }
    checkApiHealth()
    const interval = setInterval(checkApiHealth, 15000)
    return () => clearInterval(interval)
  }, [])

  // Persist sidebar state
  useEffect(() => {
    const saved = localStorage.getItem('logai_sidebar_collapsed')
    if (saved !== null) setSidebarCollapsed(saved === 'true')
  }, [])

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      localStorage.setItem('logai_sidebar_collapsed', String(!prev))
      return !prev
    })
  }

  useEffect(() => {
    if (propServers) { setServers(propServers); return }
    let ignore = false
    authFetch(`${BACKEND_URL}/api/v1/servers`).then(async (response) => {
      if (response?.ok && !ignore) {
        const data = await response.json()
        if (ignore) return
        setServers(data)
      }
    }).catch(() => {})
    return () => { ignore = true }
  }, [propServers])

  useEffect(() => { setCurrentServer(selectedServer || null) }, [selectedServer])

  useEffect(() => {
    authFetch(`${BACKEND_URL}/api/v1/servers/dashboard/overview`).then(async (response) => {
      if (response?.ok) {
        const data = await response.json()
        setAlertCount(data.total_anomalies_24h || 0)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const close = () => { setServerDropdownOpen(false); setProfileOpen(false); setAlertsOpen(false) }
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
    if (isNewAlert) setAlertCount(prev => prev + 1)
    setAlerts(prevAlerts => mergeAlertPreview(prevAlerts, alert))
  }, [])

  useLogStream({ serverId: null, onAnomaly: handleIncomingAnomaly })

  const handleAlertsClick = (e) => { e.stopPropagation(); if (!alertsOpen) fetchAlerts(); setAlertsOpen(!alertsOpen) }
  const handleLogout = async () => { await logout(); navigate('/auth', { replace: true }) }
  const handleServerSelect = (server) => { setCurrentServer(server); setServerDropdownOpen(false); if (onServerChange) onServerChange(server) }
  const getInitials = () => user?.name?.split(' ').map(name => name[0]).join('').toUpperCase().slice(0, 2) || 'U'

  const sidebarW = sidebarCollapsed ? 72 : 288

  const SidebarContent = ({ mobile = false }) => (
    <div className="flex flex-col h-full">
      {/* Logo + Toggle */}
      <div className="border-b flex-shrink-0" style={{ borderColor: 'rgba(34,211,238,0.12)', backgroundColor: '#050B16' }}>
        {sidebarCollapsed && !mobile ? (
          <div className="flex items-center justify-center py-4">
            <button
              onClick={toggleSidebar}
              className="w-10 h-10 rounded-xl border border-cyan-300/10 bg-white/[0.03] flex items-center justify-center text-cyan-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="Expand sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="p-4 flex items-center gap-3">
            <div className="flex-1 flex items-center justify-center cursor-pointer rounded-2xl overflow-hidden border border-cyan-300/10 bg-white/[0.03] px-3 py-3 shadow-2xl shadow-cyan-950/20" onClick={() => navigate('/dashboard')}>
              <img src={brandAssets.dashboardLogo} alt="LogAI" className="h-12 w-auto object-contain" />
            </div>
            {!mobile && (
              <button
                onClick={toggleSidebar}
                className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                title="Collapse sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <NavItem icon={Network} label="System Map" active={activeNav === 'architecture'} onClick={() => { navigate('/architecture'); setMobileSidebarOpen(false) }} collapsed={sidebarCollapsed && !mobile} />
        <NavItem icon={LayoutDashboard} label="Dashboard" active={activeNav === 'dashboard'} onClick={() => { navigate('/dashboard'); setMobileSidebarOpen(false) }} collapsed={sidebarCollapsed && !mobile} />
        <NavItem icon={BarChart3} label="Analytics" active={activeNav === 'analytics'} onClick={() => { navigate('/analytics'); setMobileSidebarOpen(false) }} collapsed={sidebarCollapsed && !mobile} />
        <NavItem icon={Server} label="Servers" active={activeNav === 'servers'} onClick={() => { navigate('/servers'); setMobileSidebarOpen(false) }} collapsed={sidebarCollapsed && !mobile} />
        <NavItem icon={Terminal} label="Logs" active={activeNav === 'logs'} onClick={() => { navigate('/logs'); setMobileSidebarOpen(false) }} collapsed={sidebarCollapsed && !mobile} />
        <NavItem icon={AlertTriangle} label="Alerts" active={activeNav === 'alerts'} onClick={() => { navigate('/alerts'); setMobileSidebarOpen(false) }} badge={alertCount > 0 ? alertCount : null} collapsed={sidebarCollapsed && !mobile} />
        <NavItem icon={MessageCircle} label="AI Chat" active={activeNav === 'chat'} onClick={() => { navigate('/chat'); setMobileSidebarOpen(false) }} collapsed={sidebarCollapsed && !mobile} />
        <div className="pt-2 mt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <NavItem icon={Plug} label="Integrations" active={activeNav === 'integrations'} onClick={() => { navigate('/integrations'); setMobileSidebarOpen(false) }} collapsed={sidebarCollapsed && !mobile} />
          <NavItem icon={BookOpen} label="API Docs" active={activeNav === 'docs'} onClick={() => { navigate('/docs'); setMobileSidebarOpen(false) }} collapsed={sidebarCollapsed && !mobile} />
        </div>
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t flex-shrink-0 space-y-0.5" style={{ borderColor: 'rgba(34,211,238,0.1)' }}>
        <NavItem icon={Settings} label="Settings" active={activeNav === 'settings'} onClick={() => { navigate('/settings'); setMobileSidebarOpen(false) }} collapsed={sidebarCollapsed && !mobile} />
        {/* Meet the Team */}
        <button
          onClick={() => { setTeamModalOpen(true); setMobileSidebarOpen(false) }}
          title={sidebarCollapsed && !mobile ? 'Meet the Team' : undefined}
          className="group relative w-full flex items-center gap-3 rounded-xl transition-all duration-300 cursor-pointer text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]"
          style={{ padding: sidebarCollapsed && !mobile ? '10px 0' : '10px 16px', justifyContent: sidebarCollapsed && !mobile ? 'center' : 'flex-start' }}
        >
          <Users className="w-[18px] h-[18px] flex-shrink-0" />
          {(!sidebarCollapsed || mobile) && <span className="text-sm font-semibold">Meet the Team</span>}
          {sidebarCollapsed && !mobile && (
            <span className="absolute left-full ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50"
              style={{ backgroundColor: '#0B1628', border: '1px solid rgba(34,211,238,0.15)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
              Meet the Team
            </span>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen dark" style={{ backgroundColor: COLORS.background }}>
      {/* Modals */}
      <ConfirmModal open={logoutModal} onClose={() => setLogoutModal(false)} onConfirm={handleLogout}
        title="Sign out?" description="You will be logged out of your account and redirected to the login page."
        confirmText="Sign out" variant="logout" />
      <TeamModal open={teamModalOpen} onClose={() => setTeamModalOpen(false)} />
      <ContactModal open={contactModalOpen} onClose={() => setContactModalOpen(false)} />

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-[150] flex lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative z-10 w-72 h-full border-r flex flex-col"
            style={{ background: 'linear-gradient(180deg, #07101f 0%, #050914 100%)', borderColor: 'rgba(34,211,238,0.12)' }}>
            <div className="absolute top-4 right-4">
              <button onClick={() => setMobileSidebarOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarContent mobile />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div
        className="hidden lg:flex flex-col border-r flex-shrink-0 transition-all duration-300"
        style={{
          width: sidebarW,
          background: 'linear-gradient(180deg, #07101f 0%, #050914 100%)',
          borderColor: 'rgba(34,211,238,0.12)',
        }}
      >
        <SidebarContent />
      </div>

      {/* Main content area */}
      <div className="relative flex-1 flex min-w-0 flex-col overflow-visible">
        {/* Top bar */}
        <div className="relative z-[100] border-b backdrop-blur-xl" style={{ backgroundColor: 'rgba(5, 9, 20, 0.72)', borderColor: 'rgba(34,211,238,0.08)' }}>
          <div className="h-16 px-4 lg:px-6 flex items-center gap-3 lg:gap-4">
            {/* Mobile hamburger */}
            <button
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setServerDropdownOpen(!serverDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer border hover-glow-cyan hover:bg-cyan-500/5"
                style={{ color: '#BAE6FD', backgroundColor: 'rgba(56,189,248,0.04)', borderColor: 'rgba(56,189,248,0.2)' }}>
                <Server className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:block">{currentServer?.name || 'All Servers'}</span>
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
                <span className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400 group-hover:text-white transition-colors hidden sm:block">AI Ops Command System</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* API Health Status Indicator */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 bg-white/[0.02] text-[10px] font-black uppercase tracking-widest">
                <span className={`h-2 w-2 rounded-full ${apiOnline ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`} />
                <span className={apiOnline ? 'text-emerald-400' : 'text-rose-400'}>
                  API: {apiOnline ? 'Online' : 'Offline'}
                </span>
              </div>

              {/* Alerts */}
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

              {/* Profile */}
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

        {/* Page content */}
        <div className="relative z-0 flex-1 overflow-auto command-surface flex flex-col">
          <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-0" style={{ left: sidebarW }}>
            <img src={brandAssets.dashboardLogo} alt="" className="w-[680px] h-auto select-none" style={{ opacity: 0.015, filter: 'blur(0.5px)' }} />
          </div>
          <div className="flex-1 p-6">
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
          <Footer onTeamClick={() => setTeamModalOpen(true)} onContactClick={() => setContactModalOpen(true)} />
        </div>
      </div>
    </div>
  )
}
