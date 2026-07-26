import DashboardLayout from '../components/DashboardLayout'
import ChatEngine from '../components/ChatEngine'

export default function Chat() {
  return (
    <DashboardLayout title="AI Chat" subtitle="Ask about your logs, errors, and anomalies">
      <div className="flex h-[calc(100vh-220px)] min-h-[500px] w-full">
        <div className="w-full flex flex-col h-full">
          <ChatEngine fullHeight />
        </div>
      </div>
    </DashboardLayout>
  )
}
