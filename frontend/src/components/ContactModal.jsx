import { useState, useEffect, useRef } from 'react'
import { X, Send, User, Mail, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react'
import emailjs from '@emailjs/browser'

const SERVICE_ID = 'service_i7ktsli'
const TEMPLATE_ID = 'template_joxs5yj'
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'aIyiuPtxeT8MW0fM_'

export default function ContactModal({ open, onClose }) {
  const formRef = useRef(null)
  const [form, setForm] = useState({ from_name: '', from_email: '', subject: '', message: '' })
  const [status, setStatus] = useState(null) // null | 'sending' | 'success' | 'error'
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setForm({ from_name: '', from_email: '', subject: '', message: '' })
      setStatus(null)
      setError('')
    }
  }, [open])

  if (!open) return null

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.from_name.trim() || !form.from_email.trim() || !form.message.trim()) return

    setStatus('sending')
    setError('')

    try {
      await emailjs.sendForm(SERVICE_ID, TEMPLATE_ID, formRef.current, PUBLIC_KEY)
      setStatus('success')
    } catch (err) {
      console.error('EmailJS error:', err)
      setError('Failed to send message. Please try again or email us directly.')
      setStatus('error')
    }
  }

  const inputStyle = {
    backgroundColor: '#050914',
    borderColor: 'rgba(34,211,238,0.12)',
    color: '#E2E8F0',
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2,6,18,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden"
        style={{ backgroundColor: '#07101F', borderColor: 'rgba(34,211,238,0.14)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 py-5 border-b flex items-center justify-between" style={{ borderColor: 'rgba(34,211,238,0.1)', background: 'linear-gradient(90deg,#0B1628 0%,#07101F 100%)' }}>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Contact Us</h2>
            <p className="text-xs text-slate-400 mt-0.5">We'll get back to you within 24 hours.</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-7">
          {status === 'success' ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Message Sent!</h3>
              <p className="text-sm text-slate-400 mb-6">Thank you for reaching out. We'll get back to you soon.</p>
              <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:opacity-90 transition-opacity cursor-pointer">
                Close
              </button>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Your Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      name="from_name"
                      value={form.from_name}
                      onChange={handleChange}
                      placeholder="John Doe"
                      required
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      name="from_email"
                      value={form.from_email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Subject</label>
                <input
                  type="text"
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  placeholder="How can we help?"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all"
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Message</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Tell us about your question or issue..."
                    rows={4}
                    required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all resize-none scrollbar-thin"
                    style={inputStyle}
                  />
                </div>
              </div>

              {status === 'error' && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <p className="text-sm text-rose-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(90deg, #0891B2, #2563EB)' }}
              >
                {status === 'sending' ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
