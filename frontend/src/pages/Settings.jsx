import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import DashboardLayout from '../components/DashboardLayout'
import { Save, User, Sliders, Bell, Layout } from 'lucide-react'
import { useToast } from '../context/ToastContext'

export default function Settings() {
  const { user } = useAuth()
  const { addToast } = useToast()

  // Load preferences from localStorage
  const [prefs, setPrefs] = useState(() => {
    try {
      return {
        mapSpeed: localStorage.getItem('logai_map_speed') || 'normal',
        audioAlerts: localStorage.getItem('logai_audio_alerts') === 'true',
        dashboardRefresh: localStorage.getItem('logai_refresh_rate') || '30',
        devMode: localStorage.getItem('logai_dev_mode') === 'true'
      }
    } catch {
      return {
        mapSpeed: 'normal',
        audioAlerts: false,
        dashboardRefresh: '30',
        devMode: false
      }
    }
  })

  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      try {
        localStorage.setItem('logai_map_speed', prefs.mapSpeed)
        localStorage.setItem('logai_audio_alerts', String(prefs.audioAlerts))
        localStorage.setItem('logai_refresh_rate', prefs.dashboardRefresh)
        localStorage.setItem('logai_dev_mode', String(prefs.devMode))
        
        // Dispatch storage event so other components (like map) update live
        window.dispatchEvent(new Event('storage'))
        
        addToast('Preferences saved successfully', 'success')
      } catch (err) {
        addToast('Failed to save preferences', 'error')
      } finally {
        setSaving(false)
      }
    }, 600)
  }

  return (
    <DashboardLayout title="System Settings" subtitle="Configure system visualization and workspace preferences">
      <div className="space-y-6 max-w-4xl">
        
        {/* Profile Card */}
        <div className="rounded-2xl p-6 border border-white/5" style={{ backgroundColor: '#081120' }}>
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/15">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Profile Credentials</h3>
              <p className="text-xs text-slate-400">Authenticated user context</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-1">Full Name</label>
              <p className="text-slate-200 text-sm font-semibold py-1">{user?.name || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-1">Email Address</label>
              <p className="text-slate-200 text-sm font-semibold py-1">{user?.email || '—'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-400 block mb-1">Authentication Method</label>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-400/10 text-cyan-400 uppercase tracking-wider mt-1">
                {user?.auth_provider || 'local'}
              </span>
            </div>
          </div>
        </div>

        {/* Preferences Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Map Animations Card */}
          <div className="rounded-2xl p-6 border border-white/5" style={{ backgroundColor: '#081120' }}>
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-cyan-500/15">
                <Sliders className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">System Map Tuning</h3>
                <p className="text-xs text-slate-400">Adjust the 2D pipeline visualization</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-300 font-medium block mb-2">Packet Animation Speed</label>
                <div className="grid grid-cols-3 gap-2">
                  {['slow', 'normal', 'fast'].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPrefs({ ...prefs, mapSpeed: speed })}
                      className={`py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                        prefs.mapSpeed === speed
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-md shadow-cyan-950/20'
                          : 'border-white/5 bg-[#050914] text-slate-400 hover:text-white hover:bg-white/[0.02]'
                      }`}
                    >
                      {speed}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">Adjusts how quickly the glowing packets flow through the pipelines.</p>
              </div>
            </div>
          </div>

          {/* Workspace Preferences */}
          <div className="rounded-2xl p-6 border border-white/5" style={{ backgroundColor: '#081120' }}>
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-500/15">
                <Layout className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Console Options</h3>
                <p className="text-xs text-slate-400">Tailor the console behaviors</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Dev Mode toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-200">Developer Verbose Payloads</p>
                  <p className="text-xs text-slate-500 mt-1">Show full JSON structures in logs view.</p>
                </div>
                <button
                  onClick={() => setPrefs({ ...prefs, devMode: !prefs.devMode })}
                  className={`w-12 h-7 rounded-full relative transition-colors cursor-pointer ${prefs.devMode ? 'bg-blue-500' : 'bg-white/10'}`}
                >
                  <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${prefs.devMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Refresh Rate */}
              <div>
                <label className="text-sm text-slate-300 font-medium block mb-2">Metrics Pull Interval</label>
                <select
                  value={prefs.dashboardRefresh}
                  onChange={(e) => setPrefs({ ...prefs, dashboardRefresh: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-slate-300 border focus:outline-none text-sm"
                  style={{ backgroundColor: '#050914', borderColor: 'rgba(255,255,255,0.08)' }}
                >
                  <option value="10">10 seconds (Aggressive)</option>
                  <option value="30">30 seconds (Normal)</option>
                  <option value="60">60 seconds (Relaxed)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sound Notification Alert Preferences */}
          <div className="rounded-2xl p-6 border border-white/5 md:col-span-2" style={{ backgroundColor: '#081120' }}>
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/15">
                  <Bell className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Audio Indicators</h3>
                  <p className="text-xs text-slate-400">Configure sound effects for critical updates</p>
                </div>
              </div>
              <button
                onClick={() => setPrefs({ ...prefs, audioAlerts: !prefs.audioAlerts })}
                className={`w-12 h-7 rounded-full relative transition-colors cursor-pointer ${prefs.audioAlerts ? 'bg-emerald-500' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform ${prefs.audioAlerts ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-300 leading-relaxed">
                Play an instant audio alert chime when the WebSocket receives a highly critical anomaly log event.
              </p>
              <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                prefs.audioAlerts ? 'bg-emerald-400/10 text-emerald-400' : 'bg-white/5 text-slate-500'
              }`}>
                {prefs.audioAlerts ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 rounded-xl font-semibold flex items-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 text-white"
            style={{ backgroundColor: '#2563EB' }}
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving Preferences...' : 'Save Settings'}
          </button>
        </div>

      </div>
    </DashboardLayout>
  )
}
