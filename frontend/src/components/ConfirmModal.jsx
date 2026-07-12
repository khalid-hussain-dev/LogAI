import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Trash2, LogOut, X } from 'lucide-react'

const ICONS = {
  danger: AlertTriangle,
  delete: Trash2,
  logout: LogOut,
}

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
}) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  const Icon = ICONS[variant] || AlertTriangle
  const confirmColors = variant === 'danger' || variant === 'delete'
    ? 'bg-red-600 hover:bg-red-500 hover:shadow-red-500/25 shadow-lg'
    : variant === 'logout'
      ? 'bg-orange-600 hover:bg-orange-500 hover:shadow-orange-500/25 shadow-lg'
      : 'bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/25 shadow-lg'
  const iconBg = variant === 'danger' || variant === 'delete' ? 'bg-red-500/15' : variant === 'logout' ? 'bg-orange-500/15' : 'bg-blue-500/15'
  const iconColor = variant === 'danger' || variant === 'delete' ? '#EF4444' : variant === 'logout' ? '#F59E0B' : '#3B82F6'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          onClick={handleOverlayClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm rounded-2xl p-6 relative"
            style={{ backgroundColor: '#111827', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all duration-200">
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${iconBg}`}>
                <Icon className="w-7 h-7" style={{ color: iconColor }} />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
              <p className="text-base text-gray-400 mb-6 leading-relaxed">{description}</p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-lg text-base font-medium text-gray-300 border border-white/10 hover:bg-white/5 hover:border-white/20 transition-all duration-200 cursor-pointer"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => { onConfirm(); onClose() }}
                  className={`flex-1 px-4 py-3 rounded-lg text-base font-semibold text-white transition-all duration-200 cursor-pointer ${confirmColors}`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
