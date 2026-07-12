import DashboardLayout from '../components/DashboardLayout'
import ArchitectureCanvas from '../components/ArchitectureCanvas'

export default function Architecture() {
  return (
    <DashboardLayout title="System Architecture Map" subtitle="2D Animated Visualization of LogAI Data Pipelines & Services">
      <div className="flex justify-center min-h-[calc(100vh-180px)]">
        <div className="w-full flex flex-col rounded-2xl p-6 border border-white/5 shadow-2xl shadow-cyan-950/20" style={{ backgroundColor: '#081120', minHeight: '560px' }}>
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-xl font-bold text-white">Live Data Flow Diagram</h3>
              <p className="text-sm text-gray-400 mt-1">Hover over nodes to explore component responsibilities, protocols, and technical details.</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500"></span> Sources</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400"></span> Ingest & Core</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-400"></span> Pipelines</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-400"></span> Receivers</span>
            </div>
          </div>
          <div className="flex-1 w-full relative min-h-[480px]">
            <ArchitectureCanvas />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
