import { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, XCircle, AlertCircle } from 'lucide-react'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border pointer-events-auto"
              style={{
                backgroundColor: 'rgba(17, 24, 39, 0.95)',
                borderColor: toast.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : toast.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {toast.type === 'success' && <Check className="w-5 h-5 text-green-400 flex-shrink-0" />}
              {toast.type === 'error' && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
              {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />}
              <span className="text-base font-medium text-white">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
