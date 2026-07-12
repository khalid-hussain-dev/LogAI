import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Check, Plug, Code, Terminal, BellRing, Mail, Link2, Save, AlertTriangle } from 'lucide-react'
import DashboardLayout from '../components/DashboardLayout'
import { authFetch } from '../services/auth'
import { useToast } from '../context/ToastContext'

const BACKEND_URL = typeof window !== 'undefined' ? window.location.origin : ''
const COLORS = {
  card: '#111827',
  background: '#0B1220',
  accentBlue: '#3B82F6',
  aiCyan: '#22D3EE',
  success: '#10B981',
  warning: '#F59E0B',
}

const INITIAL_SETTINGS = {
  slack_enabled: false,
  slack_webhook_url: '',
  slack_configured: false,
  email_enabled: false,
  email_recipients: '',
  email_configured: false,
  email_service_ready: false,
  webhook_enabled: false,
  webhook_url: '',
  webhook_configured: false,
  minimum_anomaly_score: 0.7,
  connected_channels: 0,
}

function SectionCard({ icon: Icon, title, subtitle, color, children, action }) {
  return (
    <div className="rounded-2xl p-6 border border-white/5" style={{ backgroundColor: COLORS.card }}>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <p className="text-base text-gray-400 mt-1">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-base font-medium text-white">{label}</p>
        {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`w-14 h-8 rounded-full transition-colors relative ${checked ? 'bg-blue-500' : 'bg-white/10'}`}
      >
        <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${checked ? 'translate-x-7' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

export default function Integrations() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [servers, setServers] = useState([])
  const [copiedId, setCopiedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingChannel, setTestingChannel] = useState(null)
  const [settings, setSettings] = useState(INITIAL_SETTINGS)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [serversResponse, integrationsResponse] = await Promise.all([
          authFetch(`${BACKEND_URL}/api/v1/servers`),
          authFetch(`${BACKEND_URL}/api/v1/integrations/alerts`),
        ])

        if (serversResponse?.ok) {
          setServers(await serversResponse.json())
        }

        if (integrationsResponse?.ok) {
          const data = await integrationsResponse.json()
          setSettings({
            ...INITIAL_SETTINGS,
            ...data,
            slack_webhook_url: data.slack_webhook_url || '',
            email_recipients: data.email_recipients || '',
            webhook_url: data.webhook_url || '',
          })
        }
      } catch {
        addToast('Failed to load integrations', 'error')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [addToast])

  const copy = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
    addToast('Copied to clipboard', 'success')
  }

  const extractError = async (response, fallback) => {
    const data = await response.json().catch(() => ({}))
    return data.detail || fallback
  }

  const persistSettings = async ({ silentSuccess = false } = {}) => {
    setSaving(true)
    try {
      const response = await authFetch(`${BACKEND_URL}/api/v1/integrations/alerts`, {
        method: 'PUT',
        body: JSON.stringify({
          slack_enabled: settings.slack_enabled,
          slack_webhook_url: settings.slack_webhook_url,
          email_enabled: settings.email_enabled,
          email_recipients: settings.email_recipients,
          webhook_enabled: settings.webhook_enabled,
          webhook_url: settings.webhook_url,
          minimum_anomaly_score: Number(settings.minimum_anomaly_score),
        }),
      })

      if (!response?.ok) {
        const message = response ? await extractError(response, 'Failed to save integrations') : 'Session expired'
        addToast(message, 'error')
        return null
      }

      const data = await response.json()
      setSettings({
        ...INITIAL_SETTINGS,
        ...data,
        slack_webhook_url: data.slack_webhook_url || '',
        email_recipients: data.email_recipients || '',
        webhook_url: data.webhook_url || '',
      })

      if (!silentSuccess) addToast('Integration settings saved', 'success')
      return data
    } catch {
      addToast('Failed to save integrations', 'error')
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (channel) => {
    setTestingChannel(channel)
    try {
      const saved = await persistSettings({ silentSuccess: true })
      if (!saved) return

      const defaultServer = servers[0]
      const response = await authFetch(`${BACKEND_URL}/api/v1/integrations/alerts/test`, {
        method: 'POST',
        body: JSON.stringify({
          channel,
          server_name: defaultServer?.name || 'Demo Server',
          message: `Synthetic ${channel} alert from LogAI integration test.`,
          anomaly_score: Math.min(1, Number(settings.minimum_anomaly_score) + 0.15),
        }),
      })

      if (!response?.ok) {
        const message = response ? await extractError(response, `Failed to send ${channel} test`) : 'Session expired'
        addToast(message, 'error')
        return
      }

      const data = await response.json()
      addToast(data.message || `Test ${channel} notification sent`, 'success')
    } catch {
      addToast(`Failed to send ${channel} test`, 'error')
    } finally {
      setTestingChannel(null)
    }
  }

  const handleField = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const defaultServer = servers[0]
  const apiKey = defaultServer?.api_key || 'YOUR_API_KEY'
  const connectedChannels = [
    settings.slack_enabled && settings.slack_webhook_url.trim(),
    settings.email_enabled && settings.email_recipients.trim() && settings.email_service_ready,
    settings.webhook_enabled && settings.webhook_url.trim(),
  ].filter(Boolean).length

  const curlSingle = `curl -X POST ${BACKEND_URL}/api/v1/ingest \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -d '{"level":"info","message":"Application started","service":"my-app"}'`

  const curlBatch = `curl -X POST ${BACKEND_URL}/api/v1/ingest/batch \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -d '{"logs":[{"level":"info","message":"Log 1"},{"level":"error","message":"Log 2"}]}'`

  const fluentdConfig = `# Add to your Fluentd config
<match **>
  @type http
  @id logai
  endpoint ${BACKEND_URL}/api/v1/ingest
  headers x-api-key:${apiKey}
  <buffer>
    @type memory
    flush_interval 5s
  </buffer>
</match>`

  const webhookPayload = `{
  "event": "anomaly_detected",
  "app": "LogAI",
  "server_name": "${defaultServer?.name || 'Demo Server'}",
  "level": "critical",
  "message": "Synthetic webhook test from LogAI",
  "anomaly": true,
  "anomaly_score": 0.92
}`

  return (
    <DashboardLayout title="Integrations" subtitle="Configure alert delivery and ingestion touchpoints">
      <div className="space-y-6 max-w-5xl">
        <SectionCard
          icon={BellRing}
          title="Alert Delivery"
          subtitle="Send anomaly alerts to Slack, email, and custom webhooks from the live detection pipeline."
          color={COLORS.aiCyan}
          action={(
            <button
              onClick={() => persistSettings()}
              disabled={saving || loading}
              className="px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: COLORS.accentBlue, color: 'white' }}
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save changes'}
            </button>
          )}
        >
          {loading ? (
            <div className="h-24 rounded-xl animate-pulse bg-white/5" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl p-4 border border-white/5" style={{ backgroundColor: COLORS.background }}>
                <p className="text-sm text-gray-500">Connected channels</p>
                <p className="text-3xl font-bold text-white mt-2">{connectedChannels}</p>
              </div>
              <div className="rounded-xl p-4 border border-white/5" style={{ backgroundColor: COLORS.background }}>
                <p className="text-sm text-gray-500">Minimum anomaly score</p>
                <p className="text-3xl font-bold text-white mt-2">{Math.round(Number(settings.minimum_anomaly_score) * 100)}%</p>
              </div>
              <div className="rounded-xl p-4 border border-white/5" style={{ backgroundColor: COLORS.background }}>
                <p className="text-sm text-gray-500">Email service</p>
                <p className="text-lg font-semibold mt-2" style={{ color: settings.email_service_ready ? COLORS.success : COLORS.warning }}>
                  {settings.email_service_ready ? 'Configured' : 'SMTP required'}
                </p>
              </div>
            </div>
          )}
        </SectionCard>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <SectionCard
            icon={BellRing}
            title="Slack"
            subtitle="Deliver anomalies to an incoming Slack webhook."
            color={COLORS.accentBlue}
            action={(
              <button
                onClick={() => handleTest('slack')}
                disabled={testingChannel === 'slack' || loading}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-white/10 text-gray-200 hover:bg-white/5 disabled:opacity-50"
              >
                {testingChannel === 'slack' ? 'Sending...' : 'Send test'}
              </button>
            )}
          >
            <div className="space-y-4">
              <Toggle
                checked={settings.slack_enabled}
                onChange={() => handleField('slack_enabled', !settings.slack_enabled)}
                label="Enable Slack alerts"
                hint="Best for team-wide anomaly visibility."
              />
              <div>
                <label className="text-sm text-gray-400">Slack webhook URL</label>
                <input
                  value={settings.slack_webhook_url}
                  onChange={(e) => handleField('slack_webhook_url', e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="mt-2 w-full px-4 py-3 rounded-xl border text-white bg-transparent focus:outline-none"
                  style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: COLORS.background }}
                />
              </div>
              <p className="text-sm" style={{ color: settings.slack_configured ? '#9ae6b4' : '#9CA3AF' }}>
                {settings.slack_configured ? 'Webhook saved and ready for tests.' : 'Add a Slack incoming webhook URL to activate this channel.'}
              </p>
            </div>
          </SectionCard>

          <SectionCard
            icon={Mail}
            title="Email"
            subtitle="Deliver anomalies to one or more inboxes."
            color={COLORS.success}
            action={(
              <button
                onClick={() => handleTest('email')}
                disabled={testingChannel === 'email' || loading}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-white/10 text-gray-200 hover:bg-white/5 disabled:opacity-50"
              >
                {testingChannel === 'email' ? 'Sending...' : 'Send test'}
              </button>
            )}
          >
            <div className="space-y-4">
              <Toggle
                checked={settings.email_enabled}
                onChange={() => handleField('email_enabled', !settings.email_enabled)}
                label="Enable email alerts"
                hint="Separate multiple recipients with commas."
              />
              <div>
                <label className="text-sm text-gray-400">Recipients</label>
                <input
                  value={settings.email_recipients}
                  onChange={(e) => handleField('email_recipients', e.target.value)}
                  placeholder="alerts@example.com, oncall@example.com"
                  className="mt-2 w-full px-4 py-3 rounded-xl border text-white bg-transparent focus:outline-none"
                  style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: COLORS.background }}
                />
              </div>
              {!settings.email_service_ready && (
                <div className="rounded-xl px-4 py-3 border" style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.25)' }}>
                  <p className="text-sm" style={{ color: COLORS.warning }}>
                    SMTP is not configured on the backend yet. Saving is allowed, but delivery and tests will stay disabled until SMTP env vars are added.
                  </p>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            icon={Link2}
            title="Webhook"
            subtitle="POST anomaly payloads into your own systems."
            color={COLORS.warning}
            action={(
              <button
                onClick={() => handleTest('webhook')}
                disabled={testingChannel === 'webhook' || loading}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-white/10 text-gray-200 hover:bg-white/5 disabled:opacity-50"
              >
                {testingChannel === 'webhook' ? 'Sending...' : 'Send test'}
              </button>
            )}
          >
            <div className="space-y-4">
              <Toggle
                checked={settings.webhook_enabled}
                onChange={() => handleField('webhook_enabled', !settings.webhook_enabled)}
                label="Enable webhook alerts"
                hint="Useful for n8n, Zapier, or your own incident tooling."
              />
              <div>
                <label className="text-sm text-gray-400">Destination URL</label>
                <input
                  value={settings.webhook_url}
                  onChange={(e) => handleField('webhook_url', e.target.value)}
                  placeholder="https://example.com/logai/anomalies"
                  className="mt-2 w-full px-4 py-3 rounded-xl border text-white bg-transparent focus:outline-none"
                  style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: COLORS.background }}
                />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">Sample payload</p>
                <div className="relative">
                  <pre className="p-4 rounded-xl text-sm font-mono overflow-x-auto whitespace-pre-wrap" style={{ backgroundColor: COLORS.background, color: '#e5e7eb' }}>{webhookPayload}</pre>
                  <button onClick={() => copy(webhookPayload, 'webhookPayload')} className="absolute top-2 right-2 p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
                    {copiedId === 'webhookPayload' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          icon={AlertTriangle}
          title="Alert Sensitivity"
          subtitle="Choose how strong an anomaly should be before LogAI delivers external alerts."
          color={COLORS.warning}
        >
          <div className="space-y-4">
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.01"
              value={settings.minimum_anomaly_score}
              onChange={(e) => handleField('minimum_anomaly_score', Number(e.target.value))}
              className="w-full"
            />
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Notify from 50%</span>
              <span className="text-lg font-semibold text-white">{Math.round(Number(settings.minimum_anomaly_score) * 100)}%</span>
              <span className="text-sm text-gray-500">Up to 100%</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={Plug}
          title="Quick Start"
          subtitle="Create a server in LogAI, then use its API key to send logs."
          color={COLORS.accentBlue}
        >
          {servers.length === 0 ? (
            <button onClick={() => navigate('/servers')} className="px-4 py-2 rounded-lg font-medium transition-colors" style={{ backgroundColor: COLORS.accentBlue, color: 'white' }}>
              Create your first server {'->'}
            </button>
          ) : (
            <p className="text-base text-gray-400">Using server: <span className="text-white font-medium">{defaultServer?.name}</span></p>
          )}
        </SectionCard>

        <SectionCard icon={Code} title="Direct API" subtitle="Send logs via HTTP POST with the x-api-key header." color={COLORS.aiCyan}>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-2">Single log</p>
              <div className="relative">
                <pre className="p-4 rounded-xl text-sm font-mono overflow-x-auto" style={{ backgroundColor: COLORS.background, color: '#e5e7eb' }}>{curlSingle}</pre>
                <button onClick={() => copy(curlSingle, 'curlSingle')} className="absolute top-2 right-2 p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
                  {copiedId === 'curlSingle' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-2">Batch logs</p>
              <div className="relative">
                <pre className="p-4 rounded-xl text-sm font-mono overflow-x-auto" style={{ backgroundColor: COLORS.background, color: '#e5e7eb' }}>{curlBatch}</pre>
                <button onClick={() => copy(curlBatch, 'curlBatch')} className="absolute top-2 right-2 p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
                  {copiedId === 'curlBatch' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={Terminal} title="Fluentd" subtitle="Forward logs from Docker, syslog, or Fluentd sources to LogAI." color={COLORS.aiCyan}>
          <div className="relative">
            <pre className="p-4 rounded-xl text-sm font-mono overflow-x-auto whitespace-pre-wrap" style={{ backgroundColor: COLORS.background, color: '#e5e7eb' }}>{fluentdConfig}</pre>
            <button onClick={() => copy(fluentdConfig, 'fluentd')} className="absolute top-2 right-2 p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
              {copiedId === 'fluentd' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </SectionCard>
      </div>
    </DashboardLayout>
  )
}
