import DashboardLayout from '../components/DashboardLayout'
import ChatEngine from '../components/ChatEngine'

export default function Chat() {
  return (
    <DashboardLayout title="AI Chat" subtitle="Ask about your logs, errors, and anomalies">
      <div className="flex justify-center min-h-[calc(100vh-200px)]">
        <div className="w-full max-w-[800px] flex flex-col" style={{ minHeight: '500px' }}>
          <ChatEngine fullHeight />
        </div>
      </div>
    </DashboardLayout>
  )
}
