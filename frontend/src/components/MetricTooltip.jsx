import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

export default function MetricTooltip({ title, formula, description }) {
  const [show, setShow] = useState(false)
  const [coords, setCoords] = useState({ left: 0, top: 0 })
  const iconRef = useRef(null)

  useEffect(() => {
    if (show && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect()
      setCoords({
        left: rect.left + rect.width / 2,
        top: rect.top - 8 // 8px above the icon
      })
    }
  }, [show])

  return (
    <div 
      className="relative inline-flex items-center ml-1.5 cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      ref={iconRef}
    >
      <Info className="w-3.5 h-3.5 text-slate-500 hover:text-cyan-400 transition-colors" />
      
      {show && createPortal(
        <div 
          className="fixed w-64 p-3 bg-slate-900 border border-slate-700 shadow-xl rounded-xl z-[9999] animate-in fade-in zoom-in duration-200 pointer-events-none"
          style={{ 
            left: coords.left, 
            top: coords.top,
            transform: 'translate(-50%, -100%)' 
          }}
        >
          <div className="text-xs font-bold text-white mb-1">{title}</div>
          {formula && (
            <div className="font-mono text-[10px] bg-slate-950 text-cyan-400 p-1.5 rounded border border-cyan-500/20 mb-2 whitespace-pre-wrap">
              {formula}
            </div>
          )}
          <div className="text-[10px] text-slate-400 leading-relaxed">
            {description}
          </div>
          
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-700" />
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[2px] border-4 border-transparent border-t-slate-900" />
        </div>,
        document.body
      )}
    </div>
  )
}
