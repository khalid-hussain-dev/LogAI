import { motion } from 'framer-motion'
import { Activity, BrainCircuit, LineChart } from 'lucide-react'
import AnimatedAuthBackground from './AnimatedAuthBackground'

function FeatureItem({ icon: Icon, title, description }) {
  return (
    <motion.div
      className="flex items-start gap-4 group"
      whileHover={{ x: 5 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200 transition-transform group-hover:scale-110">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="font-semibold text-white mb-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">{title}</h3>
        <p className="text-sm text-slate-200">{description}</p>
      </div>
    </motion.div>
  )
}

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen w-full flex dark bg-slate-950">
      {/* Left Side - Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 md:p-12 relative z-10">
        <div className="w-full max-w-md">{children}</div>
      </div>

      {/* Right Side - Animated Background */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <AnimatedAuthBackground />

        {/* Content overlay - backdrop keeps text clear of background */}
        <div className="relative z-10 flex flex-col justify-center p-16 text-white">
          <div
            className="absolute inset-0 left-0 w-[85%] -z-[1]"
            style={{
              background: 'linear-gradient(90deg, rgba(6,13,26,0.85) 0%, rgba(6,13,26,0.4) 70%, transparent 100%)',
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative z-0"
          >
            <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(34,211,238,0.3)]" style={{ textShadow: '0 0 24px rgba(34,211,238,0.2)' }}>
              AI-Powered Log Analysis
            </h2>
            <p className="text-lg text-slate-100 mb-8 leading-relaxed max-w-md drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
              Monitor, analyze, and debug your systems with intelligent log aggregation and real-time insights.
            </p>

            <div className="space-y-6">
              <FeatureItem
                icon={Activity}
                title="Real-time Processing"
                description="Analyze millions of logs per second with AI-powered pattern detection"
              />
              <FeatureItem
                icon={BrainCircuit}
                title="Smart Anomaly Detection"
                description="Automatically identify issues before they impact your users"
              />
              <FeatureItem
                icon={LineChart}
                title="Advanced Analytics"
                description="Gain actionable insights with customizable dashboards and alerts"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
