import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Trash2, Copy, Check, MessageSquare, RefreshCw } from 'lucide-react'
import { authFetch } from '../services/auth'
import { useAuth } from '../context/AuthContext'
import { useSearchParams } from 'react-router-dom'
import { brandAssets } from '../assets/brand'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''

const SUGGESTIONS = [
  { label: 'System Health Summary', query: 'Show me a health and status summary' },
  { label: 'Check for Errors', query: 'Find all database errors in the last hour' },
  { label: 'Summarize Anomalies', query: 'Are there any anomalies or spikes detected?' },
  { label: 'Log Analysis Help', query: 'How do I search logs using query filters?' },
]

export default function ChatEngine({ fullHeight = false }) {
  const { user } = useAuth()
  const storageKey = user?.id ? `logai_chat_history_${user.id}` : 'logai_chat_history_guest'

  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [selectedModel, setSelectedModel] = useState("deepseek")
  const messagesEndRef = useRef(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = searchParams.get('query')

  // Auto-send query from URL if present
  useEffect(() => {
    if (initialQuery && !isTyping) {
      handleSend(initialQuery)
      setSearchParams(new URLSearchParams()) // clear param after sending
    }
  }, [initialQuery])

  // Load user-scoped history whenever active user changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      setMessages(saved ? JSON.parse(saved) : [])
    } catch {
      setMessages([])
    }
  }, [storageKey])

  // Save history to user-scoped key in localStorage
  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch (e) {
      console.warn('Failed to save chat history:', e)
    }
  }, [messages, storageKey])


  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

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
      
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        text: response,
        sender: 'ai',
        timestamp: new Date()
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: `ai-err-${Date.now()}`,
        text: "Connection error. Please check your backend is running.",
        sender: 'ai',
        timestamp: new Date()
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    handleSend(inputValue)
  }

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
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Simple formatter to parse bullet points, markdown bolding and line breaks
  const renderFormattedMessage = (text) => {
    if (!text) return null
    return text.split('\n').map((line, i) => {
      let content = line
      
      // Bold syntax (**text**)
      const boldRegex = /\*\*(.*?)\*\*/g
      let parts = []
      let lastIndex = 0
      let match
      
      while ((match = boldRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index))
        }
        parts.push(<strong key={match.index} className="text-cyan-300 font-bold">{match[1]}</strong>)
        lastIndex = boldRegex.lastIndex
      }
      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex))
      }
      
      const contentElem = parts.length > 0 ? parts : content

      // Check if it's a bullet point
      if (line.trim().startsWith('- ')) {
        return (
          <div key={i} className="pl-4 relative py-0.5 text-slate-300 text-sm">
            <span className="absolute left-0 top-[10px] w-1.5 h-1.5 rounded-full bg-cyan-400 opacity-80"></span>
            {contentElem.slice(2)}
          </div>
        )
      }

      return (
        <p key={i} className={line.trim() === '' ? 'h-3' : 'min-h-[1.5rem]'}>
          {contentElem}
        </p>
      )
    })
  }

  return (
    <div className={`flex flex-col w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl ${
      fullHeight ? 'flex-1 min-h-[500px] h-full' : 'max-w-[750px] mx-auto h-[600px]'
    }`} style={{ backgroundColor: '#081120' }}>
      
      {/* Header */}
      <div className="px-6 py-4 flex-shrink-0 border-b border-cyan-400/10 flex items-center justify-between"
        style={{ background: 'linear-gradient(90deg, #0B1628 0%, #07101F 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-950/40 border border-cyan-500/25 rounded-xl shadow-lg shadow-cyan-950/50">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">AI Ops Assistant</h2>
            <p className="text-xs text-slate-400 font-medium">Elasticsearch-powered log insights</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg border border-cyan-500/20 text-cyan-300 focus:outline-none bg-[#050914] cursor-pointer"
          >
            <option value="deepseek">DeepSeek</option>
            <option value="pulse">LogAI Pulse (Tier 0 - Metrics)</option>
            <option value="cortex">LogAI Cortex (Tier 1 - Offline ML)</option>
            <option value="cortex-adaptive">LogAI Cortex Adaptive (Tier 2 - Self-Learning)</option>
            <option value="cortex-prime">LogAI Cortex Prime v1 (Tier 3 - Premium)</option>
          </select>

          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Ready</span>
          </div>
          
          {messages.length > 0 && (
            <button onClick={handleClearHistory}
              title="Clear conversation"
              className="p-1.5 rounded-lg border border-white/5 bg-white/[0.02] text-slate-400 hover:text-rose-400 hover:border-rose-500/20 hover:bg-rose-500/5 transition-all duration-200 cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin" style={{ backgroundColor: '#050914' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto py-8">
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/20 border border-cyan-500/10 flex items-center justify-center mb-4 shadow-xl">
              <MessageSquare className="w-8 h-8 text-cyan-400 opacity-60" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Welcome to AI Ops</h3>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              I analyze your Elasticsearch logs, track error patterns, and report anomaly statistics. Get started with one of the quick suggestions:
            </p>
            
            <div className="grid grid-cols-1 gap-2.5 w-full">
              {SUGGESTIONS.map((s, idx) => (
                <button key={idx} onClick={() => handleSend(s.query)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-cyan-500/20 text-slate-300 hover:text-cyan-400 transition-all duration-200 group text-sm font-medium flex items-center justify-between cursor-pointer">
                  <span>{s.label}</span>
                  <Sparkles className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-cyan-400 transition-all duration-200" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user'
            return (
              <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg flex-shrink-0 bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center shadow-md">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                  </div>
                )}
                
                <div className={`relative group max-w-[80%] rounded-2xl px-5 py-3.5 ${
                  isUser
                    ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-none shadow-lg shadow-blue-950/20'
                    : 'bg-[#0B1220] text-slate-200 border border-cyan-500/10 rounded-tl-none shadow-lg shadow-black/20'
                }`}>
                  
                  {/* Action Bar (Copy Button) for AI replies */}
                  {!isUser && (
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button onClick={() => copyToClipboard(msg.id, msg.text)}
                        title="Copy to clipboard"
                        className="p-1 rounded bg-slate-900 border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer">
                        {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}

                  <div className="text-sm leading-relaxed space-y-1">
                    {isUser ? <p className="whitespace-pre-wrap">{msg.text}</p> : renderFormattedMessage(msg.text)}
                  </div>
                  
                  <span className={`text-[10px] mt-2 block font-semibold uppercase tracking-wider text-right ${
                    isUser ? 'text-blue-200' : 'text-slate-500'
                  }`}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            )
          })
        )}
        
        {isTyping && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center shadow-md">
              <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
            </div>
            <div className="bg-[#0B1220] border border-cyan-500/10 rounded-2xl rounded-tl-none px-5 py-3.5 flex items-center justify-center">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={onSubmit} className="border-t border-cyan-400/10 px-6 py-4 flex-shrink-0" style={{ backgroundColor: '#0B1220' }}>
        <div className="flex items-center gap-3 relative">
          <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
            disabled={isTyping}
            placeholder="Ask about system status, specific errors or recent anomalies..."
            className="flex-1 pl-4 pr-14 py-3.5 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all duration-200 border"
            style={{ backgroundColor: '#050914', borderColor: 'rgba(34,211,238,0.1)' }} />
          
          <button type="submit" disabled={!inputValue.trim() || isTyping}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed text-white shadow-md shadow-blue-950/50"
            style={{ backgroundColor: inputValue.trim() ? '#2563EB' : '#1E293B' }}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
