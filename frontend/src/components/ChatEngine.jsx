import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, Trash2, Copy, Check, MessageSquare, RefreshCw, Zap, Brain, ChevronRight } from 'lucide-react'
import { authFetch } from '../services/auth'
import { useAuth } from '../context/AuthContext'
import { useSearchParams } from 'react-router-dom'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''
const MODEL_STORAGE_KEY = 'logai_selected_model'

const MODEL_META = {
  deepseek: {
    label: 'DeepSeek',
    color: '#22d3ee',
    badge: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    desc: 'Generative cloud AI — describe any log or ask anything',
    inputPlaceholder: 'Ask about system status, errors, anomalies, or paste any log...',
    inputDisabled: false,
  },
  pulse: {
    label: 'LogAI Pulse',
    color: '#34d399',
    badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    desc: 'Zero-inference metrics report — click any keyword or just send',
    inputPlaceholder: 'Or type a keyword (status, overview, metrics...)',
    inputDisabled: false,
  },
  cortex: {
    label: 'LogAI Cortex',
    color: '#a78bfa',
    badge: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    desc: 'Offline ML — matches your live logs against 21 curated SRE patterns',
    inputPlaceholder: 'Paste a raw error log message to analyze...',
    inputDisabled: false,
  },
  'cortex-adaptive': {
    label: 'LogAI Cortex Adaptive',
    color: '#f472b6',
    badge: 'bg-pink-500/10 border-pink-500/20 text-pink-400',
    desc: 'Self-learning ML — grows smarter from every DeepSeek analysis',
    inputPlaceholder: 'Paste a raw error log message to analyze...',
    inputDisabled: false,
  },
  'cortex-prime': {
    label: 'LogAI Cortex Prime v1',
    color: '#fb923c',
    badge: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    desc: 'Premium — 2,500 SRE incident patterns, root causes & escalation paths',
    inputPlaceholder: 'Paste a raw error log message to analyze...',
    inputDisabled: false,
  },
  'cortex-prime-v2': {
    label: 'LogAI Cortex Prime v2',
    color: '#f59e0b',
    badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    desc: 'Flagship — 10,500 entries with blast radius, incident stage & operational judgment',
    inputPlaceholder: 'Paste a raw error log message to analyze...',
    inputDisabled: false,
  },
}

const LEVEL_COLORS = {
  critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  error: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  warn: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

export default function ChatEngine({ fullHeight = false }) {
  const { user } = useAuth()
  const storageKey = user?.id ? `logai_chat_history_${user.id}` : 'logai_chat_history_guest'

  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [suggestions, setSuggestions] = useState({ type: 'logs', suggestions: [], keywords: [] })
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const messagesEndRef = useRef(null)
  const [searchParams, setSearchParams] = useSearchParams()

  // Persist selected model in localStorage
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem(MODEL_STORAGE_KEY) || 'deepseek'
  })

  const handleModelChange = (val) => {
    setSelectedModel(val)
    localStorage.setItem(MODEL_STORAGE_KEY, val)
  }

  // Auto-send query from URL if present (also read model from URL)
  const initialQuery = searchParams.get('query')
  const urlModel = searchParams.get('model')

  useEffect(() => {
    if (urlModel && MODEL_META[urlModel]) {
      handleModelChange(urlModel)
    }
  }, [urlModel])

  useEffect(() => {
    if (initialQuery && !isTyping) {
      handleSend(initialQuery)
      setSearchParams(new URLSearchParams())
    }
  }, [initialQuery])

  // Load chat history
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      setMessages(saved ? JSON.parse(saved) : [])
    } catch { setMessages([]) }
  }, [storageKey])

  // Save chat history
  useEffect(() => {
    if (!storageKey) return
    try { localStorage.setItem(storageKey, JSON.stringify(messages)) }
    catch (e) { console.warn('Failed to save chat history:', e) }
  }, [messages, storageKey])

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Fetch suggestions when model changes
  const fetchSuggestions = useCallback(async (model) => {
    setLoadingSuggestions(true)
    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/chat/suggestions?model=${model}&limit=5`)
      if (res?.ok) {
        const data = await res.json()
        setSuggestions(data)
      }
    } catch (e) {
      console.warn('Failed to load suggestions:', e)
    } finally {
      setLoadingSuggestions(false)
    }
  }, [])

  useEffect(() => {
    fetchSuggestions(selectedModel)
  }, [selectedModel, fetchSuggestions])

  const handleSend = async (textToSend) => {
    if (!textToSend.trim() || isTyping) return
    const text = textToSend.trim()
    const userMsg = { id: `user-${Date.now()}`, text, sender: 'user', timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInputValue('')
    setIsTyping(true)

    try {
      const res = await authFetch(`${BACKEND_URL}/api/v1/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: text, model: selectedModel }),
      })
      const data = res?.ok ? await res.json() : null
      const response = data?.response || "I'm having trouble connecting to the analysis engine right now. Please try again."
      setMessages(prev => [...prev, { id: `ai-${Date.now()}`, text: response, sender: 'ai', timestamp: new Date() }])
    } catch {
      setMessages(prev => [...prev, { id: `ai-err-${Date.now()}`, text: "Connection error. Please check your backend is running.", sender: 'ai', timestamp: new Date() }])
    } finally {
      setIsTyping(false)
    }
  }

  const onSubmit = (e) => { e.preventDefault(); handleSend(inputValue) }

  const handleClearHistory = () => {
    if (window.confirm('Clear all conversation history?')) {
      setMessages([])
      localStorage.removeItem(storageKey)
    }
  }

  const copyToClipboard = async (id, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) { console.error('Failed to copy text:', err) }
  }

  const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const renderFormattedMessage = (text) => {
    if (!text) return null
    return text.split('\n').map((line, i) => {
      let content = line
      const boldRegex = /\*\*(.*?)\*\*/g
      const codeRegex = /`([^`]+)`/g
      let parts = []
      let lastIndex = 0
      let match

      // Process bold + code inline
      const combined = []
      const allMatches = []
      let b; const bReg = /\*\*(.*?)\*\*/g
      while ((b = bReg.exec(content)) !== null) allMatches.push({ type: 'bold', index: b.index, end: bReg.lastIndex, val: b[1] })
      let c; const cReg = /`([^`]+)`/g
      while ((c = cReg.exec(content)) !== null) allMatches.push({ type: 'code', index: c.index, end: cReg.lastIndex, val: c[1] })
      allMatches.sort((a, b) => a.index - b.index)

      let cursor = 0
      for (const m of allMatches) {
        if (m.index < cursor) continue
        if (m.index > cursor) combined.push(content.slice(cursor, m.index))
        if (m.type === 'bold') combined.push(<strong key={m.index} className="text-cyan-300 font-bold">{m.val}</strong>)
        else combined.push(<code key={m.index} className="px-1 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-xs">{m.val}</code>)
        cursor = m.end
      }
      if (cursor < content.length) combined.push(content.slice(cursor))
      const contentElem = combined.length > 0 ? combined : content

      if (line.trim() === '---') return <hr key={i} className="border-white/10 my-2" />
      if (line.trim().startsWith('- ')) return (
        <div key={i} className="pl-4 relative py-0.5 text-slate-300 text-sm">
          <span className="absolute left-0 top-[10px] w-1.5 h-1.5 rounded-full bg-cyan-400 opacity-80"></span>
          {contentElem.slice ? contentElem.slice(2) : contentElem}
        </div>
      )
      if (line.trim().match(/^\d+\./)) return (
        <div key={i} className="pl-4 py-0.5 text-slate-300 text-sm">{contentElem}</div>
      )
      return <p key={i} className={line.trim() === '' ? 'h-3' : 'min-h-[1.5rem]'}>{contentElem}</p>
    })
  }

  const meta = MODEL_META[selectedModel] || MODEL_META.deepseek

  return (
    <div className={`flex flex-col w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl ${
      fullHeight ? 'flex-1 min-h-[500px] h-full' : 'max-w-[750px] mx-auto h-[600px]'
    }`} style={{ backgroundColor: '#081120' }}>

      {/* Header */}
      <div className="px-5 py-3 flex-shrink-0 border-b border-white/[0.07] flex items-center justify-between gap-3"
        style={{ background: 'linear-gradient(90deg, #0B1628 0%, #07101F 100%)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl flex-shrink-0" style={{ backgroundColor: `${meta.color}15`, border: `1px solid ${meta.color}30` }}>
            <Brain className="w-4 h-4" style={{ color: meta.color }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white tracking-wide">{meta.label}</h2>
            <p className="text-[10px] text-slate-500 truncate">{meta.desc}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="px-2 py-1 text-[11px] rounded-lg border border-white/10 text-slate-300 focus:outline-none bg-[#050914] cursor-pointer max-w-[190px]"
          >
            <option value="deepseek">DeepSeek</option>
            <option value="pulse">LogAI Pulse (Tier 0)</option>
            <option value="cortex">LogAI Cortex (Tier 1)</option>
            <option value="cortex-adaptive">LogAI Cortex Adaptive (Tier 2)</option>
            <option value="cortex-prime">Cortex Prime v1 (Tier 3)</option>
            <option value="cortex-prime-v2">Cortex Prime v2 (Tier 3)</option>
          </select>

          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full border" style={{ backgroundColor: `${meta.color}10`, borderColor: `${meta.color}30` }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: meta.color }}></span>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>Ready</span>
          </div>

          {messages.length > 0 && (
            <button onClick={handleClearHistory} title="Clear conversation"
              className="p-1.5 rounded-lg border border-white/5 bg-white/[0.02] text-slate-500 hover:text-rose-400 hover:border-rose-500/20 transition-all cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 scrollbar-thin" style={{ backgroundColor: '#050914' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col h-full">
            {/* Model description banner */}
            <div className="rounded-xl border px-4 py-3 mb-4 flex-shrink-0" style={{ backgroundColor: `${meta.color}08`, borderColor: `${meta.color}20` }}>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5" style={{ color: meta.color }} />
                <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label} — Active</span>
              </div>
              <p className="text-xs text-slate-400">{meta.desc}</p>
            </div>

            {/* Suggestions panel */}
            <div className="flex-1">
              {selectedModel === 'pulse' ? (
                <div>
                  <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wider">Quick Keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {(suggestions.keywords || []).map((kw, i) => (
                      <button key={i} onClick={() => handleSend(kw)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer hover:scale-105"
                        style={{ backgroundColor: `${meta.color}10`, borderColor: `${meta.color}30`, color: meta.color }}>
                        {kw}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 mt-4">LogAI Pulse ignores your text — it always returns live metrics from Elasticsearch.</p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                      {loadingSuggestions ? 'Scanning your logs…' : 'Suggested Logs to Analyze'}
                    </p>
                    {loadingSuggestions && <RefreshCw className="w-3 h-3 text-slate-600 animate-spin" />}
                  </div>

                  {!loadingSuggestions && suggestions.suggestions?.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-xs text-slate-600">No matching logs found in your recent error history.</p>
                      <p className="text-xs text-slate-700 mt-1">Paste any raw log message below to analyze it manually.</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {(suggestions.suggestions || []).map((s, i) => (
                      <button key={i} onClick={() => handleSend(s.message)}
                        className="w-full text-left px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] transition-all group flex items-start gap-3 cursor-pointer">
                        <span className={`flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${LEVEL_COLORS[s.level] || LEVEL_COLORS.info}`}>
                          {s.level}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-300 font-mono truncate group-hover:text-white transition-colors">{s.message}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {s.service && <span className="text-[10px] text-slate-600">{s.service}</span>}
                            {s.confidence != null && (
                              <span className="text-[10px] font-semibold" style={{ color: meta.color }}>{s.confidence}% match</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400 flex-shrink-0 mt-1 transition-colors" />
                      </button>
                    ))}
                  </div>

                  {suggestions.suggestions?.length > 0 && (
                    <p className="text-[10px] text-slate-700 mt-3">↑ These are real logs from your servers that this model can analyze. You can also paste any custom log below.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user'
            return (
              <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center shadow-md"
                    style={{ backgroundColor: `${meta.color}15`, border: `1px solid ${meta.color}25` }}>
                    <Brain className="w-3.5 h-3.5" style={{ color: meta.color }} />
                  </div>
                )}
                <div className={`relative group max-w-[82%] rounded-2xl px-4 py-3 ${
                  isUser
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-none shadow-lg shadow-blue-950/20'
                    : 'bg-[#0B1220] text-slate-200 border border-white/[0.06] rounded-tl-none shadow-lg shadow-black/20'
                }`}>
                  {!isUser && (
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button onClick={() => copyToClipboard(msg.id, msg.text)} title="Copy to clipboard"
                        className="p-1 rounded bg-slate-900 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer">
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                  <div className="text-sm leading-relaxed space-y-1">
                    {isUser ? <p className="whitespace-pre-wrap">{msg.text}</p> : renderFormattedMessage(msg.text)}
                  </div>
                  <span className={`text-[10px] mt-1.5 block font-semibold uppercase tracking-wider text-right ${isUser ? 'text-blue-200' : 'text-slate-600'}`}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            )
          })
        )}

        {isTyping && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
              style={{ backgroundColor: `${meta.color}15`, border: `1px solid ${meta.color}25` }}>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: meta.color }} />
            </div>
            <div className="bg-[#0B1220] border border-white/[0.06] rounded-2xl rounded-tl-none px-4 py-3 flex items-center">
              <div className="flex gap-1">
                {[0, 150, 300].map(delay => (
                  <span key={delay} className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: meta.color, animationDelay: `${delay}ms` }}></span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={onSubmit} className="border-t border-white/[0.07] px-5 py-3.5 flex-shrink-0" style={{ backgroundColor: '#0B1220' }}>
        <div className="flex items-center gap-3 relative">
          <input type="text" value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isTyping}
            placeholder={meta.inputPlaceholder}
            className="flex-1 pl-4 pr-14 py-3 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 transition-all duration-200 border"
            style={{ backgroundColor: '#050914', borderColor: `${meta.color}20`, focusRingColor: `${meta.color}40` }} />
          <button type="submit" disabled={!inputValue.trim() || isTyping}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-white"
            style={{ backgroundColor: inputValue.trim() ? meta.color : '#1E293B' }}>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  )
}
