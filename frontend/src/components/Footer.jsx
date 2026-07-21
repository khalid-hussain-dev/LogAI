import { Zap, Database, GitBranch, Cpu, Globe } from 'lucide-react'

const TECH_STACK = [
  { icon: Zap, label: 'FastAPI', color: '#22D3EE' },
  { icon: Globe, label: 'React', color: '#38BDF8' },
  { icon: Database, label: 'Elasticsearch', color: '#F59E0B' },
  { icon: Database, label: 'PostgreSQL', color: '#818CF8' },
  { icon: Cpu, label: 'Redis', color: '#FB7185' },
  { icon: GitBranch, label: 'DeepSeek AI', color: '#A78BFA' },
]

export default function Footer({ onTeamClick, onContactClick }) {
  const year = new Date().getFullYear()

  return (
    <footer
      className="mt-auto border-t px-6 py-5 flex-shrink-0"
      style={{
        borderColor: 'rgba(34,211,238,0.07)',
        backgroundColor: 'rgba(5,9,20,0.6)',
      }}
    >
      <div className="max-w-[1440px] mx-auto flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left — Copyright */}
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-slate-400">
            © {year} <span className="text-cyan-400 font-bold">LogAI</span> — AI-Powered Log Monitoring Platform
          </p>
          <p className="text-[11px] text-slate-600">
            Built for Advanced Software Engineering
          </p>
        </div>

        {/* Center — Tech Stack */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[10px] text-slate-600 uppercase tracking-widest font-bold hidden md:block">Built with</span>
          {TECH_STACK.map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all duration-200 hover:scale-105"
              style={{
                borderColor: `${color}22`,
                color: color,
                backgroundColor: `${color}0C`,
              }}
              title={label}
            >
              <Icon className="w-3 h-3" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Right — Links */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={onTeamClick}
            className="text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer"
          >
            Meet the Team
          </button>
          <span className="text-slate-700 text-xs">·</span>
          <button
            onClick={onContactClick}
            className="text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors duration-200 cursor-pointer"
          >
            Contact Us
          </button>
        </div>
      </div>
    </footer>
  )
}
