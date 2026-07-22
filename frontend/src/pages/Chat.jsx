import DashboardLayout from '../components/DashboardLayout'
import ChatEngine from '../components/ChatEngine'

export default function Chat() {
  return (
    <DashboardLayout title="AI Chat" subtitle="Ask about your logs, errors, and anomalies">
      <div className="flex justify-center h-[calc(100vh-220px)] max-h-[750px] min-h-[500px]">
        <div className="w-full max-w-[800px] flex flex-col h-full">
          <ChatEngine fullHeight />
        </div>
      </div>
    </DashboardLayout>
  )
}
